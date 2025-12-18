# 🔐 DOCUMENTACIÓN PRIVADA - NO COMPARTIR

**CONFIDENCIAL**: Este documento contiene información sensible sobre rutas administrativas y mecanismos de seguridad del sistema.

---

## 📋 Mapa de Rutas Ofuscadas

### Rutas Públicas (Accesibles sin autenticación)
- `/` - Landing page
- `/api/auth/login` - Inicio de sesión OAuth Autodesk
- `/api/auth/callback` - Callback OAuth

### Rutas Protegidas (Requieren autenticación)
- `/dashboard` - Panel principal
- `/dashboard/projects` - Gestión de proyectos
- `/dashboard/files` - Gestión de archivos
- `/dashboard/bom` - BOM y cantidades
- `/dashboard/viewer` - Visor 3D
- `/dashboard/validation` - Validación de estructura
- `/dashboard/settings` - Configuración de usuario

### 🚨 Rutas Administrativas (SOLO ADMIN)

| Ruta Ofuscada | Función Real | Requiere |
|---------------|--------------|----------|
| `/dashboard/sys/acl` | Sistema de Control de Acceso (RBAC Admin) | ADMIN |
| `/api/users` | Listar todos los usuarios | ADMIN |
| `/api/admin/users/:id/role` | Cambiar rol de usuario | ADMIN |

**IMPORTANTE**: 
- Las rutas `/dashboard/sys/*` NO aparecen en el menú de navegación
- Solo se accede mediante URL directa
- El backend verifica `req.session.user.role === 'ADMIN'` en cada request
- La página verifica `user.role === 'ADMIN'` en cliente y redirecciona si no cumple

---

## 🔑 Sistema de Roles y Permisos

### Roles de Usuario (User.role)
- `USER` - Usuario estándar (por defecto)
- `ADMIN` - Administrador del sistema

### Roles de Proyecto (ProjectMember.role)
- `OWNER` - Propietario del proyecto (todos los permisos)
- `EDITOR` - Editor (puede modificar y ver)
- `VIEWER_DOWNLOAD` - Visualizador con descarga
- `VIEWER` - Visualizador solo lectura

---

## 🛡️ Mecanismos de Seguridad Implementados

### 1. Asignación Automática de ADMIN
**Variable de entorno**: `.env`
```env
ADMIN_EMAILS=tu-email@dom.com,otro-admin@empresa.com
```

**Lógica** (`api/src/routes/auth.ts` líneas ~90-110):
```typescript
const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
const isAdmin = adminEmails.includes(profile.emailId.toLowerCase());

const user = await prisma.user.upsert({
    where: { email: profile.emailId },
    update: { role: isAdmin ? 'ADMIN' : 'USER' },
    create: { role: isAdmin ? 'ADMIN' : 'USER' }
});
```

**Beneficios**:
- ✅ No requiere edición manual de base de datos
- ✅ Se actualiza automáticamente en cada login
- ✅ Centralizado en configuración
- ✅ Fácil agregar/remover admins

### 2. Protección Server-Side de Rutas Admin

**Middleware** (`api/src/middleware/authorization.ts`):
```typescript
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.session?.user?.role;
    
    if (userRole !== 'ADMIN') {
        return res.status(403).json({ 
            error: 'Admin access required',
            code: 'FORBIDDEN'
        });
    }
    
    next();
};
```

**Rutas protegidas**:
- `GET /api/users` - Lista todos los usuarios
- `PUT /api/admin/users/:id/role` - Cambia rol de usuario

### 3. Protección Client-Side con Redirección

**Página Admin** (`frontend/app/dashboard/sys/acl/page.tsx` líneas ~78-86):
```typescript
useEffect(() => {
    if (!user) return
    if (user.role !== 'ADMIN') {
        toast.error('Access Denied', {
            description: 'You need administrator privileges'
        })
        window.location.href = '/dashboard'
    }
}, [user])
```

### 4. Aislamiento Multi-Tenant de Proyectos

**Query de proyectos** (`api/src/routes/projects.ts` líneas ~132-155):
```typescript
const projects = await prisma.project.findMany({
    where: {
        OR: [
            { ownerId: userId },  // Proyectos propios
            { 
                members: {
                    some: {
                        userId: userId,
                        acceptedAt: { not: null }  // Solo si aceptó invitación
                    }
                }
            }
        ]
    }
});
```

**Garantía**: Cada usuario SOLO ve:
- ✅ Proyectos que creó (ownerId)
- ✅ Proyectos compartidos explícitamente (ProjectMember con acceptedAt)
- ❌ NO ve proyectos de otros usuarios

### 5. Sin Enlaces Visibles a Rutas Admin

**Sidebar** (`frontend/components/Sidebar.tsx`):
- ❌ NO hay enlace a `/dashboard/sys/acl`
- ❌ NO hay icono de admin
- ❌ NO hay indicación visual de su existencia

**Acceso**:
- Solo mediante URL directa: `https://tu-dominio.com/dashboard/sys/acl`
- Solo si eres ADMIN

### 6. Cache con Aislamiento por Usuario

**Redis Keys** (`api/src/lib/redis-keys.ts`):
```typescript
projectsList: (userId: string) => `cache:projects:list:${userId}`
```

- Cada usuario tiene su propia cache
- No hay colisión entre datos de diferentes usuarios

---

## 🧪 Tests de Seguridad Ejecutados

### Test de Aislamiento Multi-Usuario
**Script**: `api/scripts/test-user-isolation.ts`

**Resultados**: ✅ 7/7 PASS (100%)

