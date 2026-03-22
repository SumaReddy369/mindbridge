/**
 * In-memory mock store — used when NEXT_PUBLIC_DEMO_MODE=true or when
 * Supabase credentials are not set.  Pre-seeded with the 14-day demo arc
 * described in the architecture doc so the nudge fires on the /patterns page.
 */

import { Checkin, User, WeeklySummary, Followup } from "@/types";

/** Fixed UUID for judge storyline + Supabase compatibility */
export const DEMO_USER_ID = "f4700000-0000-4000-8000-000000000001";

// ─── Helper ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const store = {
  users: new Map<string, User>(),
  checkins: new Map<string, Checkin>(),
  weeklySummaries: new Map<string, WeeklySummary>(),
  followups: new Map<string, Followup>(),
};

/** Per-user Google OAuth refresh tokens (mock DB only; never sent to client). */
const googleCalendarRefreshTokens = new Map<string, string>();

function withCalendarConnected(u: User): User {
  return {
    ...u,
    calendar_connected: googleCalendarRefreshTokens.has(u.id),
  };
}

export function getGoogleCalendarRefreshTokenMock(
  userId: string
): string | null {
  return googleCalendarRefreshTokens.get(userId) ?? null;
}

export function setGoogleCalendarRefreshTokenMock(
  userId: string,
  token: string | null
): void {
  if (token === null || token === "") googleCalendarRefreshTokens.delete(userId);
  else googleCalendarRefreshTokens.set(userId, token);
}

// ─── Seed user ───────────────────────────────────────────────────────────────

const demoUser: User = {
  id: DEMO_USER_ID,
  created_at: daysAgo(14),
  frequency_days: 2,
  last_checkin_at: daysAgo(0),
  nudge_shown_at: null,
  full_name: null,
};
store.users.set(DEMO_USER_ID, demoUser);

// ─── 14-day demo arc ─────────────────────────────────────────────────────────
// This arc triggers all three threshold conditions, and the patterns page will
// show the nudge firing after Day 14.

