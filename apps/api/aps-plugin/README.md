# Guía de Compilación del Plugin RevitToPdf

Esta carpeta contiene todo el código necesario. Tienes dos opciones:

## OPCIÓN A: Abrir Directamente (Recomendada)

1. Copia toda esta carpeta `aps-plugin` al equipo que tiene Visual Studio.
2. Abre el archivo `RevitToPdf.csproj`.
3. Dale a **Build** (Compilar) > **Build Solution**.

## OPCIÓN B: Crear desde Cero (Si prefieres "Escribirlo")

Si necesitas crear el proyecto manualmente en Visual Studio:

1. **Crear Proyecto:**
   - Abre Visual Studio 2022.
   - Nuevo Proyecto -> **Class Library (.NET Framework)**.
   - Nombre: `RevitToPdf`.
   - Framework: **.NET Framework 4.8**.

2. **Referencias (References):**
   - En el "Solution Explorer", click derecho en "References" -> Add Reference.
   - Busca y añade:
     - `RevitAPI.dll` (Está en C:\Program Files\Autodesk\Revit 2024\)
     - `RevitAPIUI.dll` (Está en C:\Program Files\Autodesk\Revit 2024\)
     - `DesignAutomationBridge.dll` (Necesitas bajar el paquete NuGet: `Autodesk.Forge.DesignAutomation.Revit`)

3. **Código (Copy-Paste):**
   - Abre tu `Class1.cs` (se crea por defecto) y renómbralo a `Command.cs`.
   - Borra todo su contenido y pega el código del archivo `Command.cs` de esta carpeta.

4. **Compilar:**
   - Menú **Build** -> **Build Solution**.

5. **Empaquetar (El paso final importante):**
   - Crea una carpeta llamada `RevitToPdfApp.bundle`.
   - Crea un archivo `PackageContents.xml` dentro (copia el contenido del archivo xml de aquí).
   - Crea una subcarpeta `Contents`.
   - Pega tu `RevitToPdf.dll` (que acabas de compilar) dentro de `Contents`.
   - Comprime la carpeta `RevitToPdfApp.bundle` en un ZIP llamado **`RevitToPdfApp.zip`**.

Ese `.zip` es lo que necesitamos traer de vuelta aquí.
