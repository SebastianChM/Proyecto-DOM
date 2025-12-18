import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
    console.log('\n=== USUARIOS EN LA BASE DE DATOS ===\n');
    const users = await prisma.user.findMany();
    users.forEach(u => {
        console.log(`Email: ${u.email}`);
        console.log(`Nombre: ${u.name}`);
        console.log(`Rol: ${u.role}`);
        console.log(`ID: ${u.id}`);
        console.log('---');
    });

    console.log('\n=== PROYECTOS EN LA BASE DE DATOS ===\n');
    const projects = await prisma.project.findMany({
        include: {
            owner: true,
            files: true
        }
    });
    
    projects.forEach(p => {
        console.log(`Proyecto: ${p.name}`);
        console.log(`Owner: ${p.owner.email} (${p.owner.name})`);
        console.log(`Archivos: ${p.files.length}`);
        console.log(`ID Proyecto: ${p.id}`);
        console.log(`ID Owner: ${p.ownerId}`);
        console.log('---');
    });

    console.log(`\nTotal usuarios: ${users.length}`);
    console.log(`Total proyectos: ${projects.length}`);

    await prisma.$disconnect();
}

checkDatabaseStatus().catch(console.error);
