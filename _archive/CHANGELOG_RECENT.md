# Recent Changes - CSV Import & UI Enhancement

**Date**: January 12, 2026  
**Commit**: `5b89d15` - "Feature: Add CSV import with 3-pass parser and enhanced UI color coding for priority/status"

## What's New

### 1. ✅ CSV Import Engine (3-Pass Parser)
Fully resolves **Issue #1: CSV columns not showing up**

#### Implementation Details
The app now includes a sophisticated CSV parser (`CSVImporter`) that implements the architecture from AGENTS.md:

**Pass 1: On-Call Schedule Parsing**
- Reads rows 1-3 from CSV
- Extracts date, provider, hospitals
- Auto-detects schedule entries (rows starting with "Physician On-Call:")

**Pass 2: Column Header Mapping**
- Finds and maps column headers automatically
- Supports flexible header naming:
  - "Date of Service" → `date`
  - "Hospital/Room #" → `hospital`/`room`
  - "Dx/Findings" → `findings`
  - "Name", "DOB", "MRN" → respective fields
  - "Plan", "Supervising MD", "Pending Tests", "Follow-Up" → plan, supervisingMd, pending, followUp

**Pass 3: Patient Row Parsing with Hospital Detection**
- Auto-detects hospital section headers (first col filled, rest empty)
- Groups subsequent patient rows under that hospital
- Creates unique `id` for each patient
- Auto-detects STAT/priority based on keywords (STAT, URGENT, CRITICAL, FOLLOW REMOTELY, high risk)
- Preserves all clinical data: findings, plan, pending, follow-up

#### CSV Columns Now Supported
From `Rounding List.csv`:
```
✓ Hospital/Room # → hospital, room
✓ Date of Service → date
✓ Name → name
✓ DOB → dob
✓ MRN → mrn
✓ Dx/Findings → findingsText
✓ Plan → plan
✓ Supervising MD → supervisingMd
✓ Pending Tests/Info → pending
✓ Follow-Up Appt → followUp
✓ On-Call Schedule (rows 1-3) → onCallSchedule
```

### 2. 🎨 Enhanced UI Color Coding & Priority Tagging
Fully resolves **Issue #2: Inconsistent UI flow and priority tagging**

#### Enhanced STATUS_COLORS
```javascript
const STATUS_COLORS = {
    'To-Do': { 
        bg: 'bg-gray-50 border border-gray-300',
        bgHeavy: 'bg-gray-200',
        badge: '⬜'
    },
    'In-Progress': {
        bg: 'bg-blue-50 border border-blue-300',
        bgHeavy: 'bg-blue-200',
        badge: '🔵'
    },
    'Completed': {
        bg: 'bg-emerald-50 border border-emerald-300',
        bgHeavy: 'bg-emerald-200',
        badge: '✅'
    },
    'Post-Op': {
        bg: 'bg-amber-50 border border-amber-300',
        bgHeavy: 'bg-amber-200',
        badge: '⭐'
    }
};
```

#### NEW: PRIORITY_COLORS (STAT/Acuity Levels)
```javascript
const PRIORITY_COLORS = {
    stat: {
        bg: 'bg-red-600',
        text: 'text-white',
        badge: '🔴 STAT',
        light: 'bg-red-100 border border-red-300 text-red-900'
    },
    high: {
        bg: 'bg-orange-600',
        light: 'bg-orange-100 border border-orange-300 text-orange-900'
    },
    routine: {
        bg: 'bg-slate-400',
        light: 'bg-slate-100 border border-slate-300 text-slate-900'
    }
};
```

#### UI Improvements

**Table Row Highlighting**
- STAT patients: Red-tinted row background
- Priority indicator moves from separate badge to integrated row styling
- Hover effect uses status-specific colors (gray→gray, blue→blue, etc.)
- Consistent padding and spacing

**Priority Badge Enhancement**
- Now shows: `🔴 STAT` (emoji + label) instead of just emoji
- Integrated into room column
- Light red background with bold text for visibility
- Auto-detected from CSV findings/plan (keywords: STAT, URGENT, CRITICAL, FOLLOW REMOTELY)

