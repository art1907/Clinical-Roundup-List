# Context Transfer — Clinical Roundup List (`art1907/Clinical-Roundup-List`)

**Purpose:** hand-off for another Claude instance. Written 2026-11-06 from a review of the repository code, git history (277 commits, 2026-01-12 → 2026-10-20), PRs and the Pages deployment config.

**How to read this file**
- The repo's own docs (`AGENTS.md`, `FINAL_STATUS.md`, `.kiro/.../tasks.md`, `README.md`) **overstate or misdescribe** what is built. This file separates three evidence levels:
  - ✅ **CODE-VERIFIED** — I found it in the source and confirmed it is wired into the running app.
  - ⚠️ **SCAFFOLD / PARTIAL** — code exists but is not wired in, is in-memory only, or is test-only.
  - 📄 **DOC-ONLY / STALE** — described in docs, absent or obsolete in code.
- Not verified: I did **not** run the app in a browser, did **not** reach the live Pages site (sandbox has no outbound access to it), and did **not** inspect the real SharePoint schema (field names below are inferred from the Graph mapping code).
- Real Entra tenant ID, client ID, SharePoint site ID and 4 list IDs are hard-coded in `m365-integration.js` (`M365_CONFIG`) in a public repo. They are identifiers, not secrets, but be aware. They are intentionally not repeated here.

---

## 1. What the product is

Mobile-first clinical **rounding / patient census** web app for a urology-style practice (statuses, procedures, hospitals WGMC/AWC/BTMC/AHD/BEMC, "Abrazo West" etc.). Origin: an Excel "Rounding List" diary → single-file HTML app.

- **Single static HTML file, no build system:** `clinical-rounding-adaptive.html` (~18.9k lines, ~990 KB). Tailwind via CDN, PapaParse, SheetJS (`xlsx`), jsPDF + autotable, MSAL-browser 2.32.2 (all CDN, SRI-pinned except Tailwind).
- **Two runtime modes:** *Local* (in-memory/localStorage, no login) and *M365* (Entra login via MSAL redirect flow → Microsoft Graph → SharePoint Lists + OneDrive/doc library). Mode auto-detected from `M365_CONFIG`.
- **Owner/maintainer:** art1907. Single developer + AI assistants (Copilot/Claude style commit messages; Kiro specs; Snyk/Aikido rules).

---

## 2. BUILT artifacts (current `main`)

### 2.1 Files that actually run
| File | Role | Status |
|---|---|---|
| `clinical-rounding-adaptive.html` | The whole app (UI + logic) | ✅ live, primary artifact |
| `m365-integration.js` (2,192 lines) | MSAL auth, Graph requests (retry/timeout), SharePoint CRUD, audit log write/read, on-call, settings, doc-library uploads, OneDrive export, polling (15 s), localStorage cache (500), server-side session-invalidation policy | ✅ live |
| `import-engine.js` (522 lines) | Bulk import engine: throttled concurrent save queue, 429 back-off, AbortController timeouts, checkpoint/resume (localStorage), circuit breaker, Graph `$batch` grouping; used by the 5-step Import Wizard | ✅ live |
| `index.html` | Redirect to the app | ✅ |
| `.github/workflows/deploy-to-pages.yml` | On push to `main` touching the HTML / m365 js: copies files to `_site` and deploys via `actions/deploy-pages` | ✅ (see §6 re: Pages config) |

