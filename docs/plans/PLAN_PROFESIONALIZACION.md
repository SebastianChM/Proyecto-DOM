# Plan de Profesionalización - DOM BIM Platform
## Roadmap por Hitos para Producción

---

## 📋 RESUMEN EJECUTIVO

**Objetivo:** Transformar la aplicación de prototipo a sistema enterprise-ready con seguridad, validaciones robustas y UX profesional.

**Duración Estimada:** 6-8 semanas
**Prioridad:** Seguridad → Validaciones → Sincronización → UX

---

## 🎯 HITO 1: SEGURIDAD Y CONTROL DE ACCESO (Semana 1-2)
**Prioridad: CRÍTICA** 🔴

### Problema Identificado
> "Otro compañero entró con su cuenta y podía ver mis proyectos"
> "El jefe de proyecto debe tener acceso sin límites, otros roles deben tener permisos limitados"

### Objetivos
- ✅ Aislamiento de datos por usuario
- ✅ Sistema RBAC (Role-Based Access Control) profesional
- ✅ Roles personalizables por organización
- ✅ Jerarquía de permisos escalable
- ✅ Compartir proyectos con niveles de acceso

### Arquitectura: Sistema RBAC Multinivel

#### Nivel 1: Roles Organizacionales (System-wide)
- **SUPER_ADMIN**: Control total del sistema
- **ORG_ADMIN**: Administrador de organización
- **PROJECT_MANAGER**: Jefe de proyecto
- **ENGINEER**: Ingeniero con acceso limitado
- **VIEWER**: Solo lectura
- **GUEST**: Acceso temporal restringido

#### Nivel 2: Roles en Proyecto (Project-specific)
- **OWNER**: Creador del proyecto
- **EDITOR**: Puede modificar
- **CONTRIBUTOR**: Puede subir archivos
- **REVIEWER**: Puede comentar
- **VIEWER_DOWNLOAD**: Ver y descargar
- **VIEWER**: Solo visualización

#### Nivel 3: Permisos Granulares (Permission-based)
Cada rol está compuesto por permisos específicos que se verifican en tiempo real.

### Tareas

#### 1.1 Extender Modelo de Datos (Prisma)
```prisma
// ============================================
// SISTEMA RBAC COMPLETO
// ============================================

// --- ORGANIZACIONES ---
model Organization {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  domain      String?  // email domain for auto-join
  logoUrl     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  members     OrganizationMember[]
  projects    Project[]
  roles       CustomRole[]
  teams       Team[]
}

model OrganizationMember {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           String       // SUPER_ADMIN, ORG_ADMIN, PROJECT_MANAGER, ENGINEER, VIEWER, GUEST
  status         String       @default("ACTIVE") // ACTIVE, SUSPENDED, INVITED
  invitedBy      String?
  invitedAt      DateTime     @default(now())
  joinedAt       DateTime?
  
  @@unique([organizationId, userId])
  @@index([userId])
  @@index([organizationId])
}

// --- ROLES PERSONALIZADOS ---
model CustomRole {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String       // "Senior Engineer", "BIM Coordinator", etc
  description    String?
  color          String?      // Para UI
  permissions    String       // JSON array de permisos
  isSystemRole   Boolean      @default(false)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  members        ProjectMember[]
  
  @@unique([organizationId, name])
  @@index([organizationId])
}

// --- PERMISOS ---
model Permission {
  id          String   @id
  resource    String   // projects, files, users, settings
  action      String   // create, read, update, delete, share, download
  description String
  category    String   // PROJECT, FILE, USER, SYSTEM, VALIDATION, COMPARISON
  
  @@unique([resource, action])
}

// --- EQUIPOS (OPCIONAL) ---
model Team {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  description    String?
  leaderId       String
  createdAt      DateTime     @default(now())
  
  members        TeamMember[]
  projects       Project[]
  
  @@index([organizationId])
}

model TeamMember {
  id        String   @id @default(uuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  userId    String
  role      String   @default("MEMBER") // LEAD, MEMBER
  joinedAt  DateTime @default(now())
  
  @@unique([teamId, userId])
}

// --- MIEMBROS DE PROYECTO (Actualizado) ---
model ProjectMember {
  id          String      @id @default(uuid())
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Rol puede ser system role o custom role
  roleType    String      @default("SYSTEM") // SYSTEM, CUSTOM
  systemRole  String?     // OWNER, EDITOR, CONTRIBUTOR, REVIEWER, VIEWER_DOWNLOAD, VIEWER
  customRoleId String?
  customRole  CustomRole? @relation(fields: [customRoleId], references: [id])
  
  invitedBy   String
  invitedAt   DateTime    @default(now())
  acceptedAt  DateTime?
  status      String      @default("PENDING") // PENDING, ACCEPTED, DECLINED
  
  @@unique([projectId, userId])
  @@index([userId])
  @@index([projectId])
  @@index([customRoleId])
}

model ProjectInvitation {
  id          String   @id @default(uuid())
  projectId   String
  email       String
  role        String
  invitedBy   String
  token       String   @unique
  expiresAt   DateTime
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())
  
  @@index([email])
  @@index([token])
}

model ActivityLog {
  id          String   @id @default(uuid())
  userId      String
  projectId   String?
  fileId      String?
  action      String   // VIEW, DOWNLOAD, EDIT, DELETE, SHARE
  details     String?  // JSON
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  
  @@index([userId])
  @@index([projectId])
  @@index([createdAt])
}
```

#### 1.2 Definición de Permisos (Configuración)
```typescript
// api/src/config/permissions.ts

export enum Resource {
  PROJECT = 'project',
  FILE = 'file',
```typescript
// api/src/middleware/authorization.ts

import { Request, Response, NextFunction } from 'express';
import { Permission, SYSTEM_ROLES, PROJECT_ROLES } from '../config/permissions';
import prisma from '../lib/prisma';

// Extender Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        organizationRole?: string;
        permissions?: Permission[];
      };
      projectMember?: {
        role: string;
        permissions: Permission[];
      };
    }
  }
}

/**
 * Servicio de verificación de permisos
 */
export class AuthorizationService {
  /**
   * Obtiene todos los permisos de un usuario en un proyecto específico
   */
  async getUserProjectPermissions(
    userId: string, 
    projectId: string
  ): Promise<Permission[]> {
    // 1. Obtener rol organizacional del usuario
    const orgMember = await prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true }
    });
    
    const orgPermissions = orgMember?.role 
      ? SYSTEM_ROLES[orgMember.role]?.permissions || []
      : [];
    
    // 2. Obtener rol en el proyecto específico
    const projectMember = await prisma.projectMember.findFirst({
      where: { userId, projectId },
      include: { customRole: true }
    });
    
    let projectPermissions: Permission[] = [];
    
    if (projectMember) {
      if (projectMember.roleType === 'CUSTOM' && projectMember.customRole) {
        // Rol personalizado
        projectPermissions = JSON.parse(projectMember.customRole.permissions);
      } else if (projectMember.systemRole) {
        // Rol de sistema
        projectPermissions = PROJECT_ROLES[projectMember.systemRole]?.permissions || [];
      }
    }
    
    // 3. Combinar permisos (union)
    const allPermissions = new Set([...orgPermissions, ...projectPermissions]);
    
    return Array.from(allPermissions);
  }
  
  /**
   * Verifica si el usuario tiene un permiso específico
   */
  async hasPermission(
    userId: string, 
    projectId: string | null, 
    permission: Permission
  ): Promise<boolean> {
    if (projectId) {
      const permissions = await this.getUserProjectPermissions(userId, projectId);
      return permissions.includes(permission);
    }
    
    // Permiso a nivel organizacional
    const orgMember = await prisma.organizationMember.findFirst({
      where: { userId }
    });
    
    const orgPermissions = orgMember?.role 
      ? SYSTEM_ROLES[orgMember.role]?.permissions || []
      : [];
    
    return orgPermissions.includes(permission);
  }
  
  /**
   * Verifica si el usuario tiene al menos uno de los permisos
   */
  async hasAnyPermission(
    userId: string,
    projectId: string | null,
    permissions: Permission[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, projectId, permission)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Verifica si el usuario tiene todos los permisos
   */
  async hasAllPermissions(
    userId: string,
    projectId: string | null,
    permissions: Permission[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (!await this.hasPermission(userId, projectId, permission)) {
        return false;
      }
    }
    return true;
  }
}

export const authService = new AuthorizationService();

/**
 * Middleware: Requiere permiso específico
 */
export const requirePermission = (permission: Permission, resourceParam: string = 'projectId') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const resourceId = req.params[resourceParam] || req.body[resourceParam] || null;
      const hasPermission = await authService.hasPermission(
        req.user.id,
        resourceId,
        permission
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permiso denegado',
          required: permission,
          message: 'No tienes permisos suficientes para realizar esta acción'
        });
      }
      
      next();
    } catch (error) {
      console.error('Error en verificación de permisos:', error);
      res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
};

/**
 * Middleware: Requiere rol específico
 */
