# Guía de Instalación y Ejecución - Proyecto DOM

Este documento detalla los pasos necesarios para configurar y ejecutar el proyecto en un nuevo entorno local (por ejemplo, en la oficina).

## 1. Preparación del Entorno (Desde Terminal de VS Code)

Como ya estás dentro de Visual Studio Code, abriremos la terminal integrada para realizar todas las instalaciones.
**Abrir Terminal:** Presiona `Ctrl + ñ` (o `Ctrl + Shift + P` y escribe "Create New Terminal").

### 1.1. Verificar Herramientas Instaladas
Ejecuta estos comandos para ver si ya tienes las herramientas necesarias. Si aparecen versiones, puedes saltar al paso 2.

```powershell
node --version
git --version
docker --version
```

### 1.2. Instalar Herramientas Faltantes (Solo si es necesario)
Si alguno de los comandos anteriores dio error, intenta instalarlos usando `winget` desde la misma terminal.
*Nota: Algunos de estos pueden requerir confirmación, pero se ejecutan desde la consola.*

```powershell
# Instalar Node.js (LTS)
winget install -e --id OpenJS.NodeJS.LTS

# Instalar Git
winget install -e --id Git.Git

# Instalar Docker Desktop (Para la base de datos Redis)
winget install -e --id Docker.DockerDesktop
```
*Si acabas de instalar alguna de estas herramientas, es posible que debas cerrar y volver a abrir VS Code para que la terminal las reconozca.*

## 2. Instalación de Extensiones y Dependencias (Sin Permisos de Admin)

Estas instalaciones se realizan directamente en VS Code y **no requieren permisos de administrador**.

### 2.1. Instalar Extensiones de VS Code
Copia y pega este bloque completo en tu terminal de PowerShell para instalar todas las extensiones automáticamente:

```powershell
code --install-extension dbaeumer.vscode-eslint; `
code --install-extension esbenp.prettier-vscode; `
code --install-extension Prisma.prisma; `
code --install-extension bradlc.vscode-tailwindcss; `
code --install-extension ms-azuretools.vscode-docker
```

## 3. Configuración Inicial

### 3.1. Clonar/Copiar el Proyecto
Copia la carpeta del proyecto o clona el repositorio en tu máquina local.

### 3.2. Instalar Dependencias
Abre una terminal en la carpeta raíz del proyecto y ejecuta los siguientes comandos en orden:

```bash
# 1. Instalar dependencias de la raíz (si las hay) y preparar el entorno
npm install

# 2. Instalar dependencias del API
cd api
npm install
cd ..

# 3. Instalar dependencias del Frontend
cd frontend
npm install
cd ..
```

### 3.3. Configurar Variables de Entorno
Crea un archivo llamado `.env` en la **raíz** del proyecto y pega el siguiente contenido (asegúrate de que las credenciales de APS sean válidas):

```dotenv
# Database (SQLite para desarrollo local)
DATABASE_URL="file:./dev.db"

# Redis
REDIS_URL="redis://localhost:6379"

# APS Credentials
APS_CLIENT_ID=RIi0BvKIEfSsBad3EoRdBkTAruI7i8kUjG0l0S54Wfv3GMUi
APS_CLIENT_SECRET=TFvrMRi77n5Eptxoko9RAKYL3WEcVXRQ1nAEGddiqG0Q10BvX7iugequcahgv6sg
APS_CALLBACK_URL=http://localhost:8080/api/auth/callback
APS_BUCKET=dom-bim-platform-us-test-001

# AWS S3 (Opcional para local si no se usa S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=dom-bim-files

# Session
SESSION_SECRET=dom_session_secret_2024
NEXTAUTH_SECRET=nextauth_secret_2024
NEXTAUTH_URL=http://localhost:3000

# API
API_PORT=8080
NEXT_PUBLIC_API_URL=http://localhost:8080

# Environment
NODE_ENV=development
```

### 3.4. Iniciar Servicios Base (Redis)
El proyecto requiere Redis para la gestión de colas de procesamiento. Ejecuta esto en la terminal (asegúrate de que Docker Desktop esté corriendo):

```bash
docker-compose up -d redis
```

### 3.5. Configurar Base de Datos
Genera el cliente de Prisma y crea la base de datos SQLite local:

```bash
# Desde la raíz del proyecto
npx prisma generate
npx prisma db push
```

## 4. Ejecución del Proyecto

Para ejecutar el proyecto, necesitarás dos terminales abiertas (o usar la funcionalidad de pestañas de VS Code).

**Terminal 1: API (Backend)**
```bash
# Desde la raíz
npm run dev:api
```
*El servidor API iniciará en http://localhost:8080*

**Terminal 2: Frontend**
```bash
# Desde la raíz
npm run dev:frontend
```
*El frontend iniciará en http://localhost:3000*

## 5. Verificación
1. Abre tu navegador en `http://localhost:3000`.
2. Deberías ver la pantalla de inicio de sesión o el dashboard.

### 5.1. Generar Datos de Prueba (Opcional)
Si quieres poblar la base de datos con un proyecto de ejemplo completo (con ubicación, cliente y archivos simulados) para una demostración rápida, ejecuta este comando en una nueva terminal:

```powershell
# Desde la carpeta raíz
cd api
npx ts-node scripts/seed-demo.ts
```
*Esto creará un usuario "Demo User" y un proyecto "Torre Reforma" con datos listos para mostrar.*

---
**Nota para el Asistente AI:** Si se te pide ejecutar el proyecto, lee este archivo y sigue los pasos de la sección 4.