### 2.2 Features verified in code (✅)
- **Census** with 3 view modes (`table | card | grouped`, persisted), 12 tabs: Census (active), Procedures, Calendar, Timeline, Analytics, Reports, Audit, Shift Report, Procedure Log, Review (human-review queue, flashing amber), On-Call, Archive. Mobile toolbar/scroll hints, system ribbon, sortable headers, column visibility (incl. follow-up column), summary-stat buttons, advanced filters.
- **Visit model:** one row per patient per visit; `VisitKey` unique key. Originally `mrn|date`; since 2026-02-08 it is **timestamp-based** (VisitTime added). Backfeed/"Follow Up" creates a new visit pre-filled from prior visit; "Previous visit reference card" shown in modal.
- **Statuses (6, hard-coded `STATUS_OPTIONS`):** NEW CONSULT · SURGICAL PATIENT (SAME DAY SURGERY) · NEW SURGICAL PATIENT (AM ADMIT) · FOLLOW UP (CONSULT) · FOLLOW UP (POST OP) · TO BE DISCHARGED/SIGNED OFF. (Docs still say To-Do/In-Progress/Completed/Post-Op — **stale**.)
- **Patient modal:** view mode + explicit edit toggle; amendment warning on editing existing record; mandatory **change-note ("Reason Required" modal)** for edits/deletes/archives; follow-up modal; STAT priority checkbox (priority styling); gender, zip code, finance fields (added Sept 2026); SOAP-style layout (Subjective/Objective/Assessment/structured Plan) with repeatable imaging cards — stored in the **`CatchAll`** SharePoint field (no schema change); change-notes history + findings snapshot history; visit history with status-change indicators; patient document upload/list/delete (SharePoint library, per-patient folder).
- **Findings/Investigations:** checkbox findings with values, per-finding dates, `INVESTIGATION_CATALOG` (LOINC-style metadata), structured envelope (`values/dates/meta`) in `FindingsData`, "date review" workflow that flags defaulted/ambiguous dates for human review (large amount of Jun-2026 work), additional-findings comments.
- **Procedures:** procedure codes/dates/values (`ProcedureCodes/ProcedureDates/ProcedureData`), procedure date token embedded in `Plan`, calendar linking, procedure calendar event normalization + conflict-resolution modal, Procedure Log tab, Shift Report tab.
- **Import:** Import Wizard (5 steps) + `import-engine.js`; CSV/XLSX 3-pass parse (on-call rows, header map, patient rows w/ hospital section detection); preview with New vs Duplicate; non-destructive merge, intra-file dedupe; returning-patient backfill; hospital/room column handling; local-prefixed IDs for bulk import (fix for Graph 404).
- **Reports/Analytics:** analytics presets (overview, procedures, hospitals, risk, provider, follow-up, complexity, performance, billing-completeness …) + validated `key:value` custom query (multiple pairs, max-length raised Sep 2026); practice reports incl. provider-detail, code-utilization, billing readiness, procedure pipeline, follow-up worklist; PDF export; print single/multiple records.
- **Admin/data tools:** auto-save interval setting, "Clear all data", auto-clear local/SharePoint, mass delete with confirmation (Jun 2026).
- **Audit:** every CRUD/file op writes to the SharePoint `AuditLogs` list through `m365LogAuditEvent`; Audit tab reads/filters it (noise-reduced, expandable context rows).
- **Auth/session:** MSAL redirect flow with loop circuit-breaker; session-invalidation via `Settings` list keys (epoch / force-logout-before-UTC) evaluated on each settings poll; sessionStorage cache.
- **SharePoint field names used by code** (internal names; Graph mapping is the schema source of truth): `Title, Room, Date, Name, DateofBirth, Gender, ZipCode, Finance, MRN, Hospital_x0028_s_x0029_ (or Hospital), VisitTime, VisitKey, FindingsData, FindingsCodes, FindingsDates, FindingsText, ProcedureCodes, ProcedureDates, ProcedureData, Plan, Progress_x0020_Notes, SupervisingMD, Pending, FollowUp, ProcedureStatus, CPTPrimary, ICDPrimary, ChargeCodesSecondary (JSON), CatchAll (JSON/structured), Priority (tolerates several field types/aliases), Archived (boolean), ChangeNotesHistory/NotesHistory, CreatedBy`. Other lists: `OnCallSchedule (Date, Provider, Hospitals)`, `Settings (Key, Value)`, `AuditLogs (UserIdentity, ActionType, RecordId, Details, Timestamp)`, doc library `PatientDocuments` (PatientId, MRN, Visitkey, PatientName, UploadedBy, UploadedAt, OriginalName, FileSize, ContentType).
- `m365SavePatient` has schema-tolerance logic (retry PATCH one field at a time, drop unknown fields, alias pairs, create-or-recover on unique VisitKey conflict) — a response to SharePoint schema drift pain in Feb–Mar 2026.

