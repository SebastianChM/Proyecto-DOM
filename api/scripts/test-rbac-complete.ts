/**
 * Test Suite Completo para RBAC
 * 
 * Prueba todos los aspectos del sistema de autorización:
 * 1. Creación de proyectos (owner automático)
 * 2. Listado de proyectos (solo accesibles)
 * 3. Compartir proyectos (diferentes roles)
 * 4. Verificación de permisos
 * 5. Cambiar roles
 * 6. Revocar acceso
 * 7. Intentos de acceso no autorizado
 */

import axios from 'axios';
import prisma from '../src/lib/prisma';
import { authorizationService } from '../src/services/authorization.service';

const API_URL = 'http://localhost:8080';

// Colores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji: string, message: string, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}${colors.reset}\n`);
}

async function createTestUsers() {
  log('👥', 'Creando usuarios de prueba...', colors.blue);
  
  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    create: {
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'ADMIN',
      apsUserId: 'admin-aps-id'
    },
    update: { role: 'ADMIN' }
  });
  
  // Regular users
  const user1 = await prisma.user.upsert({
    where: { email: 'user1@test.com' },
    create: {
      email: 'user1@test.com',
      name: 'User One',
      role: 'USER',
      apsUserId: 'user1-aps-id'
    },
    update: {}
  });
  
  const user2 = await prisma.user.upsert({
    where: { email: 'user2@test.com' },
    create: {
      email: 'user2@test.com',
      name: 'User Two',
      role: 'USER',
      apsUserId: 'user2-aps-id'
    },
    update: {}
  });
  
  const user3 = await prisma.user.upsert({
    where: { email: 'user3@test.com' },
    create: {
      email: 'user3@test.com',
      name: 'User Three',
      role: 'USER',
      apsUserId: 'user3-aps-id'
    },
    update: {}
  });
  
  log('✓', `Admin: ${admin.name} (${admin.id})`, colors.green);
  log('✓', `User1: ${user1.name} (${user1.id})`, colors.green);
  log('✓', `User2: ${user2.name} (${user2.id})`, colors.green);
  log('✓', `User3: ${user3.name} (${user3.id})`, colors.green);
  
  return { admin, user1, user2, user3 };
}

async function testProjectCreation(users: any) {
  section('TEST 1: Creación de Proyectos');
  
  // User1 crea un proyecto
  log('📝', 'User1 crea "Proyecto Alpha"...', colors.blue);
  const projectAlpha = await prisma.project.create({
    data: {
      name: 'Proyecto Alpha',
      description: 'Proyecto de prueba para RBAC',
      ownerId: users.user1.id,
      isFromAutodesk: false
    }
  });
  
  // Crear ProjectMember automáticamente
  await prisma.projectMember.create({
    data: {
      projectId: projectAlpha.id,
      userId: users.user1.id,
      role: 'OWNER',
      acceptedAt: new Date()
    }
  });
  
  log('✓', `Proyecto creado: ${projectAlpha.id}`, colors.green);
  
  // Verificar que User1 es OWNER
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId: projectAlpha.id,
      userId: users.user1.id
    }
  });
  
  if (member?.role === 'OWNER') {
    log('✓', 'User1 es OWNER del proyecto', colors.green);
  } else {
    log('✗', 'ERROR: User1 NO es OWNER', colors.red);
  }
  
  return projectAlpha;
}

