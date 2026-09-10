# Deterministic migration plan

This is a plan, not an implemented importer. No live databases were contacted. Phase 0 decisions are approved, but implementation and schema execution remain unauthorized. The following steps are future work after separate implementation authorization, in isolated private staging.

## 1. Freeze and validate the input

Pin the three SHA-256 fingerprints in source-manifest.json and the approved plan revision. Preserve originals in restricted storage outside Git. Record source database/server metadata, export time, encoding, importer version, run ID and approved timezone/event-assignment rules in a private migration manifest. A changed source checksum requires a new reviewed run; never silently reuse old approval.

Use an isolated MariaDB 10.11 reference database to restore the original dump and reproduce generated values and active plugin queries. Never run an unknown SQL export against production. It contains DROP TABLE and session statements. Restrict source extraction to the five qkby tables, treating x8qw constraint names only as labels. Extract logical values through a database driver, preserving NULL/empty strings and integer precision. The Phase 0 literal parser is evidence tooling, not a substitute for that restore.

Read only `ID` and `user_login` from qkby_users for migration attribution. Do not extract, stage, log, commit or transfer user_pass, activation keys, login emails or other account secrets into Supabase. If a private native reference restore contains the original users table, keep it isolated and dispose of it after verification. It must never become application authentication.

Preflight: table/row counts, PK uniqueness and exact ID sets, all FK joins, duplicate public numbers/scores, year/range validity, score NULL/zero distribution, generated totals, progress/status consistency, classifications, text encoding, repeated histories, unresolved timestamps. Unexpected values produce a row-level exception report keyed by legacy ID; stop cutover rather than silently skipping or fixing them.

## 2. Fixed identity mapping

Retain the reviewed UUIDv5 namespace `53c92e16-e9e8-5b74-899b-b56a3f12c660` as a fixed project constant. UTF-8 input strings, canonical decimal legacy IDs (no leading zeroes), exact lower-case prefixes:

| Target | UUIDv5 name | Legacy mapping |
|---|---|---|
| event | `qkby:event:2025` | One event, slug `dream-car-show-2025`; source key `qkby:2025`. |
| participant | `qkby:participant:<id>` | All 239 source participants, every contact value retained exactly. |
| car | `qkby:car:<id>` | All 256 cars; participant_id resolves through participant map. |
| registration | `qkby:registration:2025:<car.id>` | Approved one per legacy car, including archived (D1). |
| score | `qkby:score:<id>` | All 71 scores; legacy car_id→car map→2025 registration, never public number. |
| history | `qkby:score-update:<id>` | All 486 updates into score_history; action_type=section_submission, score_id→score map; preserve repeats. |

Namespace + source entity type + legacy primary key determine imported identities. Do not include file hash, import timestamp, participant name, email or public car number in entity IDs. UUID defaults in the draft are for new records; the importer always supplies mapped UUIDs. Preserve every original legacy ID in dedicated fields as well as the mapping manifest. Serialize big integers as decimal strings between TypeScript/JSON and Postgres.

No participant/car deduplication, case normalization or ownership merging. Preserve gaps in legacy IDs. No WordPress user mapping to auth.users or profiles; the expected imported profile count is zero. The ten user rows are an attribution lookup only; migration covers every history row’s legacy ID/login.

## 3. Field mapping and load order

