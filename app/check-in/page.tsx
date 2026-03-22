"use client";

import { useState, useEffect, useRef } from "react";
import ChatBubble from "@/components/ChatBubble";
import CheckInInput from "@/components/CheckInInput";
import CrisisOverlay from "@/components/CrisisOverlay";
import ResourceLinks from "@/components/ResourceLinks";
import JudgeTourBanner from "@/components/JudgeTourBanner";
import BrandIcon from "@/components/BrandIcon";
import { useMindBridgeUser } from "@/hooks/useMindBridgeUser";
import { ChatMessage, Checkin, Resource } from "@/types";
import { getResourcesForTags } from "@/lib/resources";

const FALLBACK_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hey — glad you're here. How are you doing today? No right answer, just whatever's on your mind.",
};

export default function CheckInPage() {
  const { userId, ready, isJudgeDemo, authHeaders, startFreshSession } =
    useMindBridgeUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [checkinCount, setCheckinCount] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [sessionId] = useState(() =>
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const fetchedInitialRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Fetch initial prompt on mount
  useEffect(() => {
    if (!ready || !userId || fetchedInitialRef.current) return;
    fetchedInitialRef.current = true;

    async function fetchGreeting() {
      setLoading(true);
      try {
        const res = await fetch("/api/chat/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ userId, sessionId }),
        });
        
        const data = await res.json();
        setMessages([
          {
            role: "assistant",
            content: data.response || FALLBACK_MESSAGE.content,
          },
        ]);
      } catch (err) {
        console.error("Failed to fetch initial greeting", err);
        setMessages([FALLBACK_MESSAGE]);
      } finally {
        setLoading(false);
      }
    }

    fetchGreeting();
  }, [ready, userId, authHeaders, sessionId]);

  async function handleSend(text: string) {
    if (!userId) return;
    const userMessage: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setLoading(true);
    setResources([]);
    setApiError(null);

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
          sessionId,
          history: messages,
        }),
      });

      const data = (await res.json()) as {
        response?: string;
        checkin?: Checkin;
        crisis?: boolean;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error || "Request failed");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response ?? "I'm here with you.",
      };

      setMessages([...newHistory, assistantMessage]);
      setCheckinCount((n) => n + 1);

      if (data.crisis) {
        setShowCrisis(true);
      }

      if (data.checkin?.tags?.length) {
        const matched = getResourcesForTags(data.checkin.tags);
        setResources(matched);
      }
    } catch (err) {
      console.error(err);
      setApiError("Something went wrong. Your message may not have been saved.");
      setMessages([
        ...newHistory,
        {
          role: "assistant",
          content:
            "Sorry — I couldn't reach the server just now. Take a breath; you can try again in a moment. If you're in crisis, call or text 988.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !userId) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-brand-600/55 uppercase tracking-wide">
        Securing your session…
      </div>
    );
  }

  return (
    <>
      {showCrisis && (
        <CrisisOverlay onDismiss={() => setShowCrisis(false)} />
      )}

      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {isJudgeDemo && (
          <div className="pb-3">
            <JudgeTourBanner onExit={startFreshSession} />
          </div>
        )}

        <div className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-brand-600 uppercase tracking-wide">Check-in</h1>
              <p className="text-sm text-brand-600/55">
                Private •{" "}
                {checkinCount > 0
                  ? `${checkinCount} saved this session`
                  : "Not yet saved this session"}
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center" aria-hidden>
              <BrandIcon size="chat" />
            </span>
          </div>
          {apiError && (
            <p className="mt-2 rounded-lg bg-brand-200/50 px-2 py-1.5 text-xs text-brand-600 normal-case">
              {apiError}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-1">
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

          {resources.length > 0 && !loading && (
            <div className="px-1 pt-2">
              <ResourceLinks resources={resources} compact />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="pt-3 pb-1">
          <CheckInInput onSend={handleSend} loading={loading} />
          <p className="text-[10px] text-center text-brand-600/45 mt-2 uppercase tracking-wide">
            Your words stay in MindBridge — not Canvas, not your instructors.
          </p>
        </div>
      </div>
    </>
  );
}
