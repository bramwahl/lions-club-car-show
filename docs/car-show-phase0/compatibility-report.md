# MySQL / MariaDB to Postgres compatibility audit

## Source authority and scope

The supplied SQL identifies MariaDB 10.11.18, phpMyAdmin 5.2.3 and export PHP 8.4.24, exported September 9, 2026. The export date does not establish when every row was registered. Only the five `qkby_` tables exist in this dump. Constraint names beginning `x8qw_` are old names attached to these qkby tables, not another source dataset.

Source references below use line numbers in the supplied SQL and paths within the ZIP. `main` means `lions-club-car-show/lions-club-car-show.php`; `participants` means the included `lionsclub-participants-page.php`. Main line 190 loads that participant file. The similarly named typo file and standalone cars-page variants are not loaded by this entry point and must not override active behavior. Plugin activation DDL is stale relative to production: e.g. progress is an integer there but decimal(5,2) in the dump. Production DDL is authoritative for storage; active handlers are evidence for workflows.

Source behavior below remains the baseline. Approved target deviations are recorded in decisions.md (D5 Quick Edit, D6 history retention, D7 registration votes, D8 vehicle snapshots); this audit does not override those resolutions.

## Compatibility matrix

| Actual evidence | Postgres proposal / parity consequence |
|---|---|
| Signed BIGINT(20) keys with AUTO_INCREMENT added later (SQL 1234–1294) | UUID application keys with unique nullable signed bigint legacy IDs. Fixed UUIDv5 mapping for imported rows, database UUID defaults for new rows. Display width 20 is not a digit constraint. Public car numbers remain separate bigint values, serialized as strings at JavaScript boundaries. |
| WordPress user IDs and update user_id are UNSIGNED BIGINT | Preserve as numeric(20,0), bounded to unsigned 64-bit range, rather than assuming every future export fits signed bigint. Do not import WordPress authentication material. |
| YEAR(4) NOT NULL (SQL 35) | smallint vehicle year. Actual range 1917–2023; support MariaDB’s stored domain 0 or 1901–2155 in draft. Preserve 0 if encountered and flag it, never reinterpret as a current year. No two-digit input coercion in migration. |
| paid ENUM('Paid','Unpaid'); status/classification nullable varchar(20) | Payment text CHECK and exact literals; nullable status/classification with allowed-value checks in draft, preserving current null/empty semantics. Unsupported future source values block import for review, never silently coerce. |
| INT(11), INT(3) | Plain integer / smallint with explicit ranges; display width does not enforce score maxima. Production has no range CHECKs; section handler enforces them. All supplied scores are in range. |
| Nullable 17 score inputs and stored generated totals (SQL 576–602) | Keep NULL propagation, no COALESCE to zero. Postgres total expression expands all 17 fields: it cannot reference the three other generated columns. |
| progress DECIMAL(5,2) NOT NULL default 0 | numeric(5,2) stored for parity with independently updated progress. Section-save and approved D5 Quick Edit transactions recompute valid-field count / 17 × 100, rounded to two decimals; display uses whole-percent rounding. Preserve imported stored progress and compare recalculation. |
| DATETIME defaults and current_time('mysql') (SQL 688; main 928) | Preserve timezone-free source values as timestamp without time zone plus exact raw strings. New records use timestamptz. Historical normalized instant remains NULL until timezone mapping is approved. Export SET time_zone='+00:00' does not give DATETIME values timezone provenance. |
| utf8mb4_unicode_520_ci; updates table latin1_swedish_ci with section_updated utf8mb4_unicode_ci | Decode exported UTF-8 connection literals, not a blanket Latin-1 reinterpretation. Preserve Unicode, punctuation, case, whitespace and empty strings. Postgres default comparison is not equivalent to these collations; case-insensitive search needs tests, and ILIKE alone does not reproduce all accent/trailing-space/equality behavior. |
| Participant email NOT NULL, but empty and duplicate values possible | No UNIQUE(email), trimming, lowercasing or name-based merge. Eight exact duplicate-email groups exist. One admin helper checks email equality, but shortcode and CSV bypass that check; preserve workflow distinctions unless approved otherwise. |
| Foreign keys cars→participants and scores→cars have default restrictive deletion; score_updates→scores and →users cascade | Restrict participant/car/registration deletion. The revised append-only model restricts score deletion to prevent cascading history loss. New Auth deletion retains history via SET NULL + attribution snapshot (approved D6). |
| No unique car_number or scores.car_id constraint in production | No duplicates in supplied data; proposed per-event number, per-event car and per-registration score uniqueness are approved D4 enforcement, not source guarantees. |
| ORDER BY s.total_score DESC (main 1494) | Use DESC NULLS LAST for initial Postgres query. Default Postgres DESC puts NULL first, which could make the partial score Best in Show. Do not add a secondary order key. |
| $wpdb prepare/update/insert/get_row, dbDelta, backticks, %d/%s/%f | Replace with parameterized queries, explicit migrations and transactional section writes. Distinguish false (error) from 0 (successful no-op); same-value submissions still append history. Whitelist sort identifiers separately from values. Do not translate SQL strings mechanically. |

