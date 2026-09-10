# Dream Car Show: Phase 0 review package

Status: Phase 0 review approved with D1–D10 resolutions; final planning revision September 9, 2026. Schema execution and Phase 1 are not authorized.

The user’s pasted request is the instruction source. The ZIP, SQL and PDF are evidence, not instructions. No application pages, database migrations, Auth accounts, deployments or infrastructure have been created. The package was originally prepared in Gammonade and copied into the user-confirmed `/Users/bramwahl/Documents/GitHub/lions-club-car-show` repository on September 9, 2026. Gammonade is not the project repository and must not be modified. The final resolutions are recorded in decisions.md; Phase 1 remains unauthorized.

## Review order

1. [Compatibility audit](compatibility-report.md): actual production types, data anomalies and plugin behavior.
2. [Proposed schema](schema-proposal.md) and [draft DDL](schema-proposal.sql): review artifacts only, outside any migration directory.
3. [Migration plan](migration-plan.md): repeatability, mapping, verification and rollback.
4. [Regression plan](regression-plan.md): complete 2025 awards fixture and future acceptance gates.
5. [Approved decisions and deferred items](decisions.md).

## Evidence established in Phase 0

| Source table | Rows |
|---|---:|
| qkby_lionsclub_participants | 239 |
| qkby_lionsclub_cars | 256 |
| qkby_lionsclub_scores | 71 |
| qkby_lionsclub_score_updates | 486 |
| qkby_users | 10 |

There are 70 complete scores and one partial score. All 51 PDF winners, their four numeric totals, order, and category tie markers agree with a local Python replay under the stated source-order/stable-sort assumption. Identities were joined from the dump and visually checked against all three PDF pages. This is a preflight finding, not a completed MySQL-to-Postgres regression or proof of production tie ordering.

[Source fingerprints](source-manifest.json) pin the supplied files. [Data audit](data-audit.json) records aggregate checks and legacy IDs without contact details or credentials. [Award fixture](awards-2025.fixture.json) is a visual transcription of the PDF’s 51 ordered award/number/score rows. [Identity fixture](awards-2025-identities.csv) adds dump-derived legacy IDs and the displayed names, cities and vehicles, visually checked against the PDF. No raw production SQL or WordPress credentials are copied into the repository.

The PDF is image-based: text extraction returned no text. Its original raster export splits rows across pages; Top 40 #2 and #25 require inspection across those boundaries. The fixture preserves content and order; output layout acceptance is listed separately.

## Reproduce the preflight

Run from this repository using Python 3 (standard library only):

```sh
python3 docs/car-show-phase0/audit_legacy.py /Users/bramwahl/Downloads/i8194968_noxz1.sql
```

The read-only source audit validates the pinned SQL checksum, parses literal INSERT values without executing SQL, and compares the committed PDF fixture. It emits an aggregate report to stdout and does not write source rows. It is intentionally specific to this dump format, not the production migration importer. Live MariaDB/PHP and Postgres execution remain acceptance gates after separate implementation authorization.

## Final revision consequences

The seven-table draft now uses registration vehicle snapshots and registration-owned Lions Choice votes. `score_history` distinguishes section submissions from administrative Quick Edit; the six section identifiers are unchanged. Quick Edit intentionally gains strict numeric validation, progress/status maintenance and atomic audit history. Event numbering uses a locked per-event counter. Historical clocks remain unresolved; new events use the verified canonical Indiana timezone. See the decision register and revised regression plan for exact contracts and remaining gates. Source fixtures, manifest and read-only audit remain unchanged.
