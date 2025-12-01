# 📘 DOM BIM Platform - Documentación Maestra del Proyecto

**Versión del Documento:** 2.1.0 (Edición Extendida)
**Fecha de Emisión:** 1 de Diciembre, 2025
**Preparado para:** Sebastian Chirino
**Departamento:** Transformación Digital & BIM
**Clasificación:** Confidencial / Uso Interno

---

## 📋 Tabla de Contenidos Maestra

1.  [**Visión y Alcance del Proyecto**](#1-visión-y-alcance-del-proyecto)
    *   1.1 Contexto Organizacional
    *   1.2 Objetivos Estratégicos
    *   1.3 Alcance Funcional Detallado
    *   1.4 Stakeholders y Roles
2.  [**Arquitectura de Sistemas Detallada**](#2-arquitectura-de-sistemas-detallada)
    *   2.1 Diagrama de Arquitectura de Solución
    *   2.2 Patrones de Diseño Implementados
    *   2.3 Estrategia de Microservicios Monolíticos
    *   2.4 Diagrama de Secuencia: Flujo de Traducción
3.  [**Especificación Técnica del Backend**](#3-especificación-técnica-del-backend)
    *   3.1 Estructura de Directorios y Módulos
    *   3.2 Configuración y Variables de Entorno
    *   3.3 Middleware de Seguridad y Logging
    *   3.4 Servicios de Integración APS (Core)
4.  [**Referencia Completa de API REST**](#4-referencia-completa-de-api-rest)
    *   4.1 Autenticación (Auth)
    *   4.2 Gestión de Proyectos (Projects)
    *   4.3 Gestión de Archivos (Files)
    *   4.4 Integración APS (Hubs/Derivatives)
5.  [**Modelo de Datos y Persistencia**](#5-modelo-de-datos-y-persistencia)
    *   5.1 Esquema Prisma (DDL)
    *   5.2 Diccionario de Datos Extendido
    *   5.3 Relaciones y Cardinalidad
6.  [**Sistema de Diseño Frontend (Design System)**](#6-sistema-de-diseño-frontend-design-system)
    *   6.1 Paleta de Colores Corporativa (DOM)
    *   6.2 Tipografía y Escala
    *   6.3 Biblioteca de Componentes (Shadcn/UI)
    *   6.4 Arquitectura de Páginas (Next.js App Router)
7.  [**Manual de Operaciones y Despliegue (DevOps)**](#7-manual-de-operaciones-y-despliegue-devops)
    *   7.1 Requisitos de Infraestructura
    *   7.2 Contenerización con Docker
    *   7.3 Guía de Despliegue en Producción (AWS/Azure)
    *   7.4 Estrategia de Backups y Recuperación
8.  [**Seguridad y Cumplimiento**](#8-seguridad-y-cumplimiento)
    *   8.1 Autenticación OAuth 2.0
    *   8.2 Gestión de Secretos
    *   8.3 Protección de Datos en Tránsito y Reposo
9.  [**Historias de Usuario y Flujos de Trabajo**](#9-historias-de-usuario-y-flujos-de-trabajo)
    *   9.1 Flujo: Creación de Proyecto y Asignación
    *   9.2 Flujo: Revisión de Modelo 3D y Anotaciones
    *   9.3 Flujo: Comparación de Versiones (Diff Tool)
10. [**Estrategia de Pruebas (QA)**](#10-estrategia-de-pruebas-qa)
    *   10.1 Pruebas Unitarias
    *   10.2 Pruebas de Integración
11. [**Anexos y Glosario**](#11-anexos-y-glosario)

---

## 1. Visión y Alcance del Proyecto

### 1.1 Contexto Organizacional
DOM, como líder global en servicios profesionales de consultoría, ingeniería y arquitectura, maneja proyectos de alta complejidad que generan gigabytes de información BIM. Actualmente, el acceso a esta información está restringido a especialistas con licencias de software de autoría (Revit, Civil 3D).

La **DOM BIM Platform** nace de la necesidad de democratizar este acceso, permitiendo que gerentes de proyecto, clientes y contratistas visualicen y analicen modelos complejos directamente desde un navegador web, sin instalar software adicional.

### 1.2 Objetivos Estratégicos
1.  **Eficiencia Operativa**: Reducir en un 40% el tiempo dedicado a la preparación de modelos para revisión.
2.  **Transparencia**: Proveer a los clientes una ventana en tiempo real al estado del diseño.
3.  **Centralización**: Eliminar la dispersión de archivos en discos locales y correos electrónicos.
4.  **Innovación**: Implementar flujos de trabajo avanzados como la comparación geométrica automática.

### 1.3 Alcance Funcional Detallado
El sistema abarca desde la ingesta de datos hasta la visualización avanzada:

*   **Módulo de Ingesta**:
    *   Soporte para carga directa (Drag & Drop).
    *   Conector nativo con Autodesk Construction Cloud (ACC) para sincronización bidireccional.
    *   Validación automática de formatos (.rvt, .dwg, .ifc, .nwc, .pdf).

*   **Módulo de Procesamiento (Worker)**:
    *   Cola de trabajos asíncrona para traducciones pesadas.
    *   Conversión a formato SVF2 (Streaming Vector Format) para visualización web optimizada.
    *   Extracción de metadatos (Propiedades, Materiales, Niveles).

*   **Módulo de Visualización (Viewer)**:
    *   Navegación 3D orbital y en primera persona.
    *   Árbol de selección de objetos (Model Browser).
    *   Panel de propiedades paramétricas.
    *   Herramientas de medición (distancia, ángulo, área).
    *   Herramientas de sección (Planos de corte X, Y, Z, Box).

*   **Módulo de Gestión**:
    *   Dashboard de proyectos con KPIs básicos.
    *   Control de versiones de archivos.
    *   Gestión de usuarios y permisos (RBAC).

### 1.4 Stakeholders y Roles
*   **Administrador BIM**: Configura proyectos, gestiona usuarios y supervisa el uso de la API de Autodesk.
*   **Coordinador BIM**: Sube modelos, revisa la integridad de la información y genera reportes de conflictos.
*   **Gerente de Proyecto**: Visualiza el avance, revisa hitos y comparte vistas con el cliente.
*   **Cliente Externo**: Acceso de solo lectura para visualizar el estado del proyecto.

---

## 2. Arquitectura de Sistemas Detallada

### 2.1 Diagrama de Arquitectura de Solución

La solución sigue una arquitectura de **N-Capas** moderna, desacoplada y contenerizada.

```mermaid
graph TD
    subgraph "Cliente (Navegador)"
        UI[Next.js Frontend]
        Viewer[Autodesk Viewer SDK]
        UI --> Viewer
    end

    subgraph "Capa de Aplicación (Docker)"
        LB[Nginx Reverse Proxy]
        API[Node.js Express API]
        Worker[Bull Queue Worker]
        
        LB --> UI
        LB --> API
        API --> Worker
    end

    subgraph "Capa de Datos"
        DB[(PostgreSQL)]
        Cache[(Redis)]
        
        API --> DB
        Worker --> DB
        API --> Cache
        Worker --> Cache
    end

    subgraph "Autodesk Platform Services (SaaS)"
        Auth[Authentication API]
        OSS[Object Storage Service]
        MD[Model Derivative API]
        DM[Data Management API]
        
        API --> Auth
        API --> OSS
        API --> MD
        API --> DM
    end

    UI -->|HTTPS/WSS| LB
```

### 2.2 Patrones de Diseño Implementados
*   **Repository Pattern**: Abstracción de la capa de datos utilizando Prisma ORM. Permite cambiar el motor de base de datos con mínimo impacto.
*   **Adapter Pattern**: Encapsulamiento de las llamadas a la API de Autodesk en servicios dedicados (`ApsService`), permitiendo mockearlos fácilmente para pruebas.
*   **Observer Pattern**: Utilizado en el frontend para reaccionar a eventos del Visor (selección, aislamiento).
*   **Singleton**: Para la instancia del cliente de base de datos y servicios de configuración.

### 2.3 Estrategia de Microservicios Monolíticos
Aunque el despliegue es monolítico (un solo contenedor API), el código está estructurado internamente como módulos independientes (Auth, Projects, Files, APS). Esto facilita una futura migración a microservicios reales si la escala lo requiere, separando, por ejemplo, el módulo de "Traducción" en un servicio independiente que escale horizontalmente.

### 2.4 Diagrama de Secuencia: Flujo de Traducción

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB
    participant APS_OSS
    participant APS_MD

    User->>API: POST /files/upload (file)
    API->>APS_OSS: PUT /buckets/:key/objects/:name
    APS_OSS-->>API: 200 OK (objectId)
    API->>APS_MD: POST /designdata/job (urn, svf2)
    APS_MD-->>API: 200 OK (job_accepted)
    API->>DB: INSERT File (status: TRANSLATING)
    API-->>User: 200 OK (file_record)
    
    loop Polling Status
        User->>API: GET /files/:id
        API->>APS_MD: GET /designdata/:urn/manifest
        APS_MD-->>API: { status: "inprogress", progress: "50%" }
        API-->>User: { status: "TRANSLATING", progress: 50 }
    end

    Note over API, APS_MD: Cuando el progreso llega al 100%
    
    API->>APS_MD: GET /designdata/:urn/manifest
    APS_MD-->>API: { status: "success", progress: "100%" }
    API->>DB: UPDATE File (status: READY)
    API-->>User: { status: "READY" }
```

---

## 3. Especificación Técnica del Backend

### 3.1 Estructura de Directorios y Módulos
El backend se encuentra en `/api` y sigue una estructura semántica:

*   `src/index.ts`: Punto de entrada. Inicializa Express y conecta a la DB.
*   `src/app.ts`: Configuración de la aplicación (Express), middlewares globales.
*   `src/config/`:
    *   `swagger.ts`: Definición OpenAPI.
    *   `env.ts`: Validación de variables de entorno con Zod (recomendado).
*   `src/routes/`: Controladores de ruta.
    *   `auth.ts`: Endpoints de login/logout.
    *   `projects.ts`: CRUD de proyectos.
    *   `files.ts`: Gestión de archivos y subidas.
    *   `aps.ts`: Proxy para servicios de Autodesk.
*   `src/services/`: Lógica de negocio.
    *   `aps/`: Servicios específicos de Autodesk (Auth, ModelDerivative, OSS).
*   `src/lib/`: Utilidades compartidas (Prisma Client, Logger).

### 3.2 Configuración y Variables de Entorno
El sistema no arranca si faltan variables críticas.

| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `PORT` | Puerto del servidor API | `8080` |
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `APS_CLIENT_ID` | ID de aplicación Autodesk | `FuB...` |
| `APS_CLIENT_SECRET` | Secreto de aplicación | `Sec...` |
| `APS_CALLBACK_URL` | URL de retorno OAuth | `http://localhost:8080/api/auth/callback` |
| `SESSION_SECRET` | Llave de firma de cookies | `super-secret-key-min-32-chars` |

### 3.3 Middleware de Seguridad y Logging
*   **Helmet**: Configura headers HTTP seguros (HSTS, X-Frame-Options, CSP).
*   **Cors**: Controla el acceso desde el frontend (Cross-Origin Resource Sharing).
*   **Morgan**: Logging de peticiones HTTP para auditoría y depuración.
*   **Cookie-Session**: Manejo de sesiones encriptadas en el cliente (stateless backend).

### 3.4 Servicios de Integración APS (Core)
El archivo `src/services/aps/model-derivative.service.ts` es el corazón del procesamiento.

```typescript
// Ejemplo de método clave para iniciar traducción
async translateToSVF2(urn: string) {
    const token = await apsAuthService.getInternalToken();
    const job = {
        input: { urn, compressedUrn: false },
        output: {
            formats: [{
                type: 'svf2',
                views: ['2d', '3d']
            }]
        }
    };
    // Llamada a la API de Autodesk con x-ads-force para forzar re-traducción si es necesario
    return this.api.translate(job, { xAdsForce: true }, null, { access_token: token });
}
```

---

## 4. Referencia Completa de API REST

Esta sección documenta exhaustivamente los endpoints disponibles.

### 4.1 Autenticación (Auth)

#### `GET /api/auth/login`
Inicia el flujo OAuth 2.0 de 3 patas.
*   **Descripción**: Redirige al usuario a la página de login de Autodesk.
*   **Respuesta**: `302 Found` (Location: `https://developer.api.autodesk.com/authentication/v2/authorize...`)

#### `GET /api/auth/callback`
Recibe el código de autorización de Autodesk.
*   **Query Params**: `code` (string).
*   **Proceso**: Intercambia código por tokens, obtiene perfil de usuario, crea/actualiza usuario en DB, establece cookie de sesión.
*   **Respuesta**: `302 Found` (Location: `/dashboard`).

#### `GET /api/auth/token`
Obtiene un token de acceso para el Visor (Scope público).
*   **Descripción**: Usado por el frontend para inicializar el Viewer.
*   **Respuesta**:
    ```json
    {
      "access_token": "eyJ...",
      "expires_in": 3599
    }
    ```

### 4.2 Gestión de Proyectos (Projects)

#### `GET /api/projects`
Lista todos los proyectos.
*   **Respuesta**: Array de objetos `Project`.

#### `POST /api/projects`
Crea un nuevo proyecto.
*   **Body**:
    ```json
    {
      "name": "Edificio Corporativo",
      "clientName": "Acme Corp",
      "status": "Active",
      "location": "Santiago, Chile",
      "discipline": "Architecture"
    }
    ```
*   **Validación**: `name` es obligatorio.

#### `GET /api/projects/{id}`
Obtiene detalles de un proyecto y sus archivos.
*   **Lógica Adicional**: Verifica el estado de traducción de los archivos asociados en tiempo real y actualiza la DB si han terminado.

### 4.3 Gestión de Archivos (Files)

#### `POST /api/files/upload`
Sube un archivo.
*   **Content-Type**: `multipart/form-data`
*   **Form Fields**:
    *   `file`: (Binary)
    *   `projectId`: (UUID)
*   **Respuesta**: Objeto `File` creado.

#### `GET /api/files/{id}/bom`
Obtiene el Bill of Materials.
*   **Respuesta**:
    ```json
    [
      { "category": "Walls", "family": "Basic Wall", "volume": 12.5, ... },
      ...
    ]
    ```

### 4.4 Integración APS (Hubs/Derivatives)

#### `GET /api/aps/hubs`
Lista los Hubs de ACC/BIM 360 del usuario.
*   **Requiere**: Usuario autenticado con cuenta Autodesk.

#### `GET /api/aps/hubs/{hubId}/projects`
Lista los proyectos dentro de un Hub específico.

---

## 5. Modelo de Datos y Persistencia

### 5.1 Esquema Prisma (DDL)

```prisma
// Definición completa del esquema
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  apsUserId String?
  role      String   @default("USER")
  projects  Project[]
  files     File[]
}

model Project {
  id          String   @id @default(uuid())
  name        String
  status      String   @default("Active")
  clientName  String?
  files       File[]
  comparisons Comparison[]
  createdAt   DateTime @default(now())
}

model File {
  id           String   @id @default(uuid())
  name         String
  type         String   // RVT, DWG, PDF...
  apsUrn       String?  // Clave crítica para APS
  status       String   @default("UPLOADED")
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id])
  versions     FileVersion[]
}
```

### 5.2 Diccionario de Datos Extendido

*   **File.apsUrn**: Es el identificador único universal en la plataforma de Autodesk. Debe ser almacenado en formato Base64 URL-Safe (sin padding `=`). Es la llave para todas las operaciones de la API Model Derivative.
*   **Project.status**: Controla la visibilidad. `Active` (visible y editable), `Archived` (solo lectura), `Draft` (invisible para usuarios normales).

---

## 6. Sistema de Diseño Frontend (Design System)

El frontend implementa un sistema de diseño coherente basado en la identidad corporativa de DOM.

### 6.1 Paleta de Colores Corporativa (DOM)

Se utilizan variables CSS nativas definidas en `globals.css` para soportar temas Claro/Oscuro.

*   **Primary Blue**: `hsl(217, 91%, 36%)` (Modo Claro) - Azul DOM profundo.
*   **Background**: `hsl(0, 0%, 100%)` (Claro) vs `hsl(230, 35%, 7%)` (Oscuro - Navy profundo).
*   **Destructive**: `hsl(0, 84.2%, 60.2%)` - Rojo para acciones peligrosas (Borrar).

### 6.2 Tipografía y Escala
*   **Fuente Principal**: `Inter` o `Roboto` (Sans-serif moderna).
*   **H1**: 2.5rem, Bold, Tracking-tight.
*   **Body**: 1rem (16px), Regular, Leading-relaxed.

### 6.3 Biblioteca de Componentes (Shadcn/UI)
Se utilizan componentes "headless" estilizados con Tailwind:
*   **Card**: Contenedor principal con sombra suave y bordes redondeados (`rounded-lg`).
*   **Button**: Variantes `default` (azul), `outline` (borde), `ghost` (transparente).
*   **Table**: Para listados de archivos, con soporte de ordenamiento y selección.

### 6.4 Arquitectura de Páginas (Next.js App Router)
*   `/dashboard`: Layout principal con Sidebar y Header.
*   `/dashboard/projects`: Lista de proyectos (Grid).
*   `/dashboard/projects/[id]`: Detalle de proyecto (Client Component para interactividad).
*   `/dashboard/viewer/[urn]`: Página dedicada al Visor (Full screen).

---

## 7. Manual de Operaciones y Despliegue (DevOps)

### 7.1 Requisitos de Infraestructura
Para un entorno de producción capaz de soportar 50 usuarios concurrentes:
*   **Instancia EC2/VM**: t3.medium (2 vCPU, 4GB RAM).
*   **Base de Datos**: RDS PostgreSQL db.t3.micro.
*   **Almacenamiento**: No se requiere gran disco local (los modelos están en APS), solo 20GB para logs y sistema operativo.

### 7.2 Contenerización con Docker
El archivo `docker-compose.yml` orquesta los servicios.

```yaml
version: '3.8'
services:
  api:
    build: ./api
    restart: always
    environment:
      - NODE_ENV=production
    ports:
      - "8080:8080"
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
```

### 7.3 Guía de Despliegue en Producción
1.  **Build**: `docker-compose build`
2.  **Migraciones**: Ejecutar `npx prisma migrate deploy` en el contenedor de API.
3.  **SSL**: Configurar un contenedor Nginx o Traefik delante de los servicios para manejar certificados Let's Encrypt.
4.  **Healthchecks**: Configurar monitoreo en `/api/health`.

---

## 8. Seguridad y Cumplimiento

### 8.1 Autenticación OAuth 2.0
El sistema nunca almacena contraseñas de Autodesk. Solo almacena tokens de acceso temporales.
*   **Access Token**: Vida útil de 60 minutos.
*   **Refresh Token**: Vida útil de 14 días. El backend renueva automáticamente el token de acceso usando el refresh token antes de cada llamada a la API si detecta expiración.

### 8.2 Gestión de Secretos
Los secretos (`APS_CLIENT_SECRET`, `SESSION_SECRET`) **NUNCA** deben commitearse al repositorio. Deben inyectarse en tiempo de ejecución mediante variables de entorno o gestores de secretos (AWS Secrets Manager, Azure Key Vault).

### 8.3 Protección de Datos
*   **En Tránsito**: TLS 1.2 obligatorio.
*   **En Reposo**: La base de datos debe tener encriptación de disco habilitada. Los tokens en Redis pueden encriptarse si se requiere mayor seguridad.

---

## 9. Historias de Usuario y Flujos de Trabajo

### 9.1 Flujo: Creación de Proyecto y Asignación
**Actor**: Administrador BIM.
1.  El Admin inicia sesión y navega al Dashboard.
2.  Hace clic en "Nuevo Proyecto".
3.  Ingresa "Hospital Zona Norte", Cliente "Minsal", Ubicación "Antofagasta".
4.  El sistema crea el registro y redirige al detalle del proyecto vacío.
5.  El Admin sube los archivos base (.rvt) de Arquitectura y Estructura.

### 9.2 Flujo: Revisión de Modelo 3D y Anotaciones
**Actor**: Gerente de Proyecto.
1.  Ingresa al proyecto "Hospital Zona Norte".
2.  Ve que el archivo "Arquitectura.rvt" está en estado "Listo".
3.  Abre el Visor.
4.  Navega al tercer piso.
5.  Usa la herramienta de "Medición" para verificar el ancho de un pasillo.
6.  Detecta que es muy angosto. (Futuro: Crea una incidencia/issue).

### 9.3 Flujo: Comparación de Versiones (Diff Tool)
**Actor**: Coordinador BIM.
1.  Sube la versión 2 de "Estructura.rvt".
2.  El sistema procesa la versión.
3.  El Coordinador selecciona V1 y V2 y hace clic en "Comparar".
4.  El visor muestra en **Verde** los elementos nuevos, en **Rojo** los eliminados y en **Amarillo** los modificados.
5.  Genera un reporte PDF de los cambios.

---

## 10. Estrategia de Pruebas (QA)

### 10.1 Pruebas Unitarias
Se recomienda usar **Jest** para el backend.
*   **Objetivo**: Probar servicios aislados (ej: `AuthService` generando URLs correctas).
*   **Mocking**: Se deben mockear las llamadas a `axios` para no golpear la API real de Autodesk durante los tests.

### 10.2 Pruebas de Integración
Se recomienda usar **Supertest** para probar los endpoints HTTP.
*   **Flujo**: Enviar POST a `/projects`, verificar que se crea en DB en memoria (SQLite) y devuelve 200 OK.

---

## 11. Anexos y Glosario

### Anexo A: Glosario Técnico
*   **LOD (Level of Detail)**: Nivel de desarrollo de los elementos BIM.
*   **CDE (Common Data Environment)**: Entorno común de datos, la fuente única de verdad.
*   **Three.js**: Librería gráfica base sobre la que se construye el Autodesk Viewer.

### Anexo B: Referencias
*   [Documentación Oficial de Autodesk Platform Services](https://aps.autodesk.com/developer/documentation)
*   [Next.js Documentation](https://nextjs.org/docs)
*   [Prisma ORM Reference](https://www.prisma.io/docs)

---
**© 2025 Sebastian Chirino.**
*Documento generado automáticamente por el Asistente de Desarrollo DOM.*
