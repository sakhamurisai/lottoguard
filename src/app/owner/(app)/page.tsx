"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowClockwise, Package, Users, BookOpen, Ticket, ArrowRight,
  Warning, Bell, SealWarning, X, CurrencyDollar, ChartBar,
  TrendUp, ArrowUp, ArrowDown,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Summary = {
  totalBooks: number; activeBooks: number; settledBooks: number;
  totalEmployees: number; activeEmployees: number;
  totalTicketsSold: number; filledSlots: number; totalSlots: number;
};
type BooksByTier     = Record<number, { active: number; settled: number; unactivated: number; total: number }>;
type SoldByTier      = Record<number, number>;
type TrendPoint      = { day: string; sold: number };
type AnalyticsWarning = { type: string; message: string; severity: "error" | "warning" };
type Period          = "7d" | "30d" | "90d" | "all";

type Analytics = {
  summary:          Summary;
  booksByTier:      BooksByTier;
  soldByTier:       SoldByTier;
  estimatedRevenue: number;
  trend:            TrendPoint[];
  warnings:         AnalyticsWarning[];
  period:           string;
};

type Notif = {
  SK:        string;
  notifId:   string;
  type:      string;
  severity:  "emergency" | "important" | "warning" | "info";
  message:   string;
  empName?:  string;
  detail?:   Record<string, unknown>;
  read:      boolean;
  createdAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PRICE_TIERS  = [1, 2, 5, 10, 20, 30, 50];
const TIER_LABELS: Record<number, string> = {
  1: "$1", 2: "$2", 5: "$5", 10: "$10", 20: "$20", 30: "$30", 50: "$50",
};
const TIER_COLOR: Record<number, { bar: string; bg: string; text: string; border: string }> = {
   1: { bar: "bg-green-500",  bg: "bg-green-500/10",  text: "text-green-700",  border: "border-green-200"  },
   2: { bar: "bg-teal-500",   bg: "bg-teal-500/10",   text: "text-teal-700",   border: "border-teal-200"   },
   5: { bar: "bg-blue-500",   bg: "bg-blue-500/10",   text: "text-blue-700",   border: "border-blue-200"   },
  10: { bar: "bg-violet-500", bg: "bg-violet-500/10", text: "text-violet-700", border: "border-violet-200" },
  20: { bar: "bg-purple-500", bg: "bg-purple-500/10", text: "text-purple-700", border: "border-purple-200" },
  30: { bar: "bg-pink-500",   bg: "bg-pink-500/10",   text: "text-pink-700",   border: "border-pink-200"   },
  50: { bar: "bg-rose-500",   bg: "bg-rose-500/10",   text: "text-rose-700",   border: "border-rose-200"   },
};
const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "all": "All time",
};
const AUTO_REFRESH_MS = 120_000; // 2 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function fmtDayLabel(iso: string, totalPoints: number): string {
  if (totalPoints <= 14) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
  }
  return iso.slice(5); // MM-DD
}

