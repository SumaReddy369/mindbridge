"use client";

/** Must stay in sync with app/api/user/route.ts ALLOWED_INTERESTS */
export const CHECKIN_INTEREST_OPTIONS: {
  id: string;
  label: string;
  hint: string;
}[] = [
  { id: "academic", label: "Academic workload", hint: "Classes, deadlines, grades" },
  { id: "sleep", label: "Sleep & energy", hint: "Rest, fatigue" },
  { id: "stress", label: "Stress & overwhelm", hint: "Pressure, anxiety" },
  { id: "social", label: "Social & belonging", hint: "Friends, community" },
  { id: "loneliness", label: "Loneliness", hint: "Isolation, connection" },
  { id: "family", label: "Family", hint: "Home life" },
  { id: "health", label: "Physical health", hint: "Body, illness, movement" },
  { id: "career", label: "Career / future", hint: "Jobs, plans" },
  { id: "identity", label: "Identity", hint: "Who you are, values" },
  { id: "financial", label: "Financial stress", hint: "Money, work" },
];

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export default function CheckInInterestsPicker({
  value,
  onChange,
  disabled = false,
}: Props) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-600/50">
        What should check-ins lean toward? (optional)
      </p>
      <p className="text-sm text-brand-600/65 leading-relaxed">
        Pick what matters right now — MindBridge can tune reminders and tone.
        You can change this anytime.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {CHECKIN_INTEREST_OPTIONS.map((opt) => {
          const on = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              title={opt.hint}
              onClick={() => toggle(opt.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? "border-accent bg-accent/15 text-brand-600"
                  : "border-brand-600/15 bg-white/80 text-brand-600/80 hover:border-brand-600/25"
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
