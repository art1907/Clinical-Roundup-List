# Clinical Roundup List

A **modern healthcare patient census and rounding platform** for managing patient visits, procedures, and clinical notes. Runs as a mobile-first web app using modern JavaScript, now featuring full native Microsoft 365 (M365) integration with local “offline mode” by default.

---

## 🏥 Overview

**Clinical Roundup List** streamlines the rounding process for healthcare teams by providing:

- **Dual Operation Modes:**  
  - **Local Mode** (no configuration) for immediate use, stores data in browser, perfect for demos or small teams.
  - **M365 Mode** (optional) enables cloud sync and multi-user operation using SharePoint Lists and Microsoft Identity.
- **Real-time Patient Census** — Track patient status, room assignments, and clinical findings.
- **Bulk Import Preview** with duplicate detection and easy review.
- **Visual STAT Alerts:** Distinct, high-visibility STAT cards for urgent patients.
- All original features: Procedure management, on-call scheduling, CSV import/export, billing integration, role-based access, offline support, and audit logging.

---

## 🏗️ Architecture

- **Frontend:** HTML + Vanilla JavaScript, Tailwind CSS (single HTML file, no build system)
- **Authentication:** MSAL.js (Microsoft Entra ID / Azure AD)
- **Data Storage:**
  - **Local Mode:** localStorage (no setup needed)
  - **M365 Mode:** SharePoint Online (4 lists: Patients, OnCallSchedule, Settings, AuditLogs)
- **File Storage:** OneDrive for Excel exports

---

## 🚀 Recent Features

- **Bulk Import Preview & Duplicate Detection:** Safe import workflow lets you review data before finalizing, with smart duplicate-matching (by MRN and date).
- **Enhanced STAT Card Visuals:** Urgent patients (STAT) are highlighted in both Table and Card views.
- **Dual-Mode Operation:** Choose Local or M365 mode at first launch or switch later as needed.
- **Performance Improvements:** Faster filtering, smarter caching, and robust field validation.
- **Other:** Improved mobile UX, stricter audit logging, CSV import/export enhancements.

---

## 📋 Quick Start

**Local Mode** (no M365 setup required):
```bash
git clone https://github.com/art1907/Clinical-Roundup-List.git
cd Clinical-Roundup-List
python -m http.server 3000
# Open http://localhost:3000/clinical-rounding-adaptive.html in your browser
```
**All features, except cloud sync, are available out of the box.**

**M365 Mode** (OPTIONAL, enables SharePoint integration for multi-user, multi-device sync):
1. Configure M365 credentials (Client ID, Site ID, List IDs) in the HTML file.  
2. Log in with Microsoft 365 account.
3. Data syncs via SharePoint Lists in real time.

See **INSTALLATION_GUIDE.md** and **M365_MIGRATION.md** for step-by-step instructions.

---

## 🛣️ Roadmap

- [x] Full Microsoft 365 Integration (**Complete!**)
- [x] Bulk import preview and duplicate detection
- [x] STAT card display improvements
- [ ] HIPAA Strict Mode (field masking, encrypted exports)
- [ ] SOX Strict Mode (financial audit trails)
- [ ] Advanced analytics/reporting
- [ ] EHR integration (planned)

_Last updated: January 18, 2026. Maintainer: art1907_