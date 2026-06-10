# Procedure Fields - Quick Reference Guide

## Visual Layout in Modal

```
┌─────────────────────────────────────────────────────────────┐
│                    Record Entry                             │
│                                                             │
│ [Room: 201]  [Date: 06/10/2026]                            │
│                                                             │
│ [Hospital dropdown]                                         │
│ [Provider: Dr. Smith]                                       │
│ [Status dropdown]                                           │
│ [STAT Priority ☑]                                          │
│                                                             │
│ [Patient Name]  [DOB]  [MRN]                               │
│                                                             │
│ [🩸 Findings section (collapsed)]                          │
│                                                             │
│ [📋 Plan: cystoscopy scheduled...]                         │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ 🏥 PROCEDURES                                         │  │  ← NEW SECTION
│ │ Procedures identified from Plan text                 │  │
│ │                                                       │  │
│ │ ▼ 📋 Procedure Name                                  │  │
│ │   ☐ Cystoscopy         [📅 06/15/2026]             │  │  ← DATE IS CLICKABLE
│ │     [Procedure notes...]                             │  │
│ │   ☐ TURBT              [📅          ]               │  │
│ │     [Procedure notes...]                             │  │
│ │   ☑ Stent Placement    [📅 06/20/2026]             │  │  ← CHECKED = ACTIVE
│ │     [Double J stent placed]                          │  │
│ │   ☐ Lithotripsy        [📅          ]               │  │
│ │     [Procedure notes...]                             │  │
│ │   ... (more procedures)                              │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│ [📝 Progress Notes]                                        │
│                                                             │
│ [💰 Billing section]                                       │
│                                                             │
│ [Follow-Up] [Pending Tests]                               │
│ [Attachments section]                                      │
│ [Change Notes section]                                     │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ [Edit]  [Archive]  [Delete]                         │  │
│ │ [SAVE RECORD] ⌨️ Ctrl+S                             │  │
│ └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Interaction Flow

### 1️⃣ Creating New Procedure Entry
```
User checks checkbox
        ↓
Date field becomes visible & enabled
Text field becomes visible & enabled
        ↓
User enters date (or leaves blank)
        ↓
User enters procedure notes (optional)
        ↓
Data saved to patient record
```

### 2️⃣ Clicking Date to Open Calendar
```
User clicks date field
        ↓
Browser opens calendar tab
        ↓
Calendar highlights selected date
        ↓
Toast shows: "📅 Stent Placement - 06/20/2026"
        ↓
User can review/update calendar view
```

### 3️⃣ Editing Existing Record
```
Modal opens with edit ID
        ↓
Procedure data loads from patient record
        ↓
Checkboxes checked for stored procedures
        ↓
Dates populated in date fields
        ↓
Notes populated in text fields
        ↓
Click "Edit" button to enable modifications
        ↓
Modify procedure data
        ↓
Save record
```

## Field States

### Unchecked Procedure
```
☐ Cystoscopy     [📅 hidden] [hidden]
```
- Checkbox: Empty
- Date field: Hidden & disabled
- Notes field: Hidden & disabled
- No data saved

### Checked Procedure
```
☑ Stent Placement [📅 06/20/2026] [Blue hover effect]
  [Double J stent placed____________]
```
- Checkbox: Checked
- Date field: Visible & enabled (blue hover on desktop)
- Notes field: Visible & enabled
- Data saved to database

## Styling Details

### Date Field (Light Mode)
```
Default State:
┌──────────────┐
│ 📅 06/20/26  │ ← Date input, gray border
└──────────────┘

Hover State:
┌──────────────┐
│ 📅 06/20/26  │ ← Blue background, blue border, glow
└──────────────┘ ← Indicates "clickable to calendar"
```

### Date Field (Dark Mode)
```
Default State:
┌──────────────┐
│ 📅 06/20/26  │ ← Dark gray input
└──────────────┘

