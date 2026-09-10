# Proposed Supabase/Postgres model

The accompanying `schema-proposal.sql` is review-only DDL, not an applied migration. It incorporates the approved D1–D10 resolutions. Schema execution and Phase 1 remain unauthorized. Runtime/version checks, RLS authorization and native/target regression remain future gates.

## Relationships and field ownership

| Table | Meaning and provenance |
|---|---|
| events | One yearly event; stable UUID, unique slug, name/year, optional legacy date/timezone until confirmed; canonical new-event timezone `America/Indiana/Indianapolis` and `next_car_number` counter starting at 1. The fixed imported source key is `qkby:2025`. Creation metadata means import/system creation, not an invented legacy registration date. |
| participants | Persistent identity/contact data, unique nullable legacy_participant_id; email is not unique. No link to Auth is inferred from matching email. |
| cars | Persistent vehicle, original owner participant link, unique nullable legacy_car_id, year/make/model/notes. Do not deduplicate similar descriptions. |
| event_registrations | Event + car + registrant participant; owns public car_number, original classification, status, payment_status, legacy_car_id, vehicle_year/make/model snapshots and nonnegative lions_choice_votes (NOT NULL, default 0). Registrant is copied from the source participant at import. Future ownership changes do not change prior registrant. |
| scores | One score per registration, unique nullable legacy_score_id; the exact 17 nullable inputs, four generated totals and stored progress. Lions Choice is owned only by registrations. No scores are fabricated for unscored cars. |
| score_history | Append-only history linked to score; action_type distinguishes section_submission from admin_quick_edit. Section is required for submissions and NULL for Quick Edit. Retains legacy attribution/raw fields/times and nullable Auth UUID, plus judge snapshot and new administrative before/after score inputs. No unique section per score; no fabricated old numeric snapshots. |
| profiles | Actual Supabase Auth users only. Display name; no inferred admin/judge roles yet. Historical WP judges are attribution values on submissions, not fake profiles. |

A participant can have many cars and registrations. A car can have one registration in each of many events. Scores attach to registrations. Authenticated staff identity is independent of participant/owner identity.

The draft copies `participant_id` to registrations to retain the registering participant. Import validates agreement with the source owner; later owner-transfer rules are undefined. D8 adds vehicle snapshots to registrations: `vehicle_year` uses the same 0-or-1901–2155 domain as cars.year, and make/model retain varchar(255) and exact text. Populate once from the car at registration, exactly from legacy cars during import. Award class selection uses registration.vehicle_year; event vehicle display, awards/PDF and historical vehicle exports use registration.vehicle_year/make/model. Never fall back to mutable car fields or sync old snapshots when cars change. A new-year registration takes the then-current values. Snapshot correction/finalization workflows are not implemented. Participant name/city remain on persistent participants, so this decision stabilizes vehicle details and award calculations, not every historical display label.

## Exact score contract

| Section | Fields and maxima | Section max |
|---|---|---:|
| body_paint | coverage 15, quality 20, engine_bay 20, original 5 | 60 |
| body_plating | plating_brass 10 | 10 |
| interior | dash 10, seats 10, carpet 10, door_panels 10 | 40 |
| wheels_tires | rims_hub_caps 10, tires 10 | 20 |
| engine | block 10, intake 10, belts_hoses_caps 5, radiator 10, breather 5 | 40 |
| appearance | appearance 10 | 10 |

Total maximum 180, 17 fields. `overall_paint`, `overall_interior`, `overall_engine` are direct sums of their section inputs. `total_score` is the direct sum of all 17 inputs: algebraically equivalent to the legacy formula and valid in Postgres because it does not reference another generated column. Any NULL input propagates to the relevant section total and overall total. Zero is completed and is never treated as absence.

Progress is `round(100 * count(valid non-NULL score fields) / 17, 2)` using decimal arithmetic. In the new section-save operation, validate the selected section, lock/create its score row, update only that section, recompute progress, promote registration to Judged at 100%, and append exactly one submission in the same transaction. Never downgrade status automatically. A second successful identical submission adds a second history row. A failed write rolls back all changes. Request retry/idempotency behavior must distinguish a transport retry from an intentional new submission.

Stored progress preserves imported source values and is recomputed atomically by both successful section saves and administrative Quick Edit. Strict input validation occurs before database casts: integer values within each field maximum, no fractional truncation, booleans, non-finite values or partially numeric strings. Explicit zero is valid. Blank/NULL means incomplete, never zero. Invalid nonblank input rejects the entire operation.

