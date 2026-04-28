"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, Ticket, TrendUp, ChartLineUp, CalendarBlank,
  ArrowClockwise, CurrencyDollar, ArrowUp, ArrowDown,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TrendArea, CHART_COLORS, TIER_HEX } from "@/components/charts";
import { useAuth } from "@/components/auth-provider";

type Shift = {
  shiftId:             string;
  slotNum:             number;
  ticketStart:         number;
  ticketEnd?:          number;
  clockIn:             string;
  clockOut?:           string;
  status:              "active" | "completed";
  sold?:               number;
  bookPrice?:          number;
  finalCalc?:          number;
  discrepancySeverity?: "none" | "over" | "short";
};

type Period = "7d" | "30d" | "90d" | "all";

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "all": "All time",
};

function fmtDurationMs(ms: number) {
  const totalSecs = Math.round(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const day   = new Date(d); day.setHours(0,0,0,0);
  const diff  = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)   return d.toLocaleDateString("en-US", { weekday: "long" });
  return fmtDate(iso);
}

export default function EmployeeDashboardPage() {
  const { user }               = useAuth();
  const [shifts,  setShifts]   = useState<Shift[]>([]);
  const [loading, setLoading]  = useState(true);
  const [period,  setPeriod]   = useState<Period>("7d");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shifts");
    if (res.ok) {
      const data = await res.json() as { shifts: Shift[]; active: Shift | null };
      setShifts(data.shifts.filter((s) => s.status === "completed"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter by period
  const periodShifts = useMemo(() => {
    if (period === "all") return shifts;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 86_400_000;
    return shifts.filter((s) => new Date(s.clockIn).getTime() >= cutoff);
  }, [shifts, period]);

  const totalSold     = periodShifts.reduce((s, sh) => s + (sh.sold ?? 0), 0);
  const avgPerShift   = periodShifts.length > 0 ? Math.round(totalSold / periodShifts.length) : 0;
  const totalRevenue  = periodShifts.reduce((s, sh) => s + (sh.finalCalc ?? 0), 0);
  const totalMs       = periodShifts.reduce((acc, sh) =>
    acc + (sh.clockOut ? new Date(sh.clockOut).getTime() - new Date(sh.clockIn).getTime() : 0), 0);

  const soldByTier = useMemo(() => {
    const map: Record<number, number> = {};
    for (const sh of periodShifts) {
      const price = sh.bookPrice ?? 0;
      if (price > 0) map[price] = (map[price] ?? 0) + (sh.sold ?? 0);
    }
    return map;
  }, [periodShifts]);

  // Daily chart data
  const dailyChart = useMemo(() => {
    if (periodShifts.length === 0) return [];
    const days = period === "all" ? 30 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const out: { day: string; sold: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0, 10);
      const sold = periodShifts
        .filter((sh) => sh.clockIn.slice(0, 10) === key)
        .reduce((s, sh) => s + (sh.sold ?? 0), 0);
      out.push({ day: key, sold });
    }
    return out;
  }, [periodShifts, period]);

  const todaySold     = dailyChart.at(-1)?.sold ?? 0;
  const yesterdaySold = dailyChart.at(-2)?.sold ?? 0;
  const trendDelta    = yesterdaySold > 0 ? Math.round(((todaySold - yesterdaySold) / yesterdaySold) * 100) : null;
  const discrepancyCount = periodShifts.filter((s) => s.discrepancySeverity && s.discrepancySeverity !== "none").length;

  return (
    <div className="px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Welcome back</p>
          <h1 className="text-2xl font-black tracking-tight">{user?.name ?? "Employee"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 border rounded-xl bg-muted/40 p-0.5">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn(
                  "px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all uppercase",
                  period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}>
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[
          {
            label: "Tickets Sold", value: loading ? "—" : totalSold.toLocaleString(),
            icon: Ticket, color: "text-primary", bg: "from-primary/10",
            sub: trendDelta !== null ? { text: `${trendDelta >= 0 ? "+" : ""}${trendDelta}%`, positive: trendDelta >= 0 } : null,
          },
          {
            label: "Revenue", value: loading ? "—" : `$${totalRevenue >= 1000 ? `${(totalRevenue/1000).toFixed(1)}k` : totalRevenue.toFixed(0)}`,
            icon: CurrencyDollar, color: "text-emerald-600", bg: "from-emerald-100/40",
            sub: null,
          },
          {
            label: "Shifts", value: loading ? "—" : String(periodShifts.length),
            icon: CalendarBlank, color: "text-violet-600", bg: "from-violet-100/40",
            sub: null,
          },
          {
            label: "Hours", value: loading ? "—" : fmtDurationMs(totalMs),
            icon: Clock, color: "text-blue-600", bg: "from-blue-100/40",
            sub: null,
          },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className={cn("relative bg-card border rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all overflow-hidden")}>
            <div className={cn("absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl to-transparent opacity-60 -mr-8 -mt-8 rounded-full blur-2xl", bg)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
                <Icon className={cn("size-3.5 sm:size-4", color)} weight="fill" />
              </div>
              <p className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums">{value}</p>
              {sub && (
                <p className={cn(
                  "text-[10px] font-bold mt-1 inline-flex items-center gap-0.5",
                  sub.positive ? "text-emerald-600" : "text-rose-600"
                )}>
                  {sub.positive ? <ArrowUp className="size-2.5" weight="bold" /> : <ArrowDown className="size-2.5" weight="bold" />}
                  {sub.text} vs yesterday
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <ChartLineUp weight="fill" className="size-4 text-primary" />
              Your Sales Trend
            </h2>
            <p className="text-xs text-muted-foreground">{PERIOD_LABEL[period]}</p>
          </div>
          {!loading && (
            <div className="text-right">
              <p className="text-lg font-black tabular-nums leading-none">{todaySold}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">today</p>
            </div>
          )}
        </div>
        {loading ? (
          <div className="h-32 bg-muted/40 rounded-xl animate-pulse" />
        ) : totalSold === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-1">
            <Ticket className="size-9 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No sales activity in this period</p>
          </div>
        ) : (
          <TrendArea data={dailyChart} dataKey="sold" color={CHART_COLORS.primary} height={140}
            valueFormatter={(v) => `${v.toLocaleString()} sold`}
            labelFormatter={(d) => d.slice(5)} />
        )}
      </div>

      {/* Tier breakdown */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Tickets by Price</h2>
          <p className="text-xs text-muted-foreground">avg <span className="font-bold tabular-nums text-foreground">{avgPerShift}</span>/shift</p>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 bg-muted rounded-full animate-pulse" />)}
          </div>
        ) : Object.keys(soldByTier).length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No tier data yet</p>
        ) : (
          <div className="space-y-2.5">
            {PRICE_TIERS.filter((p) => (soldByTier[p] ?? 0) > 0).map((price) => {
              const sold = soldByTier[price];
              const max  = Math.max(1, ...Object.values(soldByTier));
              const pct  = Math.round((sold / max) * 100);
              return (
                <div key={price} className="flex items-center gap-3">
                  <span className="text-xs font-black w-9 shrink-0 text-right tabular-nums" style={{ color: TIER_HEX[price] }}>
                    ${price}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-7 overflow-hidden relative">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(pct, 4)}%`, background: TIER_HEX[price] }} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white tabular-nums">
                      {sold.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground w-14 shrink-0 text-right font-mono tabular-nums">
                    ${(sold * price).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Discrepancy heads-up */}
      {discrepancyCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <CurrencyDollar weight="fill" className="size-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {discrepancyCount} shift{discrepancyCount !== 1 ? "s" : ""} with cash discrepancy
            </p>
            <p className="text-xs text-amber-700">Review these in your shift history below</p>
          </div>
        </div>
      )}

      {/* Shift history */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <Clock className="size-4 text-muted-foreground" /> Shift History
          </h2>
          <p className="text-xs text-muted-foreground">{periodShifts.length} shift{periodShifts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-card border rounded-2xl divide-y overflow-hidden shadow-sm">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-28" />
                  <div className="h-3 bg-muted rounded animate-pulse w-20" />
                </div>
                <div className="h-4 bg-muted rounded animate-pulse w-16" />
              </div>
            ))
          ) : periodShifts.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <Clock className="size-9 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">No shifts in this period</p>
              {period !== "all" && (
                <button onClick={() => setPeriod("all")} className="text-xs text-primary hover:underline font-semibold">
                  View all time →
                </button>
              )}
            </div>
          ) : (
            periodShifts.slice().sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).map((s) => {
              const durationMs = s.clockOut ? new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime() : 0;
              const sold = s.sold ?? 0;
              const tierColor = s.bookPrice ? TIER_HEX[s.bookPrice] : "#0d9488";
              return (
                <div key={s.shiftId} className="px-4 py-3 sm:py-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="size-10 rounded-xl flex flex-col items-center justify-center text-[10px] font-black shrink-0"
                        style={{ background: `${tierColor}1a`, color: tierColor }}>
                        <span className="text-sm leading-none">${s.bookPrice ?? "?"}</span>
                        <span className="text-[8px] opacity-70 mt-0.5">slot {s.slotNum}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm">{fmtRelDate(s.clockIn)}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtTime(s.clockIn)}{s.clockOut ? ` – ${fmtTime(s.clockOut)}` : ""}
                          {durationMs > 0 && ` · ${fmtDurationMs(durationMs)}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          #{s.ticketStart}→#{s.ticketEnd ?? "?"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-primary tabular-nums">{sold.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">sold</p>
                      {s.finalCalc != null && (
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">${s.finalCalc.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  {s.discrepancySeverity && s.discrepancySeverity !== "none" && (
                    <div className={cn(
                      "mt-2 text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold",
                      s.discrepancySeverity === "over"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}>
                      {s.discrepancySeverity === "over" ? "Cash over" : "Cash short"}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer hint */}
      {!loading && periodShifts.length > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-2">
          <TrendUp className="size-3 inline mr-1" /> Keep up the good work!
        </p>
      )}
    </div>
  );
}
