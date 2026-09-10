# Legacy workflow rebuild

The authorized workflow rebuild is available locally at `/admin`. Create/select a new event in **Events**, find or add a participant, add/select their vehicles, register them for the selected event, and check them in. Open the event for judging from Events. Each registration has its own judging link, history and printable car sheet. Scores provides administrative Quick Edit; Awards refreshes current-event results every five seconds.

The imported 2025 event is historical and read-only in these workflows. Its 256 registrations include Archived records that do not establish attendance. Persistent participant/car edits are explicit directory operations; registration vehicle snapshots never refresh from current cars. Participant-name snapshots were outside D8 and have not been added.

## Feature parity checklist

| Legacy capability | Status | Rebuilt location / behavior |
|---|---|---|
| Dashboard counts and percentages | Implemented | Dashboard preserves original Registered, Checked-in, Judged and Paid predicates, including paid Archived records and NULL handling. |
| Event selection and creation | Implemented; approved extension | Events; independent per-event numbers, payment/status, scores and snapshots. One event open for Judge access at a time. |
| Participant directory, name search and ID/name sorting | Implemented | Participants; all directory records, contacts visible only to Admin. Search treats input literally and folds accents/case. |
| Participant detail, add/edit, owned cars | Implemented | Participant detail; reusable current directory, multiple cars. Admin add rejects an existing email as in the active handler; no global uniqueness constraint or migration deduplication. |
| Existing/new vehicle registration | Implemented | Select multiple participant-owned cars; atomic per-event sequential allocation starting at 1, repeat registration reuses the existing row. |
| Status, payment, multi-car check-in | Implemented | Registration detail and bulk check-in list. Check-in preserves Judged. New events inherit neither payment nor Judged nor scores. |
| Registration search/status/payment filters | Implemented | Registrations / Cars; vehicle snapshot, participant, public number, scoring progress and detail links. |
| Car sheet and QR | Implemented; presentation changed | Registration → Printable car sheet / PDF. Local QR targets the registration UUID, retains judging destination through sign-in, and uses public number only for display. Browser Print / Save as PDF. |
| Six judging sections | Implemented | Body paint, body plating, interior, wheels/tires, engine, appearance. Required section inputs retain zero, limits and integer validation. |
| Repeated submissions and judge attribution | Implemented | Append-only separate submissions, complete history and latest attribution per section. Historical raw/wall-clock times remain unresolved and displayed as such. |
| Progress and Judged promotion | Implemented | Existing transactional scoring functions; all 17 fields, NULL-propagating generated totals, promote at 100%, never automatically downgrade. |
| All scores sorting and duplicate highlighting | Implemented | Scores; original seven sort choices, score rows only, duplicate category/total colors and yellow manual row marking. Marking does not affect awards. |
| Class filter on scores | Intentionally changed | The active legacy dropdown had no applied filter. It now filters the displayed table; the award engine is unaffected. |
| Administrative Quick Edit | Implemented; approved D5 improvement | Strict integers, explicit zero, blank NULL, progress/status recalculation, optimistic stale-edit rejection and separate administrative audit action. No writes to generated totals. |
| Best in Show, seven classes, Paint/Interior/Engine, Top 40 | Implemented | Awards uses the unchanged validated engine, snapshot year, sequential exclusions, comparator-only ties and category markers. Historical 2025 displays all 51 fixture awards. |
| Winner summary and printable results | Implemented | Current-event five-second polling, provisional status, browser Print / Save as PDF. Eligibility includes the original partial-score behavior; no hidden all-Judged filter. |
| Lions Choice | Implemented; approved D7 improvement | Registration-owned votes, usable without scores, separate display from scored awards, outside totals/progress/award calculations. Imported total remains 2. |
| CSV entrant import | Implemented; validation changed | Registrations → Import CSV; original 11 columns, one participant/car per row, no deduplication, Archived/Unpaid defaults, no scores. Preview, strict validation, atomic batch and request retry protection; up to 500 rows / 250 KB. |
| Admin account creation, roles, deactivation | Implemented in Phase 1B | Users; no-email confirmed account creation, trusted profiles and immediate authorization checks; nullable Auth attribution preserves history. |
| Legacy public returning-entrant/self-registration shortcode | Deferred | Anonymous directory lookup and phone/city identity matching require a separately approved privacy-safe flow. This rebuild provides the requested Admin registration workflow. |
| Event-day hosted QR origin | Deferred | No deployment authorized. Localhost QR works only on this machine; configure a reachable application origin before printing sheets for phones at the event. |
| Original remote Lions logo / raster PDF rendering | Intentionally changed | Clean text branding, local QR and browser print styling. No external QR service or remote image dependency. |
| Alternate unloaded plugin files | Not found in active runtime / obsolete | Only active main plugin and its included participants module define parity. Unloaded alternate implementations do not override them. |
| WordPress admin menus, nonces, user passwords | Obsolete platform mechanisms | Replaced by Next server authorization, Supabase sessions/RLS and the approved no-password-migration model. |

