
import { APSComparisonService } from '../../../src/services/aps/comparison.service';

// Mock dependencies
jest.mock('forge-apis');
jest.mock('../../../src/services/aps/auth.service', () => ({
    apsAuthService: {
        getInternalToken: jest.fn().mockResolvedValue('mock-token')
    }
}));

describe('APSComparisonService', () => {
    let service: APSComparisonService;

    beforeEach(() => {
        service = new APSComparisonService();
    });

    describe('compareMetadata (Local/Demo Mode)', () => {
        it('should return mock difference when URNs start with local-', async () => {
            const urn1 = 'local-v1';
            const urn2 = 'local-v2';

            const result = await service.compareMetadata(urn1, urn2);

            expect(result).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.summary.added).toBeGreaterThan(0);
            expect(result.summary.removed).toBeGreaterThan(0);
            expect(result.summary.modified).toBeGreaterThan(0);

            // Check specific mock data integrity
            expect(result.details.modified[0].changes).toBeDefined();
            expect(result.details.modified[0].name).toContain('Wall');
        });
    });

    // TODO: Add complex tests mocking the private computeDiff by exposing it or making it public for testing, 
    // or by mocking the internal getMetadata/getProperties calls to return specific JSON structures.
});
