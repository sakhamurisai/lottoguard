"use client";

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

type TooltipPayloadItem = {
  color?: string;
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
};

// ── Shared palette (matches globals.css chart tokens & price tiers) ────────────
export const TIER_HEX: Record<number, string> = {
   1: "#10b981", // emerald
   2: "#14b8a6", // teal
   5: "#0ea5e9", // sky
  10: "#3b82f6", // blue
  20: "#8b5cf6", // violet
  30: "#d946ef", // fuchsia
  50: "#f43f5e", // rose
};

export const CHART_COLORS = {
  primary:   "#0d9488", // teal-600 (matches --primary)
  emerald:   "#10b981",
  blue:      "#3b82f6",
  amber:     "#f59e0b",
  rose:      "#f43f5e",
  violet:    "#8b5cf6",
  slate:     "#64748b",
  muted:     "#e2e8f0",
};

// ── Tooltip styling ───────────────────────────────────────────────────────────
function ChartTooltip(props: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (n: number) => string;
  labelFormatter?: (l: string) => string;
}) {
  const { active, payload, label, valueFormatter, labelFormatter } = props;
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-md shadow-lg px-3 py-2 text-xs">
      {label != null && (
        <p className="font-semibold text-foreground mb-1">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      )}
      <div className="space-y-0.5">
        {payload.map((p: TooltipPayloadItem, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="font-bold tabular-nums ml-auto">
              {valueFormatter && typeof p.value === "number" ? valueFormatter(p.value) : String(p.value ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Area chart (revenue trend) ────────────────────────────────────────────────
export function TrendArea({
  data, dataKey = "sold", xKey = "day", color = CHART_COLORS.primary,
  height = 200, valueFormatter, labelFormatter,
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  height?: number;
  valueFormatter?: (n: number) => string;
  labelFormatter?: (l: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-muted-foreground/15" vertical={false} />
        <XAxis dataKey={xKey} stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
          tickFormatter={(v) => labelFormatter ? labelFormatter(String(v)) : String(v)} />
        <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
        <Tooltip content={(p: object) => <ChartTooltip {...(p as Record<string, unknown>)} valueFormatter={valueFormatter} labelFormatter={labelFormatter} />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Bar chart (tickets by tier) ───────────────────────────────────────────────
export function TierBars({
  data, xKey = "tier", yKey = "sold", height = 220, valueFormatter,
}: {
  data: { tier: string; sold: number; price: number }[];
  xKey?: string;
  yKey?: string;
  height?: number;
  valueFormatter?: (n: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 6, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-muted-foreground/15" vertical={false} />
        <XAxis dataKey={xKey} stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} />
        <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={(p: object) => <ChartTooltip {...(p as Record<string, unknown>)} valueFormatter={valueFormatter} />} />
        <Bar dataKey={yKey} radius={[8, 8, 0, 0]} maxBarSize={48}>
          {data.map((d, i) => (
            <Cell key={i} fill={TIER_HEX[d.price] ?? CHART_COLORS.primary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Donut chart (inventory split) ─────────────────────────────────────────────
export function InventoryDonut({
  data, height = 200, valueFormatter,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  valueFormatter?: (n: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={56} outerRadius={84} paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={(p: object) => <ChartTooltip {...(p as Record<string, unknown>)} valueFormatter={valueFormatter} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xl font-black tabular-nums">{total.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
      </div>
    </div>
  );
}

// ── Sparkline (small inline trend) ────────────────────────────────────────────
export function Sparkline({
  data, dataKey = "v", color = CHART_COLORS.primary, height = 36,
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Stacked bar (multi-tier breakdown over time) ──────────────────────────────
export function StackedTierBars({
  data, height = 240, valueFormatter,
}: {
  data: Record<string, number | string>[];
  height?: number;
  valueFormatter?: (n: number) => string;
}) {
  const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-muted-foreground/15" vertical={false} />
        <XAxis dataKey="day" stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={(p: object) => <ChartTooltip {...(p as Record<string, unknown>)} valueFormatter={valueFormatter} />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
        {PRICE_TIERS.map((p) => (
          <Bar key={p} dataKey={`$${p}`} stackId="a" fill={TIER_HEX[p]} radius={[0, 0, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Stat card with optional sparkline ─────────────────────────────────────────
export function StatCard({
  label, value, sub, icon: Icon, accent = "text-primary",
  trend, trendData, trendColor,
}: {
  label: string;
  value: string | number;
  sub?: { text: string; positive: boolean } | string | null;
  icon: React.ElementType;
  accent?: string;
  trend?: number | null;
  trendData?: { v: number }[];
  trendColor?: string;
}) {
  return (
    <div className="border rounded-2xl p-4 bg-card shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
        <Icon className={cn("size-4", accent)} weight="fill" />
      </div>
      <div className="flex items-end justify-between gap-2 mb-1">
        <p className="text-3xl font-black tracking-tight tabular-nums leading-none">{value}</p>
        {trend != null && (
          <span className={cn(
            "text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md",
            trend >= 0 ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100"
          )}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      {sub && (typeof sub === "string"
        ? <p className="text-xs text-muted-foreground">{sub}</p>
        : <p className={cn("text-xs font-medium", sub.positive ? "text-emerald-600" : "text-rose-500")}>{sub.text}</p>
      )}
      {trendData && trendData.length > 1 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={trendData} color={trendColor ?? CHART_COLORS.primary} height={28} />
        </div>
      )}
    </div>
  );
}
