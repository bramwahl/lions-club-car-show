# Public registration — local review

Implemented in /register and /admin/registration-requests. The homepage hero links to Register Your Car; header staff sign-in remains.

## Flow

Yes/Unsure offers exact full name plus email or phone. Email is optional. Exactly one match returns vehicle choices and a short-lived opaque token, without contacts or participant IDs. No-match, multiple matches and forgotten contact details allow a pending request. New car details are always reviewed; matching existing cars registers them immediately if not already registered. Neither repeat submissions nor returning-year registration changes an existing registration. No number, check-in, payment collection or score is created by the public form.

Staff inbox is linked from Participants. Staff chooses an existing participant, loads their cars, maps each requested car to an existing car or creates it, and accepts atomically. Dismissal retains the request without creating directory records. New names are not deduplicated or blocked automatically. Current contact records are not overwritten.

## Activation — not performed

Migration 202609100013_public_registration.sql is unapplied. It adds the request inbox and tightly scoped functions; it does not update the 2025 import. Configure a dedicated random server-only REGISTRATION_PORTAL_SECRET of at least 32 characters in the application environment, apply migration through the existing checksum-aware tooling after approval, restart, then open the chosen nonhistorical event through Registration requests → Public registration settings. Closed is the default. Vercel deployment and environment configuration are separate; nothing has been pushed.

The public route stays closed when the secret/migration/event gate is missing. No Supabase service-role key is used. The private gate stores only the secret digest. Existing publishable credentials call a secret-guarded anonymous RPC. Public tables expose no direct access; Admin inbox/review RPCs require active Admin authorization.

## Limits and tradeoffs

Name plus remembered contact is a matching check, not proof of identity. It grants only pre-registration of that person's cars; never contact changes, scores or payment. There are 20 attempts per hashed client per 10 minutes and 200 globally; exceeding a limit directs users to staff. Tokens expire after 20 minutes. No raw IP is stored. Limits apply to lookup and submissions, and use a database lock to serialize counters. This simple global bound can temporarily block legitimate requests under abuse; a CAPTCHA or stronger edge rate limiting can be added later. No emails are sent.

All new participant/new-car details require staff review, including the No answer; this avoids permanent duplicates. The on-screen confirmation distinguishes received requests from completed pre-registration. The selected event is bound to submission, so an event switch requires reload. Admin close/open is independent from scoring.

Validation: isolated PGlite integration test covers secret gate, anonymous restrictions, exact lookup, projection, repeat submission, wrong event and vehicle ownership, staged unmatched entries, staff reuse without duplicate creation, review replay, Judge denial, and persisted rate limiting. No shared-data tests or schema execution.

## Activation completed — 2026-09-10

User approved testing and shared database activation. Migration 013 applied through checksum-aware tooling. Dedicated secret generated only in ignored .env.local; the database stores its digest. Portal enabled for Playground (22dd06e6-94da-4053-b26d-dd9a536c8bf9). Whole-table counts and fingerprints for events, participants, cars, registrations, scores, history, profiles and Lions Choice confirmations were unchanged. Request-table RLS enabled; anonymous SELECT and authenticated direct INSERT denied. Local /register renders Playground and the form. Live transaction test covered exact match, immediate existing-car pre-registration and pending unmatched request; all test writes rolled back. The earlier activation instructions above are now completed locally. Nothing pushed to Vercel.

## Last-name lookup — 2026-09-10

Migration 014 applied for the user-requested matching refinement. The lookup accepts either full name or the final whitespace-delimited word of the stored name, case-insensitive, plus exact email or phone (phone punctuation ignored). People with multi-part surnames/suffixes can use their full name; ambiguous matches still go to staff. No substring name search or contact-only search. Tests cover surname+phone, surname+email, missing contact, partial surname rejection, and shared-family-contact ambiguity. Existing data fingerprints were unchanged.

## Match confirmation — 2026-09-10

Migration 015 applied: matched lookup now includes name, city and state only. Email, phone and street address remain private. The form shows “Is this you?” above existing cars with “Not me, try again” (clears match and car selections) and “Create New Participant” (clears match and starts a pending new request). Existing data fingerprints unchanged. Projection test asserts only the three approved identity fields.

## Existing registration and new-car revision — 2026-09-10

User clarified that adding a car for a matched participant should register it immediately, not stage it for review. Migration 016 implements this atomically; unmatched identities still require staff review. Lookup returns only a boolean indicating a car already has an event registration (no payment, scores or internal registration identifiers). Such cars are labeled Already registered and not selectable again. Duplicate request UUID retries return the previous result before any new-car creation. Exact year/make/model duplicates for the same participant are rejected with guidance to select the existing car or ask staff. Pending unmatched requests can be identified by the same name+contact check; response is a generic request-already-received indicator. The form heading is Car Details. Existing pending requests are not silently accepted or modified.

## Direct new-participant registration — 2026-09-10

Migration 017 implements the user's revised expectation: new participants and cars create live pre-registrations immediately, not pending requests. Shared and blank emails remain allowed. App submission checks entered name plus email/phone for a unique possible existing record and offers reuse or explicit continue-as-new. No email-only directory exposure. Earlier pending requests remain untouched and can be processed from the inbox. Public and admin vehicle entry now permit 1900; database constraints preserve legacy zero years. Phone inputs format ten-digit numbers as XXX-XXX-XXXX. Visible year validation explains 1900–2155. All 26 integration/regression tests passed, including direct registration with a shared email and year 1900.
