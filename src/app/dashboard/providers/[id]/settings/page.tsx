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
  digestTime: string | null;
}

interface EditionInfo {
  isCloud: boolean;
}

export default function ProviderSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [edition, setEdition] = useState<EditionInfo>({ isCloud: false });
  const [timezone, setTimezone] = useState("UTC");
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [digestTime, setDigestTime] = useState("08:00");
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState("");

  const timezones = getTimezones();

  useEffect(() => {
    fetch("/api/edition")
      .then((r) => r.json())
      .then((d) => setEdition(d))
      .catch(() => {});

    fetch(`/api/providers/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(({ provider: p }: { provider: ProviderData }) => {
        setProvider(p);
        setTimezone(p.timezone || "UTC");
        if (p.quietHoursStart) {
          setQuietEnabled(true);
          setQuietStart(p.quietHoursStart);
          setQuietEnd(p.quietHoursEnd || "08:00");
          setDigestTime(p.digestTime || "08:00");
        }
      })
      .catch(() => router.push("/dashboard/providers"));
  }, [params.id, router]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const body: Record<string, unknown> = { timezone };
    if (edition.isCloud) {
      body.quietHoursStart = quietEnabled ? quietStart : null;
      body.quietHoursEnd = quietEnabled ? quietEnd : null;
      body.digestTime = quietEnabled ? digestTime : null;
    }

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
      <div className="flex items-center justify-center py-12 text-sm text-[#666]">
        Loading…
      </div>
    );
  }

  const filteredTimezones = timezoneFilter
    ? timezones.filter((tz) =>
        tz.toLowerCase().includes(timezoneFilter.toLowerCase())
      )
    : timezones;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/providers")}
          className="text-sm text-[#666] hover:text-black"
        >
          ← Providers
        </button>
        <h1 className="text-2xl font-semibold text-black">
          {provider.name} — Settings
        </h1>
      </div>

      <div className="space-y-6">
        {/* Timezone — community */}
        <div className="rounded-lg border border-[#eaeaea] bg-white p-5">
          <h2 className="mb-1 text-sm font-medium text-black">Timezone</h2>
          <p className="mb-3 text-xs text-[#666]">
            Used for scheduling and display. Available in all editions.
          </p>
          <input
            type="text"
            placeholder="Filter timezones…"
            value={timezoneFilter}
            onChange={(e) => setTimezoneFilter(e.target.value)}
            className="mb-2 w-full max-w-sm rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
          />
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-sm rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
          >
            {filteredTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Quiet hours — cloud only */}
        <div
          className={`rounded-lg border border-[#eaeaea] bg-white p-5 ${
            !edition.isCloud ? "opacity-60" : ""
          }`}
        >
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-medium text-black">Quiet Hours</h2>
            {!edition.isCloud && (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                Cloud
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-[#666]">
            Suppress email notifications during these hours. Unanswered requests
            are bundled into a morning digest.
          </p>

          <label className="mb-3 flex items-center gap-2 text-sm text-black">
            <input
              type="checkbox"
              checked={quietEnabled}
              onChange={(e) => setQuietEnabled(e.target.checked)}
              disabled={!edition.isCloud}
              className="rounded"
            />
            Enable quiet hours
          </label>

          {quietEnabled && edition.isCloud && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#666]">From</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                />
                <label className="text-xs text-[#666]">To</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#666]">Digest at</label>
                <input
                  type="time"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                />
              </div>
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
