"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandIcon from "@/components/BrandIcon";
import ChatBubble from "@/components/ChatBubble";
import CheckInInput from "@/components/CheckInInput";
import CrisisOverlay from "@/components/CrisisOverlay";
import ProactiveWorkloadModal from "@/components/ProactiveWorkloadModal";
import { useMindBridgeUser } from "@/hooks/useMindBridgeUser";
import type { CanvasAssignmentInput, WorkloadAnalysis } from "@/lib/canvasTypes";
import type { ChatMessage } from "@/types";

const STORAGE_WORKLOAD = "mindbridge_canvas_workload_ctx";
const STORAGE_ANALYSIS = "mindbridge_canvas_analysis";
const STORAGE_SOURCE = "mindbridge_workload_source";

type WorkloadSource = "canvas" | "demo" | "gcal";

function workloadModalSig(a: WorkloadAnalysis) {
  return `${a.tier}-${a.dueNext48h}-${a.dueNext7d}-${a.totalTracked}`;
}

/** Demo assignments for judges / local testing */
const DEMO_CRUSHING_WEEK: CanvasAssignmentInput[] = [
  { name: "Chem lab report", due_at: new Date(Date.now() + 20 * 3600 * 1000).toISOString(), course_name: "CHEM 101" },
  { name: "Essay draft", due_at: new Date(Date.now() + 30 * 3600 * 1000).toISOString(), course_name: "ENG 200" },
  { name: "Problem set 7", due_at: new Date(Date.now() + 40 * 3600 * 1000).toISOString(), course_name: "MATH 150" },
  { name: "Quiz 4 (online)", due_at: new Date(Date.now() + 50 * 3600 * 1000).toISOString(), course_name: "PSY 100" },
  { name: "Group project milestone", due_at: new Date(Date.now() + 60 * 3600 * 1000).toISOString(), course_name: "BUS 220" },
];

