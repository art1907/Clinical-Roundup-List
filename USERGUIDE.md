# Clinical Rounding Platform - User Guide

Welcome to the Clinical Rounding Platform! This guide walks you through using the application to manage patient census, rounds, and scheduling.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Patients](#managing-patients)
4. [Tabs & Views](#tabs--views)
5. [CSV Import & Excel Export](#csv-import--excel-export)
6. [On-Call Scheduling](#on-call-scheduling)
7. [Tips & Keyboard Shortcuts](#tips--keyboard-shortcuts)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Login

1. Open the app in your browser
2. Click **Sign In** (top-right corner)
3. Enter your organizational email (e.g., `john.smith@yourdomain.com`)
4. Enter your password
5. Approve multi-factor authentication (MFA) if prompted
6. You're logged in! ✅

### Your First Look

Once logged in, you'll see:

- **Connection Status** (top left) - "Connected (Azure)" or "Offline"
- **Tabs** (below status) - Census, Surgical, Calendar, Staffing, Archive
- **Action Buttons** (top right) - Add Patient, Import, Export, Settings
- **Patient Table** - All active patients with status indicators

### Patient Status Colors

| Status | Color | Meaning | Icon |
|--------|-------|---------|------|
| **To-Do** | Gray | Not started | ⬜ |
| **In-Progress** | Blue | Currently being managed | 🔵 |
| **Completed** | Green | Finished | ✅ |
| **Post-Op** | Amber | Post-operative period | ⭐ |
| **STAT** | Red | Urgent/Priority | 🔴 |

---

## Dashboard Overview

The main screen provides an overview of patient census and status.

### Key Sections

- **Patient Table**: Lists all active patients
- **Filters**: Narrow down by status, hospital, or provider
- **Search**: Find patients quickly by name or MRN

### Patient Table Columns

- **Room**: Patient room number
- **Date**: Admission or current round date
- **Hospital**: Facility (AWC, BTMC, WGMC, etc.)
- **Name**: Patient name
- **Findings**: Clinical notes (abbreviated)
- **Plan**: Treatment plan (abbreviated)
- **MD**: Supervising physician
- **Status**: Procedure status (dropdown to change)

---

## Managing Patients

### Adding a New Patient

1. Click **+ Add Patient** button (top center)
2. Fill in the form fields:
   - **Room** - Room number (required)
   - **Date** - Today's date (or select a different date)
   - **Hospital** - Select from dropdown
   - **Name, DOB, MRN** - Patient demographics
   - **Findings** - Clinical assessments
   - **Plan** - Treatment plan
   - **Supervising MD** - Attending physician
   - **Pending** - Lab work, imaging, procedures
   - **Follow-Up** - Follow-up appointments
   - **Priority** - Check for STAT/urgent cases
   - **Procedure Status** - To-Do, In-Progress, Completed, Post-Op
   - **Billing Codes** - CPT/ICD codes (if you have billing permissions)

3. Click **Save** to add the patient
4. You'll see a success message: "✓ Saved"

### Editing a Patient Record

1. Click on a patient row in the table
2. The patient modal will open with all current data
3. Modify any fields needed
4. Click **Save**

### Viewing Full Details

Click on a patient row to open the modal and see all information, including:
- Extended findings notes
- Complete plan details
- Pending tests and procedures
- Follow-up instructions
- Billing codes (if accessible)

### Quick Status Updates

Without opening the full patient form:

1. Find the patient in the table
2. Use the **Status dropdown** (rightmost column)
3. Select new status: To-Do → In-Progress → Completed → Post-Op
4. Status updates instantly

### Archiving a Patient

When a patient is discharged or no longer needs active monitoring:

1. Click on the patient to open the modal
2. Click the **Archive** button (red button, if admin)
3. Patient moves to the Archive tab
4. To restore, open from Archive tab and click **Restore**

### Deleting a Patient

⚠️ **Permanent deletion** - Only administrators can delete records.

1. Open patient modal
2. Click **Delete** (red button, admin only)
3. Confirm the deletion dialog
4. Record is permanently removed

---

## Tabs & Views

The application has several tabs to manage different aspects of patient care and scheduling.

### The Census Tab

The Census tab shows all **active, ongoing patient records**.

#### What You'll See

- All patients admitted today or before
- Procedures and treatments in progress
- Sorting: Patients are sorted by STAT priority first, then by date

#### Typical Workflow

1. **Morning Rounds**: Review all patients, update findings
2. **During Rounds**: Quick status changes via dropdown
3. **Add New Patients**: Click + Add Patient as they arrive
4. **End of Day**: Review pending items, archive discharged patients

#### Keyboard Tips

- **Mobile**: Tap rows to edit, use dropdown for quick status
- **Desktop**: Click + drag to scroll through long lists

### The Surgical Tab

The Surgical tab shows only **procedures and surgical cases** (filtered by keywords: cysto, stent, TURBT, laser, surgery, etc.).

#### Use Cases

- **OR Board**: View what's scheduled vs. completed
- **Procedure Tracking**: Follow pre-op, operative, and post-op phases
- **Coordination**: See which procedures are planned vs. in progress

#### Status Workflow for Procedures

1. **To-Do** - Scheduled, not started
2. **In-Progress** - Actively in operating room
3. **Completed** - Finished, monitoring post-op
4. **Post-Op** - Recovery phase, monitoring for complications

#### Filtering

The surgical tab **auto-filters** based on keywords in findings or plan. If your patient doesn't appear, it means the keywords didn't match. You can still add it manually to the Census tab.

### The Calendar View

The Calendar tab displays a **monthly overview** of patient admissions and procedures.

#### Calendar Features

- **Red dots** = Procedures/surgeries scheduled
- **Federal holidays** = Marked with emoji (🎄 Christmas, 🦃 Thanksgiving, etc.)
- **Click date** = See all patients admitted/discharged that day
- **Month navigation** = Use arrows to go to previous/next months

#### Use Cases

- **Weekly Planning**: See OR schedule at a glance
- **Staffing**: Identify busy days for on-call coordination
- **Historical View**: Review what happened last month
- **Holiday Planning**: Know when key dates fall

### The Staffing Tab

The Staffing tab manages **physician on-call coverage**.

#### Add On-Call Assignment

1. Click **Staffing** tab
2. Click **+ Add Schedule**
3. Enter:
   - **Date** - On-call date
   - **Provider** - Physician name (e.g., "Jain", "Larsen")
   - **Hospitals** - Comma-separated list (e.g., "WGMC, AWC, BTMC")
4. Click **Save**

#### View Schedule

- The calendar shows all on-call assignments
- Color-coded by provider (if configured)
- Sort by date or provider

#### Edit Assignment

1. Click on a date with an assignment
2. Modify the provider or hospitals
3. Click **Save**

#### Delete Assignment

1. Find the assignment
2. Click **Delete** (admin only)
3. Confirm deletion

---

## CSV Import & Excel Export

### Import Census from Excel

Use this to bulk-load patients from an Excel/CSV file.

#### Supported Format

Your CSV file should have:
- **Row 1-3**: On-call provider information (optional)
- **Row 4**: Column headers (Room, Date, Name, DOB, MRN, Findings, Plan, MD, Pending, Follow-Up)
- **Row 5+**: Patient data rows
- **Section headers**: Hospital names (e.g., "Abrazo West", "BEMC") with rest of row empty

#### How to Import

1. Prepare your CSV file following the format above
2. Click **Import** button (or use file input)
3. Select your CSV file
4. The app will:
   - Parse on-call assignments from rows 1-3
   - Detect hospital sections automatically
   - Create patient records for each row
   - Show success count and any errors

#### Example CSV Structure

```
,Date of Service,PROVIDER ON CALL,ON CALL AT HOSPITALS
Physician On-Call:,2026-01-12,Jain,"WGMC, AWC"
Physician On-Call:,2026-01-13,Larsen,"BTMC"

Hospital/Room #,Date of Service,Name,DOB,MRN,Findings,Plan,Supervising MD,Pending,Follow-Up
Abrazo West,,,,,,,,
251,2026-01-12,Smith,1960-05-15,12345,"mild hydro","Foley","Jain","CBC pending","2 wks"
BEMC,,,,,,,,
5039,2026-01-12,Jones,1955-03-20,54321,"hematuria","Stent removal","Pandey","Imaging","1 week"
```

### Export Census to Excel/OneDrive

Export your current census as an Excel file to OneDrive.

#### What Gets Exported

- **On-call assignments** for today
- **All active patients** grouped by hospital
- **10 core columns**: Room, Date, Name, DOB, MRN, Findings, Plan, MD, Pending, Follow-Up
- **Versioned filename**: `Rounding List 2026-01-12.xlsx`
- **Latest pointer**: `Rounding List - Latest.xlsx` (always current)

#### How to Export

1. Click **Export to OneDrive** button
2. Wait for "✅ Exported" message
3. File uploads to your OneDrive: `/Clinical Rounding/Rounding List {DATE}.xlsx`

#### After Export

- Open Excel file in OneDrive or locally
- Edit, print, or share with colleagues
- Changes in Excel are **not** synced back to the app (export is one-way)

---

## On-Call Scheduling

The Staffing tab manages **physician on-call coverage**.

### Add On-Call Assignment

1. Click **Staffing** tab
2. Click **+ Add Schedule**
3. Enter:
   - **Date** - On-call date
   - **Provider** - Physician name (e.g., "Jain", "Larsen")
   - **Hospitals** - Comma-separated list (e.g., "WGMC, AWC, BTMC")
4. Click **Save**

### View Schedule

- The calendar shows all on-call assignments
- Color-coded by provider (if configured)
- Sort by date or provider

### Edit Assignment

1. Click on a date with an assignment
2. Modify the provider or hospitals
3. Click **Save**

### Delete Assignment

1. Find the assignment
2. Click **Delete** (admin only)
3. Confirm deletion

---

## Tips & Keyboard Shortcuts

### Mobile Tips

- **Landscape mode**: Wider table view, easier to read
- **Tap and hold**: Right-click menu on some devices
- **Swipe**: Scroll through long tables horizontally
- **Auto-collapse**: Long fields collapse for readability; tap to expand

### Desktop Tips

- **Keyboard shortcuts** (coming soon):
  - `Ctrl+N` - New patient
  - `Ctrl+E` - Export
  - `Ctrl+I` - Import
- **Click headers**: Sort patients by any column (future feature)
- **Drag to select**: Select multiple patients for bulk actions (future feature)

### Data Entry Tips

- **Room number**: Use `ER` for emergency department, `5039` for inpatient
- **MRN**: Unique per patient across system; use consistently
- **Date**: Leave as today unless importing historical data
- **Findings**: Use bullet points or abbreviations (e.g., "L hydro, 2mm stone, S/P CRULLS 12/20")
- **Plan**: Be specific (e.g., "Cysto/stent removal 12/28 @ 2pm", not just "Follow-up")

### Offline Usage

- **Cached data**: App caches recent patients automatically
- **No internet**: You can view, edit, and add patients locally
- **Reconnect**: When online, changes sync automatically
- **Conflicts**: If edited offline and online simultaneously, online version wins

---

## Troubleshooting

### "Can't log in"

**Problem**: You see "Unauthorized" or can't access the app.

**Solutions**:
1. Verify you're using your **organizational email** (e.g., firstname.lastname@yourhospital.org)
2. Check **Caps Lock** isn't on
3. Request your IT admin to verify your role assignment in Entra ID
4. Clear browser cache and try again
5. Try a different browser

### "Offline mode" appears unexpectedly

**Problem**: Status says "Offline" but you have internet.

**Solutions**:
1. Check your **internet connection**
2. Verify the **API is reachable**: Ask your IT admin if Azure Functions are running
3. Check browser **console** (F12) for error messages
4. Try **refreshing** the page
5. Restart your app and browser

### "Can't save patient"

**Problem**: You click Save but nothing happens or you see an error.

**Solutions**:
1. Verify **required fields** are filled:
   - Room (required)
   - Date (required)
2. Check for **duplicate**: If patient with same MRN + date exists, you'll get "Patient already rounded today"
   - Use **Copy from Previous Visit** to add a new date's visit
3. If billing codes show errors, you may not have **billing permissions** (expected for clinicians)
4. Check your **internet connection**

### "Can't export to OneDrive"

**Problem**: Export button doesn't work or fails.

**Solutions**:
1. Verify you're **signed in** with your organizational account
2. Check that you have **OneDrive access** (IT admin can verify)
3. Ensure the `/Clinical Rounding` folder exists in your OneDrive (or create it)
4. If permissions error, ask your IT admin to grant `Files.ReadWrite` permission
5. Try exporting again; if it fails, contact support

### "Data not syncing"

**Problem**: Changes made by another user aren't showing up.

**Solutions**:
1. Click the **refresh button** (status area) or wait 15 seconds
2. Close and reopen the patient record
3. Fully **refresh the page** (Ctrl+R or Cmd+R)
4. Check that both users are **online and connected**
5. If problem persists, verify the API backend is running

### "Copy from Previous Visit not working"

**Problem**: Button doesn't show or doesn't populate fields.

**Solutions**:
1. Verify the **MRN field** is filled with the patient's ID
2. Ensure this patient has a **previous visit** in the system
3. If MRN is blank, the button is disabled (expected)
4. Check that you're trying to add a **new date** (different from previous visit date)

### "Can't see billing codes"

**Problem**: CPT/ICD fields are hidden or show `***`.

**Solutions**:
1. This is **normal for clinicians** - field masking is intentional for HIPAA
2. If you need billing access, ask your department administrator to assign you the **"billing" role**
3. Once role is changed, sign out and sign back in to see the fields

### Performance Issues

**Problem**: App is slow, fields lag when typing.

**Solutions**:
1. **Close other tabs/apps** to free up memory
2. **Clear browser cache** (Settings → Clear browsing data)
3. Try a **different browser** to isolate the issue
4. On mobile, **close other apps** and restart the device
5. Contact IT if the issue persists

### "Patient still shows after archiving"

**Problem**: Patient appears in both Census and Archive tabs.

**Solutions**:
1. Refresh the page (Ctrl+R)
2. Close and reopen the app
3. Wait 15 seconds for sync (polling interval)
4. Archive again if still visible

---

## Getting Help

### In-App Help

- Click the **?** icon (top right, if available) for context-sensitive help
- Hover over field labels for tooltips (coming soon)
- Status messages at the bottom give real-time feedback

### Contact Support

- **IT Help Desk**: For login, permissions, or connection issues
- **Application Admin**: For feature requests or data questions
- **Email**: Send issues to your department's app administrator

### Providing Feedback

Your feedback helps improve the app:

1. Note the date, time, and what you were doing
2. Include error messages or screenshots
3. Send to your department's app administrator

---

## FAQ

**Q: Can I use the app on my personal phone?**  
A: Yes, if it has a web browser and internet. Your organizational account login is required for security.

**Q: What happens if I close the browser while editing?**  
A: Unsaved changes are lost (this is expected web app behavior). Make sure to click Save before closing.

**Q: Can I edit archived patients?**  
A: Yes, open from Archive tab and make changes. Click Save to update.

**Q: How long is data kept?**  
A: According to your hospital's data retention policy. Ask your IT admin.

**Q: Can I access this app from outside the hospital network?**  
A: Yes, the app is cloud-based. Only your organizational login is required.

**Q: How do I print a patient record?**  
A: Use your browser's Print function (Ctrl+P) to print the current view or export to Excel first.

**Q: Is my data encrypted?**  
A: Yes, all data is encrypted in transit (HTTPS) and at rest in Azure. Access is audited and logged.

**Q: What's the "Copy from Previous Visit" button?**  
A: It copies all data from the patient's last visit except findings, pending items, and follow-up (those are assumed to be new for each visit). Saves time entering repetitive info.

---

## Version History

**v1.0** (Jan 2026) - Initial Azure/M365 migration
- Replaced Firebase with SharePoint Lists backend
- Added Azure authentication (Entra ID)
- Improved offline caching and polling
- Added hospital field and CSV import
- Added OneDrive Excel export

---

**Last Updated**: January 12, 2026

For the latest version of this guide, check your app's Help section or contact your administrator.
