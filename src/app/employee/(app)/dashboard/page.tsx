"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Ticket, TrendingUp, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

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

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];

const TIER_COLOR: Record<number, string> = {
   1: "bg-green-500",  2: "bg-teal-500",   5: "bg-blue-500",
  10: "bg-violet-500",20: "bg-purple-500", 30: "bg-pink-500", 50: "bg-rose-500",
};

const TIER_TEXT: Record<number, string> = {
   1: "text-green-700",  2: "text-teal-700",   5: "text-blue-700",
  10: "text-violet-700",20: "text-purple-700", 30: "text-pink-700", 50: "text-rose-700",
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { mon, sun };
}

export default function EmployeeDashboardPage() {
  const [shifts,  setShifts]  = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

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

  const completed   = shifts;
  const totalSold   = completed.reduce((s, sh) => s + (sh.sold ?? 0), 0);
  const avgPerShift = completed.length > 0 ? Math.round(totalSold / completed.length) : 0;

  const soldByTier: Record<number, number> = {};
  for (const sh of completed) {
    const price = sh.bookPrice ?? 0;
    if (price > 0) soldByTier[price] = (soldByTier[price] ?? 0) + (sh.sold ?? 0);
  }
  const maxTierSold = Math.max(1, ...Object.values(soldByTier));

  const { mon, sun } = getWeekRange();
  const weekMs = completed.reduce((s, sh) => {
    if (!sh.clockOut) return s;
    const ci = new Date(sh.clockIn);
    if (ci < mon || ci > sun) return s;
    return s + (new Date(sh.clockOut).getTime() - ci.getTime());
  }, 0);

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-5">
      <h1 className="text-lg font-bold">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Tickets Sold",    value: totalSold.toLocaleString(), icon: Ticket,     color: "text-primary"     },
          { label: "Shifts Worked",   value: String(completed.length),   icon: Clock,      color: "text-violet-600"  },
          { label: "Hours This Week", value: fmtDurationMs(weekMs),      icon: TrendingUp, color: "text-emerald-600" },
          { label: "Avg per Shift",   value: String(avgPerShift),        icon: LayoutGrid, color: "text-blue-600"    },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <Icon className={cn("size-4", color)} />
            </div>
            <p className="text-3xl font-black tracking-tight">{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="bg-card border rounded-2xl p-5 space-y-3 shadow-sm">
        <p className="text-sm font-semibold">Tickets Sold by Category</p>
        {!loading && PRICE_TIERS.filter((t) => (soldByTier[t] ?? 0) > 0).length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No completed shifts yet.</p>
        ) : (
          PRICE_TIERS.map((price) => {
            const sold = soldByTier[price] ?? 0;
            if (!sold && !loading) return null;
            const pct = loading ? 0 : Math.round((sold / maxTierSold) * 100);
            return (
              <div key={price} className="flex items-center gap-3">
                <span className={cn("text-xs font-bold w-8 shrink-0", TIER_TEXT[price])}>
                  ${price}
                </span>
                <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", loading ? "bg-muted animate-pulse" : TIER_COLOR[price])}
                    style={{ width: loading ? "40%" : `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-12 text-right">
                  {loading ? "…" : sold.toLocaleString()}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Shift history */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Clock className="size-3.5" /> Shift History
        </h2>
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
          ) : completed.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">
              No completed shifts yet.
            </p>
          ) : (
            completed.map((s) => {
              const durationMs = s.clockOut
                ? new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()
                : 0;
              return (
                <div
                  key={s.shiftId}
                  className="px-4 py-4 hover:bg-muted/20 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{fmtDate(s.clockIn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtTime(s.clockIn)}
                        {s.clockOut ? ` – ${fmtTime(s.clockOut)}` : ""}
                        {" · Slot "}{s.slotNum}
                        {durationMs > 0 && ` · ${fmtDurationMs(durationMs)}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{s.sold ?? 0} sold</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        #{s.ticketStart}→#{s.ticketEnd ?? "?"}
                      </p>
                    </div>
                  </div>
                  {s.finalCalc != null && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Final:</span>
                      <span className="font-semibold">${s.finalCalc.toFixed(2)}</span>
                      {s.discrepancySeverity === "over" && (
                        <span className="text-red-600 font-medium">⚠ Over</span>
                      )}
                      {s.discrepancySeverity === "short" && (
                        <span className="text-amber-600 font-medium">△ Short</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
