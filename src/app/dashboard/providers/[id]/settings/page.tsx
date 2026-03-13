"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function getTimezones(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      return (
        Intl as unknown as { supportedValuesOf: (key: string) => string[] }
      ).supportedValuesOf("timeZone");
    } catch {
      // fallback
    }
  }
  return COMMON_TIMEZONES;
}

interface ProviderData {
  id: string;
  name: string;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  tagline: string | null;
  taglineEnabled: boolean;
}

export default function ProviderSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [tagline, setTagline] = useState("");
  const [taglineEnabled, setTaglineEnabled] = useState(false);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const timezones = getTimezones();

  useEffect(() => {
    fetch(`/api/providers/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(({ provider: p }: { provider: ProviderData }) => {
        setProvider(p);
        setTimezone(p.timezone || "UTC");
        setTagline(p.tagline || "");
        setTaglineEnabled(p.taglineEnabled ?? false);
        if (p.quietHoursStart && p.quietHoursEnd) {
          setQuietEnabled(true);
          setQuietStart(p.quietHoursStart);
          setQuietEnd(p.quietHoursEnd);
        }
      })
      .catch(() => router.push("/dashboard/providers"));
  }, [params.id, router]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const body: Record<string, unknown> = {
      timezone,
      tagline,
      taglineEnabled,
      quietHoursStart: quietEnabled ? quietStart : null,
      quietHoursEnd: quietEnabled ? quietEnd : null,
    };

    const res = await fetch(`/api/providers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  if (!provider) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/providers")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Providers
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          {provider.name} — Settings
        </h1>
      </div>

      <div className="space-y-6">
        {/* Timezone */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-foreground">Timezone</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Used for quiet hours scheduling and display.
          </p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-sm rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Quiet Hours */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Don&apos;t bother me</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                When active, new requests are queued and not delivered until outside these hours.
                The polling watcher also backs off during this window.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuietEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                quietEnabled ? "bg-black" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow ring-0 transition duration-200 ${
                  quietEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {quietEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">From</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                />
              </div>
              <span className="mt-5 text-xs text-muted-foreground">until</span>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Until</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                />
              </div>
            </div>
          )}

          {quietEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">
              Requests received between <span className="font-medium text-foreground">{quietStart}</span> and{" "}
              <span className="font-medium text-foreground">{quietEnd}</span> ({timezone}) will be held and delivered when your quiet window ends.
            </p>
          )}
        </div>

        {/* Response Tagline */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Response Tagline</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optionally append a tagline to your responses (max 160 chars).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTaglineEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                taglineEnabled ? "bg-black" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow ring-0 transition duration-200 ${
                  taglineEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
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
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Settings saved ✓</span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
