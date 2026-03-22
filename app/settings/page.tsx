"use client";

import { useState, useEffect, useCallback } from "react";
import CheckInInterestsPicker from "@/components/CheckInInterestsPicker";
import FrequencyPicker from "@/components/FrequencyPicker";
import PageHeader from "@/components/PageHeader";
import {
  useMindBridgeUser,
  JUDGE_DEMO_FLAG,
  MIND_BRIDGE_USER_STORAGE_KEY,
} from "@/hooks/useMindBridgeUser";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function SettingsPage() {
  const {
    userId,
    ready,
    authHeaders,
    authEmail,
    authFullName,
    isAuthenticated,
    signOut,
  } = useMindBridgeUser();
  const [frequency, setFrequency] = useState(2);
  const [checkinInterests, setCheckinInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedInterests, setSavedInterests] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  function interestsStorageKey(uid: string) {
    return `mindbridge_checkin_interests_${uid}`;
  }

  const loadUser = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user?userId=${encodeURIComponent(userId)}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user?.frequency_days != null) {
          setFrequency(data.user.frequency_days);
        }
        const fromApi = data.user?.checkin_interests;
        if (Array.isArray(fromApi) && fromApi.length > 0) {
          setCheckinInterests(fromApi);
        } else {
          try {
            const raw = localStorage.getItem(interestsStorageKey(userId));
            const parsed = raw ? (JSON.parse(raw) as unknown) : null;
            if (Array.isArray(parsed)) {
              setCheckinInterests(parsed.filter((x) => typeof x === "string"));
            }
          } catch {
            /* ignore */
          }
        }
      } else if (res.status === 404) {
        setLoadError("Session not found — try starting a new check-in.");
      }
    } catch {
      setLoadError("Could not load settings.");
    }
  }, [userId, authHeaders]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadUser();
  }, [ready, userId, loadUser]);

  async function saveFrequency(days: number) {
    if (!userId) return;
    setFrequency(days);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ frequency_days: days }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveCheckinInterests(next: string[]) {
    if (!userId) return;
    setCheckinInterests(next);
    setSavingInterests(true);
    setSavedInterests(false);
    try {
      try {
        localStorage.setItem(
          interestsStorageKey(userId),
          JSON.stringify(next)
        );
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ checkin_interests: next }),
      });
      if (res.ok) {
        setSavedInterests(true);
        setTimeout(() => setSavedInterests(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingInterests(false);
    }
  }

  async function handleDelete() {
    if (!userId) return;
    setDeleting(true);
    try {
      await fetch("/api/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ userId }),
      });
      localStorage.removeItem(MIND_BRIDGE_USER_STORAGE_KEY);
      localStorage.removeItem(JUDGE_DEMO_FLAG);
      try {
        localStorage.removeItem(interestsStorageKey(userId));
      } catch {
        /* ignore */
      }
      await getSupabaseBrowserClient()?.auth.signOut();
      setDeleted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-brand-600/55">
        Loading…
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <div className="text-4xl" aria-hidden>
          🗑️
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-brand-600">
          All data deleted
        </h2>
        <p className="text-sm text-brand-600/60 max-w-xs normal-case">
          Everything is gone from this device&apos;s session. No undo.
        </p>
        <a
          href="/login"
          className="text-sm text-brand-600 hover:text-brand-700 underline"
        >
          Log in →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="You control everything here."
      />

      {loadError && (
        <p className="text-sm text-brand-600 bg-brand-200/50 rounded-xl px-3 py-2 normal-case">
          {loadError}
        </p>
      )}

      <div className="surface-card space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-brand-600">
            Check-in rhythm & focus
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-600/65">
            Choose how often you want nudges (every 2 or 3 days are common), or
            use <strong className="text-brand-600/85">Custom interval</strong> for
            any spacing from 1–30 days. Then pick optional focus areas below.
          </p>
        </div>
        <FrequencyPicker
          value={frequency}
          onChange={saveFrequency}
          disabled={saving}
        />
        {saved && (
          <p className="text-sm font-medium text-accent">✓ Frequency saved</p>
        )}

        <div className="border-t border-brand-600/10 pt-6 mt-6">
          <CheckInInterestsPicker
            value={checkinInterests}
            onChange={(next) => void saveCheckinInterests(next)}
            disabled={savingInterests}
          />
          {savedInterests && (
            <p className="mt-2 text-sm font-medium text-accent">
              ✓ Focus areas saved
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-brand-600/45">
            If you use cloud Supabase without a <code className="rounded bg-brand-200/50 px-1">checkin_interests</code> column yet, focus areas are also kept in this browser until your database is updated.
          </p>
        </div>
      </div>

      {isAuthenticated && authEmail && (
        <div className="surface-card space-y-3 border-t border-brand-600/10 pt-10">
          <h2 className="font-display text-base font-semibold tracking-tight text-brand-600">
            Account
          </h2>
          <p className="text-sm text-brand-600/80 normal-case">
            {authFullName && (
              <>
                <strong className="text-brand-600">{authFullName}</strong>
                <br />
              </>
            )}
            <span className="text-brand-600/70">{authEmail}</span>
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="btn-outline-cocina rounded-xl"
          >
            Sign out
          </button>
        </div>
      )}

      <div className="surface-card space-y-3 border-t border-brand-600/10 pt-10">
        <h2 className="font-display text-base font-semibold tracking-tight text-brand-600">
          Privacy
        </h2>
        <div className="space-y-2 text-sm text-brand-600/75 normal-case">
          <div className="flex items-start gap-3">
            <span className="text-base mt-0.5" aria-hidden>
              🔒
            </span>
            <span>
              Check-ins live in MindBridge&apos;s store — never in Canvas, never
              with instructors.
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-base mt-0.5" aria-hidden>
              👤
            </span>
            <span>
              Your check-ins and settings are tied to this account on this
              browser.
            </span>
          </div>
        </div>
      </div>

      <div className="surface-card mt-2 space-y-4 rounded-2xl border border-rose-400/45 p-6">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-brand-600">
            Delete all my data
          </h2>
          <p className="text-sm text-brand-600/60 mt-0.5 normal-case">
            Permanently removes check-ins, summaries, and follow-ups for this
            user. No undo.
          </p>
        </div>

        {!deleteConfirm ? (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="px-5 py-2.5 bg-brand-200/55 hover:bg-brand-200/80 text-rose-700 text-sm font-semibold rounded-xl transition-colors"
          >
            Delete everything
          </button>
        ) : (
          <div className="space-y-3 rounded-xl bg-rose-100/30 p-4">
            <p className="text-sm font-medium text-rose-800">
              Are you sure? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 rounded-lg bg-brand-200/55 py-2 text-sm font-medium text-brand-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="surface-card border-t border-brand-600/10 pt-8 text-xs leading-relaxed text-brand-600/85">
        <strong className="font-semibold text-brand-600">Production:</strong> Set{" "}
        <code className="rounded bg-brand-200/60 px-1 text-brand-600">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        and{" "}
        <code className="rounded bg-brand-200/60 px-1 text-brand-600">
          NEXT_PUBLIC_DEMO_MODE=false
        </code>{" "}
        for cloud persistence. See <code className="rounded bg-brand-200/60 px-1 text-brand-600">README.md</code>.
      </div>
    </div>
  );
}