Hover State:
┌──────────────┐
│ 📅 06/20/26  │ ← Dark blue background, light blue border
└──────────────┘ ← Maintains readability
```

### Notes Field
```
Single-line or multi-line text input:
┌─────────────────────────────────────┐
│ Double J stent placed, no complications │
└─────────────────────────────────────┘
```

## Data Examples

### Single Procedure
```json
{
  "procedureCodes": ["cystoscopy"],
  "procedureDates": {
    "cystoscopy": "2026-06-15"
  },
  "procedureValues": {
    "cystoscopy": "Routine diagnostic cystoscopy"
  }
}
```

### Multiple Procedures
```json
{
  "procedureCodes": ["cystoscopy", "stent", "biopsy"],
  "procedureDates": {
    "cystoscopy": "2026-06-15",
    "stent": "2026-06-20",
    "biopsy": "2026-06-25"
  },
  "procedureValues": {
    "cystoscopy": "Found bladder tumor",
    "stent": "Double J stent placed",
    "biopsy": "Tissue sent to pathology"
  }
}
```

### No Procedures
```json
{
  "procedureCodes": [],
  "procedureDates": {},
  "procedureValues": {}
}
```

## Common Tasks

### ✅ Add a Procedure
1. Scroll to 🏥 PROCEDURES section
2. Click ▼ to expand 📋 Procedure Name
3. Find procedure in list
4. Check the checkbox
5. Enter date (click to use date picker)
6. Enter notes/details
7. Save record

### ✅ Link to Calendar
1. Add procedure with date
2. Click on the blue date field
3. 📅 Calendar tab opens
4. Date is highlighted
5. Can view other scheduled items

### ✅ Remove a Procedure
1. Uncheck the procedure checkbox
2. Date field hides
3. Notes field hides
4. Data removed from record
5. Save to confirm

### ✅ Modify Procedure Date
1. Click "Edit" button
2. Find procedure in list
3. Update date in date field
4. Calendar will highlight new date if clicked
5. Save record

### ✅ Bulk Management
1. Multiple procedures can have independent dates
2. Each links to calendar separately
3. Can manage pre-op (6/15), intraoperative (6/20), and post-op (6/25) dates
4. All saved in single record

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save Record | `Ctrl+S` or `Cmd+S` |
| Close Modal | `Esc` |
| Tab Navigation | `Tab` to next field |
| Date Input | Click or Tab+Enter |

## Responsive Design

### Desktop View (≥768px)
- 📋 Procedures section full width
- Date input inline (right of checkbox)
- Notes field below
- Easy to scan multiple procedures

### Tablet View (640px-768px)
- 📋 Procedures section responsive
- Date input on same line
- Clean stacking

### Mobile View (<640px)
- 📋 Procedures section full width
- Date input stacked vertically
- Checkbox and date clearly separated
- Large touch targets (touch-friendly)
- Text input below date

## Accessibility

✅ **Keyboard Navigation**
- Tab through checkboxes
- Tab to date inputs
- Tab to text inputs
- Enter to submit

✅ **Labels & Descriptions**
- Section heading: "🏥 PROCEDURES"
- Subtitle: "Procedures identified from Plan text"
- Each procedure clearly labeled
- Date field has `aria-label` attribute

✅ **Color Contrast**
- Light mode: Blue on white
- Dark mode: Light blue on dark
- Both meet WCAG AA standards

✅ **Touch-Friendly**
- Minimum 44×44px touch target
- 3px padding around inputs
- Adequate spacing between fields

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Date field won't show | Check procedure checkbox |
| Can't edit fields | Click "Edit" button first |
| Date won't save | Ensure format is mm/dd/yyyy |
| Calendar won't open | Click on the blue date field |
| Notes disappear | Don't uncheck checkbox |
| Mobile too cramped | Rotate device for landscape |

---

## Next Steps

1. ✅ Open application in browser
2. ✅ Create new patient record
3. ✅ Add procedures with dates
4. ✅ Click dates to verify calendar link
5. ✅ Test on mobile device
6. ✅ Edit existing record with procedures
7. ✅ Save and refresh to verify persistence

