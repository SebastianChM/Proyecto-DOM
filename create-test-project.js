const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Creating test project with complete data...')

    // 1. Find or create user
    let user = await prisma.user.findFirst()
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: 'sebastian@dom.com',
                name: 'Sebastian C.',
                apsUserId: 'test-user-123'
            }
        })
        console.log('✅ User created:', user.email)
    } else {
        console.log('✅ Using existing user:', user.email)
    }

    // 2. Create test project
    const project = await prisma.project.create({
        data: {
            name: 'Demo Project - Full Features',
            description: 'Complete test project with all features enabled. Use this to test Viewer, BOM, Conversions, and all other functionalities.',
            userId: user.id
        }
    })
    console.log('✅ Project created:', project.name)

    // 3. Create test files with different states
    const files = [
        {
            name: 'sample-architecture.rvt',
            originalName: 'sample-architecture.rvt',
            size: 15728640, // 15 MB
            type: 'RVT',
            status: 'READY',
            s3Key: 'projects/' + project.id + '/sample-architecture.rvt',
            apsUrn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvc2FtcGxlLWFyY2hpdGVjdHVyZS5ydnQ',
            projectId: project.id,
            userId: user.id
        },
        {
            name: 'floor-plan.dwg',
            originalName: 'floor-plan.dwg',
            size: 5242880, // 5 MB
            type: 'DWG',
            status: 'READY',
            s3Key: 'projects/' + project.id + '/floor-plan.dwg',
            apsUrn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvZmxvb3ItcGxhbi5kd2c',
            projectId: project.id,
            userId: user.id
        },
        {
            name: 'structural-model.rvt',
            originalName: 'structural-model.rvt',
            size: 20971520, // 20 MB
            type: 'RVT',
            status: 'TRANSLATING',
            s3Key: 'projects/' + project.id + '/structural-model.rvt',
            apsUrn: null,
            projectId: project.id,
            userId: user.id
        },
        {
            name: 'mep-systems.rvt',
            originalName: 'mep-systems.rvt',
            size: 18874368, // 18 MB
            type: 'RVT',
            status: 'UPLOADED',
            s3Key: 'projects/' + project.id + '/mep-systems.rvt',
            apsUrn: null,
            projectId: project.id,
            userId: user.id
        }
    ]

    for (const fileData of files) {
        const file = await prisma.file.create({
            data: fileData
        })
        console.log(`✅ File created: ${file.name} (${file.status})`)
    }

    console.log('\n🎉 Test project created successfully!')
    console.log('\n📋 Project Details:')
    console.log(`   ID: ${project.id}`)
    console.log(`   Name: ${project.name}`)
    console.log(`   Files: ${files.length}`)
    console.log('\n📁 Files created:')
    console.log('   1. sample-architecture.rvt (READY) - Use for Viewer & BOM')
    console.log('   2. floor-plan.dwg (READY) - Use for Viewer & Conversions')
    console.log('   3. structural-model.rvt (TRANSLATING) - Simulates processing')
    console.log('   4. mep-systems.rvt (UPLOADED) - Simulates pending translation')
    console.log('\n🔗 Access at: http://localhost:3000/dashboard/projects/' + project.id)
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
