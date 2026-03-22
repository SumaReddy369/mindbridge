import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    "mindbridge-dev-state-change-me"
  );
}

/** Signed opaque state for Google OAuth (contains userId). */
export function signGoogleOAuthState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ p: payload, s: sig }), "utf8").toString(
    "base64url"
  );
}

/** Returns userId or null if invalid / expired (>15 min). */
export function verifyGoogleOAuthState(state: string | null): string | null {
  if (!state?.trim()) return null;
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { p?: string; s?: string };
    if (!parsed.p || !parsed.s) return null;
    const expected = createHmac("sha256", secret())
      .update(parsed.p)
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(parsed.s, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const parts = parsed.p.split(".");
    const userId = parts[0];
    const ts = parts[1] ? Number(parts[1]) : 0;
    if (!userId || !Number.isFinite(ts)) return null;
    if (Date.now() - ts > 15 * 60 * 1000) return null;
    return userId;
  } catch {
    return null;
  }
}
