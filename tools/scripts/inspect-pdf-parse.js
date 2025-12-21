const pdf = require("pdf-parse");
console.log("Type:", typeof pdf);
console.log("Is Function:", typeof pdf === "function");
console.log("Keys:", Object.keys(pdf));
if (typeof pdf === "object") {
  console.log("Has default?", !!pdf.default);
  console.log("Has PDFParse?", !!pdf.PDFParse);
  if (pdf.PDFParse) console.log("PDFParse Type:", typeof pdf.PDFParse);
}

// Try calling it
try {
  if (typeof pdf === "function") {
    console.log("Calling main export... OK");
  } else {
    console.log("Main export is not function.");
  }
} catch (e) {
  console.error(e);
}
