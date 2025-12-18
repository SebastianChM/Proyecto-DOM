/**
 * Fix Projects Ownership
 * 
 * Assigns all projects to the first available user (the logged-in user)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixProjectsOwnership() {
    console.log('🔧 Fixing project ownership...');

    // Get all users
    const users = await prisma.user.findMany();
    console.log('Users in database:');
    users.forEach(u => console.log(`  - ${u.id}: ${u.email} (${u.name})`));

    if (users.length === 0) {
        console.log('❌ No users found. Please login first.');
        return;
    }

    // Get all projects
    const projects = await prisma.project.findMany();
    console.log(`\nProjects in database: ${projects.length}`);

    if (projects.length === 0) {
        console.log('❌ No projects found.');
        return;
    }

    // Find the real user (not the seed one)
    // Priority: look for Autodesk user (has apsUserId)
    const realUser = users.find(u => u.apsUserId) || users[0];
    console.log(`\nUsing user: ${realUser.email} (${realUser.name})`);

    // Update all projects to belong to this user
    for (const project of projects) {
        await prisma.project.update({
            where: { id: project.id },
            data: { ownerId: realUser.id }
        });

        // Update or create project member
        await prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: project.id,
                    userId: realUser.id
                }
            },
            update: { role: 'OWNER' },
            create: {
                projectId: project.id,
                userId: realUser.id,
                role: 'OWNER'
            }
        });

        console.log(`  ✅ Updated: ${project.name}`);
    }

    console.log('\n✅ All projects are now owned by', realUser.email);
}

fixProjectsOwnership()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
