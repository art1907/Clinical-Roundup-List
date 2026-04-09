# Clinical Rounding UI Test

## Mission Setup
You are the app explorer.
Your job is to find bugs, confusing screens, and slow things.

Use this Excel file:
- **E2E Clinical Records.xlsx**

Very important:
- **1 record = 1 row in the Excel sheet**
- There are **20 total records**
- When this script says **Record 01**, **Record 02**, and so on, it means the matching **row** in the Excel file

Take your time.
If something feels weird, write it down.

## Quick Rules
1. If a button does nothing, write it down.
2. If text is hard to read, write it down.
3. If a screen takes more than 3 seconds, write it down.
4. If you are not sure where to click next, write it down.
5. If a status looks old or wrong, write it down.

---

## Level 1 - Easy Win (Smoke Test)

### Step 1: Open App and Check Header
- Open the app.
- Check that the top bar shows the app title and main buttons.
- Check that connection status appears.

Feedback check:
- Was anything missing from the top bar?
- Did anything look broken right away?

### Step 2: Add First 3 Records from the Excel File
- Open **E2E Clinical Records.xlsx**
- Look at **row 1**, **row 2**, and **row 3**
- Click **Add**
- Enter the data from **Record 01**, **Record 02**, and **Record 03**
- Save each one

Remember:
- Each record you enter is **one row** from the Excel sheet

Feedback check:
- Could you clearly see the close X icon?
- Were any fields confusing?
- Did save confirmation appear each time?

### Step 3: Verify Census Table
- Go to **Census** tab
- Confirm the default view is **Table**
- Search for **MRN 900001**

Feedback check:
- Did search feel fast?
- Could you understand row details without guessing?

---

## Level 2 - Workflow Test (Core Actions)

### Step 4: Edit and Audit
- Open **Record 01**
- Change **Hospital** and **Procedure Status**
- Save with a change reason
- Go to **Audit** tab
- Click **Load Logs**
- Expand the newest audit row

Feedback check:
- Was the expanded audit detail easy to understand?
- Did it clearly say where the action happened?
- Any noisy or duplicate audit rows?

### Step 5: Status + Priority Test
- Open **Record 05**
- Change it to **STAT**
- Change the status to **FOLLOW UP (CONSULT)** for this test
- Save
- Check that the visual highlight is obvious
- Return to **Audit** and verify details

Feedback check:
- Did STAT styling stand out enough?
- Was audit summary readable for non-technical users?

### Step 6: Update Old "To-Do" Status
The UI is being updated.

That means old status values like **To-Do** should now be changed using the new dropdown list.

Use the updated status dropdown shown in the new snapshot.

If you see **To-Do**, change it to one of these new values:
- **NEW CONSULT**
- **SURGICAL PATIENT (SAME DAY SURGERY)**
- **NEW SURGICAL PATIENT (AM ADMIT)**
- **FOLLOW UP (CONSULT)**
- **FOLLOW UP (POST OP)**
- **TO BE DISCHARGED/SIGNED OFF**

Important:
- Do **not** leave the value as **To-Do**
- Pick the new value that best matches the row
- If you are unsure, write a note

Simple guide:
- New patient = **NEW CONSULT**
- Same day surgery patient = **SURGICAL PATIENT (SAME DAY SURGERY)**
- New surgery morning admit = **NEW SURGICAL PATIENT (AM ADMIT)**
- Follow-up visit = **FOLLOW UP (CONSULT)**
- After surgery = **FOLLOW UP (POST OP)**
- Ready to leave = **TO BE DISCHARGED/SIGNED OFF**

Feedback check:
- Was it easy to find the new status dropdown?
- Did any row still show the old **To-Do** value after saving?
- Did the new value stay after refresh?

### Step 7: Batch Select Test
- Go to **Table view**
- Select **3 rows** using checkboxes
- Use batch action: **Change Status**
- In the batch status popup, choose the new status value
- Click **Continue**
- Enter a change reason when prompted
- Because the UI is being updated, use this to change old **To-Do** rows to a new status value
- Pick one option from the new list, such as:
  - **NEW CONSULT**
  - **FOLLOW UP (CONSULT)**
  - **FOLLOW UP (POST OP)**
- Confirm all selected rows update

Feedback check:
- Was the batch bar visible right away?
- Did any selected row fail to update?
- Could you batch change old **To-Do** rows without confusion?

---

## Level 3 - Navigation Test

### Step 8: Tab Switching
- If the selection tray is active, click **Clear Selection** first.
- Multi-select intentionally locks the app to **Census** and **Table View** while rows remain selected.
- Switch tabs in this order:
  **Census -> Surgical -> Calendar -> Staffing -> Census**
- If you are using **Card view**, check that the cards refresh when you come back

Feedback check:
- Any stale data after tab switching?
- Any tab that feels slower than others?

### Step 9: Procedures + Timeline
- Open **Procedures** tab and check that surgical records appear
- Open **Timeline**
- Filter by one **MRN**

Feedback check:
- Is the timeline easy to read at first glance?
- Did filters behave as expected?

---

## Level 4 - Data Volume Test

### Step 10: Enter Remaining Records from the Excel File
- Open **E2E Clinical Records.xlsx**
- Enter **Records 04 to 20**
- Save each one

Remember:
- By the end, you should have entered **20 total records**
- Each record matches **one row** from the Excel sheet

Feedback check:
- Did form performance get slower with more records?
- Did any field fail to save?

### Step 11: Sort + Filter Stress
- Sort by **Room** and **Hospital** using the table headers
- Use the **Date** filter field to verify date filtering
- Open **Adv. Filters** (top right) and apply filters for **Status** and **Hospital**
- Reset filters

Feedback check:
- Any sort that looked wrong?
- Could you easily get back to all records?

---

## Level 5 - End-to-End Verification

### Step 12: Archive + Restore
- Archive one non-critical record
- Confirm it disappears from the active list
- Go to **Archive** tab and restore it

Feedback check:
- Was this flow easy to understand?
- Did the restored record return correctly?

### Step 13: Export Test
Important:
- Do **not** export from the table screen
- Export must be done from the **Reports** tab
- Current build supports the **PDF** export flow from Reports

Do this:
1. Click the **Reports** tab
2. Pick any report type from the report dropdown
3. Click **Generate PDF**
4. Confirm the preview appears
5. Click **Download PDF**
6. Confirm the file is created
7. Open the file
8. Check that the updated statuses appear correctly

Feedback check:
- Was the Reports tab easy to find?
- Was the export result clear and expected?
- Did the exported file show the new status values?
- Any warning or error text confusing?

---

## Bug Report Template (Use This)

- Screen/Tab:
- What I clicked:
- What I expected:
- What happened:
- Severity (Low/Medium/High):
- Can I reproduce it? (Yes/No):
- Screenshot taken? (Yes/No):

---

## Final Feedback (Super Important)

1. What felt easiest in the app?
2. What felt most confusing?
3. Which screen looked best?
4. Which screen needs redesign first?
5. If you had 1 minute with the dev team, what would you ask them to fix first?

Thanks for testing.
Your notes will directly improve the UI for everyone.
