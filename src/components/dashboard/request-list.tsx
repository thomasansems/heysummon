"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { NotificationBadge } from "./notification-badge";

interface ContentFlag {
  type: "xss" | "url" | "credit_card" | "phone" | "email" | "ssn_bsn";
  original: string;
  replacement: string;
}

interface HelpRequestItem {
  id: string;
  status: string;
  question: string | null;
  createdAt: string;
  deliveredAt: string | null;
  contentFlags: ContentFlag[] | null;
  guardVerified: boolean;
  responseRequired: boolean;
  acknowledgedAt: string | null;
  expiresAt: string;
  apiKey: { name: string | null };
}

const SPAM_FLAG_TYPES = new Set(["xss", "credit_card", "ssn_bsn"]);
const ACK_AUDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type PrimaryTab = "all" | "help" | "notifications";
type NotificationSubTab = "pending" | "acknowledged";

function getFlagLabel(type: string): string {
  const labels: Record<string, string> = {
    xss: "XSS",
    url: "URL defanged",
    credit_card: "Credit card",
    phone: "Phone redacted",
    email: "Email redacted",
    ssn_bsn: "SSN/BSN",
  };
  return labels[type] || type;
}

const primaryTabs: { value: PrimaryTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "help", label: "Help requests" },
  { value: "notifications", label: "Notifications" },
];

const helpStatusFilters = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "reviewing", label: "Reviewing" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
  { value: "expired", label: "Expired" },
  { value: "flagged", label: "Flagged" },
];

const notificationSubTabs: { value: NotificationSubTab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "acknowledged", label: "Acknowledged" },
];

export function RequestList({ expertId: _expertId }: { expertId?: string }) {
  void _expertId;
  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("all");
  const [helpStatus, setHelpStatus] = useState("");
  const [notificationSubTab, setNotificationSubTab] =
    useState<NotificationSubTab>("pending");

  const fetchRequests = useCallback(() => {
    setLoading(true);
    // Fetch all rows; client filters by tab. Volume per expert is bounded.
    const url =
      primaryTab === "help" && helpStatus
        ? `/api/v1/requests?status=${helpStatus}`
        : "/api/v1/requests";
    fetch(url)
      .then((res) => res.json())
      .then((data) => setRequests(data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [primaryTab, helpStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const interval = setInterval(fetchRequests, 10_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const visibleRequests = useMemo(() => {
    if (primaryTab === "all") return requests;
    if (primaryTab === "help") {
      return requests.filter((r) => r.responseRequired);
    }
    const notifications = requests.filter((r) => !r.responseRequired);
    if (notificationSubTab === "pending") {
      // "pending" sub-tab surfaces anything not yet acknowledged and not expired.
      return notifications.filter(
        (r) => !r.acknowledgedAt && r.status !== "expired"
      );
    }
    // Acknowledged audit sub-tab — last 30 days only.
    const cutoff = Date.now() - ACK_AUDIT_WINDOW_MS;
    return notifications.filter(
      (r) => r.acknowledgedAt && new Date(r.acknowledgedAt).getTime() >= cutoff
    );
  }, [requests, primaryTab, notificationSubTab]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {primaryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPrimaryTab(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              primaryTab === tab.value
                ? "bg-orange-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {primaryTab === "help" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {helpStatusFilters.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHelpStatus(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                helpStatus === opt.value
                  ? "bg-zinc-700 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {primaryTab === "notifications" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {notificationSubTabs.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setNotificationSubTab(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                notificationSubTab === opt.value
                  ? "bg-zinc-700 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
              {opt.value === "acknowledged" && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  · last 30 days
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          {primaryTab === "notifications" && notificationSubTab === "acknowledged"
            ? "No notifications acknowledged in the last 30 days."
            : "No requests found."}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {visibleRequests.map((req) => {
            const isNotification = !req.responseRequired;
            return (
              <Link
                key={req.id}
                href={`/dashboard/requests/${req.id}`}
                className={`flex items-center justify-between border-b border-zinc-800 px-5 py-4 transition-colors last:border-0 hover:bg-zinc-800/30 ${
                  isNotification ? "bg-muted/30 opacity-90" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isNotification && <NotificationBadge />}
                    <p className="truncate text-sm text-zinc-200">
                      {req.question || "No question provided"}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(req.createdAt).toLocaleString()} · via{" "}
                    {req.apiKey.name || "Unnamed key"}
                    {isNotification && req.acknowledgedAt && (
                      <>
                        {" "}· Acknowledged{" "}
                        {new Date(req.acknowledgedAt).toLocaleString()}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {req.contentFlags && req.contentFlags.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400"
                      title={req.contentFlags.map((f) => getFlagLabel(f.type)).join(", ")}
                    >
                      <ShieldAlert className="h-3 w-3" />
                      {req.contentFlags.some((f) => SPAM_FLAG_TYPES.has(f.type)) ? "Blocked" : "Sanitized"}
                    </span>
                  )}
                  {!isNotification && !req.deliveredAt && req.status === "pending" && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      ⏳
                    </span>
                  )}
                  {isNotification && req.acknowledgedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Acknowledged
                    </span>
                  )}
                  {!isNotification && <StatusBadge status={req.status} />}
                  {isNotification && req.status === "expired" && (
                    <StatusBadge status={req.status} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