### 2.3 ⚠️ Scaffold / partial — NOT real security controls
The repo's `.kiro/specs/healthcare-compliance/tasks.md` marks **all phases [x] done**. In code this is only a **client-side demo/test scaffold**:
- `ComplianceEngine, SessionManager, RBACEngine, EncryptionService, KeyManagementService, TransportSecurity, DataLifecycleManager, ExternalExportService` (HTML ~L3542–4300) and `AnomalyDetector, IncidentManager, PrivacyControlsEngine, VendorGovernanceEngine, FinancialControlsEngine, UIAdaptationEngine, UIPrivacySafetyEngine` (~L16169–17700) are **in-memory `Map`s in the browser**.
- Their callers are the `globalThis.test*` / `runComplianceTests` harness (~L15928–17700). `RBACEngine.checkAccess/hasPermission`, `EncryptionService.*`, `SessionManager.createSession` are invoked **only from tests**.
- Compliance mode is always `relaxed` (`globalThis.__compliance_mode` is never set). No Entra app-role claims are read (`m365-integration.js` has no role handling) → **no enforced RBAC, no field masking by role, no client-side encryption, no MFA enforcement in the real flow.**
- The one part wired to reality is `AuditLogger` (`logDataChange/logDataAccess/logFileAttachment/logError` → forwards to `m365LogAuditEvent` → SharePoint). Even so, "immutability" is just an array.
- The compliance design doc still describes a **Firebase** app (obsolete; Firebase was removed Jan 2026).
- Treat README roadmap items "HIPAA Strict Mode / SOX Strict Mode" as **not done** (README is right about that; `.kiro` tasks and `USP.md` "Role-based access control / field masking" are wrong/overstated).

### 2.4 📄 Present in repo but dead / stale / not used by the running app
- `api/` (Azure Functions: patients, backfeed, onCallSchedule, settings, export + `shared/dataService.js`), `staticwebapp.config.json`, `azure-integration.js` (Firebase-replacement snippet): **no frontend references to `/api/*`**; API field list lags the frontend (no gender/zip/finance/CatchAll etc.). `api/package.json` test script = "No tests yet". Azure SWA workflow was deleted 2026-02-07. Per the SaaS-plan PR, `api/patients` has role checks/masking/audit calls — useful as a design input only, not proven.
- `release/` bundle (HTML 17.7k lines, m365 js, Netlify/Deployment docs): last synced 2026-07-23; **behind main** — has no gender/zip/finance and only ~2 SOAP/CatchAll references vs 20 on main.
- Junk/artifacts at repo root: `d1` (a 1.4 MB PDF with no extension), `clinical-rounding-adaptive.html.orig`, `.rej`, `patch1.patch`, `Clinical-Rounding-Platform-v1.0.zip`, `tools/diagnostics/*`, `tools/temp/*` (brace-counting / truncation repair scripts from the Mar-2026 "truncated HTML" incident), `_archive/*` (completion-report style docs).
- `.github/copilot-instructions.md` is a byte-copy of `README.md`. `.github/instructions/copilot-instructions.md` begins with **"Canadian Legal Assistant"** instructions (unrelated project; pointing at non-existent `.kiro/specs/canadian-legal-assistant/*`) then a generic multi-IDE assistant prompt. `.github/instructions/aikido_rules.instructions.md` (run Aikido scan on changed code). `.github/notion` is a Notion MCP config. **None of these describe this project reliably.**
- `AGENTS.md` is a Jan-2026 log (v3.0, last entry 2026-01-18) — decisions in it are still partly valid (see §4) but its statements about RBAC, role masking, "Success Criteria Met", cost tables and statuses should not be trusted as built state. `FINAL_STATUS.md`, `COMPLETION_REPORT.md`, `INTEGRATION_READY.md` etc. are self-congratulatory status reports.
- `documents/AUDIT_FINDINGS.md`/`IMMEDIATE_ACTIONS.md` document the Feb-2026 login/connection-status bug; resolved in the Feb 7 commits.
- `gh-pages` branch: stale since 2026-02-07 (not the source of the current site).
- `README.md` says "Last updated March 16, 2026" and links `AZURE_STATIC_WEB_APP_DEPLOYMENT.md` (deleted 2026-05-13).

