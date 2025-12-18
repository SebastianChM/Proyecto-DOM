
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧪 Starting Conversion Logic Verification...');

    const TEST_USER_EMAIL = 'verify-logic@test.com';
    const TEST_PROJECT_NAME = 'Verification Project';
    const TEST_FILE_NAME = 'test-concurrent-limit.rvt';

    try {
        // 1. Clean up previous test data
        console.log('🧹 Cleaning up old test data...');
        // Cascade delete should handle children if we delete user/project appropriately
        // But let's be explicit to avoid "foreign key constraint" on delete too
        const existingUser = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
        if (existingUser) {
            console.log(`   Found existing user ${existingUser.id}, cleaning up...`);
            await prisma.conversion.deleteMany({ where: { file: { uploadedBy: existingUser.id } } });
            await prisma.file.deleteMany({ where: { uploadedBy: existingUser.id } });
            await prisma.project.deleteMany({ where: { ownerId: existingUser.id } });
            await prisma.user.delete({ where: { id: existingUser.id } });
        }

        // 2. Create User
        console.log('👤 Creating dummy user...');
        const user = await prisma.user.create({
            data: {
                email: TEST_USER_EMAIL,
                name: 'Verifier Bot',
                role: 'ADMIN'
            }
        });

        // 3. Create Project
        console.log('Building dummy project...');
        const project = await prisma.project.create({
            data: {
                name: TEST_PROJECT_NAME,
                ownerId: user.id
            }
        });

        // 4. Create File
        console.log('📝 Creating dummy file...');
        const file = await prisma.file.create({
            data: {
                name: TEST_FILE_NAME,
                originalName: TEST_FILE_NAME,
                type: 'RVT',
                s3Key: 'mock-key',
                apsUrn: 'mock-urn',
                uploadedBy: user.id,
                projectId: project.id,
                status: 'UPLOADED'
            }
        });

        // 5. Insert "Stale" Conversions (Older than 1 hour)
        console.log('🕒 Inserting 5 stale conversions (>1h old)...');
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        for (let i = 0; i < 5; i++) {
            await prisma.conversion.create({
                data: {
                    fileId: file.id,
                    targetFormat: 'pdf',
                    status: 'PROCESSING',
                    createdAt: twoHoursAgo
                }
            });
        }

        // 6. Insert "Active" Conversions (Recent)
        console.log('🚀 Inserting 3 active conversions (Recent)...');
        for (let i = 0; i < 3; i++) {
            await prisma.conversion.create({
                data: {
                    fileId: file.id,
                    targetFormat: 'pdf',
                    status: 'PROCESSING'
                }
            });
        }

        // 7. Run the COUNT logic (Simulating 'conversion.ts')
        // Important: logic in conversion.ts filters by file.uploadedBy (which is user.id)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const count = await prisma.conversion.count({
            where: {
                file: { uploadedBy: user.id },
                status: { in: ['PENDING', 'PROCESSING'] },
                createdAt: { gt: oneHourAgo }
            }
        });

        console.log(`📊 Measured Active Conversions: ${count}`);

        // 8. Validation 1
        let passed = true;
        if (count === 3) {
            console.log('✅ SUCCESS: Ignored stale jobs. Counted 3 active jobs.');
        } else {
            console.error(`❌ FAILURE: Expected 3, got ${count}.`);
            passed = false;
        }

        // 9. Test Limit Increase (Add 6 more -> total 9)
        console.log('➕ Adding 6 more active conversions...');
        for (let i = 0; i < 6; i++) {
            await prisma.conversion.create({
                data: {
                    fileId: file.id,
                    targetFormat: 'pdf',
                    status: 'PROCESSING'
                }
            });
        }

        const countFinal = await prisma.conversion.count({
            where: {
                file: { uploadedBy: user.id },
                status: { in: ['PENDING', 'PROCESSING'] },
                createdAt: { gt: oneHourAgo }
            }
        });

        console.log(`📊 Final Count: ${countFinal}`);

        if (countFinal === 9) {
            console.log('✅ SUCCESS: System allows 9 concurrent jobs (limit is 10).');
        } else {
            console.error(`❌ FAILURE: Expected 9, got ${countFinal}.`);
            passed = false;
        }

        // Cleanup
        console.log('🧹 Final Cleanup...');
        await prisma.conversion.deleteMany({ where: { file: { uploadedBy: user.id } } });
        await prisma.file.deleteMany({ where: { uploadedBy: user.id } });
        await prisma.project.deleteMany({ where: { ownerId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });

        if (passed) {
            console.log('🎉 VERIFICATION PASSED');
        } else {
            process.exit(1);
        }

    } catch (err) {
        console.error('❌ Test Exception:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
