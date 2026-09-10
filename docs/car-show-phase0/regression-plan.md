# 2025 parity regression plan

## Independent expected results

The supplied awards-summary.pdf is a three-page raster document. All pages were rendered and visually inspected. `awards-2025.fixture.json` independently transcribes all 51 award labels, public numbers, display asterisk, total/paint/interior/engine values and page location. `awards-2025-identities.csv` contains the dump-derived names/cities/vehicle details, visually checked against the PDF, plus internal car/score IDs. Preserve capitalization and punctuation, including D’Agostino and lower-case dan sullivan/chevelle.

Never regenerate expected ranks or numeric results from the award implementation. Any fixture correction requires rechecking the original PDF and documenting the changed field. The SQL and PDF checksums are pinned in source-manifest.json.

Full Top 40 public-number order:

```text
64, 30, 127, 246, 243, 176, 11, 135, 227, 67,
186, 21, 235, 90, 231, 104, 221, 204, 105, 68,
228, 253, 222, 150, 237, 239, 226, 31, 146, 230,
238, 98, 131, 233, 234, 250, 100, 245, 112, 252
```

Major winners: Best in Show #240; classes in prescribed order #241, #106, #242, #183, #70, #248, #23; categories Paint #236, Interior #96, Engine #193*. The star is part of display parity. Winner uniqueness is per internal car identity, never participant; a participant may win with multiple cars (e.g. #186 and #230).

## What Phase 0 verified

- Parsed all five source tables without executing the SQL; exact counts and FK integrity verified. No duplicate public numbers or score-car keys.
- Independently recomputed 17-field progress and four NULL-propagating sums for all 71 score records. All stored progress values agree; inputs have no range violations.
- Compared 204 numeric PDF values (51 × 4) against the source-derived values: no differences.
- Applied a local stable-sort model to the source score INSERT order, using total descending with NULL last initially, removing Show/class winners, sorting the remaining list in place by Paint, Interior, Engine, then total. All 51 award labels/order/public numbers and three category tie flags match the PDF.
- Visually checked all displayed participant/city/vehicle metadata against the joined fixture. No content discrepancies found.

This is a source preflight, not native execution of WordPress or Postgres. No actual MariaDB query plan/order, PHP runtime behavior, target DDL execution, target importer, API, RLS policies or PDF generator was tested. SQL insertion order is only a diagnostic seed. The preflight helper is deliberately not an application award engine; its treatment of PHP NULL/numeric comparisons must not be generalized beyond this fixture without reference tests.

## A. Native legacy oracle (after separate implementation authorization)

Restore the pinned dump to isolated MariaDB 10.11. Run the exact initial award SELECT and capture its complete ordered 71-row result, including NULL totals and internal IDs. Record server SQL mode, collation, connection timezone, EXPLAIN output and actual PHP version. Invoke the active plugin scoring/award functions in a minimal WordPress/reference harness and capture each exclusion and sort stage, category tie flags and rendered rows.

PHP export version is 8.4.24 in 2026; request/verify the 2025 WordPress runtime before claiming runtime parity. Compare native output with the PDF and local replay. Repeat native queries with the same data to identify unstable equal-score input order. If native output differs, retain both artifacts and report the ambiguity; never change the PDF fixture or add a hidden ID sort.

Confirm actual quick-edit writes to generated columns and SQL warning/error behavior, invalid numeric coercion, repeated no-op section saves, and missing-score Lions Choice behavior. Isolate malformed-input tests from production data. Record Quick Edit and no-score voting as intentional D5/D7 deviations: those known legacy defects are not target acceptance expectations. No native or target harness is implemented or executed in this final revision pass.

## B. Target migration and score assertions