### 2.5 Other deliverables (non-code)
- Docs: `documents/USERGUIDE.md` (most up-to-date doc; includes SOAP layout + CatchAll storage note, v of 2026-07-17), `GRAPHIC_USER_GUIDE.html`, `USP.md`, `AI_USP.md`, `documents/AI_AUGMENTATION_OPTIONS.md` (25 AI ideas, human-in-the-loop), `documents/config.md` (Entra/SharePoint setup checklist; scopes `Sites.ReadWrite.All, Files.ReadWrite, User.Read`), `documents/encounter.md` (parked design, see §3), `PROCEDURE_*.md`, manual test scripts in `docs/testing/` (20 synthetic records, "teen-friendly" UI test script, "New E2E.md").
- **PR #2 (merged 2026-07-02):** executive brief — `documents/exec-brief/Clinical-Roundup-CTMS-Exec-Brief.{md,doc}`: positions the app as a "clinical operations intelligence layer" wedge toward an AI-native CTMS; 30-min pitch, 6–9 mo CTMS MVP / 12–18 mo enterprise pilot timeline, competitors (Veeva/Medidata/Siebel), risks (21 CFR Part 11, hallucination, tenancy).
- **No automated tests exist for the app** (only manual scripts and the in-page compliance test harness). No linter/CI beyond the Pages deploy.

---

## 3. PLANNED / FUTURE artifacts

### 3.1 In flight — Draft PR #3 `copilot/create-financial-and-delivery-plan` (open, opened 2026-10-20, no app changes)
"Option C" five-year **SaaS build-and-scale plan**: transition PoC (M365/SharePoint) → dedicated commercial multi-tenant SaaS.
- Files (branch only): `documents/saas-plan/Clinical-Roundup-SaaS-Build-and-Scale.xlsx` (19 sheets, Lean/Base/Growth × 60 months from 2026-11-01), `documents/saas-plan/README.md`, `snapshot.json`, `tools/planning/{generate.py, inputs.json, scope.json, sources.json, requirements.txt, test_planning.py}` (+ `.gitignore` tweak). Workbook is generated by pinned Python/openpyxl and recalculated with LibreOffice; not opened in real Excel.
- Computed default 5-yr cash spend: **Lean $6.01M / Base $10.91M / Growth $20.70M**; max cumulative shortfall $4.25M / $5.47M / $7.03M (financing hypothetical, uncommitted). Optional AI/CTMS scope off by default (+~$0.6–2.2M each scenario).
- Architecture candidates (mutually exclusive, not summed): **Azure East US managed modular monolith + PostgreSQL** (baseline) vs AWS App Runner/RDS/S3/SQS/Cognito. Many prices are "quote required"/unverified (BLS/Azure/OpenAI retrieval failed on 2026-10-20).
- Migration gates: months 1–3 assess/characterization tests → 4–8 SaaS foundation (tenant model, server-side authz, relational schema) → 9–11 synthetic pilot (SharePoint reconciliation, rollback drills) → 12–15 approved customer pilot → 16–24 repeatability → 25–60 conditional growth.
- Explicit caveat in plan: `mrn|date` VisitKey is insufficient across organizations/facilities; need tenant + facility patient identity and encounter policy. Retaining customer-owned M365 is a valid lower-cost alternative not counted as a paid stack.
- **Next action:** owner review of the draft; decide merge vs close; replace "quote required" lines with real quotes before relying on numbers.

### 3.2 Parked design — Encounter model (`documents/encounter.md`)
Status "parked for later implementation"; **0 code references** to `EncounterKey`. Target: `MRN` = person, `EncounterKey` = admission, `VisitKey` = `EncounterKey|Date`. Requires new SharePoint columns first: `EncounterNumber` (text, non-unique), `EncounterStatus` (Open/Closed), `AdmissionDate`, `DischargeDate`, `EncounterKey` (text, unique) — confirm **internal names** before coding. Archive, grouped-history, import-dedupe and returning-patient logic need a follow-up pass to scope by encounter; discharge should close only the active encounter.

