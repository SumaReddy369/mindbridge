/**
 * Data access: in-memory mock (demo) or Supabase when service role + URL are set.
 */

import type { Checkin, Followup, User, WeeklySummary } from "@/types";
import {
  getUser as mockGetUser,
  ensureUserWithId as mockEnsureUser,
  updateUser as mockUpdateUser,
  getCheckins as mockGetCheckins,
  createCheckin as mockCreateCheckin,
  getWeeklySummaries as mockGetWeeklySummaries,
  createWeeklySummary as mockCreateWeeklySummary,
  getFollowups as mockGetFollowups,
  createFollowup as mockCreateFollowup,
  updateFollowup as mockUpdateFollowup,
  deleteAllUserData as mockDeleteAll,
  createUser as mockCreateUser,
  getGoogleCalendarRefreshTokenMock,
  setGoogleCalendarRefreshTokenMock,
  store,
} from "@/lib/mockData";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isDemoModePublic } from "@/lib/serverEnv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function useSupabase(): boolean {
  return (
    isSupabaseConfigured() &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    !isDemoModePublic()
  );
}

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return _admin;
}

function rowToUser(r: Record<string, unknown>): User {
  const rawInterests = r.checkin_interests;
  let checkin_interests: string[] | null | undefined;
  if (Array.isArray(rawInterests)) {
    checkin_interests = rawInterests as string[];
  } else if (typeof rawInterests === "string" && rawInterests) {
    try {
      const p = JSON.parse(rawInterests) as unknown;
      checkin_interests = Array.isArray(p) ? (p as string[]) : null;
    } catch {
      checkin_interests = null;
    }
  }
  return {
    id: r.id as string,
    created_at: r.created_at as string,
    frequency_days: r.frequency_days as number,
    last_checkin_at: (r.last_checkin_at as string | null) ?? null,
    nudge_shown_at: (r.nudge_shown_at as string | null) ?? null,
    full_name: (r.full_name as string | null | undefined) ?? null,
    checkin_interests: checkin_interests ?? undefined,
    calendar_connected: Boolean(
      r.google_calendar_refresh_token &&
        String(r.google_calendar_refresh_token).trim()
    ),
  };
}

function rowToCheckin(r: Record<string, unknown>): Checkin {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    created_at: r.created_at as string,
    session_id: (r.session_id as string | null | undefined) ?? null,
    user_text: r.user_text as string,
    ai_response: (r.ai_response as string | null) ?? null,
    sentiment_score: Number(r.sentiment_score),
    tags: (r.tags as string[]) ?? [],
    crisis_flag: Boolean(r.crisis_flag),
  };
}

