# HTML File Integration Instructions

## Step 1: Replace Script Imports (Already Done)

Lines 7-10 have been updated to include MSAL.js and SheetJS:
```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://alcdn.msauth.net/browser/2.32.2/js/msal-browser.min.js"></script>
```

## Step 2: Replace the `<script type="module">` Section

**Find** (around line 854):
```html
<script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
```

**Replace with**:
```html
<script>
    // Content of azure-integration.js file
    // Copy the entire content from azure-integration.js here
```

**Important**: Change `<script type="module">` to `<script>` (remove the `type="module"`)

## Step 3: Add Hospital Field to Patient Modal

**Find** the patient modal form (around line 3200-3400), locate the MRN field section:

```html
<label class="block text-sm font-semibold mb-1" for="f-mrn">MRN</label>
<input type="text" id="f-mrn" class="w-full p-2 border rounded" placeholder="Medical Record Number">
```

**Add after** the MRN field:

```html
<div class="mb-3">
    <label class="block text-sm font-semibold mb-1" for="f-hospital">Hospital</label>
    <select id="f-hospital" class="w-full p-2 border rounded">
        <option value="">Select Hospital...</option>
        <option value="Abrazo West">Abrazo West (AWC)</option>
        <option value="BEMC">Banner Estrella Medical Center (BEMC)</option>
        <option value="BTMC">Banner Thunderbird Medical Center (BTMC)</option>
        <option value="Westgate">Westgate</option>
        <option value="CRMC">CRMC</option>
        <option value="WGMC">West Valley Gateway Medical Center (WGMC)</option>
        <option value="AHD">AHD</option>
        <option value="Custom">-- Custom/Other --</option>
    </select>
    <input type="text" id="f-hospital-custom" class="w-full p-2 border rounded mt-2 hidden" placeholder="Enter custom hospital name">
</div>

<script>
// Show custom input when "Custom" is selected
document.getElementById('f-hospital')?.addEventListener('change', function() {
    const customInput = document.getElementById('f-hospital-custom');
    if (this.value === 'Custom') {
        customInput.classList.remove('hidden');
    } else {
        customInput.classList.add('hidden');
    }
});
</script>
```

## Step 4: Add "Copy from Previous Visit" Button

**Find** the patient modal header (around line 3185), after the close button `</button>`:

**Add**:

```html
<button type="button" onclick="window.copyPreviousVisit()" 
        class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 mr-2"
        id="copy-prev-btn">
    📋 Copy Previous Visit
</button>
```

## Step 5: Add Hospital Column to Table

**Find** the `renderMainTable()` function (around line 1298), locate the table header row:

```javascript
<tr class="bg-slate-100 text-xs uppercase tracking-wide">
    <th class="p-2 text-left">Room</th>
    <th class="p-2 text-left">Date</th>
    <th class="p-2 text-left">Name</th>
    ...
</tr>
```

**Add** a `<th>` after Date:

```javascript
<th class="p-2 text-left">Hospital</th>
```

**Find** the patient row rendering (around line 1310):

```javascript
<td class="p-2 text-xs">${p.date || ''}</td>
```

**Add** after this line:

```javascript
<td class="p-2 text-xs">${p.hospital || ''}</td>
```

## Step 6: Add Export to OneDrive Button

**Find** the handoff button section (around line 3160):

```html
<button onclick="window.generateHandoff()" class="...">📋 Generate Handoff</button>
```

**Add** next to it:

```html
<button onclick="window.exportToOneDrive()" 
        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
    📤 Export to OneDrive
</button>
```

## Step 7: Add CSV Import Handler

**Find** the import file input (around line 3167):

```html
<input type="file" id="import-file" accept=".csv" class="hidden" />
```

**Add** after the input:

```html
<script>
document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
        complete: async (results) => {
            await window.handleCSVImport(results.data);
        },
        error: (error) => {
            console.error('CSV parse error:', error);
            showToast('❌ CSV parsing failed');
        }
    });
    
    e.target.value = ''; // Reset input
});
</script>
```

## Step 8: Add Export and Import Functions

