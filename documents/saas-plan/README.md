# Clinical Roundup: Option C build and scale plan

**[Download the Excel workbook](Clinical-Roundup-SaaS-Build-and-Scale.xlsx)** · [Computed companion snapshot](snapshot.json) · [Generator and inputs](../../tools/planning/)

This is an actual macro-free `.xlsx` cash-planning and delivery workbook, **not authorization to migrate or change the live PoC**. The application, API and deployment files are unchanged. Default scope is a dedicated, commercial **clinical-rounding multi-tenant SaaS**, with **AI and CTMS off**. USD, US-based hiring assumptions, a proposed East US Azure managed modular monolith, 60 monthly periods beginning **2026-11-01**. US hiring is a benchmark basis, not an assertion about the founder's preferred location.

It is a **model, not a quote, accounting opinion, investment recommendation, compliance attestation or promise of customers, valuation, clinical safety or enterprise readiness**. Spending was not fitted to a target valuation or fixed million-dollar budget.

## Computed default results

The following section is refreshed by the generator from the same machine-readable inputs as the workbook, rounded to whole USD. It is not an independently invented estimate.

<!-- computed-results:start -->
| Scenario | Five-year cash spend | Year 1 spend | Peak FTE incl. founder | Cash low | Additional funding gap |
|---|---:|---:|---:|---:|---:|
| Lean | $6,008,394 | $678,049 | 6.95 | $-4,247,800 | $4,247,800 |
| Base | $10,907,250 | $1,027,453 | 12.75 | $-5,465,730 | $5,465,730 |
| Growth | $20,697,579 | $1,515,576 | 23.00 | $-7,025,274 | $7,025,274 |

Optional scope sensitivity (total five-year spend; incremental staffing and vendor cash included):

| Enabled options | Lean | Base | Growth |
|---|---:|---:|---:|
| AI only | $6,582,095 | $12,044,445 | $22,875,931 |
| CTMS only | $6,760,129 | $12,496,275 | $23,325,108 |
| AI and CTMS | $7,333,830 | $13,633,470 | $25,503,459 |
<!-- computed-results:end -->

Funding gap is the **maximum cumulative cash shortfall**, after the scenario's initial cash, hypothetical financing and assumed revenue—not the sum of monthly deficits. Baseline initial cash is Lean $500k / Base $1M / Growth $2M; hypothetical financing is $1M in month 13 / $3M in month 13 / $6M in month 10 respectively. **None is committed.** Negative cash can occur before financing arrives; the model does not automatically stop operations or arrange bridging finance. Cost-only cash and first-negative-month runway are also visible; do not rely on forecast sales to fund engineering.

Optional sensitivity retains the same core customer/revenue assumptions: there is **no assumed AI/CTMS revenue uplift**. Optional costs include specialist capacity as well as evaluation/integration/provider expenses. The scenario comparison uses the same global stack and scope switches for all three scenarios.

## Use the workbook

1. Start on **Start Here**. Select Lean/Base/Growth, start date (first of month), Azure **or** AWS, optional scope and founder paid/unpaid status.
2. Review blue editable cells on **Assumptions**, **Staffing** and **Nonlabor**. Green cells are formulas; amber identifies price/evidence uncertainty. Selected assumptions are distinct from historical/public benchmarks.
3. Read **Requirements**, **Migration WBS**, **Architecture**, **Roadmap** and **Risks and Funding** before committing capital. Follow IDs from requirements → WBS → staffing/non-labor pools. Source IDs link the cost rows to **Sources**; public URLs are clickable.
4. Inspect **Monthly Model**, **Annual Summary**, **Scenario Comparison** and **Charts**. Expand grouped columns to see workload/category detail. **Staff Months** and **Vendor Months** expose quantity/rate/date/scope calculations for audit.
5. Resolve unresolved source/quote lines, update assumptions and obtain specialist/customer approvals. Review cash monthly and reforecast quarterly. Gates override optimistic dates.

