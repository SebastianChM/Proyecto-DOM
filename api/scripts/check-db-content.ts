
import { PrismaClient } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load env from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking database content...');
        console.log('Database URL:', process.env.DATABASE_URL);
        
        const projectCount = await prisma.project.count();
        console.log(`Total Projects: ${projectCount}`);
        
        if (projectCount > 0) {
            const projects = await prisma.project.findMany({ take: 5 });
            console.log('Sample Projects:', JSON.stringify(projects, null, 2));
        } else {
            console.log('No projects found in the database.');
        }
        
        const userCount = await prisma.user.count();
        console.log(`Total Users: ${userCount}`);
        
    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
