# Phase 1A database foundation and staging validation

Completed September 9, 2026 in `lions-club-car-show`. The source-controlled schema and pinned 2025 snapshot are applied to the configured Lions Club Supabase project. No application pages, deployments or legacy Auth users were created. Phase 1B remains unauthorized.

[Machine-readable validation evidence](validation-report.json) records the applied migration checksums, native runtime/query plan, exact target counts and test results. [Phase 0 resolutions](../car-show-phase0/decisions.md) remain the design authority.

## Applied migrations

- `supabase/migrations/202609090001_foundation.sql`: the approved seven public tables, nullable score inputs/generated totals, registration snapshots/votes, attribution/history and RLS. No client policies or client grants.
- `supabase/migrations/202609090002_integrity.sql`: immutable history and registration identity/snapshots, Auth deletion exception, timezone validation, non-rewinding event counter, private atomic registration/vote functions and administrative history vector checks.

The seven application tables are events, participants, cars, event_registrations, scores, score_history and profiles. Two private infrastructure tables record migration checksums and committed import provenance; they are not additional application entities. Private functions use SECURITY INVOKER and have no PUBLIC/anon/authenticated execution grant. They are not authenticated application endpoints.

The runner applies pending SQL files transactionally under an advisory lock, recording their SHA-256 checksums in `car_show_private.schema_migrations`. Modified/out-of-order migration history fails closed. Use this runner consistently; do not also apply these files through an unrelated Supabase CLI ledger. Future schema changes require a new migration file; never edit an applied migration or make manual dashboard DDL changes.

## Import and regression outcome

| Target | Rows |
|---|---:|
| events | 1 |
| participants | 239 |
| cars | 256 |
| event_registrations | 256 |
| scores | 71 |
| score_history | 486 |
| profiles | 0 |
| Auth users created by migration | 0 |

All source IDs and mapped fields reconcile exactly, including the 88 internal-ID/public-number discrepancies, all 1,207 score inputs, four generated totals per score, stored/recomputed progress, both historical wall clocks/raw strings and all registration vehicle snapshots. Import retains eight duplicate-email groups and 58 repeated section-submission groups. No numeric historical snapshots were invented.

Status counts: 182 Archived, 4 Registered, 70 Judged. Payment counts: 73 Paid and 183 Unpaid. The archived score for legacy car 48 remains 29.41% complete with NULL total. Dashboard counts are 74 registered, 70 checked-in, 70 judged and 73 paid (94.59%, 100%, 98.65%). Registrations hold exactly two imported Lions Choice votes. The 2025 event keeps its original public numbers and next_car_number=257; new events start at 1.

Native PHP/MariaDB and the Postgres query plus TypeScript award code both match all 51 independent fixture rows, all 204 numeric values, identities, seven classes, category markers and 40 Top 40 ranks. The initial Postgres query is only `ORDER BY total_score DESC NULLS LAST`. Subsequent sorts use comparator-only behavior and inherit order; no ID/public-number/rank tie key was added.

