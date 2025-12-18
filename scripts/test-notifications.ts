import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Testing Notification query...');
    try {
        const count = await prisma.notification.count();
        console.log(`Notification count: ${count}`);

        const notifications = await prisma.notification.findMany({
            take: 5,
            include: {
                validationRun: true
            }
        });
        console.log('Fetched notifications:', JSON.stringify(notifications, null, 2));
    } catch (error) {
        console.error('Error querying notifications:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
