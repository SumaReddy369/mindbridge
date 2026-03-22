/**
 * Supabase configuration check. Server writes use the service role in
 * `lib/repository.ts` when persistence is enabled.
 */

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return !!(
    url &&
    key &&
    url !== "https://your-project.supabase.co" &&
    !url.includes("your-project")
  );
}

/*
 * SQL for Supabase (run in SQL editor). Enable RLS only with proper policies;
 * service role bypasses RLS for server-side API routes.
 *
 * create table users (
 *   id uuid primary key default gen_random_uuid(),
 *   created_at timestamptz default now(),
 *   frequency_days integer default 2 check (frequency_days between 1 and 30),
 *   last_checkin_at timestamptz,
 *   nudge_shown_at timestamptz,
 *   full_name text
 * );
 * -- If you already created users: alter table users add column if not exists full_name text;
 * -- Per-user Google Calendar OAuth (server-only; never expose to client):
 * -- alter table users add column if not exists google_calendar_refresh_token text;
 *
 * create table checkins (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references users(id) on delete cascade,
 *   created_at timestamptz default now(),
 *   user_text text not null,
 *   ai_response text,
 *   sentiment_score integer check (sentiment_score between 1 and 5),
 *   tags text[] default '{}',
 *   crisis_flag boolean default false
 * );
 *
 * create table weekly_summaries (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references users(id) on delete cascade,
 *   week_start date,
 *   week_end date,
 *   avg_sentiment numeric(4,2),
 *   top_tags text[] default '{}',
 *   summary_text text,
 *   trend text check (trend in ('declining', 'stable', 'improving')),
 *   nudge_triggered boolean default false,
 *   nudge_reason text,
 *   created_at timestamptz default now()
 * );
 *
 * create table followups (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references users(id) on delete cascade,
 *   nudge_date timestamptz,
 *   followup_sent_at timestamptz,
 *   response text check (response is null or response in ('yes', 'no')),
 *   created_at timestamptz default now()
 * );
 */
