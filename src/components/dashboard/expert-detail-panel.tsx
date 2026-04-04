"use client";

import { useEffect, useState, useCallback } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import {
  Copy, Check, Loader2, Trash2,
  Power, PowerOff, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Timezone helpers ─────────────────────────────────────────────────────────

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

// ── Day chips ────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Interfaces ───────────────────────────────────────────────────────────────

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface LinkedClient {
  id: string;
  name: string | null;
  clientChannel: string | null;
  clientSubChannel: string | null;
}

interface ExpertChannel {
  id: string;
  type: string;
  name: string;
  status: string;
  config: string;
}

interface VoiceIntegration {
  id: string;
  type: string;
  name: string;
  category: string;
  isActive: boolean;
}

interface ExpertIntConfig {
  id: string;
  integrationId: string;
  config: string;
  integration: VoiceIntegration;
}

interface ExpertProfile {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  availableDays: string | null;
  phoneFirst: boolean;
  phoneFirstIntegrationId: string | null;
  phoneFirstTimeout: number;
  ipEvents: IpEvent[];
  expertChannels: ExpertChannel[];
  _count: { apiKeys: number };
  apiKeys: LinkedClient[];
}

// ── Status / channel helpers (same as experts page) ────────────────────────

function getExpertStatus(
  p: ExpertProfile,
  tunnelAccessible: boolean | null,
): { label: string; colorClass: string } {
  if (!p.isActive)
    return { label: "Inactive", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };

  const webhookCh = p.expertChannels?.find((c) => c.type === "telegram" || c.type === "slack");
  if (webhookCh) {
    if (webhookCh.status === "connected" && tunnelAccessible === false) {
      return { label: "Unreachable", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    }
    return webhookCh.status === "connected"
      ? { label: "Connected", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "Not connected", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  if (p.expertChannels?.length > 0) {
    const hasBound = p.ipEvents?.some((e) => e.status === "allowed");
    return hasBound
      ? { label: "Bound", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "No binding yet", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  return { label: "\u2014", colorClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function channelBadge(channel: ExpertChannel): { label: string; color: string } {
  if (channel.type === "telegram")
    return { label: "Telegram Bot", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  if (channel.type === "slack")
    return { label: "Slack", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" };
  if (channel.type === "openclaw")
    return { label: "OpenClaw", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" };
  return { label: channel.type, color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function clientChannelLabel(channel: string | null, sub: string | null): string | null {
  if (!channel) return null;
  if (channel === "claudecode") return "Claude Code";
  if (channel === "openclaw" && sub === "whatsapp") return "OpenClaw \u00b7 WhatsApp";
  if (channel === "openclaw") return "OpenClaw \u00b7 Telegram";
  return channel;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExpertDetailPanel({
  expertId,
  onClose,
  onDeleted,
  onUpdated,
  tunnelAccessible = null,
}: {
  expertId: string;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
  tunnelAccessible?: boolean | null;
}) {
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Name editing
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Timezone
  const [timezone, setTimezone] = useState("UTC");
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [timezoneSaved, setTimezoneSaved] = useState(false);

  // Availability
  const [availEnabled, setAvailEnabled] = useState(false);
  const [availFrom, setAvailFrom] = useState("09:00");
  const [availUntil, setAvailUntil] = useState("18:00");
  const [availDays, setAvailDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingAvail, setSavingAvail] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  // Phone-first
  const [phoneFirst, setPhoneFirst] = useState(false);
  const [phoneIntegrationId, setPhoneIntegrationId] = useState<string | null>(null);
  const [phoneTimeout, setPhoneTimeout] = useState(30);
  const [voiceIntegrations, setVoiceIntegrations] = useState<VoiceIntegration[]>([]);
  const [expertIntConfigs, setExpertIntConfigs] = useState<ExpertIntConfig[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // General
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);

  const timezones = getTimezones();

  const fetchExpert = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/experts");
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    const found: ExpertProfile | undefined = (data.experts || []).find(
      (p: ExpertProfile) => p.id === expertId
    );
    if (found) {
      setExpert(found);
      setName(found.name);
      setTimezone(found.timezone || "UTC");
      const hasAvail = !!(found.quietHoursStart || found.quietHoursEnd || found.availableDays);
      setAvailEnabled(hasAvail);
      setAvailFrom(found.quietHoursStart || "09:00");
      setAvailUntil(found.quietHoursEnd || "18:00");
      setAvailDays(found.availableDays ? found.availableDays.split(",").map(Number) : [1, 2, 3, 4, 5]);
      setPhoneFirst(found.phoneFirst || false);
      setPhoneIntegrationId(found.phoneFirstIntegrationId || null);
      setPhoneTimeout(found.phoneFirstTimeout || 30);
    }

    // Load voice integrations
    const intRes = await fetch("/api/integrations");
    if (intRes.ok) {
      const intData = await intRes.json();
      setVoiceIntegrations(
        (intData.integrations || []).filter(
          (i: VoiceIntegration) => i.category === "voice" && i.isActive
        )
      );
    }

    // Load expert integration configs
    const cfgRes = await fetch(`/api/integrations/expert-config?profileId=${expertId}`);
    if (cfgRes.ok) {
      const cfgData = await cfgRes.json();
      setExpertIntConfigs(cfgData.configs || []);
      // Pre-fill phone config from existing expert integration config
      const existingCfg = (cfgData.configs || []).find(
        (c: ExpertIntConfig) => c.integration.category === "voice"
      );
      if (existingCfg) {
        try {
          const parsed = JSON.parse(existingCfg.config);
          setPhoneNumber(parsed.phoneNumber || "");
          setTwilioPhoneNumber(parsed.twilioPhoneNumber || "");
        } catch { /* ignore */ }
      }
    }

    setLoading(false);
  }, [expertId]);

  useEffect(() => { fetchExpert(); }, [fetchExpert]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const copyVal = (val: string) => {
    copyToClipboard(val);
    setCopied(val);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) => key.slice(0, 12) + "\u2022".repeat(16) + key.slice(-4);

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    await fetch(`/api/experts/${expertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
    fetchExpert();
    onUpdated();
  };

  const saveTimezone = async (tz?: string) => {
    const value = tz ?? timezone;
    setSavingTimezone(true);
    await fetch(`/api/experts/${expertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: value }),
    });
    setSavingTimezone(false);
    setTimezoneSaved(true);
    setTimeout(() => setTimezoneSaved(false), 2000);
    fetchExpert();
    onUpdated();
  };

  const saveAvailability = async (overrides?: { enabled?: boolean; days?: number[] }) => {
    const enabled = overrides?.enabled ?? availEnabled;
    const days = overrides?.days ?? availDays;
    setSavingAvail(true);
    await fetch(`/api/experts/${expertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quietHoursStart: enabled ? availFrom : null,
        quietHoursEnd: enabled ? availUntil : null,
        availableDays: enabled ? days.sort((a, b) => a - b).join(",") : null,
      }),
    });
    setSavingAvail(false);
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2000);
    fetchExpert();
    onUpdated();
  };

  const savePhoneFirst = async (overrides?: { enabled?: boolean; integrationId?: string | null }) => {
    const enabled = overrides?.enabled ?? phoneFirst;
    const intId = overrides?.integrationId ?? phoneIntegrationId;

    setSavingPhone(true);
    setPhoneError(null);

    // If enabling phone-first, we need an integration selected and phone config
    if (enabled && intId) {
      const cfgRes = await fetch("/api/integrations/expert-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: expertId,
          integrationId: intId,
          config: {
            phoneNumber: phoneNumber.trim(),
            twilioPhoneNumber: twilioPhoneNumber.trim(),
          },
        }),
      });
      if (!cfgRes.ok) {
        const data = await cfgRes.json();
        setPhoneError(data.error || "Failed to save phone configuration");
        setSavingPhone(false);
        return;
      }
    }

    // Save phone-first settings on the profile
    await fetch(`/api/experts/${expertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneFirst: enabled,
        phoneFirstIntegrationId: enabled ? intId : null,
        phoneFirstTimeout: phoneTimeout,
      }),
    });

    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2000);
    fetchExpert();
    onUpdated();
  };

  const toggleActive = async () => {
    setToggling(true);
    await fetch(`/api/experts/${expertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !expert?.isActive }),
    });
    setToggling(false);
    fetchExpert();
    onUpdated();
  };

  const deleteExpert = async () => {
    const res = await fetch(`/api/experts/${expertId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  const unlinkClient = async (keyId: string) => {
    await fetch(`/api/v1/keys/${keyId}/unlink`, { method: "POST" });
    fetchExpert();
    onUpdated();
  };

  const updateIpEvent = async (eventId: string, status: string) => {
    await fetch(`/api/experts/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchExpert();
  };

  const removeIpEvent = async (eventId: string) => {
    await fetch(`/api/experts/ip-events/${eventId}`, { method: "DELETE" });
    fetchExpert();
  };

  const toggleDay = (d: number) => {
    const newDays = availDays.includes(d) ? availDays.filter((x) => x !== d) : [...availDays, d];
    setAvailDays(newDays);
    saveAvailability({ days: newDays });
  };

  // ── Loading / not found ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!expert) {
    return <p className="p-6 text-sm text-muted-foreground">Expert not found.</p>;
  }

  const status = getExpertStatus(expert, tunnelAccessible);

  // Suppress unused variable warning — onClose is called by the parent shell
  void onClose;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-6 pb-8">

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {expert.expertChannels?.length > 0 && (() => {
            const ch = channelBadge(expert.expertChannels[0]);
            return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span>;
          })()}
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.colorClass}`}>{status.label}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={toggling}>
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : expert.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{expert.isActive ? "Deactivate" : "Activate"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* ── Expert name ────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Expert name</h3>
            {savingName && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {nameSaved && <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }} placeholder="e.g. Thomas -- Support" />
          </div>
        </div>

        {/* ── Expert key ─────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Expert key</h3>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
            <code className="flex-1 truncate font-mono text-xs text-foreground">{masked(expert.key)}</code>
            <Button variant="ghost" size="sm" onClick={() => copyVal(expert.key)}>
              {copied === expert.key ? <><Check className="mr-1.5 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>
        </div>

        {/* ── Timezone ─────────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Timezone</h3>
            {savingTimezone && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {timezoneSaved && <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Timezone</Label>
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); saveTimezone(e.target.value); }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        {/* ── Availability ─────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-semibold text-foreground">Availability</h3>
              {savingAvail && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {availSaved && <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
            </div>
            <button
              type="button"
              onClick={() => { const next = !availEnabled; setAvailEnabled(next); saveAvailability({ enabled: next }); }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                availEnabled ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
              }`}
              aria-pressed={availEnabled}
            >
              <span className="sr-only">{availEnabled ? "Enabled" : "Disabled"}</span>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${availEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Set when you are available to receive help requests.</p>

          {availEnabled && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Hours</Label>
                <div className="flex items-center gap-3">
                  <Input type="time" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} onBlur={() => saveAvailability()} className="w-32" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="time" value={availUntil} onChange={(e) => setAvailUntil(e.target.value)} onBlur={() => saveAvailability()} className="w-32" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Days</Label>
                <div className="flex gap-1.5">
                  {DAYS_SHORT.map((label, i) => {
                    const active = availDays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`flex h-9 w-10 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                          active ? "bg-orange-600 text-white" : "border border-border bg-background text-muted-foreground hover:border-orange-400 hover:text-foreground"
                        }`}
                      >
                        {label.slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Phone-first ──────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-semibold text-foreground">Phone first</h3>
              {savingPhone && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {phoneSaved && <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
            </div>
            <button
              type="button"
              onClick={() => { const next = !phoneFirst; setPhoneFirst(next); savePhoneFirst({ enabled: next }); }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                phoneFirst ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
              }`}
              aria-pressed={phoneFirst}
            >
              <span className="sr-only">{phoneFirst ? "Enabled" : "Disabled"}</span>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${phoneFirst ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            When enabled, incoming help requests will first attempt to reach this expert via phone call.
            If the call is not answered, the request falls back to the configured chat channel.
          </p>

          {phoneFirst && (
            <div className="space-y-4">
              {voiceIntegrations.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No voice integrations configured. Go to Integrations to set up Twilio first.
                </p>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Voice integration</Label>
                    <select
                      value={phoneIntegrationId || ""}
                      onChange={(e) => { const val = e.target.value || null; setPhoneIntegrationId(val); savePhoneFirst({ integrationId: val }); }}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    >
                      <option value="">Select integration...</option>
                      {voiceIntegrations.map((vi) => (
                        <option key={vi.id} value={vi.id}>{vi.name}</option>
                      ))}
                    </select>
                  </div>

                  {phoneIntegrationId && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          Expert phone number (E.164)
                        </Label>
                        <Input
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          onBlur={() => savePhoneFirst()}
                          placeholder="+31612345678"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          Twilio phone number (FROM)
                        </Label>
                        <Input
                          value={twilioPhoneNumber}
                          onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                          onBlur={() => savePhoneFirst()}
                          placeholder="+15551234567"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          Call timeout (seconds)
                        </Label>
                        <Input
                          type="number"
                          min={10}
                          max={120}
                          value={phoneTimeout}
                          onChange={(e) => setPhoneTimeout(parseInt(e.target.value) || 30)}
                          onBlur={() => savePhoneFirst()}
                          className="w-32"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          How long to ring before falling back to chat (10-120 seconds).
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
            </div>
          )}
        </div>

        {/* ── Linked clients ───────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">
            Linked clients <span className="text-muted-foreground font-normal text-sm">({expert.apiKeys?.length ?? 0})</span>
          </h3>
          {!expert.apiKeys?.length ? (
            <p className="text-sm text-muted-foreground">No clients linked to this expert.</p>
          ) : (
            <div className="space-y-2">
              {expert.apiKeys.map((client) => {
                const chLabel = clientChannelLabel(client.clientChannel, client.clientSubChannel);
                return (
                  <div key={client.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{client.name || "Unnamed"}</span>
                      {chLabel && <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{chLabel}</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Unlink "${client.name || "Unnamed"}" from this expert?`)) unlinkClient(client.id); }}>
                      <Unlink className="mr-1.5 h-3.5 w-3.5" />
                      Unlink
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── IP bindings ──────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">IP bindings</h3>
            {expert.ipEvents?.length > 0 && (
              <Button variant="outline" size="sm" onClick={async () => {
                if (!window.confirm("Reset all IP bindings for this expert?")) return;
                await Promise.all(expert.ipEvents.map((evt) => fetch(`/api/experts/ip-events/${evt.id}`, { method: "DELETE" })));
                fetchExpert();
              }}>
                Reset all
              </Button>
            )}
          </div>
          {!expert.ipEvents || expert.ipEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No IP bindings yet.</p>
          ) : (
            <div className="space-y-2">
              {expert.ipEvents.map((evt) => (
                <div key={evt.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sm text-foreground">{evt.ip}</code>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      evt.status === "allowed" ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                      : evt.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                    }`}>{evt.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{evt.attempts} attempts · {new Date(evt.lastSeen).toLocaleString()}</p>
                  <div className="mt-2 flex items-center gap-1">
                    {evt.status !== "allowed" && <Button variant="ghost" size="sm" onClick={() => updateIpEvent(evt.id, "allowed")}>Allow</Button>}
                    {evt.status !== "blacklisted" && <Button variant="ghost" size="sm" onClick={() => updateIpEvent(evt.id, "blacklisted")}>Blacklist</Button>}
                    <Button variant="ghost" size="sm" onClick={() => removeIpEvent(evt.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expert?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{expert.name}</strong> and unlink all connected clients. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await deleteExpert();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