There are 19 sheets, frozen panes, filters, dropdowns, input validation, internal navigation, currency/date/percent formats, cash warnings and seven formula-linked charts. Roadmap has a month-based Gantt and WBS has low/high effort ranges. No macros, external workbook links, PHI, real patient fixtures or proprietary spending data are included.

### Editing versus regenerating

Excel-compatible desktop applications recalculate formulas when inputs change. The committed binary was **opened and saved headlessly by LibreOffice Calc 24.2.7.2**, not by Microsoft Excel, and contains evaluated formula caches. Native Microsoft Excel UI/visual behavior has **not** been exercised. Chart layout can differ by viewer.

`snapshot.json` contains computed monthly, project-year, calendar-year, scenario and option sensitivity results. It is the offline companion, **not an import of workbook edits**. Changing cells in Excel does not update JSON or this README. To preserve/reproduce changes, edit the JSON inputs and regenerate. Re-generation overwrites the workbook, snapshot and this README's marked computed-results section. Do not overwrite a manually edited workbook without saving it separately.

Without `--recalculate`, openpyxl writes formulas with recalc-on-open but **does not evaluate them**. Such a regenerated binary may have blank formula results in preview-only viewers until Excel/LibreOffice recalculates. The freshly generated snapshot still provides computed results. The committed binary has been recalculated and compared with that snapshot logic.

## Reproduce and validate

Python 3.10+; generation tested with Python 3.12. Pinning includes the direct dependencies and openpyxl's XML helper. Advisory checks reported no known vulnerabilities for these versions when added. `defusedxml` protects XML parsing in the package tests; the generator only consumes the supplied JSON, never arbitrary customer workbooks.

```bash
REPO=/home/runner/work/Clinical-Roundup-List/Clinical-Roundup-List
python -m venv /tmp/clinical-saas-plan-venv
/tmp/clinical-saas-plan-venv/bin/pip install -r "$REPO/tools/planning/requirements.txt"

# Standard-library unittest suite; no application build or new JS test stack needed.
/tmp/clinical-saas-plan-venv/bin/python -m unittest discover \
  -s "$REPO/tools/planning" -p 'test_planning.py' -v

# With a locally installed LibreOffice/soffice executable:
/tmp/clinical-saas-plan-venv/bin/python "$REPO/tools/planning/generate.py" --recalculate
/tmp/clinical-saas-plan-venv/bin/python "$REPO/tools/planning/test_planning.py" \
  --cached "$REPO/documents/saas-plan/Clinical-Roundup-SaaS-Build-and-Scale.xlsx"

# Optional deeper formula checks (requires LibreOffice; uses only /tmp artifacts):
/tmp/clinical-saas-plan-venv/bin/python "$REPO/tools/planning/test_planning.py" --sensitivities
```

LibreOffice is optional, installed separately via the operating system's package manager (tested with `libreoffice-calc` on Ubuntu). The generator uses a temporary isolated LibreOffice profile, a bounded headless process, and no network calls. Omit `--recalculate` if unavailable; use Excel recalculation before distributing the resulting binary. Use `--output-dir /tmp/saas-plan-review` for scratch output rather than changing the committed artifacts. Reproducibility means the same inputs yield the same financial values/formulas, not byte-identical ZIP timestamps or LibreOffice metadata.

### Input files

| File | Purpose |
|---|---|
| `tools/planning/inputs.json` | Scenario assumptions, controls, staffing ramps/salary selections, stable non-labor cost IDs |
| `tools/planning/sources.json` | Primary URLs, actual access/attempt date, effective/survey date, public benchmark vs selected allowance, uncertainty and refresh |
| `tools/planning/scope.json` | Repository-grounded requirements, WBS, architecture, roadmap and risk register |
| `tools/planning/generate.py` | Formula workbook, numeric companion, optional safe recalculation and computed README section |
| `tools/planning/test_planning.py` | Arithmetic, package, formula/source/traceability and cached-result checks |