function rowToSummary(r: Record<string, unknown>): WeeklySummary {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    week_start: String(r.week_start).split("T")[0],
    week_end: String(r.week_end).split("T")[0],
    avg_sentiment: Number(r.avg_sentiment),
    top_tags: (r.top_tags as string[]) ?? [],
    summary_text: r.summary_text as string,
    trend: r.trend as WeeklySummary["trend"],
    nudge_triggered: Boolean(r.nudge_triggered),
    nudge_reason: (r.nudge_reason as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

function rowToFollowup(r: Record<string, unknown>): Followup {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    nudge_date: r.nudge_date as string,
    followup_sent_at: (r.followup_sent_at as string | null) ?? null,
    response: (r.response as Followup["response"]) ?? null,
    created_at: r.created_at as string,
  };
}

export async function ensureUser(
  userId: string,
  frequencyDays = 2,
  profile?: { full_name?: string | null }
): Promise<User> {
  if (!useSupabase()) {
    return mockEnsureUser(userId, frequencyDays, profile?.full_name);
  }
  const sb = admin();
  const { data: existing } = await sb
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (existing) {
    const row = existing as Record<string, unknown>;
    if (
      profile?.full_name != null &&
      profile.full_name !== "" &&
      row.full_name !== profile.full_name
    ) {
      const { data: updated, error: upErr } = await sb
        .from("users")
        .update({ full_name: profile.full_name })
        .eq("id", userId)
        .select("*")
        .single();
      if (!upErr && updated) return rowToUser(updated as Record<string, unknown>);
    }
    return rowToUser(row);
  }
  const insertRow: Record<string, unknown> = {
    id: userId,
    frequency_days: frequencyDays,
  };
  if (profile?.full_name != null && profile.full_name !== "") {
    insertRow.full_name = profile.full_name;
  }
  const { data, error } = await sb
    .from("users")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw error;
  return rowToUser(data as Record<string, unknown>);
}

export async function createNewUser(frequencyDays = 2): Promise<User> {
  if (!useSupabase()) {
    return mockCreateUser(frequencyDays);
  }
  const sb = admin();
  const { data, error } = await sb
    .from("users")
    .insert({ frequency_days: frequencyDays })
    .select("*")
    .single();
  if (error) throw error;
  return rowToUser(data as Record<string, unknown>);
}

export async function getUser(userId: string): Promise<User | null> {
  if (!useSupabase()) {
    return mockGetUser(userId) ?? null;
  }
  const { data } = await admin()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return rowToUser(data as Record<string, unknown>);
}

export async function getGoogleCalendarRefreshToken(
  userId: string
): Promise<string | null> {
  if (!useSupabase()) {
    return getGoogleCalendarRefreshTokenMock(userId);
  }
  const { data } = await admin()
    .from("users")
    .select("google_calendar_refresh_token")
    .eq("id", userId)
    .maybeSingle();
  const t = (
    data as { google_calendar_refresh_token?: string | null } | null
  )?.google_calendar_refresh_token;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

export async function saveGoogleCalendarRefreshToken(
  userId: string,
  token: string | null
): Promise<void> {
  if (!useSupabase()) {
    setGoogleCalendarRefreshTokenMock(userId, token);
    return;
  }
  const { error } = await admin()
    .from("users")
    .update({ google_calendar_refresh_token: token })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateUser(
  userId: string,
  patch: Partial<User>
): Promise<User | null> {
  if (!useSupabase()) {
    return mockUpdateUser(userId, patch);
  }
  const row: Record<string, unknown> = {};
  if (patch.frequency_days !== undefined)
    row.frequency_days = patch.frequency_days;
  if (patch.last_checkin_at !== undefined)
    row.last_checkin_at = patch.last_checkin_at;
  if (patch.nudge_shown_at !== undefined)
    row.nudge_shown_at = patch.nudge_shown_at;
  if (patch.full_name !== undefined) row.full_name = patch.full_name;
  /* checkin_interests: add column `checkin_interests` (jsonb or text[]) on `users` before enabling:
  if (patch.checkin_interests !== undefined) row.checkin_interests = patch.checkin_interests;
  */
  const { data, error } = await admin()
    .from("users")
    .update(row)
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !data) return null;
  return rowToUser(data as Record<string, unknown>);
}

export async function getCheckins(userId: string): Promise<Checkin[]> {
  if (!useSupabase()) {
    return mockGetCheckins(userId);
  }
  const { data, error } = await admin()
    .from("checkins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToCheckin(r as Record<string, unknown>));
}

export async function createCheckin(
  data: Omit<Checkin, "id">
): Promise<Checkin> {
  if (!useSupabase()) {
    return mockCreateCheckin(data);
  }
  const sb = admin();
  const insertRow: Record<string, unknown> = {
    user_id: data.user_id,
    created_at: data.created_at,
    user_text: data.user_text,
    ai_response: data.ai_response,
    sentiment_score: data.sentiment_score,
    tags: data.tags,
    crisis_flag: data.crisis_flag,
  };
  if (data.session_id != null && data.session_id !== "") {
    insertRow.session_id = data.session_id;
  }
  const { data: row, error } = await sb
    .from("checkins")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw error;
  return rowToCheckin(row as Record<string, unknown>);
}

export async function getWeeklySummaries(
  userId: string
): Promise<WeeklySummary[]> {
  if (!useSupabase()) {
    return mockGetWeeklySummaries(userId);
  }
  const { data, error } = await admin()
    .from("weekly_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToSummary(r as Record<string, unknown>));
}

export async function createWeeklySummary(
  data: Omit<WeeklySummary, "id">
): Promise<WeeklySummary> {
  if (!useSupabase()) {
    return mockCreateWeeklySummary(data);
  }
  const { data: row, error } = await admin()
    .from("weekly_summaries")
    .insert({
      user_id: data.user_id,
      week_start: data.week_start,
      week_end: data.week_end,
      avg_sentiment: data.avg_sentiment,
      top_tags: data.top_tags,
      summary_text: data.summary_text,
      trend: data.trend,
      nudge_triggered: data.nudge_triggered,
      nudge_reason: data.nudge_reason,
      created_at: data.created_at,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToSummary(row as Record<string, unknown>);
}

export async function getFollowups(userId: string): Promise<Followup[]> {
  if (!useSupabase()) {
    return mockGetFollowups(userId);
  }
  const { data, error } = await admin()
    .from("followups")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToFollowup(r as Record<string, unknown>));
}

export async function createFollowup(
  data: Omit<Followup, "id">
): Promise<Followup> {
  if (!useSupabase()) {
    return mockCreateFollowup(data);
  }
  const { data: row, error } = await admin()
    .from("followups")
    .insert({
      user_id: data.user_id,
      nudge_date: data.nudge_date,
      followup_sent_at: data.followup_sent_at,
      response: data.response,
      created_at: data.created_at,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToFollowup(row as Record<string, unknown>);
}

export async function updateFollowup(
  id: string,
  patch: Partial<Followup>
): Promise<Followup | null> {
  if (!useSupabase()) {
    return mockUpdateFollowup(id, patch);
  }
  const { data, error } = await admin()
    .from("followups")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return null;
  return rowToFollowup(data as Record<string, unknown>);
}

export async function deleteAllUserData(userId: string): Promise<void> {
  if (!useSupabase()) {
    mockDeleteAll(userId);
    return;
  }
  const { error } = await admin().from("users").delete().eq("id", userId);
  if (error) throw error;
}

export type CronUser = Pick<
  User,
  "id" | "last_checkin_at" | "frequency_days"
>;

export async function listUsersForCron(): Promise<CronUser[]> {
  if (!useSupabase()) {
    return Array.from(store.users.values()).map((u) => ({
      id: u.id,
      last_checkin_at: u.last_checkin_at,
      frequency_days: u.frequency_days,
    }));
  }
  const { data, error } = await admin()
    .from("users")
    .select("id, last_checkin_at, frequency_days");
  if (error) throw error;
  return (data ?? []) as CronUser[];
}
