"use client";

import { useEffect, useState } from "react";

interface FrequencyPickerProps {
  value: number;
  onChange: (days: number) => void;
  disabled?: boolean;
}

const PRESET_MAX = 3;
const CUSTOM_MIN = 1;
const CUSTOM_MAX = 30;

const OPTIONS: {
  days: number;
  label: string;
  description: string;
  highlight?: "recommended" | "balanced";
}[] = [
  { days: 1, label: "Every day", description: "Short daily touchpoints" },
  {
    days: 2,
    label: "Every 2 days",
    description: "Steady rhythm — good default for most students",
    highlight: "recommended",
  },
  {
    days: 3,
    label: "Every 3 days",
    description: "Lighter touch — still regular",
    highlight: "balanced",
  },
];

function clampDays(n: number): number {
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Math.round(n)));
}

export default function FrequencyPicker({
  value,
  onChange,
  disabled = false,
}: FrequencyPickerProps) {
  const [customDraft, setCustomDraft] = useState("");

  const isCustomValue = value > PRESET_MAX;
  const presetMatches = value >= 1 && value <= PRESET_MAX;

  useEffect(() => {
    if (isCustomValue) {
      setCustomDraft(String(value));
    } else {
      setCustomDraft("");
    }
  }, [value, isCustomValue]);

  function applyCustom() {
    const raw = parseInt(customDraft, 10);
    if (Number.isNaN(raw)) return;
    onChange(clampDays(raw));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-600/50">
        Reminder cadence (used by the nudge / cron path)
      </p>
      {OPTIONS.map((opt) => {
        const selected = presetMatches && value === opt.days;
        return (
          <button
            key={opt.days}
            type="button"
            onClick={() => onChange(opt.days)}
            disabled={disabled}
            className={`flex items-center justify-between px-5 py-4 rounded-xl text-left transition-all ${
              selected
                ? "bg-brand-200/80 ring-1 ring-accent/30"
                : "bg-brand-200/35 hover:bg-brand-200/55"
            } disabled:opacity-50`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`text-sm font-semibold ${
                    selected ? "text-brand-600" : "text-brand-600/85"
                  }`}
                >
                  {opt.label}
                </p>
                {opt.highlight === "recommended" && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Recommended
                  </span>
                )}
                {opt.highlight === "balanced" && (
                  <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600/80">
                    Balanced
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-600/50 mt-0.5">{opt.description}</p>
            </div>
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                selected ? "bg-accent" : "bg-brand-200/90"
              }`}
            >
              {selected && (
                <div className="h-2 w-2 rounded-full bg-brand-50" />
              )}
            </div>
          </button>
        );
      })}

      {/* Custom interval (1–30 days) */}
      <div
        className={`rounded-xl px-5 py-4 text-left transition-all ${
          isCustomValue
            ? "bg-brand-200/80 ring-1 ring-accent/30"
            : "bg-brand-200/35"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-600">Custom interval</p>
            <p className="text-xs text-brand-600/50 mt-0.5">
              Set any reminder spacing from {CUSTOM_MIN}–{CUSTOM_MAX} days (e.g. 10 or 14).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="mindbridge-custom-frequency-days">
                Number of days between reminders
              </label>
              <span className="text-sm text-brand-600/80">Every</span>
              <input
                id="mindbridge-custom-frequency-days"
                type="number"
                min={CUSTOM_MIN}
                max={CUSTOM_MAX}
                inputMode="numeric"
                disabled={disabled}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                className="w-16 rounded-lg border border-brand-600/20 bg-white px-2 py-1.5 text-center text-sm font-semibold text-brand-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
              />
              <span className="text-sm text-brand-600/80">days</span>
              <button
                type="button"
                disabled={disabled}
                onClick={applyCustom}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              isCustomValue ? "bg-accent" : "bg-brand-200/90"
            }`}
            aria-hidden
          >
            {isCustomValue && (
              <div className="h-2 w-2 rounded-full bg-brand-50" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