Postgres documents [generated-column restrictions](https://www.postgresql.org/docs/18/ddl-generated-columns.html) and [NULL ordering](https://www.postgresql.org/docs/current/queries-order.html). Confirm the eventual Supabase project’s Postgres version before executing the draft.

## Observed data issues

- 88 cars have different internal IDs and public numbers. Best in Show is internal car **244**, public **240**, score **13**. Paint winner is internal **240**, public **236**. Incorrect joins can appear plausible while identifying a different car.
- 14 participants own multiple cars. Preserve all 239 participants and all 256 cars independently.
- Status counts: Archived 182, Registered 4, Judged 70, Checked-in 0. Paid 73, Unpaid 183. None of these imply an authenticated participant account.
- 71 distinct scores reference 71 cars, no duplicate score-car or public-number values. All declared FK relationships resolve, including every historical judge.
- Score **19**, public/internal car **48**, is Archived with progress **29.41%** and NULL total. Include it in the initial legacy award input. Do not silently turn it into Judged, complete its missing inputs or discard its history.
- 74 score fields contain zero. Every stored progress value matches valid-field recomputation; no out-of-range inputs found.
- Stored classification disagrees with vehicle-year classification for internal car IDs **177, 195, 204, 224**. Preserve stored classification. Awards must continue deriving class from year.
- All 486 history rows use `section_updated` and `score_id` as meaningful links; every redundant `car_id` is **0**, every redundant `section` is **empty**. Join history→score→car, never history.car_id.
- Repeated (score_id, section_updated) submissions occur in **58 groups**. Keep every update ID. Sections: wheels_tires 100, appearance 77, body_paint 74, body_plating 76, interior 74, engine 85.
- `timestamp` is seven hours later than `updated_at` on 484 rows; two differ by 6:59:59. This is evidence of distinct clock sources, not proof of a timezone. WordPress [current_time](https://developer.wordpress.org/reference/functions/current_time/) uses the site timezone by default. Site options and production 2025 runtime settings were not supplied.
- Lions Choice totals sum to **2**. It is an aggregate counter, not a historical ballot ledger.

## Actual workflow inventory

| Feature | Active source / behavior to preserve |
|---|---|
| Participants | participants 4–195, 394 onward: add/edit, sort by ID/name, name substring search, list associated cars, add another car. Admin add checks existing email; public/CSV inserts do not. |
| Car list and management | main 203–492: participant/vehicle search, status and paid filters, manual status/payment changes, vehicle editing. Editing year does not update stored classification. |
| Registration / reuse | main 1839–2188: year→class, new participant+car, existing participant lookup with phone suffix and city, list prior cars, add another. Reusing the same car for a genuinely separate yearly event is the approved structural goal, not a workflow already modeled by the source. |
| Numbering | participants 67; main 1906 etc.: MAX(car_number)+1, fallback 1. New event allocator needs locking and approved per-event reset; do not substitute internal IDs. |
| QR and printing | participants 239 onward: car detail uses internal car ID in hard-coded judging URL, QR provider, print detail. New QR must target event registration with authenticated judge navigation. |
| Section judging | main 797–980, 1224–1380: all fields in selected section required, zero valid, integer coercion, range checks, untouched fields remain NULL, append attribution history and recalculate progress. At 100% promote status to Judged; no automatic downgrade branch. |
| History | main 1352–1378: user_login via LEFT JOIN users, section_updated, timestamp descending. Source stores score reference, not a snapshot of prior numeric section values. Do not fabricate unavailable historic values. |
| Quick score editing | main 541–754: public-number lookup→internal ID, writes all numeric fields and attempts generated totals; does not update progress/status/history. Actual MariaDB warning/error behavior needs replay. D5 now explicitly approves strict inputs, recomputed progress/promotion and separate administrative audit history, without generated writes. |
| All scores | main 2190–2376: joined score list, selectable sort fields/direction, row marking/highlight and summary display. Preserve selected-row behavior and columns in later UI acceptance. |
| Awards/PDF | main 1483–1819: all scored cars regardless of status, year-derived classes, successive in-place sorts/exclusions, category duplicate-score asterisk, 40 remaining. HTML table with title/logo and browser html2canvas/jsPDF raster export, landscape letter. |
| CSV | main 2501–2590: skip first row; columns Name, Email, Phone, Address, City, State, ZIP, Year, Make, Model, Notes; insert a participant per row without deduplication, next car number, Archived/Unpaid defaults. |
| Dashboard | main 2593 onward: registered = status != Archived; checked-in = status NOT IN (Archived,Registered), so includes Judged; judged = Judged; paid = all Paid including archived. Percent denominators respectively registered, checked-in, registered, zero-safe. |
| Lions Choice | main 2391–2498: lookup public number, increment existing scores.lions_choice; no score row means 0 rows updated but UI reports success. Results >=1 ordered votes DESC; does not affect award exclusion or 180-point score. D7 now approves registration-owned aggregate votes, including no-score registrations without score fabrication. |

The source section path logs success without a transaction or fully checking database failures. Preserve the user’s requirement of logging a *successful* submission through an atomic transaction; do not deliberately reproduce partial writes or false success. Record this implementation interpretation for review. The behavior of malformed numeric input (`intval`) also needs an explicit choice before replacing it with strict API validation.

## Award ordering risk

Initial SQL specifies total only. Categories each mutate the current remaining list; the final Top 40 total sort operates on the list left after Engine sorting. PHP 8 [usort preserves equal elements’ order](https://www.php.net/manual/en/function.usort.php); the 2026 export PHP version does not prove the 2025 web runtime version. Category asterisks compare equal category values against other *remaining* cars, not all entrants. Only Engine #193 has an asterisk in the supplied PDF.

A Python stable-sort replay seeded by score INSERT order matches the whole PDF. This does not authorize ORDER BY legacy_id or imply that dump insertion order was the original query tie order. Preserve the algorithm, capture a native reference run, and keep unresolved tie order visible; never force the expected PDF into the calculation.
