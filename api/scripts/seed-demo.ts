import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create or get a default user
  const userEmail = 'demo@dom.com';
  let user = await prisma.user.findUnique({ where: { email: userEmail } });

  if (!user) {
    console.log('Creating demo user...');
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name: 'Demo User',
        role: 'ADMIN',
      },
    });
  } else {
    console.log('Demo user already exists.');
  }

  // 2. Create a fully populated project
  console.log('Creating demo project...');
  const project = await prisma.project.create({
    data: {
      name: 'Torre Reforma - Phase 2',
      description: 'High-rise mixed-use development in Mexico City. Includes structural and MEP coordination models.',
      clientName: 'Inmobiliaria Reforma',
      location: 'Paseo de la Reforma 483, Cuauhtémoc, Mexico City, Mexico',
      status: 'Active',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2026-12-20'),
      discipline: 'Architecture & Structural',
      ownerId: user.id,
      isFromAutodesk: false,
      files: {
        create: [
          {
            name: 'Architecture_Tower_v12.rvt',
            originalName: 'Architecture_Tower_v12.rvt',
            type: 'RVT',
            size: 450000000, // 450MB
            s3Key: 'demo/arch_v12.rvt',
            status: 'READY'
          },
          {
            name: 'Structure_Podium_v08.rvt',
            originalName: 'Structure_Podium_v08.rvt',
            type: 'RVT',
            size: 125000000, // 125MB
            s3Key: 'demo/struct_v08.rvt',
            status: 'READY'
          },
          {
            name: 'MEP_HVAC_L1-L10.ifc',
            originalName: 'MEP_HVAC_L1-L10.ifc',
            type: 'IFC',
            size: 85000000, // 85MB
            s3Key: 'demo/mep_hvac.ifc',
            status: 'TRANSLATING'
          }
        ]
      }
    },
  });

  console.log(`✅ Project created: ${project.name} (${project.id})`);
  console.log('✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