| Test | Required assertion |
|---|---|
| Counts and identity | Exact approved counts, every source ID mapped once, all FKs preserved, no contact deduplication, no fabricated Auth users. |
| ID/number confusion | Best in Show registration public 240→legacy car 244→score 13; Paint public 236→car 240. QR/lookup/action paths resolve registration correctly. |
| Base fields | Compare all 71 × 17 inputs using NULL-safe equality, independently of generated totals. |
| Totals | All 71 four-column totals match restored MariaDB; maximum vector returns 60/40/40/180; a missing section field makes that subtotal and overall total NULL. |
| Zero / progress | All-zero complete vector has 100% progress and total 0. One valid zero returns 5.88%; wheels only 11.76%; body_paint only 23.53%; engine only 29.41%; 16 valid fields 94.12%. NULL/blank/invalid are not completed. Blank/NULL/missing inputs in the submitted scope store NULL; invalid nonblank input rejects the operation. Unselected judging sections are unchanged. |
| Partial archival | Score 19/car 48 stays Archived, 29.41%, NULL total; its history is retained. No filtering it out of the legacy award input. |
| Section isolation | Judge A Engine and judge B Interior preserve each other’s fields; untouched fields remain NULL. All six identifiers and maxima tested. |
| State change | Successful section save reaching 100% sets Judged; subsequent same-value save retains Judged and appends history. No automatic downgrade. Quick Edit also recomputes progress and promotes at 100%; clearing a completed score reduces progress but retains Judged. |
| Concurrency | Two first submissions create one score; both sections and history survive. Same-section concurrent saves serialize, with one history per successful submission. Failed transaction has neither partial score update nor history/status update. |
| Historical submissions | Exact 486 IDs and counts by section, all 58 repeated groups intact; preserve WordPress IDs/logins and both clock values. Auth UUID and submitted_at NULL for imported records; timestamp_basis=legacy-unresolved; judge_name_snapshot equals original login. All action_type values are section_submission with source section_updated mapped to section; both score payloads NULL. No invented numeric snapshots or admin history. |
| New submissions | Judge comes from authenticated session, server timestamp set, snapshot retained; repeated deliberate submissions are distinct; unauthenticated writes rejected. |
| Lions Choice | Registration vote sum is 2 with per-registration mapping equality. No scores.lions_choice column. Voting on one of the 185 registrations without a score increments its registration counter without creating scores/history or changing status/progress/awards. Concurrent votes do not lose increments; >=1 display/filter and descending votes use registrations. Negative counts are rejected; new-year votes start at 0. |
| Quick Edit input | Full-form all-zero vector stores 17 zeroes, progress 100%, total 0 and Judged. One zero plus 16 blank/missing values yields 5.88% and NULL total. NULL/empty/whitespace/omitted controls are incomplete. Reject negative, over-max, fractional, boolean, NaN/infinity and partially numeric values before SQL casts; failure changes no score, status or history. |
| Quick Edit audit | Each successful intentional edit, including a same-value edit, appends one admin_quick_edit with NULL section, authenticated admin UUID, server time and name snapshot. Before/after payloads contain all 17 validated inputs from the locked row. Stale full-form edits are rejected/reloaded; concurrent section saves cannot be silently overwritten. Score, progress, promotion and history roll back together on failure. |
| Action/section constraint | Accept section_submission with each of the six exact identifiers; reject NULL/unknown section. Accept admin_quick_edit only with NULL section and before/after objects; reject a judging section attached to Quick Edit, unknown actions and incomplete payloads. Repeated identical section submissions remain distinct; reject edits/deletions of existing history except system Auth UUID nulling. |
| Number allocation | New event allocates 1 then 2. Concurrent same-event registrations get distinct sequential numbers; separate events each start at 1. Duplicate event/car, event/number and registration/score writes fail. Import preserves original numbers and seeds MAX+1. Rollback consumes no number; archival never resets the counter. Test public, admin and CSV paths through the same locked allocator. |
| Vehicle snapshots | All 256 imported year/make/model snapshots exactly match legacy cars. Change persistent car year across a class boundary and change make/model: every 2025 award row, rank, marker and historical vehicle label remains unchanged. New-year registration captures edited values while 2025 snapshots remain untouched. No award query or historical vehicle display falls back to current cars. |
| Event time | New event stores America/Indiana/Indianapolis and target runtime recognizes it. Test event rendering using installed tzdb rules across seasonal transitions; do not hardcode offsets. Legacy event timezone/date remain unresolved, all raw/wall-clock history values match exactly and historical submitted_at stays NULL without a seven-hour adjustment. |
| Rerun | Same source twice leaves counts, UUIDs, field values and history unchanged; changed target/source fails explicitly; interrupted run rolls back. |
| Unicode and equality | Names, punctuation, email duplicates, empty vs NULL, ZIP/phone strings preserved; case/accent/trailing-space and escaped wildcard searches compared against native source. |

