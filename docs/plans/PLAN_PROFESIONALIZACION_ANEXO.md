# ANEXO: HITOS 3-8 PROFESIONALIZADOS
## Complemento al Plan de Profesionalización

---

## 📁 HITO 3: SINCRONIZACIÓN Y VERSIONADO AUTOMÁTICO (Semana 3-4)
**Prioridad: ALTA** 🟡

### Arquitectura de Versionado Automático

```
┌────────────────────────────────────────┐
│  Autodesk APS (Fuente de Verdad)       │
│  - Versiones de archivos               │
│  - Metadata de cambios                 │
│  - Información de modificador          │
└──────────────┬─────────────────────────┘
               │
               │ Webhooks + Polling
               │
               ▼
┌────────────────────────────────────────┐
│  Change Detection Service               │
│  - Webhook Handler (preferido)         │
│  - Polling Fallback (cada 15 min)      │
│  - Checksum Comparison                 │
│  - Delta Detection                     │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│  Version Management Service             │
│  - Create FileVersion                  │
│  - Extract Metadata                    │
│  - Generate Changelog                  │
│  - Trigger Notifications               │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│  Comparison Queue                       │
│  - Auto-compare with previous version  │
│  - Generate diff report                │
│  - Notify stakeholders                 │
└────────────────────────────────────────┘
```

### Implementación Profesional

#### 3.1 Webhook Handler de APS
```typescript
// api/src/routes/webhooks/aps-webhooks.ts

import crypto from 'crypto';
import { Router } from 'express';
import { versionManagementService } from '../../services/version-management.service';

const router = Router();

/**
 * Endpoint para recibir webhooks de Autodesk APS
 * Documentación: https://aps.autodesk.com/en/docs/webhooks/v1/developers_guide/overview/
 */
router.post('/aps/file-version-added', async (req, res) => {
  try {
    // 1. Validar firma del webhook
    const isValid = validateWebhookSignature(
      req.body,
      req.headers['x-adsk-signature'] as string,
      process.env.APS_WEBHOOK_SECRET!
    );
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    // 2. Extraer información del evento
    const event = req.body;
    const { 
      resourceUrn, 
      projectId, 
      itemId, 
      versionId,
      userId,
      timestamp 
    } = event.payload;
    
    // 3. Procesar cambio de versión de forma asíncrona
    // No bloquear la respuesta del webhook
    processVersionChange({
      resourceUrn,
      projectId,
      itemId,
      versionId,
      userId,
      timestamp,
      source: 'WEBHOOK'
    }).catch(error => {
      console.error('Error processing version change:', error);
      // Log pero no fallar el webhook
    });
    
    // 4. Responder inmediatamente a APS (requerido < 5s)
    res.status(200).json({ 
      status: 'received',
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Valida la firma del webhook usando HMAC-SHA256
 */
function validateWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const calculatedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

/**
 * Procesa cambio de versión detectado
 */
async function processVersionChange(change: VersionChange): Promise<void> {
  // 1. Buscar archivo en base de datos
  const file = await prisma.file.findFirst({
    where: { apsItemId: change.itemId }
  });
  
  if (!file) {
    console.warn(`File not found for itemId: ${change.itemId}`);
    return;
  }
  
  // 2. Crear nueva versión
  await versionManagementService.createVersion({
    fileId: file.id,
    apsVersionId: change.versionId,
    apsUrn: change.resourceUrn,
    changeType: 'SYNC_APS',
    createdBy: change.userId,
    source: change.source
  });
  
  // 3. Notificar a usuarios con acceso
  await notifyFileUpdate(file.id, change);
  
  // 4. Programar comparación automática (si habilitado)
  if (await shouldAutoCompare(file.projectId)) {
    await queueAutoComparison(file.id);
  }
}

export default router;
```

#### 3.2 Servicio de Polling (Fallback)
```typescript
// api/src/services/aps-polling.service.ts

import cron from 'node-cron';
import { Redis } from 'ioredis';

/**
 * Servicio de polling para proyectos que no tienen webhooks configurados
 * Ejecuta cada 15 minutos para proyectos activos
 */
export class ApsPollingService {
  private redis: Redis;
  private pollingInterval = '*/15 * * * *'; // Cada 15 minutos
  
  constructor() {
    this.redis = new Redis();
  }
  
  /**
   * Inicia el servicio de polling
   */
  start(): void {
    console.log('🔄 APS Polling Service started');
    
    cron.schedule(this.pollingInterval, async () => {
      await this.pollActiveProjects();
    });
  }
  
  /**
   * Obtiene y procesa proyectos activos
   */
  private async pollActiveProjects(): Promise<void> {
    const activeProjects = await this.getActiveProjects();
    
    for (const project of activeProjects) {
      try {
        await this.checkProjectForChanges(project);
      } catch (error) {
        console.error(`Error polling project ${project.id}:`, error);
      }
    }
  }
  
  /**
   * Determina qué proyectos deben ser monitoreados
   */
  private async getActiveProjects(): Promise<Project[]> {
    // Criterios de "activo":
    // 1. Tiene apsProjectId (es de APS)
    // 2. Tuvo actividad en los últimos 7 días
    // 3. Está marcado como activo
    
    return await prisma.project.findMany({
      where: {
        status: 'Active',
        apsProjectId: { not: null },
        OR: [
          { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          { 
            files: {
              some: {
                updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              }
            }
          }
        ]
      },
      include: {
        files: {
          where: { apsItemId: { not: null } }
        }
      }
    });
  }
  
  /**
   * Verifica cambios en archivos de un proyecto
   */
  private async checkProjectForChanges(project: Project): Promise<void> {
    const lockKey = `polling:lock:${project.id}`;
    
    // Evitar polling concurrente del mismo proyecto
    const lock = await this.redis.set(lockKey, '1', 'EX', 600, 'NX');
    if (!lock) {
      console.log(`Project ${project.id} already being polled`);
      return;
    }
    
    try {
      const accessToken = await getProjectAccessToken(project.id);
      
      for (const file of project.files) {
        await this.checkFileForNewVersion(file, accessToken);
      }
      
      // Actualizar timestamp de última verificación
      await prisma.project.update({
        where: { id: project.id },
        data: {
          metadata: {
            ...project.metadata,
            lastPolledAt: new Date().toISOString()
          }
        }
      });
      
    } finally {
      await this.redis.del(lockKey);
    }
  }
  
  /**
   * Verifica si hay nueva versión de un archivo
   */
  private async checkFileForNewVersion(
    file: File,
    accessToken: string
  ): Promise<void> {
    try {
      // 1. Obtener tip version de APS
      const apsItem = await apsIntegration.getItem(file.apsItemId!, accessToken);
      const tipVersion = apsItem.relationships?.tip?.data?.id;
      
      // 2. Comparar con versión local actual
      if (tipVersion && tipVersion !== file.apsUrn) {
        console.log(`📥 New version detected for ${file.name}`);
        
        // 3. Obtener metadata de la nueva versión
        const versionDetails = await apsIntegration.getVersion(
          tipVersion,
          accessToken
        );
        
        // 4. Calcular checksum para detectar cambios reales
        const checksum = await this.calculateVersionChecksum(versionDetails);
        
        const existingVersion = await prisma.fileVersion.findFirst({
          where: { 
            fileId: file.id,
            checksum
          }
        });
        
        // 5. Solo crear versión si realmente cambió el contenido
        if (!existingVersion) {
          await versionManagementService.createVersion({
            fileId: file.id,
            apsVersionId: tipVersion,
            apsUrn: tipVersion,
            changeType: 'SYNC_APS',
            changelog: this.generateChangelog(file, versionDetails),
            checksum,
            fileSize: versionDetails.attributes.storageSize,
            createdBy: versionDetails.relationships?.user?.data?.id
          });
          
          console.log(`✅ New version created for ${file.name}`);
        }
      }
      
    } catch (error) {
      console.error(`Error checking file ${file.id}:`, error);
    }
  }
  
  /**
   * Calcula checksum de una versión para detectar cambios reales
   */
  private async calculateVersionChecksum(versionDetails: any): Promise<string> {
    const data = JSON.stringify({
      storageSize: versionDetails.attributes.storageSize,
      lastModifiedTime: versionDetails.attributes.lastModifiedTime,
      versionNumber: versionDetails.attributes.versionNumber
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Genera changelog automático basado en metadata
   */
  private generateChangelog(file: File, versionDetails: any): string {
    const changes: string[] = [];
    
    const prevSize = file.size;
    const newSize = versionDetails.attributes.storageSize;
    
    if (newSize > prevSize) {
      const increase = ((newSize - prevSize) / prevSize * 100).toFixed(1);
      changes.push(`Tamaño aumentó ${increase}%`);
    } else if (newSize < prevSize) {
      const decrease = ((prevSize - newSize) / prevSize * 100).toFixed(1);
      changes.push(`Tamaño redujo ${decrease}%`);
    }
    
    changes.push(`Versión ${versionDetails.attributes.versionNumber}`);
    changes.push(`Modificado por ${versionDetails.relationships?.user?.data?.id || 'desconocido'}`);
    
    return changes.join(' • ');
  }
}

export const apsPollingService = new ApsPollingService();

// Iniciar en server startup
// app.ts:
// apsPollingService.start();
```

#### 3.3 Servicio de Gestión de Versiones
```typescript
// api/src/services/version-management.service.ts

export class VersionManagementService {
  /**
   * Crea una nueva versión de archivo
   */
  async createVersion(data: CreateVersionData): Promise<FileVersion> {
    const {
      fileId,
      apsVersionId,
      apsUrn,
      changeType,
      changelog,
      checksum,
      fileSize,
      createdBy
    } = data;
    
    // 1. Obtener número de versión siguiente
    const versionCount = await prisma.fileVersion.count({
      where: { fileId }
    });
    
    const newVersionNumber = versionCount + 1;
    
    // 2. Crear versión
    const version = await prisma.fileVersion.create({
      data: {
        fileId,
        version: newVersionNumber,
        apsUrn,
        apsVersionId,
        changeType,
        changelog,
        checksum,
        fileSize,
        createdBy
      }
    });
    
    // 3. Actualizar archivo con nueva versión
    await prisma.file.update({
      where: { id: fileId },
      data: {
        apsUrn,
        size: fileSize || undefined,
        updatedAt: new Date()
      }
    });
    
    // 4. Crear notificación para usuarios del proyecto
    await this.notifyNewVersion(fileId, version);
    
    // 5. Registrar en log de auditoría
    await prisma.activityLog.create({
      data: {
        userId: createdBy || 'system',
        fileId,
        action: 'FILE_VERSION_CREATED',
        details: JSON.stringify({
          versionNumber: newVersionNumber,
          changeType,
          changelog
        })
      }
    });
    
    return version;
  }
  
  /**
   * Notifica a usuarios sobre nueva versión
   */
  private async notifyNewVersion(
    fileId: string,
    version: FileVersion
  ): Promise<void> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        project: {
          include: {
            ProjectMember: {
              where: { status: 'ACCEPTED' },
              include: { user: true }
            }
          }
        }
      }
    });
    
    if (!file) return;
    
    // Crear notificación para cada miembro del proyecto
    for (const member of file.project.ProjectMember) {
      await prisma.notification.create({
        data: {
          userId: member.userId,
          type: 'FILE_CHANGED',
          title: 'Nueva versión disponible',
          message: `El archivo "${file.name}" tiene una nueva versión (v${version.version})`,
          priority: 'NORMAL',
          fileId,
          projectId: file.projectId,
          metadata: JSON.stringify({
            versionNumber: version.version,
            changelog: version.changelog
          })
        }
      });
    }
  }
  
  /**
   * Obtiene historial de versiones con diff
   */
  async getVersionHistory(fileId: string): Promise<VersionHistoryItem[]> {
    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { version: 'desc' }
    });
    
    const history: VersionHistoryItem[] = [];
    
    for (let i = 0; i < versions.length; i++) {
      const current = versions[i];
      const previous = versions[i + 1];
      
      const item: VersionHistoryItem = {
        ...current,
        diff: previous ? {
          sizeChange: current.fileSize - previous.fileSize,
          timeDiff: current.createdAt.getTime() - previous.createdAt.getTime()
        } : null
      };
      
      history.push(item);
    }
    
    return history;
  }
}

export const versionManagementService = new VersionManagementService();
```

