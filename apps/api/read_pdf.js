const fs = require("fs");
const pdf = require("pdf-parse");
const path = require("path");

const pdfPath =
  "C:\\Users\\Sebastian\\Proyecto DOM\\Plan GPT\\Plan de Desarrollo – Plataforma BIM DOM.pdf";

if (!fs.existsSync(pdfPath)) {
  console.error("File not found:", pdfPath);
  process.exit(1);
}

let dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer)
  .then(function (data) {
    console.log(data.text);
  })
  .catch((err) => {
    console.error("Error parsing PDF:", err);
  });
