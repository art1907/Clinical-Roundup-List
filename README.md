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
- **STAT Priority Reintroduced in Patient Form:** Add/Edit modal includes a dedicated STAT priority checkbox with high-visibility red block label.
- **Analytics Dashboard Upgrade:** Added preset analytics modes (`Census Overview`, `Procedure Pipeline`, `Hospital Workload`, `Risk and Pending Focus`) and validated custom query input (`key:value`).
- **Tab UX Fix:** Active blue tab highlight now follows the selected tab consistently.
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

## 🌐 Deployment Options

### Option 1: Local/Simple Web Server
Perfect for testing or small teams:
- Open HTML file directly in browser (Local Mode)
- Host on IIS, Apache, or any static web server
- See [release/DEPLOYMENT_README.md](./release/DEPLOYMENT_README.md)

### Option 2: Azure Static Web Apps (Recommended for Production)
**Production-ready hosting with authentication, API backend, and auto-deployment:**
- ✅ Free tier (sufficient for most teams)
- ✅ HTTPS automatic
- ✅ Built-in Entra ID authentication
- ✅ Azure Functions API backend
- ✅ GitHub Actions CI/CD
- ✅ Global CDN distribution
- 💰 **Cost: $0-5/month**

**Quick Deploy:**
1. Create Azure Static Web App (links to your GitHub repo)
2. Configure Entra ID authentication
3. Create SharePoint Lists
4. Push code → Auto-deploy ✨

📖 **See: [AZURE_DEPLOY_QUICKSTART.md](./AZURE_DEPLOY_QUICKSTART.md)** for 15-minute setup guide  
📖 **Full guide: [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md)**

### Option 3: Netlify (Alternative)
- See [release/NETLIFY_DEPLOYMENT.md](./release/NETLIFY_DEPLOYMENT.md)

---

## 🛣️ Roadmap

- [x] Full Microsoft 365 Integration (**Complete!**)
- [x] Bulk import preview and duplicate detection
- [x] STAT card display improvements
- [x] Analytics presets + validated custom query
- [x] Graphic user guide and AI augmentation options documentation
- [ ] HIPAA Strict Mode (field masking, encrypted exports)
- [ ] SOX Strict Mode (financial audit trails)
- [ ] Advanced analytics/reporting
- [ ] EHR integration (planned)

_Last updated: March 16, 2026. Maintainer: art1907_