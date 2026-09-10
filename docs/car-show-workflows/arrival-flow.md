# Arrival and pre-registration workflow

This user-approved revision supersedes the original number-at-registration workflow.

1. Create/select the new event. Persistent participants and cars are reused, while each event owns fresh registrations, payment and scoring.
2. Before the show: Participants → participant → select saved cars → **Pre-register selected cars**. Record Paid/Unpaid for the selection, or preserve existing payment. New registrations default Unpaid. No public number is reserved.
3. On arrival: Participants → **Check in**, or Registrations → **Check in**. Confirm participant details; edit them if needed. Existing or newly added cars are available on this screen.
4. Confirm Paid/Unpaid for one car. Payment collection is manual; selecting Paid records it without charging anything.
5. **Complete check-in & print sheet** atomically creates/reuses that event registration, assigns the next event number, marks Checked-in, records payment, and opens its printable QR sheet.
6. Print, then use **Done / check in another car** for the same participant or **Next participant**. Reopening a sheet or repeating check-in reuses the number.

The visible Pre-registered status is stored as Registered to preserve existing status/statistics contracts. Participant/car IDs remain distinct from the public event number. A repeat check-in preserves Judged within the same event; a new event registration starts fresh. The prior bulk check-in UI is replaced by per-car check-in so each arrival leads to its sheet. Guarded bulk RPCs remain for compatibility.

Migration 010 makes new unassigned public numbers NULL, leaves all existing assigned numbers untouched, and preserves event/number uniqueness. The allocator locks the event row; simultaneous check-ins cannot share a number. Public numbers cannot be edited or reassigned. CSV staging and the earlier single-car Admin RPC also no longer reserve numbers. Historical 2025 snapshots, totals, attribution and awards are unchanged. No playground reset is introduced in this change.

Validation: 20 automated tests include pre-registration without allocation, advance payment, arrival order independent of pre-registration order, walk-ins, retry/reprint stability, no score inheritance and authorization. The live HTTP test exercises two concurrent check-ins, unique numbers, print redirects and idempotent reprint, followed by historical reconciliation. Scoring algorithms and the judging workflow are not redesigned here.

## Direct check-in from the participant's vehicle card

The vehicle card's payment dropdown and **Check in & open QR sheet** button now submit one form. The selected Paid/Unpaid value is saved by the existing atomic arrival operation before redirecting directly to the registration's print page. It no longer navigates to the check-in desk and discards an unsaved payment selection. **Pre-register only** (or **Save payment only** for an existing registration) remains a separate submit action using that same dropdown. Failed saves retain the selected payment in the form.