**Find** the end of the script section (before `</script>`, around line 1450), add these functions:

```javascript
// ==================== EXCEL EXPORT ====================

window.exportToOneDrive = async () => {
    if (!isConnected) {
        showToast('⚠️ Export requires online connection');
        return;
    }
    
    try {
        showToast('📦 Generating Excel file...');
        
        // Prepare workbook data
        const wb = XLSX.utils.book_new();
        
        // Get today's on-call data
        const today = new Date().toISOString().split('T')[0];
        const todaySchedule = onCallSchedule.find(s => s.date === today) || {};
        
        // Build rows
        const rows = [];
        
        // On-call header (rows 1-3)
        rows.push(['', 'Date of Service', 'PROVIDER ON CALL', 'ON CALL AT HOSPITALS', '', '', '', '', '', '']);
        rows.push(['Physician On-Call:', todaySchedule.date || today, todaySchedule.provider || globalSettings.onCall, todaySchedule.hospitals || globalSettings.hospitals, '', '', '', '', '', '']);
        rows.push(['Physician On-Call:', '', '', '', '', '', '', '', '', '']);
        
        // Column headers (row 4)
        rows.push(['Hospital/Room #', 'Date of Service', 'Name', 'DOB', 'MRN', 'Dx/Findings', 'Plan', 'Supervising MD', 'Pending Tests/Info', 'Follow-Up Appt']);
        
        // Group patients by hospital
        const grouped = {};
        patients.filter(p => !p.archived).forEach(p => {
            const hosp = p.hospital || 'Other';
            if (!grouped[hosp]) grouped[hosp] = [];
            grouped[hosp].push(p);
        });
        
        // Add patient rows with hospital sections
        Object.keys(grouped).sort().forEach(hospital => {
            // Hospital header row
            rows.push([hospital, '', '', '', '', '', '', '', '', '']);
            
            // Patient rows
            grouped[hospital].forEach(p => {
                rows.push([
                    p.room || '',
                    p.date || '',
                    p.name || '',
                    p.dob || '',
                    p.mrn || '',
                    p.findingsText || '',
                    p.plan || '',
                    p.supervisingMd || '',
                    p.pending || '',
                    p.followUp || ''
                ]);
            });
        });
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Rounding List');
        
        // Generate Excel file as base64
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        
        // Generate filename with today's date
        const fileName = `Rounding List ${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Upload to OneDrive via API
        showToast('📤 Uploading to OneDrive...');
        
        const result = await apiCall('/api/export', {
            method: 'POST',
            body: JSON.stringify({
                fileContent: wbout,
                fileName: fileName
            })
        });
        
        showToast(`✅ Exported: ${fileName}`);
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('❌ Export failed: ' + error.message);
    }
};

// ==================== CSV IMPORT ====================