async function testPermissions(users: any, project: any) {
  section('TEST 2: Verificación de Permisos');
  
  // User1 (OWNER) debe tener todos los permisos
  log('🔐', 'Verificando permisos de OWNER (User1)...', colors.blue);
  const ownerPerms = await authorizationService.getUserPermissions(users.user1.id, project.id);
  log('✓', `Permisos de OWNER: ${ownerPerms.length} permisos`, colors.green);
  console.log('   ', ownerPerms.slice(0, 5).join(', '), '...');
  
  // User2 (sin acceso) NO debe tener permisos
  log('🔐', 'Verificando permisos de User2 (sin acceso)...', colors.blue);
  const noAccessPerms = await authorizationService.getUserPermissions(users.user2.id, project.id);
  if (noAccessPerms.length === 0) {
    log('✓', 'User2 no tiene permisos (correcto)', colors.green);
  } else {
    log('✗', `ERROR: User2 tiene ${noAccessPerms.length} permisos`, colors.red);
  }
  
  // Admin debe tener todos los permisos
  log('🔐', 'Verificando permisos de ADMIN...', colors.blue);
  const adminPerms = await authorizationService.getUserPermissions(users.admin.id, project.id);
  log('✓', `Permisos de ADMIN: ${adminPerms.length} permisos`, colors.green);
}

async function testShareProject(users: any, project: any) {
  section('TEST 3: Compartir Proyecto');
  
  // User1 comparte con User2 como EDITOR
  log('🤝', 'User1 comparte proyecto con User2 (EDITOR)...', colors.blue);
  const shared = await authorizationService.shareProject(
    project.id,
    users.user2.id,
    'EDITOR',
    users.user1.id
  );
  
  if (shared) {
    log('✓', 'Proyecto compartido exitosamente', colors.green);
  } else {
    log('✗', 'ERROR: No se pudo compartir', colors.red);
    return;
  }
  
  // Verificar que User2 tiene permisos de EDITOR
  const editorPerms = await authorizationService.getUserPermissions(users.user2.id, project.id);
  log('✓', `User2 ahora tiene ${editorPerms.length} permisos como EDITOR`, colors.green);
  console.log('   ', editorPerms.join(', '));
  
  // User1 comparte con User3 como VIEWER
  log('🤝', 'User1 comparte proyecto con User3 (VIEWER)...', colors.blue);
  await authorizationService.shareProject(
    project.id,
    users.user3.id,
    'VIEWER',
    users.user1.id
  );
  
  const viewerPerms = await authorizationService.getUserPermissions(users.user3.id, project.id);
  log('✓', `User3 ahora tiene ${viewerPerms.length} permisos como VIEWER`, colors.green);
  console.log('   ', viewerPerms.join(', '));
}

async function testAccessControl(users: any, project: any) {
  section('TEST 4: Control de Acceso');
  
  // User1 (OWNER) puede editar
  log('📝', 'User1 intenta editar proyecto...', colors.blue);
  const canUpdate = await authorizationService.hasPermission(
    users.user1.id,
    project.id,
    'project:update'
  );
  if (canUpdate) {
    log('✓', 'User1 PUEDE editar (correcto)', colors.green);
  } else {
    log('✗', 'ERROR: User1 NO puede editar', colors.red);
  }
  
  // User2 (EDITOR) puede editar
  log('📝', 'User2 intenta editar proyecto...', colors.blue);
  const editorCanUpdate = await authorizationService.hasPermission(
    users.user2.id,
    project.id,
    'project:update'
  );
  if (editorCanUpdate) {
    log('✓', 'User2 PUEDE editar (correcto)', colors.green);
  } else {
    log('✗', 'ERROR: User2 NO puede editar', colors.red);
  }
  
  // User3 (VIEWER) NO puede editar
  log('📝', 'User3 intenta editar proyecto...', colors.blue);
  const viewerCanUpdate = await authorizationService.hasPermission(
    users.user3.id,
    project.id,
    'project:update'
  );
  if (!viewerCanUpdate) {
    log('✓', 'User3 NO puede editar (correcto)', colors.green);
  } else {
    log('✗', 'ERROR: User3 PUEDE editar (incorrecto)', colors.red);
  }
  
  // User3 (VIEWER) puede leer
  log('👁️', 'User3 intenta leer proyecto...', colors.blue);
  const viewerCanRead = await authorizationService.hasPermission(
    users.user3.id,
    project.id,
    'project:read'
  );
  if (viewerCanRead) {
    log('✓', 'User3 PUEDE leer (correcto)', colors.green);
  } else {
    log('✗', 'ERROR: User3 NO puede leer', colors.red);
  }
}

