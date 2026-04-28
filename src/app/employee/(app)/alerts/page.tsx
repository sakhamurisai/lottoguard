"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Warning, Bell, X, Info, SealWarning, CheckCircle, Trash, Funnel,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const ALERTS_KEY = "lg_emp_alerts";

type Severity = "error" | "warning" | "info";
type AlertEntry = {
  id: string;
  severity: Severity;
  message: string;
  timestamp: string;
};

type Filter = "all" | Severity;

const SEVERITY_CFG: Record<Severity, {
  bg: string; border: string; text: string; iconColor: string; icon: React.ElementType; label: string;
}> = {
  error:   { bg: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-800",   iconColor: "text-rose-500",   icon: SealWarning, label: "Critical" },
  warning: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  iconColor: "text-amber-500",  icon: Warning,     label: "Warning"  },
  info:    { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   iconColor: "text-blue-500",   icon: Info,        label: "Info"     },
};

function loadAlerts(sub: string): AlertEntry[] {
  try {
    const raw = localStorage.getItem(`${ALERTS_KEY}_${sub}`);
    return raw ? (JSON.parse(raw) as AlertEntry[]) : [];
  } catch { return []; }
}

function saveAlerts(sub: string, alerts: AlertEntry[]) {
  try { localStorage.setItem(`${ALERTS_KEY}_${sub}`, JSON.stringify(alerts)); }
  catch { /* storage full */ }
}

function fmtAlertTime(iso: string) {
  const d    = new Date(iso);
  const now  = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)         return "just now";
  if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EmployeeAlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user?.id) return;
    setAlerts(loadAlerts(user.id));
  }, [user?.id]);

  function clearAll() {
    if (!user?.id) return;
    if (!confirm("Clear all alerts? This cannot be undone.")) return;
    saveAlerts(user.id, []);
    setAlerts([]);
  }

  function dismiss(id: string) {
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    if (user?.id) saveAlerts(user.id, next);
  }

  const counts = useMemo(() => ({
    all:     alerts.length,
    error:   alerts.filter((a) => a.severity === "error").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info:    alerts.filter((a) => a.severity === "info").length,
  }), [alerts]);

  const sortedAlerts = useMemo(() => {
    const list = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);
    return list.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, filter]);

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Bell weight="fill" className="size-5 text-primary" />
            Alerts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.all === 0 ? "All clear" : `${counts.all} notification${counts.all !== 1 ? "s" : ""}`}
          </p>
        </div>
        {alerts.length > 0 && (
          <button onClick={clearAll}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border hover:bg-muted hover:text-destructive transition-colors text-muted-foreground inline-flex items-center gap-1.5">
            <Trash className="size-3.5" /> Clear all
          </button>
        )}
      </div>

      {/* Severity stats */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {(["error", "warning", "info"] as Severity[]).map((sev) => {
            const cfg   = SEVERITY_CFG[sev];
            const count = counts[sev];
            return (
              <button key={sev} onClick={() => setFilter(filter === sev ? "all" : sev)}
                className={cn(
                  "border rounded-xl px-3 py-2 transition-all text-left",
                  filter === sev ? cn(cfg.bg, cfg.border, "ring-2 ring-offset-1") : "border-border bg-card hover:bg-muted/40",
                )}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <cfg.icon weight="fill" className={cn("size-3", cfg.iconColor)} />
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider", filter === sev ? cfg.text : "text-muted-foreground")}>
                    {cfg.label}
                  </p>
                </div>
                <p className={cn("text-xl font-black tabular-nums", filter === sev ? cfg.text : "text-foreground")}>
                  {count}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-1 border-b -mx-1 px-1 overflow-x-auto">
          {(["all", "error", "warning", "info"] as Filter[]).map((f) => {
            const isActive = filter === f;
            const count = counts[f];
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors whitespace-nowrap capitalize",
                  isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                {f === "all" ? "All" : SEVERITY_CFG[f].label}
                <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
          <div className="size-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle weight="fill" className="size-7 text-emerald-500" />
          </div>
          <p className="text-sm font-semibold text-foreground">All caught up!</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Alerts from your shifts will appear here. Things like cash discrepancies, sold-out books, or important updates will show up automatically.
          </p>
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
          <Funnel className="size-9 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No {filter} alerts</p>
          <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline font-semibold">
            Show all alerts →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedAlerts.map((a) => {
            const cfg = SEVERITY_CFG[a.severity];
            return (
              <div key={a.id}
                className={cn("flex items-start gap-3 px-4 py-3 rounded-2xl border text-sm shadow-sm", cfg.bg, cfg.border, cfg.text)}>
                <cfg.icon weight="fill" className={cn("size-4 shrink-0 mt-0.5", cfg.iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className="leading-snug font-medium">{a.message}</p>
                  <p className="text-xs opacity-70 mt-1">{fmtAlertTime(a.timestamp)}</p>
                </div>
                <button onClick={() => dismiss(a.id)}
                  className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-black/5">
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
