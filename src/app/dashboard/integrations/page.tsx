"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Plus, Trash2, Check, Phone, Mail, Zap } from "lucide-react";

interface Integration {
  id: string;
  type: string;
  category: string;
  name: string;
  isActive: boolean;
  config: string;
  createdAt: string;
  _count: { expertConfigs: number };
}

const INTEGRATION_TYPES = [
  {
    type: "twilio",
    label: "Twilio",
    category: "voice",
    categoryLabel: "Voice / Calling",
    description: "Enable phone-first notifications. Experts can receive help requests via phone calls and respond verbally.",
    icon: Phone,
  },
];

const COMING_SOON_INTEGRATIONS = [
  {
    label: "SendGrid",
    categoryLabel: "Email",
    description:
      "Send help requests via email for less urgent escalations. Universal fallback that reaches everyone.",
    icon: Mail,
  },
  {
    label: "Zapier",
    categoryLabel: "Workflow",
    description:
      "Connect HeySummon to thousands of apps without code. Automate escalation workflows effortlessly.",
    icon: Zap,
  },
];


function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formAccountSid, setFormAccountSid] = useState("");
  const [formAuthToken, setFormAuthToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadIntegrations = async () => {
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data = await res.json();
      setIntegrations(data.integrations || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const openCreate = (type: string) => {
    setCreateType(type);
    setFormName(INTEGRATION_TYPES.find((t) => t.type === type)?.label || "");
    setFormAccountSid("");
    setFormAuthToken("");
    setSaveError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!createType || !formName.trim()) return;
    setSaving(true);
    setSaveError(null);

    const config: Record<string, string> = {};
    if (createType === "twilio") {
      config.accountSid = formAccountSid.trim();
      config.authToken = formAuthToken.trim();
    }

    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: createType, name: formName.trim(), config }),
    });

    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error || "Failed to create integration");
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowCreate(false);
    loadIntegrations();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadIntegrations();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/integrations/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    loadIntegrations();
  };

  // Which types are already created
  const existingTypes = new Set(integrations.map((i) => i.type));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect external services to extend expert capabilities.
          </p>
        </div>
      </div>

      {/* Available integrations */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Available integrations</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATION_TYPES.map((intType) => {
            const exists = existingTypes.has(intType.type);
            const Icon = intType.icon;
            return (
              <div
                key={intType.type}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/40">
                    <Icon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{intType.label}</h3>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {intType.categoryLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{intType.description}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {exists ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-3.5 w-3.5" /> Configured
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openCreate(intType.type)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Set up
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {COMING_SOON_INTEGRATIONS.map((intType) => {
            const Icon = intType.icon;
            return (
              <div
                key={intType.label}
                className="rounded-lg border border-border bg-card p-4 opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Icon className="h-5 w-5 text-zinc-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{intType.label}</h3>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {intType.categoryLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{intType.description}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-[10px] font-medium text-muted-foreground">Coming soon</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active integrations */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Configured integrations ({integrations.length})
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No integrations configured yet. Set up an integration above to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => {
              const intType = INTEGRATION_TYPES.find((t) => t.type === integration.type);
              const Icon = intType?.icon || Phone;
              return (
                <div
                  key={integration.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/40">
                        <Icon className="h-4.5 w-4.5 text-orange-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{integration.name}</span>
                          <StatusBadge active={integration.isActive} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {integration._count.expertConfigs} expert{integration._count.expertConfigs !== 1 ? "s" : ""} using this integration
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(integration.id, !integration.isActive)}
                      >
                        {integration.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(integration.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <AlertDialog open={showCreate} onOpenChange={setShowCreate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set up {INTEGRATION_TYPES.find((t) => t.type === createType)?.label} integration
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enter your credentials to connect this integration. These are stored securely and used system-wide.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Display name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Twilio Production"
              />
            </div>

            {createType === "twilio" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Need help finding these?{" "}
                  <a
                    href="/docs/guides/twilio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Read the Twilio setup guide →
                  </a>
                </p>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Account SID</Label>
                  <Input
                    value={formAccountSid}
                    onChange={(e) => setFormAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Auth Token</Label>
                  <Input
                    type="password"
                    value={formAuthToken}
                    onChange={(e) => setFormAuthToken(e.target.value)}
                    placeholder="Your Twilio auth token"
                    className="font-mono text-sm"
                  />
                </div>
              </>
            )}

            {saveError && (
              <p className="text-sm text-red-500">{saveError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Connect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the integration and disconnect all experts using it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
