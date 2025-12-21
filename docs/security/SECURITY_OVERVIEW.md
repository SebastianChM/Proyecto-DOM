# Security Overview

## Security Documentation in Repository

This repository contains **operational security documentation** with procedures, checklists, and configurations. All documentation uses **placeholders** for sensitive data.

### What's Included

**Deployment & Operations:**

- Pre-deployment security checklist
- Backup and restore procedures
- Rate limiting configuration
- Environment variable templates

**Implementation Guides:**

- Authentication flow (OAuth 2.0 with APS)
- Authorization and RBAC
- Network security (CORS, rate limiting)
- Secure session management

All guides use `CHANGE_ME` placeholders. **No real credentials or internal data** are stored in this repository.

---

## Contenido Permitido en Repo

✅ **Allowed in repository:**

- Procedural documentation (how to deploy, backup, restore)
- Security checklists without internal specifics
- Configuration templates with placeholders (`CHANGE_ME`)
- Code implementation patterns
- Public API documentation
- Architecture diagrams (without internal IPs/domains)
- Rate limiting policies
- CORS configuration examples
- Env var lists (without real values)

---

## Contenido Fuera de Repo

❌ **NEVER commit to repository:**

- Real credentials (passwords, API keys, tokens)
- Internal IP addresses or domain names
- Production database connection strings
- Admin email addresses (use placeholders)
- Third-party API secrets
- Session secrets or encryption keys
- OAuth client secrets
- Webhook secrets
- SSH keys or certificates
- Production `.env` files
- Backup files containing real data
- Log files with sensitive information

---

## Public Security Information

### Authentication

- **OAuth 2.0** via Autodesk Platform Services (APS)
- Session-based with Redis storage
- Role-based access control (RBAC)
- 3-legged OAuth for user context

### Access Control

- Admin access via `ADMIN_EMAILS` environment variable (allowlist)
- Automatic role assignment on login
- Audit logging for role changes
- Protected admin routes with `requireAdmin` middleware

### Network Security

- **CORS allowlist** configuration (no wildcards in production)
- **Rate limiting** on all endpoints with Redis store
- Request ID tracking for audit trails
- Secure cookies: `httpOnly`, `sameSite`, `secure` flags
- Webhook signature validation

### Data Protection

- Environment variables for all secrets
- No hardcoded credentials in codebase
- Passwords hidden in logs
- Connection strings truncated in error messages
- Backup files excluded from version control

### Security Headers

- **Helmet** middleware for security headers
- **HSTS** (HTTP Strict Transport Security) when enabled
- Trust proxy configuration for reverse proxy deployments
- Content Security Policy (CSP) ready

---

## Security Documentation Structure

```text
docs/
├── deploy/
│   ├── PRE_DEPLOYMENT_SECURITY.md  # Pre-deployment checklist
│   └── BACKUPS.md                  # Backup & restore procedures
├── security/
│   └── SECURITY_OVERVIEW.md        # This file
└── hito1_*.md                      # Security hardening docs (Hito 1)
```

### Key Documents

- **[PRE_DEPLOYMENT_SECURITY.md](../deploy/PRE_DEPLOYMENT_SECURITY.md)** - Mandatory checklist before production deployment
- **[BACKUPS.md](../deploy/BACKUPS.md)** - Complete backup and restore guide with verification steps
- **`.env.example`** - Required security configuration with placeholders
- **`api/src/config/env.ts`** - Environment variable validation

---

## Security Audit Trail

All security-related changes are documented in Hito 1 implementation docs:

- `docs/hito1_urn_removal.md` - Elimination of hardcoded URNs
- `docs/hito1_rate_limiting.md` - Unified rate limiting with Redis
- `docs/hito1_backup_system.md` - Reproducible backup system

---

## Contact for Security Issues

For security vulnerabilities or concerns:

1. **DO NOT** open a public issue
2. Contact project administrator via private channel
3. Follow responsible disclosure practices

---

## Compliance Checklist

Before any commit:

- [ ] ✅ No real credentials in code or docs
- [ ] ✅ All secrets use `CHANGE_ME` placeholders
- [ ] ✅ `.env` is in `.gitignore`
- [ ] ✅ Backup files are in `.gitignore`
- [ ] ✅ No logs with authorization headers or cookies
- [ ] ✅ Connection strings use environment variables
- [ ] ✅ Admin emails use placeholders in examples

---

**Last Updated**: 2025-12-20  
**Version**: 2.0.0  
**Hito**: 1 - Security Hardening Complete
