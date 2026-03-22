/**
 * GET /api/google-calendar/events
 *
 * Prefers the signed-in user's OAuth refresh token (per-user calendar, like Canvas
 * assignments for that student). Falls back to GOOGLE_REFRESH_TOKEN only when the
 * request has no valid Supabase Bearer token (shared demo / judges).
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET required.
 * Optional: GOOGLE_REFRESH_TOKEN (demo), GOOGLE_CALENDAR_ID (default primary).
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleCalendarWorkload } from "@/lib/googleCalendarFetch";
import { getUserIdFromSupabaseBearer } from "@/lib/supabaseAuthRequest";
import { getGoogleCalendarRefreshToken } from "@/lib/repository";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "Google Calendar not configured",
        hint: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Optionally GOOGLE_REFRESH_TOKEN for a server-wide demo when no user is signed in.",
      },
      { status: 503 }
    );
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";
  const days = Math.min(
    30,
    Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 14)
  );

  const userId = await getUserIdFromSupabaseBearer(req);
  let refreshToken: string | null = null;
  let source: "user" | "env_demo" | null = null;

  if (userId) {
    refreshToken = await getGoogleCalendarRefreshToken(userId);
    if (refreshToken) {
      source = "user";
    } else if (envRefreshToken) {
      return NextResponse.json(
        {
          error: "Google Calendar not connected for this account",
          hint: "Use Connect Google Calendar in the embed, then load again. (A shared demo token is configured but not used while you are signed in.)",
          needsConnect: true,
        },
        { status: 503 }
      );
    }
  } else if (envRefreshToken) {
    refreshToken = envRefreshToken;
    source = "env_demo";
  }

  if (!refreshToken || !source) {
    return NextResponse.json(
      {
        error: "No Google Calendar access",
        hint: userId
          ? "Connect your Google Calendar from the embed, or set GOOGLE_REFRESH_TOKEN for an unsigned demo."
          : "Sign in and connect Google Calendar, or set GOOGLE_REFRESH_TOKEN for a server demo without sign-in.",
        needsConnect: Boolean(userId),
      },
      { status: 503 }
    );
  }

  try {
    const workloadSourceLabel =
      source === "user"
        ? "Google Calendar events (your calendar — upcoming deadlines, approximate)"
        : "Google Calendar events (shared demo calendar — upcoming deadlines, approximate)";

    const result = await fetchGoogleCalendarWorkload({
      clientId,
      clientSecret,
      refreshToken,
      calendarId,
      days,
      workloadSourceLabel,
    });

    return NextResponse.json({
      assignments: result.assignments,
      analysis: result.analysis,
      workloadContext: result.workloadContext,
      calendarId,
      eventCount: result.eventCount,
      source,
    });
  } catch (e) {
    console.error("[/api/google-calendar/events]", e);
    const message = e instanceof Error ? e.message : "Calendar fetch failed";
    return NextResponse.json(
      {
        error: message,
        hint: "Check OAuth scopes include calendar.readonly and the refresh token is valid.",
      },
      { status: 502 }
    );
  }
}
