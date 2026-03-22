# Google Calendar (Canvas-style workload)

MindBridge’s **Canvas path** reads assignment due dates and turns them into a **workload signal** for the check-in. If you don’t have school Canvas API access, each signed-in student can connect **their own Google Calendar** so events behave like due dates in the embed.

## What gets wired

1. After OAuth, the server stores a **refresh token per Supabase user** (`google_calendar_refresh_token` on `users` in Supabase, or in-memory in demo mode).
2. Server calls **Google Calendar API** (`events.list`) for that user’s **primary** calendar (or `GOOGLE_CALENDAR_ID`).
3. Events are mapped to the same `CanvasAssignmentInput` shape as assignments.
4. `analyzeWorkload` produces the same **headline + AI context** as Canvas.

## Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs**: add exactly  
     `{YOUR_SITE}/api/google-calendar/oauth/callback`  
     e.g. `http://localhost:3000/api/google-calendar/oauth/callback` for local dev, and your production origin for deploys.
4. Note **Client ID** and **Client Secret**.

## MindBridge `.env.local`

Required for OAuth and API calls:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
# Optional — defaults to NEXT_PUBLIC_SITE_URL + /api/google-calendar/oauth/callback
# GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-calendar/oauth/callback
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional **shared demo** (no sign-in, or for judges): a single refresh token from [OAuth Playground](https://developers.google.com/oauthplayground) with scope `calendar.readonly`. **Not** used for signed-in users who haven’t connected (their own token is required).

```env
GOOGLE_REFRESH_TOKEN=refresh-token-from-playground
# GOOGLE_CALENDAR_ID=primary
```

Optional: `GOOGLE_OAUTH_STATE_SECRET` — secret for signing OAuth `state` (defaults to `CRON_SECRET` or `GOOGLE_CLIENT_SECRET`).

Restart `npm run dev` after changes.

## Supabase

Add the column (once):

```sql
alter table users add column if not exists google_calendar_refresh_token text;
```

## User flow

1. Sign in to MindBridge and open **`/embed`**.
2. Click **Connect Google Calendar** → Google consent → return to the embed.
3. Click **Load my calendar** — workload uses **that user’s** events (same pipeline as Canvas due dates).

## Optional: Playground-only demo token

If you only set `GOOGLE_REFRESH_TOKEN` (and client id/secret), **`GET /api/google-calendar/events`** without a Supabase Bearer token can still load the **shared** demo calendar. Signed-in users without a stored refresh token **must** use Connect (the shared token is not applied to signed-in requests).

## Security

- Refresh tokens stay **server-side** only; the client sees `calendar_connected`, not the raw token.
- Use HTTPS in production; restrict OAuth client in Google Cloud to your domains.
