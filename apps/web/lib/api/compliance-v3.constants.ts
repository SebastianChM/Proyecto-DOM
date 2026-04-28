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
export type Severity = (typeof SEVERITIES)[number];

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
export type Operator = (typeof OPERATORS)[number];

export const PACK_STATUSES = ["DRAFT", "PUBLISHED", "DEPRECATED"] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

export const REQUIREMENT_STATUSES = [
  "DRAFT",
  "VERIFIED",
  "ACTIVE",
  "RETIRED",
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const OVERRIDE_ACTIONS = [
  "SKIP",
  "MODIFY_VALUE",
  "CHANGE_SEVERITY",
] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

export const LOGIC_GROUPS = ["AND", "OR"] as const;
export type LogicGroup = (typeof LOGIC_GROUPS)[number];
