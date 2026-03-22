import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/requestUser";
import { getUser, updateUser, ensureUser } from "@/lib/repository";

/** GET current user settings */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  let user = await getUser(userId);
  if (!user) {
    user = await ensureUser(userId);
  }
  return NextResponse.json({ user });
}

const ALLOWED_INTERESTS = new Set([
  "academic",
  "sleep",
  "stress",
  "social",
  "loneliness",
  "family",
  "health",
  "career",
  "identity",
  "financial",
]);

function normalizeInterests(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().toLowerCase();
    if (ALLOWED_INTERESTS.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/** PATCH { frequency_days?, checkin_interests? } */
export async function PATCH(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    const body = await req.json();
    const days = body.frequency_days;
    const interests = normalizeInterests(body.checkin_interests);

    if (days !== undefined) {
      if (typeof days !== "number" || days < 1 || days > 30) {
        return NextResponse.json(
          { error: "frequency_days must be 1–30" },
          { status: 400 }
        );
      }
    }

    if (
      body.checkin_interests !== undefined &&
      !Array.isArray(body.checkin_interests)
    ) {
      return NextResponse.json(
        { error: "checkin_interests must be an array of strings" },
        { status: 400 }
      );
    }

    await ensureUser(userId);

    const patch: Parameters<typeof updateUser>[1] = {};
    if (days !== undefined) patch.frequency_days = days;
    if (interests !== undefined) patch.checkin_interests = interests;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update (send frequency_days and/or checkin_interests)" },
        { status: 400 }
      );
    }

    const updated = await updateUser(userId, patch);
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user: updated });
  } catch (e) {
    console.error("[PATCH /api/user]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
