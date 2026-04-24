import { describe, it, expect, jest, afterEach, beforeEach } from "@jest/globals";
import { categoryDictionaryService } from "../../../src/services/dictionary/category-dictionary.service";
import { propertyDictionaryService } from "../../../src/services/dictionary/property-dictionary.service";
import { modelDerivativeService } from "../../../src/services/aps/model-derivative.service";
import { BimQueryService } from "../../../src/services/bim-query.service";
import type { CategoryEntry } from "../../../src/services/dictionary/types";

// Sample category dictionary entries
const MOCK_CATEGORIES_EN: CategoryEntry[] = [
  {
    id: "cat-1",
    canonicalName: "Walls",
    locale: "en-US",
    displayName: "Walls",
    aliases: ["Wall"],
    revitCategory: "Walls",
    ifcEntity: "IfcWall",
    discipline: "ARCHITECTURAL",
  },
  {
    id: "cat-2",
    canonicalName: "Doors",
    locale: "en-US",
    displayName: "Doors",
    aliases: ["Door"],
    revitCategory: "Doors",
    ifcEntity: "IfcDoor",
    discipline: "ARCHITECTURAL",
  },
  {
    id: "cat-3",
    canonicalName: "Cable Trays",
    locale: "en-US",
    displayName: "Cable Trays",
    aliases: ["Cable Tray", "Tray"],
    revitCategory: "Cable Trays",
    ifcEntity: "IfcCableCarrierSegment",
    discipline: "ELECTRICAL",
  },
  {
    id: "cat-4",
    canonicalName: "Pipes",
    locale: "en-US",
    displayName: "Pipes",
    aliases: ["Pipe", "Piping"],
    revitCategory: "Pipes",
    ifcEntity: "IfcPipeSegment",
    discipline: "MEP",
  },
  {
    id: "cat-5",
    canonicalName: "Lighting Fixtures",
    locale: "en-US",
    displayName: "Lighting Fixtures",
    aliases: ["Lights", "Light Fixtures", "Luminaires", "Light", "Lumin"],
    revitCategory: "Lighting Fixtures",
    ifcEntity: "IfcLightFixture",
    discipline: "ELECTRICAL",
  },
];

const MOCK_CATEGORIES_ES: CategoryEntry[] = [
  {
    id: "cat-es-1",
    canonicalName: "Walls",
    locale: "es-CL",
    displayName: "Muros",
    aliases: ["Muro", "Tabique", "Pared"],
    revitCategory: "Walls",
    ifcEntity: "IfcWall",
    discipline: "ARCHITECTURAL",
  },
  {
    id: "cat-es-2",
    canonicalName: "Doors",
    locale: "es-CL",
    displayName: "Puertas",
    aliases: ["Puerta"],
    revitCategory: "Doors",
    ifcEntity: "IfcDoor",
    discipline: "ARCHITECTURAL",
  },
];

