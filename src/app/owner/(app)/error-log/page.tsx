"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowClockwise, SealWarning, Warning, Info,
  CheckCircle, X, FunnelSimple, User,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = "emergency" | "important" | "warning" | "info";

type Notif = {
  SK:        string;
  notifId:   string;
  type:      string;
  severity:  Severity;
  message:   string;
  empName?:  string;
  detail?:   Record<string, unknown>;
  read:      boolean;
  createdAt: string;
};

type Filter = "all" | "emergency" | "important" | "warning" | "info";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<Severity, {
  label: string;
  icon:  React.ElementType;
  row:   string;
  badge: string;
  dot:   string;
}> = {
  emergency: {
    label: "Emergency",
    icon:  SealWarning,
    row:   "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
    dot:   "bg-red-500",
  },
  important: {
    label: "Important",
    icon:  Warning,
    row:   "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    dot:   "bg-orange-500",
  },
  warning: {
    label: "Warning",
    icon:  Warning,
    row:   "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot:   "bg-amber-400",
  },
  info: {
    label: "Info",
    icon:  Info,
    row:   "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    dot:   "bg-blue-400",
  },
};

const TYPE_LABEL: Record<string, string> = {
  auto_slot_assigned:          "Auto Slot Assigned",
  book_sold_out:               "Book Sold Out",
  slot_updated_by_employee:    "Slot Updated",
  shift_discrepancy_over:      "Cash Discrepancy — Over",
  shift_discrepancy_short:     "Cash Discrepancy — Short",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month:   "short",
    day:     "numeric",
    year:    "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
    hour12:  true,
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ErrorLogPage() {
  const [notifs,   setNotifs]   = useState<Notif[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/notifications");
    if (r.ok) {
      const d = await r.json() as { notifications: Notif[] };
      setNotifs(d.notifications ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(sk: string) {
    setNotifs((prev) => prev.map((n) => n.SK === sk ? { ...n, read: true } : n));
    await fetch("/api/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sk }),
    });
  }

  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ all: true }),
    });
  }

  function toggleExpand(sk: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sk) ? next.delete(sk) : next.add(sk);
      return next;
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered   = filter === "all" ? notifs : notifs.filter((n) => n.severity === filter);
  const unread     = notifs.filter((n) => !n.read).length;

  const counts: Record<Filter, number> = {
    all:       notifs.length,
    emergency: notifs.filter((n) => n.severity === "emergency").length,
    important: notifs.filter((n) => n.severity === "important").length,
    warning:   notifs.filter((n) => n.severity === "warning").length,
    info:      notifs.filter((n) => n.severity === "info").length,
  };

  // Group by date
  const grouped: { date: string; items: Notif[] }[] = [];
  for (const n of filtered) {
    const date = fmtDate(n.createdAt);
    const last = grouped[grouped.length - 1];
    if (last?.date === date) { last.items.push(n); }
    else { grouped.push({ date, items: [n] }); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Error Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All system alerts, discrepancies, and employee-triggered events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-1.5">
              <CheckCircle className="size-3.5" />Mark all read
            </button>
          )}
          <button
            onClick={load}
            className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-0">
        {(["all", "emergency", "important", "warning", "info"] as Filter[]).map((f) => {
          const cfg = f === "all" ? null : SEVERITY_CFG[f as Severity];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize -mb-px",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {cfg && <FunnelSimple className="size-3.5" />}
              {f === "all" ? "All" : cfg?.label}
              <span className={cn(
                "ml-0.5 text-xs px-1.5 py-0.5 rounded-full font-semibold",
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border rounded-2xl p-4 space-y-2 animate-pulse">
              <div className="flex gap-3">
                <div className="size-8 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <CheckCircle weight="fill" className="size-8 text-emerald-500" />
          </div>
          <p className="font-semibold">No {filter === "all" ? "" : filter} alerts</p>
          <p className="text-sm text-muted-foreground">Everything looks good.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date} className="space-y-2">
              {/* Date separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-semibold text-muted-foreground px-2">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Notification rows */}
              {items.map((n) => {
                const cfg = SEVERITY_CFG[n.severity];
                const Icon = cfg.icon;
                const isOpen = expanded.has(n.SK);

                return (
                  <div
                    key={n.SK}
                    className={cn(
                      "border rounded-2xl overflow-hidden transition-all",
                      cfg.row,
                      !n.read && "ring-1 ring-inset ring-current/10"
                    )}
                  >
                    {/* Main row */}
                    <button
                      onClick={() => { toggleExpand(n.SK); if (!n.read) markRead(n.SK); }}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:brightness-95 transition-all"
                    >
                      {/* Severity icon */}
                      <div className="shrink-0 mt-0.5 relative">
                        <Icon weight="fill" className="size-5 opacity-80" />
                        {!n.read && (
                          <span className={cn(
                            "absolute -top-0.5 -right-0.5 size-2 rounded-full border border-white",
                            cfg.dot
                          )} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full border",
                            cfg.badge
                          )}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {TYPE_LABEL[n.type] ?? n.type.replace(/_/g, " ")}
                          </span>
                          {!n.read && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              NEW
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium leading-snug">{n.message}</p>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {n.empName && (
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              {n.empName}
                            </span>
                          )}
                          <span>{fmtDateTime(n.createdAt)}</span>
                        </div>
                      </div>

                      {/* Expand chevron */}
                      <span className={cn(
                        "text-xs text-muted-foreground shrink-0 mt-1 transition-transform",
                        isOpen && "rotate-180"
                      )}>▾</span>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && n.detail && Object.keys(n.detail).length > 0 && (
                      <div className="border-t px-4 py-3 bg-black/5 space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Details
                        </p>
                        {Object.entries(n.detail).map(([key, val]) => {
                          if (val == null || val === "") return null;
                          const label = key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (s) => s.toUpperCase());
                          const display = typeof val === "number"
                            ? key.toLowerCase().includes("cash") || key.toLowerCase().includes("calc") || key.toLowerCase().includes("diff")
                              ? `$${Math.abs(val as number).toFixed(2)}`
                              : String(val)
                            : String(val);
                          return (
                            <div key={key} className="flex items-start gap-2 text-xs">
                              <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                              <span className="font-medium break-all">{display}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Mark read button when unread and not expanded */}
                    {!n.read && !isOpen && (
                      <div className="border-t px-4 py-2 flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n.SK); }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <X className="size-3" />Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
