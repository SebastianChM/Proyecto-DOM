const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createMockFile() {
    try {
        // 1. Get or create user
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: 'tester@dom.com',
                    name: 'Tester',
                    apsUserId: 'test-user'
                }
            });
        }

        // 2. Get or create project
        let project = await prisma.project.findFirst({
            where: { name: 'Mock Project' }
        });

        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: 'Mock Project',
                    description: 'Project for testing BOM extraction',
                    user: {
                        connect: { id: user.id }
                    }
                }
            });
            console.log('Created Mock Project:', project.id);
        }

        // 3. Create Mock Ready File
        const file = await prisma.file.create({
            data: {
                name: 'mock-architecture.rvt',
                originalName: 'mock-architecture.rvt',
                type: 'RVT',
                size: 1024 * 1024 * 5, // 5MB
                s3Key: 'mock/file.rvt',
                apsUrn: 'local-mock-urn-12345', // Starts with local- to trigger mock BOM
                status: 'READY',
                projectId: project.id,
                userId: user.id
            }
        });

        console.log('✅ Created Mock Ready File:');
        console.log(`ID: ${file.id}`);
        console.log(`URN: ${file.apsUrn}`);
        console.log(`Status: ${file.status}`);
        console.log(`Project ID: ${project.id}`);

    } catch (error) {
        console.error('Error creating mock file:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createMockFile();
