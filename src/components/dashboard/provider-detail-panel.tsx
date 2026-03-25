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

interface ChannelProvider {
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

interface ProviderIntConfig {
  id: string;
  integrationId: string;
  config: string;
  integration: VoiceIntegration;
}

interface Provider {
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
  channelProviders: ChannelProvider[];
  _count: { apiKeys: number };
  apiKeys: LinkedClient[];
}

// ── Status / channel helpers (same as providers page) ────────────────────────

function getProviderStatus(
  p: Provider,
  tunnelAccessible: boolean | null,
): { label: string; colorClass: string } {
  if (!p.isActive)
    return { label: "Inactive", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };

  const telegramCh = p.channelProviders?.find((c) => c.type === "telegram");
  if (telegramCh) {
    if (telegramCh.status === "connected" && tunnelAccessible === false) {
      return { label: "Unreachable", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    }
    return telegramCh.status === "connected"
      ? { label: "Connected", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "Not connected", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  if (p.channelProviders?.length > 0) {
    const hasBound = p.ipEvents?.some((e) => e.status === "allowed");
    return hasBound
      ? { label: "Bound", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "No binding yet", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  return { label: "\u2014", colorClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function channelBadge(channel: ChannelProvider): { label: string; color: string } {
  if (channel.type === "telegram")
    return { label: "Telegram Bot", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
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

export function ProviderDetailPanel({
  providerId,
  onClose,
  onDeleted,
  onUpdated,
  tunnelAccessible = null,
}: {
  providerId: string;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
  tunnelAccessible?: boolean | null;
}) {
  const [provider, setProvider] = useState<Provider | null>(null);
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
  const [providerIntConfigs, setProviderIntConfigs] = useState<ProviderIntConfig[]>([]);
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

  const fetchProvider = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/providers");
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    const found: Provider | undefined = (data.providers || []).find(
      (p: Provider) => p.id === providerId
    );
    if (found) {
      setProvider(found);
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

    // Load provider integration configs
    const cfgRes = await fetch(`/api/integrations/provider-config?profileId=${providerId}`);
    if (cfgRes.ok) {
      const cfgData = await cfgRes.json();
      setProviderIntConfigs(cfgData.configs || []);
      // Pre-fill phone config from existing provider integration config
      const existingCfg = (cfgData.configs || []).find(
        (c: ProviderIntConfig) => c.integration.category === "voice"
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
  }, [providerId]);

  useEffect(() => { fetchProvider(); }, [fetchProvider]);

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
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
    fetchProvider();
    onUpdated();
  };

  const saveTimezone = async () => {
    setSavingTimezone(true);
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    setSavingTimezone(false);
    setTimezoneSaved(true);
    setTimeout(() => setTimezoneSaved(false), 2000);
    fetchProvider();
    onUpdated();
  };

  const saveAvailability = async () => {
    setSavingAvail(true);
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quietHoursStart: availEnabled ? availFrom : null,
        quietHoursEnd: availEnabled ? availUntil : null,
        availableDays: availEnabled ? availDays.sort((a, b) => a - b).join(",") : null,
      }),
    });
    setSavingAvail(false);
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2000);
    fetchProvider();
    onUpdated();
  };

  const savePhoneFirst = async () => {
    setSavingPhone(true);
    setPhoneError(null);

    // If enabling phone-first, we need an integration selected and phone config
    if (phoneFirst && phoneIntegrationId) {
      // Save provider integration config (phone number etc.)
      const cfgRes = await fetch("/api/integrations/provider-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: providerId,
          integrationId: phoneIntegrationId,
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
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneFirst,
        phoneFirstIntegrationId: phoneFirst ? phoneIntegrationId : null,
        phoneFirstTimeout: phoneTimeout,
      }),
    });

    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2000);
    fetchProvider();
    onUpdated();
  };

  const toggleActive = async () => {
    setToggling(true);
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !provider?.isActive }),
    });
    setToggling(false);
    fetchProvider();
    onUpdated();
  };

  const deleteProvider = async () => {
    const res = await fetch(`/api/providers/${providerId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  const unlinkClient = async (keyId: string) => {
    await fetch(`/api/v1/keys/${keyId}/unlink`, { method: "POST" });
    fetchProvider();
    onUpdated();
  };

  const updateIpEvent = async (eventId: string, status: string) => {
    await fetch(`/api/providers/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProvider();
  };

  const removeIpEvent = async (eventId: string) => {
    await fetch(`/api/providers/ip-events/${eventId}`, { method: "DELETE" });
    fetchProvider();
  };

  const toggleDay = (d: number) =>
    setAvailDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  // ── Loading / not found ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!provider) {
    return <p className="p-6 text-sm text-muted-foreground">Provider not found.</p>;
  }

  const status = getProviderStatus(provider, tunnelAccessible);

  // Suppress unused variable warning — onClose is called by the parent shell
  void onClose;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-6 pb-8">

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {provider.channelProviders?.length > 0 && (() => {
            const ch = channelBadge(provider.channelProviders[0]);
            return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span>;
          })()}
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.colorClass}`}>{status.label}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={toggling}>
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : provider.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{provider.isActive ? "Deactivate" : "Activate"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* ── Provider name ────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Provider name</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} placeholder="e.g. Thomas — Support" />
            </div>
            <Button onClick={saveName} disabled={savingName} size="sm">
              {savingName && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {nameSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save"}
            </Button>
          </div>
        </div>

        {/* ── Provider key ─────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Provider key</h3>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
            <code className="flex-1 truncate font-mono text-xs text-foreground">{masked(provider.key)}</code>
            <Button variant="ghost" size="sm" onClick={() => copyVal(provider.key)}>
              {copied === provider.key ? <><Check className="mr-1.5 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>
        </div>

        {/* ── Timezone ─────────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">Timezone</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Timezone</Label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              >
                {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <Button onClick={saveTimezone} disabled={savingTimezone} size="sm">
              {savingTimezone && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {timezoneSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save"}
            </Button>
          </div>
        </div>

        {/* ── Availability ─────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Availability</h3>
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
          <p className="text-sm text-muted-foreground mb-4">Set when you are available to receive help requests.</p>

          {availEnabled && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Hours</Label>
                <div className="flex items-center gap-3">
                  <Input type="time" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} className="w-32" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="time" value={availUntil} onChange={(e) => setAvailUntil(e.target.value)} className="w-32" />
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

              <Button onClick={saveAvailability} disabled={savingAvail} size="sm">
                {savingAvail && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {availSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save availability"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Phone-first ──────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-foreground">Phone first</h3>
            <button
              type="button"
              onClick={() => setPhoneFirst((v) => !v)}
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
            When enabled, incoming help requests will first attempt to reach this provider via phone call.
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
                      onChange={(e) => setPhoneIntegrationId(e.target.value || null)}
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
                          Provider phone number (E.164)
                        </Label>
                        <Input
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
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

              <Button onClick={savePhoneFirst} disabled={savingPhone} size="sm">
                {savingPhone && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {phoneSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save phone settings"}
              </Button>
            </div>
          )}

          {!phoneFirst && (
            <Button onClick={savePhoneFirst} disabled={savingPhone} size="sm" variant="outline">
              {savingPhone && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {phoneSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save"}
            </Button>
          )}
        </div>

        {/* ── Linked clients ───────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">
            Linked clients <span className="text-muted-foreground font-normal text-sm">({provider.apiKeys?.length ?? 0})</span>
          </h3>
          {!provider.apiKeys?.length ? (
            <p className="text-sm text-muted-foreground">No clients linked to this provider.</p>
          ) : (
            <div className="space-y-2">
              {provider.apiKeys.map((client) => {
                const chLabel = clientChannelLabel(client.clientChannel, client.clientSubChannel);
                return (
                  <div key={client.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{client.name || "Unnamed"}</span>
                      {chLabel && <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{chLabel}</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Unlink "${client.name || "Unnamed"}" from this provider?`)) unlinkClient(client.id); }}>
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
            {provider.ipEvents?.length > 0 && (
              <Button variant="outline" size="sm" onClick={async () => {
                if (!window.confirm("Reset all IP bindings for this provider?")) return;
                await Promise.all(provider.ipEvents.map((evt) => fetch(`/api/providers/ip-events/${evt.id}`, { method: "DELETE" })));
                fetchProvider();
              }}>
                Reset all
              </Button>
            )}
          </div>
          {!provider.ipEvents || provider.ipEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No IP bindings yet.</p>
          ) : (
            <div className="space-y-2">
              {provider.ipEvents.map((evt) => (
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
            <AlertDialogTitle>Delete provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{provider.name}</strong> and unlink all connected clients. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await deleteProvider();
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
