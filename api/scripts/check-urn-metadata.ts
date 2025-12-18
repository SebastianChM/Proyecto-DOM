
import * as dotenv from 'dotenv';
dotenv.config();
import { modelDerivativeService } from '../src/services/aps/model-derivative.service';

const TARGET_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ';

async function main() {
    console.log('🔍 Checking Metadata for URN:', TARGET_URN);
    try {
        const metadata = await modelDerivativeService.getMetadata(TARGET_URN);
        console.log('✅ Metadata retrieved.');

        const views = metadata.data.metadata;
        const views2D = views.filter((v: any) => v.role === '2d');
        const views3D = views.filter((v: any) => v.role === '3d');

        console.log(`📊 Summary:`);
        console.log(`   - 3D Views: ${views3D.length}`);
        console.log(`   - 2D Views (Sheets): ${views2D.length}`);

        if (views2D.length === 0) {
            console.log('⚠️ CONCLUSION: This model has NO 2D Sheets. PDF Conversion is IMPOSSIBLE via standard API.');
        } else {
            console.log('CTA: 2D Sheets exist. Conversion *should* work.');
        }

    } catch (err: any) {
        console.error('❌ Failed to get metadata:', err.message);
        if (err.response?.data) {
            console.error('Details:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

main();
