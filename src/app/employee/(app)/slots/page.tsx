"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise, GridFour, MagnifyingGlass, X, Funnel, Package,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type BookInfo = { gameName: string; pack: string; price: number; status: string };

// Updated palette to match the rest of the app (emerald → rose progression)
const TIERS = [
  { price:  1, label:  "$1", hex: "#10b981", color: "text-emerald-700",  bg: "bg-emerald-50",   border: "border-emerald-200",  headerBg: "bg-emerald-100",  dot: "bg-emerald-500" },
  { price:  2, label:  "$2", hex: "#14b8a6", color: "text-teal-700",     bg: "bg-teal-50",      border: "border-teal-200",     headerBg: "bg-teal-100",     dot: "bg-teal-500"    },
  { price:  5, label:  "$5", hex: "#0ea5e9", color: "text-sky-700",      bg: "bg-sky-50",       border: "border-sky-200",      headerBg: "bg-sky-100",      dot: "bg-sky-500"     },
  { price: 10, label: "$10", hex: "#3b82f6", color: "text-blue-700",     bg: "bg-blue-50",      border: "border-blue-200",     headerBg: "bg-blue-100",     dot: "bg-blue-500"    },
  { price: 20, label: "$20", hex: "#8b5cf6", color: "text-violet-700",   bg: "bg-violet-50",    border: "border-violet-200",   headerBg: "bg-violet-100",   dot: "bg-violet-500"  },
  { price: 30, label: "$30", hex: "#d946ef", color: "text-fuchsia-700",  bg: "bg-fuchsia-50",   border: "border-fuchsia-200",  headerBg: "bg-fuchsia-100",  dot: "bg-fuchsia-500" },
  { price: 50, label: "$50", hex: "#f43f5e", color: "text-rose-700",     bg: "bg-rose-50",      border: "border-rose-200",     headerBg: "bg-rose-100",     dot: "bg-rose-500"    },
];
const MAX_PER_TIER = 20;

function slotNum(tierIdx: number, colIdx: number) {
  return tierIdx * MAX_PER_TIER + colIdx + 1;
}

