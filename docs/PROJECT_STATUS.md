# PROJECT STATUS — DOM BIM Platform

## 1. Executive Summary

The DOM BIM Platform is a monorepo (Express API + Next.js frontend + Prisma/PostgreSQL) integrating Autodesk Platform Services for BIM file management, 3D viewing, format conversion, and compliance checking.

**What is resolved**: All 12 items from the original refined PR plan's critical/high-priority fixes are merged to main (PrismaClient singleton, workItemId match, polling backoff, rate-limiter fallback, route aliases, DB indexes, ProjectDetail split, frontend API service layer, error handling standardization, quarantine of dead code, Docker health checks, APS mock mode). Observability logging (PR #7), platform runtime hardening (PR #8), platform ops hardening (PR #9), and repo housekeeping (PR #10) are also merged.

**What is pending**: Session refresh (PR #11) is now merged. The major remaining work is: parser consolidation (9→6 files), unifying ValidationRun/ComplianceRun schema duplication, completing Design Automation integration, and production readiness (CI/CD, monitoring, tests).

**Active branches**: None. All feature branches are merged.

**Recommended next PR**: `refactor/parser-consolidation` — consolidate 9 parser files to 6, eliminate duplication.

## 2. Current Repository State

| Item            | Value          | Evidence                                    |
| --------------- | -------------- | ------------------------------------------- |
| Current branch  | `main`         | `git branch --show-current`                 |
| main HEAD       | `fceac27`      | Merge PR #11 from feat/session-refresh      |
| Working tree    | Clean          | `git status`                                |
| Node.js         | 20.x           | `.nvmrc` → `20.11.0`                        |
| Husky           | 9.1.7          | `node_modules/husky/package.json`           |
| Package manager | npm workspaces | `apps/api`, `apps/web`, `packages/database` |

### Local branches

| Branch                            | HEAD      | Tracking                                 | Status                  |
| --------------------------------- | --------- | ---------------------------------------- | ----------------------- |
| `main`                            | `fceac27` | `origin/main`                            | Up to date              |
| `feat/session-refresh`            | `e3a7e83` | `origin/feat/session-refresh`            | Merged as PR #11, stale |
| `chore/repo-housekeeping`         | `abc24c9` | `origin/chore/repo-housekeeping`         | Merged to main, stale   |
| `feat/platform-ops-hardening`     | `47ea5b1` | `origin/feat/platform-ops-hardening`     | Merged to main, stale   |
| `feat/aps-mock-mode`              | `19bc2df` | `origin/feat/aps-mock-mode`              | Merged to main, stale   |
| `feat/platform-runtime-hardening` | `b9c1bc8` | `origin/feat/platform-runtime-hardening` | Merged to main, stale   |
| `refactor/project-detail-split`   | `301f58c` | `origin/refactor/project-detail-split`   | Merged to main, stale   |

### Remote-only branches

| Branch                                       | HEAD      | Status                                              |
| -------------------------------------------- | --------- | --------------------------------------------------- |
| `origin/feat/web-api-service-layer`          | `c83be54` | Merged to main, stale                               |
| `origin/codex/fix-important-code-base-error` | `6bc510e` | Superseded by `chore/repo-housekeeping` (Husky fix) |

## 3. Merged PRs / Completed Work

| PR       | Branch                                     | Merge Commit | Scope                                                           | Notes                    |
| -------- | ------------------------------------------ | ------------ | --------------------------------------------------------------- | ------------------------ |
| (pre-PR) | `fix/webhook-workitemid-match`             | `053718f`    | workItemId exact match                                          | Plan PR 2                |
| (pre-PR) | `refactor/remove-validation-route-aliases` | `37e18fd`    | Remove `/api/validations` aliases                               | Plan PR 5                |
| (pre-PR) | `fix/rate-limiter-memory-fallback`         | `7c5dead`    | Per-endpoint memory fallback thresholds                         | Plan PR 4                |
| (pre-PR) | `chore/gitignore-local-ai-artifacts`       | `71e95a2`    | .gitignore cleanup                                              | Housekeeping             |
| (pre-PR) | `chore/add-missing-db-indexes`             | `aa812df`    | DB indexes + workItemId @unique                                 | Plan PR 6                |
| (pre-PR) | `fix/polling-backoff-max-retries`          | `0eb5987`    | Polling exponential backoff                                     | Plan PR 3                |
| (pre-PR) | `chore/quarantine-dead-code`               | `95462c1`    | Quarantine workflow/comparison/supremacy                        | Plan PR 11               |
| (pre-PR) | `chore/docker-healthchecks`                | `4f82f06`    | Docker health checks + restart policies                         | Plan PR 12               |
| #2       | `chore/audit-quickwins`                    | `44569a0`    | PrismaClient singleton + cache await                            | Plan PR 1                |
| #3       | `feat/aps-mock-mode`                       | `8d132fd`    | APS mock mode for local dev                                     | Additional               |
| #4       | `refactor/project-detail-split`            | `361ed7b`    | ProjectDetail → hooks + sub-components                          | Plan PR 7                |
| #5       | `feat/web-api-service-layer`               | `aefbf15`    | Typed API service layer + CI fixes                              | Plan PR 10               |
| #6       | `fix/api-error-handling`                   | `d755602`    | asyncHandler + AppError + standardized errors                   | Plan PR (error handling) |
| #7       | `feat/observability-logging`               | `def93ee`    | Structured logger, redaction, requestId propagation             | Additional               |
| #8       | `feat/platform-runtime-hardening`          | `b32a622`    | Sentry transport, env Zod schema, morgan removal                | Additional               |
| #9       | `feat/platform-ops-hardening`              | `4b079a4`    | Dockerfile, backups, CI, staging runbook                        | Additional               |
| #10      | `chore/repo-housekeeping`                  | `ec6e5cc`    | SETUP.md, ESLint 0 warnings, Husky v9, PROJECT_STATUS           | Additional               |
| #11      | `feat/session-refresh`                     | `fceac27`    | Token refresh middleware, SESSION_EXPIRED interceptor, CI fixes | Additional               |

## 4. Open / Pushed / In-Progress Branches

_No open branches. All feature work is merged to main._

### Stale branches (safe to delete after merge confirmation)

| Branch                                       | Reason                                  |
| -------------------------------------------- | --------------------------------------- |
| `feat/aps-mock-mode`                         | Merged as PR #3                         |
| `feat/platform-runtime-hardening`            | Merged as PR #8                         |
| `refactor/project-detail-split`              | Merged as PR #4                         |
| `feat/platform-ops-hardening`                | Merged as PR #9                         |
| `chore/repo-housekeeping`                    | Merged as PR #10                        |
| `origin/feat/web-api-service-layer`          | Merged as PR #5                         |
| `origin/codex/fix-important-code-base-error` | Superseded by `chore/repo-housekeeping` |
| `backup/session-refresh-pre-rebase`          | Safety backup, no longer needed         |
| `feat/session-refresh`                       | Merged as PR #11                        |

## 5. Master Plan Status

### Phase 1 — Critical Stability

| #   | Item                                    | Status          | Severity | Evidence                                 | Notes                                                                                       |
| --- | --------------------------------------- | --------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Rate limiter memory fallback            | **merged**      | Critical | `7c5dead`                                | Per-endpoint `TIER_THRESHOLDS` confirmed in `rate-limit.config.ts`                          |
| 2   | workItemId exact match                  | **merged**      | Critical | `053718f`                                | `workItemId: workItemId` at webhook-worker.ts L123                                          |
| 3   | ValidationRun/ComplianceRun duplication | **not started** | Critical | Both models still in schema (L234, L642) | Largest remaining schema migration                                                          |
| 4   | Polling backoff + max retries           | **merged**      | Critical | `0eb5987`                                | `fix/polling-backoff-max-retries`                                                           |
| 5   | ProjectDetail state management          | **merged**      | Critical | PR #4 `361ed7b`                          | Extracted into hooks: useProjectDetail, useFileSelection, useFileOperations, useConversions |

### Phase 2 — Code Quality

| #   | Item                           | Status          | Severity | Evidence                                                                                                                                              | Notes                                         |
| --- | ------------------------------ | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 6   | Frontend API service layer     | **merged**      | High     | PR #5 `aefbf15`                                                                                                                                       | `apps/web/lib/api/` with typed services       |
| 7   | ProjectDetail refactor         | **merged**      | Critical | PR #4 `361ed7b`                                                                                                                                       | See Phase 1 #5                                |
| 8   | Parser consolidation (9→4)     | **not started** | High     | 5 parser files still present (hierarchical, normative, table, mop, validation/parser) + spec-compiler/ + data-extractor + hierarchical-spec-processor | Target: 4 files                               |
| 9   | DB indexes                     | **merged**      | Medium   | `aa812df`                                                                                                                                             | apsUrn, apsUserId indexed; workItemId @unique |
| 10  | Error handling standardization | **merged**      | High     | PR #6 `d755602`                                                                                                                                       | asyncHandler + AppError across all routes     |
| 11  | PrismaClient singleton         | **merged**      | High     | `62e20f7` via PR #2                                                                                                                                   | Only `lib/prisma.ts` has `new PrismaClient`   |

### Phase 3 — Incomplete Features

| #   | Item                          | Status          | Severity   | Evidence                                                                                                    | Notes                                               |
| --- | ----------------------------- | --------------- | ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 12  | Design Automation (DWG→PDF)   | **not started** | Medium     | `design-automation.service.ts` still uses `da-workitem-*` placeholder                                       | Requires Autodesk DA API credentials + testing      |
| 13  | Workflow engine → UI          | **quarantined** | High       | `workflow.service.ts`, `workflows.ts`, `WorkflowStatus.tsx`, `WorkflowTimeline.tsx` moved to `_quarantine/` | Intentionally shelved; 6 DB models remain in schema |
| 14  | DataSource → compliance rules | **not started** | Medium     | `DataSource` model exists but never connected to `Rule`                                                     | Bridge between spec extraction and compliance       |
| 15  | Session refresh token         | **merged**      | High       | PR #11 `fceac27` — token refresh middleware + SESSION_EXPIRED interceptor + CI fixes                        | Done                                                |
| 16  | Socket.IO completion          | **not started** | Low-Medium | Missing Redis adapter, room validation                                                                      | Scaling concern                                     |

### Phase 4 — Production / Operations

| #   | Item                                 | Status             | Severity | Evidence                                                                                                  | Notes                                     |
| --- | ------------------------------------ | ------------------ | -------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 17  | Docker Compose hardening             | **merged**         | Medium   | Health checks (`4f82f06`) + multi-stage Dockerfile + compose fixes (PR #9 `4b079a4`)                      | Resource limits in compose still basic    |
| 18  | Logger: file output + error tracking | **partially done** | Medium   | Structured logger merged (PR #7); Sentry transport wired (PR #8); file output + secret redaction NOT done | Need file transport + external monitoring |
| 19  | Automated database backups           | **merged**         | Medium   | Backup/restore scripts merged in PR #9 (`4b079a4`)                                                        | Cron scheduling not implemented           |
| 20  | CI/CD pipeline                       | **partially done** | High     | CI hardening merged in PR #9 (prisma generate, docker job); CD (auto-deploy) not implemented              | CD = future phase                         |
| 21  | Tests: unit coverage                 | **partially done** | High     | 15 suites, 170 tests pass; but coverage is thin on business logic (services, compliance, parsers)         | Frontend has zero tests                   |
| 22  | SETUP.md accuracy                    | **merged**         | Low      | Full rewrite merged in PR #10 (`ec6e5cc`)                                                                 | Done                                      |

### Additional Cross-Cutting Debt

| #   | Item                          | Status             | Severity | Notes                                                                                       |
| --- | ----------------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------- |
| 23  | Route aliases removed         | **merged**         | Low      | `37e18fd`                                                                                   |
| 24  | Types `any` dispersed         | **partially done** | Low      | ESLint warnings cleared (PR #10), but `forge-apis.d.ts` still has empty `declare module`    |
| 25  | Mixed-language error messages | **not started**    | Medium   | `workflows.ts` (quarantined), `projects.ts`, `authorization.ts` still have Spanish messages |
| 26  | Puppeteer per-request         | **not started**    | Medium   | `report.service.ts` launches new browser per PDF                                            |
| 27  | 42 env vars management        | **not started**    | Medium   | No secrets management; Zod validation done (PR #8)                                          |
| 28  | Cache fire-and-forget         | **merged**         | Medium   | `0ba8198` fixed await on cache set                                                          |
| 29  | Quarantine dead code          | **merged**         | Low      | `95462c1` — workflow, comparison, supremacy engine                                          |
| 30  | Husky v9 migration            | **merged**         | Low      | PR #10 (`ec6e5cc`) — deprecation warning eliminated                                         |

## 6. What Is Actually Still Missing

### Core Functional Architecture

1. **Unify ValidationRun/ComplianceRun** — Two parallel systems for BIM validation. Both models + routes + services exist. This is the biggest remaining schema debt. Depends on nothing; blocks clean compliance features.
2. **Parser consolidation (9→4)** — 5 parser files + spec-compiler/ + data-extractor + hierarchical-spec-processor. Duplicated category detection in 5+ services. Fragile regex. Not blocking but slows feature work.
3. **Design Automation real integration** — DA worker creates placeholder workItemId. Frontend shows conversion tracker but DA doesn't actually work. Requires Autodesk DA credentials and sandbox testing.
4. **DataSource → compliance rules bridge** — `DataSource` model extracts specs from PDFs/Excel but is never connected to `Rule` model. Compliance engine can't auto-generate rules from specs.
5. **Socket.IO completion** — Missing Redis adapter (won't scale to multiple instances), missing room validation (userId/projectId not verified on join).
6. **Workflow engine revival** — Quarantined but 6 DB models remain. If workflows are needed, requires UI integration from scratch.

### Production Operations

7. ~~**Session refresh**~~ — Merged as PR #11 (`fceac27`). ✅ Done.
8. **CD pipeline** — CI exists but no automated deployment. Manual deploy only.
9. **External monitoring** — Sentry transport is wired but not configured with a real DSN. No DataDog/Grafana.
10. **Database backup scheduling** — Scripts exist (PR #9) but no cron/scheduler configured.
11. **Logger file output** — Structured logger works to console only. No file transport, no log rotation.

### Infrastructure / Scaling

12. **Docker resource limits** — Health checks done, but CPU/memory limits in compose are basic.
13. **Redis adapter for Socket.IO** — Required for multi-instance deployment.
14. **Puppeteer pooling** — New browser instance per PDF report. No pooling, no timeout.

### Technical Debt / Cleanup

15. **Frontend test coverage** — Zero test files in `apps/web/`.
16. **Backend test coverage** — 160 tests but thin on business services (compliance, parsers, file operations).
17. **Spanish error messages** — Several routes still have mixed-language error strings.
18. **`forge-apis.d.ts`** — Empty `declare module`; no real type definitions.
19. **Env secrets management** — 42+ env vars, no external secrets manager.

## 7. Recommended Next PRs

| Priority | Suggested PR                        | Branch                                 | Scope                                   | Risk   | Why Now                                             |
| -------- | ----------------------------------- | -------------------------------------- | --------------------------------------- | ------ | --------------------------------------------------- |
| 1        | **PR: parser consolidation**        | `refactor/parser-consolidation`        | 9→6 parser files, eliminate duplication | Medium | Reduces code surface for compliance work            |
| 2        | **PR: unify validation/compliance** | `refactor/unify-validation-compliance` | Schema migration + route consolidation  | High   | Largest remaining debt; cleans DB model duplication |
| 3        | **PR: Spanish → English errors**    | `chore/standardize-error-messages`     | Translate remaining Spanish strings     | Low    | Quick cleanup                                       |
| 4        | **PR: stale branch cleanup**        | (no branch needed)                     | Delete merged local + remote branches   | Low    | Repo hygiene                                        |

## 8. Known Risks / Follow-ups

- **PR #1 open/conflicting**: `codex/fix-important-code-base-error` is open with `mergeable: false`. All changes are superseded by PRs #10 and prior merges. Recommend closing.
- **Stale remote branches**: 7 merged branches remain on origin. Should be cleaned up.
- **Husky v10**: Current fix uses v9 `_/` runtime directory. Upgrading to v10 will require another migration.
- **Design Automation**: Completely stubbed. Frontend conversion tracker shows UI but DA doesn't execute. Not blocking other work.
- **Workflow engine**: Quarantined code + 6 orphan DB models. If workflows are de-scoped permanently, models should be removed via migration.
- **Codex branch**: `origin/codex/fix-important-code-base-error` is superseded — safe to delete.
- **`forge-apis.d.ts`**: Empty type declaration; any code using `forge-apis` has no type safety.
- **Frontend tests**: Zero. Any refactor to web components has no regression safety net.

## 9. Quality Gates Snapshot

| Gate                   | Status                                        | Evidence                           | Date/Context                                   |
| ---------------------- | --------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| `tsc --noEmit` (API)   | ✅ 0 errors                                   | Terminal output                    | 2026-03-10, `feat/session-refresh` @ `548133d` |
| `tsc --noEmit` (Web)   | ✅ 0 errors                                   | Terminal output                    | 2026-03-10, `feat/session-refresh` @ `548133d` |
| `npm test` (API)       | ✅ 15 suites, 170 passed, 1 skipped, 0 failed | Terminal output                    | 2026-03-10, `feat/session-refresh` @ `548133d` |
| `eslint apps/api/src/` | ✅ 0 errors, 0 warnings                       | Terminal output                    | 2026-03-10, `feat/session-refresh` @ `548133d` |
| Security scan          | ✅ 1242 files, 0 issues                       | Pre-commit hook                    | 2026-03-10                                     |
| Docker build           | ⚠️ Not verified this session                  | Last verified in PR #9 work        | —                                              |
| CI (GitHub Actions)    | ✅ Passed (PR #11 merged)                     | PR #11 CI passed, merged into main | 2026-03-10, PR #11 merge `fceac27`             |

## 10. Decisions Log

| Date           | Decision                                                             | Why                                                                                                              | Impact                                                                                 |
| -------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 2026-03-10     | Canonical backup path: `storage/backups/`                            | Verified across 6 sources (scripts, docs, .gitignore, workflow, runbook, compose)                                | All backup references standardized                                                     |
| 2026-03-10     | Husky v9: keep `_/` directory, remove deprecated sourcing lines      | `_/` is Husky 9.x runtime infrastructure (core.hooksPath = `.husky/_`); gitignored, regenerated by `npm prepare` | Deprecation warning eliminated without breaking hook execution                         |
| 2026-03-10     | Quarantine over delete for dead code                                 | Preserves git history, allows easy revival if workflows/comparison are needed later                              | `_quarantine/` directories in API + web                                                |
| 2026-03-10     | `docs/PROJECT_STATUS.md` established as canonical project state file | Single source of truth for project state, verified against git at each session                                   | All agents/sessions must read and update this file                                     |
| Pre-2026-03-10 | Refined 12-PR plan adopted                                           | Systematic approach from codebase audit covering all CLAUDE.md items                                             | 10 of 12 plan PRs now merged; 2 remaining (parsers, validation/compliance unification) |

## 11. Last Updated

| Field                | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| Date                 | 2026-03-10                                                     |
| Branch               | `main`                                                         |
| Last relevant commit | `fceac27` (main HEAD, merge of PR #11)                         |
| Agent                | Antigravity (Claude)                                           |
| Context              | PR #11 merged; post-merge closure applied to PROJECT_STATUS.md |
