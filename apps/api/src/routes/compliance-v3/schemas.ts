import { z } from "zod";

// Known disciplines (reference only — validation is done via z.string, not z.enum)
export const DISCIPLINES = [
  "STRUCTURAL",
  "ARCHITECTURAL",
  "MEP",
  "ELECTRICAL",
  "PLUMBING",
  "FIRE_PROTECTION",
  "LOW_CURRENT",
  "HVAC",
  "CIVIL",
  "REAS",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const SEVERITIES = ["MANDATORY", "RECOMMENDED", "INFO"] as const;

export const OPERATORS = [
  ">=",
  "<=",
  ">",
  "<",
  "==",
  "!=",
  "range",
  "exists",
  "contains",
  "one_of",
] as const;

export const PACK_STATUSES = ["DRAFT", "PUBLISHED", "DEPRECATED"] as const;
export const REQUIREMENT_STATUSES = ["DRAFT", "VERIFIED", "ACTIVE", "RETIRED"] as const;
export const DOC_TYPES = ["LAW", "STANDARD", "GUIDELINE", "SPEC"] as const;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const createPackSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  country: z.string().length(2, "Country must be ISO 3166-1 alpha-2 (2 chars)").or(z.literal("*")),
  version: z.string().min(1, "Version is required"),
  scope: z.array(z.string().min(1)).min(1, "At least one discipline required"),
  organizationId: z.string().uuid().optional(),
});

export type CreatePackInput = z.infer<typeof createPackSchema>;

export const updatePackSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  version: z.string().min(1).optional(),
  scope: z.array(z.string().min(1)).min(1).optional(),
});

export type UpdatePackInput = z.infer<typeof updatePackSchema>;

export const listPacksFilterSchema = paginationSchema.extend({
  country: z.string().optional(),
  status: z.enum(PACK_STATUSES).optional(),
  scope: z.string().optional(), // single discipline to filter by
});

export type ListPacksFilter = z.infer<typeof listPacksFilterSchema>;

export const conditionSchema = z.object({
  propertyRef: z.string().min(1, "Property reference is required"),
  operator: z.enum(OPERATORS),
  value: z.string().min(1, "Value is required"),
  unit: z.string().optional(),
  tolerance: z.number().min(0).max(1).optional(),
  logicGroup: z.enum(["AND", "OR"]).default("AND"),
  sortOrder: z.number().int().min(0).default(0),
});

export const applicabilitySchema = z.object({
  targetCategories: z.array(z.string().min(1)).min(1, "At least one target category required"),
  excludeCategories: z.array(z.string()).default([]),
  propertyFilters: z.record(z.string(), z.unknown()).optional(),
  scope: z.enum(["ALL", "FILTERED"]).default("FILTERED"),
});

export const requirementCodePattern = /^[A-Z]{2}-[A-Z0-9-]+-R\d{3}$/;

export const createRequirementSchema = z.object({
  code: z.string().regex(requirementCodePattern, "Code must match pattern: XX-XXXX-R000"),
  description: z.string().min(1, "Description is required"),
  legalReference: z.string().min(1, "Legal reference is required"),
  discipline: z.string().min(1),
  severity: z.enum(SEVERITIES).default("MANDATORY"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  conditions: z.array(conditionSchema).min(1, "At least one condition is required"),
  applicability: applicabilitySchema.optional(),
});

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const updateRequirementSchema = z.object({
  description: z.string().min(1).optional(),
  legalReference: z.string().min(1).optional(),
  discipline: z.string().min(1).optional(),
  severity: z.enum(SEVERITIES).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  conditions: z.array(conditionSchema).min(1).optional(),
  applicability: applicabilitySchema.optional(),
});

export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export const bulkCreateRequirementsSchema = z.object({
  requirements: z.array(createRequirementSchema).min(1).max(100, "Maximum 100 requirements per request"),
});

export type BulkCreateRequirementsInput = z.infer<typeof bulkCreateRequirementsSchema>;

export const verifyRequirementSchema = z.object({
  userId: z.string().min(1, "Verifier userId is required"),
});

export type VerifyRequirementInput = z.infer<typeof verifyRequirementSchema>;

export const listRequirementsFilterSchema = paginationSchema.extend({
  discipline: z.string().min(1).optional(),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
});

export type ListRequirementsFilter = z.infer<typeof listRequirementsFilterSchema>;
