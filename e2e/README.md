# End-to-end validation

Two suites that exercise a **running** TheraSync instance: `api.test.cjs` drives
the REST API directly, and `ui.test.cjs` drives the React app and the WebMCP
tool layer in a real browser.

```bash
cd e2e
npm install
npx playwright install chromium

BASE_URL=https://your-service-url npm test
```

Both exit non-zero on the first failing suite, so this works as a pre-demo
smoke check.

## What is covered

`api.test.cjs` (33 checks) — health, SPA fallback, JSON 404s, modality and
focus-area filtering, crisis screening across every keyword, and every
documented lock/commit failure mode (`MISSING_FIELDS`, `THERAPIST_NOT_FOUND`,
`INVALID_SLOT`, `SLOT_UNAVAILABLE`, `CONSENT_REQUIRED`, `LOCK_REQUIRED`).

`ui.test.cjs` (69 checks) — tool registration on `window.__WEBMCP_TOOLS__` and
through all three `navigator.modelContext` entry points, the crisis circuit
breaker on both the tool and human paths, the full human booking path including
the stale-intake guard, and the approval guard itself: that a tool call stays
suspended until a human decides, that declining releases the reservation, and
that the summary a human edits is the one that gets committed.

## These suites write to the database

Committing a booking is not reversible through the API, so the suites create
real rows. Every row they create is tagged `E2E-MARKER` in `intake_summary`, and
`api.test.cjs` additionally uses `E2E api commit`. Clear them between runs:

```sql
DELETE FROM bookings
WHERE intake_summary LIKE '%E2E-MARKER%' OR intake_summary = 'E2E api commit';
```

Only four slots exist in the seed data, so a run that is not cleaned up will
exhaust them and later runs will fail on `SLOT_UNAVAILABLE`.