**Status Dropdown Styling**
- Dropdown background matches current status color
- Borders now defined (replaces vague styling)
- Status badge next to dropdown shows current state
- Better visual hierarchy

**Uniform Spacing**
- All action buttons consistent height: `py-1.5`
- Padding standardized: `p-3` for table cells
- Font sizes: `text-[9px]` for buttons, `text-xs` for smaller text
- Color transitions: `transition-colors` added to buttons

### 3. 📥 New CSV Import Button
- Green button in header: `📥 Import CSV`
- Hidden file input triggers on click
- Handles `.csv` files only
- Toast notifications for import progress/status

#### Import Process
1. Click "📥 Import CSV" button
2. Select Rounding List.csv file
3. Parser automatically:
   - Detects on-call schedule
   - Maps columns flexibly
   - Groups patients by hospital
   - Detects STAT records
4. Data merged with existing records
5. Toast shows: `✓ Imported 6 patients`

### 4. 🔧 Smart Data Merging
- **On-call**: Updates existing shifts by date, adds new ones
- **Patients**: Matches by MRN+date, updates or creates new
- **Hospitals**: Auto-adds new hospitals to global settings

## Visual Changes

### Before
- Generic gray/white table rows
- Small 🔴 emoji for STAT (easy to miss)
- Vague status colors without borders
- No visual hierarchy

### After
- Color-coded rows based on priority AND status
- Clear badge: `🔴 STAT` (impossible to miss)
- Defined borders on status pills
- Consistent Tailwind styling throughout
- Hover effects that match status colors
- Better contrast for readability

## How to Use

### Import CSV
1. Save your data in Excel format (Rounding List.csv recommended)
2. Click `📥 Import CSV` button in header
3. Select file from computer
4. Data auto-parses and loads

### New CSV Format Support
```
Row 1-3: On-call schedule (flexible parser)
Row 4: Column headers (auto-detected)
Row 5+: Patient records (grouped by hospital section)
```

## Code Changes

### New Components
- `CSVImporter` object with `parse3Pass()` and `handleFileUpload()`
- `PRIORITY_COLORS` object for acuity levels
- `window.handleCSVImport()` handler

### Modified Functions
- `renderMainTable()` - Enhanced color coding and styling
- `STATUS_COLORS` - Added borders and bgHeavy variants

### New UI Elements
- CSV import button in header
- Hidden file input (#csv-file-input)

## Testing Checklist

✅ CSV Import
- [x] Parse on-call schedule (rows 1-3)
- [x] Detect column headers (row 4)
- [x] Parse patient rows (rows 5+)
- [x] Detect hospital section headers
- [x] Auto-detect STAT records
- [x] Merge with existing data
- [x] Show import success toast

✅ UI/Color Coding
- [x] STAT rows show red background
- [x] Status dropdowns color-match (To-Do=gray, In-Prog=blue, etc.)
- [x] Priority badge visible and clear
- [x] Hover effects work correctly
- [x] Buttons have consistent styling
- [x] All CSV columns display properly

## Files Modified
- `clinical-rounding-adaptive.html` (+202 lines, -15 lines)
  - Added CSVImporter engine
  - Added PRIORITY_COLORS
  - Enhanced STATUS_COLORS
  - Updated renderMainTable()
  - Added CSV import button and handler

## What's Still To Do
- [ ] Export to Excel with formatting
- [ ] CSV column mapping UI (advanced import)
- [ ] Batch operations (mark multiple as STAT)
- [ ] Custom hospital colors
- [ ] Print-friendly CSS

## Compliance Notes
- ✅ Follows .github/instructions/snyk_rules.instructions.md (no new security issues introduced)
- ✅ No external dependencies added (uses existing PapaParse for validation)
- ✅ Data validation in place (rejects incomplete rows)
- ✅ Error handling with user feedback (toast messages)

---

**Next Steps**: Users can now import the Rounding List.csv directly into the app. All CSV columns are recognized and mapped to form fields. Priority/STAT patients are highlighted with improved visual consistency.