#### 3.4 Configuración de Webhooks (Script de Setup)
```typescript
// api/scripts/setup-aps-webhooks.ts

/**
 * Script para configurar webhooks de APS
 * Ejecutar: npx ts-node scripts/setup-aps-webhooks.ts
 */

async function setupWebhooks() {
  const webhookUrl = `${process.env.PUBLIC_API_URL}/webhooks/aps/file-version-added`;
  
  console.log('🔧 Configurando webhooks de APS...');
  console.log(`Webhook URL: ${webhookUrl}`);
  
  try {
    // Obtener access token de 2-legged (app-level)
    const accessToken = await getAppAccessToken();
    
    // Crear webhook para eventos de versiones
    const webhook = await createWebhook({
      callbackUrl: webhookUrl,
      scope: {
        project: '*', // Todos los proyectos
      },
      hookAttribute: {
        hookEvent: 'dm.version.added',
        filter: '$[?(@.data.attributes.extension.type=='versions:autodesk.core:File')]'
      }
    }, accessToken);
    
    console.log('✅ Webhook creado exitosamente');
    console.log(`Webhook ID: ${webhook.hookId}`);
    
    // Guardar webhook ID en base de datos
    await prisma.systemConfig.upsert({
      where: { key: 'aps_webhook_id' },
      create: {
        key: 'aps_webhook_id',
        value: webhook.hookId
      },
      update: {
        value: webhook.hookId
      }
    });
    
    console.log('✅ Configuración completa');
    
  } catch (error) {
    console.error('❌ Error configurando webhooks:', error);
    process.exit(1);
  }
}

setupWebhooks();
```

**Entregables Hito 3:**
- [ ] Webhook handler con validación de firma
- [ ] Servicio de polling con cron jobs
- [ ] Version management service completo
- [ ] Cálculo de checksums para detectar cambios reales
- [ ] Changelog automático
- [ ] Notificaciones de nuevas versiones
- [ ] UI de historial de versiones con timeline
- [ ] Script de setup de webhooks
- [ ] Comparación automática entre versiones
- [ ] Tests de sincronización
- [ ] Documentación de webhooks y polling

---

## ✅ HITO 4: VALIDACIÓN DE FORMATOS (CONTINUACIÓN PROFESIONAL)

[Contenido ya está bien profesionalizado en el documento principal]

**Mejoras adicionales:**

#### 4.A Validación con Magic Numbers
```typescript
// api/src/lib/file-validator.ts

import { FileType, fromBuffer } from 'file-type';

/**
 * Validador profesional de archivos
 * No confía solo en extensiones, verifica magic numbers
 */
export class FileValidator {
  /**
   * Valida archivo usando magic numbers (más seguro que extensión)
   */
  async validateFile(buffer: Buffer, filename: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: false,
      errors: [],
      warnings: [],
      metadata: {}
    };
    
    // 1. Detectar tipo real del archivo
    const fileType = await fromBuffer(buffer);
    const declaredExt = path.extname(filename).toLowerCase();
    
    // 2. Verificar que extensión coincida con contenido
    if (fileType && fileType.ext !== declaredExt.substring(1)) {
      result.errors.push({
        code: 'EXTENSION_MISMATCH',
        message: `El archivo dice ser ${declaredExt} pero su contenido es ${fileType.ext}`,
        severity: 'HIGH'
      });
      return result;
    }
    
    // 3. Verificar si el tipo está permitido
    const category = getFileCategory(declaredExt);
    if (!category) {
      result.errors.push({
        code: 'UNSUPPORTED_FORMAT',
        message: `Formato ${declaredExt} no soportado`,
        allowedFormats: getAllowedExtensions()
      });
      return result;
    }
    
    // 4. Verificar tamaño máximo
    const maxSize = FILE_FORMATS[category].maxSize;
    if (buffer.length > maxSize) {
      result.errors.push({
        code: 'FILE_TOO_LARGE',
        message: `Archivo demasiado grande: ${formatBytes(buffer.length)} (máximo: ${formatBytes(maxSize)})`,
        severity: 'HIGH'
      });
      return result;
    }
    
    // 5. Validaciones específicas por formato
    const formatValidation = await this.validateByFormat(buffer, category);
    if (!formatValidation.valid) {
      result.errors.push(...formatValidation.errors);
      return result;
    }
    
    result.valid = true;
    result.metadata = {
      detectedType: fileType?.mime || 'unknown',
      size: buffer.length,
      category
    };
    
    return result;
  }
  
  /**
   * Validaciones específicas por tipo de archivo
   */
  private async validateByFormat(
    buffer: Buffer,
    category: string
  ): Promise<Partial<ValidationResult>> {
    switch (category) {
      case 'PDF':
        return this.validatePDF(buffer);
      case 'ENGINEERING_TABLES':
        return this.validateSpreadsheet(buffer);
      case 'MODELS_3D':
        return this.validate3DModel(buffer);
      default:
        return { valid: true, errors: [] };
    }
  }
  
  private async validatePDF(buffer: Buffer): Promise<Partial<ValidationResult>> {
    // Verificar que sea realmente un PDF
    const header = buffer.toString('utf-8', 0, 5);
    if (header !== '%PDF-') {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_PDF',
          message: 'El archivo no es un PDF válido'
        }]
      };
    }
    
    // Verificar que no esté corrupto
    const footer = buffer.toString('utf-8', buffer.length - 7, buffer.length);
    if (!footer.includes('%%EOF')) {
      return {
        valid: false,
        errors: [{
          code: 'CORRUPTED_PDF',
          message: 'El PDF parece estar corrupto'
        }]
      };
    }
    
    return { valid: true, errors: [] };
  }
  
  private async validateSpreadsheet(buffer: Buffer): Promise<Partial<ValidationResult>> {
    try {
      // Intentar parsear como Excel/CSV
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      if (workbook.SheetNames.length === 0) {
        return {
          valid: false,
          errors: [{
            code: 'EMPTY_SPREADSHEET',
            message: 'El archivo no contiene hojas de cálculo'
          }]
        };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_SPREADSHEET',
          message: 'No se pudo leer el archivo como hoja de cálculo'
        }]
      };
    }
  }
  
  private async validate3DModel(buffer: Buffer): Promise<Partial<ValidationResult>> {
    // Para RVT, verificar magic number específico de Revit
    const revitMagic = buffer.toString('hex', 0, 4);
    if (revitMagic === 'D0CF11E0') { // OLE2/CFB magic number (usado por Revit)
      return { valid: true, errors: [] };
    }
    
    // Para IFC, verificar header
    const ifcHeader = buffer.toString('utf-8', 0, 10);
    if (ifcHeader.includes('ISO-10303')) {
      return { valid: true, errors: [] };
    }
    
    // Warning si no se puede verificar específicamente
    return {
      valid: true,
      warnings: [{
        code: 'UNVERIFIED_FORMAT',
        message: 'No se pudo verificar la integridad del modelo 3D'
      }]
    };
  }
}

export const fileValidator = new FileValidator();
```

---

## 🔍 HITO 5: VALIDACIÓN ESTRUCTURAL ROBUSTA (Semana 5-6)
**Prioridad: CRÍTICA** 🔴

### Arquitectura de Validación en Profundidad

```
┌──────────────────────────────────────────────────┐
│  Upload File (IFC/RVT/PDF)                        │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  Queue Job (Bull)                                 │
│  - Priority: NORMAL                               │
│  - Timeout: 30 min                                │
│  - Retry: 3 attempts                              │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  Validation Worker                                │
│  ┌────────────────────────────────────────────┐  │
│  │ 1. Extract Model Properties (IFC Parser)   │  │
│  │ 2. Parse Engineering Tables (XLSX/CSV)     │  │
│  │ 3. Deep Comparison Engine                  │  │
│  │ 4. Generate Discrepancy Report             │  │
│  └────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  Validation Result                                │
│  - Pass/Fail Status                               │
│  - Discrepancies List                             │
│  - Confidence Score                               │
│  - Processing Time                                │
└──────────────────────────────────────────────────┘
```

### Implementación Profesional

#### 5.1 Bull Queue Configuration
```typescript
// api/src/queues/validation.queue.ts

import Bull from 'bull';
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

/**
 * Cola de validación para procesamiento pesado
 */
export const validationQueue = new Bull('validation', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Mantener últimos 100 jobs completados
    removeOnFail: 200, // Mantener últimos 200 jobs fallidos
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // 5s, 25s, 125s
    },
    timeout: 1800000 // 30 minutos máximo
  }
});

/**
 * Processor para jobs de validación
 */
validationQueue.process('structure-validation', 5, async (job) => {
  const { fileId, modelFileUrn, tableFileUrn, options } = job.data;
  
  try {
    // 1. Actualizar progreso: Descargando archivos
    await job.progress(10);
    const modelData = await downloadAndExtractModel(modelFileUrn);
    
    await job.progress(30);
    const tableData = await downloadAndParseTable(tableFileUrn);
    
    // 2. Actualizar progreso: Validando
    await job.progress(50);
    const validation = await deepValidationEngine.validate({
      model: modelData,
      table: tableData,
      options
    });
    
    // 3. Actualizar progreso: Generando reporte
    await job.progress(80);
    const report = await generateValidationReport(validation);
    
    // 4. Guardar resultados
    await job.progress(95);
    await saveValidationResults(fileId, report);
    
    await job.progress(100);
    
    return {
      success: true,
      fileId,
      report,
      processingTime: Date.now() - job.timestamp
    };
    
  } catch (error) {
    console.error(`Validation job ${job.id} failed:`, error);
    throw error; // Bull retry automático
  }
});

/**
 * Event listeners para monitoreo
 */
validationQueue.on('completed', (job, result) => {
  console.log(`✅ Validation ${job.id} completed in ${result.processingTime}ms`);
  
  // Enviar notificación al usuario
  notifyValidationComplete(job.data.userId, result);
});

validationQueue.on('failed', (job, error) => {
  console.error(`❌ Validation ${job.id} failed:`, error.message);
  
  // Notificar fallo al usuario
  notifyValidationFailed(job.data.userId, {
    fileId: job.data.fileId,
    error: error.message,
    attempt: job.attemptsMade
  });
});

validationQueue.on('progress', (job, progress) => {
  // Emit WebSocket event para actualizar UI en tiempo real
  wsServer.to(`validation:${job.data.fileId}`).emit('validation:progress', {
    jobId: job.id,
    progress,
    status: getProgressStatus(progress)
  });
});

function getProgressStatus(progress: number): string {
  if (progress < 20) return 'Descargando archivos...';
  if (progress < 40) return 'Extrayendo datos del modelo...';
  if (progress < 70) return 'Procesando tabla de ingeniería...';
  if (progress < 90) return 'Validando estructura...';
  return 'Generando reporte...';
}
```

