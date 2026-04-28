"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowClockwise, CheckCircle, Package,
  Users, BookOpen, Ticket, TrendUp, ArrowRight,
  Warning,
  Bell,
  SealWarning,
  X,
  CurrencyDollar,
  ChartBar,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Summary = {
  totalBooks: number; activeBooks: number; settledBooks: number;
  totalEmployees: number; activeEmployees: number;
  totalTicketsSold: number; filledSlots: number; totalSlots: number;
};
type BooksByTier  = Record<number, { active: number; settled: number; unactivated: number; total: number }>;
type SoldByTier   = Record<number, number>;
type TrendPoint   = { day: string; sold: number };
type AnalyticsWarning = { type: string; message: string; severity: "error" | "warning" };

type Analytics = {
  summary: Summary;
  booksByTier: BooksByTier;
  soldByTier: SoldByTier;
  trend: TrendPoint[];
  warnings: AnalyticsWarning[];
  estimatedRevenue: number;
  period: string;
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

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];
const TIER_LABELS: Record<number, string> = { 1: "$1", 2: "$2", 5: "$5", 10: "$10", 20: "$20", 30: "$30", 50: "$50" };

const TIER_COLOR: Record<number, { bar: string; bg: string; text: string; dot: string }> = {
   1: { bar: "bg-green-500",   bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
   2: { bar: "bg-teal-500",    bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-teal-500"   },
   5: { bar: "bg-blue-500",    bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  10: { bar: "bg-violet-500",  bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-500" },
  20: { bar: "bg-purple-500",  bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500" },
  30: { bar: "bg-pink-500",    bg: "bg-pink-50",    text: "text-pink-700",   dot: "bg-pink-500"   },
  50: { bar: "bg-rose-500",    bg: "bg-rose-50",    text: "text-rose-700",   dot: "bg-rose-500"   },
};

function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [data,       setData]       = useState<Analytics | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set());
  const [notifs,     setNotifs]     = useState<Notif[]>([]);
  const [ackedNotifs,setAckedNotifs]= useState<Set<string>>(new Set());
  const [period,      setPeriod]      = useState<"7d" | "30d" | "90d" | "all">("7d");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    const [analyticsRes, notifRes] = await Promise.all([
      fetch(`/api/analytics?period=${period}`),
      fetch("/api/notifications"),
    ]);
    if (analyticsRes.ok) setData(await analyticsRes.json());
    if (notifRes.ok) {
      const nd = await notifRes.json() as { notifications: Notif[] };
      setNotifs(nd.notifications ?? []);
    }
    setLoading(false);
    setLastUpdated(new Date());
  }

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

  useEffect(() => {
    if (!authLoading && user) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, period]);

  const warnings = (data?.warnings ?? []).filter((w) => !dismissed.has(w.type));

  // Split notifications by severity — emergency ones can never be silently dismissed
  const emergencyNotifs = notifs.filter((n) => n.severity === "emergency" && !ackedNotifs.has(n.SK));
  const importantNotifs = notifs.filter((n) => n.severity === "important" && !n.read && !ackedNotifs.has(n.SK));
  const unreadCount     = notifs.filter((n) => !n.read && !ackedNotifs.has(n.SK)).length;
  const s = data?.summary;

  // Bar chart helpers
  const maxSold   = Math.max(1, ...Object.values(data?.soldByTier  ?? {}));
  const maxBooks  = Math.max(1, ...Object.values(data?.booksByTier ?? {}).map((t) => t.total));
  const trendMax  = Math.max(1, ...(data?.trend ?? []).map((t) => t.sold));

  // Derived metrics
  const estimatedRevenue = data?.estimatedRevenue ?? 0;
  const slotFillPct = s && s.totalSlots > 0
    ? Math.round((s.filledSlots / s.totalSlots) * 100)
    : null;

  // Today vs yesterday tickets
  const trend      = data?.trend ?? [];
  const todaySold  = trend[trend.length - 1]?.sold ?? 0;
  const yestSold   = trend[trend.length - 2]?.sold ?? 0;
  const trendDelta = yestSold > 0 ? Math.round(((todaySold - yestSold) / yestSold) * 100) : null;

  const STAT_CARDS = s ? [
    {
      label: "Revenue Est.",
      value: `$${estimatedRevenue >= 1000 ? `${(estimatedRevenue / 1000).toFixed(1)}k` : estimatedRevenue.toLocaleString()}`,
      icon: CurrencyDollar,
      color: "text-emerald-600",
      desc: "from tickets sold",
      sub: null,
    },
    {
      label: "Tickets Sold",
      value: s.totalTicketsSold.toLocaleString(),
      icon: Ticket,
      color: "text-primary",
      desc: "across all shifts",
      sub: trendDelta !== null
        ? { text: `${trendDelta >= 0 ? "+" : ""}${trendDelta}% vs yesterday`, positive: trendDelta >= 0 }
        : null,
    },
    {
      label: "Active Books",
      value: s.activeBooks,
      icon: BookOpen,
      color: "text-violet-600",
      desc: `${s.settledBooks} settled · ${s.totalBooks - s.activeBooks - s.settledBooks} stock`,
      sub: null,
    },
    {
      label: "Slot Utilization",
      value: slotFillPct !== null ? `${slotFillPct}%` : "—",
      icon: ChartBar,
      color: slotFillPct !== null && slotFillPct < 50 ? "text-amber-500" : "text-blue-600",
      desc: `${s.filledSlots} of ${s.totalSlots} slots filled`,
      sub: null,
    },
    {
      label: "Active Staff",
      value: `${s.activeEmployees}/${s.totalEmployees}`,
      icon: Users,
      color: "text-blue-600",
      desc: "employees",
      sub: null,
    },
  ] : [];

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.orgName ?? "Loading…"}</p>
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
          <div className="flex items-center gap-0.5 border rounded-xl overflow-hidden bg-muted/40 p-0.5">
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
          <div className="flex flex-col items-end gap-0.5">
            <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
              <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
            </button>
            {lastUpdated && (
              <p className="text-[10px] text-muted-foreground text-right whitespace-nowrap">
                Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 60000) < 1
                  ? "just now"
                  : `${Math.floor((Date.now() - lastUpdated.getTime()) / 60000)}m ago`}
              </p>
            )}
          </div>
          <Link href="/owner/inventory"
            className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity font-medium shadow-sm">
            + Add Shipment
          </Link>
        </div>
      </div>

      {/* Emergency notifications — persistent, require acknowledgement */}
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
                <p className="font-bold text-red-700 text-xs uppercase tracking-wide mb-1">⚠ Emergency Alert</p>
                <p className="leading-snug font-medium">{n.message}</p>
                {n.empName && <p className="text-xs text-red-600/70 mt-1">Employee: {n.empName}</p>}
                {(n.detail?.note as string | undefined) && (
                  <p className="text-xs mt-1 italic text-red-700/80">Note: {n.detail!.note as string}</p>
                )}
                <p className="text-xs text-red-600/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => acknowledgeNotif(n.SK)}
                className="shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap">
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Important notifications */}
      {importantNotifs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Bell className="size-3.5" />Important Alerts ({importantNotifs.length})
            </p>
            <button onClick={acknowledgeAll}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
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
              <button onClick={() => acknowledgeNotif(n.SK)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analytics warnings */}
      {!loading && warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w) => (
            <div
              key={w.type}
              className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
                w.severity === "error"
                  ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300"
                  : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300"
              )}
            >
              {w.severity === "error"
                ? <SealWarning weight="fill" className="size-4 shrink-0 mt-0.5 text-red-500" />
                : <Warning weight="fill" className="size-4 shrink-0 mt-0.5 text-amber-500" />
              }
              <span className="flex-1">{w.message}</span>
              <button onClick={() => setDismissed((prev) => new Set([...prev, w.type]))}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border rounded-2xl p-4 space-y-3">
                <div className="h-3 bg-muted rounded animate-pulse w-20" />
                <div className="h-8 bg-muted rounded animate-pulse w-12" />
                <div className="h-3 bg-muted rounded animate-pulse w-16" />
              </div>
            ))
          : STAT_CARDS.map(({ label, value, icon: Icon, color, desc, sub }) => (
              <div key={label} className="border rounded-2xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <Icon className={cn("size-4", color)} weight="fill" />
                </div>
                <p className="text-3xl font-black tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {sub && (
                  <p className={cn("text-[11px] font-semibold", sub.positive ? "text-emerald-600" : "text-red-500")}>
                    {sub.text}
                  </p>
                )}
              </div>
            ))
        }
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Tickets sold by type ── */}
        <div className="lg:col-span-2 border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Tickets Sold by Type</h2>
            <TrendUp className="size-4 text-muted-foreground" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 bg-muted rounded animate-pulse w-8 shrink-0" />
                  <div className="flex-1 h-7 bg-muted rounded-lg animate-pulse" style={{ width: `${40 + i * 10}%` }} />
                  <div className="h-3 bg-muted rounded animate-pulse w-8 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {PRICE_TIERS.map((price) => {
                const sold  = data?.soldByTier[price] ?? 0;
                const tc    = TIER_COLOR[price];
                const pct   = Math.round((sold / maxSold) * 100);
                return (
                  <div key={price} className="flex items-center gap-3">
                    <span className={cn("text-xs font-bold w-8 shrink-0 text-right", tc.text)}>
                      {TIER_LABELS[price]}
                    </span>
                    <div className="flex-1 bg-muted/50 rounded-lg h-8 overflow-hidden relative">
                      <div
                        className={cn("h-full rounded-lg transition-all duration-700", tc.bar)}
                        style={{ width: sold > 0 ? `${Math.max(pct, 2)}%` : "0%" }}
                      />
                      {sold > 0 && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                          {sold.toLocaleString()} tickets
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground w-12 shrink-0 text-right font-mono">
                      {sold > 0 ? `$${(sold * price).toLocaleString()}` : "—"}
                    </span>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground pt-1">
                Estimated revenue based on ticket price × tickets sold per shift
              </p>
            </div>
          )}
        </div>

        {/* ── trend ── */}
        <div className="border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              {period === "7d" ? "7-Day Trend" : period === "30d" ? "30-Day Trend" : period === "90d" ? "90-Day Trend" : "All-Time Trend"}
            </h2>
            {!loading && (
              <div className="text-right">
                <p className="text-sm font-bold">{todaySold.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">
                  {period === "7d" ? "Past 7 days" : period === "30d" ? "Past 30 days" : period === "90d" ? "Past 90 days" : "All time"}
                </p>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex items-end gap-1.5 h-28">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 bg-muted rounded-t-md animate-pulse" style={{ height: `${30 + i * 8}%` }} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-28">
                {(data?.trend ?? []).map((t) => {
                  const h = trendMax > 0 ? Math.max(4, Math.round((t.sold / trendMax) * 100)) : 4;
                  const isToday = t.day === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={t.day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn("w-full rounded-t-md transition-all duration-500", isToday ? "bg-primary" : "bg-primary/25")}
                        style={{ height: `${h}%` }}
                        title={`${t.sold} sold`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                {(data?.trend ?? []).map((t) => (
                  <span key={t.day} className={cn("flex-1 text-center text-[9px]",
                    t.day === new Date().toISOString().slice(0, 10)
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  )}>{fmtDay(t.day)}</span>
                ))}
              </div>
              {trendDelta !== null && (
                <p className={cn("text-[11px] font-semibold text-center",
                  trendDelta >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                  {trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta)}% vs yesterday
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Inventory by ticket type ── */}
      <div className="border rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Inventory by Ticket Type</h2>
          <Link href="/owner/inventory" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            Manage <ArrowRight className="size-3" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
            {PRICE_TIERS.map((price) => {
              const tier = data?.booksByTier[price] ?? { active: 0, settled: 0, unactivated: 0, total: 0 };
              const tc   = TIER_COLOR[price];
              const pct  = tier.total > 0 ? Math.round((tier.active / maxBooks) * 100) : 0;
              return (
                <div key={price} className={cn("rounded-xl border p-3 space-y-2 text-center", tc.bg)}>
                  <p className={cn("text-sm font-black", tc.text)}>{TIER_LABELS[price]}</p>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex justify-between gap-1">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-bold">{tier.active}</span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-muted-foreground">Settled</span>
                      <span className="font-medium">{tier.settled}</span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-muted-foreground">Stock</span>
                      <span className="font-medium">{tier.unactivated}</span>
                    </div>
                  </div>
                  {tier.total > 0 && (
                    <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", tc.bar)} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500 inline-block"/>Active — currently in machine</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/40 inline-block"/>Settled — fully sold</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/30 inline-block"/>Stock — not yet activated</span>
        </div>
      </div>

      {/* Quick links — mobile */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {[
          { label: "Inventory",         href: "/owner/inventory",  icon: Package  },
          { label: "Activate / Settle",  href: "/owner/books",      icon: BookOpen },
          { label: "Slots",             href: "/owner/slots",      icon: CheckCircle },
          { label: "Management",        href: "/owner/management", icon: Users    },
        ].map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href}
            className="flex items-center gap-2.5 border rounded-2xl px-4 py-3.5 text-sm font-medium hover:bg-accent transition-colors">
            <Icon className="size-4 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
