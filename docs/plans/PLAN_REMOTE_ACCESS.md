# Secure Remote Access - Implementation Plan

## Goal

Enable secure remote access to the development environment using **OAuth authentication** and **zero hardcoded secrets**.

## Security Architecture

### Authentication Flow

```
User → Tunnel URL → CORS Check → OAuth Autodesk → Session → ADMIN_EMAILS Check → Access
```

### Defense Layers

1. **CORS Allowlist**: Only authorized origins can make requests
2. **OAuth Autodesk**: Delegated authentication, no shared passwords
3. **ADMIN_EMAILS**: Role-based access control via environment variable
4. **Rate Limiting**: Protection against brute force and abuse
5. **Secure Sessions**: httpOnly, sameSite, secure cookies

## Implementation Strategy

### 1. Tunneling (No Authentication at Tunnel Level)

Use `ngrok` or `localtunnel` to expose the application:

- **ngrok**: `ngrok http 3000` (stable, recommended)
- **localtunnel**: `npx localtunnel --port 3000` (no install)

**Security**: Tunnel provides HTTPS, but no authentication. Application handles all auth.

### 2. CORS Protection

Configure allowed origins in `.env`:

```env
CORS_ORIGINS=https://tunnel-url.ngrok-free.app
```

Backend validates `Origin` header on every request. Rejects unauthorized origins.

### 3. OAuth Authentication (Existing)

Application already implements Autodesk APS OAuth 2.0:

- Routes: `/api/auth/login`, `/api/auth/callback`
- Session storage: Redis
- Token refresh: Automatic

**No changes needed** - already implemented.

### 4. Admin Access Control (Existing)

Access control via `ADMIN_EMAILS` environment variable:

```env
ADMIN_EMAILS=user1@empresa.com,user2@empresa.com
```

Role assigned automatically on login based on email match.

**No changes needed** - already implemented.

### 5. Rate Limiting (Existing)

Protection against abuse:

- Auth endpoints: 5 attempts per 15 minutes
- API endpoints: 100 requests per 15 minutes
- Redis-backed for distributed environments

**No changes needed** - already implemented.

## Configuration Steps

### Development Environment

1. Set environment variables:

   ```env
   CORS_ORIGINS=http://localhost:3000
   ADMIN_EMAILS=your-email@empresa.com
   RATE_LIMIT_STORE=redis
   ```

2. Start services:

   ```bash
   npm run dev
   ```

### Remote Access Setup

1. Create tunnel:

   ```bash
   ngrok http 3000
   ```

2. Copy tunnel URL (e.g., `https://abc123.ngrok-free.app`)

3. Update CORS:

   ```env
   CORS_ORIGINS=https://abc123.ngrok-free.app
   ```

4. Restart server:

   ```bash
   npm run dev
   ```

5. Access from remote computer:
   - Open tunnel URL
   - Click "Login with Autodesk"
   - Authenticate
   - Access granted if email in ADMIN_EMAILS

## Security Verification

### Pre-Deployment Checklist

- [ ] No hardcoded credentials in codebase
- [ ] CORS_ORIGINS configured with tunnel URL
- [ ] ADMIN_EMAILS populated
- [ ] Rate limiting active (test with repeated failed logins)
- [ ] OAuth flow working end-to-end
- [ ] Session cookies are httpOnly + secure

### Testing

```bash
# Test CORS blocking
curl -H "Origin: https://evil.com" https://tunnel-url/api/health
# Expected: CORS error

# Test rate limiting
for i in {1..10}; do curl https://tunnel-url/api/auth/login; done
# Expected: 429 after threshold

# Test unauthorized access
curl https://tunnel-url/api/admin/status
# Expected: 401 Unauthorized
```

## Comparison: Old vs New

| Aspect              | Old (Basic Auth)  | New (OAuth + CORS)              |
| ------------------- | ----------------- | ------------------------------- |
| Credentials         | Hardcoded in repo | Zero secrets in repo            |
| Auth method         | Basic Auth header | OAuth 2.0                       |
| Password management | Shared password   | Individual accounts             |
| Session security    | None              | Redis + secure cookies          |
| Access control      | Single password   | Email allowlist                 |
| Audit trail         | None              | Session logs + role assignments |
| Rate limiting       | None              | Active on all endpoints         |

## Benefits

- ✅ **Zero secrets in repository**
- ✅ **Individual accountability** (OAuth per user)
- ✅ **Granular access control** (ADMIN_EMAILS)
- ✅ **Multi-layer defense** (CORS + OAuth + rate limit)
- ✅ **No credential rotation needed** (OAuth tokens auto-refresh)
- ✅ **Audit trail** (session logs with email + IP)