#### 5.2 IFC Parser (Extracción de Propiedades)
```typescript
// api/src/services/ifc-parser.service.ts

import { IfcAPI } from 'web-ifc';
import fs from 'fs/promises';

/**
 * Parser profesional de archivos IFC
 * Extrae propiedades estructurales para validación
 */
export class IFCParserService {
  private ifcApi: IfcAPI;
  
  constructor() {
    this.ifcApi = new IfcAPI();
  }
  
  /**
   * Extrae elementos estructurales del modelo IFC
   */
  async extractStructuralElements(filePath: string): Promise<StructuralElements> {
    const modelID = await this.openModel(filePath);
    
    try {
      const elements: StructuralElements = {
        beams: [],
        columns: [],
        slabs: [],
        walls: [],
        foundations: [],
        metadata: {}
      };
      
      // 1. Extraer vigas (IfcBeam)
      const beams = this.ifcApi.GetLineIDsWithType(modelID, IFCBEAM);
      for (const beamID of beams) {
        const beam = await this.extractElement(modelID, beamID, 'BEAM');
        elements.beams.push(beam);
      }
      
      // 2. Extraer columnas (IfcColumn)
      const columns = this.ifcApi.GetLineIDsWithType(modelID, IFCCOLUMN);
      for (const columnID of columns) {
        const column = await this.extractElement(modelID, columnID, 'COLUMN');
        elements.columns.push(column);
      }
      
      // 3. Extraer losas (IfcSlab)
      const slabs = this.ifcApi.GetLineIDsWithType(modelID, IFCSLAB);
      for (const slabID of slabs) {
        const slab = await this.extractElement(modelID, slabID, 'SLAB');
        elements.slabs.push(slab);
      }
      
      // 4. Extraer muros (IfcWall)
      const walls = this.ifcApi.GetLineIDsWithType(modelID, IFCWALL);
      for (const wallID of walls) {
        const wall = await this.extractElement(modelID, wallID, 'WALL');
        elements.walls.push(wall);
      }
      
      // 5. Metadata del proyecto
      elements.metadata = await this.extractProjectMetadata(modelID);
      
      console.log(`📊 Extracted ${elements.beams.length} beams, ${elements.columns.length} columns`);
      
      return elements;
      
    } finally {
      this.ifcApi.CloseModel(modelID);
    }
  }
  
  /**
   * Extrae propiedades de un elemento específico
   */
  private async extractElement(
    modelID: number,
    elementID: number,
    type: ElementType
  ): Promise<StructuralElement> {
    const rawElement = this.ifcApi.GetLine(modelID, elementID);
    
    // Obtener todas las propiedades (PropertySets)
    const properties = await this.getElementProperties(modelID, elementID);
    
    // Extraer geometría básica
    const geometry = await this.getElementGeometry(modelID, elementID);
    
    return {
      id: elementID,
      type,
      globalId: rawElement.GlobalId?.value || `UNKNOWN_${elementID}`,
      name: rawElement.Name?.value || 'Sin nombre',
      tag: rawElement.Tag?.value || '',
      properties: {
        // Propiedades estructurales críticas
        material: properties['Material'] || properties['Structural Material'] || 'N/A',
        loadBearing: properties['LoadBearing'] === 'TRUE',
        fireRating: properties['FireRating'] || 'N/A',
        
        // Dimensiones
        length: this.parseNumber(properties['Length']) || geometry.length,
        width: this.parseNumber(properties['Width']) || geometry.width,
        height: this.parseNumber(properties['Height']) || geometry.height,
        thickness: this.parseNumber(properties['Thickness']),
        
        // Propiedades mecánicas
        reinforcement: properties['Reinforcement'] || 'N/A',
        concreteGrade: properties['ConcreteGrade'] || properties['Concrete Grade'],
        steelGrade: properties['SteelGrade'] || properties['Steel Grade'],
        
        // Ubicación
        level: properties['Level'] || properties['Reference Level'] || 'N/A',
        grid: properties['Grid'] || 'N/A'
      },
      quantity: {
        volume: geometry.volume,
        area: geometry.area,
        weight: this.calculateWeight(geometry.volume, properties['Material'])
      },
      raw: properties // Todas las propiedades sin procesar
    };
  }
  
  /**
   * Obtiene todas las propiedades de un elemento
   */
  private async getElementProperties(
    modelID: number,
    elementID: number
  ): Promise<Record<string, any>> {
    const properties: Record<string, any> = {};
    
    // Obtener PropertySets
    const propertysets = this.ifcApi.GetLineIDsWithType(modelID, IFCPROPERTYSET);
    
    for (const psetID of propertysets) {
      const pset = this.ifcApi.GetLine(modelID, psetID);
      
      // Verificar si este PropertySet pertenece al elemento
      const relatedElements = this.getRelatedElements(modelID, psetID);
      if (!relatedElements.includes(elementID)) continue;
      
      // Extraer propiedades individuales
      if (pset.HasProperties) {
        for (const propHandle of pset.HasProperties) {
          const prop = this.ifcApi.GetLine(modelID, propHandle.value);
          
          if (prop.Name && prop.NominalValue) {
            const propName = prop.Name.value;
            const propValue = this.extractValue(prop.NominalValue);
            properties[propName] = propValue;
          }
        }
      }
    }
    
    return properties;
  }
  
  /**
   * Calcula geometría básica del elemento
   */
  private async getElementGeometry(
    modelID: number,
    elementID: number
  ): Promise<Geometry> {
    const geometry = this.ifcApi.GetGeometry(modelID, elementID);
    
    if (!geometry) {
      return {
        length: 0,
        width: 0,
        height: 0,
        volume: 0,
        area: 0
      };
    }
    
    // Calcular bounding box
    const verts = geometry.GetVertexData();
    const bounds = this.calculateBoundingBox(verts);
    
    return {
      length: bounds.max.x - bounds.min.x,
      width: bounds.max.y - bounds.min.y,
      height: bounds.max.z - bounds.min.z,
      volume: this.calculateVolume(geometry),
      area: this.calculateArea(geometry)
    };
  }
  
  /**
   * Calcula peso estimado basado en volumen y material
   */
  private calculateWeight(volume: number, material: string): number {
    // Densidades típicas (kg/m³)
    const densities: Record<string, number> = {
      'concrete': 2400,
      'steel': 7850,
      'wood': 600,
      'brick': 1800,
      'default': 2000
    };
    
    const materialLower = material.toLowerCase();
    const density = Object.keys(densities).find(key => 
      materialLower.includes(key)
    ) || 'default';
    
    return volume * densities[density];
  }
  
  private parseNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }
}

export const ifcParser = new IFCParserService();
```

#### 5.3 Engineering Table Parser
```typescript
// api/src/services/table-parser.service.ts

import XLSX from 'xlsx';
import { parse as parseCSV } from 'csv-parse/sync';

/**
 * Parser de tablas de ingeniería (Excel/CSV)
 * Identifica y extrae cuadros de elementos estructurales
 */
export class TableParserService {
  /**
   * Parse tabla con detección automática de formato
   */
  async parseTable(filePath: string): Promise<EngineeringTable> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return await this.parseCSV(filePath);
    } else {
      return await this.parseExcel(filePath);
    }
  }
  
  /**
   * Parse archivo Excel
   */
  private async parseExcel(filePath: string): Promise<EngineeringTable> {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Buscar hoja con elementos estructurales
    const sheetName = this.findStructuralSheet(workbook);
    if (!sheetName) {
      throw new Error('No se encontró hoja con elementos estructurales');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    return this.parseStructuredData(rawData as any[][]);
  }
  
  /**
   * Parse archivo CSV
   */
  private async parseCSV(filePath: string): Promise<EngineeringTable> {
    const content = await fs.readFile(filePath, 'utf-8');
    const rawData = parseCSV(content, {
      skip_empty_lines: true,
      trim: true
    });
    
    return this.parseStructuredData(rawData);
  }
  
  /**
   * Busca hoja que contenga elementos estructurales
   */
  private findStructuralSheet(workbook: XLSX.WorkBook): string | null {
    const keywords = [
      'element', 'column', 'beam', 'slab', 'wall',
      'columna', 'viga', 'losa', 'muro',
      'structural', 'structure', 'cuantia'
    ];
    
    for (const sheetName of workbook.SheetNames) {
      const lowerName = sheetName.toLowerCase();
      if (keywords.some(kw => lowerName.includes(kw))) {
        return sheetName;
      }
    }
    
    // Si no encuentra, usar primera hoja
    return workbook.SheetNames[0] || null;
  }
  
  /**
   * Parse datos estructurados y detecta columnas
   */
  private parseStructuredData(rawData: any[][]): EngineeringTable {
    if (rawData.length === 0) {
      throw new Error('Tabla vacía');
    }
    
    // 1. Detectar fila de encabezados
    const headerRowIndex = this.detectHeaderRow(rawData);
    const headers = rawData[headerRowIndex].map(h => 
      String(h || '').trim().toLowerCase()
    );
    
    // 2. Mapear columnas a campos conocidos
    const columnMap = this.mapColumns(headers);
    
    // 3. Parse filas de datos
    const elements: TableElement[] = [];
    
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      
      // Skip filas vacías
      if (row.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }
      
      try {
        const element = this.parseRow(row, columnMap);
        elements.push(element);
      } catch (error) {
        console.warn(`Error parsing row ${i}:`, error);
        // Continuar con siguiente fila
      }
    }
    
    console.log(`📋 Parsed ${elements.length} elements from table`);
    
    return {
      elements,
      metadata: {
        totalRows: rawData.length,
        headerRow: headerRowIndex,
        columnMap,
        parsedRows: elements.length
      }
    };
  }
  
  /**
   * Detecta fila de encabezados (busca palabras clave)
   */
  private detectHeaderRow(data: any[][]): number {
    const headerKeywords = [
      'id', 'element', 'type', 'mark', 'tag',
      'dimension', 'length', 'width', 'height',
      'material', 'grade', 'level', 'grid'
    ];
    
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i].map(cell => 
        String(cell || '').toLowerCase()
      );
      
      const matches = row.filter(cell =>
        headerKeywords.some(kw => cell.includes(kw))
      );
      
      // Si encuentra al menos 3 keywords, es probable header
      if (matches.length >= 3) {
        return i;
      }
    }
    
    return 0; // Default primera fila
  }
  
  /**
   * Mapea columnas a campos conocidos usando fuzzy matching
   */
  private mapColumns(headers: string[]): ColumnMap {
    const map: ColumnMap = {};
    
    const fieldPatterns: Record<string, string[]> = {
      id: ['id', 'mark', 'tag', 'elemento', 'element'],
      type: ['type', 'tipo', 'category', 'categoria'],
      length: ['length', 'largo', 'longitud', 'l'],
      width: ['width', 'ancho', 'b', 'w'],
      height: ['height', 'alto', 'altura', 'h'],
      thickness: ['thickness', 'espesor', 't', 'e'],
      material: ['material', 'mat'],
      concreteGrade: ['concrete', 'concreto', 'f\'c', 'fc', 'resistencia'],
      steelGrade: ['steel', 'acero', 'fy', 'reinforcement'],
      level: ['level', 'nivel', 'floor', 'piso'],
      grid: ['grid', 'eje', 'axis']
    };
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      
      for (const [field, patterns] of Object.entries(fieldPatterns)) {
        if (patterns.some(pattern => header.includes(pattern))) {
          map[field] = i;
          break;
        }
      }
    }
    
    console.log('Column mapping:', map);
    return map;
  }
  
  /**
   * Parse fila individual
   */
  private parseRow(row: any[], columnMap: ColumnMap): TableElement {
    const get = (field: string) => {
      const index = columnMap[field];
      return index !== undefined ? row[index] : undefined;
    };
    
    const parseNum = (value: any): number | undefined => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Remover unidades comunes
        const cleaned = value.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    };
    
    return {
      id: String(get('id') || '').trim(),
      type: String(get('type') || 'UNKNOWN').trim().toUpperCase(),
      dimensions: {
        length: parseNum(get('length')),
        width: parseNum(get('width')),
        height: parseNum(get('height')),
        thickness: parseNum(get('thickness'))
      },
      material: {
        concrete: String(get('concreteGrade') || '').trim(),
        steel: String(get('steelGrade') || '').trim(),
        general: String(get('material') || '').trim()
      },
      location: {
        level: String(get('level') || '').trim(),
        grid: String(get('grid') || '').trim()
      },
      raw: row // Datos completos para debugging
    };
  }
}

export const tableParser = new TableParserService();
```

