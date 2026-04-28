import { api } from "./client";
import type {
  Pack,
  PackDetail,
  Requirement,
  ProjectComplianceConfig,
  ResolvedConfig,
  RequirementOverride,
  ComplianceRun,
  ComplianceIssue,
  StoredAnalysis,
  PropertyEntry,
  CategoryEntry,
  UnitConversion,
  V3PaginatedResponse,
} from "./compliance-v3.types";

const BASE = "/api/compliance-v3";

export interface PackListParams {
  page?: number;
  limit?: number;
  country?: string;
  status?: string;
  search?: string;
  scope?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface RequirementListParams {
  page?: number;
  limit?: number;
  discipline?: string;
  status?: string;
  severity?: string;
}

export interface EvaluateParams {
  modelUrn: string;
  discipline?: string;
  dryRun?: boolean;
}

export interface CreatePackInput {
  code: string;
  name: string;
  description?: string;
  country: string;
  version: string;
  scope: string[];
  organizationId?: string;
}

export type UpdatePackInput = Partial<Omit<CreatePackInput, "code">>;

export interface ConditionInput {
  propertyRef: string;
  operator: string;
  value: string;
  unit?: string;
  tolerance?: number;
  logicGroup: "AND" | "OR";
  sortOrder: number;
}

export interface ApplicabilityInput {
  targetCategories: string[];
  excludeCategories: string[];
  propertyFilters?: Record<string, unknown>;
  scope: "ALL" | "FILTERED";
}

export interface CreateRequirementInput {
  code: string;
  description: string;
  legalReference: string;
  discipline: string;
  severity: "MANDATORY" | "RECOMMENDED" | "INFO";
  tags?: string[];
  notes?: string;
  conditions: ConditionInput[];
  applicability?: ApplicabilityInput;
}

export interface UpsertConfigInput {
  packIds: string[];
}

export interface AddOverrideInput {
  requirementId: string;
  action: "SKIP" | "MODIFY_VALUE" | "CHANGE_SEVERITY";
  newValue?: string;
  newSeverity?: string;
  reason: string;
  approvedBy: string;
}

export interface AnalyzeInput {
  text: string;
  discipline?: string;
}

export interface ApproveInput {
  index?: number;
}

function buildQs(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export function getPacks(
  params?: PackListParams,
): Promise<V3PaginatedResponse<Pack>> {
  return api.get<V3PaginatedResponse<Pack>>(
    `${BASE}/packs${buildQs({ ...params })}`,
  );
}

export function getPackById(id: string): Promise<PackDetail> {
  return api.get<PackDetail>(`${BASE}/packs/${id}`);
}

export function createPack(data: CreatePackInput): Promise<Pack> {
  return api.post<Pack>(`${BASE}/packs`, data);
}

export function updatePack(id: string, data: UpdatePackInput): Promise<Pack> {
  return api.patch<Pack>(`${BASE}/packs/${id}`, data);
}

export function publishPack(id: string): Promise<Pack> {
  return api.post<Pack>(`${BASE}/packs/${id}/publish`);
}

export function deprecatePack(id: string): Promise<Pack> {
  return api.post<Pack>(`${BASE}/packs/${id}/deprecate`);
}

export function getRequirements(
  packId: string,
  params?: RequirementListParams,
): Promise<V3PaginatedResponse<Requirement>> {
  return api.get<V3PaginatedResponse<Requirement>>(
    `${BASE}/packs/${packId}/requirements${buildQs({ ...params })}`,
  );
}

export function getRequirementById(id: string): Promise<Requirement> {
  return api.get<Requirement>(`${BASE}/requirements/${id}`);
}

export function createRequirement(
  packId: string,
  data: CreateRequirementInput,
): Promise<Requirement> {
  return api.post<Requirement>(`${BASE}/packs/${packId}/requirements`, data);
}

export function updateRequirement(
  id: string,
  data: Partial<CreateRequirementInput>,
): Promise<Requirement> {
  return api.patch<Requirement>(`${BASE}/requirements/${id}`, data);
}

export function verifyRequirement(
  id: string,
  userId: string,
): Promise<Requirement> {
  return api.post<Requirement>(`${BASE}/requirements/${id}/verify`, { userId });
}

export function deleteRequirement(id: string): Promise<void> {
  return api.delete<void>(`${BASE}/requirements/${id}`);
}

export function bulkCreateRequirements(
  packId: string,
  requirements: CreateRequirementInput[],
): Promise<Requirement[]> {
  return api.post<Requirement[]>(`${BASE}/packs/${packId}/requirements/bulk`, {
    requirements,
  });
}

export function getComplianceConfig(
  projectId: string,
): Promise<ProjectComplianceConfig | null> {
  return api.get<ProjectComplianceConfig | null>(
    `${BASE}/projects/${projectId}/compliance-config`,
  );
}

export function upsertComplianceConfig(
  projectId: string,
  data: UpsertConfigInput,
): Promise<ProjectComplianceConfig> {
  return api.put<ProjectComplianceConfig>(
    `${BASE}/projects/${projectId}/compliance-config`,
    data,
  );
}

export function addOverride(
  projectId: string,
  data: AddOverrideInput,
): Promise<RequirementOverride> {
  return api.post<RequirementOverride>(
    `${BASE}/projects/${projectId}/compliance-config/overrides`,
    data,
  );
}

export function removeOverride(
  projectId: string,
  overrideId: string,
): Promise<void> {
  return api.delete<void>(
    `${BASE}/projects/${projectId}/compliance-config/overrides/${overrideId}`,
  );
}

export function getResolvedConfig(projectId: string): Promise<ResolvedConfig> {
  return api.get<ResolvedConfig>(
    `${BASE}/projects/${projectId}/compliance-config/resolved`,
  );
}

export function evaluateCompliance(
  projectId: string,
  params: EvaluateParams,
): Promise<ComplianceRun> {
  return api.post<ComplianceRun>(
    `${BASE}/projects/${projectId}/compliance/evaluate`,
    params,
  );
}

export function getRunById(runId: string): Promise<ComplianceRun> {
  return api.get<ComplianceRun>(`${BASE}/compliance/runs/${runId}`);
}

export function getRunsByProject(
  projectId: string,
  params?: { page?: number; limit?: number },
): Promise<V3PaginatedResponse<ComplianceRun>> {
  return api.get<V3PaginatedResponse<ComplianceRun>>(
    `${BASE}/projects/${projectId}/compliance/runs${buildQs({ ...params })}`,
  );
}

export function getRunIssues(
  runId: string,
  params?: { page?: number; limit?: number; severity?: string },
): Promise<V3PaginatedResponse<ComplianceIssue>> {
  return api.get<V3PaginatedResponse<ComplianceIssue>>(
    `${BASE}/compliance/runs/${runId}/issues${buildQs({ ...params })}`,
  );
}

export function analyzeSuggestions(
  packId: string,
  data: AnalyzeInput,
): Promise<StoredAnalysis> {
  return api.post<StoredAnalysis>(
    `${BASE}/packs/${packId}/suggestions/analyze`,
    data,
  );
}

export function approveSuggestion(
  analysisId: string,
  data?: ApproveInput,
): Promise<Requirement> {
  return api.post<Requirement>(
    `${BASE}/suggestions/${analysisId}/approve`,
    data ?? {},
  );
}

export function rejectSuggestion(analysisId: string): Promise<void> {
  return api.post<void>(`${BASE}/suggestions/${analysisId}/reject`);
}

export function getProperties(): Promise<PropertyEntry[]> {
  return api.get<PropertyEntry[]>(`${BASE}/dictionaries/properties`);
}

export function getCategories(): Promise<CategoryEntry[]> {
  return api.get<CategoryEntry[]>(`${BASE}/dictionaries/categories`);
}

export function getUnits(): Promise<UnitConversion[]> {
  return api.get<UnitConversion[]>(`${BASE}/dictionaries/units`);
}
