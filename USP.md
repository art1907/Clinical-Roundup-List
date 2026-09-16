# Clinical Roundup List — Unique Selling Points (Capabilities)

A mobile-first clinical rounding and patient census platform. Runs as a single-file web app with no build system, dual Local/M365 operation.

## Core Capabilities

- **Patient census management** — Track patients by room, name, DOB, MRN, hospital, status, and clinical findings.
- **Datewise visit records** — Same patient on a different date creates a new record (compound key `mrn|date`), so history is preserved per visit.
- **Backfeed from previous visit** — One-click copy of administrative data (room, name, plan, supervising MD, billing codes) from the prior visit; findings reset each visit.
- **Procedure tracking** — Manage surgical/procedure status (To-Do, In-Progress, Completed, Post-Op) with dedicated procedure fields.
- **STAT priority alerts** — High-visibility STAT cards (bold red, thick border, glow) make urgent patients impossible to miss.
- **Structured findings system** — Checkbox-driven findings codes paired with per-code values, plus free-text findings summary.
- **Billing integration** — Primary CPT/ICD codes plus secondary charge codes captured per visit.
- **Handoff generator** — Formatted, copy-to-clipboard shift handoff text built from selected patients.

## Views & Navigation

- **Tabbed workspace** — Active patients, Procedures, Calendar, On-Call, and Archive tabs.
- **Adaptive UI** — Mobile-first responsive design; detects iOS/Android, tablet/phone, and orientation.
- **Table and card views** — Priority highlighting (STAT) and inline status dropdowns for procedures.
- **On-call scheduling** — Coverage assignments by date with default provider and hospital settings.
- **Calendar view** — Visualize visits and coverage across dates.

## Data Import / Export

- **CSV/Excel bulk import** — 3-pass parser (on-call schedule, header mapping, patient rows) with hospital section auto-detection.
- **Bulk import preview** — Analyze files before committing; categorize records as New vs Duplicate.
- **Duplicate detection** — Deterministic `mrn + date` matching with Import All / Import New Only / Cancel choices.
- **Excel export** — Versioned daily exports plus a "Latest" pointer, grouped by hospital.

## Platform & Sync

- **Dual-mode operation** — Local Mode (localStorage, zero setup) or M365 Mode (SharePoint Lists) with auto-detection.
- **Microsoft 365 native** — MSAL.js / Entra ID authentication, SharePoint Lists storage, OneDrive export.
- **Polling sync** — 15-second polling with ETag optimization and refresh-on-focus for near-real-time updates.
- **Offline resilience** — localStorage caching keeps recent records available without connectivity.

## Compliance & Access

- **Role-based access control** — Clinician, Billing, and Admin roles with UI-level field masking and action limits.
- **Audit logging** — Records access/change events (SharePoint AuditLogs list) for compliance review.
- **Compliance modes** — Relaxed today, with a roadmap to HIPAA-strict (masking, encrypted exports, MFA) and SOX-strict.
- **PHI-aware exports** — Field masking per role for safe sharing.

## Analytics

- **Analytics dashboard** — Preset modes: Census Overview, Procedure Pipeline, Hospital Workload, Risk & Pending Focus.
- **Custom query input** — Validated `key:value` filtering for ad-hoc analysis.
