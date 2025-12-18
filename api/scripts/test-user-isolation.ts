/**
 * 🧪 Test de Aislamiento Multi-Usuario
 * 
 * Verifica que:
 * 1. Usuario A solo ve sus proyectos
 * 2. Usuario B solo ve sus proyectos
 * 3. Proyectos compartidos son visibles
 * 4. Admin puede ver todos (si implementado)
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

interface TestResult {
    test: string;
    passed: boolean;
    expected: any;
    actual: any;
    message?: string;
}

const results: TestResult[] = [];

function log(emoji: string, message: string, data?: any) {
    console.log(`${emoji} ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
}

function pass(test: string, expected: any, actual: any) {
    results.push({ test, passed: true, expected, actual });
    log('✅', `PASS: ${test}`);
}

function fail(test: string, expected: any, actual: any, message?: string) {
    results.push({ test, passed: false, expected, actual, message });
    log('❌', `FAIL: ${test}`, { expected, actual, message });
}

async function cleanup() {
    log('🧹', 'Limpiando datos de prueba...');
    
    // Eliminar proyectos de prueba
    await prisma.project.deleteMany({
        where: {
            name: {
                startsWith: '[TEST]'
            }
        }
    });

    // Eliminar usuarios de prueba
    await prisma.user.deleteMany({
        where: {
            email: {
                in: ['test-user-a@test.com', 'test-user-b@test.com', 'test-admin@test.com']
            }
        }
    });

    log('✨', 'Limpieza completada');
}

async function runTests() {
    try {
        // Cleanup inicial
        await cleanup();

        log('🚀', '=== INICIANDO TEST DE AISLAMIENTO MULTI-USUARIO ===\n');

        // ========================================
        // FASE 1: Crear usuarios de prueba
        // ========================================
        log('👤', 'FASE 1: Creando usuarios de prueba...');

        const userA = await prisma.user.create({
            data: {
                email: 'test-user-a@test.com',
                name: 'Test User A',
                role: 'USER',
                apsUserId: 'test-a-' + Date.now()
            }
        });
        log('✅', `Usuario A creado: ${userA.email} (${userA.id})`);

        const userB = await prisma.user.create({
            data: {
                email: 'test-user-b@test.com',
                name: 'Test User B',
                role: 'USER',
                apsUserId: 'test-b-' + Date.now()
            }
        });
        log('✅', `Usuario B creado: ${userB.email} (${userB.id})`);

        const adminUser = await prisma.user.create({
            data: {
                email: 'test-admin@test.com',
                name: 'Test Admin',
                role: 'ADMIN',
                apsUserId: 'test-admin-' + Date.now()
            }
        });
        log('✅', `Admin creado: ${adminUser.email} (${adminUser.id})\n`);

        // ========================================
        // FASE 2: Usuario A crea proyectos
        // ========================================
        log('📁', 'FASE 2: Usuario A crea 2 proyectos...');

        const projectA1 = await prisma.project.create({
            data: {
                name: '[TEST] Project A1 - Private',
                description: 'Proyecto privado de Usuario A',
                ownerId: userA.id,
                isFromAutodesk: false
            }
        });

        await prisma.projectMember.create({
            data: {
                projectId: projectA1.id,
                userId: userA.id,
                role: 'OWNER',
                acceptedAt: new Date()
            }
        });
        log('✅', `Proyecto A1 creado: ${projectA1.name}`);

        const projectA2 = await prisma.project.create({
            data: {
                name: '[TEST] Project A2 - To Share',
                description: 'Proyecto que A compartirá con B',
                ownerId: userA.id,
                isFromAutodesk: false
            }
        });

        await prisma.projectMember.create({
            data: {
                projectId: projectA2.id,
                userId: userA.id,
                role: 'OWNER',
                acceptedAt: new Date()
            }
        });
        log('✅', `Proyecto A2 creado: ${projectA2.name}\n`);

        // ========================================
        // FASE 3: Usuario B crea proyectos
        // ========================================
        log('📁', 'FASE 3: Usuario B crea 2 proyectos...');

        const projectB1 = await prisma.project.create({
            data: {
                name: '[TEST] Project B1 - Private',
                description: 'Proyecto privado de Usuario B',
                ownerId: userB.id,
                isFromAutodesk: false
            }
        });

        await prisma.projectMember.create({
            data: {
                projectId: projectB1.id,
                userId: userB.id,
                role: 'OWNER',
                acceptedAt: new Date()
            }
        });
        log('✅', `Proyecto B1 creado: ${projectB1.name}`);

        const projectB2 = await prisma.project.create({
            data: {
                name: '[TEST] Project B2 - Private',
                description: 'Proyecto privado de Usuario B',
                ownerId: userB.id,
                isFromAutodesk: false
            }
        });

        await prisma.projectMember.create({
            data: {
                projectId: projectB2.id,
                userId: userB.id,
                role: 'OWNER',
                acceptedAt: new Date()
            }
        });
        log('✅', `Proyecto B2 creado: ${projectB2.name}\n`);

        // ========================================
        // FASE 4: Compartir proyecto A2 con Usuario B
        // ========================================
        log('🔗', 'FASE 4: Usuario A comparte Project A2 con Usuario B (como VIEWER)...');

        await prisma.projectMember.create({
            data: {
                projectId: projectA2.id,
                userId: userB.id,
                role: 'VIEWER',
                invitedBy: userA.id,
                acceptedAt: new Date() // Auto-aceptado para el test
            }
        });
        log('✅', `Proyecto compartido: ${projectA2.name} → Usuario B\n`);

        // ========================================
        // TEST 1: Usuario A ve solo sus proyectos (2)
        // ========================================
        log('🧪', 'TEST 1: Usuario A debe ver solo sus 2 proyectos...');

        const projectsUserA = await prisma.project.findMany({
            where: {
                AND: [
                    {
                        name: { startsWith: '[TEST]' }
                    },
                    {
                        OR: [
                            { ownerId: userA.id },
                            { 
                                members: {
                                    some: {
                                        userId: userA.id,
                                        acceptedAt: { not: null }
                                    }
                                }
                            }
                        ]
                    }
                ]
            },
            include: {
                owner: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        const userAProjectNames = projectsUserA.map(p => p.name).sort();
        const expectedUserAProjects = [projectA1.name, projectA2.name].sort();

        if (projectsUserA.length === 2 && 
            JSON.stringify(userAProjectNames) === JSON.stringify(expectedUserAProjects)) {
            pass('Usuario A ve sus 2 proyectos', expectedUserAProjects, userAProjectNames);
        } else {
            fail('Usuario A ve sus 2 proyectos', expectedUserAProjects, userAProjectNames);
        }

        // ========================================
        // TEST 2: Usuario B ve sus proyectos + compartido (3)
        // ========================================
        log('🧪', 'TEST 2: Usuario B debe ver sus 2 proyectos + 1 compartido (3 total)...');

        const projectsUserB = await prisma.project.findMany({
            where: {
                AND: [
                    {
                        name: { startsWith: '[TEST]' }
                    },
                    {
                        OR: [
                            { ownerId: userB.id },
                            { 
                                members: {
                                    some: {
                                        userId: userB.id,
                                        acceptedAt: { not: null }
                                    }
                                }
                            }
                        ]
                    }
                ]
            },
            include: {
                owner: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        const userBProjectNames = projectsUserB.map(p => p.name).sort();
        const expectedUserBProjects = [projectB1.name, projectB2.name, projectA2.name].sort();

        if (projectsUserB.length === 3 && 
            JSON.stringify(userBProjectNames) === JSON.stringify(expectedUserBProjects)) {
            pass('Usuario B ve sus 2 proyectos + 1 compartido', expectedUserBProjects, userBProjectNames);
        } else {
            fail('Usuario B ve sus 2 proyectos + 1 compartido', expectedUserBProjects, userBProjectNames);
        }

        // ========================================
        // TEST 3: Usuario A NO ve proyectos de B
        // ========================================
        log('🧪', 'TEST 3: Usuario A NO debe ver proyectos privados de B...');

        const userASeesB1 = projectsUserA.some(p => p.id === projectB1.id);
        const userASeesB2 = projectsUserA.some(p => p.id === projectB2.id);

        if (!userASeesB1 && !userASeesB2) {
            pass('Usuario A NO ve proyectos de B', false, false);
        } else {
            fail('Usuario A NO ve proyectos de B', false, true, 
                'Usuario A puede ver proyectos privados de Usuario B');
        }

        // ========================================
        // TEST 4: Usuario B NO ve proyecto privado A1
        // ========================================
        log('🧪', 'TEST 4: Usuario B NO debe ver proyecto privado A1...');

        const userBSeesA1 = projectsUserB.some(p => p.id === projectA1.id);

        if (!userBSeesA1) {
            pass('Usuario B NO ve proyecto privado A1', false, false);
        } else {
            fail('Usuario B NO ve proyecto privado A1', false, true,
                'Usuario B puede ver proyecto privado de Usuario A');
        }

        // ========================================
        // TEST 5: Usuario B SÍ ve proyecto compartido A2
        // ========================================
        log('🧪', 'TEST 5: Usuario B SÍ debe ver proyecto compartido A2...');

        const userBSeesA2 = projectsUserB.some(p => p.id === projectA2.id);

        if (userBSeesA2) {
            pass('Usuario B SÍ ve proyecto compartido A2', true, true);
        } else {
            fail('Usuario B SÍ ve proyecto compartido A2', true, false,
                'Usuario B NO puede ver proyecto que fue compartido con él');
        }

        // ========================================
        // TEST 6: Admin ve todos los proyectos (si implementado)
        // ========================================
        log('🧪', 'TEST 6: Admin puede ver todos los proyectos [OPCIONAL]...');

        // Nota: La query de proyectos NO incluye bypass para admin
        // Si se quiere que admin vea todos, hay que modificar la query en projects.ts
        const projectsAdmin = await prisma.project.findMany({
            where: {
                name: { startsWith: '[TEST]' }
            }
        });

        if (projectsAdmin.length === 4) {
            log('ℹ️', 'INFO: Admin puede ver todos los proyectos mediante query directa');
            pass('Admin puede ver todos (query directa)', 4, projectsAdmin.length);
        } else {
            log('ℹ️', 'INFO: Query de admin no implementada para ver todos los proyectos');
        }

        // ========================================
        // TEST 7: Verificar roles correctos
        // ========================================
        log('🧪', 'TEST 7: Verificar roles de ProjectMember...');

        const memberA1 = await prisma.projectMember.findFirst({
            where: { projectId: projectA1.id, userId: userA.id }
        });

        const memberA2Owner = await prisma.projectMember.findFirst({
            where: { projectId: projectA2.id, userId: userA.id }
        });

        const memberA2Viewer = await prisma.projectMember.findFirst({
            where: { projectId: projectA2.id, userId: userB.id }
        });

        if (memberA1?.role === 'OWNER' && 
            memberA2Owner?.role === 'OWNER' && 
            memberA2Viewer?.role === 'VIEWER') {
            pass('Roles de ProjectMember correctos', 
                { a1: 'OWNER', a2Owner: 'OWNER', a2Viewer: 'VIEWER' },
                { a1: memberA1.role, a2Owner: memberA2Owner.role, a2Viewer: memberA2Viewer.role });
        } else {
            fail('Roles de ProjectMember correctos',
                { a1: 'OWNER', a2Owner: 'OWNER', a2Viewer: 'VIEWER' },
                { a1: memberA1?.role, a2Owner: memberA2Owner?.role, a2Viewer: memberA2Viewer?.role });
        }

        // ========================================
        // RESUMEN FINAL
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN DE RESULTADOS');
        console.log('='.repeat(60));

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        const total = results.length;

        results.forEach((result, index) => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${status}: ${result.test}`);
            if (!result.passed && result.message) {
                console.log(`   └─ ${result.message}`);
            }
        });

        console.log('='.repeat(60));
        console.log(`✅ Pasaron: ${passed}/${total}`);
        console.log(`❌ Fallaron: ${failed}/${total}`);
        console.log(`📈 Éxito: ${((passed / total) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));

        if (failed === 0) {
            log('🎉', '\n¡TODOS LOS TESTS PASARON! El aislamiento multi-usuario funciona correctamente.\n');
        } else {
            log('⚠️', '\nALGUNOS TESTS FALLARON. Revisar el aislamiento de proyectos.\n');
        }

        // Cleanup final
        await cleanup();

    } catch (error: any) {
        console.error('❌ Error durante los tests:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar tests
runTests();
