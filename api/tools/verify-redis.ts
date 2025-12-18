/**
 * Script de Verificación de Redis
 * Prueba todas las funcionalidades de Redis implementadas
 */

import { redis, cacheService, lockService, RedisKeys } from "../src/lib/redis";
import { rateLimiter } from "../src/services/rate-limiter.service";

async function verifyRedis() {
  console.log("\n🔍 ===== VERIFICACIÓN DE REDIS =====\n");

  let allPassed = true;

  // Test 1: Conexión básica
  console.log("📌 Test 1: Verificar conexión a Redis");
  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      console.log("✅ Redis está conectado correctamente\n");
    } else {
      throw new Error("Respuesta inesperada de ping");
    }
  } catch (error: any) {
    console.error("❌ Error de conexión:", error.message);
    allPassed = false;
    return;
  }

  // Test 2: Operaciones básicas de cache
  console.log("📌 Test 2: Cache Service - Operaciones básicas");
  try {
    const testKey = "test:verification:basic";
    const testValue = {
      name: "Test User",
      timestamp: new Date().toISOString(),
      data: [1, 2, 3, 4, 5],
    };

    // Set
    await cacheService.set(testKey, testValue, 60);
    console.log("  ✓ Set value");

    // Get
    const retrieved = await cacheService.get(testKey);
    if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
      console.log("  ✓ Get value (correcto)");
    } else {
      throw new Error("Valor recuperado no coincide");
    }

    // Exists
    const exists = await cacheService.exists(testKey);
    if (exists) {
      console.log("  ✓ Exists check");
    } else {
      throw new Error("Key debería existir");
    }

    // Delete
    await cacheService.del(testKey);
    const deletedExists = await cacheService.exists(testKey);
    if (!deletedExists) {
      console.log("  ✓ Delete key");
    } else {
      throw new Error("Key no fue eliminada");
    }

    console.log("✅ Cache Service funciona correctamente\n");
  } catch (error: any) {
    console.error("❌ Error en Cache Service:", error.message);
    allPassed = false;
  }

  // Test 3: GetOrSet pattern
  console.log("📌 Test 3: Cache Service - GetOrSet pattern");
  try {
    const testKey = "test:verification:getorset";
    let fetchCount = 0;

    const fetcher = async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simular query lenta
      return { value: "fetched data", count: fetchCount };
    };

    // Primera llamada: debe fetchear
    const result1 = await cacheService.getOrSet(testKey, fetcher, 60);
    console.log(`  ✓ Primera llamada - fetched (fetchCount: ${fetchCount})`);

    // Segunda llamada: debe usar cache
    const result2 = await cacheService.getOrSet(testKey, fetcher, 60);
    console.log(`  ✓ Segunda llamada - from cache (fetchCount: ${fetchCount})`);

    if (fetchCount === 1 && result1.value === result2.value) {
      console.log(
        "✅ GetOrSet funciona correctamente (cache hit en 2da llamada)\n",
      );
    } else {
      throw new Error("GetOrSet no está usando cache correctamente");
    }

    await cacheService.del(testKey);
  } catch (error: any) {
    console.error("❌ Error en GetOrSet:", error.message);
    allPassed = false;
  }

  // Test 4: Invalidación por patrón
  console.log("📌 Test 4: Invalidación de cache por patrón");
  try {
    // Crear múltiples keys
    await cacheService.set("permissions:user1:proj1", { perm: "read" });
    await cacheService.set("permissions:user1:proj2", { perm: "write" });
    await cacheService.set("permissions:user2:proj1", { perm: "admin" });
    console.log("  ✓ Creadas 3 keys de permisos");

    // Invalidar solo las de user1
    const deleted = await cacheService.invalidatePattern("permissions:user1:*");
    console.log(`  ✓ Invalidadas ${deleted} keys (esperado: 2)`);

    // Verificar que user2 aún existe
    const user2Still = await cacheService.exists("permissions:user2:proj1");
    if (user2Still && deleted === 2) {
      console.log("✅ Invalidación por patrón funciona correctamente\n");
    } else {
      throw new Error("Invalidación incorrecta");
    }

    await cacheService.del("permissions:user2:proj1");
  } catch (error: any) {
    console.error("❌ Error en invalidación:", error.message);
    allPassed = false;
  }

  // Test 5: Lock Service
  console.log("📌 Test 5: Lock Service (prevenir race conditions)");
  try {
    const resource = "file";
    const resourceId = "test-file-123";

    // Adquirir lock
    const acquired = await lockService.acquire(resource, resourceId, 30);
    if (acquired) {
      console.log("  ✓ Lock adquirido");
    } else {
      throw new Error("No se pudo adquirir lock");
    }

    // Intentar adquirir el mismo lock (debería fallar)
    const acquiredAgain = await lockService.acquire(resource, resourceId, 30);
    if (!acquiredAgain) {
      console.log("  ✓ Lock bloqueado correctamente (evita duplicados)");
    } else {
      throw new Error("Lock no está bloqueando correctamente");
    }

    // Liberar lock
    await lockService.release(resource, resourceId);
    console.log("  ✓ Lock liberado");

    // Verificar que ahora sí se puede adquirir
    const acquiredAfterRelease = await lockService.acquire(
      resource,
      resourceId,
      30,
    );
    if (acquiredAfterRelease) {
      console.log("  ✓ Lock re-adquirido después de liberar");
      await lockService.release(resource, resourceId);
    } else {
      throw new Error("No se pudo re-adquirir lock");
    }

    console.log("✅ Lock Service funciona correctamente\n");
  } catch (error: any) {
    console.error("❌ Error en Lock Service:", error.message);
    allPassed = false;
  }

  // Test 6: Rate Limiter
  console.log("📌 Test 6: Rate Limiter Service");
  try {
    const identifier = "test-user-123";
    const endpoint = "test-endpoint";
    const maxRequests = 5;
    const windowSeconds = 10;

    // Hacer requests hasta el límite
    let allowedCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < 7; i++) {
      const result = await rateLimiter.checkLimit(
        identifier,
        endpoint,
        maxRequests,
        windowSeconds,
      );

      if (result.allowed) {
        allowedCount++;
      } else {
        blockedCount++;
      }
    }

    console.log(`  ✓ Requests permitidas: ${allowedCount} (esperado: 5)`);
    console.log(`  ✓ Requests bloqueadas: ${blockedCount} (esperado: 2)`);

    if (allowedCount === 5 && blockedCount === 2) {
      console.log("✅ Rate Limiter funciona correctamente\n");
    } else {
      throw new Error(
        `Rate limiter no está limitando correctamente (allowed: ${allowedCount}, blocked: ${blockedCount})`,
      );
    }

    // Resetear para cleanup
    await rateLimiter.reset(identifier, endpoint);
  } catch (error: any) {
    console.error("❌ Error en Rate Limiter:", error.message);
    allPassed = false;
  }

  // Test 7: Operaciones múltiples (mget/mset)
  console.log("📌 Test 7: Operaciones múltiples (mget/mset)");
  try {
    const items = [
      { key: "test:multi:1", value: { id: 1, name: "Item 1" }, ttl: 60 },
      { key: "test:multi:2", value: { id: 2, name: "Item 2" }, ttl: 60 },
      { key: "test:multi:3", value: { id: 3, name: "Item 3" }, ttl: 60 },
    ];

    // Guardar múltiples
    await cacheService.mset(items);
    console.log("  ✓ mset: 3 items guardados");

    // Leer múltiples
    const keys = items.map((i) => i.key);
    const values = await cacheService.mget(keys);

    if (values.length === 3 && values.every((v) => v !== null)) {
      console.log("  ✓ mget: 3 items recuperados");
      console.log("✅ Operaciones múltiples funcionan correctamente\n");
    } else {
      throw new Error("mget no recuperó todos los items");
    }

    // Cleanup
    for (const key of keys) {
      await cacheService.del(key);
    }
  } catch (error: any) {
    console.error("❌ Error en operaciones múltiples:", error.message);
    allPassed = false;
  }

  // Test 8: Increment (para contadores)
  console.log("📌 Test 8: Increment (contadores atómicos)");
  try {
    const counterKey = "test:counter:views";

    const count1 = await cacheService.increment(counterKey, 60);
    const count2 = await cacheService.increment(counterKey, 60);
    const count3 = await cacheService.increment(counterKey, 60);

    console.log(`  ✓ Increment 1: ${count1}`);
    console.log(`  ✓ Increment 2: ${count2}`);
    console.log(`  ✓ Increment 3: ${count3}`);

    if (count1 === 1 && count2 === 2 && count3 === 3) {
      console.log("✅ Increment funciona correctamente\n");
    } else {
      throw new Error("Increment no está incrementando correctamente");
    }

    await cacheService.del(counterKey);
  } catch (error: any) {
    console.error("❌ Error en Increment:", error.message);
    allPassed = false;
  }

  // Test 9: TTL y expiración
  console.log("📌 Test 9: TTL y expiración automática");
  try {
    const tempKey = "test:expire:fast";

    await cacheService.set(tempKey, { data: "temporary" }, 2); // 2 segundos
    console.log("  ✓ Key creada con TTL de 2 segundos");

    const ttl1 = await cacheService.ttl(tempKey);
    console.log(`  ✓ TTL inicial: ${ttl1}s`);

    // Esperar 1 segundo
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const ttl2 = await cacheService.ttl(tempKey);
    console.log(`  ✓ TTL después de 1s: ${ttl2}s`);

    // Esperar 2 segundos más (debería expirar)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const expired = await cacheService.get(tempKey);

    if (expired === null) {
      console.log("  ✓ Key expirada correctamente");
      console.log("✅ TTL y expiración funcionan correctamente\n");
    } else {
      throw new Error("Key no expiró cuando debería");
    }
  } catch (error: any) {
    console.error("❌ Error en TTL:", error.message);
    allPassed = false;
  }

  // Resumen final
  console.log("\n🏁 ===== RESUMEN FINAL =====\n");

  if (allPassed) {
    console.log("✅ TODOS LOS TESTS PASARON");
    console.log("✅ Redis está configurado y funcionando correctamente");
    console.log("✅ Cache Service está operativo");
    console.log("✅ Lock Service está operativo");
    console.log("✅ Rate Limiter está operativo");
    console.log("\n🚀 Sistema listo para producción con Redis\n");
  } else {
    console.log("❌ ALGUNOS TESTS FALLARON");
    console.log("⚠️  Revisar errores arriba para diagnóstico\n");
  }

  // Desconectar
  await redis.quit();
  console.log("👋 Conexión a Redis cerrada\n");

  process.exit(allPassed ? 0 : 1);
}

// Ejecutar verificación
verifyRedis().catch((error) => {
  console.error("❌ Error fatal en verificación:", error);
  process.exit(1);
});
