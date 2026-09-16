# AI Augmentation Map — Clinical Roundup List

This maps each existing capability (see [USP.md](./USP.md)) to concrete AI improvements. All AI suggestions are human-in-the-loop, explainable, and PHI-aware.

## Core Capabilities → AI

| Capability | AI Augmentation |
|---|---|
| Patient census management | Auto-generated one-line rounding impression synthesized from findings/plan/pending. |
| Datewise visit records | Clinical timeline narrative that turns per-visit records into a readable progress story. |
| Backfeed from previous visit | Smart backfeed that flags what likely changed since last visit and proposes updates to review. |
| Procedure tracking | Procedure-status prediction from plan text (auto-suggest To-Do / In-Progress / Completed / Post-Op). |
| STAT priority alerts | Handoff risk scoring (STAT + pending tests + in-progress procedures + LOS threshold) to auto-rank urgency. |
| Structured findings system | Voice-to-note capture with structured extraction into findings codes, values, and summary. |
| Billing integration | Auto-coding assistant suggesting CPT/ICD from documented findings and procedure language. |
| Handoff generator | Smart handoff that prioritizes high-risk patients and auto-orders by urgency. |

## Views & Navigation → AI

| Capability | AI Augmentation |
|---|---|
| Tabbed workspace | Next-best-action suggestions per patient (labs to follow, consults, discharge blockers). |
| Adaptive UI | Smart filter presets that adapt to time of day and user behavior (morning rounds vs evening handoff). |
| Table and card views | Missing-data copilot that flags incomplete fields (date, provider, follow-up, billing) before save. |
| On-call scheduling | On-call staffing optimizer recommending coverage from historical volume and patient acuity. |
| Calendar view | Predictive census/workload forecasting to anticipate busy days by hospital. |

## Data Import / Export → AI

| Capability | AI Augmentation |
|---|---|
| CSV/Excel bulk import | Import cleanup copilot for column mapping, typo normalization, and hospital standardization. |
| Bulk import preview | AI-assisted merge suggestions for conflicting fields between new and existing records. |
| Duplicate detection | Fuzzy near-duplicate detection across MRN/name/date beyond exact matching. |
| Excel export | AI chart abstraction that drafts concise patient summaries for reports/PDF exports. |

## Platform & Sync → AI

| Capability | AI Augmentation |
|---|---|
| Dual-mode operation | Predictive prefetch/caching of records most likely needed next to smooth offline use. |
| Microsoft 365 native | Semantic search over historical rounds (find similar prior cases by diagnosis/procedure). |
| Polling sync | AI anomaly detection for unusual LOS, repeat admissions, or sudden census spikes by hospital. |
| Offline resilience | Smart alerting for follow-up gaps (stale updates, unresolved pending tests). |

## Compliance & Access → AI

| Capability | AI Augmentation |
|---|---|
| Role-based access control | Human-in-the-loop approval workflows for all AI-generated clinical/billing suggestions. |
| Audit logging | Audit intelligence highlighting unusual access/edit patterns for compliance review. |
| Compliance modes | PHI-safe redaction assistant that adapts to role and active compliance mode. |
| PHI-aware exports | Explainability panel for every AI suggestion (why suggested, source fields, confidence). |

## Analytics → AI

| Capability | AI Augmentation |
|---|---|
| Analytics dashboard | AI-generated daily executive brief (census totals, procedure pipeline, pending bottlenecks). |
| Custom query input | Natural-language analytics mode (e.g., "show STAT cases at WGMC this week"). |
| Risk & Pending Focus preset | Predictive discharge-readiness scoring from plan progress and pending items. |
| Procedure Pipeline preset | Task extraction from free-text plans into actionable checklists with due-date suggestions. |

## Cross-Cutting Principles

- **Human-in-the-loop** — Clinicians/billers approve every AI suggestion before it is applied.
- **Explainability** — Each suggestion shows source fields and confidence.
- **PHI-safe** — Redaction and role-aware masking honored across all AI features.