export const requireRole = (roles: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const roleArray = Array.isArray(roles) ? roles : [roles];
      const orgMember = await prisma.organizationMember.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!orgMember || !roleArray.includes(orgMember.role)) {
        return res.status(403).json({ 
          error: 'Permiso denegado',
          required: roleArray,
          current: orgMember?.role
        });
      }
      
      next();
    } catch (error) {
      console.error('Error verificando rol:', error);
      res.status(500).json({ error: 'Error verificando rol' });
    }
  };
};

/**
 * Middleware: Cargar permisos del usuario en el request
 */
export const loadUserPermissions = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const projectId = req.params.projectId || req.params.id;
    
    if (projectId) {
      req.user.permissions = await authService.getUserProjectPermissions(
        req.user.id,
        projectId
      );
    }
    
    next();
  } catch (error) {
    console.error('Error cargando permisos:', error);
    next();
  }
};
```ANAGE_MEMBERS = 'manage_members',
  MANAGE_ROLES = 'manage_roles',
}

export type Permission = `${Resource}:${Action}`;

// Permisos completos del sistema
export const ALL_PERMISSIONS: Permission[] = [
  // Projects
  'project:create',
  'project:read',
  'project:update',
  'project:delete',
  'project:share',
  'project:manage_members',
  
  // Files
  'file:create',      // Upload
  'file:read',        // View
  'file:update',      // Replace version
  'file:delete',
  'file:download',
  'file:convert',
  
  // Conversions
  'conversion:create',
  'conversion:read',
  'conversion:download',
#### 1.4 Endpoints de Gestión de Roles
```typescript
// api/src/routes/roles.ts

// GET /api/roles - Listar roles del sistema
router.get('/', requireRole(['ORG_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const systemRoles = Object.entries(SYSTEM_ROLES).map(([key, value]) => ({
    id: key,
    ...value,
    type: 'SYSTEM'
  }));
  
  const customRoles = await prisma.customRole.findMany({
    where: { organizationId: req.user.organizationId }
  });
  
  res.json({ systemRoles, customRoles });
});

// POST /api/roles/custom - Crear rol personalizado
router.post('/custom', requirePermission('organization:manage_roles'), async (req, res) => {
  const { name, description, permissions, color } = req.body;
  
  // Validar que los permisos existan
  const validPermissions = permissions.filter(p => ALL_PERMISSIONS.includes(p));
  
  const role = await prisma.customRole.create({
    data: {
      organizationId: req.user.organizationId,
      name,
      description,
      permissions: JSON.stringify(validPermissions),
      color
    }
  });
  
  res.json(role);
});

// PUT /api/roles/custom/:id - Actualizar rol personalizado
// DELETE /api/roles/custom/:id - Eliminar rol personalizado
```

#### 1.5 Endpoints de Gestión de Miembros
```typescript
// api/src/routes/projects/:projectId/members.ts

// GET /api/projects/:projectId/members
router.get('/', requirePermission('project:read'), async (req, res) => {
  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.projectId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      customRole: true
    }
  });
  
  res.json(members);
});

// POST /api/projects/:projectId/members/invite
router.post('/invite', requirePermission('project:manage_members'), async (req, res) => {
  const { email, roleType, systemRole, customRoleId } = req.body;
  
  // 1. Buscar usuario por email
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    // Enviar invitación por email
    return res.json({ message: 'Invitación enviada por email' });
  }
  
  // 2. Crear ProjectMember
  const member = await prisma.projectMember.create({
    data: {
      projectId: req.params.projectId,
      userId: user.id,
      roleType,
      systemRole,
      customRoleId,
      invitedBy: req.user.id,
      status: 'PENDING'
    }
  });
  
  // 3. Enviar notificación
  await notifyProjectInvitation(user.id, req.params.projectId);
  
  res.json(member);
});

// PATCH /api/projects/:projectId/members/:memberId/role
router.patch('/:memberId/role', requirePermission('project:manage_members'), async (req, res) => {
  const { roleType, systemRole, customRoleId } = req.body;
  
  const member = await prisma.projectMember.update({
    where: { id: req.params.memberId },
    data: { roleType, systemRole, customRoleId }
  });
  
  res.json(member);
});

// DELETE /api/projects/:projectId/members/:memberId
router.delete('/:memberId', requirePermission('project:manage_members'), async (req, res) => {
  await prisma.projectMember.delete({
    where: { id: req.params.memberId }
  });
  
  res.json({ success: true });
});
```

#### 1.6 Filtrado por Usuario en Queries
```typescript
// api/src/routes/projects.ts (ACTUALIZADO)

// GET /api/projects - Solo proyectos con acceso
router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId: req.user.id }, // Proyectos propios
        { 
          ProjectMember: {
            some: {
              userId: req.user.id,
              status: 'ACCEPTED'
            }
          }
        } // Proyectos compartidos
      ]
    },
    include: {
      _count: { select: { files: true } },
      ProjectMember: {
        where: { userId: req.user.id },
        include: { customRole: true }
      }
    }
  });
  
  // Agregar permisos al response
  const projectsWithPermissions = await Promise.all(
    projects.map(async (project) => {
      const permissions = await authService.getUserProjectPermissions(
        req.user.id,
        project.id
      );
      
      return {
        ...project,
        userPermissions: permissions
      };
    })
  );
  
  res.json(projectsWithPermissions);
});
```

#### 1.7 UI de Gestión de Permisos
```typescript
// frontend/components/project/MemberManagement.tsx

export function MemberManagement({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  
  // UI Components:
  // 1. Modal "Compartir Proyecto"
  //    - Input de email
  //    - Selector de rol (system o custom)
  //    - Preview de permisos del rol
  //    - Botón "Invitar"
  
  // 2. Tabla de miembros actuales
  //    - Avatar, nombre, email
  //    - Dropdown de rol (editable por OWNER)
  //    - Badge de permisos
  //    - Botón eliminar (solo OWNER)
  
  // 3. Indicadores visuales
  //    - Color por rol
  //    - Tooltips con permisos detallados
  //    - Estados: Pending, Active, Suspended
  
  return (
    <div>
      {/* Implementation */}
    </div>
  );
}
```

```typescript
// frontend/components/admin/CustomRoleCreator.tsx

export function CustomRoleCreator() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  
  // UI para crear roles personalizados:
  // 1. Input nombre del rol
  // 2. Textarea descripción
  // 3. Color picker
  // 4. Checklist de permisos por categoría
  //    - Projects (create, read, update, delete, share)
  //    - Files (create, read, update, delete, download, convert)
  //    - Conversions, Comparisons, Validations
  // 5. Preview de permisos seleccionados
  // 6. Botones Guardar / Cancelar
  
  return (
    <Dialog>
      {/* Implementation */}
    </Dialog>
  );
}
```

#### 1.8 Protección de Rutas en Frontend
```typescript
// frontend/hooks/usePermissions.ts

export function usePermissions(projectId?: string) {
  const { user } = useUser();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  
  useEffect(() => {
    if (projectId && user) {
      fetchPermissions(projectId);
    }
  }, [projectId, user]);
  
  const hasPermission = (permission: Permission) => {
    return permissions.includes(permission);
  };
  
  const hasAnyPermission = (perms: Permission[]) => {
    return perms.some(p => permissions.includes(p));
  };
  
  return { permissions, hasPermission, hasAnyPermission };
}

