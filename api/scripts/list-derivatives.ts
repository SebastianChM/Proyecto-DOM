
import * as dotenv from 'dotenv';
dotenv.config();

import { modelDerivativeService } from '../src/services/aps/model-derivative.service';

const TARGET_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ';

async function main() {
    console.log('📊 Listing Available Derivatives...');

    try {
        const manifest = await modelDerivativeService.getManifest(TARGET_URN);
        console.log('\n=== AVAILABLE DERIVATIVES ===\n');

        if (manifest.derivatives) {
            manifest.derivatives.forEach((d: any, i: number) => {
                console.log(`${i + 1}. Output Type: ${d.outputType}`);
                console.log(`   Status: ${d.status}`);
                console.log(`   Progress: ${d.progress}`);

                if (d.children) {
                    console.log('   Resources:');
                    d.children.forEach((c: any) => {
                        console.log(`     - Role: ${c.role}, MIME: ${c.mime || 'N/A'}, Type: ${c.type}`);
                        if (c.role === '2d' || c.role === 'pdf' || c.mime?.includes('pdf')) {
                            console.log(`       *** PDF CANDIDATE ***`);
                            console.log(`       URN: ${c.urn}`);
                        }
                    });
                }
                console.log('');
            });
        }

        console.log('=== SUMMARY ===');
        console.log(`Total derivatives: ${manifest.derivatives?.length || 0}`);

        const hasPdf = manifest.derivatives?.some((d: any) =>
            d.outputType === 'pdf' ||
            d.children?.some((c: any) => c.mime?.includes('pdf') || c.role === 'pdf')
        );

        console.log(`Has PDF derivative: ${hasPdf ? 'YES' : 'NO'}`);

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

main();
