using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Autodesk.Revit.ApplicationServices;
using Autodesk.Revit.DB;
using DesignAutomationFramework;

namespace RevitToPdf
{
    public class Command : IExternalDBApplication
    {
        public ExternalDBApplicationResult OnStartup(ControlledApplication application)
        {
            DesignAutomationBridge.DesignAutomationReadyEvent += HandleDesignAutomationReadyEvent;
            return ExternalDBApplicationResult.Succeeded;
        }

        public ExternalDBApplicationResult OnShutdown(ControlledApplication application)
        {
            DesignAutomationBridge.DesignAutomationReadyEvent -= HandleDesignAutomationReadyEvent;
            return ExternalDBApplicationResult.Succeeded;
        }

        public void HandleDesignAutomationReadyEvent(object sender, DesignAutomationReadyEventArgs e)
        {
            try
            {
                ExportToPdf(e.DesignAutomationData);
                e.Succeeded = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR: " + ex.Message);
                e.Succeeded = false;
            }
        }

        private void ExportToPdf(DesignAutomationData data)
        {
            Document doc = data.RevitDoc;
            if (doc == null) throw new InvalidOperationException("Could not open document.");

            Console.WriteLine("Opened Document: " + doc.Title);

            // 1. Find all ViewSheets (Láminas)
            List<ViewSheet> sheets = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewSheet))
                .Cast<ViewSheet>()
                .Where(v => !v.IsTemplate && v.CanBePrinted)
                .ToList();

            if (sheets.Count == 0)
            {
                Console.WriteLine("No printable sheets found. Exporting default 3D view.");
                return;
            }

            Console.WriteLine($"Found {sheets.Count} sheets.");

            // 2. Configure PDF Export
            IList<ElementId> viewIds = sheets.Select(s => s.Id).ToList();
            
            PDFExportOptions options = new PDFExportOptions();
            options.FileName = "output";
            options.Combine = true; // Combine all sheets into one PDF
            options.StopOnError = false;
            options.ExportQuality = PDFExportQualityType.PdfHigh;
            options.AlwaysUseRasterizer = false; // Try vector first

            // 3. Export
            string exportPath = Directory.GetCurrentDirectory(); 
            // In DA, working directory is clean. We output to 'output.pdf' directly in root usually.
            // But API requires path without extension for Combine=true in some versions, or full path?
            // Revit 2024 requires strict options.
            
            Console.WriteLine("Exporting...");
            
            try 
            {
                 doc.Export(exportPath, viewIds, options);
                 Console.WriteLine("Export command executed.");
                 
                 // Rename if necessary (Revit sometimes adds suffix)
                 // Start simple: just output.pdf
                 
                 // Verify existence
                 if (File.Exists(Path.Combine(exportPath, "output.pdf")))
                 {
                     Console.WriteLine("Success: output.pdf created.");
                 }
                 else 
                 {
                     Console.WriteLine("Warning: output.pdf not found immediately. Checking subfolders...");
                 }
            }
            catch(Exception ex) 
            {
                Console.WriteLine($"Export Failed: {ex.Message}");
                throw;
            }
        }
    }
}
