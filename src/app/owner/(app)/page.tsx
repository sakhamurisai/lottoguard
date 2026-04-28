"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise, Package, Users, BookOpen, Ticket, ArrowRight,
  Warning, Bell, SealWarning, X, CurrencyDollar, ChartBar,
  TrendUp, ArrowUp, ArrowDown, Lightning, GridFour, Plus,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import {
  TrendArea, TierBars, InventoryDonut, StatCard, CHART_COLORS, TIER_HEX,
} from "@/components/charts";

// ── Types ─────────────────────────────────────────────────────────────────────
type Summary = {
  totalBooks: number; activeBooks: number; settledBooks: number;
  totalEmployees: number; activeEmployees: number;
  totalTicketsSold: number; filledSlots: number; totalSlots: number;
};
type BooksByTier = Record<number, { active: number; settled: number; unactivated: number; total: number }>;
type SoldByTier  = Record<number, number>;
type TrendPoint  = { day: string; sold: number };
type AnalyticsWarning = { type: string; message: string; severity: "error" | "warning" };
type Period = "7d" | "30d" | "90d" | "all";

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
const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];
const TIER_LABELS: Record<number, string> = {
  1: "$1", 2: "$2", 5: "$5", 10: "$10", 20: "$20", 30: "$30", 50: "$50",
};
const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "all": "All time",
};
const AUTO_REFRESH_MS = 120_000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function fmtDayShort(iso: string, totalPoints: number): string {
  if (!iso) return "";
  if (totalPoints <= 14) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
  }
  return iso.slice(5);
}

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
  const [, setNowTick] = useState(0);
  const [dismissed,   setDismissed]   = useState<Set<string>>(new Set());
  const [ackedNotifs, setAckedNotifs] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

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

  // ── Derived ───────────────────────────────────────────────────────────────
  const s           = data?.summary    ?? null;
  const trend       = data?.trend      ?? [];
  const soldByTier  = data?.soldByTier  ?? {};
  const booksByTier = data?.booksByTier ?? {};
  const revenue     = data?.estimatedRevenue ?? 0;

  const todaySold  = trend.at(-1)?.sold ?? 0;
  const yestSold   = trend.at(-2)?.sold ?? 0;
  const trendDelta = yestSold > 0 ? Math.round(((todaySold - yestSold) / yestSold) * 100) : null;

  const totalSold = useMemo(
    () => Object.values(soldByTier).reduce((a, b) => a + b, 0),
    [soldByTier],
  );

  const slotFillPct = s && s.totalSlots > 0 ? Math.round((s.filledSlots / s.totalSlots) * 100) : null;

  const warnings        = (data?.warnings ?? []).filter((w) => !dismissed.has(w.type));
  const emergencyNotifs = notifs.filter((n) => n.severity === "emergency" && !ackedNotifs.has(n.SK));
  const importantNotifs = notifs.filter((n) => n.severity === "important" && !n.read && !ackedNotifs.has(n.SK));
  const unreadCount     = notifs.filter((n) => !n.read && !ackedNotifs.has(n.SK)).length;

  // Chart data shapes
  const trendChartData = useMemo(() => trend.map((t) => ({
    day: t.day, sold: t.sold,
    revenue: PRICE_TIERS.reduce((sum, p) => sum + (soldByTier[p] ?? 0) * p, 0) > 0 && totalSold > 0
      ? Math.round((t.sold / totalSold) * revenue)
      : 0,
  })), [trend, soldByTier, totalSold, revenue]);

  const tierChartData = useMemo(() => PRICE_TIERS.map((p) => ({
    tier: TIER_LABELS[p], sold: soldByTier[p] ?? 0, price: p, revenue: (soldByTier[p] ?? 0) * p,
  })), [soldByTier]);

  const inventoryDonutData = useMemo(() => {
    if (!s) return [];
    return [
      { name: "Active",      value: s.activeBooks,                                    color: "#10b981" },
      { name: "Settled",     value: s.settledBooks,                                   color: "#94a3b8" },
      { name: "Stock",       value: Math.max(0, s.totalBooks - s.activeBooks - s.settledBooks), color: CHART_COLORS.primary },
    ].filter((d) => d.value > 0);
  }, [s]);

  const sparkData = trend.map((t) => ({ v: t.sold }));

  // Top tier (best seller this period)
  const topTier = useMemo(() => {
    if (totalSold === 0) return null;
    const entries = Object.entries(soldByTier).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    const [price, sold] = entries[0];
    return { price: Number(price), sold };
  }, [soldByTier, totalSold]);

  // Insights
  const insights = useMemo(() => {
    const items: { tone: "good" | "warn" | "info"; text: string }[] = [];
    if (s) {
      if (slotFillPct !== null && slotFillPct < 50)
        items.push({ tone: "warn", text: `Only ${slotFillPct}% of slots are filled — assign books to drive sales.` });
      if (slotFillPct !== null && slotFillPct >= 90)
        items.push({ tone: "good", text: `Slots are ${slotFillPct}% filled — strong floor coverage.` });
      if (s.activeBooks === 0 && s.totalBooks > 0)
        items.push({ tone: "warn", text: "No active books — activate inventory to start selling." });
      if (trendDelta !== null && trendDelta >= 20)
        items.push({ tone: "good", text: `Today's sales are up ${trendDelta}% vs yesterday.` });
      if (trendDelta !== null && trendDelta <= -25)
        items.push({ tone: "warn", text: `Today's sales are down ${Math.abs(trendDelta)}% vs yesterday.` });
      if (topTier && totalSold > 0)
        items.push({ tone: "info", text: `Best seller: ${TIER_LABELS[topTier.price]} tickets (${topTier.sold.toLocaleString()} sold).` });
      if (s.totalEmployees - s.activeEmployees > 0)
        items.push({ tone: "info", text: `${s.totalEmployees - s.activeEmployees} employee${s.totalEmployees - s.activeEmployees === 1 ? "" : "s"} pending or inactive.` });
    }
    return items.slice(0, 4);
  }, [s, slotFillPct, trendDelta, topTier, totalSold]);

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {user?.orgName ?? "—"}
            {lastUpdated && !loading && (
              <span className="ml-2 text-xs opacity-60" suppressHydrationWarning>· updated {fmtAgo(lastUpdated)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {unreadCount > 0 && (
            <Link href="/owner/error-log" className="relative p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground" title={`${unreadCount} unread`}>
              <Bell weight="fill" className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </Link>
          )}
          <div className="flex items-center gap-0.5 border rounded-xl bg-muted/40 p-0.5">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                {p === "all" ? "All" : p.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50" title="Refresh">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <Link href="/owner/inventory"
            className="bg-primary text-primary-foreground text-sm px-3 sm:px-4 py-2 rounded-xl hover:opacity-90 transition-opacity font-semibold shadow-sm flex items-center gap-1.5">
            <Plus className="size-4" weight="bold" /> <span className="hidden sm:inline">Add Shipment</span><span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/8 text-sm text-destructive">
          <SealWarning weight="fill" className="size-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="shrink-0 text-xs underline underline-offset-2 hover:opacity-80">Retry</button>
          <button onClick={() => setError(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="size-3.5" /></button>
        </div>
      )}

      {/* ── Emergency notifications ─────────────────────────────────────────── */}
      {emergencyNotifs.length > 0 && (
        <div className="space-y-2">
          {emergencyNotifs.map((n) => (
            <div key={n.SK} className="flex items-start gap-3 px-4 py-4 rounded-2xl border-2 border-rose-400 bg-rose-50 text-rose-900 text-sm shadow-sm">
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
                <SealWarning weight="fill" className="size-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-rose-700 text-xs uppercase tracking-wider mb-1">Emergency Alert</p>
                <p className="leading-snug font-medium">{n.message}</p>
                {n.empName && <p className="text-xs text-rose-600/70 mt-1">Employee: {n.empName}</p>}
                <p className="text-xs text-rose-600/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => acknowledgeNotif(n.SK)}
                className="shrink-0 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors whitespace-nowrap">
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Important notifications ─────────────────────────────────────────── */}
      {importantNotifs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 sm:p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="size-3.5" weight="fill" /> Important Alerts ({importantNotifs.length})
            </p>
            <button onClick={acknowledgeAll} className="text-xs text-amber-700 hover:text-amber-900 font-medium">Mark all read</button>
          </div>
          <div className="space-y-1.5">
            {importantNotifs.slice(0, 3).map((n) => (
              <div key={n.SK} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-background border border-amber-100 text-sm">
                <Warning weight="fill" className="size-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="leading-snug">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => acknowledgeNotif(n.SK)} className="shrink-0 opacity-50 hover:opacity-100"><X className="size-3.5" /></button>
              </div>
            ))}
            {importantNotifs.length > 3 && (
              <Link href="/owner/error-log" className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 pt-1">
                View all {importantNotifs.length} alerts <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Analytics warnings ──────────────────────────────────────────────── */}
      {!loading && warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w) => (
            <div key={w.type} className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
              w.severity === "error" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-amber-50 border-amber-200 text-amber-800"
            )}>
              {w.severity === "error"
                ? <SealWarning weight="fill" className="size-4 shrink-0 mt-0.5 text-rose-500" />
                : <Warning     weight="fill" className="size-4 shrink-0 mt-0.5 text-amber-500" />}
              <span className="flex-1">{w.message}</span>
              <button onClick={() => setDismissed((prev) => new Set([...prev, w.type]))}
                className="shrink-0 opacity-50 hover:opacity-100"><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-2xl p-4 space-y-3 bg-card shadow-sm">
              <Skel className="h-3 w-20" />
              <Skel className="h-8 w-14" />
              <Skel className="h-8 w-full" />
            </div>
          ))
        ) : s ? (
          <>
            <StatCard
              label="Revenue Est."
              value={fmtCurrency(revenue)}
              icon={CurrencyDollar}
              accent="text-emerald-600"
              sub={PERIOD_LABEL[period]}
              trend={trendDelta}
              trendData={sparkData}
              trendColor="#10b981"
            />
            <StatCard
              label="Tickets Sold"
              value={fmtNum(s.totalTicketsSold)}
              icon={Ticket}
              accent="text-primary"
              sub={topTier ? `${TIER_LABELS[topTier.price]} leads` : PERIOD_LABEL[period]}
              trendData={sparkData}
              trendColor={CHART_COLORS.primary}
            />
            <StatCard
              label="Slot Fill"
              value={slotFillPct !== null ? `${slotFillPct}%` : "—"}
              icon={GridFour}
              accent={slotFillPct !== null && slotFillPct < 50 ? "text-amber-500" : "text-blue-600"}
              sub={s.totalSlots > 0 ? `${s.filledSlots} / ${s.totalSlots} slots filled` : "No slots configured"}
            />
            <StatCard
              label="Active Staff"
              value={`${s.activeEmployees}/${s.totalEmployees}`}
              icon={Users}
              accent="text-violet-600"
              sub={s.totalEmployees === 0 ? "No employees" : `${s.activeBooks} active books`}
            />
          </>
        ) : null}
      </div>

      {/* ── Insights strip ──────────────────────────────────────────────────── */}
      {!loading && insights.length > 0 && (
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-emerald-50/30 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lightning weight="fill" className="size-4 text-primary" />
            </div>
            <h3 className="font-bold text-sm">Insights</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {insights.map((ins, i) => (
              <div key={i} className={cn(
                "flex items-start gap-2 px-3 py-2 rounded-xl border text-sm",
                ins.tone === "good" ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
                ins.tone === "warn" ? "bg-amber-50 border-amber-200 text-amber-900" :
                                       "bg-background border-border text-foreground"
              )}>
                <span className={cn(
                  "size-1.5 rounded-full mt-1.5 shrink-0",
                  ins.tone === "good" ? "bg-emerald-500" :
                  ins.tone === "warn" ? "bg-amber-500" : "bg-primary"
                )} />
                <span className="leading-snug">{ins.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Trend area chart */}
        <div className="lg:col-span-2 border rounded-2xl bg-card shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <TrendUp weight="fill" className="size-4 text-primary" />
                Sales Trend
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tickets sold per day · {PERIOD_LABEL[period]}</p>
            </div>
            {!loading && trend.length > 0 && (
              <div className="text-right shrink-0">
                <p className="text-2xl font-black tabular-nums leading-none">{fmtNum(todaySold)}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Today</p>
                {trendDelta !== null && (
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-md",
                    trendDelta >= 0 ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100"
                  )}>
                    {trendDelta >= 0 ? <ArrowUp className="size-2.5" weight="bold" /> : <ArrowDown className="size-2.5" weight="bold" />}
                    {Math.abs(trendDelta)}%
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <Skel className="h-[200px] w-full" />
          ) : trend.length === 0 || trend.every((t) => t.sold === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <TrendUp className="size-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No sales activity in this period</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Clock in employees to start recording sales</p>
            </div>
          ) : (
            <TrendArea
              data={trendChartData}
              dataKey="sold"
              color={CHART_COLORS.primary}
              height={220}
              valueFormatter={(v) => `${v.toLocaleString()} sold`}
              labelFormatter={(d) => fmtDayShort(d, trend.length)}
            />
          )}
        </div>

        {/* Inventory donut */}
        <div className="border rounded-2xl bg-card shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Package weight="fill" className="size-4 text-violet-600" />
                Inventory
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Books by status</p>
            </div>
            <Link href="/owner/inventory" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              Manage <ArrowRight className="size-3" />
            </Link>
          </div>

          {loading ? (
            <Skel className="h-[200px] w-full rounded-full" />
          ) : !s || s.totalBooks === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Package className="size-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No books yet</p>
              <Link href="/owner/inventory" className="text-xs text-primary hover:underline font-semibold mt-1">
                Add your first shipment →
              </Link>
            </div>
          ) : (
            <>
              <InventoryDonut data={inventoryDonutData} valueFormatter={(v) => `${v.toLocaleString()} books`} />
              <div className="space-y-1.5 pt-2 border-t">
                {inventoryDonutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="font-medium">{d.name}</span>
                    </div>
                    <span className="font-bold tabular-nums">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tickets sold by tier (bar chart) ────────────────────────────────── */}
      <div className="border rounded-2xl bg-card shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <ChartBar weight="fill" className="size-4 text-blue-600" />
              Tickets Sold by Type
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABEL[period]} · {totalSold.toLocaleString()} tickets · {fmtCurrency(revenue)} revenue</p>
          </div>
        </div>

        {loading ? (
          <Skel className="h-[220px] w-full" />
        ) : totalSold === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Ticket className="size-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No tickets sold in this period</p>
          </div>
        ) : (
          <>
            <TierBars data={tierChartData} valueFormatter={(v) => `${v.toLocaleString()} tickets`} />
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-2 border-t">
              {tierChartData.map((t) => (
                <div key={t.price} className="text-center space-y-0.5">
                  <p className="text-xs font-bold" style={{ color: TIER_HEX[t.price] }}>{t.tier}</p>
                  <p className="text-sm font-black tabular-nums">{t.sold.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">${t.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Inventory by tier breakdown ─────────────────────────────────────── */}
      <div className="border rounded-2xl bg-card shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <BookOpen weight="fill" className="size-4 text-emerald-600" />
              Inventory by Ticket Type
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">All books — current state</p>
          </div>
          <Link href="/owner/books" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
            Activate / Settle <ArrowRight className="size-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => <Skel key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : s?.totalBooks === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Package className="size-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No books in inventory</p>
            <Link href="/owner/inventory" className="text-xs text-primary hover:underline font-semibold mt-1">
              Add your first shipment →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {PRICE_TIERS.map((price) => {
              const tier = booksByTier[price] ?? { active: 0, settled: 0, unactivated: 0, total: 0 };
              if (tier.total === 0) return (
                <div key={price} className="rounded-xl border border-dashed p-3 space-y-1 text-center opacity-40">
                  <p className="text-sm font-black text-muted-foreground">{TIER_LABELS[price]}</p>
                  <p className="text-[10px] text-muted-foreground">No stock</p>
                </div>
              );
              const activePct = Math.round((tier.active / tier.total) * 100);
              return (
                <div key={price} className="rounded-xl border p-3 space-y-2 bg-background hover:shadow-md transition-shadow"
                  style={{ borderColor: `${TIER_HEX[price]}33` }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black" style={{ color: TIER_HEX[price] }}>{TIER_LABELS[price]}</p>
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{tier.total}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-700 font-medium">Active</span>
                      <span className="font-bold tabular-nums">{tier.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock</span>
                      <span className="font-medium tabular-nums">{tier.unactivated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Settled</span>
                      <span className="font-medium tabular-nums">{tier.settled}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${activePct}%`, background: TIER_HEX[price] }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center tabular-nums">{activePct}% active</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick actions (always visible, mobile prominent) ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Inventory",      href: "/owner/inventory",  icon: Package,   color: "text-violet-600" },
          { label: "Activate Books", href: "/owner/books",      icon: BookOpen,  color: "text-emerald-600" },
          { label: "Slots",          href: "/owner/slots",      icon: GridFour,  color: "text-blue-600" },
          { label: "Management",     href: "/owner/management", icon: Users,     color: "text-amber-600" },
        ].map(({ label, href, icon: Icon, color }) => (
          <Link key={label} href={href}
            className="flex items-center gap-3 border rounded-2xl px-4 py-3 bg-card hover:shadow-md hover:border-primary/40 transition-all">
            <div className="size-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Icon className={cn("size-4", color)} weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{label}</p>
              <p className="text-[10px] text-muted-foreground">View →</p>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </Link>
        ))}
      </div>

    </div>
  );
}