window.handleCSVImport = async (data) => {
    if (!data || data.length < 5) {
        showToast('⚠️ Invalid CSV file');
        return;
    }
    
    try {
        showToast('📥 Processing CSV...');
        
        // Pass 1: Extract on-call schedule (rows 1-3)
        const onCallRows = data.slice(0, 3);
        const newSchedule = [];
        
        onCallRows.forEach(row => {
            if (row[0] === 'Physician On-Call:' && row[1] && row[2]) {
                newSchedule.push({
                    date: row[1],
                    provider: row[2],
                    hospitals: row[3] || ''
                });
            }
        });
        
        // Pass 2: Get column headers (row 4)
        const headers = data[3];
        
        // Show mapper modal (simplified - auto-map by position)
        const columnMap = {
            room: 0,
            date: 1,
            name: 2,
            dob: 3,
            mrn: 4,
            findingsText: 5,
            plan: 6,
            supervisingMd: 7,
            pending: 8,
            followUp: 9
        };
        
        // Pass 3: Parse patient rows (from row 5)
        const patientsToImport = [];
        let currentHospital = '';
        
        for (let i = 4; i < data.length; i++) {
            const row = data[i];
            
            // Skip empty rows
            if (!row[0] && !row[1]) continue;
            
            // Detect hospital section header (only first cell has value)
            if (row[0] && !row[1] && !row[2]) {
                currentHospital = row[0];
                continue;
            }
            
            // Patient row
            if (row[columnMap.room] || row[columnMap.date]) {
                patientsToImport.push({
                    room: row[columnMap.room] || '',
                    date: row[columnMap.date] || '',
                    name: row[columnMap.name] || '',
                    dob: row[columnMap.dob] || '',
                    mrn: row[columnMap.mrn] || '',
                    hospital: currentHospital,
                    findingsText: row[columnMap.findingsText] || '',
                    plan: row[columnMap.plan] || '',
                    supervisingMd: row[columnMap.supervisingMd] || '',
                    pending: row[columnMap.pending] || '',
                    followUp: row[columnMap.followUp] || '',
                    priority: false,
                    procedureStatus: 'To-Do',
                    archived: false,
                    findingsCodes: [],
                    findingsValues: {}
                });
            }
        }
        
        showToast(`📋 Importing ${patientsToImport.length} patients...`);
        
        // Batch import
        let successCount = 0;
        let errorCount = 0;
        
        for (const patient of patientsToImport) {
            try {
                await apiCall('/api/patients', {
                    method: 'POST',
                    body: JSON.stringify(patient)
                });
                successCount++;
            } catch (error) {
                console.warn(`Import failed for patient ${patient.mrn}:`, error);
                errorCount++;
            }
        }
        
        // Import on-call schedule
        for (const schedule of newSchedule) {
            try {
                await apiCall('/api/onCallSchedule', {
                    method: 'POST',
                    body: JSON.stringify(schedule)
                });
            } catch (error) {
                console.warn('Schedule import failed:', error);
            }
        }
        
        await loadAllData(); // Refresh
        showToast(`✅ Imported: ${successCount} patients, ${errorCount} errors`);
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('❌ Import failed: ' + error.message);
    }
};
```

## Step 9: Update MSAL Configuration

**In azure-integration.js** (or the inline script), update these lines:

```javascript
const msalConfig = {
    auth: {
        clientId: "YOUR_CLIENT_ID_HERE", // Replace with your Entra ID app client ID
        authority: "https://login.microsoftonline.com/YOUR_TENANT_ID_HERE", // Replace with your tenant ID
        redirectUri: window.location.origin
    },
    ...
};
```

Replace `YOUR_CLIENT_ID_HERE` and `YOUR_TENANT_ID_HERE` with your actual Entra ID values.

## Step 10: Test Locally (Optional)

Before deploying, you can test the HTML file locally:

1. Comment out the MSAL auth initialization
2. Set `isConnected = false` to force offline mode
3. Open the HTML file in a browser
4. Test UI changes (hospital field, buttons, etc.)

## Step 11: Deploy to Azure

Follow the steps in `AZURE_MIGRATION.md` to deploy to Azure Static Web Apps.

## Key Changes Summary

✅ Removed Firebase SDK  
✅ Added MSAL.js for Entra ID authentication  
✅ Added SheetJS (xlsx.js) for Excel export  
✅ Replaced `onSnapshot` listeners with 15-second polling  
✅ Added localStorage caching for offline mode  
✅ Added hospital field to patient form and table  
✅ Added "Copy from Previous Visit" button  
✅ Implemented 3-pass CSV import (on-call + sections + patients)  
✅ Built Excel export with versioned OneDrive upload  
✅ All CRUD operations now call `/api/*` endpoints  
✅ Role-based field masking (billing codes hidden for clinicians)  

## Troubleshooting

- **"YOUR_CLIENT_ID_HERE" error**: Update msalConfig with real Entra ID values
- **401 Unauthorized**: Check EasyAuth configuration in Azure Static Web App
- **Offline mode persists**: Clear localStorage and refresh
- **Import fails**: Check CSV format matches template (3 header rows + column headers)
- **Export fails**: Ensure Files.ReadWrite permission granted to user in Entra ID

## Next Steps

1. Create SharePoint Lists with schema from `AZURE_MIGRATION.md`
2. Set up Entra ID app registration with app roles
3. Deploy Functions API to Azure
4. Update environment variables
5. Test end-to-end workflow