Quick Edit is a full-form replacement of the 17 inputs: omitted fields, NULL and blank/whitespace-only controls become NULL. The UI must send the complete form; a future PATCH endpoint would need an explicit separate contract and must not silently reuse this missing-field behavior. Section submission changes only its selected section; missing/blank fields within that section become NULL and other sections stay untouched. This explicitly distinguishes missing submitted input from fields outside the operation's scope.

For Quick Edit, authorize an administrator on the trusted server, lock the registration and score in a consistent order shared with section saves, capture all 17 pre-edit values, validate/update the inputs, recalculate progress, promote to Judged at 100% and append an admin history record in one transaction. Never automatically downgrade a Judged registration after fields are cleared. Never write any generated total. A successful same-value intentional edit still appends history; rejected input, failed writes or rolled-back transactions append nothing. A score created by a real edit has a pre-edit vector of NULLs; voting never uses this path. Concurrent full-form edits require stale-version rejection/reload so they cannot silently erase a section save.

## Registration numbering and Lions Choice

D4 constraints enforce one registration per event/car, one public number per event and one score per registration. `events.next_car_number` is the proposed high-water counter: lock the event row, allocate its current value, insert the registration and increment within the same transaction. New events start at 1; migration preserves all source numbers and seeds MAX(imported car_number)+1. Every allocating path, including CSV and administrative registration, must use this transaction. Rollback does not consume a number; archived/deleted registrations do not cause committed numbers to be reused. The unique constraint is the final collision guard, not the concurrency mechanism. No allocator RPC is implemented in this SQL artifact.

D7 moves the aggregate to `event_registrations.lions_choice_votes`. Import each source score's aggregate through its legacy car FK; registrations without scores start at 0. Increment the registration atomically without any score join or score creation. Display/filter positive counts and sort by votes descending. Preserve the imported sum of 2 and keep votes out of score totals, progress, award eligibility and comparators. No ballot ledger or voter-identity model is introduced.

## Historical time and attribution

Map `section_updated`→section and `score_id`→score_id with `action_type=section_submission` for every legacy row. Preserve old user ID and `qkby_users.user_login`. Preserve `timestamp`, `updated_at`, car_id=0, empty section and section_updated verbatim. Native DATETIME conversion can coexist with raw strings so zero/invalid values in a later export can be quarantined without loss.

Until clock provenance is approved, historical submitted_at is NULL and timestamp_basis is legacy-unresolved. Display historical history using its preserved legacy_timestamp and username; do not interpret it in the browser timezone. New submissions require the authenticated UUID supplied by the trusted server session, server timestamptz, and judge-name snapshot. No client-selected judge identity. If a staff account is removed, retain snapshot and history with user_id NULL (D6). Deactivation keeps the UUID link while the account exists and does not delete history. Populate imported judge_name_snapshot from the exact legacy user_login, retaining legacy_username separately.

`score_history.action_type=section_submission` requires one of the six section identifiers; `admin_quick_edit` requires `section=NULL`. SQL explicitly rejects NULL section on submissions (a nullable CHECK alone is insufficient). No seventh section is added. Administrative before/after JSON objects contain exactly the 17 input names with integer-or-NULL values, captured by the server under lock; no client-authored audit payload, generated columns or contacts. Draft SQL checks object presence/type; key/range validation and append-only enforcement are required future write-service/policy work, not claimed implemented here. Imported history payloads stay NULL. Score deletion uses RESTRICT to prevent history cascade loss; Auth deletion's SET NULL is the narrow system exception to immutable history content.

For new events use the canonical `America/Indiana/Indianapolis`, verified September 9, 2026 in [IANA zone1970.tab](https://data.iana.org/time-zones/tzdb/zone1970.tab) and the [Zone definition](https://data.iana.org/time-zones/tzdb/northamerica); `America/Indianapolis` is a [compatibility alias](https://data.iana.org/time-zones/tzdb/backward). The draft default applies to new events; migration explicitly writes NULL for the unresolved legacy event timezone. Require a valid supported IANA identifier on new-event creation. This setting does not normalize historical history or establish the legacy event date.

## Security boundary

Every proposed public table has RLS enabled, with no client policies until roles are defined. This intentionally denies client row access; it is not a complete public registration/auth design. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) explains that enabled RLS requires policies for publishable-key access and that service-role access bypasses RLS. Keep migration credentials exclusively in the private migration process. Do not use service-role credentials in the UI or as an implicit substitute for future authorization.

Before application work, separately approve admin/judge permissions, public participant lookup disclosure and account recovery/invitation rules. The new application must not recreate WordPress password hashes or authentication secrets.
