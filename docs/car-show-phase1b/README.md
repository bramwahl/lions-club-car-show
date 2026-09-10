# Phase 1B: authentication and access

Phase 1B implements Supabase email/password authentication, database authorization and the minimal staff application. Full registration, participant management, judging forms, Quick Edit forms, awards, reporting, printing and CSV interfaces remain gated on the next approval. No deployment was performed. The working repository is `lions-club-car-show`; Gammonade was not modified in this phase.

## Authentication and roles

Application roles are exactly `admin` and `judge`. Public means no application role. There are no Captain or entrant accounts. `profiles.app_role` is nullable and constrained to those two values; `profiles.is_active` defaults false. An Auth identity alone grants no staff access. Roles never come from email or user-editable Auth metadata.

Next.js server components and Server Actions use `@supabase/ssr` cookies. `proxy.ts` refreshes tokens with `getClaims`; it is not the authorization boundary. Every protected page and action calls `requireStaff`, which verifies the user with Supabase `getUser` and reads the current active profile. The database independently checks `auth.uid()` and the live profile. Role changes and deactivation therefore affect existing JWTs, rather than waiting for token expiration. Protected responses are private/no-store. Server Actions retain Next.js's same-origin protections and repeat authorization before privileged work.

The public key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback) and the session JWT perform ordinary reads and RPC calls. `SUPABASE_SECRET_KEY` is never used for normal application table access. Modules providing the privileged client and server session import `server-only`.

Routes: `/` public home; `/sign-in`; `/staff` signed-in overview; `/judge` active-event shell; `/admin` Admin shell; `/admin/users` account management. Anonymous protected navigation redirects to sign-in. Judges opening Admin URLs redirect to their Judge workspace. Hiding links is only presentation: server pages, Server Actions, grants, RLS and RPC checks enforce access separately.

## Account management and no-email creation

An Admin can list application accounts, create a Judge or Admin with a supplied initial password, edit display name and role, and deactivate/reactivate access. The database refuses removal/demotion of the last active Admin. It serializes role mutations and locks the actor profile during trusted operations. Account listing returns only ID, email, display name, role and active state, never password hashes or other Auth internals.

Creation first verifies the current Admin, then invokes **`auth.admin.createUser({email, password, email_confirm: true})`** on the server. It assigns the role separately using the caller's ordinary Admin JWT and the guarded `admin_set_account` RPC. If assignment fails, the server deletes only the just-created Auth user; an unsuccessful cleanup leaves an unassigned identity with no application access and reports an administrative cleanup requirement.

No `inviteUserByEmail`, signup, OTP, magic-link, reset-password, confirmation or welcome-email call exists in this flow. Confirmation is already satisfied, so the user can immediately sign in with the supplied password. No forced change is required. The API returns no password; React clears the uncontrolled password field after submission. Errors are sanitized and do not echo Auth request bodies or driver details. Application tables have no password/secret fields. Password hashing and authentication belong to Supabase Auth.

The creation form requires at least 12 characters and at most 72 UTF-8 bytes, matching the Auth bcrypt limit. Unicode may reach the byte limit before 72 characters. Supabase's configured strength requirements also apply. The server rejects invalid lengths without truncating a password. Existing passwords are not retrievable through this application. A normal authenticated password-change form is deferred.