Keep the 60-month horizon and Lean/Base/Growth names when editing this model. Non-labor lines, source entries and staffing roles can be added by extending the same schemas and regenerating. WBS/roadmap month assumptions require human dependency and capacity review; this is not an automatic resource-leveling scheduler. Optional staff start dates follow their scenario expansion start; their end date and FTE bands remain editable in Staffing.

## Repository evidence and migration plan

Grounding reviewed the current README, root HTML and integration/import modules, `api/*`, Static Web App configuration, Pages workflow, USP/AI documents, executive brief, AGENTS decision log, testing guides and healthcare-compliance specifications.

- **Current architecture:** browser → MSAL/Entra → Graph → SharePoint Lists / OneDrive, plus local mode. `README.md` and `m365-integration.js` supersede the Firebase architecture described by `.github/copilot-instructions.md`. `AGENTS.md` records the migration decisions; historical costs and completion claims are not verified spending/control evidence.
- **Reusable capabilities:** census/encounters, backfeed, procedures/STAT, findings, handoffs, on-call, import preview/duplicate handling, exports, document operations and mobile behavior in `clinical-rounding-adaptive.html`, `m365-integration.js` and `import-engine.js`. “Implemented” means code present, not independently tested or customer deployed. User-reported successful PoC is acknowledged, not re-certified.
- **API alternative:** `api/patients/index.js` already has role checks, masking and audit calls; `api/shared/dataService.js` still targets Graph/SharePoint. These are useful contract/design inputs, not proof of tenant isolation, trusted gateway identity or secure deployed enforcement. `staticwebapp.config.json` describes an Azure path, not the Pages deployment.
- **Testing:** `docs/testing/*` are valuable manual acceptance inputs. `api/package.json` has a placeholder `test` command (`No tests yet`). `.kiro/specs/healthcare-compliance/*` requirements/design/tasks are evidence to investigate; completion checkboxes are **not** evidence of deployed controls or passing automated tests.
- **Versions:** root files, `release/`, old Azure integration, backups and archived alternatives are inventoried—not consolidated or deleted by this PR. The Pages workflow copies a static subset; it does not deploy the proposed SaaS backend.

Core assumed path:

| Months | Gate | Main outputs |
|---|---|---|
| 1–3 | Assess | Buyer/intended use, source-of-truth inventory, characterization tests, scope and threat discovery |
| 4–8 | SaaS foundation | Modular UI/services; tenant memberships/authorization; relational schema/migrations/indexes; API validation/contracts; managed environments |
| 9–11 | Synthetic pilot | Import/export/document parity; SharePoint mapping; count/hash/field reconciliation; load/isolation, restore and rollback drills |
| 12–15 | Approved customer pilot | Clinical, security and legal/data-handling approval; independent review/retest; staged tenant cutover, onboarding, support and billing |
| 16–24 | Repeatability | Deployment/onboarding/operations evidence, feedback, retention and cost measurement |
| 25–60 | Conditional growth | Demand- and capital-gated hires, measured scaling, quarterly reforecast |

Assume two-week iterations, small vertical slices, acceptance criteria, PR review, automated tests/security checks, staged release and feedback. Confidence/ranges and owners are in Roadmap/WBS. Additional headcount does not mechanically shorten these dates.

**Migration is more than copying rows:** design tenant + source/facility patient identity and distinct encounters (`mrn|date` is insufficient across organizations and may need multiple-encounter policy). Inventory actual SharePoint internal fields/types/choices/nulls/time zones/JSON findings and document references. Rehearse synthetically, maintain a source-to-target ID map, explain all count/hash/field differences, and stage tenant cutovers with a write-pause/single-writer source-of-record and explicit rollback window. Do not assume uncontrolled dual writes remain consistent. Keep PoC coexistence/retirement and customer exit/retention approvals separate from cutover.

## Architecture and scope alternatives