### 3.3 Roadmap items (README) not started
HIPAA strict mode (masking, encrypted exports), SOX strict mode, advanced analytics/reporting, EHR integration. The 25 AI augmentation ideas (summaries, handoff risk scoring, auto-coding, NL analytics, voice-to-note…) — none implemented; all must be human-in-the-loop, explainable, PHI-safe.

### 3.4 CTMS direction (exec brief)
Intelligence-layer first → CTMS foundation (study/site/user/role/audit model) → CTMS workflows → AI-native. Decisions requested from leadership (module priority, first integrations, pilot compliance level, acceptable AI use cases) are **unanswered in the repo**.

---

## 4. Decisions taken (chronological, with where evidence lives)

**Jan 2026 (architecture, from `AGENTS.md`; still valid unless noted)**
1. Excel diary → HTML app; leave Firebase/Google for Microsoft 365. Rejected Azure Functions + Cosmos hybrid (cost/ops); chose **pure M365** (Entra + SharePoint Lists + OneDrive, Graph called directly from browser). Rationale: 10–50 patients/day, existing licences, $0 infra.
2. **Dual mode** (Local vs M365 auto-detect) — enables zero-setup demo.
3. **Datewise uniqueness** via compound `VisitKey` (same patient/other date = new record). *Later superseded:* timestamp-based VisitKey (2026-02-08).
4. **Backfeed:** copy stable administrative data (room, name, DOB, hospital, plan, supervising MD, CPT/ICD, charge codes); do **not** copy findings/pending/follow-up (and later SOAP narrative).
5. **Polling (15 s) + localStorage cache** instead of SignalR; upgrade only if many concurrent editors.
6. **3-pass CSV import** with hospital section-header detection; **preview-before-import** with New vs Duplicate (rejected a "merge" option as too complex).
7. Typed SharePoint columns + JSON columns for complex data (FindingsData, ChargeCodesSecondary); designed for future Cosmos swap via stable key.
8. STAT visual: whole card red, 4 px border, glow.
9. Planned RBAC roles clinician/billing/admin — **never implemented** in the live app (§2.3).

**Feb 2026 — production hardening (≈51 commits on 2026-02-07)**
- Deploy on **GitHub Pages**, removed Azure SWA workflow. Long MSAL redirect-loop debugging → explicit redirect URI, cookie state, circuit breaker, no double init. Save-lock to stop double submits; renamed M365 API functions to avoid global `savePatient` collision. SharePoint schema reconciliation (DOB→`DateofBirth`, Hospital internal name, Archived boolean, empty-choice omission). Removed Stat Acuity fields (then re-added STAT priority checkbox in Mar). "Minimal save" debug mode exists.
- 02-27/28: Census action buttons replaced by single **View** button; CRUD moved into modal; patient document uploads; comprehensive audit logging; print feature.

**Mar–Apr 2026** — truncated-file incident (diagnostic scripts); change-note requirement for edits/deletes/archives; device-adaptation module; analytics dashboard + presets; schema-tolerant Priority handling with one-time normalization utility; Canadian-holiday logic added then **removed**; footer/Handoff button removed from footer; audit UX noise reduction; default table view on load; selection-lock/"underlay" UX.

**May 2026** — CSV import hardening (non-destructive merge, dedup, consistent VisitKey, `local-` IDs); Human Review tab + tabs reorganised by business flow; Graph retry/timeout; Azure deployment doc deleted; visit-history + practice reports; returning-patient backfill; findings snapshot history; "New Visit" → **"Follow Up"/"Add Follow Up"** terminology.

**Jun 2026** — amendment flow with warnings; session invalidation; terminology moved toward clinical documentation (findings→investigations; procedure name input replaced by notes textarea); **date-review** system (defaulted dates default to record-creation date; user-entered/clinically valid prior investigation dates must be preserved; fixes to avoid auto-save after review); LOINC-style investigation framework with backward-compatible storage; auto-save interval, clear-all, mass delete.