## Evidence and validation

Authoritative evidence: the Phase 0 source manifest and active `lions-club-car-show.php` plus `lionsclub-participants-page.php`. Relevant active source includes judging inputs (main 797–855), all-scores sorting/highlights (2190–2376), CSV (2501–2592), statistics (2593 onward), and participant/car/print handlers in the included participants module.

- `npm test`: 19 tests, including transactional PostgreSQL tests for allocation, ownership, event reuse, CSV rollback/retry, scoring/RLS/history and the award algorithm.
- `npm run workflows:test-http`: temporary Admin/Judge sessions exercise actual production Server Actions and page routes, six judging saves, Quick Edit, Lions Choice without scores, authorization rejection, QR rendering, awards endpoint and snapshot stability. Temporary accounts and records are removed; imported records are reconciled afterward. See `http-test-report.json`.
- `npm run workflows:validate`: exact imported mapped columns/counts, generated totals, seven RLS-enabled tables, and the actual application awards RPC against 51 independent fixture rows / 204 numeric values. See `regression-report.json`.
- Original Phase 0 evidence, foundation migrations and award/scoring domain files: all 17 baseline SHA-256 hashes unchanged.
- Lint, TypeScript and production Webpack build pass. Signed-in browser dashboard confirms 74 registered, 70 checked in, 70 Judged, 73 Paid.
- Fresh native PHP 8.4.25 / MariaDB 10.11.19 replay passes all 51 fixture rows. See `native-report.json`; this is separate from PostgreSQL and HTTP checks.

## Files and database changes

Added `src/workflows/`, Admin workflow pages/actions, Judge registration pages/actions, shared workflow/form/print components, workflow tests and scripts, and this report directory. Updated navigation, sign-in return handling, styles, package dependencies/scripts and root AGENTS.md. Added migrations 006–009 for guarded workflow RPCs, atomic CSV retry metadata and complete minimal Judge history. Existing applied migrations were not rewritten. All normal app operations continue to use session JWTs and RLS/guarded functions; privileged keys stay server-only for Auth account creation.

No deployment and no Gammonade changes were made during this workflow rebuild. The earlier Phase 0 repository-placement audit remains in its existing review package.

## Local revision: September 10 workflow refinements (not released)

Participant actions use Check-in / Pre-Register. Scores link vehicles to registration details, center score columns and retain only Quick Edit. Dashboard charts own their filtered registration shortcuts; standalone count cards are removed. PDF Summary retains transparent SVG branding and appends only a manually confirmed Lions Choice winner.

Migration 012 is prepared and tested in isolated PGlite only; it is NOT applied to the shared Supabase database. It adds an Admin-only, event-scoped Lions Choice confirmation separate from votes/scores, with compare-and-set protection and historical-event guards. Without this migration, reads degrade to an explicit unavailable notice and confirmation buttons are disabled. No local storage pretends to persist a production winner.

Award cards link to the full score editor (existing event-open/historical guards remain). Repeat-win hints compare persistent car identity and the exact award label (including Top 40 rank) to the previous calendar year's validated `qkby:2025` results. Playground and other unclassified test events are deliberately not a history source. Supporting later real events requires explicit test/real event classification before broadening this lookup. Category tie hints reflect existing engine asterisks after higher-award exclusions; they do not introduce tie-breakers or change any winners.

Lions Choice candidate list is limited to registrations with at least one vote, per the follow-up review.

### Shared database activation (user approved September 10)

The user subsequently authorized applying migration 012 so confirmation can be tested from the local UI. Only migration 012 was pending and applied. Before/after fingerprints for events, participants, cars, registrations, scores, history and profiles were identical. The new table has RLS enabled, anonymous reads and direct authenticated inserts are denied, and the guarded staff RPC is executable. No winner was selected (zero confirmation rows). PostgREST schema reload was requested. Website changes remain local and unpushed; this supersedes the earlier unapplied status above. Do not edit migration 012 now that its checksum is recorded.

### Award tie review (local)
The Awards page now exposes Best in Show, class and category ties in award order, listing score-review links for all tied candidates. Best in Show ties mark downstream sections provisional. Detection follows the same eligible input and removes earlier winners; it does not add any ranking key or change the award engine. Corrections use existing audited Admin Quick Edit. If equally valid scores remain, the warning remains; no manual winner override is introduced. Imported results stay read-only. Regression tests cover top-award ties, class ties, higher-award exclusions and unchanged winner arrays.