- **Baseline candidate:** Azure East US managed modular monolith: frontend/API/worker, PostgreSQL Flexible Server, object storage, queues, identity, secrets, observability, edge/WAF, DNS/email, and isolated dev/staging/prod. Production primary + standby DB and redundant app instances are **proposals**, not verified SKUs or a guaranteed SLA.
- **Credible alternative:** AWS US East App Runner / RDS PostgreSQL Multi-AZ / S3 / SQS / Secrets Manager / CloudWatch / Cognito / CloudFront-WAF. Azure app+DB allowances are replaced by the alternative app+DB bundle, **never summed**. Shared blended storage/logging/edge allowances remain as explicit estimates; vendor-specific quotes must replace them before selection.
- Architecture records quantity drivers, HA, retention, scaling triggers and assumed implementation effort. Request/storage/log/customer growth affects variable costs, but capacity reserves and fixed bundles are not a substitute for load testing and SKU pricing. Cross-region DR, private networking or enterprise identity requirements may materially increase costs.
- **Optional AI:** default off; candidate GPT-4.1-mini input/output allowances are **unverified**, not approved current prices. Synthetic evaluations, human approval, provenance, privacy/provider/endpoint/contracts review, limits and fallback precede use with sensitive data. Dedicated capacity, token usage and external evaluation are separate costs.
- **Optional CTMS:** default off; separate research-domain and integration capacity, study/site/subject/protocol model, EDC/eTMF interfaces, buyer research and scope-dependent validation/e-signature assessment. It is **not** relabeling patients as studies. Default discovery windows are nine months for AI and 18 months for CTMS; scenario start dates differ where appropriate and remain gated.
- Retaining customer-owned M365 or the existing Azure/SharePoint API is a valid lower-change business alternative, but **not counted as an additional paid stack** in this Option C model. EHR connectors, native apps and Kubernetes/microservices are deferred pending specific evidence and separate estimates.

## Cost methodology and pricing gaps

**Research access/attempt date: 2026-10-20.** Primary GitHub pricing HTML was readable: Team **$4/user/month**, Enterprise **starting at $21/user/month** (not selected or charged). Annual-price markup includes “first 12 months”; renewal, billing cadence, add-ons and taxes need confirmation. The model applies its selected Team rate and annual inflation; this is not a five-year vendor commitment.

BLS, Azure retail/pricing and OpenAI primary retrievals failed with DNS/network errors. The source catalog preserves URLs, attempts and limitations:

- Software developer **$133,080 national median, May 2024**, was supplied as historical context in the task; primary verification/newer survey retrieval did not succeed. It is marked **Unverified**, not “latest.” QA/design/support/management amounts are not invented public survey results. All selected salaries are separate editable assumptions, **not precise startup hiring quotes**.
- Employer burden defaults to **40% of wages**, an explicit allowance, not a verified BLS result. Benefits/wages = benefits hourly cost ÷ wage hourly cost. If a source gives benefits share `s` of total compensation, convert with `s/(1-s)`. Do not use `s` directly as a salary uplift or add payroll tax twice.
- Azure/AWS configurations and selected app/DB/edge bundles are **Quote required** allowances. No SKU/meter price or service eligibility was verified; exact retail API query attempt is cataloged. Storage/logging/request rates are blended planning reserves, not retail meters.
- Independent penetration testing/retest, legal/privacy/BAA/contracts, validation/readiness, insurance and accounting use explicit external-service allowances with quote flags. They do not claim certification or repeat already-staffed engineering implementation fees.
- AI input/output provisional rates are **$0.40/$1.60 per million tokens**, explicitly **unverified selected allowances**, not a claim about present availability/pricing/privacy terms. AI remains off until verified and approved.

The dashboard reports the **active unresolved vendor line count and five-year unresolved allowance subtotal**. This does not imply remaining selected salaries or other allowances are verified. Missing public prices are never silently modeled as free. Refresh exact SKUs/regions/tiers/minima/HA/backup/egress/retention/renewal, obtain vendor and specialist quotes, and record source effective dates before commitments.

### Arithmetic conventions

