import { describe, it, expect, beforeEach } from "@jest/globals";
import { IdsParserService } from "../../../../src/services/compliance-v3/ids-parser.service";

const MINIMAL_IDS = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS"
     xmlns:xs="http://www.w3.org/2001/XMLSchema"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <specifications>
    <specification name="Wall fire rating" ifcVersion="IFC4"
                   description="Minimum fire rating for walls">
      <applicability>
        <entity>
          <name>
            <simpleValue>IFCWALL</simpleValue>
          </name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IfcLabel">
          <propertySet>
            <simpleValue>Pset_WallCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>FireRating</simpleValue>
          </baseName>
          <value>
            <xs:restriction base="xs:string">
              <xs:minInclusive value="120"/>
            </xs:restriction>
          </value>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

const IDS_SIMPLE_VALUE = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS">
  <specifications>
    <specification name="Column material" ifcVersion="IFC4">
      <applicability>
        <entity>
          <name><simpleValue>IFCCOLUMN</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IfcLabel">
          <propertySet><simpleValue>Pset_ColumnCommon</simpleValue></propertySet>
          <baseName><simpleValue>Material</simpleValue></baseName>
          <value>
            <simpleValue>Concrete</simpleValue>
          </value>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

const IDS_NO_SPECIFICATIONS = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS">
</ids>`;

const IDS_SPEC_NO_REQUIREMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS">
  <specifications>
    <specification name="Empty spec" ifcVersion="IFC4">
      <applicability>
        <entity>
          <name><simpleValue>IFCWALL</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
      </requirements>
    </specification>
  </specifications>
</ids>`;

describe("IdsParserService", () => {
  let service: IdsParserService;

  beforeEach(() => {
    service = new IdsParserService();
  });

  describe("parseXml", () => {
    it("should return one specification when XML has one specification element", () => {
      const result = service.parseXml(MINIMAL_IDS);
      expect(result.specifications).toHaveLength(1);
      expect(result.specifications[0].name).toBe("Wall fire rating");
    });

    it("should return empty specifications when XML has no specifications element", () => {
      const result = service.parseXml(IDS_NO_SPECIFICATIONS);
      expect(result.specifications).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should record error and continue when specification has no requirements", () => {
      const result = service.parseXml(IDS_SPEC_NO_REQUIREMENTS);
      expect(result.specifications).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Empty spec");
    });

    it("should extract propertySet and baseName from property requirement", () => {
      const result = service.parseXml(MINIMAL_IDS);
      const req = result.specifications[0].requirements[0];
      expect(req.propertySet).toBe("Pset_WallCommon");
      expect(req.baseName).toBe("FireRating");
    });

    it("should map xs:minInclusive restriction to operator >= when converting inputs", () => {
      const parseResult = service.parseXml(MINIMAL_IDS);
      const inputs = service.convertToRequirementInputs(
        parseResult,
        "pack-001",
        "STRUCTURAL",
      );
      expect(inputs[0].conditions[0].operator).toBe(">=");
    });

    it("should map simpleValue restriction to operator == when converting inputs", () => {
      const parseResult = service.parseXml(IDS_SIMPLE_VALUE);
      const inputs = service.convertToRequirementInputs(
        parseResult,
        "pack-001",
        "STRUCTURAL",
      );
      expect(inputs[0].conditions[0].operator).toBe("==");
    });

    it("should return empty specifications when XML is malformed and has no ids root", () => {
      const malformedXml = "<<not valid xml>>";
      const result = service.parseXml(malformedXml);
      expect(result.specifications).toHaveLength(0);
    });
  });

  describe("convertToRequirementInputs", () => {
    it("should generate code matching requirementCodePattern when converting specification", () => {
      const parseResult = service.parseXml(MINIMAL_IDS);
      const inputs = service.convertToRequirementInputs(
        parseResult,
        "pack-001",
        "STRUCTURAL",
      );
      expect(inputs[0].code).toBe("IS-WALL-FIRE-RATING-R001");
    });

    it("should set severity MANDATORY on all converted requirements when processing IDS specs", () => {
      const parseResult = service.parseXml(MINIMAL_IDS);
      const inputs = service.convertToRequirementInputs(
        parseResult,
        "pack-001",
        "STRUCTURAL",
      );
      expect(inputs[0].severity).toBe("MANDATORY");
    });

    it("should skip specifications with empty requirements array when building inputs", () => {
      const parseResult = service.parseXml(IDS_SPEC_NO_REQUIREMENTS);
      const inputs = service.convertToRequirementInputs(
        parseResult,
        "pack-001",
        "STRUCTURAL",
      );
      expect(inputs).toHaveLength(0);
    });
  });
});
