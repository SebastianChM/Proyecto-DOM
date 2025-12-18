/**
 * Script de migración: Migrar userId a uploadedBy en File
 */

import prisma from '../src/lib/prisma';

async function migrate() {
  console.log('\n🔄 Migrando archivos: userId → uploadedBy...\n');

  try {
    // 1. Agregar columna uploadedBy si no existe
    console.log('📝 Agregando columna uploadedBy...');
    try {
      await prisma.$executeRaw`ALTER TABLE File ADD COLUMN uploadedBy TEXT`;
      console.log('  ✓ Columna uploadedBy creada');
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        console.log('  ℹ Columna uploadedBy ya existe');
      } else {
        throw e;
      }
    }

    // 2. Copiar datos de userId a uploadedBy
    console.log('📝 Copiando datos userId → uploadedBy...');
    const result = await prisma.$executeRaw`
      UPDATE File 
      SET uploadedBy = userId 
      WHERE uploadedBy IS NULL AND userId IS NOT NULL
    `;

    console.log(`  ✓ Migrados ${result} archivos`);
    
    // 3. Hacer lo mismo para Project: copiar userId a ownerId
    console.log('📝 Verificando Project.ownerId...');
    try {
      const projectResult = await prisma.$executeRaw`
        UPDATE Project 
        SET ownerId = userId 
        WHERE ownerId IS NULL AND userId IS NOT NULL
      `;
      console.log(`  ✓ Migrados ${projectResult} proyectos`);
    } catch (e: any) {
      console.log('  ℹ Proyectos ya tienen ownerId');
    }

    console.log('\n✅ Migración completada');
    console.log('📋 Ahora puedes hacer: npx prisma db push --accept-data-loss\n');

  } catch (error: any) {
    console.error('\n❌ Error en migración:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