describe("BimQueryService", () => {
  let service: BimQueryService;

  beforeEach(() => {
    service = new BimQueryService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockApsResponse = (collection: unknown[]) => {
    jest
      .spyOn(modelDerivativeService, "getAllModelProperties")
      .mockResolvedValue({ data: { collection } } as never);
    jest
      .spyOn(modelDerivativeService, "getMetadata")
      .mockResolvedValue({ data: { metadata: [] } } as never);
  };

  const mockCategoryDictionary = () => {
    jest
      .spyOn(categoryDictionaryService, "getAll")
      .mockImplementation(async (locale: string) => {
        if (locale === "en-US") return MOCK_CATEGORIES_EN;
        if (locale === "es-CL") return MOCK_CATEGORIES_ES;
        return [];
      });
  };

  describe("category resolution", () => {
    it("should resolve category from object tree when preferred path exists", async () => {
      mockCategoryDictionary();

      // Object tree returns "Walls" for objectid 100
      jest
        .spyOn(modelDerivativeService, "getAllModelProperties")
        .mockResolvedValue({
          data: {
            collection: [
              { objectid: 100, name: "Basic Wall [12345]", properties: {} },
            ],
          },
        } as never);

      jest
        .spyOn(modelDerivativeService, "getMetadata")
        .mockResolvedValue({
          data: {
            metadata: [{ role: "3d", isMasterView: true, guid: "view-1" }],
          },
        } as never);

      jest
        .spyOn(modelDerivativeService, "getObjectTree")
        .mockResolvedValue({
          data: {
            objects: [
              {
                objectid: 1,
                name: "Root",
                objects: [
                  {
                    objectid: 50,
                    name: "Walls",
                    objects: [
                      {
                        objectid: 100,
                        name: "Basic Wall [12345]",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        } as never);

      const result = await service.queryModel("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Walls");
    });

    it("should resolve category from property path (fallback 1)", async () => {
      mockCategoryDictionary();

      // No object tree, but property has "Identity Data" / "Category"
      jest
        .spyOn(modelDerivativeService, "getAllModelProperties")
        .mockResolvedValue({
          data: {
            collection: [
              {
                objectid: 200,
                name: "Element 200",
                properties: {
                  "Identity Data": { Category: "Doors" },
                },
              },
            ],
          },
        } as never);

      jest
        .spyOn(modelDerivativeService, "getMetadata")
        .mockResolvedValue({ data: { metadata: [] } } as never);

      const result = await service.queryModel("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Doors");
    });

    it("should resolve category from element name using CategoryDictionary (fallback 2)", async () => {
      mockCategoryDictionary();

      // No object tree, no property path, but name starts with "Cable Tray"
      jest
        .spyOn(modelDerivativeService, "getAllModelProperties")
        .mockResolvedValue({
          data: {
            collection: [
              {
                objectid: 300,
                name: "Cable Tray Run 1 [56789]",
                properties: {},
              },
            ],
          },
        } as never);

      jest
        .spyOn(modelDerivativeService, "getMetadata")
        .mockResolvedValue({ data: { metadata: [] } } as never);

      const result = await service.queryModel("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Cable Trays");
    });

    it("should assign 'Uncategorized' only when all strategies fail", async () => {
      mockCategoryDictionary();

      jest
        .spyOn(modelDerivativeService, "getAllModelProperties")
        .mockResolvedValue({
          data: {
            collection: [
              {
                objectid: 400,
                name: "XYZ Unknown Element [99999]",
                properties: {},
              },
            ],
          },
        } as never);

      jest
        .spyOn(modelDerivativeService, "getMetadata")
        .mockResolvedValue({ data: { metadata: [] } } as never);

      const result = await service.queryModel("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Uncategorized");
    });

    it("should normalize properties for each element when model returns data", async () => {
      mockCategoryDictionary();

      jest
        .spyOn(modelDerivativeService, "getAllModelProperties")
        .mockResolvedValue({
          data: {
            collection: [
              {
                objectid: 500,
                name: "Pipe Run [111]",
                properties: {
                  Dimensions: {
                    Width: "200mm",
                    Height: "150mm",
                  },
                  "Identity Data": {
                    Category: "Pipes",
                    Mark: "P-001",
                  },
                },
              },
            ],
          },
        } as never);

      jest
        .spyOn(modelDerivativeService, "getMetadata")
        .mockResolvedValue({ data: { metadata: [] } } as never);

      const result = await service.queryModel("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Pipes");
      // Flattened props should include both grouped and direct keys
      expect(result[0].properties["Width"]).toBe("200mm");
      expect(result[0].properties["Height"]).toBe("150mm");
      expect(result[0].properties["Dimensions/Width"]).toBe("200mm");
      expect(result[0].properties["Mark"]).toBe("P-001");
    });
  });

  describe("getBOM", () => {
    const mockQueryModel = (collection: unknown[]) => {
      jest
        .spyOn(modelDerivativeService, "getAllModelProperties")
        .mockResolvedValue({ data: { collection } } as never);
      jest
        .spyOn(modelDerivativeService, "getMetadata")
        .mockResolvedValue({ data: { metadata: [] } } as never);
    };

    const mockPropertyDictionary = () => {
      jest
        .spyOn(propertyDictionaryService, "resolve")
        .mockImplementation(async (rawName: string) => {
          const entries: Record<string, { displayName: string; aliases: string[] }> = {
            Family: { displayName: "Family", aliases: ["Familia", "Family Name", "Nombre de familia", "Family and Type"] },
            Type: { displayName: "Type", aliases: ["Tipo", "Type Name", "Nombre de tipo"] },
            Material: { displayName: "Material", aliases: ["Structural Material", "Material estructural"] },
            Volume: { displayName: "Volume", aliases: ["Volumen", "Host Volume", "Gross Volume"] },
            Area: { displayName: "Area", aliases: ["Área", "Surface Area", "Gross Area"] },
            Length: { displayName: "Length", aliases: ["Longitud", "Curve Length"] },
          };
          const entry = entries[rawName];
          if (!entry) return null;
          return { id: `prop-${rawName}`, canonicalName: rawName, locale: "en-US", displayName: entry.displayName, aliases: entry.aliases, revitPropertyPath: null, ifcPropertyPath: null, unit: null, dataType: "string" } as never;
        });
    };

    it("should return BOM items with family and type when model has elements", async () => {
      mockCategoryDictionary();
      mockPropertyDictionary();
      mockQueryModel([
        {
          objectid: 1,
          name: "Basic Wall [12345]",
          properties: {
            "Identity Data": { Category: "Walls", Family: "Basic Wall", Type: "Generic - 200mm" },
            Dimensions: { Volume: "5.2", Area: "12.0", Length: "3.5" },
          },
        },
      ]);

      const result = await service.getBOM("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].family).toBe("Basic Wall");
      expect(result[0].type).toBe("Generic - 200mm");
      expect(result[0].volume).toBe(5.2);
      expect(result[0].area).toBe(12);
      expect(result[0].length).toBe(3.5);
    });

    it("should resolve property aliases from PropertyDictionary when aliases exist", async () => {
      mockCategoryDictionary();
      mockPropertyDictionary();
      mockQueryModel([
        {
          objectid: 2,
          name: "Muro [99]",
          properties: {
            "Identity Data": { Category: "Walls", Familia: "Muro Basico", Tipo: "200mm" },
            Dimensions: { Volumen: "3.0" },
          },
        },
      ]);

      const result = await service.getBOM("test-urn");

      expect(result).toHaveLength(1);
      expect(result[0].family).toBe("Muro Basico");
      expect(result[0].type).toBe("200mm");
      expect(result[0].volume).toBe(3);
    });

    it("should return empty array when model has no elements", async () => {
      mockCategoryDictionary();
      mockPropertyDictionary();
      mockQueryModel([]);

      const result = await service.getBOM("test-urn");

      expect(result).toHaveLength(0);
    });
  });
});
