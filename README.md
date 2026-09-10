# Lions Club Dream Car Show

The approved Phase 1A database import and Phase 1B authentication/access shell are implemented. Full legacy workflow interfaces and deployment require the next approval.

- [Phase 1B architecture, permissions, account management and validation](docs/car-show-phase1b/README.md)
- [Phase 1A database operations and validation](docs/car-show-phase1a/README.md)
- [Phase 0 review and parity contracts](docs/car-show-phase0/README.md)

Run `npm run dev` for local development. Production verification uses `npm run build -- --webpack`; then `npm run start`. Open `/sign-in` for Admin/Judge access. Public registration and judging forms are not part of this phase.

Keep all credentials in ignored `.env.local`. Normal application access uses the Supabase public key and session JWT. The server-only secret is restricted to Auth account creation and compensating cleanup; see Phase 1B documentation. No password, raw legacy dump or private participant data belongs in Git.

Checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run auth:validate`. Live RLS and HTTP tests are staging operations documented in Phase 1B.
