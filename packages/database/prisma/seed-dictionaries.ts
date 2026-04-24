/// <reference types="node" />
/**
 * Seed script for Compliance V3 dictionaries.
 * Populates PropertyDictionary, CategoryDictionary, and UnitConversion tables.
 * Idempotent: uses upsert on unique keys.
 *
 * Usage: npx tsx packages/database/prisma/seed-dictionaries.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// PROPERTY DICTIONARY DATA
// ============================================================

interface PropertySeed {
  canonicalName: string;
  locales: {
    locale: string;
    displayName: string;
    aliases: string[];
  }[];
  revitPropertyPath?: string;
  ifcPropertyPath?: string;
  unit?: string;
  dataType?: string;
}

const PROPERTIES: PropertySeed[] = [
  // --- Dimensions ---
  {
    canonicalName: "Width",
    locales: [
      { locale: "en-US", displayName: "Width", aliases: ["W", "Wd"] },
      { locale: "es-CL", displayName: "Ancho", aliases: ["Anchura", "Ancho Total", "W"] },
    ],
    revitPropertyPath: "Dimensions.Width",
    ifcPropertyPath: "Pset_WallCommon.Width",
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Height",
    locales: [
      { locale: "en-US", displayName: "Height", aliases: ["H", "Ht"] },
      { locale: "es-CL", displayName: "Altura", aliases: ["Alto", "H"] },
    ],
    revitPropertyPath: "Dimensions.Height",
    ifcPropertyPath: "Qto_WallBaseQuantities.Height",
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Length",
    locales: [
      { locale: "en-US", displayName: "Length", aliases: ["L", "Len"] },
      { locale: "es-CL", displayName: "Largo", aliases: ["Longitud", "L"] },
    ],
    revitPropertyPath: "Dimensions.Length",
    ifcPropertyPath: "Qto_WallBaseQuantities.Length",
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Thickness",
    locales: [
      { locale: "en-US", displayName: "Thickness", aliases: ["Thk", "T"] },
      { locale: "es-CL", displayName: "Espesor", aliases: ["Grosor", "Thk"] },
    ],
    revitPropertyPath: "Dimensions.Thickness",
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Depth",
    locales: [
      { locale: "en-US", displayName: "Depth", aliases: ["D"] },
      { locale: "es-CL", displayName: "Profundidad", aliases: ["D"] },
    ],
    revitPropertyPath: "Dimensions.Depth",
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Diameter",
    locales: [
      { locale: "en-US", displayName: "Diameter", aliases: ["Dia", "OD"] },
      { locale: "es-CL", displayName: "Diámetro", aliases: ["Dia", "Diametro"] },
    ],
    revitPropertyPath: "Dimensions.Diameter",
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Area",
    locales: [
      { locale: "en-US", displayName: "Area", aliases: ["A"] },
      { locale: "es-CL", displayName: "Área", aliases: ["Area", "Superficie", "A"] },
    ],
    unit: "m2",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Volume",
    locales: [
      { locale: "en-US", displayName: "Volume", aliases: ["Vol", "V"] },
      { locale: "es-CL", displayName: "Volumen", aliases: ["Vol", "V"] },
    ],
    unit: "m3",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Perimeter",
    locales: [
      { locale: "en-US", displayName: "Perimeter", aliases: ["Perim"] },
      { locale: "es-CL", displayName: "Perímetro", aliases: ["Perimetro"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Slope",
    locales: [
      { locale: "en-US", displayName: "Slope", aliases: ["Grade", "Pitch"] },
      { locale: "es-CL", displayName: "Pendiente", aliases: ["Inclinación", "Inclinacion"] },
    ],
    unit: "deg",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Offset",
    locales: [
      { locale: "en-US", displayName: "Offset", aliases: ["Off"] },
      { locale: "es-CL", displayName: "Desfase", aliases: ["Offset"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Spacing",
    locales: [
      { locale: "en-US", displayName: "Spacing", aliases: ["Pitch", "Sp"] },
      { locale: "es-CL", displayName: "Espaciamiento", aliases: ["Separación", "Separacion"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  // --- Structural ---
  {
    canonicalName: "ConcreteStrength",
    locales: [
      { locale: "en-US", displayName: "Concrete Strength", aliases: ["fc", "f'c", "Compressive Strength"] },
      { locale: "es-CL", displayName: "Resistencia del Hormigón", aliases: ["f'c", "fc", "Resistencia Hormigon", "Resistencia Compresión"] },
    ],
    unit: "MPa",
    dataType: "NUMBER",
  },
  {
    canonicalName: "SteelGrade",
    locales: [
      { locale: "en-US", displayName: "Steel Grade", aliases: ["Grade", "Fy"] },
      { locale: "es-CL", displayName: "Grado del Acero", aliases: ["Calidad Acero", "Fy"] },
    ],
    unit: "MPa",
    dataType: "STRING",
  },
  {
    canonicalName: "RebarCover",
    locales: [
      { locale: "en-US", displayName: "Rebar Cover", aliases: ["Cover", "Concrete Cover"] },
      { locale: "es-CL", displayName: "Recubrimiento", aliases: ["Rec", "Recubrimiento Armadura"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "RebarDiameter",
    locales: [
      { locale: "en-US", displayName: "Rebar Diameter", aliases: ["Bar Size", "Bar Diameter"] },
      { locale: "es-CL", displayName: "Diámetro Barra", aliases: ["Diametro Barra", "Calibre Barra"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "LoadBearing",
    locales: [
      { locale: "en-US", displayName: "Load Bearing", aliases: ["Structural", "Is Structural"] },
      { locale: "es-CL", displayName: "Portante", aliases: ["Estructural", "Es Estructural"] },
    ],
    dataType: "BOOLEAN",
  },
  {
    canonicalName: "StructuralUsage",
    locales: [
      { locale: "en-US", displayName: "Structural Usage", aliases: ["Usage"] },
      { locale: "es-CL", displayName: "Uso Estructural", aliases: ["Uso"] },
    ],
    dataType: "STRING",
  },
  // --- Fire Protection ---
  {
    canonicalName: "FireRating",
    locales: [
      { locale: "en-US", displayName: "Fire Rating", aliases: ["FR", "Fire Resistance"] },
      { locale: "es-CL", displayName: "Resistencia al Fuego", aliases: ["RF", "Clasificación Fuego", "Clasificacion Fuego", "F-Rating"] },
    ],
    revitPropertyPath: "Identity Data.Fire Rating",
    ifcPropertyPath: "Pset_WallCommon.FireRating",
    dataType: "STRING",
  },
  {
    canonicalName: "Combustible",
    locales: [
      { locale: "en-US", displayName: "Combustible", aliases: ["Is Combustible"] },
      { locale: "es-CL", displayName: "Combustible", aliases: ["Es Combustible"] },
    ],
    dataType: "BOOLEAN",
  },
  // --- Electrical ---
  {
    canonicalName: "Voltage",
    locales: [
      { locale: "en-US", displayName: "Voltage", aliases: ["V", "Volt"] },
      { locale: "es-CL", displayName: "Voltaje", aliases: ["Tensión", "Tension", "V"] },
    ],
    unit: "V",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Current",
    locales: [
      { locale: "en-US", displayName: "Current", aliases: ["Amps", "I"] },
      { locale: "es-CL", displayName: "Corriente", aliases: ["Amperaje", "I", "Amps"] },
    ],
    unit: "A",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Power",
    locales: [
      { locale: "en-US", displayName: "Power", aliases: ["Watts", "W", "P"] },
      { locale: "es-CL", displayName: "Potencia", aliases: ["Watts", "W", "P"] },
    ],
    unit: "W",
    dataType: "NUMBER",
  },
  {
    canonicalName: "ApparentPower",
    locales: [
      { locale: "en-US", displayName: "Apparent Power", aliases: ["VA", "kVA"] },
      { locale: "es-CL", displayName: "Potencia Aparente", aliases: ["VA", "kVA"] },
    ],
    unit: "VA",
    dataType: "NUMBER",
  },
  {
    canonicalName: "PowerFactor",
    locales: [
      { locale: "en-US", displayName: "Power Factor", aliases: ["PF", "cos φ"] },
      { locale: "es-CL", displayName: "Factor de Potencia", aliases: ["FP", "cos φ", "cos fi"] },
    ],
    dataType: "NUMBER",
  },
  {
    canonicalName: "CircuitNumber",
    locales: [
      { locale: "en-US", displayName: "Circuit Number", aliases: ["Circuit", "Ckt"] },
      { locale: "es-CL", displayName: "Número de Circuito", aliases: ["Circuito", "Cto", "Numero Circuito"] },
    ],
    dataType: "STRING",
  },
  {
    canonicalName: "CableTrayWidth",
    locales: [
      { locale: "en-US", displayName: "Cable Tray Width", aliases: ["Tray Width"] },
      { locale: "es-CL", displayName: "Ancho Bandeja", aliases: ["Ancho Bandeja Portacable"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "ConduitDiameter",
    locales: [
      { locale: "en-US", displayName: "Conduit Diameter", aliases: ["Conduit Size"] },
      { locale: "es-CL", displayName: "Diámetro Conduit", aliases: ["Diametro Conduit", "Tamaño Conduit"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  // --- MEP / HVAC ---
  {
    canonicalName: "FlowRate",
    locales: [
      { locale: "en-US", displayName: "Flow Rate", aliases: ["Flow", "CFM", "L/s"] },
      { locale: "es-CL", displayName: "Caudal", aliases: ["Flujo", "L/s"] },
    ],
    unit: "L/s",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Pressure",
    locales: [
      { locale: "en-US", displayName: "Pressure", aliases: ["Press", "Pa"] },
      { locale: "es-CL", displayName: "Presión", aliases: ["Presion", "Pa"] },
    ],
    unit: "Pa",
    dataType: "NUMBER",
  },
  {
    canonicalName: "Temperature",
    locales: [
      { locale: "en-US", displayName: "Temperature", aliases: ["Temp", "T"] },
      { locale: "es-CL", displayName: "Temperatura", aliases: ["Temp", "T"] },
    ],
    unit: "C",
    dataType: "NUMBER",
  },
  {
    canonicalName: "PipeSize",
    locales: [
      { locale: "en-US", displayName: "Pipe Size", aliases: ["Nominal Diameter", "DN"] },
      { locale: "es-CL", displayName: "Tamaño Tubería", aliases: ["DN", "Diámetro Nominal", "Diametro Nominal"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  {
    canonicalName: "InsulationThickness",
    locales: [
      { locale: "en-US", displayName: "Insulation Thickness", aliases: ["Insulation"] },
      { locale: "es-CL", displayName: "Espesor Aislación", aliases: ["Aislación", "Aislacion", "Espesor Aislacion"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
  // --- Identity / General ---
  {
    canonicalName: "Mark",
    locales: [
      { locale: "en-US", displayName: "Mark", aliases: ["Tag", "Label"] },
      { locale: "es-CL", displayName: "Marca", aliases: ["Tag", "Etiqueta"] },
    ],
    revitPropertyPath: "Identity Data.Mark",
    dataType: "STRING",
  },
  {
    canonicalName: "TypeName",
    locales: [
      { locale: "en-US", displayName: "Type Name", aliases: ["Family Type", "Type"] },
      { locale: "es-CL", displayName: "Nombre de Tipo", aliases: ["Tipo", "Tipo Familia"] },
    ],
    dataType: "STRING",
  },
  {
    canonicalName: "FamilyName",
    locales: [
      { locale: "en-US", displayName: "Family Name", aliases: ["Family"] },
      { locale: "es-CL", displayName: "Nombre de Familia", aliases: ["Familia"] },
    ],
    dataType: "STRING",
  },
  {
    canonicalName: "Level",
    locales: [
      { locale: "en-US", displayName: "Level", aliases: ["Floor", "Story"] },
      { locale: "es-CL", displayName: "Nivel", aliases: ["Piso", "Planta"] },
    ],
    revitPropertyPath: "Constraints.Level",
    dataType: "STRING",
  },
  {
    canonicalName: "Phase",
    locales: [
      { locale: "en-US", displayName: "Phase", aliases: ["Phase Created"] },
      { locale: "es-CL", displayName: "Fase", aliases: ["Fase Creación", "Fase Creacion"] },
    ],
    dataType: "STRING",
  },
  {
    canonicalName: "Material",
    locales: [
      { locale: "en-US", displayName: "Material", aliases: ["Mat"] },
      { locale: "es-CL", displayName: "Material", aliases: ["Mat"] },
    ],
    revitPropertyPath: "Materials and Finishes.Material",
    dataType: "STRING",
  },
  {
    canonicalName: "Function",
    locales: [
      { locale: "en-US", displayName: "Function", aliases: ["Func"] },
      { locale: "es-CL", displayName: "Función", aliases: ["Funcion", "Func"] },
    ],
    revitPropertyPath: "Identity Data.Function",
    dataType: "ENUM",
  },
  {
    canonicalName: "Description",
    locales: [
      { locale: "en-US", displayName: "Description", aliases: ["Desc"] },
      { locale: "es-CL", displayName: "Descripción", aliases: ["Descripcion", "Desc"] },
    ],
    revitPropertyPath: "Identity Data.Description",
    dataType: "STRING",
  },
  {
    canonicalName: "Comments",
    locales: [
      { locale: "en-US", displayName: "Comments", aliases: ["Notes", "Remarks"] },
      { locale: "es-CL", displayName: "Comentarios", aliases: ["Notas", "Observaciones"] },
    ],
    revitPropertyPath: "Identity Data.Comments",
    dataType: "STRING",
  },
  // --- Plumbing ---
  {
    canonicalName: "PipeMaterial",
    locales: [
      { locale: "en-US", displayName: "Pipe Material", aliases: ["Piping Material"] },
      { locale: "es-CL", displayName: "Material Tubería", aliases: ["Material Tubo", "Material Tuberia"] },
    ],
    dataType: "STRING",
  },
  {
    canonicalName: "ConnectionType",
    locales: [
      { locale: "en-US", displayName: "Connection Type", aliases: ["Joint Type"] },
      { locale: "es-CL", displayName: "Tipo de Conexión", aliases: ["Tipo Conexion", "Tipo Junta"] },
    ],
    dataType: "STRING",
  },
  // --- Acoustic ---
  {
    canonicalName: "SoundTransmissionClass",
    locales: [
      { locale: "en-US", displayName: "Sound Transmission Class", aliases: ["STC"] },
      { locale: "es-CL", displayName: "Clase Transmisión Sonido", aliases: ["STC", "Clase Transmision Sonido"] },
    ],
    dataType: "NUMBER",
  },
  // --- Thermal ---
  {
    canonicalName: "ThermalResistance",
    locales: [
      { locale: "en-US", displayName: "Thermal Resistance", aliases: ["R-Value", "R Value"] },
      { locale: "es-CL", displayName: "Resistencia Térmica", aliases: ["R-Value", "Valor R", "Resistencia Termica"] },
    ],
    unit: "m2K/W",
    dataType: "NUMBER",
  },
  {
    canonicalName: "UValue",
    locales: [
      { locale: "en-US", displayName: "U-Value", aliases: ["Thermal Transmittance", "U Value"] },
      { locale: "es-CL", displayName: "Valor U", aliases: ["Transmitancia Térmica", "Transmitancia Termica", "U-Value"] },
    ],
    unit: "W/m2K",
    dataType: "NUMBER",
  },
  // --- Weight ---
  {
    canonicalName: "Weight",
    locales: [
      { locale: "en-US", displayName: "Weight", aliases: ["Wt", "Mass"] },
      { locale: "es-CL", displayName: "Peso", aliases: ["Masa", "Wt"] },
    ],
    unit: "kg",
    dataType: "NUMBER",
  },
  // --- Reinforcement ---
  {
    canonicalName: "RebarSpacing",
    locales: [
      { locale: "en-US", displayName: "Rebar Spacing", aliases: ["Bar Spacing"] },
      { locale: "es-CL", displayName: "Espaciamiento Barra", aliases: ["Separación Barra", "Separacion Barra"] },
    ],
    unit: "mm",
    dataType: "NUMBER",
  },
];

// ============================================================
// CATEGORY DICTIONARY DATA
// ============================================================

interface CategorySeed {
  canonicalName: string;
  revitCategory: string;
  ifcEntity?: string;
  discipline?: string;
  locales: {
    locale: string;
    displayName: string;
    aliases: string[];
  }[];
}

const CATEGORIES: CategorySeed[] = [
  // --- Structural ---
  {
    canonicalName: "Walls",
    revitCategory: "Walls",
    ifcEntity: "IfcWall",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Walls", aliases: ["Wall"] },
      { locale: "es-CL", displayName: "Muros", aliases: ["Muro", "Tabique", "Pared", "Paredes"] },
    ],
  },
  {
    canonicalName: "Structural Columns",
    revitCategory: "Structural Columns",
    ifcEntity: "IfcColumn",
    discipline: "STRUCTURAL",
    locales: [
      { locale: "en-US", displayName: "Structural Columns", aliases: ["Columns", "Column"] },
      { locale: "es-CL", displayName: "Columnas Estructurales", aliases: ["Columnas", "Columna", "Pilares", "Pilar"] },
    ],
  },
  {
    canonicalName: "Structural Beams",
    revitCategory: "Structural Framing",
    ifcEntity: "IfcBeam",
    discipline: "STRUCTURAL",
    locales: [
      { locale: "en-US", displayName: "Structural Beams", aliases: ["Beams", "Beam", "Structural Framing"] },
      { locale: "es-CL", displayName: "Vigas Estructurales", aliases: ["Vigas", "Viga", "Estructura"] },
    ],
  },
  {
    canonicalName: "Structural Foundations",
    revitCategory: "Structural Foundations",
    ifcEntity: "IfcFooting",
    discipline: "STRUCTURAL",
    locales: [
      { locale: "en-US", displayName: "Structural Foundations", aliases: ["Foundations", "Foundation", "Footings"] },
      { locale: "es-CL", displayName: "Fundaciones", aliases: ["Fundación", "Fundacion", "Cimientos", "Zapatas"] },
    ],
  },
  {
    canonicalName: "Floors",
    revitCategory: "Floors",
    ifcEntity: "IfcSlab",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Floors", aliases: ["Floor", "Slab", "Slabs"] },
      { locale: "es-CL", displayName: "Pisos", aliases: ["Piso", "Losa", "Losas", "Suelo"] },
    ],
  },
  {
    canonicalName: "Roofs",
    revitCategory: "Roofs",
    ifcEntity: "IfcRoof",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Roofs", aliases: ["Roof"] },
      { locale: "es-CL", displayName: "Techos", aliases: ["Techo", "Cubierta", "Cubiertas", "Techumbres"] },
    ],
  },
  {
    canonicalName: "Ceilings",
    revitCategory: "Ceilings",
    ifcEntity: "IfcCovering",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Ceilings", aliases: ["Ceiling"] },
      { locale: "es-CL", displayName: "Cielos", aliases: ["Cielo", "Cielo Falso", "Cielos Rasos"] },
    ],
  },
  {
    canonicalName: "Doors",
    revitCategory: "Doors",
    ifcEntity: "IfcDoor",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Doors", aliases: ["Door"] },
      { locale: "es-CL", displayName: "Puertas", aliases: ["Puerta"] },
    ],
  },
  {
    canonicalName: "Windows",
    revitCategory: "Windows",
    ifcEntity: "IfcWindow",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Windows", aliases: ["Window"] },
      { locale: "es-CL", displayName: "Ventanas", aliases: ["Ventana"] },
    ],
  },
  {
    canonicalName: "Curtain Walls",
    revitCategory: "Curtain Walls",
    ifcEntity: "IfcCurtainWall",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Curtain Walls", aliases: ["Curtain Wall"] },
      { locale: "es-CL", displayName: "Muros Cortina", aliases: ["Muro Cortina"] },
    ],
  },
  {
    canonicalName: "Stairs",
    revitCategory: "Stairs",
    ifcEntity: "IfcStair",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Stairs", aliases: ["Stair", "Staircase"] },
      { locale: "es-CL", displayName: "Escaleras", aliases: ["Escalera"] },
    ],
  },
  {
    canonicalName: "Railings",
    revitCategory: "Railings",
    ifcEntity: "IfcRailing",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Railings", aliases: ["Railing", "Handrail"] },
      { locale: "es-CL", displayName: "Barandas", aliases: ["Baranda", "Pasamanos"] },
    ],
  },
  {
    canonicalName: "Ramps",
    revitCategory: "Ramps",
    ifcEntity: "IfcRamp",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Ramps", aliases: ["Ramp"] },
      { locale: "es-CL", displayName: "Rampas", aliases: ["Rampa"] },
    ],
  },
  // --- MEP ---
  {
    canonicalName: "Pipes",
    revitCategory: "Pipes",
    ifcEntity: "IfcPipeSegment",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Pipes", aliases: ["Pipe", "Piping"] },
      { locale: "es-CL", displayName: "Tuberías", aliases: ["Tubería", "Tuberia", "Tuberias", "Caño", "Cañería"] },
    ],
  },
  {
    canonicalName: "Pipe Fittings",
    revitCategory: "Pipe Fittings",
    ifcEntity: "IfcPipeFitting",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Pipe Fittings", aliases: ["Fittings", "Pipe Fitting"] },
      { locale: "es-CL", displayName: "Accesorios de Tubería", aliases: ["Fitting", "Accesorios Tuberia"] },
    ],
  },
  {
    canonicalName: "Ducts",
    revitCategory: "Ducts",
    ifcEntity: "IfcDuctSegment",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Ducts", aliases: ["Duct", "Ductwork"] },
      { locale: "es-CL", displayName: "Ductos", aliases: ["Ducto", "Conducto", "Conductos"] },
    ],
  },
  {
    canonicalName: "Duct Fittings",
    revitCategory: "Duct Fittings",
    ifcEntity: "IfcDuctFitting",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Duct Fittings", aliases: ["Duct Fitting"] },
      { locale: "es-CL", displayName: "Accesorios de Ducto", aliases: ["Fitting Ducto"] },
    ],
  },
  {
    canonicalName: "Mechanical Equipment",
    revitCategory: "Mechanical Equipment",
    ifcEntity: "IfcEnergyConversionDevice",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Mechanical Equipment", aliases: ["HVAC Equipment", "Mech Equipment", "MEP"] },
      { locale: "es-CL", displayName: "Equipos Mecánicos", aliases: ["Equipo Mecánico", "Equipos Mecanicos", "HVAC"] },
    ],
  },
  {
    canonicalName: "Plumbing Fixtures",
    revitCategory: "Plumbing Fixtures",
    ifcEntity: "IfcSanitaryTerminal",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Plumbing Fixtures", aliases: ["Plumbing", "Fixtures"] },
      { locale: "es-CL", displayName: "Artefactos Sanitarios", aliases: ["Sanitarios", "Grifería", "Griferia"] },
    ],
  },
  {
    canonicalName: "Sprinklers",
    revitCategory: "Sprinklers",
    ifcEntity: "IfcFireSuppressionTerminal",
    discipline: "MEP",
    locales: [
      { locale: "en-US", displayName: "Sprinklers", aliases: ["Sprinkler", "Fire Sprinkler"] },
      { locale: "es-CL", displayName: "Rociadores", aliases: ["Rociador", "Sprinkler"] },
    ],
  },
  // --- Electrical ---
  {
    canonicalName: "Cable Trays",
    revitCategory: "Cable Trays",
    ifcEntity: "IfcCableCarrierSegment",
    discipline: "ELECTRICAL",
    locales: [
      { locale: "en-US", displayName: "Cable Trays", aliases: ["Cable Tray", "Tray"] },
      { locale: "es-CL", displayName: "Bandejas Portacables", aliases: ["Bandeja", "Bandeja Portacable", "Bandejas"] },
    ],
  },
  {
    canonicalName: "Conduits",
    revitCategory: "Conduits",
    ifcEntity: "IfcCableCarrierSegment",
    discipline: "ELECTRICAL",
    locales: [
      { locale: "en-US", displayName: "Conduits", aliases: ["Conduit"] },
      { locale: "es-CL", displayName: "Conduits", aliases: ["Canalización", "Canalizacion", "Conducto Eléctrico"] },
    ],
  },
  {
    canonicalName: "Electrical Equipment",
    revitCategory: "Electrical Equipment",
    ifcEntity: "IfcElectricDistributionBoard",
    discipline: "ELECTRICAL",
    locales: [
      { locale: "en-US", displayName: "Electrical Equipment", aliases: ["Elec Equipment", "Panels", "ELX", "Panel"] },
      { locale: "es-CL", displayName: "Equipos Eléctricos", aliases: ["Tableros", "Tablero", "Equipos Electricos"] },
    ],
  },
  {
    canonicalName: "Electrical Fixtures",
    revitCategory: "Electrical Fixtures",
    ifcEntity: "IfcElectricAppliance",
    discipline: "ELECTRICAL",
    locales: [
      { locale: "en-US", displayName: "Electrical Fixtures", aliases: ["Outlets", "Switches"] },
      { locale: "es-CL", displayName: "Artefactos Eléctricos", aliases: ["Enchufes", "Interruptores", "Artefactos Electricos"] },
    ],
  },
  {
    canonicalName: "Lighting Fixtures",
    revitCategory: "Lighting Fixtures",
    ifcEntity: "IfcLightFixture",
    discipline: "ELECTRICAL",
    locales: [
      { locale: "en-US", displayName: "Lighting Fixtures", aliases: ["Lights", "Light Fixtures", "Luminaires", "Light", "Lumin"] },
      { locale: "es-CL", displayName: "Luminarias", aliases: ["Luminaria", "Luces", "Iluminación"] },
    ],
  },
  // --- Generic / Other ---
  {
    canonicalName: "Generic Models",
    revitCategory: "Generic Models",
    ifcEntity: "IfcBuildingElementProxy",
    locales: [
      { locale: "en-US", displayName: "Generic Models", aliases: ["Generic", "Generic Model"] },
      { locale: "es-CL", displayName: "Modelos Genéricos", aliases: ["Genérico", "Generico", "Modelos Genericos"] },
    ],
  },
  {
    canonicalName: "Furniture",
    revitCategory: "Furniture",
    ifcEntity: "IfcFurnishingElement",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Furniture", aliases: ["Furn"] },
      { locale: "es-CL", displayName: "Mobiliario", aliases: ["Muebles", "Mueble"] },
    ],
  },
  {
    canonicalName: "Casework",
    revitCategory: "Casework",
    ifcEntity: "IfcFurniture",
    discipline: "ARCHITECTURAL",
    locales: [
      { locale: "en-US", displayName: "Casework", aliases: ["Cabinets", "Millwork"] },
      { locale: "es-CL", displayName: "Carpintería", aliases: ["Muebles Empotrados", "Carpinteria"] },
    ],
  },
  {
    canonicalName: "Structural Connections",
    revitCategory: "Structural Connections",
    ifcEntity: "IfcFastener",
    discipline: "STRUCTURAL",
    locales: [
      { locale: "en-US", displayName: "Structural Connections", aliases: ["Connections"] },
      { locale: "es-CL", displayName: "Conexiones Estructurales", aliases: ["Conexiones"] },
    ],
  },
  {
    canonicalName: "Structural Rebar",
    revitCategory: "Structural Rebar",
    ifcEntity: "IfcReinforcingBar",
    discipline: "STRUCTURAL",
    locales: [
      { locale: "en-US", displayName: "Structural Rebar", aliases: ["Rebar", "Reinforcement"] },
      { locale: "es-CL", displayName: "Armadura", aliases: ["Fierro", "Refuerzo", "Barras de Refuerzo"] },
    ],
  },
];

// ============================================================
// UNIT CONVERSION DATA
// ============================================================

interface UnitConversionSeed {
  fromUnit: string;
  toUnit: string;
  factor: number;
  category: string;
}

const UNIT_CONVERSIONS: UnitConversionSeed[] = [
  // --- Length ---
  { fromUnit: "mm", toUnit: "m", factor: 0.001, category: "length" },
  { fromUnit: "cm", toUnit: "m", factor: 0.01, category: "length" },
  { fromUnit: "km", toUnit: "m", factor: 1000, category: "length" },
  { fromUnit: "in", toUnit: "m", factor: 0.0254, category: "length" },
  { fromUnit: "ft", toUnit: "m", factor: 0.3048, category: "length" },
  { fromUnit: "yd", toUnit: "m", factor: 0.9144, category: "length" },
  { fromUnit: "mi", toUnit: "m", factor: 1609.344, category: "length" },
  { fromUnit: "mm", toUnit: "cm", factor: 0.1, category: "length" },
  { fromUnit: "mm", toUnit: "in", factor: 0.03937, category: "length" },
  { fromUnit: "ft", toUnit: "in", factor: 12, category: "length" },
  { fromUnit: "m", toUnit: "ft", factor: 3.28084, category: "length" },
  // --- Area ---
  { fromUnit: "mm2", toUnit: "m2", factor: 1e-6, category: "area" },
  { fromUnit: "cm2", toUnit: "m2", factor: 1e-4, category: "area" },
  { fromUnit: "km2", toUnit: "m2", factor: 1e6, category: "area" },
  { fromUnit: "ft2", toUnit: "m2", factor: 0.092903, category: "area" },
  { fromUnit: "in2", toUnit: "m2", factor: 0.00064516, category: "area" },
  { fromUnit: "ha", toUnit: "m2", factor: 10000, category: "area" },
  { fromUnit: "ac", toUnit: "m2", factor: 4046.86, category: "area" },
  // --- Volume ---
  { fromUnit: "mm3", toUnit: "m3", factor: 1e-9, category: "volume" },
  { fromUnit: "cm3", toUnit: "m3", factor: 1e-6, category: "volume" },
  { fromUnit: "L", toUnit: "m3", factor: 0.001, category: "volume" },
  { fromUnit: "mL", toUnit: "m3", factor: 1e-6, category: "volume" },
  { fromUnit: "ft3", toUnit: "m3", factor: 0.0283168, category: "volume" },
  { fromUnit: "in3", toUnit: "m3", factor: 1.6387e-5, category: "volume" },
  { fromUnit: "gal", toUnit: "m3", factor: 0.00378541, category: "volume" },
  { fromUnit: "gal_uk", toUnit: "m3", factor: 0.00454609, category: "volume" },
  // --- Pressure ---
  { fromUnit: "kPa", toUnit: "Pa", factor: 1000, category: "pressure" },
  { fromUnit: "MPa", toUnit: "Pa", factor: 1e6, category: "pressure" },
  { fromUnit: "GPa", toUnit: "Pa", factor: 1e9, category: "pressure" },
  { fromUnit: "bar", toUnit: "Pa", factor: 100000, category: "pressure" },
  { fromUnit: "psi", toUnit: "Pa", factor: 6894.76, category: "pressure" },
  { fromUnit: "ksi", toUnit: "Pa", factor: 6894760, category: "pressure" },
  { fromUnit: "atm", toUnit: "Pa", factor: 101325, category: "pressure" },
  { fromUnit: "mmHg", toUnit: "Pa", factor: 133.322, category: "pressure" },
  { fromUnit: "kgf/cm2", toUnit: "Pa", factor: 98066.5, category: "pressure" },
  // --- Electrical (Voltage) ---
  { fromUnit: "mV", toUnit: "V", factor: 0.001, category: "electrical_voltage" },
  { fromUnit: "kV", toUnit: "V", factor: 1000, category: "electrical_voltage" },
  // --- Electrical (Current) ---
  { fromUnit: "mA", toUnit: "A", factor: 0.001, category: "electrical_current" },
  { fromUnit: "kA", toUnit: "A", factor: 1000, category: "electrical_current" },
  // --- Electrical (Power) ---
  { fromUnit: "kW", toUnit: "W", factor: 1000, category: "electrical_power" },
  { fromUnit: "MW", toUnit: "W", factor: 1e6, category: "electrical_power" },
  { fromUnit: "HP", toUnit: "W", factor: 745.7, category: "electrical_power" },
  { fromUnit: "VA", toUnit: "W", factor: 1, category: "electrical_power" },
  { fromUnit: "kVA", toUnit: "W", factor: 1000, category: "electrical_power" },
  // --- Temperature (offsets, not factors — stored as factor for delta conversions) ---
  { fromUnit: "C", toUnit: "K", factor: 1, category: "temperature" }, // delta: 1°C = 1K
  { fromUnit: "F", toUnit: "K", factor: 0.5556, category: "temperature" }, // delta only
  // --- Mass ---
  { fromUnit: "g", toUnit: "kg", factor: 0.001, category: "mass" },
  { fromUnit: "mg", toUnit: "kg", factor: 1e-6, category: "mass" },
  { fromUnit: "t", toUnit: "kg", factor: 1000, category: "mass" },
  { fromUnit: "lb", toUnit: "kg", factor: 0.453592, category: "mass" },
  { fromUnit: "oz", toUnit: "kg", factor: 0.0283495, category: "mass" },
  // --- Force ---
  { fromUnit: "kN", toUnit: "N", factor: 1000, category: "force" },
  { fromUnit: "MN", toUnit: "N", factor: 1e6, category: "force" },
  { fromUnit: "kgf", toUnit: "N", factor: 9.80665, category: "force" },
  { fromUnit: "lbf", toUnit: "N", factor: 4.44822, category: "force" },
  // --- Angle ---
  { fromUnit: "deg", toUnit: "rad", factor: 0.0174533, category: "angle" },
  { fromUnit: "grad", toUnit: "rad", factor: 0.015708, category: "angle" },
];

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedProperties() {
  let count = 0;
  for (const prop of PROPERTIES) {
    for (const loc of prop.locales) {
      await prisma.propertyDictionary.upsert({
        where: {
          canonicalName_locale: {
            canonicalName: prop.canonicalName,
            locale: loc.locale,
          },
        },
        update: {
          displayName: loc.displayName,
          aliases: loc.aliases,
          revitPropertyPath: prop.revitPropertyPath ?? null,
          ifcPropertyPath: prop.ifcPropertyPath ?? null,
          unit: prop.unit ?? null,
          dataType: prop.dataType ?? "NUMBER",
        },
        create: {
          canonicalName: prop.canonicalName,
          locale: loc.locale,
          displayName: loc.displayName,
          aliases: loc.aliases,
          revitPropertyPath: prop.revitPropertyPath ?? null,
          ifcPropertyPath: prop.ifcPropertyPath ?? null,
          unit: prop.unit ?? null,
          dataType: prop.dataType ?? "NUMBER",
        },
      });
      count++;
    }
  }
  return count;
}

async function seedCategories() {
  let count = 0;
  for (const cat of CATEGORIES) {
    for (const loc of cat.locales) {
      await prisma.categoryDictionary.upsert({
        where: {
          canonicalName_locale: {
            canonicalName: cat.canonicalName,
            locale: loc.locale,
          },
        },
        update: {
          displayName: loc.displayName,
          aliases: loc.aliases,
          revitCategory: cat.revitCategory,
          ifcEntity: cat.ifcEntity ?? null,
          discipline: cat.discipline ?? null,
        },
        create: {
          canonicalName: cat.canonicalName,
          locale: loc.locale,
          displayName: loc.displayName,
          aliases: loc.aliases,
          revitCategory: cat.revitCategory,
          ifcEntity: cat.ifcEntity ?? null,
          discipline: cat.discipline ?? null,
        },
      });
      count++;
    }
  }
  return count;
}

async function seedUnitConversions() {
  let count = 0;
  for (const conv of UNIT_CONVERSIONS) {
    await prisma.unitConversion.upsert({
      where: {
        fromUnit_toUnit: {
          fromUnit: conv.fromUnit,
          toUnit: conv.toUnit,
        },
      },
      update: {
        factor: conv.factor,
        category: conv.category,
      },
      create: {
        fromUnit: conv.fromUnit,
        toUnit: conv.toUnit,
        factor: conv.factor,
        category: conv.category,
      },
    });
    count++;
  }
  return count;
}

async function main() {
  console.info("[SEED] Starting dictionary seed...");

  const propCount = await seedProperties();
  console.info(`[SEED] PropertyDictionary: ${propCount} entries upserted`);

  const catCount = await seedCategories();
  console.info(`[SEED] CategoryDictionary: ${catCount} entries upserted`);

  const unitCount = await seedUnitConversions();
  console.info(`[SEED] UnitConversion: ${unitCount} entries upserted`);

  console.info("[SEED] ========================================");
  console.info("[SEED] Seed complete!");
  console.info(`[SEED]   Properties: ${propCount}`);
  console.info(`[SEED]   Categories: ${catCount}`);
  console.info(`[SEED]   Unit conversions: ${unitCount}`);
  console.info("[SEED] ========================================");
}

main()
  .catch((error) => {
    console.error("[SEED] Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