export default function EmployeeSlotsPage() {
  const [slotMap,    setSlotMap]    = useState<Record<number, string | null>>({});
  const [bookMap,    setBookMap]    = useState<Record<string, BookInfo>>({});
  const [slotNames,  setSlotNames]  = useState<Record<string, string>>({});
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [slotBudget, setSlotBudget] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState("");
  const [tierFilter, setTierFilter] = useState<number | "all">("all");
  const [showOnly,   setShowOnly]   = useState<"all" | "filled" | "empty">("all");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/employee/slots");
    if (r.ok) {
      const data = await r.json();
      setSlotMap(data.slotMap  as Record<number, string | null>);
      setBookMap(data.bookMap  as Record<string, BookInfo>);
      setSlotNames(data.slotNames       as Record<string, string>);
      setTierCounts(data.tierSlotCounts as Record<string, number>);
      setSlotBudget((data.slotBudget    as number) ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalAllocated = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const filledCount    = useMemo(() => TIERS.reduce((total, t, ti) => {
    const count = tierCounts[String(t.price)] ?? 0;
    return total + Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
      .filter((sn) => slotMap[sn]).length;
  }, 0), [tierCounts, slotMap]);

  const fillPct = totalAllocated > 0 ? Math.round((filledCount / totalAllocated) * 100) : 0;

  // Filter logic
  const matchesQuery = (sn: number, book: BookInfo | null) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const customName = slotNames[String(sn)] ?? "";
    return (
      String(sn).includes(q) ||
      customName.toLowerCase().includes(q) ||
      (book?.gameName.toLowerCase().includes(q) ?? false) ||
      (book?.pack.toLowerCase().includes(q) ?? false)
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <GridFour weight="fill" className="size-6 text-primary" />
            Slots
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Browse the slot board · {filledCount}/{totalAllocated} filled
          </p>
        </div>
        <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Fill progress card */}
      {!loading && totalAllocated > 0 && (
        <div className="border rounded-2xl p-3 sm:p-4 bg-gradient-to-br from-primary/5 to-emerald-50/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Floor Coverage</p>
            <p className="text-sm font-black tabular-nums">
              {filledCount}<span className="text-muted-foreground font-medium">/{totalAllocated}</span>
              <span className={cn(
                "ml-2 text-xs px-1.5 py-0.5 rounded-md font-bold",
                fillPct >= 80 ? "text-emerald-700 bg-emerald-100" :
                fillPct >= 50 ? "text-blue-700 bg-blue-100" :
                                "text-amber-700 bg-amber-100"
              )}>
                {fillPct}%
              </span>
            </p>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden border">
            <div className={cn(
              "h-full rounded-full transition-all duration-700",
              fillPct >= 80 ? "bg-emerald-500" : fillPct >= 50 ? "bg-blue-500" : "bg-amber-500"
            )} style={{ width: `${fillPct}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && totalAllocated > 0 && (
        <div className="space-y-2.5">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search slot #, name, game, or pack…"
              className="w-full border rounded-xl pl-10 pr-9 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0">
              <Funnel className="size-3" /> Show:
            </span>
            <div className="flex items-center gap-0.5 border rounded-lg bg-muted/40 p-0.5">
              {(["all", "filled", "empty"] as const).map((s) => (
                <button key={s} onClick={() => setShowOnly(s)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold rounded transition-all uppercase",
                    showOnly === s ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}>
                  {s}
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-muted-foreground ml-1 shrink-0">Tier:</span>
            <button onClick={() => setTierFilter("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-full border transition-all",
                tierFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40"
              )}>
              All
            </button>
            {TIERS.map((t) => {
              const count = tierCounts[String(t.price)] ?? 0;
              if (count === 0) return null;
              const isActive = tierFilter === t.price;
              return (
                <button key={t.price} onClick={() => setTierFilter(isActive ? "all" : t.price)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-full border transition-all",
                    isActive ? "text-white border-transparent" : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                  )}
                  style={isActive ? { background: t.hex } : undefined}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tier rows */}
      <div className="space-y-3">
        {TIERS.map((tier, ti) => {
          const count = tierCounts[String(tier.price)] ?? 0;
          if (!loading && count === 0) return null;
          if (tierFilter !== "all" && tierFilter !== tier.price) return null;

          const tierSlots = Array.from({ length: count }, (_, ci) => {
            const sn       = slotNum(ti, ci);
            const bookId   = slotMap[sn] ?? null;
            const book     = bookId ? bookMap[bookId] : null;
            const isFilled = !!book;
            return { ci, sn, book, isFilled };
          });

          const visibleSlots = tierSlots.filter(({ sn, book, isFilled }) => {
            if (showOnly === "filled" && !isFilled) return false;
            if (showOnly === "empty"  && isFilled)  return false;
            if (!matchesQuery(sn, book)) return false;
            return true;
          });

          const tierFilled = tierSlots.filter((s) => s.isFilled).length;

          return (
            <div key={tier.price} className={cn("rounded-2xl border overflow-hidden bg-card shadow-sm", tier.border)}>
              {/* Tier header */}
              <div className={cn("flex items-center justify-between px-4 py-3 border-b", tier.headerBg, tier.border)}>
                <div className="flex items-center gap-3">
                  <div className={cn("size-10 rounded-xl border flex flex-col items-center justify-center shrink-0", tier.bg, tier.border)}>
                    <span className={cn("text-base font-black leading-none", tier.color)}>{tier.label}</span>
                    <span className="text-[8px] text-muted-foreground font-medium">ticket</span>
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", tier.color)}>{tier.label} Tier</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {tierFilled}/{count} filled · {visibleSlots.length} shown
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1 h-2 w-24 bg-background rounded-full overflow-hidden border">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${count > 0 ? (tierFilled / count) * 100 : 0}%`, background: tier.hex }} />
                </div>
              </div>

              {/* Slot grid */}
              <div className={cn("p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2", tier.bg, "/30")}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
                  ))
                ) : visibleSlots.length === 0 ? (
                  <div className="col-span-full py-6 text-center">
                    <p className="text-xs text-muted-foreground">No slots match your filters</p>
                  </div>
                ) : (
                  visibleSlots.map(({ ci, sn, book, isFilled }) => {
                    const customName = slotNames[String(sn)] ?? "";
                    return (
                      <div key={ci}
                        className={cn(
                          "rounded-xl border p-2 space-y-1 min-h-[88px] sm:min-h-[100px] transition-all",
                          isFilled
                            ? cn("bg-background", tier.border, "shadow-sm hover:shadow-md")
                            : "bg-background/60 border-dashed border-muted-foreground/30"
                        )}>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[10px] font-bold tabular-nums", isFilled ? tier.color : "text-muted-foreground")}>
                            #{sn}
                          </span>
                          {isFilled && (
                            <span className={cn("size-1.5 rounded-full", tier.dot)} />
                          )}
                        </div>
                        {customName && (
                          <p className={cn("text-[9px] font-bold uppercase tracking-widest truncate", isFilled ? tier.color : "text-muted-foreground/60")}>
                            {customName}
                          </p>
                        )}
                        {isFilled && book ? (
                          <div>
                            <p className="text-[11px] font-semibold leading-tight line-clamp-2">
                              {book.gameName}
                            </p>
                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate">
                              {book.pack}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center pt-2 opacity-50">
                            <Package className="size-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {!loading && totalAllocated === 0 && (
        <div className="text-center py-16 space-y-2 border border-dashed rounded-2xl">
          <GridFour className="size-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">No slots configured yet</p>
          <p className="text-xs text-muted-foreground/70">Ask your manager to allocate slots in Settings.</p>
        </div>
      )}
    </div>
  );
}