**Jul 2026** — exec brief (PR #2); structured findings envelope; procedure calendar replace logic; **SOAP layout stored in `CatchAll` to avoid SharePoint schema change**; follow-up column visibility; follow-up status routes to new visit; change notes include field-level changes.

**Sep–Oct 2026** — gender, zip, finance fields; calendar shows patient details; card shows gender + SOAP clinical notes; custom-query multi-pair validation; mobile nav/scroll hints (last app commit 2026-10-03); 2026-10-20 draft PR #3 SaaS plan.

**Standing working conventions (inferred)** — direct-to-`main` commits, mostly feature-by-feature; cache-bust by editing version markers; very large single-file edits; Copilot cloud agent used for docs/plan PRs.

---

## 5. Known risks / traps for the next agent
1. **Docs ≠ reality** (see §2.3, §2.4). Always check code. In particular do not claim HIPAA/SOX controls, RBAC, encryption or MFA enforcement.
2. **Cache-busting is stale:** `m365-integration.js?v=2026-04-08T14:40` has not been bumped although the file changed after April; HTML has an `EXPECTED/CURRENT_VERSION` of `2026-06-14T00:00:00Z` (+ "Investigation Date Context V23" log). Users may get stale JS after deploys — bump when editing.
3. **Pages config ambiguity:** GitHub Pages is `build_type: legacy` from `main:/` (serves the entire repo root, including `.orig`, zip, `d1`, docs), while the Actions workflow also deploys a `_site` that omits `import-engine.js`. Pages-legacy still serves the root file, so the Import Wizard should work; if someone switches Pages to "GitHub Actions" source, **`import-engine.js` must be added to the workflow copy step** or the wizard breaks. Verify live site manually.
4. Publicly served repo contains tenant/site/list IDs and synthetic test data; confirm no real PHI ever committed (I saw only synthetic test records; not audited exhaustively). The `.gitignore` excludes xlsx/csv, and a real Excel file was deleted 2026-05-21 — check history if PHI-sensitivity matters.
5. `Sites.ReadWrite.All` delegated scope + browser-side Graph = broad access; no server-side authorization.
6. Single 19k-line HTML: brace/truncation corruption happened before (Mar 2026). Run a syntax check (`tools/diagnostics/check_syntax.js` approach or load in browser) after large edits.
7. SharePoint schema is the hidden contract — `m365-integration.js` silently drops unknown fields on PATCH (logs only, plus a "rejected-field" toast); a missing column looks like data loss.
8. Drift between `main` root files and `release/`; consider treating `release/` as dead or regenerating it.

---

## 6. Suggested next steps (not decided by the owner — confirm first)
1. Decide fate of PR #3 (merge / revise / close) and whether Option C (dedicated SaaS) vs staying on customer-owned M365 is the strategy.
2. Reconcile docs with reality: correct README/USP/`.kiro` task checkboxes, remove or fix the wrong `.github/*instructions*` files, add a short accurate `CLAUDE.md`/`AGENTS.md` based on this file.
3. Repo hygiene: delete `d1`, `.orig`, `.rej`, `patch1.patch`, `tools/temp`, stale `release/` or regenerate it; fix Pages source + workflow; bump cache-bust version.
4. If compliance matters: either implement real controls (Entra app roles, server-side enforcement, masking, session timeouts wired to `SessionManager`) or label the scaffold as such.
5. Encounter model (§3.2) once SharePoint columns are created and internal names confirmed.
6. Add at least characterization/regression tests (the SaaS plan's month 1–3 gate calls for this) — currently none for app code.

---

## 7. Quick orientation map
```
clinical-rounding-adaptive.html   # app; ~L2946 STATUS_OPTIONS, ~L3192 INVESTIGATION_CATALOG, ~L3542-4300 compliance scaffold,
                                  # ~L7255 reports, ~L13256 print, ~L14969 tab buttons, ~L15928+ compliance test harness, ~L18067+ import wizard
m365-integration.js               # M365_CONFIG (top), api_* functions, window.m365* exports (bottom)
import-engine.js                 # ImportEngine class
documents/USERGUIDE.md            # best user-facing doc
documents/encounter.md            # parked encounter design
documents/config.md               # Entra/SharePoint setup checklist
documents/exec-brief/             # CTMS pitch
origin/copilot/create-financial-and-delivery-plan   # draft PR #3 (SaaS plan, xlsx + generator)
```
