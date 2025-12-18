/**
 * Script de migración: Crear ProjectMember para proyectos existentes
 * Crea entrada en ProjectMember con rol OWNER para cada proyecto que no tenga miembros
 */

import prisma from "../src/lib/prisma";

async function migrate() {
  console.log("\n🔄 Migrando proyectos existentes a sistema RBAC...\n");

  try {
    // 1. Obtener todos los proyectos existentes
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        ownerId: true,
        name: true,
      },
    });

    console.log(`📊 Encontrados ${projects.length} proyectos\n`);

    if (projects.length === 0) {
      console.log("✅ No hay proyectos para migrar");
      return;
    }

    // 2. Verificar cuáles proyectos ya tienen miembros
    const projectsWithoutMembers = [];
    for (const project of projects) {
      const existingMember = await prisma.projectMember.findFirst({
        where: {
          projectId: project.id,
          userId: project.ownerId,
        },
      });

      if (!existingMember) {
        projectsWithoutMembers.push(project);
      }
    }

    console.log(
      `📋 ${projectsWithoutMembers.length} proyectos necesitan ProjectMember:\n`,
    );

    if (projectsWithoutMembers.length === 0) {
      console.log("✅ Todos los proyectos ya tienen sus miembros configurados");
      return;
    }

    for (const project of projectsWithoutMembers) {
      console.log(`   • "${project.name}" → Owner: ${project.ownerId}`);
    }

    console.log("\n⚠️  Esta migración creará ProjectMember con rol OWNER");
    console.log("    para cada proyecto sin miembros asignados\n");

    // 3. Crear ProjectMember para cada proyecto
    console.log("🚀 Iniciando migración...\n");

    let created = 0;
    for (const project of projectsWithoutMembers) {
      try {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: project.ownerId,
            role: "OWNER",
            acceptedAt: new Date(), // Auto-aceptado
          },
        });
        created++;
        console.log(`  ✓ ProjectMember creado para "${project.name}"`);
      } catch (error: any) {
        console.error(`  ✗ Error en "${project.name}": ${error.message}`);
      }
    }

    console.log(
      `\n✅ Migración completada: ${created}/${projectsWithoutMembers.length} ProjectMembers creados`,
    );
    console.log("\n📋 Sistema RBAC listo para usar\n");
  } catch (error: any) {
    console.error("\n❌ Error en migración:", error.message);
    console.error("\nDetalles:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
