# Encounter Model Notes

Status: parked for later implementation.

## Current State

The app currently works as a patient plus dated visit-row model.

- `MRN` is the main person identifier when present.
- `Date` is the daily service or rounding date.
- `VisitKey` is currently built around the existing visit-row model.
- Archive and grouped-history behavior still operate at the patient-history level, not at the encounter level.

This means true encounter tracking is not implemented yet.

## Target Model

Recommended future structure:

- One `MRN` = one person.
- One person can have multiple encounter numbers over time.
- One encounter can have multiple daily rounding rows.
- An encounter closes when the patient is discharged.

Target identity layers:

- `MRN` = person key
- `EncounterKey` = encounter key
- `Date` = daily rounding row date
- `VisitKey` = eventual daily-row key, recommended as `EncounterKey|Date`

## SharePoint Columns To Add

Add these columns before encounter-based code changes:

1. `EncounterNumber`
   - Type: Single line of text
   - Required: No
   - Unique: No
   - Purpose: Stores the hospital or ADT encounter number visible to users.

2. `EncounterStatus`
   - Type: Choice
   - Recommended values: `Open`, `Closed`
   - Default: `Open`
   - Required: No
   - Unique: No
   - Purpose: Marks whether the admission or stay is still active.

3. `AdmissionDate`
   - Type: Date and time
   - Recommended display: Date only
   - Required: No
   - Unique: No
   - Purpose: Start date of the encounter.

4. `DischargeDate`
   - Type: Date and time
   - Recommended display: Date only
   - Required: No
   - Unique: No
   - Purpose: End date of the encounter when closed.

5. `EncounterKey`
   - Type: Single line of text
   - Required: Yes once implementation starts
   - Unique: Yes
   - Purpose: Stable internal encounter identifier used by the app.

## Existing Columns To Keep

Keep the current columns as they are for now.

- `MRN` stays the patient identifier.
- `Date` stays the daily rounding or visit date.
- `VisitKey` stays in place for compatibility until the encounter migration is implemented.

## Recommended Semantics After Implementation

After the encounter model is implemented in code:

- `EncounterKey` should identify one admission or stay.
- `VisitKey` should be recalculated as `EncounterKey|Date`.
- Multiple rows with the same `EncounterKey` and different `Date` values will represent the daily notes for one encounter.
- A discharge should close only the active encounter, not the full MRN history.

## Practical Notes

- Do not make `EncounterNumber` unique. The app should rely on `EncounterKey` for internal uniqueness.
- If the hospital already guarantees globally unique encounter numbers, `EncounterKey` can be derived from that value.
- If not, build `EncounterKey` from a stable combination such as `MRN|EncounterNumber|AdmissionDate`.
- Existing grouped-history, archive, import-dedupe, and returning-patient logic will need a follow-up pass so they scope by encounter where appropriate.

## Implementation Prerequisite

Before code changes begin, confirm the final SharePoint internal names for these new columns. Display names can differ from internal names, and the Graph mapping in `m365-integration.js` must use the internal names.