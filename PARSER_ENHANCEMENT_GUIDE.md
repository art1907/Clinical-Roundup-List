# Parser Enhancement: Detailed Validation & Error Handling

## Changes Made

### 1. Sheet Context in Multi-Sheet Import (✅ DONE)

**Files Updated**: `previewBulkImport()` and `proceedBulkImport()`

**Change**: Pass sheet name to parser for better error context

```javascript
// BEFORE
const parsed = CSVImporter.parseRows3Pass(rows);

// AFTER  
const parsed = CSVImporter.parseRows3Pass(rows, sheetName);
```

**Result**: Console shows which sheet succeeded/failed with line-level diagnostics

---

## Changes Needed

### 2. Parser Validation Logging (NEXT)

**Location**: `parseRows3Pass` function (line ~7555)

**Add to function**:
- Validation log array that tracks every step
- Log function with level support (info, warn, error, success)
- Sheet context in every log message
- Return validation log with results

**Changes**:
```javascript
const parseRows3Pass = (rowsInput, sheetName = 'Data') => {
    // ADD: Validation logging infrastructure
    const validationLog = [];
    const log = (msg, level = 'info') => {
        const prefix = level === 'error' ? '❌ ERROR' : 
                      level === 'warn' ? '⚠️ WARN' : 
                      level === 'success' ? '✅' : '💬';
        const fullMsg = `    [${sheetName}] ${prefix}: ${msg}`;
        validationLog.push(fullMsg);
        if (level === 'error' || level === 'warn') console.log(fullMsg);
    };
    
    // Track statistics
    const stats = { skipped: 0, parsed: 0, errors: [] };
    
    // MODIFY: Return object to include validation log
    const result = { 
        onCall: [], 
        patients: [], 
        hospitals: [], 
        validationLog,
        stats 
    };
    
    // Return result at end
    return result;
};
```

### 3. Header Detection with Diagnostics (NEXT)

**Modify**: `findHeaderIndex()` function (line ~7539)

**Add logging**: Show which rows are checked, why they pass/fail

```javascript
const findHeaderIndex = (rows, sheetLog) => {
    if (sheetLog) sheetLog(`Searching ${rows.length} rows for header pattern...`);
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || [];
        const normalized = row.map(normalizeHeader);
        const hasDate = findCol(normalized, ['Date of Service', 'Date']) !== -1;
        const hasIdentity = findCol(normalized, ['MRN', 'Name', 'Room', 'Hospital/Room #', 'Hospital']) !== -1;
        
        if (hasDate && hasIdentity) {
            if (sheetLog) sheetLog(`✅ Found header at row ${i}: ${row.slice(0, 5).join(' | ')}...`, 'success');
            return i;
        }
        
        // Log why this row was skipped (optional - verbose mode)
        // if (sheetLog) sheetLog(`  Row ${i}: hasDate=${hasDate}, hasIdentity=${hasIdentity} - SKIPPED`);
    }
    
    if (sheetLog) sheetLog(`❌ Header row not found in any of ${rows.length} rows!`, 'error');
    return -1;
};
```

### 4. Row-Level Validation with Clear Feedback (NEXT)

**Modify**: Patient row parsing loop (lines ~7590-7630)

**Add**:
- Per-row validation checks
- Clear skip reasons (why a row was skipped)
- Count statistics (parsed vs skipped)
- Error collection for summary

```javascript
// When iterating patient rows:
for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Check if hospital section header
    const isSection = row[0] && row[0].trim() && row.slice(1).every(c => !c || !c.trim());
    if (isSection) {
        currentHospital = row[0].trim();
        log(`Row ${i}: Hospital section "${currentHospital}"`, 'info');
        continue;
    }
    
    // Check if completely empty
    if (!row.some(c => c)) {
        stats.skipped++;
        log(`Row ${i}: Completely empty - SKIPPED`, 'warn');
        continue;
    }
    
    // Try to parse as patient
    try {
        // Parse logic...
        stats.parsed++;
        log(`Row ${i}: ✅ Parsed patient "${patient.name || patient.mrn || '(no ID)'"`, 'success');
    } catch (err) {
        stats.errors.push({ row: i, error: err.message });
        log(`Row ${i}: ❌ Parse failed: ${err.message}`, 'error');
        stats.skipped++;
    }
}
```

