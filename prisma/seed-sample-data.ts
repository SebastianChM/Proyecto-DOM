/**
 * Sample Data Seed Script
 * 
 * Creates sample users, projects, and files for testing
 * Run with: npx ts-node prisma/seed-sample-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSampleData() {
    console.log('🌱 Seeding sample data...');

    // Create sample user (if not exists)
    const user = await prisma.user.upsert({
        where: { email: 'sebastian@dom.com' },
        update: {},
        create: {
            email: 'sebastian@dom.com',
            name: 'Sebastián',
            role: 'ADMIN'
        }
    });

    console.log('  ✅ Created user:', user.name);

    // Create sample projects
    const projects = [
        {
            name: 'Torre Reforma - CDMX',
            description: 'Diseño estructural y MEP para torre de oficinas de 57 pisos',
            status: 'Active',
            clientName: 'Grupo Reforma',
            location: 'Ciudad de México, México',
            discipline: 'Estructural'
        },
        {
            name: 'Hospital Central - Santiago',
            description: 'Nuevo hospital con 500 camas, incluye instalaciones especiales',
            status: 'Active',
            clientName: 'Ministerio de Salud Chile',
            location: 'Santiago, Chile',
            discipline: 'MEP'
        },
        {
            name: 'Metro Línea 3 - Lima',
            description: 'Extensión de línea de metro con 12 estaciones subterráneas',
            status: 'Active',
            clientName: 'ATU Lima',
            location: 'Lima, Perú',
            discipline: 'Civil'
        },
        {
            name: 'Parque Eólico Atacama',
            description: 'Parque eólico de 200MW con 50 aerogeneradores',
            status: 'Draft',
            clientName: 'Enel Green Power',
            location: 'Atacama, Chile',
            discipline: 'Energía'
        },
        {
            name: 'Centro Comercial Norte',
            description: 'Mall de 3 niveles con 150 locales comerciales',
            status: 'Active',
            clientName: 'Retail Properties',
            location: 'Bogotá, Colombia',
            discipline: 'Arquitectura'
        }
    ];

    for (const projectData of projects) {
        const project = await prisma.project.create({
            data: {
                ...projectData,
                ownerId: user.id,
                startDate: new Date(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
            }
        });

        // Add owner as project member
        await prisma.projectMember.create({
            data: {
                projectId: project.id,
                userId: user.id,
                role: 'OWNER'
            }
        });

        // Create sample files for each project
        const fileTypes = ['RVT', 'DWG', 'PDF', 'IFC'];
        const fileNames = [
            `${project.name.split(' ')[0]}_Arquitectura.rvt`,
            `${project.name.split(' ')[0]}_Estructura.rvt`,
            `${project.name.split(' ')[0]}_Planos.dwg`,
            `${project.name.split(' ')[0]}_Especificaciones.pdf`
        ];

        for (let i = 0; i < fileNames.length; i++) {
            await prisma.file.create({
                data: {
                    name: fileNames[i],
                    originalName: fileNames[i],
                    type: fileTypes[i % fileTypes.length],
                    size: Math.floor(Math.random() * 100000000) + 1000000, // Random size 1-100MB
                    status: 'READY',
                    projectId: project.id,
                    uploadedBy: user.id
                }
            });
        }

        console.log(`  ✅ Created project: ${project.name} with ${fileNames.length} files`);
    }

    console.log('✅ Sample data seeding complete!');
    console.log(`   Created ${projects.length} projects for user ${user.email}`);
}

seedSampleData()
    .catch((e) => {
        console.error('❌ Error seeding sample data:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