const demoCheckins: Omit<Checkin, "id">[] = [
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(13),
    user_text: "Pretty good, just busy with assignments",
    ai_response:
      "Sounds like you're keeping up despite the busyness — that's something. What's on your plate right now?",
    sentiment_score: 4,
    tags: ["academic"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(11),
    user_text: "Tired. Didn't sleep great, stressed about a deadline",
    ai_response:
      "Deadlines and sleep debt are a rough combination. Is this crunch time or has the workload been steady like this?",
    sentiment_score: 3,
    tags: ["academic", "sleep"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(9),
    user_text: "Feeling kind of alone today. Everyone seems busy",
    ai_response:
      "That feeling of being on the outside of a busy world is really real. Have you been able to connect with anyone this week, even briefly?",
    sentiment_score: 2,
    tags: ["loneliness"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(7),
    user_text: "Had a rough call with family. Feeling drained",
    ai_response:
      "Family stuff can take a lot out of you, especially when you're already stretched. You don't have to hold all of that alone.",
    sentiment_score: 2,
    tags: ["family", "overwhelm"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(5),
    user_text: "Everything feels like too much. Can't focus",
    ai_response:
      "When everything piles up it can be hard to find any traction. What's the one thing weighing on you most right now?",
    sentiment_score: 1,
    tags: ["overwhelm", "academic"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(4),
    user_text: "A bit better but still low energy",
    ai_response:
      "Even a small upward shift matters. What helped today, even a little?",
    sentiment_score: 3,
    tags: ["health"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(2),
    user_text: "I don't know, just feel stuck",
    ai_response:
      "Stuck is a hard place to be. Sometimes talking to someone — a counselor or even a friend — can help loosen things up a bit.",
    sentiment_score: 1,
    tags: ["overwhelm", "loneliness"],
    crisis_flag: false,
  },
  {
    user_id: DEMO_USER_ID,
    created_at: daysAgo(0),
    user_text: "Same. Like this is never going to change",
    ai_response:
      "I hear you. It can feel permanent when you've been in it for a while. You don't have to figure it out alone — there are people who are really good at helping with exactly this.",
    sentiment_score: 1,
    tags: ["overwhelm", "loneliness"],
    crisis_flag: false,
  },
];

demoCheckins.forEach((c) => {
  const id = uuid();
  store.checkins.set(id, { ...c, id });
});

// ─── Seed weekly summary ──────────────────────────────────────────────────────

const seedSummary: WeeklySummary = {
  id: uuid(),
  user_id: DEMO_USER_ID,
  week_start: daysAgo(7),
  week_end: daysAgo(0),
  avg_sentiment: 2.1,
  top_tags: ["overwhelm", "loneliness", "academic"],
  summary_text:
    "This week has felt heavy — a lot of overwhelm, some loneliness, and it's been hard to focus. There were glimpses of better moments, but the weight has been consistent.",
  trend: "declining",
  nudge_triggered: true,
  nudge_reason: "sustained_low_sentiment, recurring_distress_themes",
  created_at: daysAgo(0),
};
store.weeklySummaries.set(seedSummary.id, seedSummary);

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

export function getUser(userId: string): User | undefined {
  const u = store.users.get(userId);
  if (!u) return undefined;
  return withCalendarConnected(u);
}

/** Ensure a user row exists for this id (used after client bootstrap). */
export function ensureUserWithId(
  userId: string,
  frequencyDays = 2,
  fullName?: string | null
): User {
  const existing = store.users.get(userId);
  if (existing) {
    if (fullName != null && fullName !== "" && existing.full_name !== fullName) {
      const updated = { ...existing, full_name: fullName };
      store.users.set(userId, updated);
      return withCalendarConnected(updated);
    }
    return withCalendarConnected(existing);
  }
  const user: User = {
    id: userId,
    created_at: new Date().toISOString(),
    frequency_days: frequencyDays,
    last_checkin_at: null,
    nudge_shown_at: null,
    full_name: fullName && fullName !== "" ? fullName : null,
  };
  store.users.set(userId, user);
  return withCalendarConnected(user);
}

export function createUser(frequencyDays = 2): User {
  const user: User = {
    id: uuid(),
    created_at: new Date().toISOString(),
    frequency_days: frequencyDays,
    last_checkin_at: null,
    nudge_shown_at: null,
    full_name: null,
  };
  store.users.set(user.id, user);
  return withCalendarConnected(user);
}

export function updateUser(userId: string, patch: Partial<User>): User | null {
  const user = store.users.get(userId);
  if (!user) return null;
  const { calendar_connected: _c, ...rest } = patch;
  const updated = { ...user, ...rest };
  store.users.set(userId, updated);
  return withCalendarConnected(updated);
}

export function getCheckins(userId: string): Checkin[] {
  return Array.from(store.checkins.values())
    .filter((c) => c.user_id === userId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

export function createCheckin(data: Omit<Checkin, "id">): Checkin {
  const id = uuid();
  const checkin: Checkin = { ...data, id };
  store.checkins.set(id, checkin);
  return checkin;
}

export function getWeeklySummaries(userId: string): WeeklySummary[] {
  return Array.from(store.weeklySummaries.values())
    .filter((s) => s.user_id === userId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function createWeeklySummary(
  data: Omit<WeeklySummary, "id">
): WeeklySummary {
  const id = uuid();
  const summary: WeeklySummary = { ...data, id };
  store.weeklySummaries.set(id, summary);
  return summary;
}

export function getFollowups(userId: string): Followup[] {
  return Array.from(store.followups.values()).filter(
    (f) => f.user_id === userId
  );
}

export function createFollowup(data: Omit<Followup, "id">): Followup {
  const id = uuid();
  const followup: Followup = { ...data, id };
  store.followups.set(id, followup);
  return followup;
}

export function updateFollowup(
  id: string,
  patch: Partial<Followup>
): Followup | null {
  const followup = store.followups.get(id);
  if (!followup) return null;
  const updated = { ...followup, ...patch };
  store.followups.set(id, updated);
  return updated;
}

export function deleteAllUserData(userId: string): void {
  googleCalendarRefreshTokens.delete(userId);
  store.users.delete(userId);
  store.checkins.forEach((c, id) => {
    if (c.user_id === userId) store.checkins.delete(id);
  });
  store.weeklySummaries.forEach((s, id) => {
    if (s.user_id === userId) store.weeklySummaries.delete(id);
  });
  store.followups.forEach((f, id) => {
    if (f.user_id === userId) store.followups.delete(id);
  });
}
