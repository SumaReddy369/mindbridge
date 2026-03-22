import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { verifyGoogleOAuthState } from "@/lib/googleOAuthState";
import { saveGoogleCalendarRefreshToken } from "@/lib/repository";

function redirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/google-calendar/oauth/callback`;
}

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const oauthErr = req.nextUrl.searchParams.get("error");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const base = siteBase().replace(/\/$/, "");
  const fail = `${base}/embed?google_calendar=error`;
  const noRefresh = `${base}/embed?google_calendar=no_refresh`;

  if (oauthErr || !code) {
    return NextResponse.redirect(fail);
  }

  const userId = verifyGoogleOAuthState(state);
  if (!userId || !clientId || !clientSecret) {
    return NextResponse.redirect(fail);
  }

  try {
    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      redirectUri()
    );
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.error(
        "[google oauth] no refresh_token — revoke MindBridge in Google account and reconnect with prompt=consent"
      );
      return NextResponse.redirect(noRefresh);
    }
    await saveGoogleCalendarRefreshToken(userId, tokens.refresh_token);
  } catch (e) {
    console.error("[google oauth callback]", e);
    return NextResponse.redirect(fail);
  }

  return NextResponse.redirect(`${base}/embed?google_calendar=connected`);
}
