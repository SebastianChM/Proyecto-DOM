export interface MopSection {
  code: string; // e.g. "5.401.1"
  title: string; // e.g. "DESCRIPCIÓN Y ALCANCES"
  content: string[]; // Raw lines of text
  requirements: Requirement[];
}

export interface Requirement {
  sectionCode: string;
  parameter: string; // e.g. "Resistencia"
  value: string; // e.g. "30 MPa"
  originalText: string;
}