// Uniform skeleton — no fake proportions
function Skel({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();

  const [data,        setData]        = useState<Analytics | null>(null);
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [period,      setPeriod]      = useState<Period>("7d");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nowTick,     setNowTick]     = useState(0); // increments every 30s to refresh "ago" text
  const [dismissed,   setDismissed]   = useState<Set<string>>(new Set());
  const [ackedNotifs, setAckedNotifs] = useState<Set<string>>(new Set());

  // Tick "ago" label every 30 s without re-fetching
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, notifRes] = await Promise.all([
        fetch(`/api/analytics?period=${period}`),
        fetch("/api/notifications"),
      ]);
      if (!analyticsRes.ok) throw new Error(`Analytics unavailable (${analyticsRes.status})`);
      setData(await analyticsRes.json() as Analytics);
      if (notifRes.ok) {
        const nd = await notifRes.json() as { notifications: Notif[] };
        setNotifs(nd.notifications ?? []);
      }
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Fetch on auth ready + whenever period changes
  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (!user) return;
    const id = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [user, load]);

  async function acknowledgeNotif(sk: string) {
    setAckedNotifs((prev) => new Set([...prev, sk]));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sk }),
    });
  }

  async function acknowledgeAll() {
    const unread = notifs.filter((n) => !n.read && !ackedNotifs.has(n.SK));
    setAckedNotifs((prev) => new Set([...prev, ...unread.map((n) => n.SK)]));
    if (unread.length > 0) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    }
  }

  // ── Derived (all from real API data, zero hardcoding) ─────────────────────

  const s           = data?.summary ?? null;
  const trend       = data?.trend   ?? [];
  const soldByTier  = data?.soldByTier  ?? {};
  const booksByTier = data?.booksByTier ?? {};

  const maxSold  = Math.max(0, ...Object.values(soldByTier));
  const trendMax = Math.max(0, ...trend.map((t) => t.sold));

  // today = last entry; yesterday = second-to-last entry
  const todaySold  = trend.at(-1)?.sold ?? 0;
  const yestSold   = trend.at(-2)?.sold ?? 0;
  const trendDelta = yestSold > 0 ? Math.round(((todaySold - yestSold) / yestSold) * 100) : null;

  const slotFillPct    = s && s.totalSlots > 0 ? Math.round((s.filledSlots / s.totalSlots) * 100) : null;
  const hasTicketData  = maxSold > 0;
  const hasTrendData   = trendMax > 0;

  const warnings        = (data?.warnings ?? []).filter((w) => !dismissed.has(w.type));
  const emergencyNotifs = notifs.filter((n) => n.severity === "emergency" && !ackedNotifs.has(n.SK));
  const importantNotifs = notifs.filter((n) => n.severity === "important" && !n.read && !ackedNotifs.has(n.SK));
  const unreadCount     = notifs.filter((n) => !n.read && !ackedNotifs.has(n.SK)).length;

  const revenue    = data?.estimatedRevenue ?? 0;
  const revenueStr = revenue >= 1_000_000
    ? `$${(revenue / 1_000_000).toFixed(1)}M`
    : revenue >= 1_000
    ? `$${(revenue / 1_000).toFixed(1)}k`
    : `$${revenue.toLocaleString()}`;

  const STAT_CARDS = s ? [
    {
      label: "Revenue Est.",
      value: revenueStr,
      icon:  CurrencyDollar,
      color: "text-emerald-600",
      desc:  PERIOD_LABEL[period],
      sub:   null,
    },
    {
      label: "Tickets Sold",
      value: s.totalTicketsSold.toLocaleString(),
      icon:  Ticket,
      color: "text-primary",
      desc:  PERIOD_LABEL[period],
      sub:   trendDelta !== null
        ? { text: `${trendDelta >= 0 ? "+" : ""}${trendDelta}% vs prev day`, positive: trendDelta >= 0 }
        : null,
    },
    {
      label: "Active Books",
      value: s.activeBooks.toLocaleString(),
      icon:  BookOpen,
      color: "text-violet-600",
      desc:  `${s.settledBooks} settled · ${Math.max(0, s.totalBooks - s.activeBooks - s.settledBooks)} stock`,
      sub:   null,
    },
    {
      label: "Slot Fill",
      value: slotFillPct !== null ? `${slotFillPct}%` : "—",
      icon:  ChartBar,
      color: slotFillPct !== null && slotFillPct < 50 ? "text-amber-500" : "text-blue-600",
      desc:  s.totalSlots > 0 ? `${s.filledSlots} / ${s.totalSlots} slots` : "No slots configured",
      sub:   null,
    },
    {
      label: "Active Staff",
      value: `${s.activeEmployees} / ${s.totalEmployees}`,
      icon:  Users,
      color: "text-blue-600",
      desc:  s.totalEmployees === 0 ? "No employees" : `${s.totalEmployees - s.activeEmployees} inactive`,
      sub:   null,
    },
  ] : [];

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.orgName ?? "—"}
            {/* Live "ago" — re-renders via nowTick without re-fetching */}
            {lastUpdated && !loading && (
              <span className="ml-2 text-xs opacity-60" suppressHydrationWarning>
                · {fmtAgo(lastUpdated)}{nowTick > 0 ? "" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {unreadCount > 0 && (
            <div className="relative">
              <Bell weight="fill" className="size-5 text-muted-foreground" />
              <span className="absolute -top-1 -right-1 size-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </div>
          )}
          {/* Period selector */}
          <div className="flex items-center gap-0.5 border rounded-xl bg-muted/40 p-0.5">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  period === p
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "all" ? "All" : p.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
            title="Refresh"
          >
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <Link
            href="/owner/inventory"
            className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity font-medium shadow-sm"
          >
            + Add Shipment
          </Link>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/8 text-sm text-destructive">
          <SealWarning weight="fill" className="size-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={load}
            className="shrink-0 text-xs underline underline-offset-2 hover:opacity-80"
          >
            Retry
          </button>
          <button onClick={() => setError(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Emergency notifications ─────────────────────────────────────────── */}
      {emergencyNotifs.length > 0 && (
        <div className="space-y-2">
          {emergencyNotifs.map((n) => (
            <div key={n.SK}
              className="flex items-start gap-3 px-4 py-4 rounded-xl border-2 border-red-400 bg-red-50 text-red-900 text-sm shadow-sm">
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
                <SealWarning weight="fill" className="size-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-red-700 text-xs uppercase tracking-wide mb-1">Emergency Alert</p>
                <p className="leading-snug font-medium">{n.message}</p>
                {n.empName && <p className="text-xs text-red-600/70 mt-1">Employee: {n.empName}</p>}
                {(n.detail?.note as string | undefined) && (
                  <p className="text-xs mt-1 italic text-red-700/80">Note: {n.detail!.note as string}</p>
                )}
                <p className="text-xs text-red-600/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => acknowledgeNotif(n.SK)}
                className="shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Important notifications ─────────────────────────────────────────── */}
      {importantNotifs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Bell className="size-3.5" /> Important Alerts ({importantNotifs.length})
            </p>
            <button
              onClick={acknowledgeAll}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Mark all read
            </button>
          </div>
          {importantNotifs.map((n) => (
            <div key={n.SK}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 text-orange-900 text-sm">
              <Warning weight="fill" className="size-4 shrink-0 mt-0.5 text-orange-500" />
              <div className="flex-1 min-w-0">
                <p className="leading-snug">{n.message}</p>
                <p className="text-xs text-orange-600/60 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => acknowledgeNotif(n.SK)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Analytics warnings ──────────────────────────────────────────────── */}
      {!loading && warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w) => (
            <div key={w.type} className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
              w.severity === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            )}>
              {w.severity === "error"
                ? <SealWarning weight="fill" className="size-4 shrink-0 mt-0.5 text-red-500" />
                : <Warning     weight="fill" className="size-4 shrink-0 mt-0.5 text-amber-500" />
              }
              <span className="flex-1">{w.message}</span>
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, w.type]))}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border rounded-2xl p-4 space-y-3 bg-card shadow-sm">
                <Skel className="h-3 w-20" />
                <Skel className="h-8 w-14" />
                <Skel className="h-3 w-16" />
              </div>
            ))
          : STAT_CARDS.map(({ label, value, icon: Icon, color, desc, sub }) => (
              <div key={label} className="border rounded-2xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow bg-card">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <Icon className={cn("size-4", color)} weight="fill" />
                </div>
                <p className="text-3xl font-black tracking-tight tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {sub && (
                  <p className={cn(
                    "text-[11px] font-semibold flex items-center gap-0.5",
                    sub.positive ? "text-emerald-600" : "text-red-500"
                  )}>
                    {sub.positive
                      ? <ArrowUp className="size-2.5" weight="bold" />
                      : <ArrowDown className="size-2.5" weight="bold" />}
                    {sub.text}
                  </p>
                )}
              </div>
            ))
        }
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Tickets sold by tier */}
        <div className="lg:col-span-2 border rounded-2xl p-5 space-y-4 shadow-sm bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">Tickets Sold by Type</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABEL[period]}</p>
            </div>
            <TrendUp className="size-4 text-muted-foreground" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {PRICE_TIERS.map((p) => (
                <div key={p} className="flex items-center gap-3">
                  <Skel className="h-3 w-8 shrink-0" />
                  <Skel className="flex-1 h-8" />
                  <Skel className="h-3 w-12 shrink-0" />
                </div>
              ))}
            </div>
          ) : !hasTicketData ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 text-center">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center">
                <Ticket className="size-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No tickets sold in this period</p>
              <p className="text-xs text-muted-foreground/70">
                {period === "all"
                  ? "Clock in employees to start recording sales."
                  : "Try a wider period to see historical data."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {PRICE_TIERS.map((price) => {
                const sold = soldByTier[price] ?? 0;
                const tc   = TIER_COLOR[price];
                const pct  = maxSold > 0 ? Math.round((sold / maxSold) * 100) : 0;
                return (
                  <div key={price} className="flex items-center gap-3">
                    <span className={cn("text-xs font-bold w-8 shrink-0 text-right tabular-nums", tc.text)}>
                      {TIER_LABELS[price]}
                    </span>
                    <div className="flex-1 bg-muted/50 rounded-lg h-8 overflow-hidden relative">
                      {sold > 0 && (
                        <div
                          className={cn("h-full rounded-lg transition-all duration-700", tc.bar)}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      )}
                      {sold > 0 ? (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white tabular-nums">
                          {sold.toLocaleString()}
                        </span>
                      ) : (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">
                          No sales
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground w-14 shrink-0 text-right font-mono tabular-nums">
                      {sold > 0 ? `$${(sold * price).toLocaleString()}` : "—"}
                    </span>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground pt-2 border-t">
                Estimated revenue = ticket price × count sold
              </p>
            </div>
          )}
        </div>

        {/* Daily trend */}
        <div className="border rounded-2xl p-5 space-y-4 shadow-sm bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">
                {period === "7d" ? "7-Day" : period === "30d" ? "30-Day" : period === "90d" ? "90-Day" : "All-Time"} Trend
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">tickets / day</p>
            </div>
            {!loading && s && (
              <div className="text-right">
                <p className="text-lg font-black tabular-nums">{todaySold.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">today</p>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-end gap-px h-28">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skel key={i} className="flex-1 h-12 rounded-t rounded-b-none" />
              ))}
            </div>
          ) : !hasTrendData ? (
            <div className="flex flex-col items-center justify-center h-28 space-y-1.5">
              <p className="text-xs text-muted-foreground text-center">No shift activity in this period</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-px h-28">
                {trend.map((t) => {
                  const h       = trendMax > 0 ? Math.max(3, Math.round((t.sold / trendMax) * 100)) : 3;
                  const isToday = t.day === new Date().toISOString().slice(0, 10);
                  const label   = `${t.day}: ${t.sold.toLocaleString()} sold`;
                  return (
                    <div key={t.day} className="flex-1 group relative" title={label}>
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-500",
                          isToday ? "bg-primary" : "bg-primary/30 group-hover:bg-primary/55"
                        )}
                        style={{ height: `${h}%` }}
                      />
                      {t.sold > 0 && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 tabular-nums">
                          {t.sold}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-px overflow-hidden">
                {trend.map((t) => (
                  <span key={t.day} className={cn(
                    "flex-1 text-center text-[9px] truncate",
                    t.day === new Date().toISOString().slice(0, 10)
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  )}>
                    {fmtDayLabel(t.day, trend.length)}
                  </span>
                ))}
              </div>
              {trendDelta !== null && (
                <p className={cn(
                  "text-[11px] font-semibold text-center flex items-center justify-center gap-0.5",
                  trendDelta >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                  {trendDelta >= 0
                    ? <ArrowUp className="size-3" weight="bold" />
                    : <ArrowDown className="size-3" weight="bold" />}
                  {Math.abs(trendDelta)}% vs previous day
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Inventory by ticket type ─────────────────────────────────────────── */}
      <div className="border rounded-2xl p-5 space-y-4 shadow-sm bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Inventory by Ticket Type</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Current stock — all statuses</p>
          </div>
          <Link href="/owner/inventory" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            Manage <ArrowRight className="size-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skel key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : s?.totalBooks === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-center">
            <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center">
              <Package className="size-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No books in inventory</p>
            <Link href="/owner/inventory" className="text-xs text-primary hover:underline font-medium">
              Add your first shipment →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
            {PRICE_TIERS.map((price) => {
              const tier = booksByTier[price] ?? { active: 0, settled: 0, unactivated: 0, total: 0 };
              const tc   = TIER_COLOR[price];
              if (tier.total === 0) return (
                <div key={price} className="rounded-xl border border-dashed p-3 space-y-2 text-center opacity-35">
                  <p className="text-sm font-black text-muted-foreground">{TIER_LABELS[price]}</p>
                  <p className="text-xs text-muted-foreground">None</p>
                </div>
              );
              const activePct = Math.round((tier.active / tier.total) * 100);
              return (
                <div key={price} className={cn("rounded-xl border p-3 space-y-2 text-center", tc.bg, tc.border)}>
                  <p className={cn("text-sm font-black", tc.text)}>{TIER_LABELS[price]}</p>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex justify-between gap-1">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-bold tabular-nums">{tier.active}</span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-muted-foreground">Settled</span>
                      <span className="font-medium tabular-nums">{tier.settled}</span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-muted-foreground">Stock</span>
                      <span className="font-medium tabular-nums">{tier.unactivated}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", tc.bar)} style={{ width: `${activePct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && s && s.totalBooks > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Active — in machine
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/40 inline-block" /> Settled — fully sold
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary/30 inline-block" /> Stock — not yet activated
            </span>
            <span className="ml-auto font-semibold text-foreground tabular-nums">{s.totalBooks} total</span>
          </div>
        )}
      </div>

      {/* ── Quick links (mobile only) ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {[
          { label: "Inventory",         href: "/owner/inventory",  icon: Package  },
          { label: "Activate / Settle",  href: "/owner/books",      icon: BookOpen },
          { label: "Slots",             href: "/owner/slots",      icon: ChartBar },
          { label: "Management",        href: "/owner/management", icon: Users    },
        ].map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href}
            className="flex items-center gap-2.5 border rounded-2xl px-4 py-3.5 text-sm font-medium hover:bg-accent transition-colors bg-card">
            <Icon className="size-4 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </div>

    </div>
  );
}
