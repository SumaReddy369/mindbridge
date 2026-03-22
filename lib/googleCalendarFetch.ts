/**
 * Shared Google Calendar events fetch (used by /api/google-calendar/events and OAuth callback tests).
 */

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { googleEventsToAssignments } from "@/lib/googleCalendar";
import { analyzeWorkload } from "@/lib/workloadStress";
import type { CanvasAssignmentInput } from "@/lib/canvasTypes";
import type { WorkloadAnalysis } from "@/lib/canvasTypes";

export async function fetchGoogleCalendarWorkload(args: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
  days: number;
  now?: number;
  /** Overrides default label in workload context for AI */
  workloadSourceLabel?: string;
}): Promise<{
  assignments: CanvasAssignmentInput[];
  analysis: WorkloadAnalysis;
  workloadContext: string;
  eventCount: number;
}> {
  const {
    clientId,
    clientSecret,
    refreshToken,
    calendarId,
    days,
    now = Date.now(),
    workloadSourceLabel,
  } = args;

  const d = Math.min(30, Math.max(1, days));
  const timeMin = new Date(now);
  const timeMax = new Date(now + d * 24 * 60 * 60 * 1000);

  const oauth2 = new OAuth2Client(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const list = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  const items = list.data.items ?? [];
  const assignments = googleEventsToAssignments(items);
  const analysis = analyzeWorkload(assignments, now, {
    workloadSourceLabel:
      workloadSourceLabel ??
      "Google Calendar events (your calendar — upcoming deadlines, approximate)",
  });

  return {
    assignments,
    analysis,
    workloadContext: analysis.contextForAI,
    eventCount: items.length,
  };
}
