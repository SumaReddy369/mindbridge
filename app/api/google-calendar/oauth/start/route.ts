import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { getUserIdFromSupabaseBearer } from "@/lib/supabaseAuthRequest";
import { signGoogleOAuthState } from "@/lib/googleOAuthState";

function redirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/google-calendar/oauth/callback`;
}

/** POST — returns { url } to open in the browser (Google consent). */
export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "Google OAuth not configured",
        hint: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
      },
      { status: 503 }
    );
  }

  const userId = await getUserIdFromSupabaseBearer(req);
  if (!userId) {
    return NextResponse.json(
      {
        error: "Sign in required",
        hint: "Send Authorization: Bearer <Supabase access token>",
      },
      { status: 401 }
    );
  }

  const state = signGoogleOAuthState(userId);
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri());
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state,
  });

  return NextResponse.json({ url });
}
