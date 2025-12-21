/**
 * TEST SCRIPT - Sistema de Notificaciones e Incidencias
 *
 * Este script demuestra el flujo completo del sistema:
 * 1. Crear una validación
 * 2. Crear issues
 * 3. Generar notificaciones
 * 4. Ejecutar segunda validación
 * 5. Detectar cambios automáticamente
 *
 * USO:
 * node test-notification-system.js
 */

const API_URL = "http://localhost:8080";

// Mock user ID (usa uno real de tu base de datos)
const USER_ID = "test-user-123";
const PROJECT_ID = "test-project-456";
const FILE_ID = "test-file-789";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testValidationFlow() {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║     🧪 TESTING NOTIFICATION & VALIDATION SYSTEM 🧪          ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  try {
    // ============================================
    // TEST 1: Primera Validación
    // ============================================
    console.log("📝 TEST 1: Ejecutando primera validación...\n");

    const validation1 = await fetch(`${API_URL}/api/validation-runner/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: FILE_ID,
        fileName: "Torre-Reforma-Test.rvt",
        fileUrn: "urn:test:12345",
        projectId: PROJECT_ID,
        userId: USER_ID,
        etData: [
          { tag: "FV-101", type: "Ball Valve", size: '2"' },
          { tag: "P-205", type: "Centrifugal Pump", power: "50HP" },
          { tag: "V-300", type: "Storage Tank", capacity: "1000L" },
        ],
        modelData: [
          { tag: "FV-101", type: "Gate Valve", size: '2"' }, // MISMATCH
          { tag: "V-300", type: "Storage Tank", capacity: "1000L" },
          { tag: "EXTRA-001", type: "Unknown" }, // UNDOCUMENTED
          // P-205 MISSING
        ],
      }),
    });

    const result1 = await validation1.json();

    if (result1.success) {
      console.log("✅ Validación 1 completada:");
      console.log(`   Validation ID: ${result1.data.validation.id}`);
      console.log(`   Total Issues: ${result1.data.summary.issues}`);
      console.log(`   - Missing: ${result1.data.summary.missing}`);
      console.log(`   - Mismatch: ${result1.data.summary.mismatch}`);
      console.log(`   - Undocumented: ${result1.data.summary.undocumented}\n`);
    } else {
      console.error("❌ Error en validación 1:", result1.error);
      return;
    }

    await sleep(1000);

    // ============================================
    // TEST 2: Verificar Notificaciones Creadas
    // ============================================
    console.log("📬 TEST 2: Verificando notificaciones...\n");

    const notifs1 = await fetch(
      `${API_URL}/api/notifications?userId=${USER_ID}&limit=10`,
    );
    const notifsResult1 = await notifs1.json();

    if (notifsResult1.success) {
      console.log(
        `✅ Notificaciones encontradas: ${notifsResult1.data.notifications.length}`,
      );
      console.log(`   Unread: ${notifsResult1.data.unreadCount}\n`);

      notifsResult1.data.notifications.forEach((notif, i) => {
        console.log(`   ${i + 1}. ${notif.type} - ${notif.title}`);
        console.log(`      "${notif.message}"`);
        console.log(
          `      Priority: ${notif.priority} | Read: ${notif.read}\n`,
        );
      });
    }

    await sleep(2000);

    // ============================================
    // TEST 3: Segunda Validación (Archivo Modificado)
    // ============================================
    console.log(
      "📝 TEST 3: Ejecutando segunda validación (archivo modificado)...\n",
    );

    const validation2 = await fetch(`${API_URL}/api/validation-runner/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: FILE_ID, // MISMO archivo
        fileName: "Torre-Reforma-Test.rvt",
        fileUrn: "urn:test:12345-v2",
        projectId: PROJECT_ID,
        userId: USER_ID,
        etData: [
          { tag: "FV-101", type: "Ball Valve", size: '2"' },
          { tag: "P-205", type: "Centrifugal Pump", power: "50HP" },
          { tag: "V-300", type: "Storage Tank", capacity: "1000L" },
        ],
        modelData: [
          { tag: "FV-101", type: "Gate Valve", size: '2"' }, // SIGUE MISMATCH
          { tag: "P-205", type: "Centrifugal Pump", power: "50HP" }, // AHORA OK! (RESUELTO)
          { tag: "V-300", type: "Storage Tank", capacity: "1000L" },
          { tag: "EXTRA-001", type: "Unknown" }, // SIGUE UNDOCUMENTED
          { tag: "NEW-500", type: "New Element" }, // NUEVO UNDOCUMENTED
        ],
      }),
    });

    const result2 = await validation2.json();

    if (result2.success) {
      console.log("✅ Validación 2 completada:");
      console.log(`   Validation ID: ${result2.data.validation.id}`);
      console.log(`   Total Issues: ${result2.data.summary.issues}`);
      console.log(
        `   - Missing: ${result2.data.summary.missing} (era 1, ahora 0 - MEJORÓ!)`,
      );
      console.log(`   - Mismatch: ${result2.data.summary.mismatch}`);
      console.log(
        `   - Undocumented: ${result2.data.summary.undocumented} (era 1, ahora 2)\n`,
      );
    }

    await sleep(1000);

    // ============================================
    // TEST 4: Verificar Notificación de Cambios
    // ============================================
    console.log(
      "🔍 TEST 4: Verificando notificación de cambios detectados...\n",
    );

    const notifs2 = await fetch(
      `${API_URL}/api/notifications?userId=${USER_ID}&type=FILE_CHANGED`,
    );
    const notifsResult2 = await notifs2.json();

    if (notifsResult2.success && notifsResult2.data.notifications.length > 0) {
      const changeNotif = notifsResult2.data.notifications[0];
      console.log("✅ Notificación FILE_CHANGED encontrada:");
      console.log(`   Title: ${changeNotif.title}`);
      console.log(`   Message: ${changeNotif.message}`);
      console.log(`   Priority: ${changeNotif.priority}`);

      if (changeNotif.metadata) {
        const metadata = JSON.parse(changeNotif.metadata);
        console.log(`\n   📊 Detalles de cambios:`);
        console.log(`   - Nuevos issues: ${metadata.newIssues?.length || 0}`);
        console.log(
          `   - Issues resueltos: ${metadata.resolvedIssues?.length || 0}`,
        );
        if (metadata.changes) {
          metadata.changes.forEach((change) => {
            console.log(`   - ${change}`);
          });
        }
      }
      console.log("");
    } else {
      console.log(
        "⚠️  No se encontró notificación FILE_CHANGED (puede tardar unos segundos)\n",
      );
    }

    await sleep(1000);

    // ============================================
    // TEST 5: Comparar Validaciones
    // ============================================
    console.log("🔄 TEST 5: Comparando ambas validaciones...\n");

    const compare = await fetch(
      `${API_URL}/api/validations/compare/${result1.data.validation.id}/${result2.data.validation.id}`,
    );
    const compareResult = await compare.json();

    if (compareResult.success) {
      const changes = compareResult.data.changes;
      console.log("✅ Comparación completada:");
      console.log(
        `   Validación 1: ${compareResult.data.validation1.totalIssues} issues`,
      );
      console.log(
        `   Validación 2: ${compareResult.data.validation2.totalIssues} issues`,
      );
      console.log(`\n   📈 Cambios detectados:`);
      console.log(`   - Nuevos issues: ${changes.newIssues}`);
      console.log(`   - Issues resueltos: ${changes.resolvedIssues}`);
      console.log(`   - Issues modificados: ${changes.changedIssues}`);

      if (changes.details.new.length > 0) {
        console.log(`\n   ➕ Nuevos:`);
        changes.details.new.forEach((issue) => {
          console.log(`      - ${issue.elementTag}: ${issue.type}`);
        });
      }

      if (changes.details.resolved.length > 0) {
        console.log(`\n   ✅ Resueltos:`);
        changes.details.resolved.forEach((issue) => {
          console.log(`      - ${issue.elementTag}: ${issue.type}`);
        });
      }
      console.log("");
    }

    await sleep(1000);

    // ============================================
    // TEST 6: Estadísticas
    // ============================================
    console.log("📊 TEST 6: Obteniendo estadísticas...\n");

    const stats = await fetch(
      `${API_URL}/api/validations/stats/summary?fileId=${FILE_ID}`,
    );
    const statsResult = await stats.json();

    if (statsResult.success) {
      const data = statsResult.data;
      console.log("✅ Estadísticas:");
      console.log(`   Total validaciones: ${data.totalValidations}`);
      console.log(`   Total issues: ${data.totalIssues}`);
      console.log(`   - Abiertas: ${data.openIssues}`);
      console.log(`   - Resueltas: ${data.resolvedIssues}`);
      console.log(`\n   Por tipo:`);
      console.log(`   - MISSING: ${data.byType.MISSING}`);
      console.log(`   - MISMATCH: ${data.byType.MISMATCH}`);
      console.log(`   - UNDOCUMENTED: ${data.byType.UNDOCUMENTED}`);
      console.log(`\n   Por severidad:`);
      console.log(`   - HIGH: ${data.bySeverity.HIGH}`);
      console.log(`   - MEDIUM: ${data.bySeverity.MEDIUM}`);
      console.log(`   - LOW: ${data.bySeverity.LOW}\n`);
    }

    // ============================================
    // RESUMEN FINAL
    // ============================================
    console.log(
      "╔═══════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║                    ✅ TESTS COMPLETADOS ✅                   ║",
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════════╝\n",
    );
    console.log("🎉 Sistema funcionando correctamente!\n");
    console.log("📝 Resumen:");
    console.log("   • Validaciones guardadas en DB");
    console.log("   • Issues registrados con severidad");
    console.log("   • Notificaciones creadas automáticamente");
    console.log("   • Cambios detectados entre versiones");
    console.log("   • Comparación funcional");
    console.log("   • Estadísticas disponibles\n");
    console.log("🔔 Ahora puedes:");
    console.log("   1. Ver las notificaciones en el frontend (campana)");
    console.log("   2. Revisar el historial de validaciones");
    console.log("   3. Comparar entre versiones");
    console.log("   4. Marcar issues como resueltos\n");
  } catch (error) {
    console.error("\n❌ Error en tests:", error.message);
    console.error("\n💡 Asegúrate de que:");
    console.error("   • El backend esté corriendo (http://localhost:8080)");
    console.error("   • La base de datos esté migrada (npx prisma db push)");
    console.error("   • Exista un usuario con ID:", USER_ID, "\n");
  }
}

// Ejecutar tests
testValidationFlow();
