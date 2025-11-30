
import { designAutomationService } from '../src/services/aps/design-automation.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function test() {
    console.log('🧪 Testing Design Automation Setup...');

    try {
        console.log('1. Testing Nickname Setup...');
        await designAutomationService.setupNickname();

        console.log('2. Testing Activity Check/Creation...');
        const activityId = await designAutomationService.ensureDwgToPdfActivity();
        console.log(`✅ Activity ready: ${activityId}`);

        console.log('3. Listing Activities...');
        const activities = await designAutomationService.getActivities();
        console.log(`Found ${activities.length} activities.`);

    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

test();
