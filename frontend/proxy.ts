import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 🔒 Proxy de Seguridad (Next.js 16+)
 * 
 * Protege rutas administrativas sensibles:
 * - /dashboard/sys/* - Sistema de administración (requiere ADMIN en backend)
 * 
 * La protección real está en:
 * 1. Backend: requireAdmin middleware verifica req.session.user.role === 'ADMIN'
 * 2. Frontend: useEffect en página verifica user.role y redirecciona
 * 3. URL ofuscada: /sys/acl en lugar de /admin/rbac
 */
export function proxy(req: NextRequest) {
    // Allow all requests - authentication handled by backend OAuth
    // Admin routes protected by backend middleware + client-side redirect
    return NextResponse.next()
}

export const config = {
    matcher: '/:path*',
}