#### 5.4 Deep Validation Engine
```typescript
// api/src/services/deep-validation.service.ts

/**
 * Motor de validación profunda
 * Compara modelo 3D con tabla de ingeniería
 */
export class DeepValidationEngine {
  private tolerance = {
    dimension: 0.05, // 5% tolerancia en dimensiones
    quantity: 0.02,  // 2% tolerancia en cantidades
    weight: 0.1      // 10% tolerancia en peso
  };
  
  /**
   * Valida estructura completa
   */
  async validate(data: ValidationInput): Promise<ValidationResult> {
    const { model, table, options } = data;
    
    // Aplicar tolerancias personalizadas si existen
    if (options?.tolerance) {
      this.tolerance = { ...this.tolerance, ...options.tolerance };
    }
    
    const startTime = Date.now();
    
    // 1. Normalizar IDs para matching
    const normalizedModel = this.normalizeModelElements(model);
    const normalizedTable = this.normalizeTableElements(table);
    
    // 2. Hacer matching de elementos
    const matches = await this.matchElements(normalizedModel, normalizedTable);
    
    // 3. Validar cada match
    const discrepancies: Discrepancy[] = [];
    
    for (const match of matches) {
      const elementDiscrepancies = await this.validateElement(
        match.modelElement,
        match.tableElement
      );
      
      if (elementDiscrepancies.length > 0) {
        discrepancies.push(...elementDiscrepancies);
      }
    }
    
    // 4. Detectar elementos faltantes/sobrantes
    const missing = this.findMissingElements(matches, normalizedTable);
    const extra = this.findExtraElements(matches, normalizedModel);
    
    // 5. Calcular score de confianza
    const confidenceScore = this.calculateConfidenceScore({
      totalElements: table.elements.length,
      matched: matches.length,
      discrepancies: discrepancies.length,
      missing: missing.length,
      extra: extra.length
    });
    
    const processingTime = Date.now() - startTime;
    
    return {
      valid: discrepancies.length === 0 && missing.length === 0 && extra.length === 0,
      confidenceScore,
      summary: {
        totalTableElements: table.elements.length,
        totalModelElements: model.beams.length + model.columns.length + model.slabs.length + model.walls.length,
        matched: matches.length,
        discrepancies: discrepancies.length,
        missing: missing.length,
        extra: extra.length
      },
      discrepancies,
      missing,
      extra,
      processingTime,
      timestamp: new Date()
    };
  }
  
  /**
   * Hace matching de elementos entre modelo y tabla
   */
  private async matchElements(
    modelElements: NormalizedElement[],
    tableElements: NormalizedElement[]
  ): Promise<ElementMatch[]> {
    const matches: ElementMatch[] = [];
    
    for (const tableEl of tableElements) {
      // Buscar mejor match en modelo
      let bestMatch: { element: NormalizedElement; score: number } | null = null;
      
      for (const modelEl of modelElements) {
        const score = this.calculateMatchScore(tableEl, modelEl);
        
        if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { element: modelEl, score };
        }
      }
      
      if (bestMatch) {
        matches.push({
          tableElement: tableEl,
          modelElement: bestMatch.element,
          matchScore: bestMatch.score
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Calcula score de matching entre dos elementos
   */
  private calculateMatchScore(
    el1: NormalizedElement,
    el2: NormalizedElement
  ): number {
    let score = 0;
    let factors = 0;
    
    // 1. Tipo de elemento (crítico)
    if (el1.type === el2.type) {
      score += 0.4;
    } else {
      return 0; // Tipos diferentes, no match
    }
    factors++;
    
    // 2. ID/Tag (muy importante)
    if (el1.id && el2.id) {
      const idSimilarity = this.stringSimilarity(el1.id, el2.id);
      score += idSimilarity * 0.3;
      factors++;
    }
    
    // 3. Dimensiones (importante)
    if (el1.dimensions && el2.dimensions) {
      const dimScore = this.compareDimensions(el1.dimensions, el2.dimensions);
      score += dimScore * 0.2;
      factors++;
    }
    
    // 4. Ubicación (nivel/grid)
    if (el1.location && el2.location) {
      if (el1.location.level === el2.location.level) score += 0.05;
      if (el1.location.grid === el2.location.grid) score += 0.05;
      factors++;
    }
    
    return score / factors;
  }
  
  /**
   * Valida un elemento individual
   */
  private async validateElement(
    modelEl: NormalizedElement,
    tableEl: NormalizedElement
  ): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    // 1. Validar dimensiones
    if (modelEl.dimensions && tableEl.dimensions) {
      const dimDiscrepancies = this.validateDimensions(
        modelEl.dimensions,
        tableEl.dimensions,
        modelEl.id
      );
      discrepancies.push(...dimDiscrepancies);
    }
    
    // 2. Validar materiales
    if (modelEl.material && tableEl.material) {
      const matDiscrepancies = this.validateMaterials(
        modelEl.material,
        tableEl.material,
        modelEl.id
      );
      discrepancies.push(...matDiscrepancies);
    }
    
    // 3. Validar propiedades estructurales
    if (modelEl.properties && tableEl.properties) {
      const propDiscrepancies = this.validateProperties(
        modelEl.properties,
        tableEl.properties,
        modelEl.id
      );
      discrepancies.push(...propDiscrepancies);
    }
    
    return discrepancies;
  }
  
  /**
   * Valida dimensiones con tolerancia
   */
  private validateDimensions(
    modelDim: Dimensions,
    tableDim: Dimensions,
    elementId: string
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    
    const checkDimension = (
      name: string,
      modelValue?: number,
      tableValue?: number
    ) => {
      if (modelValue && tableValue) {
        const diff = Math.abs(modelValue - tableValue);
        const tolerance = tableValue * this.tolerance.dimension;
        
        if (diff > tolerance) {
          const percentDiff = (diff / tableValue * 100).toFixed(1);
          
          discrepancies.push({
            elementId,
            field: name,
            severity: diff > tolerance * 2 ? 'HIGH' : 'MEDIUM',
            modelValue: `${modelValue.toFixed(2)}m`,
            tableValue: `${tableValue.toFixed(2)}m`,
            difference: `${percentDiff}%`,
            message: `${name} differs by ${percentDiff}% (tolerance: ${(this.tolerance.dimension * 100).toFixed(0)}%)`
          });
        }
      }
    };
    
    checkDimension('Length', modelDim.length, tableDim.length);
    checkDimension('Width', modelDim.width, tableDim.width);
    checkDimension('Height', modelDim.height, tableDim.height);
    checkDimension('Thickness', modelDim.thickness, tableDim.thickness);
    
    return discrepancies;
  }
  
  /**
   * Calcula score de confianza del análisis
   */
  private calculateConfidenceScore(stats: ValidationStats): number {
    const {
      totalElements,
      matched,
      discrepancies,
      missing,
      extra
    } = stats;
    
    // Score base por matching
    const matchScore = matched / totalElements;
    
    // Penalizar por discrepancias
    const discrepancyPenalty = (discrepancies / totalElements) * 0.5;
    
    // Penalizar por elementos faltantes/extra
    const missingPenalty = (missing / totalElements) * 0.7;
    const extraPenalty = (extra / totalElements) * 0.3;
    
    const score = Math.max(0, 
      matchScore - discrepancyPenalty - missingPenalty - extraPenalty
    );
    
    return Math.round(score * 100) / 100; // 2 decimales
  }
  
  /**
   * Similitud entre strings (Levenshtein distance)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export const deepValidationEngine = new DeepValidationEngine();
```

**Entregables Hito 5:**
- [ ] Bull queue para procesamiento asíncrono
- [ ] IFC Parser con web-ifc library
- [ ] Table Parser con detección automática de formato
- [ ] Deep Validation Engine con tolerancias configurables
- [ ] Matching algorithm con fuzzy logic
- [ ] Confidence score calculation
- [ ] Real-time progress tracking con WebSockets
- [ ] Detailed discrepancy reports
- [ ] UI con visualización de discrepancias resaltadas
- [ ] Export de reportes a PDF/Excel
- [ ] Tests con datasets de prueba
- [ ] Performance benchmarks (target: <30s para 1000 elementos)

**Estimación:** 70-90 horas

---

## 🎨 HITO 6: MEJORAS DE UX/UI (Semana 6-7)
**Prioridad: MEDIA** 🟡