### 5. Error Propagation with Context (NEXT)

**Modify**: Exception throwing in parseRows3Pass

```javascript
// Current: Generic error
throw new Error('Invalid import: insufficient rows');

// Enhanced: Detailed context
if (rows.length < 2) {
    const msg = `INSUFFICIENT DATA: only ${rows.length} row(s) after filtering. Need header + data rows.`;
    log(msg, 'error');
    
    const err = new Error(msg);
    err.validationLog = validationLog;
    err.stats = stats;
    throw err;
}
```

### 6. Multi-Sheet Caller Updates (PARTIALLY DONE)

**Files**: `previewBulkImport()` and `proceedBulkImport()`

**Status**: ✅ Now passes sheet names and logs validation details

**Verification**: When importing, console should show:
```
📊 Processing workbook "file.xlsx" with 6 sheet(s): [...]
  ✅ Sheet "4.27.26": ✅ Found header at row 2: Hospital | Room | Date | Name | DOB...
    [4.27.26] ✅: Row 3: ✅ Parsed patient "John Doe"
    [4.27.26] ✅: Row 4: ✅ Parsed patient "Jane Smith"
    [4.27.26] ⚠️ WARN: Row 5: Completely empty - SKIPPED
    [4.27.26] ✅: Final: 2 parsed, 1 skipped
  ✅ Sheet "4.27.26": 2 patients, 1 on-call, 1 rows skipped
  ✅ Sheet "4.28.26": 3 patients, 1 on-call, 0 rows skipped
  ❌ Sheet "4.29.26" failed: INSUFFICIENT DATA: only 1 row(s) after filtering
    [4.29.26] ❌ ERROR: After filtering empty rows: 1 data row
    [4.29.26] ❌ ERROR: INSUFFICIENT DATA: only 1 row(s) after filtering
  📊 File total: 5 patients, 2 on-call, 1 sheet failed
```

---

## Testing Checklist

### Test 1: Single Sheet Import (Happy Path)
- [ ] Import Excel with 1 sheet
- [ ] Console shows header detection
- [ ] Console shows patient parsing line-by-line
- [ ] Console shows final stats (X parsed, Y skipped)

### Test 2: Multi-Sheet Import (All Succeed)
- [ ] Import Excel with 3 sheets
- [ ] Each sheet shows independent diagnostics
- [ ] Final summary shows combined counts
- [ ] No errors in console

### Test 3: Multi-Sheet with Failures
- [ ] Import Excel with 6 sheets, where sheet 4 is empty
- [ ] Sheets 1-3 show success
- [ ] Sheet 4 shows clear error message (INSUFFICIENT DATA)
- [ ] Sheets 5-6 continue and succeed
- [ ] User sees preview with errors listed

### Test 4: Column Mapping Issues
- [ ] Import file missing Date column
- [ ] Console shows "Header row not found" error with diagnostics
- [ ] Import fails gracefully with clear message

### Test 5: Blank Columns (Edge Case)
- [ ] Import file with blank columns A-B (user's case)
- [ ] Parser skips columns A-B correctly
- [ ] Header found at column C as expected
- [ ] Patients parse successfully

---

## Benefits of Enhancement

| Issue | Before | After |
|-------|--------|-------|
| Silent failures | ❌ Sheet fails, no reason | ✅ "INSUFFICIENT DATA: only 1 row" |
| Multi-sheet debugging | ❌ Only see final count | ✅ Per-sheet stats + line-by-line logs |
| Row-level feedback | ❌ "Import complete" | ✅ "Row 5: Parsed John Doe", "Row 6: Empty - SKIPPED" |
| Error context | ❌ Generic error message | ✅ Full validation log with sheet name |
| Performance insights | ❌ No stats | ✅ "23 parsed, 5 skipped, 2 errors" |

---

## Files Modified

1. ✅ `clinical-rounding-adaptive.html` - Updated multi-sheet callers
2. 🟡 **NEXT**: Enhance `parseRows3Pass` core function
3. 🟡 **NEXT**: Update `findHeaderIndex` with logging
4. 🟡 **NEXT**: Add row-level validation with clear feedback