// Uso en componentes:
function FileActions({ file, projectId }) {
  const { hasPermission } = usePermissions(projectId);
  
  return (
    <>
      {hasPermission('file:download') && (
        <Button onClick={handleDownload}>Descargar</Button>
      )}
      {hasPermission('file:delete') && (
        <Button onClick={handleDelete}>Eliminar</Button>
      )}
    </>
  );
}
```

**Entregables:**
- [ ] Base de datos migrada con modelos RBAC completos
- [ ] Sistema de permisos configurado (permissions.ts)
- [ ] Middleware de autorización implementado
- [ ] AuthorizationService con caché de permisos
- [ ] Endpoints de gestión de roles y miembros
- [ ] UI de gestión de roles personalizados
- [ ] UI de compartir proyecto con roles
- [ ] Hook usePermissions en frontend
- [ ] Protección de todas las rutas y acciones
- [ ] Tests de seguridad (unit + integration)
- [ ] Documentación de permisos y roles
  // Organization
  'organization:read',
  'organization:update',
  'organization:manage_members',
  'organization:manage_roles',
  
  // Settings
  'settings:read',
  'settings:update',
];

// Roles del sistema con sus permisos
export const SYSTEM_ROLES = {
  SUPER_ADMIN: {
    name: 'Super Administrador',
    description: 'Control total del sistema',
    permissions: ALL_PERMISSIONS,
    level: 100,
  },
  
  ORG_ADMIN: {
    name: 'Administrador de Organización',
    description: 'Gestiona usuarios y roles de la organización',
    permissions: [
      'project:create', 'project:read', 'project:update', 'project:delete', 
      'project:share', 'project:manage_members',
      'file:create', 'file:read', 'file:update', 'file:delete', 
      'file:download', 'file:convert',
      'conversion:create', 'conversion:read', 'conversion:download',
      'comparison:create', 'comparison:read', 'comparison:download',
      'validation:create', 'validation:read', 'validation:update',
      'user:read', 'user:invite',
      'organization:read', 'organization:update', 'organization:manage_members',
      'organization:manage_roles',
    ] as Permission[],
    level: 90,
  },
  
  PROJECT_MANAGER: {
    name: 'Jefe de Proyecto',
    description: 'Control total sobre sus proyectos',
    permissions: [
      'project:create', 'project:read', 'project:update', 'project:delete',
      'project:share', 'project:manage_members',
      'file:create', 'file:read', 'file:update', 'file:delete',
      'file:download', 'file:convert',
      'conversion:create', 'conversion:read', 'conversion:download',
      'comparison:create', 'comparison:read', 'comparison:download',
      'validation:create', 'validation:read', 'validation:update',
      'user:read', 'user:invite',
    ] as Permission[],
    level: 80,
  },
  
  ENGINEER: {
    name: 'Ingeniero',
    description: 'Puede trabajar con archivos pero no gestionar proyectos',
    permissions: [
      'project:read',
      'file:create', 'file:read', 'file:update', 'file:download', 'file:convert',
      'conversion:create', 'conversion:read', 'conversion:download',
      'comparison:create', 'comparison:read',
      'validation:create', 'validation:read',
      'user:read',
    ] as Permission[],
    level: 50,
  },
  
  VIEWER: {
    name: 'Visualizador',
    description: 'Solo puede ver proyectos y archivos',
    permissions: [
      'project:read',
      'file:read',
      'conversion:read',
      'comparison:read',
      'validation:read',
    ] as Permission[],
    level: 20,
  },
  
  GUEST: {
    name: 'Invitado',
    description: 'Acceso temporal muy limitado',
    permissions: [
      'project:read',
      'file:read',
    ] as Permission[],
    level: 10,
  },
};

// Roles a nivel de proyecto
export const PROJECT_ROLES = {
  OWNER: {
    name: 'Propietario',
    permissions: [
      'project:read', 'project:update', 'project:delete', 'project:share',
      'project:manage_members',
      'file:create', 'file:read', 'file:update', 'file:delete',
      'file:download', 'file:convert',
      'conversion:create', 'conversion:read', 'conversion:download',
      'comparison:create', 'comparison:read', 'comparison:download',
      'validation:create', 'validation:read', 'validation:update',
    ] as Permission[],
  },
  
  EDITOR: {
    name: 'Editor',
    permissions: [
      'project:read', 'project:update',
      'file:create', 'file:read', 'file:update', 'file:delete',
      'file:download', 'file:convert',
      'conversion:create', 'conversion:read', 'conversion:download',
      'comparison:create', 'comparison:read',
      'validation:create', 'validation:read',
    ] as Permission[],
  },
  
  CONTRIBUTOR: {
    name: 'Colaborador',
    permissions: [
      'project:read',
      'file:create', 'file:read', 'file:download', 'file:convert',
      'conversion:create', 'conversion:read',
      'comparison:read',
      'validation:read',
    ] as Permission[],
  },
  
  REVIEWER: {
    name: 'Revisor',
    permissions: [
      'project:read',
      'file:read', 'file:download',
      'conversion:read',
      'comparison:create', 'comparison:read',
      'validation:create', 'validation:read',
    ] as Permission[],
  },
  
  VIEWER_DOWNLOAD: {
    name: 'Visualizador con Descarga',
    permissions: [
      'project:read',
      'file:read', 'file:download',
      'conversion:read', 'conversion:download',
      'comparison:read',
      'validation:read',
    ] as Permission[],
  },
  
  VIEWER: {
    name: 'Visualizador',
    permissions: [
      'project:read',
      'file:read',
      'conversion:read',
      'comparison:read',
      'validation:read',
    ] as Permission[],
  },
};
```

#### 1.3 Middleware de Autorización (API)
```typescript
// api/src/middleware/permissions.ts

export enum Permission {
  PROJECT_VIEW = 'project:view',
  PROJECT_EDIT = 'project:edit',
  PROJECT_DELETE = 'project:delete',
  FILE_VIEW = 'file:view',
  FILE_DOWNLOAD = 'file:download',
  FILE_UPLOAD = 'file:upload',
  FILE_DELETE = 'file:delete',
}

export const checkPermission = (permission: Permission) => {
  return async (req, res, next) => {
    // Verificar si el usuario tiene acceso al proyecto
    // Validar el rol y los permisos específicos
  }
}
```

#### 1.3 Filtrado por Usuario en Queries
- Modificar `/api/projects` para mostrar solo proyectos donde el usuario es owner o member
- Agregar endpoint `/api/projects/shared` para proyectos compartidos
- Implementar `/api/projects/:id/members` para gestionar permisos

#### 1.4 UI de Gestión de Permisos
- Modal de "Compartir Proyecto"
- Tabla de miembros con roles editables
- Indicadores visuales de permisos en la interfaz

**Entregables:**
- [ ] Base de datos migrada con nuevos modelos
- [ ] Middleware de permisos implementado
- [ ] Endpoints de compartir/invitar funcionales
- [ ] UI de gestión de permisos en dashboard
- [ ] Tests de seguridad (unit tests)

---

## 🏗️ ARQUITECTURA RBAC: MEJORES PRÁCTICAS

### Principios de Diseño

#### 1. **Principio de Menor Privilegio**
Cada usuario debe tener solo los permisos mínimos necesarios para su trabajo.

#### 2. **Jerarquía de Permisos**
```
Organization Role (más amplio)
    ↓
Project Role (específico del proyecto)
    ↓
Permission Check (verificación final)
```

El usuario tiene la **UNION** de permisos organizacionales + proyecto.
Ejemplo: Un `PROJECT_MANAGER` organizacional que es `VIEWER` en un proyecto específico 
→ Tendrá permisos de `PROJECT_MANAGER` (más amplios).

#### 3. **Roles vs Permisos**
- **Roles**: Agrupaciones lógicas de permisos (fácil de gestionar)
- **Permisos**: Verificaciones granulares (máxima flexibilidad)

#### 4. **Caché de Permisos**
```typescript
// api/src/lib/permission-cache.ts
import Redis from 'ioredis';

class PermissionCache {
  private redis: Redis;
  private TTL = 300; // 5 minutos
  
  async get(userId: string, projectId: string): Promise<Permission[] | null> {
    const key = `permissions:${userId}:${projectId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(userId: string, projectId: string, permissions: Permission[]) {
    const key = `permissions:${userId}:${projectId}`;
    await this.redis.setex(key, this.TTL, JSON.stringify(permissions));
  }
  
  async invalidate(userId: string, projectId?: string) {
    if (projectId) {
      await this.redis.del(`permissions:${userId}:${projectId}`);
    } else {
      // Invalidar todos los proyectos del usuario
      const keys = await this.redis.keys(`permissions:${userId}:*`);
      if (keys.length) await this.redis.del(...keys);
    }
  }
}

export const permissionCache = new PermissionCache();
```

#### 5. **Auditoría Automática**
Cada cambio de permisos debe quedar registrado:
```typescript
await prisma.activityLog.create({
  data: {
    userId: req.user.id,
    action: 'PERMISSION_CHANGED',
    projectId,
    details: JSON.stringify({
      targetUserId: memberId,
      oldRole: oldRole,
      newRole: newRole,
      timestamp: new Date()
    })
  }
});
```

### Ejemplos de Uso en Producción

#### Escenario 1: Jefe de Proyecto
```typescript
// Usuario: Juan Pérez
// Rol Organizacional: PROJECT_MANAGER
// Rol en Proyecto A: OWNER
// Resultado: Acceso completo al Proyecto A

const permissions = await authService.getUserProjectPermissions('juan-id', 'project-a');
// permissions = [...todos los permisos de PROJECT_MANAGER + OWNER]

// Puede:
// ✅ Ver, editar, eliminar proyectos
// ✅ Invitar miembros
// ✅ Crear validaciones
// ✅ Descargar archivos
// ✅ Todo en el Proyecto A
```

#### Escenario 2: Ingeniero Junior
```typescript
// Usuario: María García  
// Rol Organizacional: ENGINEER
// Rol en Proyecto B: CONTRIBUTOR
// Resultado: Puede trabajar con archivos pero no gestionar proyecto

const permissions = await authService.getUserProjectPermissions('maria-id', 'project-b');
// permissions = ['file:create', 'file:read', 'file:download', 'file:convert', ...]

// Puede:
// ✅ Subir archivos
// ✅ Ver archivos
// ✅ Descargar y convertir
// ❌ NO puede eliminar archivos de otros
// ❌ NO puede invitar miembros
// ❌ NO puede eliminar el proyecto
```

#### Escenario 3: Cliente Externo
```typescript
// Usuario: Cliente ABC
// Rol Organizacional: GUEST
// Rol en Proyecto C: VIEWER
// Resultado: Solo visualización, sin descarga

