"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowClockwise, Warning, CheckCircle, Package,
  Users, BookOpen, Ticket, TrendUp, ArrowRight,
  X, SealWarning,
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
  const { user } = useAuth();
  const [data,       setData]       = useState<Analytics | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const r = await fetch("/api/analytics");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const warnings = (data?.warnings ?? []).filter((w) => !dismissed.has(w.type));
  const s        = data?.summary;

  // Bar chart helpers
  const maxSold   = Math.max(1, ...Object.values(data?.soldByTier  ?? {}));
  const maxBooks  = Math.max(1, ...Object.values(data?.booksByTier ?? {}).map((t) => t.total));
  const trendMax  = Math.max(1, ...(data?.trend ?? []).map((t) => t.sold));

  const STAT_CARDS = s ? [
    { label: "Tickets Sold",   value: s.totalTicketsSold.toLocaleString(), icon: Ticket,   color: "text-primary",        desc: "across all shifts" },
    { label: "Active Books",   value: s.activeBooks,                        icon: BookOpen, color: "text-emerald-600",    desc: `${s.settledBooks} settled` },
    { label: "Total Books",    value: s.totalBooks,                         icon: Package,  color: "text-violet-600",     desc: "in inventory" },
    { label: "Active Staff",   value: `${s.activeEmployees}/${s.totalEmployees}`, icon: Users, color: "text-blue-600", desc: "employees" },
  ] : [];

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.orgName ?? "Loading…"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <Link href="/owner/inventory"
            className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity font-medium shadow-sm">
            + Add Shipment
          </Link>
        </div>
      </div>

      {/* Warning notifications */}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-2xl p-4 space-y-3">
                <div className="h-3 bg-muted rounded animate-pulse w-20" />
                <div className="h-8 bg-muted rounded animate-pulse w-12" />
                <div className="h-3 bg-muted rounded animate-pulse w-16" />
              </div>
            ))
          : STAT_CARDS.map(({ label, value, icon: Icon, color, desc }) => (
              <div key={label} className="border rounded-2xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <Icon className={cn("size-4", color)} weight="fill" />
                </div>
                <p className="text-3xl font-black tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
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

        {/* ── 7-day trend ── */}
        <div className="border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">7-Day Trend</h2>
            <span className="text-xs text-muted-foreground">tickets/day</span>
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
                  <span key={t.day} className="flex-1 text-center text-[9px] text-muted-foreground">{fmtDay(t.day)}</span>
                ))}
              </div>
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
