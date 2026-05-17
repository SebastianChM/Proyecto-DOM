import { z } from "zod";

// Known disciplines — enforced via z.enum in analyzeSchema and suggestedRequirementSchema
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

export const PACK_STATUSES = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  DEPRECATED: "DEPRECATED",
} as const;
export const REQUIREMENT_STATUSES = [
  "DRAFT",
  "VERIFIED",
  "ACTIVE",
  "RETIRED",
] as const;
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
  country: z
    .string()
    .length(2, "Country must be ISO 3166-1 alpha-2 (2 chars)")
    .or(z.literal("*")),
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
  search: z.string().optional(),
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
  targetCategories: z
    .array(z.string().min(1))
    .min(1, "At least one target category required"),
  excludeCategories: z.array(z.string()).default([]),
  propertyFilters: z.record(z.string(), z.unknown()).optional(),
  scope: z.enum(["ALL", "FILTERED"]).default("FILTERED"),
});

export const requirementCodePattern = /^[A-Z]{2}-[A-Z0-9-]+-R\d{3}$/;

export const createRequirementSchema = z.object({
  code: z
    .string()
    .regex(requirementCodePattern, "Code must match pattern: XX-XXXX-R000"),
  description: z.string().min(1, "Description is required"),
  legalReference: z.string().min(1, "Legal reference is required"),
  discipline: z.string().min(1),
  severity: z.enum(SEVERITIES).default("MANDATORY"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  conditions: z
    .array(conditionSchema)
    .min(1, "At least one condition is required"),
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
  requirements: z
    .array(createRequirementSchema)
    .min(1)
    .max(100, "Maximum 100 requirements per request"),
});

export type BulkCreateRequirementsInput = z.infer<
  typeof bulkCreateRequirementsSchema
>;

export const verifyRequirementSchema = z.object({
  userId: z.string().min(1, "Verifier userId is required"),
});

export type VerifyRequirementInput = z.infer<typeof verifyRequirementSchema>;

export const listRequirementsFilterSchema = paginationSchema.extend({
  discipline: z.string().min(1).optional(),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
});

export type ListRequirementsFilter = z.infer<
  typeof listRequirementsFilterSchema
>;

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid("projectId must be a valid UUID"),
});

export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;

export const upsertConfigSchema = z.object({
  packIds: z
    .array(z.string().uuid("Each packId must be a valid UUID"))
    .min(1, "At least one packId is required"),
});

export type UpsertConfigInput = z.infer<typeof upsertConfigSchema>;

export const OVERRIDE_ACTIONS = {
  SKIP: "SKIP",
  MODIFY_VALUE: "MODIFY_VALUE",
  CHANGE_SEVERITY: "CHANGE_SEVERITY",
} as const;

export const addOverrideSchema = z
  .object({
    requirementId: z.string().uuid("requirementId must be a valid UUID"),
    action: z.enum(OVERRIDE_ACTIONS),
    newValue: z.string().min(1).optional(),
    newSeverity: z.enum(SEVERITIES).optional(),
    reason: z.string().min(1, "reason is required"),
    approvedBy: z.string().min(1, "approvedBy is required"),
  })
  .superRefine((data, ctx) => {
    if (data.action === OVERRIDE_ACTIONS.MODIFY_VALUE && !data.newValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "newValue is required when action is MODIFY_VALUE",
        path: ["newValue"],
      });
    }
    if (data.action === OVERRIDE_ACTIONS.CHANGE_SEVERITY && !data.newSeverity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "newSeverity is required when action is CHANGE_SEVERITY",
        path: ["newSeverity"],
      });
    }
  });

export type AddOverrideInput = z.infer<typeof addOverrideSchema>;

export const overrideIdParamSchema = z.object({
  overrideId: z.string().uuid("overrideId must be a valid UUID"),
});

export const evaluateSchema = z.object({
  modelUrn: z.string().min(1, "modelUrn is required"),
  discipline: z.string().optional(),
  dryRun: z.boolean().default(false),
});

export type EvaluateInput = z.infer<typeof evaluateSchema>;

export const runIdParamSchema = z.object({
  runId: z.string().uuid("runId must be a valid UUID"),
});

export type RunIdParam = z.infer<typeof runIdParamSchema>;

export const listRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

export const runIssuesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: z.enum(SEVERITIES).optional(),
});

export type RunIssuesQuery = z.infer<typeof runIssuesQuerySchema>;

// ─── FASE 7 — LLM-Assisted Requirement Extraction ────────────────────────────

export const packIdParamSchema = z.object({
  packId: z.string().uuid("packId must be a valid UUID"),
});

export type PackIdParam = z.infer<typeof packIdParamSchema>;

export const analysisIdParamSchema = z.object({
  analysisId: z.string().min(1, "analysisId is required"),
});

export type AnalysisIdParam = z.infer<typeof analysisIdParamSchema>;

// ~4 chars per token; 80k chars ≈ 20k tokens — leaves headroom for system prompt + output
const MAX_ANALYZE_TEXT_CHARS = 80_000;

export const analyzeSchema = z.object({
  text: z
    .string()
    .min(10, "Text must be at least 10 characters")
    .max(
      MAX_ANALYZE_TEXT_CHARS,
      `Text must not exceed ${MAX_ANALYZE_TEXT_CHARS} characters`,
    ),
  // Locked to the known enum — any other string is rejected before reaching the LLM prompt.
  discipline: z.enum(DISCIPLINES).optional(),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;

export const approveSchema = z.object({
  index: z.coerce.number().int().min(0).default(0),
});

export type ApproveInput = z.infer<typeof approveSchema>;

export const idsImportBodySchema = z.object({
  discipline: z.string().min(1),
  xmlContent: z.string().min(1),
});

export type IdsImportBody = z.infer<typeof idsImportBodySchema>;

export const idsPackParamSchema = z.object({
  packId: z.string().uuid(),
});
