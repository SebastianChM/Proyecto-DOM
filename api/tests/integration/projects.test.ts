
import request from 'supertest';
import app from '../../src/index';
import { redis } from '../../src/lib/redis';
import prisma from '../../src/lib/prisma';

describe('Project Routes', () => {
    afterAll(async () => {
        await redis.quit();
        await prisma.$disconnect();
    });

    describe('GET /api/projects', () => {
        it('should return 401 if not authenticated', async () => {
            // Since we are not mocking auth middleware yet, and it uses basicAuth/session
            // Expect 401 or 403
            const res = await request(app).get('/api/projects');
            expect(res.status).toBe(401);
        });
    });
});