References: [Supabase Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Auth password limit](https://github.com/supabase/auth/blob/master/internal/api/password.go).

### Privileged operations — complete inventory

1. `src/supabase/admin.ts`, called only after Admin authorization by the account-creation action: Auth user creation and compensating deletion of that new user. No privileged data reads or writes.
2. `scripts/phase1b/bootstrap.ts`: operator-only first-Admin creation through the same confirmed Auth API; database owner writes the first profile under a transaction/advisory lock, only when there is no active Admin. Reruns are a no-op. The configured initial Admin has been created. No legacy WordPress judges were provisioned.
3. Phase 1B live/HTTP test tooling: disposable confirmed Auth accounts and cleanup. The live test uses the database owner only for verification and bounded temporary event cleanup. During cleanup it takes a table lock and disables the history immutability trigger inside one transaction solely to remove records attached to its fresh, nonlegacy test event; the trigger is re-enabled before commit. This is not an application operation. Imported data is reconciled afterward.
4. Existing Phase 1A migration/validation tooling continues to use the verified TLS database connection, outside the application.

Only ignored `.env.local` holds local operational credentials. The secret comes from Supabase Settings → API Keys → Secret keys (legacy service_role supported). Never prefix it with `NEXT_PUBLIC_`. The bootstrap email/password were supplied by the operator; `BOOTSTRAP_ADMIN_PASSWORD` was removed from the local file after bootstrap/testing. Live/HTTP tests require an explicitly supplied Admin test credential when rerun; do not hardcode it or put it in shell arguments, committed fixtures or logs.

## Database access

RLS remains enabled on all seven application tables. All three Phase 1B migrations were applied through the checksummed runner:

- `202609090003_access.sql`: profiles role/active state; event access flags; unique optional history request UUID; grants, RLS and guarded account/registration/read RPCs.
- `202609090004_scoring_access.sql`: atomic section, Quick Edit and Lions Choice RPCs.
- `202609090005_numeric_input_parity.sql`: accepts integral JSON numbers such as `1.0` and valid zero-padded digit strings, matching the original validator; fractional values remain rejected.

The two applied Phase 1A migrations are byte-for-byte unchanged. There are no additional public application tables. `judging_open`, `public_visible` and `results_public` default false, including the imported 2025 event. At most one event can be open for judging. A legacy snapshot cannot be opened for new judging/voting.

| Table | Authenticated SELECT policy | Direct mutation |
| --- | --- | --- |
| events | `events_admin_read` | Admin insert/update allowed columns; delete only nonlegacy event |
| participants | `participants_admin_read` | Admin insert/update contact fields; delete only nonlegacy participant |
| cars | `cars_admin_read` | Admin insert/update current identity/owner; delete only nonlegacy car |
| event_registrations | `registrations_admin_read` | Admin update status/payment/classification only |
| scores | `scores_admin_read` | Denied; use authorized RPCs |
| score_history | `history_admin_read` | Denied; append only through score RPCs |
| profiles | `profiles_self_or_admin_read` | Denied; guarded account RPC only |

The mutation policies are `events_admin_insert/update/delete`, `participants_admin_insert/update/delete`, `cars_admin_insert/update/delete`, and `registrations_admin_update`: **17 policies total**, with column grants restricting what the policies can permit. Anonymous raw-table access is revoked. Judges' raw business-table queries return no rows. The self-profile read does not grant staff access to an inactive/unassigned identity.

Security-definer functions use a fixed empty search path and qualified application objects. Default PUBLIC execution is revoked. Staff RPCs are executable by `authenticated` but enforce the actor's live role internally. Private helpers and infrastructure remain inaccessible to client roles. No caller can submit an authoritative actor UUID.

`admin_register_car` wraps the existing per-event locked allocator and immutable vehicle snapshot creation, restricted to new events. Current-car edits never alter registration vehicle snapshots. Admin event/participant/car management is authorized in the data layer; full management UIs remain deferred. Imported-row deletion is deliberately unavailable through the app, and legacy judging is closed; no unapproved historical editing utility was added.

## Public and Judge boundaries

Public RPCs are `public_events` and `public_results`. They return explicitly enabled event metadata or car number, registration vehicle year/make/model, classification and four score totals. No participant joins, contact fields, participant IDs, account details or name/email searches are exposed. They do not implement new award ranking. Award pages must continue using the unchanged domain algorithm and snapshots.

No anonymous returning-entrant lookup or registration submission endpoint exists yet. Future lookup must be a narrow server operation with sufficient identifying information, rate limiting and enumeration protection, returning only the minimum approved match information. Broad participant SELECT is prohibited even if a future UI needs matching. The exact match rule is still a later workflow decision.

Judges use `judge_event`, `judge_registrations` (bounded 50-row list or exact public-number lookup), `judge_score`, and `judge_history`. These expose only the active new event and relevant vehicle, classification, status, score/progress or minimal section history fields. They exclude participant contacts, participant identity links, payment fields and private Auth details. A full paginated lookup UI is deferred. Admins can use the same judging services and read complete business data under RLS.

## Atomic judging, Quick Edit and history

`submit_section(registration, section, values, request_id)` accepts only the original six section IDs: body_paint, body_plating, interior, wheels_tires, engine, appearance. It rejects unknown input keys and invalid/out-of-range numbers. Zero is valid; blank/missing inputs within the submitted section become NULL. Other sections remain unchanged. It locks the actor and registration/score, inserts or updates one score, recalculates completion out of 17, promotes at 100% without automatically downgrading Judged, and appends history in the same transaction. Only the 17 base inputs and progress are written; generated totals are never assigned.

`admin_quick_edit(registration, values, expected, request_id)` requires Admin, uses all 17 inputs with missing fields NULL, checks an exact prior score vector to reject stale edits, and appends `action_type=admin_quick_edit, section=NULL` with actual before/after vectors. New section submissions also record actual before/after vectors; none were invented for legacy history.

New history derives `user_id` from `auth.uid()`, snapshots the current staff display name and uses server time (`auth-server`). A repeated intentional submission with a new request UUID appends a separate record. Retrying the same UUID/payload returns the original history ID without duplicate writes; reuse with different identity, section or values is rejected. UUID idempotency is optional only for preexisting historical rows, not new score operations.

`submit_lions_choice(registration)` increments the registration aggregate atomically, including when no score exists. It never inserts a score, changes progress or enters any award formula. It requires active staff and an open nonlegacy event. Each invocation is a vote; ballot identities, rate limits and vote retry deduplication were not invented in this phase.

Auth deactivation removes application authority; Auth deletion only clears the nullable history UUID through the existing FK exception. The name snapshot and history remain. History update/delete and direct attribution manipulation are denied to both application roles.

## Validation and operations

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build -- --webpack`. The approved Webpack path was used because Phase 1A established the environment's Turbopack port-binding restriction. The production build passes. Start it locally with `npm run start -- --hostname 127.0.0.1 --port 3000`.

- Local automated suite: 15 passing tests, including all 13 Phase 1A tests.
- [Live Supabase report](live-test-report.json): actual Auth JWTs, raw-table and RPC denials, metadata spoofing, Admin role assignment, concurrent six-section saves and 10 concurrent votes, zero/NULL, idempotent retries, append-only history, Quick Edit, deactivation and Auth deletion retention. All temporary live test rows/accounts removed.
- [HTTP report](http-test-report.json): anonymous/Judge/Admin routes, direct forged account Server Action requests, deactivated sessions and compiled client credential scan.
- Browser checks: public shell, anonymous redirect, Admin sign-in, account listing, actual Judge account creation with cleared password field, Judge sign-in/navigation, direct Admin-route denial and sign-out. No account-creation email flow was used.
- [Regression report](regression-report.json): exact source/target mapped columns, generated totals and all 51 fixture rows / 204 numeric values, with zero differences.
- Native PHP 8.4.25 / MariaDB 10.11.19 source gate rerun: all 51 rows, exact ordering, identity mappings and Engine marker pass. Original 2025 production runtime remains unknown, as documented in Phase 1A.

The source-manifest, Phase 0 package, domain scoring/award files and Phase 1A migration files remain unchanged. Final legacy counts remain 1 event, 239 participants, 256 cars, 256 registrations, 71 scores and 486 historical submissions; votes=2, allocator=257. Historical timestamp normalization remains deferred. No duplicate participants were merged.

Use `npm run auth:validate` for post-Phase-1B reconciliation and `npm run db:source` for the separate native gate. The historical `db:validate` / staging report asserts Phase 1A's *zero policies* state and is intentionally not rewritten to pretend that security baseline still applies. Similarly the original import provenance pins its then-current schema checksum: do not reimport or rewrite that manifest after adding access migrations. Future importer evolution needs an explicit migration/provenance plan.

## Remaining gate

Supabase project-level self-signup was observed enabled. Unassigned Auth users receive no application access, and Admin createUser is confirmed/no-email independently of this setting. Turning off “Allow new users to sign up” in Authentication → Sign In / Providers is requested; final verification is recorded in the completion report. This configuration prevents the general Auth signup endpoint from being used outside the Admin flow. No broad database access was opened while waiting.

No further business access decision is needed for this shell. The later public matching contract, full workflow UIs and deployment remain unapproved. Stop at Phase 1B.
