# Phase 0 decision resolutions

The user approved Phase 0 review with these resolutions on September 9, 2026. This final revision pass updates planning artifacts only. It does **not** authorize schema execution, migrations, Supabase provisioning, application pages, deployments or Phase 1. None of the proposed database objects have been applied.

| ID | Status | Resolution and boundary |
|---|---|---|
| D1 | Approved | Import all 256 cars and 256 labeled 2025 registrations with `legacy_event_assignment='2025-import-snapshot'`. Retain all 182 Archived statuses; the snapshot does not establish attendance. |
| D2 | Partially deferred | Preserve both historical wall times and raw strings exactly; historical `submitted_at` remains NULL with `timestamp_basis='legacy-unresolved'`. No inferred seven-hour correction. New events use `America/Indiana/Indianapolis`, verified against IANA below. Historical clock provenance and the exact legacy event date remain unresolved. |
| D3 | Approved | Preserve the existing award sequence, comparator-only ties, in-place sorts, category markers and exclusions by car identity. No secondary tie-breaker. Native MariaDB/PHP replay remains a regression gate; divergent tied output requires investigation and explicit resolution, never fixture ranks as algorithm input. |
| D4 | Approved | One score per registration; one registration per car/event; unique public car number per event. Use concurrency-safe sequential allocation starting at 1 for each new event. Draft design uses a transactionally locked per-event counter; initialize the imported event to MAX(imported car_number)+1, preserving all legacy numbers. |
| D5 | Approved intentional improvement | Administrative Quick Edit validates integer score inputs strictly against their maxima, preserves explicit zero, maps blank/missing inputs to incomplete NULL, recomputes progress after successful edits and promotes to Judged at 100% without automatic downgrade. Never write generated totals. Score/progress/status/history changes are atomic. Append `action_type='admin_quick_edit'`, `section=NULL`; do not invent a seventh judging section. See schema-proposal.md for the full-form input contract and audit payload. |
| D6 | Approved | Auth deletion/deactivation must retain history and judge-name/legacy attribution. Deletion sets nullable Auth UUID to NULL; deactivation retains the UUID while the account exists. No fake historical Auth users or WordPress password migration. |
| D7 | Approved model change | Store `lions_choice_votes integer NOT NULL DEFAULT 0` on event_registrations, with a nonnegative check. Move existing aggregate values through the score→legacy car→registration mapping; imported sum remains 2. Voting works without scores and never creates a score. Votes do not affect progress, score totals or awards. |
| D8 | Approved vehicle snapshots | Registrations store `vehicle_year`, `vehicle_make`, `vehicle_model` exactly from the legacy car row at import and from the current car on new registration. Awards derive class from snapshot year; historical event vehicle display uses snapshots. Later current-car edits must not alter 2025 results. Participant-name/city snapshots and a finalization/correction workflow are not added by this decision. |
| D9 | Resolved | Work only in `~/Documents/GitHub/lions-club-car-show`. Do not modify Gammonade. |
| D10 | Approved | No globally unique participant email and no migration deduplication. Preserve every participant and exact source values. Route-specific email checks and collation/search parity remain subject to source regression; no additional normalization policy is inferred. |

## History action and section

The proposed `score_history` replaces the earlier proposal named `score_section_updates` (no live table exists to rename). `section_submission` requires one of `body_paint`, `body_plating`, `interior`, `wheels_tires`, `engine`, `appearance`; `admin_quick_edit` requires NULL section. All 486 legacy updates map to section submissions. Repeated submissions remain separate append-only records. New administrative edits carry server-captured before/after score inputs; historical numeric snapshots remain NULL because the source has none. Restrictive score deletion prevents cascading loss of history. Auth UUID nulling on account deletion is the narrow system-managed exception to history immutability.

## Verified new-event timezone

Verified September 9, 2026: IANA defines `America/Indiana/Indianapolis` as a Zone in [northamerica](https://data.iana.org/time-zones/tzdb/northamerica) and lists it for Eastern Indiana (most areas) in [zone1970.tab](https://data.iana.org/time-zones/tzdb/zone1970.tab). [backward](https://data.iana.org/time-zones/tzdb/backward) maps the older `America/Indianapolis` name to it. Use the canonical identifier for new Zionsville/Indianapolis events and verify target runtime support before implementation. Do not substitute a fixed UTC offset or apply this setting retroactively to legacy wall times.

## Remaining boundaries

Roles/RLS policies, staff invitation/recovery and participant lookup disclosure remain deferred. Keep RLS enabled with no permissive client policies. Native replay, target database validation and workflow/PDF acceptance remain future gates. The approved decisions do not grant permission to implement or execute those systems during this revision pass.