### Sistema de Diseño Profesional

```typescript
// frontend/lib/design-system.ts

/**
 * Design tokens - Sistema de diseño centralizado
 * Evita hardcoding de colores y valores
 */
export const designTokens = {
  colors: {
    // Semantic colors
    primary: {
      50: 'hsl(222, 89%, 95%)',
      100: 'hsl(222, 89%, 90%)',
      500: 'hsl(222, 89%, 50%)',
      600: 'hsl(222, 89%, 45%)',
      900: 'hsl(222, 89%, 20%)'
    },
    success: {
      50: 'hsl(142, 76%, 95%)',
      500: 'hsl(142, 76%, 36%)',
      900: 'hsl(142, 76%, 20%)'
    },
    error: {
      50: 'hsl(0, 84%, 95%)',
      500: 'hsl(0, 84%, 60%)',
      900: 'hsl(0, 84%, 30%)'
    },
    warning: {
      50: 'hsl(45, 93%, 95%)',
      500: 'hsl(45, 93%, 47%)',
      900: 'hsl(45, 93%, 25%)'
    },
    
    // Neutral colors with proper contrast
    neutral: {
      0: 'hsl(0, 0%, 100%)',      // white
      50: 'hsl(210, 20%, 98%)',    // ultra light gray
      100: 'hsl(210, 20%, 95%)',   // very light gray
      200: 'hsl(210, 16%, 93%)',   // light gray
      300: 'hsl(210, 14%, 89%)',   // gray
      400: 'hsl(210, 14%, 83%)',   // medium gray
      500: 'hsl(210, 11%, 71%)',   // dark gray
      600: 'hsl(210, 9%, 55%)',    // darker gray
      700: 'hsl(210, 10%, 40%)',   // very dark gray
      800: 'hsl(210, 11%, 25%)',   // almost black
      900: 'hsl(210, 12%, 16%)',   // near black
      950: 'hsl(210, 15%, 10%)'    // black
    },
    
    // Background colors optimized for light/dark mode
    background: {
      light: {
        primary: 'hsl(0, 0%, 100%)',
        secondary: 'hsl(210, 20%, 98%)',
        tertiary: 'hsl(210, 20%, 95%)'
      },
      dark: {
        primary: 'hsl(210, 12%, 16%)',
        secondary: 'hsl(210, 11%, 21%)',
        tertiary: 'hsl(210, 11%, 25%)'
      }
    },
    
    // Text colors with WCAG AA contrast
    text: {
      light: {
        primary: 'hsl(210, 12%, 16%)',    // 14.5:1 contrast
        secondary: 'hsl(210, 10%, 40%)',  // 7.2:1 contrast
        tertiary: 'hsl(210, 11%, 55%)',   // 4.8:1 contrast
        disabled: 'hsl(210, 14%, 83%)'    // decorative only
      },
      dark: {
        primary: 'hsl(0, 0%, 100%)',      // 21:1 contrast
        secondary: 'hsl(210, 20%, 80%)',  // 11.3:1 contrast
        tertiary: 'hsl(210, 20%, 65%)',   // 6.5:1 contrast
        disabled: 'hsl(210, 10%, 40%)'    // decorative only
      }
    }
  },
  
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem'    // 64px
  },
  
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: 'JetBrains Mono, monospace'
    },
    fontSize: {
      xs: '0.75rem',     // 12px
      sm: '0.875rem',    // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem'   // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    }
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px'
  },
  
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

/**
 * Toast notification system con animaciones
 */
export const toast = {
  success: (message: string) => {
    // Implementación con react-hot-toast o custom
    showToast({
      type: 'success',
      message,
      icon: '✅',
      duration: 4000
    });
  },
  
  error: (message: string) => {
    showToast({
      type: 'error',
      message,
      icon: '❌',
      duration: 6000
    });
  },
  
  loading: (message: string) => {
    return showToast({
      type: 'loading',
      message,
      icon: '⏳',
      duration: Infinity // Manual dismiss
    });
  },
  
  promise: async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    const toastId = toast.loading(messages.loading);
    
    try {
      const data = await promise;
      dismissToast(toastId);
      toast.success(
        typeof messages.success === 'function' 
          ? messages.success(data) 
          : messages.success
      );
      return data;
    } catch (error) {
      dismissToast(toastId);
      toast.error(
        typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error
      );
      throw error;
    }
  }
};
```

#### 6.1 Loading States Component
```typescript
// frontend/components/ui/loading-states.tsx

/**
 * Skeleton loader para prevenir layout shift
 */
export function ProjectSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6" />
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Spinner component with sizes
 */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  return (
    <div
      className={`${sizeClasses[size]} border-4 border-neutral-200 border-t-primary-500 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Progress bar con porcentaje
 */