const permissions = await authService.getUserProjectPermissions('cliente-id', 'project-c');
// permissions = ['project:read', 'file:read', 'conversion:read']

// Puede:
// ✅ Ver lista de archivos
// ✅ Ver modelo 3D en visor
// ❌ NO puede descargar
// ❌ NO puede modificar nada
// ❌ Acceso temporal (expiración configurable)
```

#### Escenario 4: Rol Personalizado "BIM Coordinator"
```typescript
// Crear rol personalizado
await prisma.customRole.create({
  data: {
    organizationId: 'org-123',
    name: 'BIM Coordinator',
    description: 'Coordinador BIM con permisos especiales de validación',
    permissions: JSON.stringify([
      'project:read',
      'file:read', 'file:create', 'file:update', 'file:download',
      'validation:create', 'validation:read', 'validation:update',
      'comparison:create', 'comparison:read',
      'conversion:create', 'conversion:read'
    ]),
    color: '#9333ea' // Purple
  }
});

// Asignar a proyecto
await prisma.projectMember.create({
  data: {
    projectId: 'project-d',
    userId: 'coordinator-id',
    roleType: 'CUSTOM',
    customRoleId: 'bim-coord-role-id'
  }
});

// Resultado: Permisos específicos para coordinación BIM
```

### Migración de Datos Existentes

```typescript
// scripts/migrate-to-rbac.ts

async function migrateExistingProjects() {
  console.log('Iniciando migración a RBAC...');
  
  // 1. Todos los proyectos existentes: el userId se convierte en OWNER
  const projects = await prisma.project.findMany();
  
  for (const project of projects) {
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: project.userId,
        roleType: 'SYSTEM',
        systemRole: 'OWNER',
        invitedBy: project.userId,
        acceptedAt: new Date(),
        status: 'ACCEPTED'
      }
    });
  }
  
  // 2. Crear organización por defecto
  const defaultOrg = await prisma.organization.create({
    data: {
      name: 'DOM',
      slug: 'dom-default'
    }
  });
  
  // 3. Todos los usuarios existentes: PROJECT_MANAGER por defecto
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    await prisma.organizationMember.create({
      data: {
        organizationId: defaultOrg.id,
        userId: user.id,
        role: 'PROJECT_MANAGER', // Rol generoso para no romper funcionalidad
        status: 'ACTIVE',
        joinedAt: new Date()
      }
    });
  }
  
  console.log('Migración completada ✅');
}
```

### Testing de Permisos

```typescript
// __tests__/permissions.test.ts

describe('Sistema RBAC', () => {
  it('PROJECT_MANAGER puede crear proyectos', async () => {
    const hasPermission = await authService.hasPermission(
      'user-pm-id',
      null,
      'project:create'
    );
    expect(hasPermission).toBe(true);
  });
  
  it('VIEWER no puede eliminar archivos', async () => {
    const hasPermission = await authService.hasPermission(
      'user-viewer-id',
      'project-123',
      'file:delete'
    );
    expect(hasPermission).toBe(false);
  });
  
  it('Herencia de permisos funciona correctamente', async () => {
    // ORG_ADMIN en organización + VIEWER en proyecto
    // Resultado: Permisos de ORG_ADMIN (más amplios)
    const permissions = await authService.getUserProjectPermissions(
      'admin-id',
      'project-123'
    );
    expect(permissions).toContain('file:delete');
  });
  
  it('Custom role aplica permisos correctamente', async () => {
    const permissions = await authService.getUserProjectPermissions(
      'custom-role-user-id',
      'project-123'
    );
    expect(permissions).toEqual([
      'file:read',
      'file:create',
      'validation:create'
    ]);
  });
});
```

---

## 🔄 HITO 2: INTEGRACIÓN APS MEJORADA (Semana 2-3)
**Prioridad: ALTA** 🟡

### Problema Identificado
> "La aplicación no reconoce proyectos a los que fui invitado en Autodesk"

### Objetivos
- ✅ Detectar proyectos compartidos en APS (ACC/BIM 360)
- ✅ Sincronizar permisos de APS con la aplicación
- ✅ Mantener consistencia bidireccional entre APS y la plataforma
- ✅ Soporte para todos los tipos de colaboración de Autodesk

### Arquitectura de Integración

#### Modelo de Sincronización
```
┌──────────────────────────────────────────────┐
│  Autodesk APS (ACC/BIM 360)                  │
│  - Hubs                                      │
│  - Projects (owned + shared)                 │
│  - Folders & Files                           │
│  - Permissions per user                      │
└──────────────┬───────────────────────────────┘
               │
               │ OAuth 2.0 + 3-Legged Token
               │
               ▼
┌──────────────────────────────────────────────┐
│  APS Integration Service                     │
│  - Token Management                          │
│  - API Wrapper with Rate Limiting            │
│  - Error Handling & Retry Logic              │
│  - Cache Layer (Redis)                       │
└──────────────┬───────────────────────────────┘
               │
               │ Sync Events
               │
               ▼
┌──────────────────────────────────────────────┐
│  Local Database (Prisma)                     │
│  - Projects (with apsProjectId)              │
│  - Files (with apsUrn, apsItemId)            │
│  - Permissions (mapped from APS)             │
└──────────────────────────────────────────────┘
```

### Tareas

#### 2.1 Servicio APS Profesional
```typescript
// api/src/services/aps/aps-integration.service.ts

import { DataManagementClient } from '@aps_sdk/data-management';
import { RateLimiter } from 'limiter';
import { Redis } from 'ioredis';

/**
 * Servicio centralizado para integración con Autodesk APS
 * Maneja autenticación, rate limiting, caché y errores
 */
export class ApsIntegrationService {
  private dataManagement: DataManagementClient;
  private rateLimiter: RateLimiter;
  private redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutos
  
  constructor() {
    this.dataManagement = new DataManagementClient();
    // APS limit: 100 requests per minute
    this.rateLimiter = new RateLimiter({ 
      tokensPerInterval: 90, 
      interval: 'minute' 
    });
    this.redis = new Redis();
  }
  
  /**
   * Obtiene todos los proyectos accesibles del usuario
   * Incluye proyectos propios + compartidos
   */
  async getAllAccessibleProjects(accessToken: string): Promise<ApsProject[]> {
    const cacheKey = `aps:projects:${this.getUserIdFromToken(accessToken)}`;
    
    // Verificar caché
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const allProjects: ApsProject[] = [];
    
    // 1. Obtener todos los hubs accesibles
    const hubs = await this.getHubs(accessToken);
    
    for (const hub of hubs) {
      // 2. Para cada hub, obtener proyectos
      const projects = await this.getHubProjects(hub.id, accessToken);
      
      // 3. Para cada proyecto, obtener permisos del usuario
      for (const project of projects) {
        const permissions = await this.getUserProjectPermissions(
          hub.id,
          project.id,
          accessToken
        );
        
        allProjects.push({
          ...project,
          hubId: hub.id,
          hubName: hub.attributes.name,
          userPermissions: permissions,
          isShared: this.isSharedProject(permissions),
          role: this.mapApsRoleToInternal(permissions.role)
        });
      }
    }
    
    // Cachear resultado
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(allProjects));
    