The native harness executes the original pinned plugin's award calculation block and classification function, with actual mysqli text queries and fetch-object behavior corresponding to WordPress wpdb. This verifies numeric-string handling: PHP NULL compares below the database string `"0"`, although PHP NULL equals integer zero. The domain comparator preserves the database-string behavior. See [WordPress's query implementation](https://github.com/WordPress/wordpress-develop/blob/trunk/src/wp-includes/class-wpdb.php). This is a native calculation harness, not a full WordPress UI install.

A second importer run returned `verified-no-op`. Failed validation and changed target/provenance are covered by rollback/refusal tests. The importer inserts only into empty application data on its first run, never upserts over live edits, and compares the complete mapping before accepting a rerun. A changed source or target requires reconciliation. Its import manifest is committed in the same transaction as validated data.

Staging tests changed all current-car descriptions/year inside a rolled-back transaction: 2025 award output remained identical. Two concurrent registrations in a disposable new event received numbers 1 and 2. Twenty concurrent votes produced count 20 without any score creation. The disposable registrations/event were removed, then the complete imported snapshot was revalidated.

## Reproduction and credentials

Keep all values private in ignored `.env.local` or `.car-show-private/native.env`. Do not put private inputs, source rows or credentials into Git/CI logs. Node 24 was used. Install dependencies with `npm ci`.

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Existing project's public URL; the runner verifies the database URI belongs to this project. |
| SUPABASE_DB_URL | Privileged Postgres URI from project **Connect → Direct connection**, or **Session pooler** on port 5432 for IPv4. Fill in the project's database password, URI-encoded if necessary. This is not the public anon/publishable key. |
| SUPABASE_DB_CA_FILE | Absolute path to the downloaded Supabase root CA certificate when required by its chain. TLS certificate and hostname verification remain enabled. |
| LEGACY_SQL_PATH | Absolute path to pinned `i8194968_noxz1.sql`, outside Git. |
| LEGACY_ZIP_PATH | Absolute path to pinned `lions-club-car-show.zip`. |
| LEGACY_PLUGIN_PATH | Extracted `lions-club-car-show/lions-club-car-show.php`; verified byte-for-byte against the pinned ZIP. |
| LEGACY_DB_URL | Local isolated MariaDB URI, e.g. `mysql://root:<password>@127.0.0.1:3306/car_show_reference`. Only loopback and this database name are allowed. |
| LEGACY_DB_SOCKET | Optional private local MariaDB Unix socket; this run used a socket with networking disabled. |
| MARIADB_BIN / PHP_BIN | Optional paths to native MariaDB client / PHP CLI executables. |

Obtain the database password/URI and certificate from the project's dashboard, as described in [Supabase connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres) and [verified SSL guidance](https://supabase.com/docs/guides/database/psql). A service-role HTTP key is not needed: the importer uses the privileged database connection, parameterized queries and transactions. No private variable is prefixed NEXT_PUBLIC_ or imported into app code.

Prepare an isolated MariaDB 10.11 server and PHP with mysqli. This run used checksummed official Homebrew bottles unpacked under `/private/tmp`, with no system services installed. The temporary native database was shut down and removed after validation, including its temporary WordPress users table. Original Downloads inputs are unchanged. Recreate the isolated native database before future source/import reruns. `db:restore-native` refuses a nonempty reference database and verifies the dump hash before restoring. It has no Postgres connection. The raw dump is never sent to Supabase.

```sh
npm run db:restore-native  # only for a fresh local reference
npm run db:source         # pinned-source equality + native PHP/PDF gate
npm run db:inspect
npm run db:migrate        # source-controlled schema only
npm run db:import         # transactional import; any failed gate rolls back
npm run db:validate       # read-only reconciliation and award regression
npm run db:staging-test   # bounded DML tests with rollback/disposable-event cleanup
npm test
npm run lint
npm run typecheck
npm run build -- --webpack
```

The Python diagnostic helper compares the native extraction with the pinned literal dump. It is not used instead of MariaDB extraction. Only allowed columns are extracted from users (ID and user_login); no password hashes, activation keys or fake Auth profiles enter Postgres.

If any award result differs, the command fails with only rank/public-number/field diagnostics and no secondary ordering adjustment. On an initial import, data and import manifest roll back together. Preserve the discrepancy for review. The migration schema itself remains applied.

## Remaining boundaries

Thirteen automated tests pass, plus actual staging snapshot/concurrency tests and native/target fixture reconciliation. Lint and type checking pass. `npm run build` encountered a Turbopack internal port-binding restriction in this environment; the documented Webpack production build succeeds. Starter application pages were unchanged.

The native reference uses MariaDB 10.11.19 and PHP 8.4.25. The export metadata names MariaDB 10.11.18 and PHP 8.4.24, and the actual 2025 WordPress runtime/settings have not been supplied. Preserve that qualification; current fixture agreement does not prove every historical runtime or unspecified future tie order. Historical timestamp normalization remains deliberately unresolved. New events use America/Indiana/Indianapolis.

Phase 1B needs explicit approval and admin/judge/public access decisions. Authenticated section-save/Quick Edit services (atomic writes, trusted actor capture, stale-edit/retry handling), route-specific search/collation behavior and UI/PDF workflow acceptance remain future work. The foundation supports their approved data contracts and validates core score calculation/history constraints; it does not pretend those application workflows have been implemented or tested end to end. No data or award discrepancies currently block the next phase.