1. Create the single 2025 event. Explicitly write legacy event_date and timezone_name as NULL (override the new-event timezone default); a 2025-09-07 judging timestamp is evidence, not sufficient authorization to fill every date/timezone field.
2. Import participants without changing NULL, empty strings, punctuation, accents, capitalization, phone or postal formatting.
3. Import cars with permanent year/make/model/notes and original participant FK. Never put yearly status/payment/public number on permanent cars.
4. Import 2025 registrations with source car_number, classification, status and paid→payment_status. Source participant_id supplies registrant. Approved `legacy_event_assignment='2025-import-snapshot'` explicitly labels the snapshot assumption. Copy source year/make/model exactly into vehicle_year/vehicle_make/vehicle_model, including case, whitespace and Unicode. Initialize lions_choice_votes to 0 on all registrations, then assign each existing score.lions_choice value via legacy score.car_id→registration; do not join on public number or accumulate on reruns. The pinned source has non-NULL, nonnegative vote values; an unexpected NULL/negative/out-of-range value blocks import for review rather than silently changing data. Seed events.next_car_number to MAX(imported car_number)+1. The 182 archived rows may be historical prospects; do not claim they all attended 2025 (D1).
5. Import score base inputs and stored progress only; Lions Choice now belongs to registrations; do not insert generated totals. Recompute Postgres totals and compare them with MariaDB’s values using NULL-safe equality.
6. Import every row into score_history: action_type=section_submission, section from section_updated, score link, user ID/login (also judge_name_snapshot) and both timestamp variants, plus raw redundant fields. Both numeric before/after payloads remain NULL. No historical admin_quick_edit records are fabricated. For this dump the raw car_id=0 and section='' are not actual relationship data. Keep historical Auth user_id and submitted_at NULL while timezone unresolved; never use the current importer’s identity/time for past submissions.
7. Build required indexes/constraints in staging and enable/verify RLS on every table. Policies remain denied until approved; no app browsing with privileged credentials.

## 4. Transaction and rerun contract

For this small dataset use a single target transaction after source extraction and validation. Validate mappings, counts, row checksums, generated totals, history and awards before commit; any discrepancy aborts the transaction. Store a private committed run manifest atomically with the load, with its schema and RLS reviewed alongside implementation.

On first import, insert every mapped row. On a rerun with the same pinned inputs, compare all mapped values and return a no-op if identical. Missing rows may be restored only by an explicitly documented recovery run. Any changed existing target row, unexpected non-imported collision, new checksum, or changed mapping rule stops for reconciliation. Never use blind upserts that overwrite live edits, and never append duplicate historical submissions on reruns.

Test two fresh target databases: identical logical records/UUIDs and checksum results. Test immediate rerun: unchanged counts/IDs/values and no new history. Compare canonical row digests in legacy-ID order; encode types explicitly so NULL differs from empty and numbers differ from numeric text where relevant. Infrastructure/run timestamps are excluded from business-data equality and reported separately.

## 5. Reconciliation gates

With the approved all-car snapshot, expect 1 event, 239 participants, 256 cars, 256 registrations, 71 scores, 486 score_history rows (all section_submission; zero admin_quick_edit) and 0 imported Auth profiles. Every registration carries snapshot provenance; no source score/history can be lost.

Require exact legacy-ID sets, all foreign keys, 88 ID/number discrepancies preserved, multi-car owners intact, duplicate emails intact, 17-field and four-total equality, stored/recomputed progress equality, 70 Judged / 182 Archived / 4 Registered statuses, 73 Paid / 183 Unpaid, two Lions Choice votes summed on registrations (verify each mapped value as well as the sum, with 0 for every no-score registration), all six history section counts and every repeated row. Expected dashboard: registered 74, checked-in 70, judged 70, paid 73. Percentages: 94.59%, 100.00%, 98.65% at two displayed decimals.

Verify all 256 vehicle snapshots exactly against source cars and verify allocator seed MAX(car_number)+1. Future new events default to the verified America/Indiana/Indianapolis identifier and counter 1; neither default may fill unresolved historical timestamp provenance. Rerun comparisons include snapshots, vote counts, action/section values and allocator state; never refresh old snapshots from current cars or overwrite post-import votes.

Award gate: use registration vehicle snapshots and compare all 51 entries to the independent PDF fixture, including metadata, category asterisk and all 40 ranks. Follow regression-plan.md for native reference and tie-order limitations. A successful count reconciliation alone is not migration acceptance.

## 6. Cutover and rollback (future approval)

After approved implementation and staging acceptance, obtain a fresh final export during an agreed write freeze, re-run checksum/preflight and the complete regression suite against that export, take a target backup, and import once. Keep the WordPress system available read-only until new-system validation is accepted. Only then switch public/QR routing as separately authorized.

Before target commit: transaction rollback. Before cutover: discard/rebuild isolated staging or restore its backup. After cutover with new writes: stop writes and reconcile/restore from backup under a documented recovery plan; do not delete all mapped rows or replay an old dump over new registrations. Retain source fingerprints, mapping manifest, exception reports and validation output in restricted storage; keep production contacts/credentials out of Git, ordinary logs and CI artifacts.