    return allProjects;
  }
  
  /**
   * Obtiene hubs con rate limiting
   */
  private async getHubs(accessToken: string): Promise<Hub[]> {
    await this.rateLimiter.removeTokens(1);
    
    try {
      const response = await this.dataManagement.getHubs(accessToken);
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limit exceeded, esperar y reintentar
        await this.sleep(60000); // 1 minuto
        return this.getHubs(accessToken);
      }
      throw this.handleApsError(error);
    }
  }
  
  /**
   * Obtiene proyectos de un hub
   */
  private async getHubProjects(
    hubId: string, 
    accessToken: string
  ): Promise<Project[]> {
    await this.rateLimiter.removeTokens(1);
    
    try {
      const response = await this.dataManagement.getProjects(hubId, accessToken);
      return response.data;
    } catch (error) {
      throw this.handleApsError(error);
    }
  }
  
  /**
   * Obtiene permisos del usuario en un proyecto
   */
  private async getUserProjectPermissions(
    hubId: string,
    projectId: string,
    accessToken: string
  ): Promise<ProjectPermissions> {
    await this.rateLimiter.removeTokens(1);
    
    const cacheKey = `aps:perms:${projectId}:${this.getUserIdFromToken(accessToken)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      // Obtener rol del usuario en el proyecto
      const response = await this.dataManagement.getProjectUsers(
        hubId,
        projectId,
        accessToken
      );
      
      const currentUser = response.data.find(u => u.autodeskId === this.getUserIdFromToken(accessToken));
      
      const permissions = {
        role: currentUser?.roleId || 'viewer',
        canManage: currentUser?.roleId === 'project_admin',
        canEdit: ['project_admin', 'editor'].includes(currentUser?.roleId),
        canView: true,
        canDownload: currentUser?.roleId !== 'viewer_restricted'
      };
      
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(permissions));
      
      return permissions;
    } catch (error) {
      console.warn(`Could not fetch permissions for ${projectId}:`, error.message);
      // Default a permisos mínimos si falla
      return {
        role: 'viewer',
        canManage: false,
        canEdit: false,
        canView: true,
        canDownload: false
      };
    }
  }
  
  /**
   * Mapea roles de APS a roles internos
   */
  private mapApsRoleToInternal(apsRole: string): string {
    const roleMap: Record<string, string> = {
      'project_admin': 'OWNER',
      'editor': 'EDITOR',
      'contributor': 'CONTRIBUTOR',
      'viewer': 'VIEWER_DOWNLOAD',
      'viewer_restricted': 'VIEWER'
    };
    
    return roleMap[apsRole] || 'VIEWER';
  }
  
  /**
   * Determina si un proyecto es compartido (no creado por el usuario)
   */
  private isSharedProject(permissions: ProjectPermissions): boolean {
    return permissions.role !== 'project_admin';
  }
  
  /**
   * Manejo centralizado de errores de APS
   */
  private handleApsError(error: any): Error {
    const status = error.response?.status;
    const message = error.response?.data?.detail || error.message;
    
    switch (status) {
      case 401:
        return new Error('APS_TOKEN_EXPIRED: Token de acceso expirado');
      case 403:
        return new Error(`APS_FORBIDDEN: ${message}`);
      case 404:
        return new Error(`APS_NOT_FOUND: ${message}`);
      case 429:
        return new Error('APS_RATE_LIMIT: Límite de requests excedido');
      default:
        return new Error(`APS_ERROR: ${message}`);
    }
  }
  
  private getUserIdFromToken(accessToken: string): string {
    // Decodificar JWT para obtener user ID
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    return payload.sub;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const apsIntegration = new ApsIntegrationService();
```

#### 2.2 Sincronización Bidireccional
```typescript
// api/src/services/aps/sync-service.ts

/**
 * Servicio de sincronización entre APS y base de datos local
 */
export class ApsSyncService {
  /**
   * Sincroniza proyectos de APS → Local
   */
  async syncProjectsFromAps(userId: string, accessToken: string): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      imported: [],
      updated: [],
      errors: [],
      duration: 0
    };
    
    try {
      // 1. Obtener proyectos de APS
      const apsProjects = await apsIntegration.getAllAccessibleProjects(accessToken);
      
      for (const apsProject of apsProjects) {
        try {
          // 2. Verificar si ya existe localmente
          const existingProject = await prisma.project.findFirst({
            where: { apsProjectId: apsProject.id }
          });
          
          if (existingProject) {
            // Actualizar metadata
            await this.updateProjectFromAps(existingProject.id, apsProject);
            result.updated.push(existingProject.id);
          } else {
            // Importar nuevo proyecto
            const newProject = await this.importProjectFromAps(userId, apsProject);
            result.imported.push(newProject.id);
            
            // Crear ProjectMember con rol mapeado
            await prisma.projectMember.create({
              data: {
                projectId: newProject.id,
                userId,
                roleType: 'SYSTEM',
                systemRole: apsProject.role,
                invitedBy: userId,
                acceptedAt: new Date(),
                status: 'ACCEPTED'
              }
            });
          }
          
          // 3. Sincronizar archivos del proyecto
          await this.syncProjectFiles(apsProject.id, accessToken);
          
        } catch (error) {
          result.errors.push({
            projectId: apsProject.id,
            projectName: apsProject.attributes.name,
            error: error.message
          });
        }
      }
      
      result.duration = Date.now() - startTime;
      
      // Log de auditoría
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'APS_SYNC',
          details: JSON.stringify({
            imported: result.imported.length,
            updated: result.updated.length,
            errors: result.errors.length,
            duration: result.duration
          })
        }
      });
      
      return result;
      
    } catch (error) {
      console.error('Error en sincronización APS:', error);
      throw error;
    }
  }
  
  /**
   * Importa un proyecto de APS a la base de datos local
   */
  private async importProjectFromAps(
    userId: string,
    apsProject: ApsProject
  ): Promise<Project> {
    return await prisma.project.create({
      data: {
        name: apsProject.attributes.name,
        description: `Proyecto importado de Autodesk (${apsProject.hubName})`,
        status: 'Active',
        userId,
        apsProjectId: apsProject.id,
        apsHubId: apsProject.hubId,
        // Metadata adicional
        metadata: JSON.stringify({
          importedFrom: 'APS',
          importedAt: new Date().toISOString(),
          apsHubName: apsProject.hubName,
          apsRole: apsProject.role,
          isShared: apsProject.isShared
        })
      }
    });
  }
  
  /**
   * Actualiza metadata de proyecto desde APS
   */
  private async updateProjectFromAps(
    projectId: string,
    apsProject: ApsProject
  ): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: apsProject.attributes.name,
        updatedAt: new Date(),
        metadata: JSON.stringify({
          lastSyncAt: new Date().toISOString(),
          apsHubName: apsProject.hubName,
          apsRole: apsProject.role
        })
      }
    });
  }
  
  /**
   * Sincroniza archivos de un proyecto APS
   */
  private async syncProjectFiles(
    apsProjectId: string,
    accessToken: string
  ): Promise<void> {
    // Obtener carpetas y archivos del proyecto
    const folders = await apsIntegration.getProjectFolders(apsProjectId, accessToken);
    
    for (const folder of folders) {
      const items = await apsIntegration.getFolderContents(folder.id, accessToken);
      
      for (const item of items) {
        if (item.type === 'items') {
          await this.syncFile(item, apsProjectId, accessToken);
        }
      }
    }
  }
  
  /**
   * Sincroniza un archivo individual
   */
  private async syncFile(
    apsItem: any,
    apsProjectId: string,
    accessToken: string
  ): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { apsProjectId }
    });
    
    if (!project) return;
    
    const existingFile = await prisma.file.findFirst({
      where: { apsItemId: apsItem.id }
    });
    
    if (!existingFile) {
      // Importar nuevo archivo
      await prisma.file.create({
        data: {
          name: apsItem.attributes.displayName,
          originalName: apsItem.attributes.displayName,
          type: this.extractFileType(apsItem.attributes.displayName),
          size: apsItem.attributes.storageSize || 0,
          s3Key: '', // No se almacena localmente
          apsUrn: apsItem.attributes.urn,
          apsItemId: apsItem.id,
          apsProjectId,
          projectId: project.id,
          userId: project.userId,
          status: 'READY'
        }
      });
    } else {
      // Verificar si hay nueva versión
      const latestVersion = apsItem.relationships?.tip?.data?.id;
      if (latestVersion && latestVersion !== existingFile.apsUrn) {
        await this.createNewVersion(existingFile.id, latestVersion);
      }
    }
  }
  
  private async createNewVersion(fileId: string, newUrn: string): Promise<void> {
    const versions = await prisma.fileVersion.count({ where: { fileId } });
    
    await prisma.fileVersion.create({
      data: {
        fileId,
        version: versions + 1,
        apsUrn: newUrn,
        changeType: 'SYNC_APS'
      }
    });
    
    await prisma.file.update({
      where: { id: fileId },
      data: { apsUrn: newUrn }
    });
  }
  
  private extractFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toUpperCase();
    const typeMap: Record<string, string> = {
      'RVT': 'RVT',
      'DWG': 'DWG',
      'PDF': 'PDF',
      'IFC': 'IFC',
      'NWC': 'NWC',
      'NWD': 'NWD'
    };
    return typeMap[ext || ''] || 'OTHER';
  }
}

export const apsSyncService = new ApsSyncService();
```

#### 2.3 Endpoints de Sincronización
```typescript
// api/src/routes/aps-sync.ts

router.post('/sync/projects', requireAuth, async (req, res) => {
  try {
    const accessToken = await getApsAccessToken(req.user.id);
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'No hay token de APS',
        message: 'Debes conectar tu cuenta de Autodesk primero'
      });
    }
    
    const result = await apsSyncService.syncProjectsFromAps(
      req.user.id,
      accessToken
    );
    
    res.json({
      success: true,
      ...result,
      message: `Sincronización completada: ${result.imported.length} importados, ${result.updated.length} actualizados`
    });
    
  } catch (error) {
    console.error('Error sync APS:', error);
    res.status(500).json({ 
      error: 'Error en sincronización',
      details: error.message 
    });
  }
});

// Sincronización automática en login
router.post('/sync/auto', requireAuth, async (req, res) => {
  try {
    const lastSync = await getLastSyncTime(req.user.id);
    const hoursSinceLastSync = (Date.now() - lastSync) / (1000 * 60 * 60);
    
    // Sincronizar si han pasado más de 6 horas
    if (hoursSinceLastSync > 6) {
      // Ejecutar en background
      apsSyncService.syncProjectsFromAps(req.user.id, req.apsToken)
        .catch(error => console.error('Auto-sync error:', error));
    }
    
    res.json({ syncing: hoursSinceLastSync > 6 });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 2.4 UI de Sincronización
```typescript
// frontend/components/aps/ApsSyncManager.tsx

export function ApsSyncManager() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  
  const handleSync = async () => {
    setSyncing(true);
    
    try {
      const response = await fetch('/api/aps-sync/sync/projects', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSyncResult(result);
        setLastSync(new Date());
        
        toast.success('Sincronización completada', {
          description: `${result.imported.length} proyectos importados, ${result.updated.length} actualizados`
        });
        
        // Recargar proyectos
        await refetchProjects();
      }
    } catch (error) {
      toast.error('Error en sincronización', {
        description: error.message
      });
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Sincronización con Autodesk
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {lastSync && (
            <div className="text-sm text-muted-foreground">
              Última sincronización: {formatDistanceToNow(lastSync, { locale: es })}
            </div>
          )}
          
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="w-full"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar Proyectos
              </>
            )}
          </Button>
          
          {syncResult && (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Resultado de Sincronización</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>{syncResult.imported.length} proyectos nuevos importados</li>
                  <li>{syncResult.updated.length} proyectos actualizados</li>
                  {syncResult.errors.length > 0 && (
                    <li className="text-destructive">
                      {syncResult.errors.length} errores
                    </li>
                  )}
                </ul>
                <div className="text-xs text-muted-foreground mt-2">
                  Duración: {(syncResult.duration / 1000).toFixed(1)}s
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Entregables:**
- [ ] ApsIntegrationService con rate limiting y caché
- [ ] ApsSyncService con sincronización bidireccional
- [ ] Mapeo correcto de roles APS → internos
- [ ] Endpoints de sincronización manual y automática
- [ ] UI de sincronización con feedback detallado
- [ ] Indicadores visuales (badge "Desde APS")
- [ ] Manejo de errores robusto
- [ ] Logs de auditoría de sincronización
- [ ] Tests de integración con APS mock
- [ ] Documentación de limitaciones de APS

---

## 📁 HITO 3: SINCRONIZACIÓN Y VERSIONADO AUTOMÁTICO (Semana 3-4)
**Prioridad: ALTA** 🟡

### Problema Identificado
> "Si un archivo se modifica en la carpeta raíz de APS, que el servidor lo reconozca automáticamente"

### Objetivos
- ✅ Detectar cambios en archivos de APS
- ✅ Versionar automáticamente
- ✅ Sistema similar a SharePoint

### Tareas

#### 3.1 Webhook de APS
```typescript
// api/src/routes/webhooks.ts

router.post('/aps/file-changed', async (req, res) => {
  // 1. Validar firma del webhook de Autodesk
  // 2. Extraer información del archivo modificado
  // 3. Crear nueva versión en FileVersion
  // 4. Notificar a usuarios con acceso al proyecto
  // 5. Disparar comparación automática si es necesario
})
```

#### 3.2 Polling como Fallback
```typescript
// api/src/services/aps/sync-service.ts

class ApsSyncService {
  async pollForChanges(projectId: string) {
    // 1. Obtener última versión conocida
    // 2. Consultar APS por versiones nuevas
    // 3. Si hay cambios, crear nueva versión
    // 4. Actualizar metadata (modificado por, fecha, etc)
  }
  
  startPolling(projectId: string, intervalMs: number) {
    // Polling cada X minutos para proyectos activos
  }
}
```

#### 3.3 Modelo de Versiones Extendido
```prisma
model FileVersion {
  id          String   @id @default(uuid())
  fileId      String
  file        File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  version     Int
  apsUrn      String
  apsVersionId String?  // ID de versión en APS
  createdBy   String?
  changeType  String?  // UPLOAD, SYNC_APS, MANUAL_UPDATE
  changelog   String?  // Descripción del cambio
  fileSize    Int?
  checksum    String?  // Para detectar cambios reales
  createdAt   DateTime @default(now())

  @@unique([fileId, version])
  @@index([fileId])
}
```

#### 3.4 UI de Historial de Versiones
- Timeline de versiones con metadata
- Botón "Comparar con anterior"
- Descarga de versiones específicas
- Indicador visual de cambios automáticos vs manuales

**Entregables:**
- [ ] Webhooks de APS configurados
- [ ] Servicio de polling implementado
- [ ] Sistema de versionado automático
- [ ] UI de historial de versiones
- [ ] Notificaciones de cambios detectados

---

## ✅ HITO 4: VALIDACIONES DE NEGOCIO Y FORMATOS (Semana 4-5)
**Prioridad: CRÍTICA** 🔴

### Problema Identificado
> "No es posible ver modelos 3D con archivos TXT, falta validación de formatos"

### Objetivos
- ✅ Validación estricta de formatos
- ✅ Reglas de negocio por tipo de archivo
- ✅ Prevención de operaciones inválidas

### Tareas

#### 4.1 Configuración de Formatos
```typescript
// api/src/config/file-formats.ts

export const FILE_FORMATS = {
  // Modelos 3D - Viewer compatible
  MODELS_3D: {
    extensions: ['.rvt', '.ifc', '.nwc', '.nwd', '.dwg', '.step', '.stp', '.iges', '.igs'],
    mimeTypes: ['application/x-autodesk-rvt', 'application/x-step'],
    maxSize: 500 * 1024 * 1024, // 500MB
    capabilities: ['VIEW_3D', 'EXTRACT_PROPERTIES', 'DOWNLOAD']
  },
  
  // Planos 2D
  DRAWINGS_2D: {
    extensions: ['.dwg', '.dxf', '.dwf'],
    mimeTypes: ['application/acad', 'application/dxf'],
    maxSize: 100 * 1024 * 1024, // 100MB
    capabilities: ['VIEW_2D', 'DOWNLOAD', 'CONVERT']
  },
  
  // Documentos PDF
  PDF: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSize: 50 * 1024 * 1024, // 50MB
    capabilities: ['VIEW_PDF', 'DOWNLOAD', 'EXTRACT_TEXT']
  },
  
  // Engineering Tables
  ENGINEERING_TABLES: {
    extensions: ['.xlsx', '.xls', '.csv'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxSize: 10 * 1024 * 1024, // 10MB
    capabilities: ['PARSE_TABLE', 'VALIDATE_STRUCTURE', 'DOWNLOAD']
  },
  
  // Imágenes
  IMAGES: {
    extensions: ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'],
    mimeTypes: ['image/jpeg', 'image/png'],
    maxSize: 20 * 1024 * 1024, // 20MB
    capabilities: ['VIEW_IMAGE', 'DOWNLOAD']
  },
  
  // NO PERMITIDOS
  FORBIDDEN: {
    extensions: ['.exe', '.bat', '.sh', '.dll', '.sys'],
    reason: 'Tipo de archivo no permitido por seguridad'
  }
}

export function getFileCategory(extension: string): string | null {
  // Retorna la categoría del archivo o null si no es válido
}

export function canPerformAction(extension: string, action: string): boolean {
  // Verifica si el formato soporta la acción
}
```

#### 4.2 Middleware de Validación
```typescript
// api/src/middleware/file-validation.ts

export const validateFileUpload = async (req, res, next) => {
  const file = req.file;
  
  // 1. Verificar extensión
  const ext = path.extname(file.originalname).toLowerCase();
  if (FILE_FORMATS.FORBIDDEN.extensions.includes(ext)) {
    return res.status(400).json({ 
      error: 'Formato no permitido',
      reason: FILE_FORMATS.FORBIDDEN.reason 
    });
  }
  
  // 2. Verificar categoría válida
  const category = getFileCategory(ext);
  if (!category) {
    return res.status(400).json({ 
      error: 'Formato no soportado',
      allowed: getAllowedExtensions() 
    });
  }
  
  // 3. Verificar tamaño máximo
  const maxSize = FILE_FORMATS[category].maxSize;
  if (file.size > maxSize) {
    return res.status(413).json({ 
      error: 'Archivo demasiado grande',
      maxSize: formatBytes(maxSize),
      fileSize: formatBytes(file.size)
    });
  }
  
  // 4. Verificar MIME type (seguridad adicional)
  // ...
  
  req.fileCategory = category;
  next();
}
```

#### 4.3 Validación en Frontend
```typescript
// frontend/lib/file-validator.ts

export const ALLOWED_EXTENSIONS = {
  models3D: ['.rvt', '.ifc', '.nwc', '.nwd'],
  drawings2D: ['.dwg', '.dxf', '.dwf'],
  pdf: ['.pdf'],
  tables: ['.xlsx', '.xls', '.csv'],
  images: ['.jpg', '.jpeg', '.png']
}

export function validateFileClient(file: File): ValidationResult {
  // Validación antes de upload
  // Mostrar error amigable al usuario
}
```

#### 4.4 UI de Validación
- Mensaje de error claro y específico
- Lista de formatos permitidos visible
- Preview de formatos soportados por acción
- Drag & drop con validación visual inmediata

**Entregables:**
- [ ] Configuración de formatos implementada
- [ ] Middleware de validación en API
- [ ] Validación client-side en frontend
- [ ] Mensajes de error claros y accionables
- [ ] Documentación de formatos soportados

---

## 🔬 HITO 5: VALIDACIÓN DE ESTRUCTURA ROBUSTA (Semana 5-6)
**Prioridad: ALTA** 🟡

### Problema Identificado
> "La validación ocurre instantáneamente, debe ser un proceso complejo con parseo real"

### Objetivos
- ✅ Validación realista y asíncrona
- ✅ Parseo real de Engineering Tables
- ✅ Extracción de propiedades de modelos
- ✅ Sistema de colas para procesos pesados

### Tareas

#### 5.1 Cola de Procesamiento (Bull)
```typescript
// api/src/services/queue/validation-queue.ts

import Bull from 'bull';

export const validationQueue = new Bull('validation', {
  redis: { host: 'localhost', port: 6379 }
});

validationQueue.process(async (job) => {
  const { fileId, etData, modelUrn } = job.data;
  
  // 1. Actualizar estado: PROCESSING
  await updateValidationStatus(fileId, 'PROCESSING');
  
  // 2. Extraer propiedades del modelo (puede tardar minutos)
  const modelProperties = await extractModelProperties(modelUrn);
  
  // 3. Parsear Engineering Table (Excel/CSV)
  const parsedET = await parseEngineeringTable(etData);
  
  // 4. Ejecutar validación compleja
  const issues = await performDeepValidation(parsedET, modelProperties);
  
  // 5. Guardar resultados
  await saveValidationResults(fileId, issues);
  
  // 6. Notificar usuario
  await notifyValidationComplete(fileId);
  
  return { issuesFound: issues.length };
});
```

#### 5.2 Parser de Engineering Tables
```typescript
// api/src/services/validation/et-parser.ts

import XLSX from 'xlsx';

export class EngineeringTableParser {
  async parseExcel(filePath: string): Promise<ParsedData> {
    // 1. Detectar estructura del documento
    // 2. Identificar columnas clave (Tag, Type, Size, Location, etc)
    // 3. Normalizar datos
    // 4. Validar integridad (duplicados, campos requeridos)
    // 5. Retornar estructura estandarizada
  }
  
  async parseCSV(filePath: string): Promise<ParsedData> {
    // Similar a Excel pero para CSV
  }
  
  validateTableStructure(data: any[]): ValidationResult {
    // Verificar que tenga las columnas mínimas requeridas
  }
}
```

#### 5.3 Extractor de Propiedades de Modelo
```typescript
// api/src/services/aps/model-properties-extractor.ts

export class ModelPropertiesExtractor {
  async extractAll(urn: string, accessToken: string): Promise<ModelElement[]> {
    // 1. Obtener manifest del modelo
    // 2. Iterar por cada elemento del modelo
    // 3. Extraer propiedades relevantes:
    //    - Tag/Mark
    //    - Family/Type
    //    - Dimensions
    //    - Location
    //    - Custom parameters
    // 4. Normalizar datos para comparación
    
    // NOTA: Este proceso puede tardar 5-30 minutos en modelos grandes
  }
}
```

#### 5.4 Motor de Validación Mejorado
```typescript
// api/src/services/validation/validation-engine.ts

export class ValidationEngine {
  async validate(etData: ParsedData, modelData: ModelElement[]): Promise<Issue[]> {
    const issues: Issue[] = [];
    
    // 1. Crear índices para búsqueda eficiente
    const etIndex = this.createIndex(etData);
    const modelIndex = this.createIndex(modelData);
    
    // 2. Detectar elementos faltantes en modelo
    for (const etElement of etData) {
      if (!modelIndex.has(etElement.tag)) {
        issues.push({
          type: 'MISSING_IN_MODEL',
          severity: 'HIGH',
          element: etElement,
          message: `Elemento ${etElement.tag} está en ET pero no en modelo`
        });
      }
    }
    
    // 3. Detectar elementos no documentados
    for (const modelElement of modelData) {
      if (!etIndex.has(modelElement.tag)) {
        issues.push({
          type: 'UNDOCUMENTED',
          severity: 'MEDIUM',
          element: modelElement,
          message: `Elemento ${modelElement.tag} está en modelo pero no en ET`
        });
      }
    }
    
    // 4. Validar coincidencia de propiedades
    for (const etElement of etData) {
      const modelElement = modelIndex.get(etElement.tag);
      if (modelElement) {
        const propertyIssues = this.compareProperties(etElement, modelElement);
        issues.push(...propertyIssues);
      }
    }
    
    return issues;
  }
  
  compareProperties(etEl: any, modelEl: any): Issue[] {
    // Comparación detallada de:
    // - Type/Family
    // - Dimensions (con tolerancia)
    // - Location
    // - Custom properties
  }
}
```

#### 5.5 UI de Progreso
- Barra de progreso con estimación de tiempo
- Estados detallados: "Extrayendo propiedades...", "Parseando ET...", "Validando..."
- Notificación push cuando termine (si el usuario navega a otra página)
- Cancelación de validación en progreso

**Entregables:**
- [ ] Cola de procesamiento con Redis/Bull
- [ ] Parser completo de Excel/CSV
- [ ] Extractor de propiedades de modelo
- [ ] Motor de validación robusto
- [ ] UI con feedback de progreso
- [ ] Tests con archivos reales (100-200 páginas)

---

## 🎨 HITO 6: UX Y MEJORAS VISUALES (Semana 6-7)
**Prioridad: MEDIA** 🟢

### Problemas Identificados
> "Cosas no centradas, sin contraste en modo claro, sin feedback en acciones"

### Objetivos
- ✅ Interfaz profesional y consistente
- ✅ Accesibilidad WCAG 2.1 AA
- ✅ Feedback visual en todas las acciones

### Tareas

#### 6.1 Sistema de Diseño Unificado
```typescript
// frontend/lib/design-tokens.ts

export const colors = {
  // Modo Oscuro
  dark: {
    bg: {
      primary: '#0f172a',
      secondary: '#1e293b',
      tertiary: '#334155'
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8'
    },
    accent: {
      primary: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    }
  },
  
  // Modo Claro - CON CONTRASTE MEJORADO
  light: {
    bg: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#e2e8f0'
    },
    text: {
      primary: '#0f172a',      // Contraste 16:1
      secondary: '#475569',     // Contraste 7:1
      tertiary: '#64748b'       // Contraste 4.5:1
    },
    accent: {
      primary: '#2563eb',       // Azul más oscuro para contraste
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626'
    }
  }
}
```

#### 6.2 Componentes de Feedback
```typescript
// frontend/components/LoadingStates.tsx

export function ButtonWithLoading({ 
  loading, 
  onClick, 
  children,
  loadingText = "Procesando..."
}: Props) {
  return (
    <Button onClick={onClick} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : children}
    </Button>
  )
}

export function ProgressWithEstimate({ 
  progress, 
  estimatedSeconds,
  status 
}: Props) {
  return (
    <div className="space-y-2">
      <Progress value={progress} />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{status}</span>
        <span>~{formatTime(estimatedSeconds)} restantes</span>
      </div>
    </div>
  )
}
```

#### 6.3 Toast Notifications Mejoradas
```typescript
// Reemplazar toasts genéricos con feedback detallado

// ❌ Antes
toast.success("Archivo descargado")

// ✅ Después
toast.success("Archivo descargado", {
  description: `${file.name} (${formatBytes(file.size)})`,
  action: {
    label: "Abrir carpeta",
    onClick: () => openDownloadsFolder()
  }
})
```

#### 6.4 Skeleton Loaders
- Reemplazar spinners genéricos con skeleton screens
- Mantener layout estable durante carga
- Anticipar contenido que va a aparecer

#### 6.5 Auditoría Visual Completa
- [ ] Verificar alineación en todas las pantallas
- [ ] Test de contraste con herramientas automáticas
- [ ] Responsive design en móviles/tablets
- [ ] Consistencia de espaciado (4px, 8px, 16px, 24px, 32px)
- [ ] Iconografía consistente (Lucide React)

**Entregables:**
- [ ] Design tokens implementados
- [ ] Componentes de feedback creados
- [ ] Modo claro con contraste WCAG AA
- [ ] Skeleton loaders en carga de datos
- [ ] Toast notifications informativas
- [ ] Auditoría visual completada y documentada

---

## 📊 HITO 7: MONITOREO Y LOGS (Semana 7-8)
**Prioridad: MEDIA** 🟢

### Objetivos
- ✅ Logging estructurado
- ✅ Métricas de performance
- ✅ Auditoría de acciones

### Tareas

#### 7.1 Winston Logger
```typescript
// api/src/lib/logger.ts

import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Logs estructurados
logger.info('File uploaded', {
  userId: user.id,
  fileId: file.id,
  fileName: file.name,
  fileSize: file.size,
  duration: Date.now() - startTime
});
```

#### 7.2 Activity Log en UI
- Timeline de actividad reciente por proyecto
- Filtros por acción y usuario
- Exportación de logs para auditoría

**Entregables:**
- [ ] Sistema de logging implementado
- [ ] Dashboard de actividad
- [ ] Alertas para acciones críticas

---

## 🧪 HITO 8: TESTING Y DOCUMENTACIÓN (Semana 8)
**Prioridad: ALTA** 🟡

### Objetivos
- ✅ Tests automatizados
- ✅ Documentación técnica
- ✅ Manual de usuario

### Tareas

#### 8.1 Tests Unitarios
- Validadores de formato
- Permisos y autorización
- Parsers de ET

#### 8.2 Tests de Integración
- Flujo completo de validación
- Sincronización APS
- Sistema de permisos

#### 8.3 Documentación
- API Reference (Swagger actualizado)
- README con setup completo
- Manual de usuario (PDF)
- Video tutoriales de funcionalidades clave

**Entregables:**
- [ ] Cobertura de tests >70%
- [ ] Documentación API completa
- [ ] Manual de usuario publicado
- [ ] Videos tutoriales

---

## 📅 CRONOGRAMA DETALLADO

| Semana | Hito | Entregables Clave | Horas Est. |
|--------|------|-------------------|------------|
| 1-2 | H1: Seguridad | Permisos + UI compartir | 60-80h |
| 2-3 | H2: APS Mejorada | Proyectos compartidos sync | 40-50h |
| 3-4 | H3: Sincronización | Webhooks + Versionado | 50-60h |
| 4-5 | H4: Validación Formatos | Middleware + UI | 30-40h |
| 5-6 | H5: Validación Estructura | Cola + Parser + Motor | 70-90h |
| 6-7 | H6: UX/UI | Design system + Feedback | 40-50h |
| 7-8 | H7-8: Monitoring + Tests | Logs + Tests + Docs | 30-40h |

**Total Estimado:** 320-410 horas (~8-10 semanas a dedicación completa)

---

## 🚀 PRIORIDAD DE IMPLEMENTACIÓN

### Sprint 1 (Crítico - 2 semanas)
1. **H1: Seguridad y Permisos**
2. **H4: Validación de Formatos**

### Sprint 2 (Alto - 2 semanas)
3. **H2: APS Proyectos Compartidos**
4. **H3: Sincronización Automática**

### Sprint 3 (Alto - 2 semanas)
5. **H5: Validación de Estructura Robusta**

### Sprint 4 (Pulido - 2 semanas)
6. **H6: Mejoras UX/UI**
7. **H7: Monitoreo**
8. **H8: Testing y Docs**

---

## 📋 CHECKLIST DE PRODUCCIÓN

### Antes de Deploy
- [ ] Todos los tests pasan
- [ ] Auditoría de seguridad completada
- [ ] Variables de entorno documentadas
- [ ] Backup de base de datos configurado
- [ ] SSL/HTTPS configurado
- [ ] Rate limiting en API
- [ ] CORS configurado correctamente
- [ ] Logs centralizados
- [ ] Monitoreo de errores (Sentry)
- [ ] CDN para assets estáticos

### Post-Deploy
- [ ] Smoke tests en producción
- [ ] Monitoreo de métricas
- [ ] Plan de rollback preparado
- [ ] Documentación actualizada
- [ ] Usuarios beta testeando

---

## 🎯 MÉTRICAS DE ÉXITO

### Seguridad
- ✅ 100% de proyectos con owner definido
- ✅ 0 accesos no autorizados en logs
- ✅ Todos los endpoints protegidos

### Performance
- ✅ Validaciones <30s para archivos estándar
- ✅ Carga de proyectos <2s
- ✅ UI responsiva <100ms

### UX
- ✅ Contraste WCAG AA en 100% de textos
- ✅ 0 acciones sin feedback visual
- ✅ Tiempo de espera percibido reducido 70%

### Calidad
- ✅ Cobertura de tests >70%
- ✅ 0 errores críticos en producción
- ✅ Documentación completa

---

## 📞 PRÓXIMOS PASOS

1. **Revisar y aprobar este plan**
2. **Priorizar hitos si es necesario**
3. **Comenzar con H1: Seguridad (crítico)**
4. **Setup de herramientas**: Redis para colas, Winston para logs
5. **Crear branch `feature/security-permissions`**

---

---

## 📊 RESUMEN VISUAL: SISTEMA RBAC

### Matriz de Permisos por Rol

| Acción | Super Admin | Org Admin | Project Manager | Engineer | Viewer | Guest |
|--------|-------------|-----------|-----------------|----------|--------|-------|
| **PROYECTOS** |
| Crear proyecto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver proyectos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar proyecto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Eliminar proyecto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Compartir proyecto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar miembros | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **ARCHIVOS** |
| Subir archivos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver archivos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar archivos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Eliminar archivos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Descargar archivos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Convertir archivos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **VALIDACIONES** |
| Crear validación | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver validaciones | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar validaciones | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **COMPARACIONES** |
| Crear comparación | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver comparaciones | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Descargar resultados | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **ORGANIZACIÓN** |
| Gestionar usuarios | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear roles custom | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver configuración | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Flujo de Verificación de Permisos

```
┌─────────────────────────────────────────────────┐
│  Usuario intenta realizar acción                │
│  Ejemplo: Descargar archivo de Proyecto X       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Middleware: requirePermission('file:download')  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  AuthorizationService.getUserProjectPermissions  │
│                                                  │
│  1. ¿Usuario en organización?                   │
│     → Obtener permisos del rol organizacional   │
│                                                  │
│  2. ¿Usuario miembro del proyecto?              │
│     → Obtener permisos del rol en proyecto      │
│                                                  │
│  3. Combinar permisos (UNION)                   │
│     → permisos = org + project                  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  ¿'file:download' en permisos?                  │
└─────┬──────────────────────────────┬────────────┘
      │ SÍ                           │ NO
      ▼                              ▼
┌─────────────────┐      ┌──────────────────────┐
│  ✅ Permitir    │      │  ❌ 403 Forbidden    │
│  Acción exitosa │      │  Mensaje de error    │
└─────────────────┘      └──────────────────────┘
```

### Ejemplo Real: Flujo de Compartir Proyecto

```
1. [Jefe Proyecto] Juan crea "Proyecto Torre A"
   └─> Juan es OWNER automáticamente

2. [Jefe Proyecto] Juan invita a María como EDITOR
   └─> María recibe notificación
   └─> María acepta invitación
   └─> María tiene permisos de EDITOR en "Proyecto Torre A"

3. [Editor] María sube archivo "Plano-Arquitectura.rvt"
   └─> Verifica: hasPermission('file:create') → ✅ SÍ
   └─> Archivo subido exitosamente

4. [Jefe Proyecto] Juan invita a Cliente "ABC Corp" como VIEWER
   └─> Cliente puede ver pero no descargar

5. [Viewer] Cliente ABC intenta descargar archivo
   └─> Verifica: hasPermission('file:download') → ❌ NO
   └─> Error 403: "No tienes permisos para descargar archivos"

6. [Jefe Proyecto] Juan cambia rol de Cliente a VIEWER_DOWNLOAD
   └─> Permisos actualizados
   └─> Cache invalidado
   └─> Log de auditoría registrado

7. [Viewer Download] Cliente ABC descarga archivo
   └─> Verifica: hasPermission('file:download') → ✅ SÍ
   └─> Descarga exitosa
   └─> Log: "Cliente ABC descargó Plano-Arquitectura.rvt"
```

---

## 🎓 GUÍA DE IMPLEMENTACIÓN RÁPIDA

### Paso 1: Actualizar Base de Datos (15 min)
```bash
cd prisma
# Copiar los nuevos modelos al schema.prisma
npx prisma db push
npx prisma generate
```

### Paso 2: Crear Configuración de Permisos (30 min)
```bash
cd api/src/config
# Crear permissions.ts con todos los permisos definidos
```

### Paso 3: Implementar AuthorizationService (1 hora)
```bash
cd api/src/middleware
# Crear authorization.ts con el servicio completo
```

### Paso 4: Proteger Endpoints Existentes (2 horas)
```typescript
// Ejemplo: Antes
router.post('/projects', async (req, res) => { ... });

// Después
router.post('/projects', 
  requirePermission('project:create'),
  async (req, res) => { ... }
);
```

### Paso 5: Crear UI de Gestión (3 horas)
- Componente MemberManagement
- Componente CustomRoleCreator
- Hook usePermissions

### Paso 6: Migrar Datos Existentes (30 min)
```bash
cd api
npx ts-node scripts/migrate-to-rbac.ts
```

### Paso 7: Testing (2 horas)
- Tests de permisos
- Tests de roles
- Tests de UI

**Total estimado para RBAC completo: 8-10 horas**

---

**Documento creado:** Diciembre 2, 2025
**Versión:** 2.0 (Actualizado con Sistema RBAC Completo)
**Estado:** PENDIENTE APROBACIÓN
**Última actualización:** Incluido sistema de roles jerárquico profesional

