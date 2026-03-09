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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState("");

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
      })
      .catch(() => router.push("/dashboard/providers"));
  }, [params.id, router]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const body: Record<string, unknown> = { timezone, tagline, taglineEnabled };

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
            Used for scheduling and display.
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

        {/* Response Tagline */}
        <div className="rounded-lg border border-[#eaeaea] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-black">Response Tagline</h2>
              <p className="mt-0.5 text-xs text-[#666]">
                Optionally append a tagline to your responses (max 160 chars).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTaglineEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                taglineEnabled ? "bg-black" : "bg-[#eaeaea]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
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
            className="w-full rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black disabled:bg-[#f9f9f9] disabled:text-[#999]"
          />
          <p className="mt-1 text-right text-xs text-[#999]">{tagline.length}/160</p>
          {taglineEnabled && tagline && (
            <div className="mt-3 rounded-md border border-[#eaeaea] bg-[#f9f9f9] p-3 text-xs text-[#666]">
              <span className="font-medium text-black">Preview:</span>
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
