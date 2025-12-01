require('dotenv').config({ path: '../.env' });
import { apsSyncService } from '../src/services/aps/sync.service';
import prisma from '../src/lib/prisma';

async function main() {
    console.log("🚀 Starting Data Layer Test...");
    
    try {
        // 1. Test Sync
        console.log("--- Testing Sync Engine ---");
        await apsSyncService.syncAccount();
        
        // 2. Verify Data in DB
        console.log("--- Verifying Database ---");
        const hubs = await prisma.apsHub.findMany();
        console.log(`Hubs: ${hubs.length}`);
        
        const projects = await prisma.apsProject.findMany();
        console.log(`Projects: ${projects.length}`);
        
        const folders = await prisma.apsFolder.findMany();
        console.log(`Folders: ${folders.length}`);
        
        const items = await prisma.apsItem.findMany();
        console.log(`Items: ${items.length}`);
        
        console.log("✅ Test Completed Successfully");
    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