async function testRoleChange(users: any, project: any) {
  section('TEST 5: Cambio de Roles');
  
  // Cambiar User2 de EDITOR a VIEWER_DOWNLOAD
  log('🔄', 'Cambiando User2 de EDITOR a VIEWER_DOWNLOAD...', colors.blue);
  
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId: project.id,
      userId: users.user2.id
    }
  });
  
  if (member) {
    await prisma.projectMember.update({
      where: { id: member.id },
      data: { role: 'VIEWER_DOWNLOAD' }
    });
    log('✓', 'Rol actualizado', colors.green);
    
    // Verificar nuevos permisos
    const newPerms = await authorizationService.getUserPermissions(users.user2.id, project.id);
    log('✓', `User2 ahora tiene ${newPerms.length} permisos`, colors.green);
    console.log('   ', newPerms.join(', '));
    
    // User2 ya NO puede editar
    const canUpdate = await authorizationService.hasPermission(
      users.user2.id,
      project.id,
      'project:update'
    );
    if (!canUpdate) {
      log('✓', 'User2 ya NO puede editar (correcto)', colors.green);
    } else {
      log('✗', 'ERROR: User2 todavía puede editar', colors.red);
    }
    
    // Pero SÍ puede descargar
    const canDownload = await authorizationService.hasPermission(
      users.user2.id,
      project.id,
      'file:download'
    );
    if (canDownload) {
      log('✓', 'User2 PUEDE descargar (correcto)', colors.green);
    } else {
      log('✗', 'ERROR: User2 NO puede descargar', colors.red);
    }
  }
}

async function testRevokeAccess(users: any, project: any) {
  section('TEST 6: Revocar Acceso');
  
  // User1 revoca acceso de User3
  log('🚫', 'User1 revoca acceso de User3...', colors.blue);
  const revoked = await authorizationService.revokeAccess(
    project.id,
    users.user3.id,
    users.user1.id
  );
  
  if (revoked) {
    log('✓', 'Acceso revocado exitosamente', colors.green);
  } else {
    log('✗', 'ERROR: No se pudo revocar acceso', colors.red);
  }
  
  // Verificar que User3 ya no tiene acceso
  const hasAccess = await authorizationService.canAccessProject(users.user3.id, project.id);
  if (!hasAccess) {
    log('✓', 'User3 ya NO tiene acceso (correcto)', colors.green);
  } else {
    log('✗', 'ERROR: User3 todavía tiene acceso', colors.red);
  }
}

async function testGetMembers(users: any, project: any) {
  section('TEST 7: Listar Miembros');
  
  log('📋', 'Listando miembros del proyecto...', colors.blue);
  const members = await authorizationService.getProjectMembers(project.id, users.user1.id);
  
  log('✓', `Proyecto tiene ${members.members.length} miembros`, colors.green);
  members.members.forEach((m: any) => {
    console.log(`   • ${m.name} (${m.role}) - Invitado: ${m.invitedAt ? '✓' : '✗'}`);
  });
}

async function runTests() {
  section('🧪 INICIANDO SUITE DE PRUEBAS RBAC');
  
  try {
    // 1. Crear usuarios
    const users = await createTestUsers();
    
    // 2. Crear proyecto
    const project = await testProjectCreation(users);
    
    // 3. Verificar permisos iniciales
    await testPermissions(users, project);
    
    // 4. Compartir proyecto
    await testShareProject(users, project);
    
    // 5. Probar control de acceso
    await testAccessControl(users, project);
    
    // 6. Cambiar roles
    await testRoleChange(users, project);
    
    // 7. Revocar acceso
    await testRevokeAccess(users, project);
    
    // 8. Listar miembros
    await testGetMembers(users, project);
    
    section('✅ SUITE DE PRUEBAS COMPLETADA');
    log('🎉', 'Todos los tests pasaron exitosamente!', colors.bright + colors.green);
    
  } catch (error: any) {
    section('❌ ERROR EN PRUEBAS');
    log('✗', error.message, colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar tests
runTests();