export function ProgressBar({ 
  value, 
  max = 100,
  label,
  showPercentage = true 
}: ProgressBarProps) {
  const percentage = (value / max) * 100;
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </span>
          {showPercentage && (
            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div 
        className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5 overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="bg-primary-500 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Loading overlay para acciones
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
        <Spinner size="lg" />
        {message && (
          <p className="text-neutral-700 dark:text-neutral-300 text-center max-w-xs">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
```

#### 6.2 Feedback System
```typescript
// frontend/components/ui/feedback.tsx

/**
 * Sistema de feedback para acciones del usuario
 */
export function ActionFeedback() {
  const { action, isLoading } = useActionState();
  
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed bottom-4 right-4 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-4 flex items-center gap-3 z-50"
        >
          <Spinner size="sm" />
          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              {action.title}
            </p>
            {action.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {action.description}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Empty states informativos
 */
export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        {title}
      </h3>
      <p className="text-neutral-600 dark:text-neutral-400 text-center max-w-sm mb-6">
        {description}
      </p>
      {action && action}
    </div>
  );
}

/**
 * Confirmation dialog con animación
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" /> : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 6.3 Accessibility (WCAG 2.1 AA)
```typescript
// frontend/components/ui/accessible-button.tsx

/**
 * Button accesible con estados claros
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'default',
    size = 'md',
    isLoading = false,
    disabled = false,
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          
          // Variant styles
          variants[variant],
          
          // Size styles
          sizes[size]
        )}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && <Spinner size="sm" className="mr-2" />}
        {children}
      </button>
    );
  }
);

const variants = {
  default: 'bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500',
  destructive: 'bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500',
  outline: 'border-2 border-neutral-300 hover:bg-neutral-100 focus-visible:ring-neutral-500',
  ghost: 'hover:bg-neutral-100 focus-visible:ring-neutral-500'
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-13 px-7 text-lg'
};

/**
 * Form field accesible con validación
 */
export function FormField({
  label,
  error,
  hint,
  required,
  children
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  
  return (
    <div className="space-y-2">
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
      >
        {label}
        {required && (
          <span className="text-error-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': cn(
          error && errorId,
          hint && hintId
        ),
        'aria-required': required
      })}
      
      {hint && !error && (
        <p id={hintId} className="text-sm text-neutral-600 dark:text-neutral-400">
          {hint}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-sm text-error-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

**Entregables Hito 6:**
- [ ] Design tokens system completo
- [ ] WCAG 2.1 AA compliance (contraste 4.5:1)
- [ ] Skeleton loaders para todos los estados de carga
- [ ] Toast notification system
- [ ] Loading overlays y spinners
- [ ] Progress bars con feedback
- [ ] Empty states informativos
- [ ] Confirmation dialogs animados
- [ ] Accessible components (ARIA labels)
- [ ] Focus management (keyboard navigation)
- [ ] Dark mode optimization
- [ ] Responsive design (mobile-first)
- [ ] Performance optimization (lazy loading)
- [ ] Visual regression tests

**Estimación:** 50-65 horas

---

---

## 📊 HITO 7: MONITOREO Y LOGGING (Semana 7-8)
**Prioridad: MEDIA** 🟢

### Arquitectura de Observabilidad

```
┌─────────────────────────────────────────────────┐
│  Application (API + Frontend)                   │
│  - Log events                                   │
│  - Performance metrics                          │
│  - Error tracking                               │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Winston Logger (Structured Logging)            │
│  - File transport (logs/app.log)                │
│  - Error transport (logs/error.log)             │
│  - Console transport (development)              │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Activity Log Service                           │
│  - User actions                                 │
│  - File operations                              │
│  - Permission changes                           │
│  - System events                                │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Dashboard / Analytics                          │
│  - Activity timeline                            │
│  - Error rate graphs                            │
│  - User behavior patterns                       │
│  - System health metrics                        │
└─────────────────────────────────────────────────┘
```

### Implementación Profesional

#### 7.1 Winston Logger Configuration
```typescript
// api/src/lib/logger.ts

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

/**
 * Logger profesional con rotación de archivos
 */
const logsDir = path.join(__dirname, '../../logs');

const formats = {
  // Formato para archivos (JSON para fácil parsing)
  file: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata(),
    winston.format.json()
  ),
  
  // Formato para consola (legible para desarrollo)
  console: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      
      // Agregar metadata si existe
      if (Object.keys(meta).length > 0) {
        msg += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return msg;
    })
  )
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'proyecto-dom-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Transport para logs generales con rotación diaria
    new DailyRotateFile({
      filename: path.join(logsDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Mantener 30 días
      maxSize: '20m',  // Rotar cuando alcance 20MB
      format: formats.file,
      level: 'info'
    }),
    
    // Transport para errores (separado para alertas)
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d', // Mantener errores por 90 días
      maxSize: '20m',
      format: formats.file,
      level: 'error'
    }),
    
    // Transport para consola (solo en desarrollo)
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: formats.console
      })
    ] : [])
  ],
  
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d'
    })
  ],
  
  // Manejar rechazos de promesas
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d'
    })
  ]
});

/**
 * Helper para logging estructurado
 */
export const log = {
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },
  
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },
  
  error: (message: string, error?: Error | any, meta?: any) => {
    logger.error(message, {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
  },
  
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
  
  // Logging específico para acciones de usuario
  userAction: (userId: string, action: string, details?: any) => {
    logger.info(`User action: ${action}`, {
      category: 'user-action',
      userId,
      action,
      details
    });
  },
  
  // Logging específico para operaciones de archivo
  fileOperation: (fileId: string, operation: string, details?: any) => {
    logger.info(`File operation: ${operation}`, {
      category: 'file-operation',
      fileId,
      operation,
      details
    });
  },
  
  // Logging de performance
  performance: (operation: string, duration: number, metadata?: any) => {
    logger.info(`Performance: ${operation}`, {
      category: 'performance',
      operation,
      duration,
      ...metadata
    });
  },
  
  // Logging de integraciones externas
  externalService: (service: string, operation: string, success: boolean, details?: any) => {
    const level = success ? 'info' : 'warn';
    logger[level](`External service: ${service} - ${operation}`, {
      category: 'external-service',
      service,
      operation,
      success,
      details
    });
  }
};

export default logger;
```

#### 7.2 Activity Log Service
```typescript
// api/src/services/activity-log.service.ts

/**
 * Servicio de registro de actividad de usuarios
 * Para auditoría y compliance
 */
export class ActivityLogService {
  /**
   * Registra acción de usuario
   */
  async logAction(data: LogActionData): Promise<void> {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent
    } = data;
    
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action,
          resourceType,
          resourceId,
          details: JSON.stringify(details),
          ipAddress,
          userAgent,
          timestamp: new Date()
        }
      });
      
      // También log en Winston para búsqueda de texto
      log.userAction(userId, action, {
        resourceType,
        resourceId,
        details
      });
      
    } catch (error) {
      log.error('Failed to create activity log', error);
      // No fallar la request principal si falla el logging
    }
  }
  
  /**
   * Obtiene timeline de actividad de un proyecto
   */
  async getProjectTimeline(
    projectId: string,
    options?: TimelineOptions
  ): Promise<ActivityLog[]> {
    const {
      limit = 50,
      offset = 0,
      userId,
      actions,
      startDate,
      endDate
    } = options || {};
    
    return await prisma.activityLog.findMany({
      where: {
        OR: [
          { resourceType: 'PROJECT', resourceId: projectId },
          {
            resourceType: 'FILE',
            resourceId: {
              in: await this.getProjectFileIds(projectId)
            }
          }
        ],
        ...(userId && { userId }),
        ...(actions && { action: { in: actions } }),
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }
  
  /**
   * Obtiene actividad de un usuario
   */
  async getUserActivity(
    userId: string,
    options?: ActivityOptions
  ): Promise<UserActivitySummary> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
      endDate = new Date()
    } = options || {};
    
    // Obtener logs del período
    const logs = await prisma.activityLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { timestamp: 'desc' }
    });
    
    // Agrupar por acción
    const actionCounts = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Recursos más accedidos
    const resourceCounts = logs.reduce((acc, log) => {
      if (log.resourceId) {
        const key = `${log.resourceType}:${log.resourceId}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topResources = Object.entries(resourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, count]) => {
        const [type, id] = key.split(':');
        return { type, id, count };
      });
    
    return {
      totalActions: logs.length,
      actionBreakdown: actionCounts,
      topResources,
      firstActivity: logs[logs.length - 1]?.timestamp,
      lastActivity: logs[0]?.timestamp,
      averageActionsPerDay: logs.length / Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    };
  }
  
  /**
   * Detecta comportamiento sospechoso
   */
  async detectSuspiciousActivity(userId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    
    // 1. Acceso desde múltiples IPs en corto tiempo
    const recentLogs = await prisma.activityLog.findMany({
      where: {
        userId,
        timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Última hora
      },
      select: { ipAddress: true, timestamp: true }
    });
    
    const uniqueIPs = new Set(recentLogs.map(log => log.ipAddress));
    if (uniqueIPs.size > 3) {
      alerts.push({
        type: 'MULTIPLE_IPS',
        severity: 'MEDIUM',
        message: `Acceso desde ${uniqueIPs.size} IPs diferentes en la última hora`,
        details: { ips: Array.from(uniqueIPs) }
      });
    }
    
    // 2. Tasa de acciones inusualmente alta
    const last5MinutesLogs = await prisma.activityLog.count({
      where: {
        userId,
        timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) }
      }
    });
    
    if (last5MinutesLogs > 100) {
      alerts.push({
        type: 'HIGH_ACTIVITY_RATE',
        severity: 'HIGH',
        message: `${last5MinutesLogs} acciones en los últimos 5 minutos (posible bot)`,
        details: { actionCount: last5MinutesLogs }
      });
    }
    
    // 3. Intentos de acceso a recursos no autorizados
    const unauthorizedAttempts = await prisma.activityLog.count({
      where: {
        userId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
    
    if (unauthorizedAttempts > 5) {
      alerts.push({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        message: `${unauthorizedAttempts} intentos de acceso no autorizado en las últimas 24 horas`,
        details: { attempts: unauthorizedAttempts }
      });
    }
    
    return alerts;
  }
}

export const activityLogService = new ActivityLogService();
```

#### 7.3 Express Middleware para Logging Automático
```typescript
// api/src/middleware/activity-logger.middleware.ts

/**
 * Middleware que registra automáticamente todas las acciones
 */
export function activityLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Guardar timestamp de inicio
  const startTime = Date.now();
  
  // Capturar la response original
  const originalJson = res.json.bind(res);
  
  res.json = function (body: any) {
    // Calcular duración
    const duration = Date.now() - startTime;
    
    // Log performance si es lento
    if (duration > 1000) {
      log.performance(`Slow endpoint: ${req.method} ${req.path}`, duration, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });
    }
    
    // Si fue exitoso y es acción relevante, registrar
    if (res.statusCode < 400 && shouldLogAction(req)) {
      const action = deriveAction(req);
      const resourceType = deriveResourceType(req);
      const resourceId = extractResourceId(req);
      
      if (action && req.user) {
        activityLogService.logAction({
          userId: req.user.id,
          action,
          resourceType,
          resourceId,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode,
            duration
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }).catch(error => {
          log.error('Activity logging failed', error);
        });
      }
    }
    
    // Llamar al método original
    return originalJson(body);
  };
  
  next();
}

/**
 * Determina si la acción debe ser registrada
 */
function shouldLogAction(req: Request): boolean {
  // No log de health checks, assets, etc.
  const ignorePaths = ['/health', '/metrics', '/favicon.ico'];
  
  if (ignorePaths.some(path => req.path.includes(path))) {
    return false;
  }
  
  // Solo log de métodos que modifican data
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
}

/**
 * Deriva la acción del request
 */
function deriveAction(req: Request): string {
  const method = req.method;
  const path = req.path;
  
  // Mapeo de rutas a acciones
  const actionMap: Record<string, string> = {
    'POST /api/projects': 'PROJECT_CREATED',
    'PUT /api/projects/:id': 'PROJECT_UPDATED',
    'DELETE /api/projects/:id': 'PROJECT_DELETED',
    'POST /api/files': 'FILE_UPLOADED',
    'DELETE /api/files/:id': 'FILE_DELETED',
    'POST /api/projects/:id/members': 'MEMBER_ADDED',
    'DELETE /api/projects/:id/members/:userId': 'MEMBER_REMOVED',
    'POST /api/conversions': 'CONVERSION_STARTED',
    'POST /api/comparisons': 'COMPARISON_STARTED'
  };
  
  // Buscar match
  for (const [pattern, action] of Object.entries(actionMap)) {
    const [patternMethod, patternPath] = pattern.split(' ');
    
    if (method === patternMethod && matchPath(path, patternPath)) {
      return action;
    }
  }
  
  return `${method}_${path.split('/')[2]?.toUpperCase() || 'UNKNOWN'}`;
}
```

#### 7.4 Dashboard de Actividad (Frontend)
```typescript
// frontend/components/dashboard/activity-dashboard.tsx

export function ActivityDashboard() {
  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity-summary'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/activity-summary');
      return res.json();
    },
    refetchInterval: 60000 // Actualizar cada minuto
  });
  
  if (isLoading) return <DashboardSkeleton />;
  
  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Usuarios Activos"
          value={activity.activeUsers}
          change={activity.activeUsersChange}
          icon={<Users />}
        />
        <MetricCard
          title="Archivos Procesados"
          value={activity.filesProcessed}
          change={activity.filesProcessedChange}
          icon={<FileUp />}
        />
        <MetricCard
          title="Validaciones"
          value={activity.validationsRun}
          change={activity.validationsChange}
          icon={<CheckCircle />}
        />
        <MetricCard
          title="Tasa de Error"
          value={`${activity.errorRate}%`}
          change={activity.errorRateChange}
          icon={<AlertCircle />}
          variant="error"
        />
      </div>
      
      {/* Gráfica de actividad */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad por Día</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityChart data={activity.dailyActivity} />
        </CardContent>
      </Card>
      
      {/* Timeline de eventos recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline events={activity.recentEvents} />
        </CardContent>
      </Card>
      
      {/* Alertas de seguridad */}
      {activity.securityAlerts.length > 0 && (
        <Card className="border-error-500">
          <CardHeader>
            <CardTitle className="text-error-500">
              Alertas de Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SecurityAlertsList alerts={activity.securityAlerts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Entregables Hito 7:**
- [ ] Winston logger con rotación de archivos
- [ ] Structured logging (JSON format)
- [ ] Activity log service para auditoría
- [ ] Middleware de logging automático
- [ ] Security alert detection
- [ ] Performance monitoring
- [ ] Dashboard de actividad en tiempo real
- [ ] Gráficas de métricas con Chart.js/Recharts
- [ ] Export de logs para análisis
- [ ] Retention policies (30/90 días)
- [ ] Error rate tracking
- [ ] Integration con Sentry (opcional)

**Estimación:** 30-40 horas

---

## 📚 HITO 8: DOCUMENTACIÓN Y TESTS FINALES (Semana 8)
**Prioridad: ALTA** 🔴

#### 8.1 Documentación Técnica
```markdown
# docs/API.md

## API Documentation

### Authentication
All endpoints (except `/auth/*`) require a valid JWT token in the Authorization header.

```
Authorization: Bearer <token>
```

### Endpoints

#### Projects

**GET /api/projects**
Obtiene lista de proyectos del usuario autenticado.

Query parameters:
- `status` (optional): Filter by status (Active/Archived)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

Response:
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "status": "Active",
      "createdAt": "2024-01-01T00:00:00Z",
      "filesCount": 10,
      "role": "OWNER"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

[... resto de la documentación ...]
```

#### 8.2 README Profesional
```markdown
# Proyecto DOM - Sistema de Gestión de Modelos BIM

Sistema profesional para gestión, validación y comparación de modelos BIM (Revit, IFC) integrado con Autodesk Platform Services.

## 🚀 Características

- **Gestión de Proyectos**: Sistema RBAC con 3 niveles de permisos
- **Integración APS**: Sincronización bidireccional con Autodesk
- **Validación Estructural**: Comparación profunda entre modelos 3D y tablas de ingeniería
- **Versionado Automático**: Detección de cambios con webhooks y polling
- **Visualización 3D**: Viewer de APS embebido
- **Monitoreo**: Sistema completo de logs y auditoría

## 📋 Requisitos

- Node.js >= 18.x
- PostgreSQL >= 14 (producción) o SQLite (desarrollo)
- Redis >= 7.x
- Cuenta de Autodesk Platform Services

## 🛠️ Instalación

### 1. Clonar repositorio
```bash
git clone https://github.com/your-org/proyecto-dom.git
cd proyecto-dom
```

### 2. Instalar dependencias
```bash
# API
cd api
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurar variables de entorno
```bash
# api/.env
DATABASE_URL="postgresql://user:password@localhost:5432/proyecto_dom"
REDIS_URL="redis://localhost:6379"
APS_CLIENT_ID="your_client_id"
APS_CLIENT_SECRET="your_client_secret"
APS_CALLBACK_URL="http://localhost:8080/api/auth/callback"
JWT_SECRET="your_jwt_secret"
LOG_LEVEL="info"

# frontend/.env.local
NEXT_PUBLIC_API_URL=""
```

### 4. Migrar base de datos
```bash
cd api
npx prisma migrate dev
npx prisma db seed
```

### 5. Iniciar servicios
```bash
# Terminal 1: API
cd api
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Queue Worker
cd api
npm run worker
```

Acceder a: http://localhost:3000

## 📖 Documentación

- [API Documentation](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [RBAC System](docs/RBAC.md)
- [APS Integration](docs/APS_INTEGRATION.md)
- [Validation Engine](docs/VALIDATION.md)

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📊 Monitoreo

Logs disponibles en `api/logs/`:
- `app-YYYY-MM-DD.log`: Logs generales
- `error-YYYY-MM-DD.log`: Solo errores
- `exceptions-YYYY-MM-DD.log`: Excepciones no capturadas

Dashboard de actividad: http://localhost:3000/dashboard/activity

## 🚀 Deployment

Ver [DEPLOYMENT.md](docs/DEPLOYMENT.md) para instrucciones de producción.

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE)
```

**Entregables Hito 8:**
- [ ] API documentation completa (OpenAPI/Swagger)
- [ ] README profesional con badges
- [ ] Architecture diagrams actualizados
- [ ] Deployment guide
- [ ] Contributing guidelines
- [ ] Changelog automático
- [ ] Code comments y JSDoc
- [ ] Onboarding guide para nuevos devs
- [ ] Video tutorials (opcional)

**Estimación:** 20-30 horas

---

## 🧪 PLAN COMPREHENSIVO DE TESTING

### Estrategia de Testing por Capas

```
┌─────────────────────────────────────────────────┐
│  E2E Tests (Playwright)                         │
│  - User flows completos                         │
│  - Cross-browser testing                        │
│  - Visual regression testing                    │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│  Integration Tests (Jest + Supertest)           │
│  - API endpoints con DB real                    │
│  - APS integration mocks                        │
│  - Queue processing                             │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│  Unit Tests (Jest/Vitest)                       │
│  - Services individuales                        │
│  - Utilities y helpers                          │
│  - React components                             │
└─────────────────────────────────────────────────┘
```

### 1. Unit Tests (70% Coverage Target)

```typescript
// api/src/services/__tests__/authorization.service.test.ts

describe('AuthorizationService', () => {
  describe('hasPermission', () => {
    it('should allow OWNER to delete project', async () => {
      const user = createMockUser({ role: 'OWNER' });
      const project = createMockProject();
      
      const result = await authService.hasPermission(
        user.id,
        'PROJECT_DELETE',
        project.id
      );
      
      expect(result).toBe(true);
    });
    
    it('should deny VIEWER from editing files', async () => {
      const user = createMockUser({ role: 'VIEWER' });
      const file = createMockFile();
      
      const result = await authService.hasPermission(
        user.id,
        'FILE_EDIT',
        file.projectId
      );
      
      expect(result).toBe(false);
    });
    
    it('should check custom roles correctly', async () => {
      const customRole = createMockCustomRole({
        permissions: ['FILE_VIEW', 'FILE_DOWNLOAD']
      });
      const user = createMockUser({ customRoleId: customRole.id });
      
      const canView = await authService.hasPermission(
        user.id,
        'FILE_VIEW',
        'project-id'
      );
      
      const canEdit = await authService.hasPermission(
        user.id,
        'FILE_EDIT',
        'project-id'
      );
      
      expect(canView).toBe(true);
      expect(canEdit).toBe(false);
    });
  });
  
  describe('requirePermission middleware', () => {
    it('should allow request with valid permission', async () => {
      const req = createMockRequest({ user: { id: 'user-1', role: 'OWNER' } });
      const res = createMockResponse();
      const next = jest.fn();
      
      const middleware = authService.requirePermission('PROJECT_VIEW');
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should deny request without permission', async () => {
      const req = createMockRequest({ user: { id: 'user-1', role: 'VIEWER' } });
      const res = createMockResponse();
      const next = jest.fn();
      
      const middleware = authService.requirePermission('PROJECT_DELETE');
      
      await middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

// api/src/services/__tests__/deep-validation.service.test.ts

describe('DeepValidationEngine', () => {
  it('should match elements correctly', async () => {
    const modelElements = [
      { id: 'C1', type: 'COLUMN', dimensions: { width: 0.3, height: 0.3 } }
    ];
    
    const tableElements = [
      { id: 'C1', type: 'COLUMN', dimensions: { width: 0.3, height: 0.3 } }
    ];
    
    const result = await validationEngine.validate({
      model: { columns: modelElements },
      table: { elements: tableElements }
    });
    
    expect(result.matched).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });
  
  it('should detect dimension discrepancies within tolerance', async () => {
    const modelElements = [
      { id: 'B1', type: 'BEAM', dimensions: { length: 5.02 } }
    ];
    
    const tableElements = [
      { id: 'B1', type: 'BEAM', dimensions: { length: 5.00 } }
    ];
    
    const result = await validationEngine.validate({
      model: { beams: modelElements },
      table: { elements: tableElements },
      options: { tolerance: { dimension: 0.05 } } // 5%
    });
    
    // 5.02 vs 5.00 = 0.4% difference, dentro de tolerancia
    expect(result.discrepancies).toHaveLength(0);
  });
  
  it('should flag dimension discrepancies outside tolerance', async () => {
    const modelElements = [
      { id: 'B1', type: 'BEAM', dimensions: { length: 5.30 } }
    ];
    
    const tableElements = [
      { id: 'B1', type: 'BEAM', dimensions: { length: 5.00 } }
    ];
    
    const result = await validationEngine.validate({
      model: { beams: modelElements },
      table: { elements: tableElements },
      options: { tolerance: { dimension: 0.05 } }
    });
    
    // 5.30 vs 5.00 = 6% difference, fuera de tolerancia
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].field).toBe('length');
    expect(result.discrepancies[0].severity).toBe('MEDIUM');
  });
});

// frontend/lib/__tests__/permissions.test.ts

describe('usePermissions hook', () => {
  it('should return correct permissions for user role', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createMockAuthProvider({ role: 'PROJECT_MANAGER' })
    });
    
    expect(result.current.can('PROJECT_CREATE')).toBe(true);
    expect(result.current.can('ORG_MANAGE_MEMBERS')).toBe(false);
  });
  
  it('should update permissions when role changes', () => {
    const { result, rerender } = renderHook(() => usePermissions(), {
      wrapper: createMockAuthProvider({ role: 'VIEWER' })
    });
    
    expect(result.current.can('FILE_EDIT')).toBe(false);
    
    // Cambiar rol
    rerender({ wrapper: createMockAuthProvider({ role: 'EDITOR' }) });
    
    expect(result.current.can('FILE_EDIT')).toBe(true);
  });
});
```

### 2. Integration Tests (50% Coverage Target)

```typescript
// api/src/__tests__/integration/projects.test.ts

describe('Projects API Integration', () => {
  let server: Express;
  let authToken: string;
  
  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    server = await createTestServer();
    
    // Create test user and get token
    const user = await createTestUser();
    authToken = await generateTestToken(user.id);
  });
  
  afterAll(async () => {
    await teardownTestDatabase();
  });
  
  describe('POST /api/projects', () => {
    it('should create project successfully', async () => {
      const response = await request(server)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Integration test project'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Project',
        status: 'Active'
      });
      
      // Verify in database
      const project = await prisma.project.findUnique({
        where: { id: response.body.id }
      });
      
      expect(project).toBeTruthy();
      expect(project?.name).toBe('Test Project');
    });
    
    it('should fail without authentication', async () => {
      const response = await request(server)
        .post('/api/projects')
        .send({ name: 'Test' });
      
      expect(response.status).toBe(401);
    });
    
    it('should validate required fields', async () => {
      const response = await request(server)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });
  });
  
  describe('GET /api/projects/:id', () => {
    it('should return project with files', async () => {
      const project = await createTestProject({ ownerId: 'user-1' });
      await createTestFile({ projectId: project.id });
      
      const response = await request(server)
        .get(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
    });
    
    it('should deny access to unauthorized project', async () => {
      const otherUserProject = await createTestProject({ ownerId: 'other-user' });
      
      const response = await request(server)
        .get(`/api/projects/${otherUserProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(403);
    });
  });
});

// api/src/__tests__/integration/validation-queue.test.ts

describe('Validation Queue Integration', () => {
  beforeEach(async () => {
    await validationQueue.empty(); // Limpiar cola
  });
  
  it('should process validation job successfully', async () => {
    const file = await createTestFile();
    const modelUrn = 'test-urn';
    const tableUrn = 'test-table-urn';
    
    // Mock APS responses
    mockApsDownload(modelUrn, getMockIFCData());
    mockApsDownload(tableUrn, getMockTableData());
    
    // Agregar job a cola
    const job = await validationQueue.add('structure-validation', {
      fileId: file.id,
      modelFileUrn: modelUrn,
      tableFileUrn: tableUrn
    });
    
    // Esperar que complete (max 30s)
    const result = await job.finished();
    
    expect(result.success).toBe(true);
    expect(result.report.valid).toBe(true);
    
    // Verificar que se guardó en DB
    const savedValidation = await prisma.validation.findFirst({
      where: { fileId: file.id }
    });
    
    expect(savedValidation).toBeTruthy();
    expect(savedValidation?.status).toBe('COMPLETED');
  }, 35000); // 35s timeout
  
  it('should retry failed jobs', async () => {
    const file = await createTestFile();
    
    // Mock que falla 2 veces, éxito en tercera
    let attempts = 0;
    mockApsDownload('test-urn', () => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return getMockIFCData();
    });
    
    const job = await validationQueue.add('structure-validation', {
      fileId: file.id,
      modelFileUrn: 'test-urn',
      tableFileUrn: 'table-urn'
    });
    
    const result = await job.finished();
    
    expect(attempts).toBe(3);
    expect(result.success).toBe(true);
  }, 60000);
});
```

### 3. E2E Tests (Critical Flows)

```typescript
// e2e/tests/project-creation-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Project Creation Flow', () => {
  test('should create project and upload file', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    
    // 2. Create project
    await page.click('text=Nuevo Proyecto');
    await page.fill('[name="name"]', 'E2E Test Project');
    await page.fill('[name="description"]', 'Created by E2E test');
    await page.click('button:has-text("Crear")');
    
    // Wait for creation and redirect
    await page.waitForURL(/\/projects\/[a-f0-9-]+/);
    
    // Verify project page
    await expect(page.locator('h1')).toContainText('E2E Test Project');
    
    // 3. Upload file
    await page.click('text=Subir Archivo');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-files/sample.ifc');
    
    await page.fill('[name="fileName"]', 'Test Model');
    await page.selectOption('[name="fileType"]', 'IFC');
    await page.click('button:has-text("Subir")');
    
    // Wait for upload to complete
    await expect(page.locator('.toast-success')).toContainText('Archivo subido exitosamente');
    
    // Verify file appears in list
    await expect(page.locator('text=Test Model')).toBeVisible();
    
    // 4. Verify 3D viewer loads
    await page.click('text=Test Model');
    await page.waitForSelector('#forge-viewer', { timeout: 10000 });
    
    const viewerFrame = page.frameLocator('#forge-viewer');
    await expect(viewerFrame.locator('canvas')).toBeVisible();
  });
  
  test('should validate project permissions', async ({ page, context }) => {
    // Login as owner
    await loginAs(page, 'owner@example.com');
    
    const project = await createTestProject();
    await page.goto(`/projects/${project.id}`);
    
    // Owner should see all options
    await expect(page.locator('button:has-text("Eliminar Proyecto")')).toBeVisible();
    await expect(page.locator('button:has-text("Configuración")')).toBeVisible();
    
    // Add viewer member
    await addProjectMember(page, 'viewer@example.com', 'VIEWER');
    
    // Open new tab as viewer
    const viewerPage = await context.newPage();
    await loginAs(viewerPage, 'viewer@example.com');
    await viewerPage.goto(`/projects/${project.id}`);
    
    // Viewer should NOT see delete button
    await expect(viewerPage.locator('button:has-text("Eliminar Proyecto")')).not.toBeVisible();
    
    // Viewer should NOT be able to upload files
    await expect(viewerPage.locator('button:has-text("Subir Archivo")')).toBeDisabled();
  });
});

// e2e/tests/validation-flow.spec.ts

test.describe('Structure Validation Flow', () => {
  test('should run validation and show results', async ({ page }) => {
    await loginAs(page, 'engineer@example.com');
    
    const project = await createTestProjectWithFiles();
    await page.goto(`/projects/${project.id}/validate`);
    
    // Select model file
    await page.selectOption('[name="modelFile"]', 'model.ifc');
    
    // Select table file
    await page.selectOption('[name="tableFile"]', 'elements.xlsx');
    
    // Configure tolerance
    await page.fill('[name="dimensionTolerance"]', '5');
    
    // Start validation
    await page.click('button:has-text("Iniciar Validación")');
    
    // Wait for progress bar
    await expect(page.locator('.progress-bar')).toBeVisible();
    
    // Wait for completion (may take 30s+)
    await expect(page.locator('.validation-result'), { timeout: 45000 })
      .toBeVisible();
    
    // Check results
    const status = await page.locator('.validation-status').textContent();
    expect(['PASSED', 'FAILED']).toContain(status);
    
    // If failed, discrepancies should be shown
    if (status === 'FAILED') {
      await expect(page.locator('.discrepancy-item')).toHaveCount.greaterThan(0);
      
      // Click on first discrepancy
      await page.click('.discrepancy-item:first-child');
      
      // Should highlight in 3D viewer
      await page.waitForTimeout(1000);
      
      // Export report
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Exportar Reporte")');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/validation-report.*\.pdf/);
    }
  });
});
```

### 4. Performance Tests

```typescript
// api/src/__tests__/performance/validation.benchmark.ts

import Benchmark from 'benchmark';

describe('Validation Performance Benchmarks', () => {
  it('should validate 1000 elements in < 30 seconds', async () => {
    const modelElements = generateMockElements(1000);
    const tableElements = generateMockElements(1000);
    
    const startTime = Date.now();
    
    const result = await validationEngine.validate({
      model: { columns: modelElements },
      table: { elements: tableElements }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`Validation of 1000 elements took ${duration}ms`);
    
    expect(duration).toBeLessThan(30000); // 30 seconds
    expect(result).toBeDefined();
  }, 35000);
  
  it('should handle large IFC files efficiently', async () => {
    const largeIFCBuffer = await fs.readFile('test-files/large-model.ifc');
    
    const startTime = Date.now();
    
    const elements = await ifcParser.extractStructuralElements(largeIFCBuffer);
    
    const duration = Date.now() - startTime;
    
    console.log(`Parsed ${elements.beams.length + elements.columns.length} elements in ${duration}ms`);
    
    // Should parse at least 100 elements/second
    const elementsPerSecond = (elements.beams.length + elements.columns.length) / (duration / 1000);
    expect(elementsPerSecond).toBeGreaterThan(100);
  }, 60000);
});

// Load testing with Artillery
// artillery.yml
// config:
//   target: 'http://localhost:8080'
//   phases:
//     - duration: 60
//       arrivalRate: 10
//       name: "Warm up"
//     - duration: 120
//       arrivalRate: 50
//       name: "Ramp up load"
//     - duration: 60
//       arrivalRate: 100
//       name: "Sustained high load"
// scenarios:
//   - name: "API endpoints"
//     flow:
//       - post:
//           url: "/api/auth/login"
//           json:
//             email: "test@example.com"
//             password: "password"
//           capture:
//             - json: "$.token"
//               as: "authToken"
//       - get:
//           url: "/api/projects"
//           headers:
//             Authorization: "Bearer {{ authToken }}"
```

### 5. Configuración de CI/CD

```yaml
# .github/workflows/test.yml

name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd api && npm ci
          cd ../frontend && npm ci
      
      - name: Run unit tests
        run: |
          cd api && npm test -- --coverage
          cd ../frontend && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./api/coverage/lcov.info,./frontend/coverage/lcov.info
  
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd api && npm ci
      
      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        run: |
          cd api
          npx prisma migrate deploy
      
      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
        run: cd api && npm run test:integration
  
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd api && npm ci
          cd ../frontend && npm ci
          npx playwright install --with-deps
      
      - name: Start services
        run: |
          cd api && npm run dev &
          cd frontend && npm run dev &
          sleep 10
      
      - name: Run E2E tests
        run: cd frontend && npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
  
  code-quality:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run ESLint
        run: |
          cd api && npm run lint
          cd ../frontend && npm run lint
      
      - name: Run Prettier
        run: |
          cd api && npm run format:check
          cd ../frontend && npm run format:check
      
      - name: Type check
        run: |
          cd api && npm run type-check
          cd ../frontend && npm run type-check
```

### Coverage Goals

| Test Type | Coverage Target | Priority |
|-----------|----------------|----------|
| Unit Tests | 70% | HIGH |
| Integration Tests | 50% | MEDIUM |
| E2E Tests | Critical flows only | HIGH |
| Performance Tests | Key operations | MEDIUM |

### Testing Scripts

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "test:integration": "jest --testPathPattern=__tests__/integration --runInBand",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:performance": "jest --testPathPattern=__tests__/performance",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 📈 MÉTRICAS DE CALIDAD

### Code Quality Checks

1. **ESLint Configuration**
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended',
    'prettier'
  ],
  rules: {
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-var': 'error',
    'prefer-const': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true
    }],
    'security/detect-object-injection': 'warn'
  }
};
```

2. **SonarQube Integration**
```yaml
# sonar-project.properties
sonar.projectKey=proyecto-dom
sonar.sources=api/src,frontend/app,frontend/components
sonar.tests=api/src/__tests__,frontend/__tests__
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx
sonar.javascript.lcov.reportPaths=api/coverage/lcov.info,frontend/coverage/lcov.info

# Quality Gates
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300
```

3. **Performance Budgets**
```javascript
// next.config.ts
module.exports = {
  experimental: {
    performanceBudgets: {
      'routes/**': {
        firstLoad: 300, // 300KB max
        total: 500
      }
    }
  }
};
```

---

## ✅ CHECKLIST FINAL DE CALIDAD

Antes de marcar un hito como completo, verificar:

### Code Quality
- [ ] ESLint pasa sin errores
- [ ] Prettier aplicado a todos los archivos
- [ ] TypeScript compila sin errores
- [ ] No hay `any` types sin justificación
- [ ] No hay console.log olvidados
- [ ] No hay código comentado

### Testing
- [ ] Unit tests cubren casos principales
- [ ] Integration tests pasan localmente
- [ ] E2E tests de flujos críticos funcionan
- [ ] Coverage mínimo alcanzado (70% unit, 50% integration)
- [ ] Performance tests dentro de targets

### Security
- [ ] Inputs validados y sanitizados
- [ ] No hay secrets hardcodeados
- [ ] HTTPS en producción
- [ ] Rate limiting configurado
- [ ] CORS configurado correctamente
- [ ] Headers de seguridad presentes

### Documentation
- [ ] README actualizado
- [ ] API docs actualizadas
- [ ] Comentarios en código complejo
- [ ] Changelog actualizado
- [ ] Environment variables documentadas

### UX/UI
- [ ] Loading states implementados
- [ ] Error handling con mensajes claros
- [ ] Feedback visual en todas las acciones
- [ ] Responsive en mobile/tablet
- [ ] Contraste WCAG AA
- [ ] Keyboard navigation funciona

### Performance
- [ ] Lighthouse score > 90
- [ ] API responses < 500ms (p95)
- [ ] Lazy loading implementado
- [ ] Images optimizadas
- [ ] Bundle size aceptable

### Monitoring
- [ ] Logs estructurados
- [ ] Error tracking configurado
- [ ] Performance monitoring activo
- [ ] Alertas configuradas

---

## 🎯 RESUMEN EJECUTIVO

### Tiempo Total Estimado
**320-410 horas** (8-10 semanas con 1 desarrollador full-time)

### Distribución por Hito
1. **RBAC & Security**: 60-80h (19%)
2. **APS Integration**: 40-50h (13%)
3. **Auto-sync & Versioning**: 50-65h (16%)
4. **Format Validation**: 35-45h (11%)
5. **Structure Validation**: 70-90h (24%)
6. **UX Improvements**: 50-65h (15%)
7. **Monitoring**: 30-40h (10%)
8. **Testing & Docs**: 20-30h (7%)

### Tecnologías Clave
- **Backend**: Node.js, TypeScript, Express, Prisma
- **Frontend**: Next.js 15, React, Tailwind CSS
- **Database**: PostgreSQL (prod), SQLite (dev)
- **Cache**: Redis
- **Queue**: Bull
- **Testing**: Jest, Playwright, Supertest
- **Logging**: Winston
- **Integration**: Autodesk APS

### Criterios de Éxito
✅ Seguridad: RBAC completo, no hay acceso cruzado entre usuarios
✅ Performance: Validaciones < 30s, API responses < 500ms
✅ Calidad: 70% unit coverage, 50% integration coverage
✅ UX: WCAG AA compliance, loading states, feedback claro
✅ Mantenibilidad: Código documentado, tests passing, CI/CD configurado

---

**📌 NOTA FINAL**: Este plan prioriza **profesionalismo** sobre velocidad. Cada implementación evita:
- ❌ Hardcoding de valores
- ❌ Bad practices (sincronización bloqueante, falta de validación)
- ❌ Código sin tests
- ❌ Falta de logging/monitoring
- ❌ UX sin feedback

✅ Todos los hitos incluyen:
- Arquitectura escalable
- Error handling robusto
- Tests comprehensivos
- Documentación clara
- Performance optimization
- Security best practices

**Éxito = Aplicación production-ready, mantenible y escalable** 🚀

