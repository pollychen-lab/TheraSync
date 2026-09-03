# TheraSync

TheraSync is a WebMCP-enabled therapist matching and intake booking demo. It
pairs a client-centric WebMCP tool layer in the browser with a real backend
service (persistence, slot locking, consent auditing), so an AI agent can
safely drive a scheduling workflow end to end while a human stays in the
loop for anything sensitive.

## Stack

- **Frontend:** React + TypeScript, built with Create React App and served
  by Nginx in production.
- **Backend:** Node.js + Express REST API.
- **Database:** PostgreSQL 16, seeded on first boot.
- **Orchestration:** Docker Compose.

## Project layout

```
TheraSync/
├── docker-compose.yml
├── .env.example
├── README.md
├── init-db/
│   └── 01-init.sql          # schema + seed data
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── db.js
│   └── server.js            # Express API service
└── frontend/
    ├── Dockerfile
    ├── nginx.conf            # SPA + API reverse proxy
    ├── package.json
    ├── tsconfig.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.tsx
        ├── index.css
        ├── types.ts
        └── TheraSyncApp.tsx
```

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (Frontend)                    │
│   [Agent / ChatGPT] ◄──WebMCP RPC──► [TheraSyncApp.tsx]   │
└─────────────────────────────┬───────────────────────────-─┘
                              │ REST / JSON (via Nginx /api/ proxy)
                              ▼
┌──────────────────────────────────────────────────────────┐
│                  Backend (Node.js / Express)               │
│  1. POST /api/triage       - crisis screening & matching  │
│  2. POST /api/book/lock    - temporary slot lock           │
│  3. POST /api/book/commit  - persist booking + consent log │
│  4. GET  /api/health       - readiness probe                │
└─────────────────────────────┬───────────────────────────-─┘
                              │ SQL
                              ▼
                        PostgreSQL 16
```

WebMCP's design is **client-centric**: the tools themselves are defined and
run in the browser, so a host environment (an agent with a WebMCP-enabled
browsing surface) can discover and call the page's exposed tools the way it
would discover DOM elements. But a production-grade full-stack build needs
a real backend behind that tool layer to handle persistence, scheduling
locks, and (eventually) integrations like calendars or SMS notifications —
that's what the Express API and PostgreSQL database provide here.

The frontend registers two WebMCP tools on `window.__WEBMCP_TOOLS__`:

- `triage_and_match_therapists` — runs crisis safety screening on the
  client's narrative, then calls the backend to retrieve matching
  therapists and updates the UI.
- `commit_intake_booking` — locks a recurring slot on the backend, then
  suspends and waits for an explicit human approval in a modal before
  committing the booking. Declining resolves the tool call as rejected.

## Quick start

### 1. Start the full stack

Make sure Docker and Docker Compose are installed locally, then from the
project root:

```bash
docker compose up -d --build
```

### 2. Service endpoints

- Frontend app: `http://localhost:3000`
- Backend REST API: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432` (user: `therasync_user`, password:
  `therasync_secret_2026` — override these via `.env`, see
  `.env.example`)

### 3. Try the WebMCP tools

1. Open `http://localhost:3000` in a browser or agent surface that can
   discover WebMCP tools (e.g. a Chrome build with the WebMCP origin trial
   flag enabled, or an in-app agent browser).
2. Send a triage request through the agent, for example:

   > "I've been under a lot of work stress and haven't been sleeping well.
   > I'd like to find a therapist who specializes in CBT."

3. Watch the therapist cards filter live, the recurring schedule panel
   highlight matching slots, and the human-in-the-loop approval modal
   appear when a booking is committed.

### 4. Stop and clean up

```bash
docker compose down -v
```

## Deploying to Cloud Run

The deployed form of TheraSync is a **single** Cloud Run service: the React
bundle and the Express API run in one container (`Dockerfile` at the repo
root), so the SPA and the `/api/*` calls it makes on relative paths share an
origin. That removes the CORS negotiation and the second hop that a split
frontend/backend deployment would need, and it means no frontend code has to
change between Compose and Cloud Run. Nginx is used only by the local Compose
stack.

