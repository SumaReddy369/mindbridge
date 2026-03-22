"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export const JUDGE_DEMO_FLAG = "mindbridge_judge_demo";
/** Legacy key — cleared on sign-out / delete; session is Supabase-backed */
export const MIND_BRIDGE_USER_STORAGE_KEY = "mindbridge_user_id";

async function ensureUserProfile(accessToken: string): Promise<void> {
  const res = await fetch("/api/auth/ensure-user", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Could not sync profile");
  }
}

function readFullName(user: {
  user_metadata?: Record<string, unknown>;
}): string | null {
  const v = user.user_metadata?.full_name;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export type MindBridgeUserContextValue = {
  userId: string | null;
  ready: boolean;
  isJudgeDemo: boolean;
  authEmail: string | null;
  authFullName: string | null;
  /** Logged in with Supabase (required for all app use) */
  isAuthenticated: boolean;
  hasSupabaseAuth: boolean;
  authHeaders: () => HeadersInit;
  signOut: () => Promise<void>;
  startFreshSession: () => void;
  startJudgeDemo: () => void;
};

const MindBridgeUserContext = createContext<MindBridgeUserContextValue | null>(
  null
);

export function MindBridgeUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isJudgeDemo, setIsJudgeDemo] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authFullName, setAuthFullName] = useState<string | null>(null);
  const [hasSupabaseAuth, setHasSupabaseAuth] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    async function applySession(session: {
      access_token: string;
      user: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      };
    }) {
      try {
        await ensureUserProfile(session.access_token);
      } catch (e) {
        console.error("[auth] ensure-user failed", e);
      }
      if (cancelled) return;
      localStorage.removeItem(MIND_BRIDGE_USER_STORAGE_KEY);
      setUserId(session.user.id);
      setAccessToken(session.access_token);
      setAuthEmail(session.user.email ?? null);
      setAuthFullName(readFullName(session.user));
      setHasSupabaseAuth(true);
      setReady(true);
    }

    async function init() {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      if (params?.get("judge") === "1") {
        localStorage.setItem(JUDGE_DEMO_FLAG, "1");
      }

      const judge = localStorage.getItem(JUDGE_DEMO_FLAG) === "1";
      if (!cancelled) setIsJudgeDemo(judge);

      const sb = getSupabaseBrowserClient();
      if (!sb) {
        if (!cancelled) setReady(true);
        return;
      }

      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!cancelled && session?.user && session.access_token) {
        await applySession(session);
        return;
      }

      if (!cancelled) setReady(true);
    }

    void init();

    const sb = getSupabaseBrowserClient();
    if (sb) {
      const { data } = sb.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;

        if (event === "SIGNED_IN" && session?.user && session.access_token) {
          await applySession(session);
        }

        if (event === "SIGNED_OUT") {
          localStorage.removeItem(MIND_BRIDGE_USER_STORAGE_KEY);
          setUserId(null);
          setAuthEmail(null);
          setAuthFullName(null);
          setHasSupabaseAuth(false);
        }

        if (event === "USER_UPDATED" && session?.user) {
          setAuthFullName(readFullName(session.user));
        }
      });
      subscription = data.subscription;
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    if (!userId) return {};
    const h: Record<string, string> = { "x-mindbridge-user-id": userId };
    if (accessToken) {
      h.Authorization = `Bearer ${accessToken}`;
    }
    return h;
  }, [userId, accessToken]);

  const isAuthenticated = !!(userId && hasSupabaseAuth);

  const signOut = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    localStorage.removeItem(JUDGE_DEMO_FLAG);
    localStorage.removeItem(MIND_BRIDGE_USER_STORAGE_KEY);
    if (sb) {
      await sb.auth.signOut();
    }
    window.location.href = "/";
  }, []);

  const startFreshSession = useCallback(() => {
    localStorage.removeItem(JUDGE_DEMO_FLAG);
    window.location.href = "/check-in";
  }, []);

  const startJudgeDemo = useCallback(() => {
    localStorage.setItem(JUDGE_DEMO_FLAG, "1");
    window.location.href = "/patterns?judge=1";
  }, []);

  const value = useMemo<MindBridgeUserContextValue>(
    () => ({
      userId,
      ready,
      isJudgeDemo,
      authEmail,
      authFullName,
      isAuthenticated,
      hasSupabaseAuth,
      authHeaders,
      signOut,
      startFreshSession,
      startJudgeDemo,
    }),
    [
      userId,
      ready,
      isJudgeDemo,
      authEmail,
      authFullName,
      isAuthenticated,
      hasSupabaseAuth,
      authHeaders,
      signOut,
      startFreshSession,
      startJudgeDemo,
    ]
  );

  return (
    <MindBridgeUserContext.Provider value={value}>
      {children}
    </MindBridgeUserContext.Provider>
  );
}

export function useMindBridgeUser(): MindBridgeUserContextValue {
  const ctx = useContext(MindBridgeUserContext);
  if (!ctx) {
    throw new Error(
      "useMindBridgeUser must be used within MindBridgeUserProvider"
    );
  }
  return ctx;
}
