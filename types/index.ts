export interface User {
  id: string;
  created_at: string;
  frequency_days: number;
  last_checkin_at: string | null;
  nudge_shown_at: string | null;
  /** Display name from registration (optional in DB until migrated) */
  full_name?: string | null;
  /**
   * Topics the student wants check-ins to lean toward (reminders / AI tone).
   * Persisted in mock store; add `checkin_interests text[]` (or jsonb) on `users` in Supabase to sync in production.
   */
  checkin_interests?: string[] | null;
  /** True when this user has linked Google Calendar (OAuth refresh token stored server-side). */
  calendar_connected?: boolean;
}

export interface Checkin {
  id: string;
  user_id: string;
  created_at: string;
  /** Optional client/session id (e.g. embed tab). Requires `session_id` on `checkins` in Supabase if used. */
  session_id?: string | null;
  user_text: string;
  ai_response: string | null;
  sentiment_score: number; // 1–5
  tags: string[];
  crisis_flag: boolean;
}

export interface WeeklySummary {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  avg_sentiment: number;
  top_tags: string[];
  summary_text: string;
  trend: "declining" | "stable" | "improving";
  nudge_triggered: boolean;
  nudge_reason: string | null;
  created_at: string;
}

export interface Followup {
  id: string;
  user_id: string;
  nudge_date: string;
  followup_sent_at: string | null;
  response: "yes" | "no" | null;
  created_at: string;
}

export interface ThresholdResult {
  nudge: boolean;
  reason: string | null;
  urgency: "soft" | "standard" | "crisis";
}

/** Curated third-party link (APA, JED, ASU, etc.) */
export interface Resource {
  title: string;
  url: string;
  description?: string;
  /** Shown as a small trust badge on the Resources page */
  source?: "APA" | "JED" | "ASU" | "CDC" | "SAMHSA";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CheckinExtraction {
  sentiment_score: number;
  tags: string[];
  crisis_flag: boolean;
  ai_response: string;
}
