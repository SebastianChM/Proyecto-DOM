# DOM BIM Platform

**Enterprise-grade BIM management platform** con soporte multi-formato (RVT, DWG, PDF, IFC, NWC) y capacidades avanzadas de comparación y validación.

## 🏗️ Arquitectura

```text
├── api/              # Express + TypeScript backend
├── frontend/         # Next.js 14 frontend (por crear)
├── prisma/           # Database schema
├── docker/           # Docker configs
├── docs/             # Project documentation and context
└── docker-compose.yml
```

## 🚀 Quick Start

### 1. Instalar Dependencias

```bash
npm install
cd api && npm install
```

### 2. Iniciar Base de Datos

```bash
docker-compose up -d
```

### 3. Setup Prisma

```bash
npm run prisma:generate
npm run prisma:push
```

### 4. Iniciar Desarrollo

```bash
npm run dev
```

- **API**: <http://localhost:8080>
- **Frontend**: <http://localhost:3000> (próximamente)

## 📦 Features Implementadas

### Core

- ✅ PostgreSQL + Prisma ORM
- ✅ Express API con TypeScript
- ✅ Docker setup (PostgreSQL + Redis)
- ✅ Rate limiting
- ✅ Session management
- ✅ Error handling

### Por Implementar

- ⏳ APS Authentication (OAuth)
- ⏳ File upload (S3 + APS OSS)
- ⏳ Model Derivative integration
- ⏳ Design Automation workflows
- ⏳ Model comparison (RVT vs RVT)
- ⏳ PDF vs RVT comparison
- ⏳ BOM extraction
- ⏳ Next.js frontend
- ⏳ APS Viewer integration

## 🔧 Tecnologías

**Backend**:

- Node.js + TypeScript
- Express.js
- Prisma + PostgreSQL
- Bull + Redis (queues)
- APS SDK

**Frontend** (próximo):

- Next.js 14
- shadcn/ui + Tailwind
- APS Viewer SDK

**DevOps**:

- Docker + Docker Compose
- AWS S3

## 📝 Scripts Disponibles

```bash
npm run dev              # Desarrollo (API + Frontend)
npm run dev:api          # Solo API
npm run prisma:generate  # Generar Prisma client
npm run prisma:push      # Push schema a DB
npm run prisma:studio    # Abrir Prisma Studio
npm run docker:up        # Iniciar Docker
npm run docker:down      # Detener Docker
```

## 🔐 Variables de Entorno

Ver `.env` para configuración completa.

Credenciales APS ya configuradas del proyecto anterior.

## 📚 Próximos Pasos

1. ✅ Estructura base creada
2. ⏳ Implementar APS services
3. ⏳ Crear frontend NextJS
4. ⏳ Integrar Viewer
5. ⏳ Implementar comparación
6. ⏳ Testing
7. ⏳ Deployment

## 🆘 Troubleshooting

### Base de datos no conecta

```bash
docker-compose down
docker-compose up -d
npm run prisma:push
```

### Puerto 8080 en uso

Cambiar `API_PORT` en `.env`

---

**Desarrollado para Sebastian Chirino** | Versión 2.0.0
