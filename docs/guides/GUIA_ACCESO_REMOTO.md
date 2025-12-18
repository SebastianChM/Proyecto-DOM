# Guía Simple de Acceso Remoto

## Pasos a Seguir

### 1. Descargar ngrok
1. Ve a: https://ngrok.com/download
2. Descarga la versión para Windows
3. Descomprime el archivo `ngrok.exe` en esta carpeta del proyecto

### 2. Ejecutar el servidor
Abre una terminal y ejecuta:
```bash
npm run dev
```

### 3. Crear el túnel
En OTRA terminal, ejecuta:
```bash
ngrok http 3000
```

### 4. Copiar el link
Ngrok te mostrará una URL como: `https://xxxx-xxxx.ngrok-free.app`

### 5. Acceder desde tu equipo de empresa
1. Abre esa URL en el navegador
2. Usuario: `admin`
3. Contraseña: `dom-secure-2024`

## ¡Listo!
La aplicación ya está protegida con contraseña gracias al middleware que agregamos.
