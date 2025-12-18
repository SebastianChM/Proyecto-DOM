const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const mockDir = path.join(__dirname, "../mock-data");
if (!fs.existsSync(mockDir)) {
  fs.mkdirSync(mockDir, { recursive: true });
}

const doc = new PDFDocument({ autoFirstPage: false });
const outputPath = path.join(mockDir, "TechnicalSpec.pdf");
const stream = fs.createWriteStream(outputPath);

doc.pipe(stream);

// --- Helper for Filler Text ---
const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. \n\n" +
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.\n\n";

function addFillerPages(doc, count) {
  for (let i = 0; i < count; i++) {
    doc.addPage();
    doc.font("Helvetica").fontSize(10);
    doc.text("GENERAL CONDITIONS AND REQUIREMENTS - BOILERPLATE CONTENT", {
      align: "center",
    });
    doc.moveDown();
    // Add dense text
    for (let j = 0; j < 4; j++) {
      doc.text(lorem + lorem + lorem, { align: "justify" });
      doc.moveDown();
    }
    doc.fontSize(8).text(`Page Filler ${i + 1}`, { align: "right" });
  }
}

// --- Title Page ---
doc.addPage();
doc
  .font("Helvetica-Bold")
  .fontSize(24)
  .text("PROJECT: RESIDENTIAL TOWER - PHASE 1", { align: "center" });
doc.moveDown();
doc
  .fontSize(18)
  .text("DOCUMENT: TECHNICAL SPECIFICATIONS", { align: "center" });
doc
  .fontSize(12)
  .text(`DATE: ${new Date().toISOString().split("T")[0]}`, { align: "center" });
doc.moveDown(10);
doc.fontSize(14).text("TOTAL PAGES: 100+ (SIMULATED)", { align: "center" });

// --- Add Bulk Content (Start) ---
// Add 20 pages of Intro/Legal/General Conditions
console.log("Generating Intro Pages (20)...");
addFillerPages(doc, 20);

// --- Section 03: Concrete (Buried in the middle) ---
console.log("Adding Section 03...");
doc.addPage();
doc
  .font("Helvetica-Bold")
  .fontSize(16)
  .text("SECTION 03.30 - CAST-IN-PLACE CONCRETE");
doc.moveDown();
doc.font("Helvetica").fontSize(12);

doc.text("1.1 GENERAL REQUIREMENTS");
doc.text("The Contractor shall provide all labor, materials, and equipment...");
doc.moveDown();

doc.text("2.1 CONCRETE MIX DESIGNS");
doc.font("Helvetica-Bold").text("A. Foundations:");
doc.font("Helvetica").text("- Compressive Strength: 35 MPa");
doc.text("- Max Aggregate Size: 20mm");
doc.text("- Slump: 100mm +/- 25mm");
doc.moveDown();

doc.font("Helvetica-Bold").text("B. Slabs on Grade:");
doc.font("Helvetica").text("- Compressive Strength: 30 MPa");
doc.text("- Thickness: 150mm");
doc.text("- Vapor Barrier: 10 mil polyethylene");
doc.moveDown();

doc.font("Helvetica-Bold").text("C. Columns (Ground to Level 5):");
doc.font("Helvetica").text("- Compressive Strength: 50 MPa");
doc.text("- Fire Rating: 120 mins");
doc.moveDown();

// --- More Bulk Content ---
console.log("Generating Middle Pages (30)...");
addFillerPages(doc, 30);

// --- Section 08: Doors ---
console.log("Adding Section 08...");
doc.addPage();
doc
  .font("Helvetica-Bold")
  .fontSize(16)
  .text("SECTION 08.11 - METAL DOORS AND FRAMES");
doc.moveDown();
doc.font("Helvetica").fontSize(12);
doc.text("3.1 PRODUCTS");
doc.text("A. Exterior Doors:");
doc.text("Material: Galvanized Steel");
doc.text("Gauge: 16 gauge");
doc.text("Finish: Powder Coated");
doc.text("Fire Rating: 60 mins");
doc.moveDown();

// --- More Bulk Content ---
console.log("Generating Buffer Pages (20)...");
addFillerPages(doc, 20);

// --- Section 09: Gypsum ---
console.log("Adding Section 09...");
doc.addPage();
doc.font("Helvetica-Bold").fontSize(16).text("SECTION 09.29 - GYPSUM BOARD");
doc.moveDown();
doc.font("Helvetica").fontSize(12);
doc.text("4.1 MATERIALS");
doc.text("A. Standard Board: Thickness: 12.5mm (1/2 inch) - Type X");
doc.text("B. Shaft Wall Liner: Thickness: 25mm (1 inch) - Rating: 120 mins");

// --- Final Bulk Content ---
console.log("Generating Final Pages (30)...");
addFillerPages(doc, 30);

doc.end();
console.log(`✅ Generated PDF Mock: ${outputPath}`);