export default function CanvasEmbedPage() {
  const { userId, ready, authHeaders } = useMindBridgeUser();
  const [open, setOpen] = useState(true);
  const [analysis, setAnalysis] = useState<WorkloadAnalysis | null>(null);
  const [workloadContext, setWorkloadContext] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [welcomeSet, setWelcomeSet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [workloadSource, setWorkloadSource] = useState<WorkloadSource | null>(
    null
  );
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);
  /** null = not checked yet; false = OAuth client not configured (503 from API) */
  const [gcalServerConfigured, setGcalServerConfigured] = useState<
    boolean | null
  >(null);
  /** Signed in but OAuth refresh token not stored yet — show Connect */
  const [gcalNeedsConnect, setGcalNeedsConnect] = useState(false);
  const [gcalSource, setGcalSource] = useState<"user" | "env_demo" | null>(
    null
  );
  const [gcalInfo, setGcalInfo] = useState<string | null>(null);
  const [showProactiveModal, setShowProactiveModal] = useState(false);
  const proactiveModalSuppressedSig = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analysis?.suggestProactiveCheckin) {
      setShowProactiveModal(false);
      return;
    }
    const sig = workloadModalSig(analysis);
    if (proactiveModalSuppressedSig.current === sig) return;
    setShowProactiveModal(true);
  }, [analysis]);

  function dismissProactiveModal() {
    if (analysis) proactiveModalSuppressedSig.current = workloadModalSig(analysis);
    setShowProactiveModal(false);
  }

  function engageProactiveModal() {
    dismissProactiveModal();
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  const refreshContext = useCallback(
    async (
      assignments: CanvasAssignmentInput[],
      source: WorkloadSource = "canvas"
    ) => {
      setGcalError(null);
      setGcalInfo(null);
      const res = await fetch("/api/canvas/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const data = await res.json();
      if (data.analysis && data.workloadContext) {
        setWorkloadSource(source);
        setWelcomeSet(false);
        setMessages([]);
        setAnalysis(data.analysis as WorkloadAnalysis);
        setWorkloadContext(data.workloadContext as string);
        try {
          sessionStorage.setItem(STORAGE_ANALYSIS, JSON.stringify(data.analysis));
          sessionStorage.setItem(STORAGE_WORKLOAD, data.workloadContext);
          sessionStorage.setItem(STORAGE_SOURCE, source);
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  // Ask parent (school-hosted bridge) for assignments via postMessage
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "MINDBRIDGE_CANVAS_ASSIGNMENTS" && Array.isArray(d.assignments)) {
        refreshContext(d.assignments as CanvasAssignmentInput[], "canvas");
      }
    }
    window.addEventListener("message", onMessage);
    try {
      window.parent?.postMessage({ type: "MINDBRIDGE_REQUEST_ASSIGNMENTS" }, "*");
    } catch {
      /* not in iframe */
    }
    return () => window.removeEventListener("message", onMessage);
  }, [refreshContext]);

  // Probe: OAuth client configured? User calendar vs shared demo token?
  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/google-calendar/events?days=1", {
          headers: { ...authHeaders() },
        });
        const data = (await res.json().catch(() => ({}))) as {
          needsConnect?: boolean;
          source?: "user" | "env_demo";
        };
        if (cancelled) return;
        if (res.ok) {
          setGcalServerConfigured(true);
          setGcalNeedsConnect(false);
          if (data.source) setGcalSource(data.source);
          return;
        }
        if (res.status === 503 && data.needsConnect) {
          setGcalServerConfigured(true);
          setGcalNeedsConnect(true);
          return;
        }
        setGcalServerConfigured(false);
        setGcalNeedsConnect(false);
      } catch {
        if (!cancelled) setGcalServerConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, userId, authHeaders]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = p.get("google_calendar");
    if (g === "connected") {
      setGcalInfo(
        "Google Calendar connected. Use Load calendar to pull your events (same workload flow as Canvas due dates)."
      );
      setGcalNeedsConnect(false);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (g === "error" || g === "no_refresh") {
      setGcalError(
        g === "no_refresh"
          ? "Google did not return a refresh token. In Google Account → Security → Third-party access, remove MindBridge and try Connect again."
          : "Could not complete Google Calendar connection."
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function clearWorkloadCache() {
    try {
      sessionStorage.removeItem(STORAGE_ANALYSIS);
      sessionStorage.removeItem(STORAGE_WORKLOAD);
      sessionStorage.removeItem(STORAGE_SOURCE);
    } catch {
      /* ignore */
    }
    setAnalysis(null);
    setWorkloadContext(null);
    setWorkloadSource(null);
    setMessages([]);
    setWelcomeSet(false);
    setGcalError(null);
    setGcalInfo(null);
    setGcalSource(null);
    proactiveModalSuppressedSig.current = null;
    setShowProactiveModal(false);
  }

  // Restore cached analysis
  useEffect(() => {
    try {
      const a = sessionStorage.getItem(STORAGE_ANALYSIS);
      const w = sessionStorage.getItem(STORAGE_WORKLOAD);
      const s = sessionStorage.getItem(STORAGE_SOURCE) as WorkloadSource | null;
      if (a) setAnalysis(JSON.parse(a) as WorkloadAnalysis);
      if (w) setWorkloadContext(w);
      if (s === "canvas" || s === "demo" || s === "gcal") setWorkloadSource(s);
    } catch {
      /* ignore */
    }
  }, []);

  async function connectGoogleCalendar() {
    setGcalError(null);
    setGcalInfo(null);
    try {
      const res = await fetch("/api/google-calendar/oauth/start", {
        method: "POST",
        headers: { ...authHeaders() },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not start Google connect");
      }
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setGcalError(e instanceof Error ? e.message : "Connect failed");
    }
  }

  async function loadGoogleCalendar() {
    setGcalError(null);
    setGcalInfo(null);
    setGcalLoading(true);
    try {
      const res = await fetch("/api/google-calendar/events?days=14", {
        headers: { ...authHeaders() },
      });
      const data = (await res.json()) as {
        analysis?: WorkloadAnalysis;
        workloadContext?: string;
        error?: string;
        hint?: string;
        eventCount?: number;
        needsConnect?: boolean;
        source?: "user" | "env_demo";
      };
      if (res.status === 503) {
        if (data.needsConnect) {
          setGcalServerConfigured(true);
          setGcalNeedsConnect(true);
        } else {
          setGcalServerConfigured(false);
        }
        throw new Error(
          data.hint ||
            data.error ||
            "Google Calendar is not available. Check server env or connect your calendar."
        );
      }
      if (!res.ok) {
        throw new Error(data.hint || data.error || "Could not load calendar");
      }
      if (data.analysis && data.workloadContext) {
        setGcalServerConfigured(true);
        setGcalNeedsConnect(false);
        if (data.source) setGcalSource(data.source);
        if ((data.eventCount ?? 0) === 0) {
          setGcalInfo(
            "No events in the next 14 days on this calendar — add a few timed events, then load again (same idea as Canvas due dates)."
          );
        }
        setWorkloadSource("gcal");
        setWelcomeSet(false);
        setMessages([]);
        setAnalysis(data.analysis);
        setWorkloadContext(data.workloadContext);
        try {
          sessionStorage.setItem(
            STORAGE_ANALYSIS,
            JSON.stringify(data.analysis)
          );
          sessionStorage.setItem(STORAGE_WORKLOAD, data.workloadContext);
          sessionStorage.setItem(STORAGE_SOURCE, "gcal");
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setGcalError(e instanceof Error ? e.message : "Calendar load failed");
    } finally {
      setGcalLoading(false);
    }
  }

  // Optional: ?sync=1 with server Canvas token (LTI worker opens this URL server-side — not typical for iframe)
  useEffect(() => {
    const sync = new URLSearchParams(window.location.search).get("sync");
    if (sync !== "1") return;
    const run = async () => {
      try {
        const secret = new URLSearchParams(window.location.search).get("secret");
        const res = await fetch("/api/canvas/assignments", {
          headers: secret ? { "x-mindbridge-canvas-secret": secret } : {},
        });
        const data = await res.json();
        if (data.assignments && data.workloadContext) {
          setWorkloadSource("canvas");
          setWelcomeSet(false);
          setMessages([]);
          setAnalysis(data.analysis);
          setWorkloadContext(data.workloadContext);
        }
      } catch {
        /* ignore */
      }
    };
    run();
  }, []);

  // Welcome message when analysis ready
  useEffect(() => {
    if (!analysis || welcomeSet) return;
    setWelcomeSet(true);
    const line =
      workloadSource === "gcal"
        ? analysis.suggestProactiveCheckin
          ? "Hey — MindBridge is a private check-in spot. Your calendar shows a busy stretch ahead — how are you *actually* doing, not just academically?"
          : gcalSource === "user"
            ? "Hey — I’m MindBridge. I’m using your Google Calendar for upcoming events — same idea as Canvas due dates. How are you doing today?"
            : "Hey — I’m MindBridge. I’m using Google Calendar for upcoming events — same idea as Canvas due dates. How are you doing today?"
        : analysis.suggestProactiveCheckin
          ? "Hey — MindBridge is a private check-in spot (nothing here goes to your grades or instructors). It looks like a lot is coming due — how are you *actually* doing, not just academically?"
          : "Hey — I’m MindBridge, a private check-in companion inside Canvas. Nothing you write is sent to instructors. How are you doing today?";
    setMessages([{ role: "assistant", content: line }]);
  }, [analysis, welcomeSet, workloadSource]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function handleSend(text: string) {
    if (!userId) return;
    const userMessage: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          message: text,
          userId,
          history: messages,
          workloadContext: workloadContext ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        response?: string;
        crisis?: boolean;
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setMessages([
        ...newHistory,
        { role: "assistant", content: data.response ?? "I'm here with you." },
      ]);
      if (data.crisis) setShowCrisis(true);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: "assistant",
          content:
            "I couldn’t reach the server just now. You’re still allowed to take a break. If you’re in crisis, call or text 988.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !userId) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-brand-600/70 p-4">
        Starting MindBridge…
      </div>
    );
  }

  return (
    <>
      {showCrisis && <CrisisOverlay onDismiss={() => setShowCrisis(false)} />}

      <ProactiveWorkloadModal
        open={showProactiveModal && !showCrisis}
        analysis={analysis}
        onDismiss={dismissProactiveModal}
        onCheckIn={engageProactiveModal}
      />

      {/* Floating launcher (when minimized) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label="Open MindBridge support check-in"
        >
          <BrandIcon size="embedButton" tone="inverse" />
          Support check-in
        </button>
      )}

      {open && (
        <div className="flex min-h-[min(520px,100vh)] flex-col rounded-none bg-brand-100 md:min-h-[480px] md:rounded-2xl">
          <header className="flex items-center justify-between bg-brand-100 px-4 py-3.5 backdrop-blur-sm">
            <div className="min-w-0 pr-2">
              <h1 className="font-display text-base font-medium tracking-tight text-brand-600">
                MindBridge
              </h1>
              <p className="mt-0.5 text-[11px] leading-snug text-brand-600/65">
                Private check-in · Not graded · Not shared with instructors
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600/75 hover:bg-brand-200/70"
              >
                Minimize
              </button>
            </div>
          </header>

          {analysis && (
            <div className="bg-brand-200/50 px-4 py-3">
              <p className="text-xs font-semibold text-brand-600/80">
                {workloadSource === "gcal"
                  ? gcalSource === "user"
                    ? "From your Google Calendar"
                    : "From Google Calendar (shared demo server)"
                  : workloadSource === "demo"
                    ? "Demo workload (simulated)"
                    : workloadSource === "canvas"
                      ? "From your Canvas due dates (this week)"
                      : "Workload summary"}
              </p>
              <p className="mt-1 text-sm leading-snug text-brand-600/90">
                {analysis.headline}
              </p>
              <p className="mt-1.5 text-[11px] text-brand-600/55">
                Next 48h: {analysis.dueNext48h} · Next 7 days: {analysis.dueNext7d}{" "}
                · Tracked items: {analysis.totalTracked}
              </p>
              {gcalSource === "env_demo" && (
                <p className="mt-1.5 text-[10px] leading-snug text-brand-600/50">
                  This session uses a <strong className="text-brand-600/70">shared demo</strong>{" "}
                  Google account from the server — same workload logic as Canvas due dates.
                  Sign in and connect your own calendar for personal events.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 border-t border-brand-600/10 pt-2">
                {gcalNeedsConnect && (
                  <button
                    type="button"
                    onClick={() => void connectGoogleCalendar()}
                    className="rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-brand-600 hover:bg-accent/25"
                  >
                    Connect Google Calendar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadGoogleCalendar()}
                  disabled={gcalLoading || gcalNeedsConnect}
                  className="rounded-lg border border-brand-600/20 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-brand-600 hover:bg-brand-200/40 disabled:opacity-50"
                >
                  {gcalLoading
                    ? "Loading…"
                    : gcalNeedsConnect
                      ? "Load calendar (connect first)"
                      : gcalSource === "user"
                        ? "Reload my calendar"
                        : "Reload Google Calendar"}
                </button>
                <button
                  type="button"
                  onClick={clearWorkloadCache}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-medium text-brand-600/70 underline-offset-2 hover:text-brand-600 hover:underline"
                >
                  Reset workload source
                </button>
              </div>
              {gcalError && (
                <p className="mt-1.5 text-[11px] text-rose-700" role="alert">
                  {gcalError}
                </p>
              )}
              {gcalInfo && workloadSource === "gcal" && (
                <p className="mt-1.5 text-[11px] text-brand-600/75" role="status">
                  {gcalInfo}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
            {!analysis && (
              <div className="mb-2 space-y-3 rounded-xl bg-brand-200/50 p-3 text-xs text-brand-600">
                <p className="text-xs font-semibold text-brand-600">
                  No workload signal yet
                </p>
                <p className="text-brand-600/85 leading-relaxed">
                  With Canvas, due dates load automatically (LTI). Without school
                  Canvas access, connect <strong>your Google Calendar</strong> — it
                  feeds the same workload + check-in flow as Canvas assignments.
                </p>
                {gcalServerConfigured === false && (
                  <p className="rounded-lg bg-amber-100/90 px-2 py-1.5 text-[11px] text-amber-950/90">
                    Google OAuth isn&apos;t configured on the server yet. Add{" "}
                    <code className="rounded bg-white/60 px-1">GOOGLE_CLIENT_ID</code>{" "}
                    and <code className="rounded bg-white/60 px-1">GOOGLE_CLIENT_SECRET</code>{" "}
                    (see docs), set the OAuth redirect URI, then restart the dev server.
                  </p>
                )}
                {gcalNeedsConnect && gcalServerConfigured !== false && (
                  <p className="rounded-lg bg-brand-200/80 px-2 py-1.5 text-[11px] text-brand-600/90">
                    Connect Google Calendar once so we can read <strong>your</strong>{" "}
                    events (read-only). Then load the calendar below.
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => refreshContext(DEMO_CRUSHING_WEEK, "demo")}
                    className="btn-solid-cocina rounded-lg text-[11px] normal-case"
                  >
                    Simulate busy week
                  </button>
                  {gcalNeedsConnect && (
                    <button
                      type="button"
                      onClick={() => void connectGoogleCalendar()}
                      className="btn-solid-cocina rounded-lg text-[11px] normal-case"
                    >
                      Connect Google Calendar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void loadGoogleCalendar()}
                    disabled={gcalLoading || gcalNeedsConnect}
                    className="btn-outline-cocina rounded-lg text-[11px] normal-case disabled:opacity-50"
                  >
                    {gcalLoading
                      ? "Loading calendar…"
                      : gcalNeedsConnect
                        ? "Load calendar (connect first)"
                        : "Load my calendar"}
                  </button>
                </div>
                <a
                  href="/docs/GOOGLE_CALENDAR_DEMO.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[11px] font-semibold text-accent underline underline-offset-2"
                >
                  Google Calendar setup (one-time)
                </a>
                {gcalError && (
                  <p className="text-[11px] text-rose-700" role="alert">
                    {gcalError}
                  </p>
                )}
                {gcalInfo && (
                  <p className="text-[11px] text-brand-600/80" role="status">
                    {gcalInfo}
                  </p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 max-h-[340px]">
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
              {loading && (
                <div className="flex justify-start mb-3">
                  <div className="mr-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center">
                    <BrandIcon size="chat" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-brand-200/55 px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent/40 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent/40 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent/40 [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="mt-2 pt-2">
              <CheckInInput onSend={handleSend} loading={loading} />
            </div>

            <div className="mt-2 flex flex-wrap gap-2 justify-center">
              <Link
                href="/patterns"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium text-brand-600 underline"
              >
                Open patterns & impact (new tab)
              </Link>
              <span className="text-[10px] text-brand-600/25">|</span>
              <Link
                href="/resources"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium text-brand-600 underline"
              >
                Resources
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