Postgres is a managed instance rather than a container, with `DATABASE_URL`
held in Secret Manager and injected as a secret environment variable.

### One-time database setup

Create a Postgres database with any managed provider, then apply the schema:

```bash
psql "$DATABASE_URL" -f init-db/01-init.sql
```

Use the provider's **connection pooler** host if it offers one. Direct
connections are often IPv6-only, which Cloud Run cannot reach.

Do not put an `sslmode` parameter in `DATABASE_URL`. `pg` applies the parsed
connection string on top of the explicit `ssl` config in `backend/db.js`, so an
`sslmode` in the URL silently discards the pinned CA and TLS verification then
fails. TLS is configured in code instead, via `DATABASE_CA_CERT`.

### Deploy

```bash
DATABASE_URL='postgresql://user:pass@host:6543/postgres' \
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX \
  deploy/deploy.sh
```

`deploy/deploy.sh` is idempotent, so later deploys are just:

```bash
deploy/deploy.sh
```

It creates the project, links billing, enables the APIs, stores the secret,
creates a runtime service account whose only permission is reading that secret,
and deploys.

### Validating a deployment

`e2e/` holds two suites that exercise a running instance: the REST API
directly, and the React app plus the WebMCP tool layer in a real browser.

```bash
cd e2e && npm install && npx playwright install chromium
BASE_URL=https://your-service-url npm test
```

They create real bookings, all tagged `E2E-MARKER`; see `e2e/README.md` for the
cleanup query.

### Why the service is capped at one instance

`--max-instances=1` is load-bearing, not a cost control. `/api/book/lock` holds
slot reservations in process memory (`activeLocks` in `server.js`), so a second
instance would not see a lock taken by the first, and the follow-up
`/api/book/commit` would be rejected with `LOCK_REQUIRED`.

The cap makes the flow correct under concurrent users but does not make the
locks durable: the service still scales to zero, so a reservation is lost if the
instance is reclaimed between locking and committing. Moving the locks into a
Postgres table with an expiry column is the fix that would allow more than one
instance.

### Data API hardening

`init-db/01-init.sql` enables row level security on both tables with no
policies. Managed providers such as Supabase expose the `public` schema through
an auto-generated REST API authenticated by a publicly-distributed anon key,
and `bookings.intake_summary` holds sensitive intake text. RLS denies that path
entirely, while the backend is unaffected because it connects as a role holding
`BYPASSRLS`. On a local Postgres the statements are inert.

## Demo script (crisis screening, matching, and human approval)

1. **Crisis circuit breaker.** Prompt: "I don't feel like there's any
   point to living anymore, I just want to talk to someone." The
   `triage_and_match_therapists` tool detects the crisis language and the
   UI immediately shows a red safety modal with crisis hotlines instead of
   proceeding with routine scheduling.
2. **Multi-dimensional matching.** Prompt: "I just started a new job and
   I'm dealing with a lot of anxiety. I'd like someone who does CBT, and
   I'm free Thursday evenings." The tool call filters the therapist list
   down to Dr. Sarah Chen and highlights the "Thursday 18:00" slot.
3. **Human-in-the-loop approval.** Prompt: "Go ahead and book Dr. Sarah
   Chen's Thursday evening slot." The `commit_intake_booking` tool locks
   the slot on the backend and opens an approval card with a de-identified
   intake summary; only after a human clicks "Approve & sign intake" does
   the booking get written to the database and the success banner appear.

## Notes on safety design

- Crisis screening happens on both the frontend (`TheraSyncApp.tsx`) and
  the backend (`server.js`) — the backend check is the authoritative one,
  since the frontend check can be bypassed by any direct API caller.
- Slot booking is a two-phase operation: `/api/book/lock` reserves a slot
  for 10 minutes while a human reviews the request, and `/api/book/commit`
  only persists the booking after `userConsent: true` is explicitly set.