1. ✅ Usuario A ve solo sus 2 proyectos
2. ✅ Usuario B ve sus 2 proyectos + 1 compartido
3. ✅ Usuario A NO ve proyectos privados de B
4. ✅ Usuario B NO ve proyecto privado A1
5. ✅ Usuario B SÍ ve proyecto compartido A2
6. ✅ Admin puede ver todos (query directa)
7. ✅ Roles correctos (OWNER/VIEWER)

**Comando**:
```bash
cd api
npx ts-node scripts/test-user-isolation.ts
```

---

## 🚀 Configuración de Producción

### Variables de Entorno Requeridas (.env)

```env
# === ADMIN CONFIGURATION ===
ADMIN_EMAILS=admin1@empresa.com,admin2@empresa.com

# === AUTODESK APS ===
APS_CLIENT_ID=tu_client_id
APS_CLIENT_SECRET=tu_client_secret
APS_CALLBACK_URL=https://tu-dominio.com/api/auth/callback
APS_BUCKET=tu-bucket-name

# === REDIS ===
REDIS_URL=redis://localhost:6379
# o para Redis Cloud:
# REDIS_URL=rediss://:password@host:port

# === SESSION ===
SESSION_SECRET=clave-super-secreta-cambiar-en-produccion

# === DATABASE ===
DATABASE_URL=file:./prisma/dev.db
# o para producción:
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# === FRONTEND ===
NEXT_PUBLIC_API_URL=https://tu-dominio.com
NEXTAUTH_URL=https://tu-dominio.com
```

### Checklist de Seguridad Pre-Deployment

- [ ] Cambiar `SESSION_SECRET` a valor aleatorio seguro
- [ ] Configurar `ADMIN_EMAILS` con emails correctos
- [ ] Usar base de datos PostgreSQL en producción (no SQLite)
- [ ] Configurar Redis en producción (no local)
- [ ] Habilitar HTTPS en todos los endpoints
- [ ] Configurar CORS correctamente
- [ ] Revisar logs de acceso a rutas admin
- [ ] Implementar rate limiting en endpoints sensibles
- [ ] Configurar backup automático de base de datos
- [ ] Documentar procedimiento de recuperación de acceso admin

---

## 🆘 Procedimientos de Emergencia

### Recuperar Acceso Admin

**Si perdiste acceso admin:**

1. **Opción A - Vía Base de Datos**:
```sql
-- SQLite
UPDATE User SET role = 'ADMIN' WHERE email = 'tu-email@empresa.com';

-- PostgreSQL
UPDATE "User" SET role = 'ADMIN' WHERE email = 'tu-email@empresa.com';
```

2. **Opción B - Vía Variable de Entorno**:
```env
ADMIN_EMAILS=tu-email@empresa.com
```
Luego hacer login de nuevo.

3. **Opción C - Vía Script**:
```bash
cd api
npx ts-node scripts/make-admin.ts tu-email@empresa.com
```

### Auditar Accesos Admin

**Ver todos los admins**:
```sql
SELECT id, email, name, role, createdAt 
FROM User 
WHERE role = 'ADMIN';
```

**Ver logs de cambios de rol** (si implementado):
```sql
SELECT * FROM AuditLog 
WHERE action = 'ROLE_CHANGE' 
ORDER BY createdAt DESC 
LIMIT 20;
```

---

## 📊 Métricas de Seguridad

### KPIs a Monitorear

1. **Intentos de acceso a `/dashboard/sys/*` sin ADMIN**
   - Monitorear logs de 403 Forbidden
   - Alertar si > 10 intentos del mismo IP

2. **Cambios de rol de usuario**
   - Registrar quién, cuándo, qué cambió
   - Alertar en cambios a ADMIN

3. **Accesos exitosos a panel admin**
   - Registrar timestamp, IP, user
   - Revisar accesos fuera de horario laboral

4. **Proyectos compartidos**
   - Auditar compartidos masivos (>50 proyectos)
   - Revisar permisos OWNER otorgados

---

## 🔄 Actualizaciones y Mantenimiento

### Agregar Nuevo Admin

1. Editar `.env`:
```env
ADMIN_EMAILS=admin1@empresa.com,admin2@empresa.com,nuevo-admin@empresa.com
```

2. Reiniciar servidor backend
3. Nuevo admin debe hacer logout/login

### Remover Admin

1. Editar `.env` (quitar email)
2. Reiniciar servidor
3. OPCIONAL: Actualizar DB manualmente:
```sql
UPDATE User SET role = 'USER' WHERE email = 'ex-admin@empresa.com';
```

### Renombrar Ruta Admin

Si quieres cambiar `/dashboard/sys/acl` a otra ruta:

1. Renombrar carpeta:
```bash
cd frontend/app/dashboard
mv sys/acl nueva-ruta/codigo-secreto
```

2. Actualizar documentación privada
3. Informar a admins actuales

---

## 📚 Referencias Técnicas

- **Autenticación**: Autodesk APS OAuth 2.0
- **Sesiones**: express-session con Redis store
- **RBAC**: Role-Based Access Control con 2 niveles (User.role + ProjectMember.role)
- **Cache**: Redis con TTL de 1-5 minutos
- **Database**: Prisma ORM con SQLite (dev) / PostgreSQL (prod)

---

**ÚLTIMA ACTUALIZACIÓN**: 3 de diciembre de 2025

**RESPONSABLE**: Equipo de Desarrollo DOM BIM Platform

**CONFIDENCIALIDAD**: 🔴 ALTA - NO DISTRIBUIR
