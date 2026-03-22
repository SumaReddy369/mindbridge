# MindBridge README

**MindBridge** is a privacy-first student check-in companion: natural-language check-ins, mood patterns, **explainable threshold nudges**, crisis safety, and an **Impact** dashboard for transparent outcomes.

### Canvas LMS (your school)

1. **Deploy** MindBridge on HTTPS and confirm `/embed` loads.
2. Ask your **Canvas admin** to add an **LTI 1.3** (or external tool) pointing at your **`/embed`** URL and enable a **course navigation** placement.
3. If your Canvas domain is custom, update **`frame-ancestors`** in `next.config.mjs` if needed.
4. Optional workload sync: **`postMessage`** bridge or **`/api/canvas/context`** — see full guide.

**Full checklist:** [public/docs/CANVAS_INTEGRATION.md](public/docs/CANVAS_INTEGRATION.md) (live at `/docs/CANVAS_INTEGRATION.md`).

## Judge demo (≈90 seconds)

1. **Register or log in**, then from home click **“Judge demo (90s)”** (or go to `/patterns?judge=1`).
2. **Patterns** — see the 14-day arc, mood chart, and **gentle nudge** with “Why did this appear?”
3. **Impact** — open **Impact** in the nav for the **Bridge score** and theme metrics.
4. **Check-in** — send a live message (uses **Claude** if `ANTHROPIC_API_KEY` is set; otherwise safe heuristics).
5. **Resources** — vetted links; **Settings** — frequency + **delete all data**.

## Register / log in (required)

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Everyone** must create an account: **full name**, **email**, **password** (plus confirm) on `/register`, then **email + password** on `/login`. Enable **Authentication → Email** in the Supabase dashboard. The signed-in user id matches your `users` row (see `POST /api/auth/ensure-user`). If Supabase env is missing, the app shows a blocking setup screen instead of the product.

## Local run

```bash
cd mindbridge/mindbridge
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Windows + OneDrive:** if dev stays on **“Starting…”** and never shows **“Ready”**, `npm run dev` uses **Turbopack** for that reason. See [docs/DEV_FIX_WINDOWS.md](docs/DEV_FIX_WINDOWS.md) or run `.\scripts\dev-onedrive.ps1`. Use `npm run dev:webpack` only if you need classic webpack.

## Environment

Copy `.env.local.example` → `.env.local`.

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Real Claude responses + weekly summaries |
| `ANTHROPIC_MODEL` | Optional; default `claude-3-5-sonnet-20241022` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` = in-memory demo (great for judges). `false` + Supabase = persistence |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — required for API routes to read/write DB (keep secret) |
| `CRON_SECRET` | Bearer token for `/api/cron/notify` (see Vercel cron) |
| `CANVAS_BASE_URL` | e.g. `https://school.instructure.com` (server Canvas pull) |
| `CANVAS_API_TOKEN` | Server-only token for planner/assignments (LTI worker — never in browser) |
| `CANVAS_SYNC_SECRET` | Shared secret for `x-mindbridge-canvas-secret` on `/api/canvas/assignments` |

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL in `lib/supabase.ts` (comment block) in the SQL editor.
3. Add URL, anon key, and **service role** key to `.env.local`.
4. Set `NEXT_PUBLIC_DEMO_MODE=false`.

**Judge storyline with Supabase:** the pre-loaded arc lives in **memory** when demo mode is on. With Supabase only, new users start empty unless you import seed data for user id `f4700000-0000-4000-8000-000000000001`.

## Deploy (Vercel)

1. Connect the repo; set all env vars (never expose service role to the client).
2. `vercel.json` includes a daily cron for reminder due checks; set `CRON_SECRET` and configure the same secret in Vercel for the cron job authorization header.

## API health

- `GET /api/health` — full status payload  
- `GET /api/status` — browser-safe flags (persistence, Claude, demo mode)

## Architecture highlights (for judges)

- **Thresholds** — rolling window, multiple explainable signals + local crisis keyword net.
- **Sessions** — Supabase Auth session; API uses `x-mindbridge-user-id` from the signed-in user.
- **Repository** — single data layer: mock store vs Supabase via service role.

## Disclaimer

MindBridge is **not** a medical device, diagnosis, or therapy. It surfaces patterns and resources; crises should use **988** and local emergency services.
