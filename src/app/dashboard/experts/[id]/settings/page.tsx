"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const COMMON_TIMEZONES = [
  "UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Sao_Paulo","Europe/London","Europe/Berlin","Europe/Paris","Europe/Amsterdam",
  "Europe/Moscow","Asia/Dubai","Asia/Kolkata","Asia/Shanghai","Asia/Tokyo","Asia/Seoul",
  "Australia/Sydney","Pacific/Auckland",
];

function getTimezones(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone");
    } catch { /* fallback */ }
  }
  return COMMON_TIMEZONES;
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ExpertData {
  id: string;
  name: string;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  availableDays: string | null;
  tagline: string | null;
  taglineEnabled: boolean;
}

export default function ExpertSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [expert, setExpert] = useState<ExpertData | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [tagline, setTagline] = useState("");
  const [taglineEnabled, setTaglineEnabled] = useState(false);
  const [availEnabled, setAvailEnabled] = useState(false);
  const [availFrom, setAvailFrom] = useState("09:00");
  const [availUntil, setAvailUntil] = useState("18:00");
  const [availDays, setAvailDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const timezones = getTimezones();

  useEffect(() => {
    fetch(`/api/experts/${params.id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(({ expert: p }: { expert: ExpertData }) => {
        setExpert(p);
        setTimezone(p.timezone || "UTC");
        setTagline(p.tagline || "");
        setTaglineEnabled(p.taglineEnabled ?? false);
        const hasAvail = !!(p.quietHoursStart || p.quietHoursEnd || p.availableDays);
        setAvailEnabled(hasAvail);
        setAvailFrom(p.quietHoursStart || "09:00");
        setAvailUntil(p.quietHoursEnd || "18:00");
        setAvailDays(p.availableDays ? p.availableDays.split(",").map(Number) : [1, 2, 3, 4, 5]);
      })
      .catch(() => router.push("/dashboard/experts"));
  }, [params.id, router]);

  const toggleDay = (d: number) =>
    setAvailDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/experts/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone,
        tagline,
        taglineEnabled,
        quietHoursStart: availEnabled ? availFrom : null,
        quietHoursEnd: availEnabled ? availUntil : null,
        availableDays: availEnabled ? availDays.sort((a, b) => a - b).join(",") : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (!expert) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/experts")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Experts
        </button>
        <h1 className="text-2xl font-semibold text-foreground">{expert.name} — Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Timezone */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-foreground">Timezone</h2>
          <p className="mb-3 text-xs text-muted-foreground">Used for availability scheduling and display.</p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-sm rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
          >
            {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        {/* Availability */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Availability</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set when you&apos;re available to receive messages. Requests outside this window are queued.
              </p>
            </div>
            {/* Big visible toggle */}
            <button
              type="button"
              onClick={() => setAvailEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                availEnabled ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
              }`}
              aria-pressed={availEnabled}
            >
              <span className="sr-only">{availEnabled ? "Enabled" : "Disabled"}</span>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${availEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {availEnabled && (
            <div className="space-y-4">
              {/* Time range */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Hours</p>
                <div className="flex items-center gap-3">
                  <input type="time" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-orange-500" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <input type="time" value={availUntil} onChange={(e) => setAvailUntil(e.target.value)}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-orange-500" />
                </div>
              </div>

              {/* Weekday chips */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Days</p>
                <div className="flex gap-1.5">
                  {DAYS_SHORT.map((label, i) => {
                    const active = availDays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`flex h-9 w-10 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                          active
                            ? "bg-orange-600 text-white"
                            : "border border-border bg-card text-muted-foreground hover:border-orange-400 hover:text-foreground"
                        }`}
                      >
                        {label.slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-muted-foreground">
                Available{" "}
                <span className="font-medium text-foreground">
                  {availDays.length === 0
                    ? "no days"
                    : availDays.sort((a, b) => a - b).map((d) => DAYS_SHORT[d]).join(", ")}
                </span>
                {" "}from{" "}
                <span className="font-medium text-foreground">{availFrom}</span>
                {" "}to{" "}
                <span className="font-medium text-foreground">{availUntil}</span>
                {" "}({timezone})
              </p>
            </div>
          )}
        </div>

        {/* Response Tagline */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Response Tagline</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Optionally append a tagline to your responses (max 160 chars).</p>
            </div>
            <button
              type="button"
              onClick={() => setTaglineEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${taglineEnabled ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"}`}
              aria-pressed={taglineEnabled}
            >
              <span className="sr-only">{taglineEnabled ? "Enabled" : "Disabled"}</span>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${taglineEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <input
            type="text"
            maxLength={160}
            placeholder="e.g. Powered by HeySummon · https://heysummon.ai"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            disabled={!taglineEnabled}
            className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring disabled:bg-muted disabled:text-muted-foreground"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{tagline.length}/160</p>
          {taglineEnabled && tagline && (
            <div className="mt-3 rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Preview:</span>
              <pre className="mt-1 whitespace-pre-wrap font-sans">Your response here…{"\n\n---\n"}{tagline}</pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-sm text-green-600">Settings saved ✓</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
