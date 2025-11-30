import { DerivativesApi } from 'forge-apis';
import { apsAuthService } from './auth.service';
import axios from 'axios';

export class APSModelDerivativeService {
    private api: any;

    constructor() {
        this.api = new DerivativesApi();
    }

    /**
     * Translate a file to SVF2 (for Viewer)
     */
    async translateToSVF2(urn: string) {
        const token = await apsAuthService.getInternalToken();

        const job = {
            input: {
                urn,
                compressedUrn: false
            },
            output: {
                formats: [{
                    type: 'svf2',
                    views: ['2d', '3d']
                }]
            }
        };

        // forge-apis expects { access_token: string } as credentials
        const result = await this.api.translate(job, { xAdsForce: true }, null, { access_token: token });
        return result.body;
    }

    /**
     * Translate to PDF using REST API directly
     * This gives us more control over the request format
     */
    async translateToPDF(urn: string, sheets?: string[]) {
        const token = await apsAuthService.getInternalToken();

        // Use SVF2 translation with advanced 2dviews parameter
        // This generates PDF views during SVF2 translation (works for DWG/RVT)
        const job = {
            input: {
                urn: urn
            },
            output: {
                destination: {
                    region: 'us'
                },
                formats: [{
                    type: 'svf2',
                    views: ['2d', '3d'],
                    advanced: {
                        '2dviews': 'pdf'
                    }
                }]
            }
        };

        console.log('📤 Sending SVF2 translation job with 2D PDF views...');
        console.log('Job payload:', JSON.stringify(job, null, 2));

        try {
            const response = await axios.post(
                'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
                job,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-ads-force': 'true'
                    }
                }
            );
            console.log('✅ Translation job started:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('❌ PDF translation error:', error.response?.data || error.message);
            if (error.response?.data?.diagnostic) {
                console.error('Diagnostic:', error.response.data.diagnostic);
            }
            throw error;
        }
    }

    /**
     * Translate to IFC
     */
    async translateToIFC(urn: string) {
        const token = await apsAuthService.getInternalToken();

        const job = {
            input: { urn },
            output: {
                formats: [{
                    type: 'ifc',
                    advanced: { exportFileStructure: 'multiple' }
                }]
            }
        };

        const result = await this.api.translate(job, { xAdsForce: true }, null, { access_token: token });
        return result.body;
    }

    /**
     * Get manifest (translation status)
     */
    async getManifest(urn: string) {
        const token = await apsAuthService.getInternalToken();
        const result = await this.api.getManifest(urn, {}, null, { access_token: token });
        return result.body;
    }

    /**
     * Get metadata (hierarchy)
     */
    async getMetadata(urn: string) {
        const token = await apsAuthService.getInternalToken();
        const result = await this.api.getMetadata(urn, {}, null, { access_token: token });
        return result.body;
    }

    /**
     * Get properties of a specific view/guid
     */
    async getProperties(urn: string, guid: string) {
        const token = await apsAuthService.getInternalToken();
        const result = await this.api.getModelviewProperties(urn, guid, {}, null, { access_token: token });
        return result.body;
    }

    /**
     * Download a derivative
     */
    async getDerivative(urn: string, derivativeUrn: string): Promise<Buffer> {
        const token = await apsAuthService.getInternalToken();

        // Use axios directly to ensure we get proper binary data
        const encodedUrn = encodeURIComponent(derivativeUrn);
        const url = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest/${encodedUrn}`;

        console.log(`📥 Fetching derivative from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'arraybuffer'
        });

        console.log(`📦 Received ${response.data.length} bytes, Content-Type: ${response.headers['content-type']}`);

        return Buffer.from(response.data);
    }
}

export const modelDerivativeService = new APSModelDerivativeService();
