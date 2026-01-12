# Clinical Roundup List

A **modern healthcare patient census and rounding platform** for managing patient visits, procedures, and clinical notes. Designed as a mobile-first web application with real-time synchronization and role-based access control.

## 🏥 Overview

Clinical Roundup List streamlines the rounding process for healthcare teams by providing:

- **Real-time Patient Census** - Track patient status, room assignments, and clinical findings
- **Procedure Management** - Monitor surgical procedures with status tracking (To-Do, In-Progress, Completed, Post-Op)
- **On-Call Scheduling** - Manage provider coverage with integrated calendar views
- **CSV Import/Export** - Seamless data migration from Excel spreadsheets
- **Billing Integration** - Track CPT/ICD codes and secondary charges
- **Role-Based Access** - Clinician, Billing, and Admin roles with field-level masking
- **Offline Support** - Local caching with automatic sync on reconnect
- **Audit Logging** - Compliance-ready change tracking

## 🏗️ Architecture

### Current State: Azure Hybrid (Transitional)
- **Frontend**: Vanilla JavaScript + Tailwind CSS (single HTML file, no build system)
- **Backend**: Azure Functions (Node.js)
- **Database**: Cosmos DB for production data
- **File Storage**: OneDrive for Excel exports
- **Authentication**: Azure AD / Entra ID (MSAL.js)

### Planned: Pure Microsoft 365
The project is actively migrating to a **pure M365 ecosystem** (no Azure infrastructure):
- **Frontend**: Same HTML + MSAL.js
- **Data Storage**: SharePoint Lists (4 lists: Patients, OnCallSchedule, Settings, AuditLogs)
- **Sync**: 15-second polling + localStorage caching
- **Cost**: $0 additional (uses existing M365 licenses)

## 📁 Project Structure

```
Clinical-Roundup-List/
├── clinical-rounding-adaptive.html    # Main application (all-in-one frontend)
├── azure-integration.js               # Azure backend integration layer
├── api/                               # Azure Functions (Node.js backend)
│   ├── patients/                      # Patient CRUD operations
│   ├── onCallSchedule/                # Schedule management
│   ├── settings/                      # Global settings
│   ├── export/                        # Excel export
│   ├── backfeed/                      # Copy previous visit data
│   └── shared/dataService.js          # Shared database access
├── INSTALLATION_GUIDE.md              # Step-by-step setup
├── M365_MIGRATION.md                  # Pure M365 architecture details
├── AZURE_MIGRATION.md                 # Azure setup guide
├── AGENTS.md                          # Architecture decisions & conversation log
├── USERGUIDE.md                       # End-user documentation
└── Rounding List.csv                  # Sample data
```

## 🚀 Key Features

### Patient Management
- Add/edit/archive patient records
- Track room, DOB, MRN, billing codes
- Real-time status indicators (Priority: STAT 🔴, In-Progress 🔵, etc.)
- Findings system with configurable checkboxes + values

### Procedures Module
- Filter patients by procedure keywords
- Track procedure status workflow
- CPT/ICD code management
- Secondary charge codes

### Calendar & Schedule
- View on-call provider assignments by date
- Calendar view with provider coverage
- Schedule import/export

### Data Integrity
- **Unique compound key** (MRN | Date) prevents duplicate visits
- **Backfeed mechanism** auto-populates previous visit data
- Audit logs for compliance
- Offline resilience with localStorage

### Compliance Ready
- **Relaxed Mode** (current): Basic access control
- **HIPAA Strict Mode** (planned): Field masking, encrypted exports, audit logs
- **SOX Strict Mode** (planned): Financial data protection

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Vanilla JavaScript, Tailwind CSS |
| Authentication | MSAL.js, Azure AD / Entra ID |
| Backend | Azure Functions, Node.js |
| Database | Cosmos DB (Azure) / SharePoint Lists (M365) |
| File Storage | OneDrive, Excel (XLSX) |
| CSV Processing | PapaParse |
| Testing | Jest, Playwright (planned) |

## 📋 Quick Start

### Local Development
```bash
# Clone repository
git clone https://github.com/art1907/Clinical-Roundup-List.git
cd Clinical-Roundup-List

# Start local server
python -m http.server 3000

# Open in browser
# http://localhost:3000/clinical-rounding-adaptive.html
```

### Configuration
1. **For Azure**: Update `AZURE_CONFIG` in azure-integration.js with:
   - Client ID
   - Tenant ID
   - Resource URI

2. **For M365**: Update `M365_CONFIG` in HTML with:
   - Client ID
   - Site ID
   - List IDs (Patients, OnCallSchedule, etc.)

### First Run
1. Authenticate with organizational account
2. (Optional) Import CSV: Click "Import CSV" → select Rounding List.csv
3. Start adding patients or view imported data
4. Data syncs in real-time with backend

## 📚 Documentation

- **INSTALLATION_GUIDE.md** - Step-by-step setup (Azure or M365)
- **USERGUIDE.md** - How to use the app (end-users)
- **M365_MIGRATION.md** - Pure M365 architecture & decisions
- **AZURE_MIGRATION.md** - Azure setup & deployment
- **AGENTS.md** - Architecture decisions & conversation log with AI agent
- **MIGRATION_SUMMARY.md** - Summary of Azure migration

## 🔐 Data Model

### SharePoint Lists (M365 Target)

**Patients List**
- VisitKey (Unique: mrn|date)
- Date, Room, Name, DOB, MRN
- Hospital, FindingsData (JSON), FindingsText
- Plan, SupervisingMD, Pending, FollowUp
- ProcedureStatus, CPT/ICD codes, Archived

**OnCallSchedule List**
- Date, Provider, Hospitals

**Settings List**
- Key-value store (defaultOnCall, hospitals, complianceMode)

**AuditLogs List** (Compliance)
- UserIdentity, ActionType, RecordId, Details, Timestamp

## 🎯 Roadmap

### Current (January 2026)
- ✅ Azure Functions backend
- ✅ CSV import (3-pass parsing with hospital detection)
- ✅ Excel export to OneDrive
- ✅ Patient CRUD + procedures module
- ✅ Real-time sync (polling + localStorage)

### In Progress
- 🔄 Pure M365 migration (SharePoint Lists)
- 🔄 MSAL.js authentication
- 🔄 Role-based access control (Clinician, Billing, Admin)

### Planned
- ⏳ HIPAA Strict Mode (field masking, encrypted exports)
- ⏳ SOX Strict Mode (financial audit trails)
- ⏳ Multi-hospital support UI
- ⏳ Mobile app (React Native)
- ⏳ Advanced reporting & analytics
- ⏳ Integration with EHR systems

## 🛡️ Security & Compliance

- **RBAC**: Role-based UI/API enforcement
- **Authentication**: Azure AD / Entra ID (organizational SSO)
- **Data Encryption**: TLS in transit; at-rest encryption via M365
- **Audit Logging**: All changes logged with user/timestamp
- **Field Masking**: Sensitive data redaction per role
- **Offline Mode**: localStorage with sync verification

## 📞 Support & Contributions

For questions or contributions:
- Open an [Issue](https://github.com/art1907/Clinical-Roundup-List/issues)
- Submit a [Pull Request](https://github.com/art1907/Clinical-Roundup-List/pulls)
- Review AGENTS.md for architecture context

## 📄 License

[Specify your license - e.g., MIT, proprietary, etc.]

---

**Last Updated**: January 12, 2026  
**Current State**: Azure Hybrid with M365 Migration in Progress  
**Maintainer**: art1907