## C. Award acceptance

Run migrated inputs through the new award implementation and compare exact fixture entries, all four numeric fields, public/internal mappings, displayed metadata and the Engine star. Assert exactly one Show, seven ordered classes when available, three ordered categories and 40 remaining distinct cars for this fixture.

Eligibility is the inner join of cars/registrations, participants and existing scores; no status, payment, progress, positive-score or Lions Choice filter. Classes derive exclusively from event_registrations.vehicle_year, including boundary 1949/1950, 1959/1960 through 1999/2000; preserve stored classification separately. Source mismatches (car IDs 177,195,204,224) must not be “repaired” to make class selection work.

Preserve sequential exclusions and in-place sort input history. Add synthetic cases: empty inputs; fewer than 40 remaining; absent class; a Show winner also leading its class/category; category winner tied with an already excluded car; category tied with another remaining car; equal totals spanning the Top 40 cutoff; 0 and NULL totals. Compare PHP null/zero/numeric-string comparator and duplicate-marker semantics explicitly in the native harness; do not assume generic JS or SQL sorts agree.

Do not replace the final total sort with total+engine+interior+paint or total+ID. Such keys may accidentally mimic this fixture but define new policy. Tie tests should verify comparator equality and inherited sequence under a supplied reference input, and separately surface uncertainty in database initial order. If a migration round trip changes tied winners/order, acceptance is blocked pending explicit resolution of the observed divergence under D3; a fixture match cannot justify a new general tie rule.

## D. Feature-level acceptance after UI authorization

Exercise participant add/search/edit, multiple cars per owner, archived returning participants, another car, and same permanent car in a new yearly event with independent number/class/status/payment, vehicle snapshots, votes and scores. A new year must not copy old scores or mark returning entrants Judged. The event allocator must implement the approved D4 behavior under concurrency.

Exercise car filters/manual status and payment, QR from detail to the correct registration’s judging page, section history ordered by preserved legacy time or new submitted_at as appropriate, score-list sorting/row marking, quick edits, CSV’s exact 11 columns/header/defaults/duplicate behavior and statistics. Baseline dashboard counts are 74 registered, 70 checked-in (includes Judged), 70 judged and 73 paid; percentages 94.59%, 100%, 98.65%. Test zero denominators and archived-but-paid entries.

Render the new awards PDF and inspect every row, title, logo, columns, four score values, category marker and exact award ordering against the original. Content/order are strict gates. The source raster export clips/splits rows at page boundaries; decide with the user whether exact pagination artifacts are required rather than silently treating improved pagination as functional parity. Never claim byte-identical PDF output from a new rendering stack.

## E. Security and release gate

Verify RLS enabled on every application table and no unauthenticated/authenticated API access without approved policies. Once roles are approved, test authorized judge/admin/public paths and cross-event access using actual user JWTs, not service-role-only tests. Verify forbidden history mutation/deletion, spoofed judge attribution, client-written audit payloads and generated-total writes. Deleting a score with history must fail rather than cascade. Deleting an Auth user only nulls the UUID on its history; snapshot, legacy IDs, times, action, section and payload remain unchanged. Deactivation preserves all history and the still-existing UUID. Test administrative Quick Edit with an approved admin and reject non-admin callers once roles are defined. No password hashes or fake legacy users in target, logs or CI fixtures.

Release requires documented native-oracle/PDF agreement, target migration integrity, full score/award regression, approved decision resolutions, RLS tests and later workflow/PDF acceptance. Attach evidence and unresolved limitations to review. Phase 0 itself does not authorize that implementation or release.
