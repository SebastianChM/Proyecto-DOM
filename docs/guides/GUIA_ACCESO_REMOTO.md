# Guía de Acceso Remoto Seguro

## Requisitos de Seguridad

Esta aplicación utiliza **autenticación OAuth de Autodesk** y **control de acceso basado en roles**. No hay credenciales compartidas ni Basic Auth.

## Pasos para Acceso Remoto

### 1. Preparar el Entorno Local

Configura las variables de entorno de seguridad en `.env`:

```env
# CORS: Agregar la URL del túnel
CORS_ORIGINS=http://localhost:3000,https://tu-tunel.ngrok-free.app

# Emails administradores autorizados
ADMIN_EMAILS=tu-email@empresa.com

# Rate limiting habilitado
RATE_LIMIT_STORE=redis
```

### 2. Ejecutar el Servidor Localmente

```bash
npm run dev
```

### 3. Crear Túnel Seguro

Opción A - **ngrok** (recomendado):

```bash
# Descargar de: https://ngrok.com/download
ngrok http 3000
```

Opción B - **localtunnel**:

```bash
npx localtunnel --port 3000
```

### 4. Actualizar CORS

Copia la URL del túnel (ej: `https://xxxx.ngrok-free.app`) y agrégala a `CORS_ORIGINS` en `.env`:

```env
CORS_ORIGINS=https://xxxx.ngrok-free.app
```

Reinicia el servidor.

### 5. Acceder desde Equipo Remoto

1. Abre la URL del túnel en el navegador
2. Haz clic en "Login with Autodesk"
3. Autentícate con tu cuenta Autodesk
4. Tu email debe estar en `ADMIN_EMAILS` para acceso administrativo

## Controles de Seguridad Activos

- ✅ **OAuth Autodesk**: Autenticación delegada, sin contraseñas compartidas
- ✅ **CORS Allowlist**: Solo orígenes autorizados pueden hacer requests
- ✅ **Rate Limiting**: Protección contra abuso (ver `/api/auth/login`)
- ✅ **ADMIN_EMAILS**: Control de acceso basado en allowlist de emails
- ✅ **Session Security**: Cookies con httpOnly, sameSite, secure

## Troubleshooting

**Error CORS**: Verifica que la URL del túnel esté en `CORS_ORIGINS`

**401 Unauthorized**: Debes autenticarte con OAuth Autodesk

**403 Forbidden**: Tu email no está en `ADMIN_EMAILS`

**429 Too Many Requests**: Rate limit activado, espera 15 minutos