- Staffing is annual selected salary/12 × monthly FTE × annual escalation. FTE bands: months 1–6, 7–15, 16–30, 31–60, bounded by role start/end. Employees receive the wage-based burden; fractional contractors use annual retainer equivalents with no additional employee burden. Role slots are ceiling(FTE) per role, **not** FTE or a promise of separate dedicated hires. Recruiting/equipment apply only to positive FTE additions; no automatic annual replacement or vacancy lag.
- Founder opportunity salary is an economic cost outside cash spend while unpaid. Paying the founder moves it into cash, not both. Founder taxes/benefits are not implicitly treated as employee burden; review entity/tax treatment.
- Non-labor = selected unit rate × enabled quantity × annual inflation step. Monthly items recur; annual items occur at start + 12n; once items occur once. Cloud and optional-scope gates are applied before cost. Optional staffing and annual services start at the scenario expansion month; do not move dates earlier without reviewing dependencies.
- WBS person-days are assumed effort/ranges and **informational allocations of the staffed capacity**. They are not separately charged. Long-term staffing also covers product iteration/operations beyond the initial WBS. External assessments are independent deliverables, not a second developer labor budget. Resource-level WBS feasibility must be confirmed.
- Contingency is applied **once** to staffing cash, recruiting/equipment and non-labor vendor cash. It excludes unpaid founder economic cost and payment fees. Fees are modeled as 3% of monthly subscription revenue (allowance, no vendor quote). Contingency is a cash reserve treated as spend, not additional financing.
- Revenue uses expected-value customer cohorts: opening customers × (1 − monthly churn) + new customers. New-customer acquisition increases annually from the launch month; fractional customers are allowed for planning. Monthly revenue = active customers × ARPA; immediate collection/no prepay/no bad debt assumed. **Exit ARR is monthly recurring revenue ×12, not recognized annual revenue.** No market validation or revenue from optional expansions is assumed.
- All sheets are a **cash budget, not audited P&L/GAAP classification**. Recruiting, product engineering, sales, legal and readiness are operating cash outlays. Production hosting, support, implementation and optional inference may become COGS, but environments/roles are mixed here; allocate actual service-delivery costs before claiming gross margin. Equipment may require capitalization in real accounts; this budget counts purchase cash once.
- Tax payments, financing fees/interest, equity dilution, depreciation, commissions, working-capital collection delays, customer-specific integrations, large EHR deals and unknown regulatory obligations are excluded or need separate estimates. No guaranteed tax or healthcare suitability assumptions.
- Both project Years 1–5 and partial calendar years reconcile to all 60 months. Financing is not negative cost or revenue. Runway is first negative closing-cash month, `>60 months`, or `Not funded` when initial cash is zero—not cash divided by an average burn. Cost-only cash removes revenue receipts while keeping the forecast cost/usage path, including the modeled payment fee reserve.

## Validation and remaining approvals

Executed during artifact development:

- Standard-library tests for known payroll/one-off/cash arithmetic, date bounds, founder economic/cash separation, exclusive stack selection, one-offs, option start/disabled behavior, scenario sensitivity and monthly/year reconciliation.
- ZIP integrity and XML parse checks, 19-sheet manifest, source/requirement/WBS references, no broken sheet links, no macros/external workbook dependencies, chart range checks.
- Headless LibreOffice recalculation and cached-result checks for every formula error/missing result; numerical comparison of all scenarios' monthly FTE, cash/vendor costs, revenue, cash balances and funding gaps to the independent Python computation. Additional cached checks cover AI only, CTMS only, combined expansion with AWS and paid founder, and alternative February/January start dates.

Not performed: Microsoft Excel desktop/UI testing, real customer migration, application security/control attestation, live cloud provisioning/pricing calculation, workload benchmark or regulatory review. Current PoC runtime tests/deployment were not modified or used as proof of future SaaS quality.

Before approving a build: confirm buyer/clinical scope, hiring location and availability, pilot data classification, identity/tenant boundaries, source schema/export permissions, retention and restore targets, exact infrastructure/identity/email SKUs and eligibility, renewed prices, quotes, financing timing, procurement/onboarding lead time, and specialist legal/security/clinical acceptance. A compliant cloud service does not make the application compliant; HIPAA/BAAs and research validation/e-signatures require qualified review. SOX is not assumed mandatory.
