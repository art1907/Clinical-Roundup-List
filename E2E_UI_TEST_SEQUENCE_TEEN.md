# Clinical Rounding UI Test - Teen-Friendly Script

## Mission Setup
You are the app explorer.
Goal: Find bugs, confusing screens, and things that feel slow.

Use this data file for manual entry:
- E2E_TEST_RECORDS_MANUAL.txt

Do not rush. If something feels weird, write it down.

## Quick Rules
1. If a button does nothing, note it.
2. If text is hard to read, note it.
3. If a screen takes more than 3 seconds, note it.
4. If you are unsure where to click next, note it.

---

## Level 1 - Easy Win (Smoke Test)

### Step 1: Open App and Check Header
- Open the app.
- Confirm the top bar shows app title and main buttons.
- Confirm connection status appears.

Feedback check:
- Was anything missing from the top bar?
- Did anything look broken right away?

### Step 2: Add 3 Records Manually
- Click Add.
- Enter Record 01, Record 02, Record 03 from E2E_TEST_RECORDS_MANUAL.txt.
- Save each one.

Feedback check:
- Could you clearly see the close X icon?
- Were any fields confusing?
- Did save confirmation appear each time?

### Step 3: Verify Census Table
- Go to Census tab.
- Confirm default view is Table.
- Search for MRN 900001.

Feedback check:
- Did search feel fast?
- Could you understand row details without guessing?

---

## Level 2 - Workflow Test (Core Actions)

### Step 4: Edit and Audit
- Open Record 01.
- Change Hospital and Procedure Status.
- Save with a change reason.
- Go to Audit tab and Load Logs.
- Expand the newest audit row.

Feedback check:
- Was the expanded audit detail easy to understand?
- Did it clearly say where the action happened?
- Any noisy or duplicate audit rows?

### Step 5: Status + Priority Test
- Update Record 05 to STAT and In-Progress.
- Check that visual highlight is obvious.
- Return to Audit and verify details.

Feedback check:
- Did STAT styling stand out enough?
- Was audit summary readable for non-technical users?

### Step 6: Batch Select Test
- In table view, select 3 records.
- Use batch action: Change Status.
- Confirm all selected rows update.

Feedback check:
- Was batch bar visible immediately?
- Did any selected row fail to update?

---

## Level 3 - Navigation Test

### Step 7: Tab Switching
- Switch tabs in this order:
  Census -> Surgical -> Calendar -> Staffing -> Census
- If using Card view, verify cards refresh when returning.

Feedback check:
- Any stale data after tab switching?
- Any tab that feels slower than others?

### Step 8: Procedures + Timeline
- Open Procedures tab and verify surgical records appear.
- Open Timeline and filter by one MRN.

Feedback check:
- Is timeline readable at first glance?
- Did filters behave as expected?

---

## Level 4 - Data Volume Test

### Step 9: Enter Remaining Records
- Enter Records 04 to 20 from E2E_TEST_RECORDS_MANUAL.txt.
- Save each record.

Feedback check:
- Did form performance degrade with more records?
- Did any field fail to save?

### Step 10: Sort + Filter Stress
- Sort by Room, Date, and Hospital.
- Apply filters for Status and Hospital.
- Reset filters.

Feedback check:
- Any sort that looked wrong?
- Could you easily get back to all records?

---

## Level 5 - End-to-End Verification

### Step 11: Archive + Restore
- Archive one non-critical record.
- Confirm it disappears from active list.
- Go to Archive tab and restore it.

Feedback check:
- Was this flow easy to understand?
- Did restored record return correctly?

### Step 12: Export Test
- Run one export flow (PDF or file export).
- Confirm file generation succeeds.

Feedback check:
- Was export result clear and expected?
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

Thanks for testing. Your notes will directly improve the UI for everyone.
