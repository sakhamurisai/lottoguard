"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type BookInfo = { gameName: string; pack: string; price: number; status: string };

const TIERS = [
  { price:  1, label:  "$1", color: "text-green-700",   bg: "bg-green-50",   border: "border-green-200",   headerBg: "bg-green-100",   dot: "bg-green-500"   },
  { price:  2, label:  "$2", color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",    headerBg: "bg-teal-100",    dot: "bg-teal-500"    },
  { price:  5, label:  "$5", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    headerBg: "bg-blue-100",    dot: "bg-blue-500"    },
  { price: 10, label: "$10", color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  headerBg: "bg-violet-100",  dot: "bg-violet-500"  },
  { price: 20, label: "$20", color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  headerBg: "bg-purple-100",  dot: "bg-purple-500"  },
  { price: 30, label: "$30", color: "text-pink-700",    bg: "bg-pink-50",    border: "border-pink-200",    headerBg: "bg-pink-100",    dot: "bg-pink-500"    },
  { price: 50, label: "$50", color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    headerBg: "bg-rose-100",    dot: "bg-rose-500"    },
];
const MAX_PER_TIER = 20;

function slotNum(tierIdx: number, colIdx: number) {
  return tierIdx * MAX_PER_TIER + colIdx + 1;
}

const FOLD = { clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" };

export default function EmployeeSlotsPage() {
  const [slotMap,       setSlotMap]       = useState<Record<number, string | null>>({});
  const [bookMap,       setBookMap]       = useState<Record<string, BookInfo>>({});
  const [slotNames,     setSlotNames]     = useState<Record<string, string>>({});
  const [tierCounts,    setTierCounts]    = useState<Record<string, number>>({});
  const [slotBudget,    setSlotBudget]    = useState(0);
  const [loading,       setLoading]       = useState(true);

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
  const filledCount = TIERS.reduce((total, t, ti) => {
    const count = tierCounts[String(t.price)] ?? 0;
    return total + Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
      .filter((sn) => slotMap[sn]).length;
  }, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Slots</h1>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              {filledCount} / {totalAllocated} filled
              {slotBudget > 0 && ` · ${totalAllocated} of ${slotBudget} allocated`}
            </p>
          )}
        </div>
        <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Grid rows */}
      <div className="space-y-3">
        {TIERS.map((tier, ti) => {
          const count      = tierCounts[String(tier.price)] ?? 0;
          const tierFilled = Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
            .filter((sn) => slotMap[sn]).length;

          if (!loading && count === 0) return null;

          return (
            <div key={tier.price} className="flex items-start gap-2">

              {/* Row label */}
              <div className={cn(
                "rounded-xl border px-2.5 py-3 flex flex-col items-center justify-center gap-0.5 w-14 shrink-0",
                tier.headerBg, tier.border
              )}>
                <span className={cn("text-lg font-black leading-none", tier.color)}>{tier.label}</span>
                <span className="text-[9px] text-muted-foreground">ticket</span>
                <span className={cn("text-[9px] font-bold", tier.color)}>{tierFilled}/{count}</span>
              </div>

              {/* Slot cards */}
              <div className="flex-1 flex flex-wrap gap-2">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-[110px] h-[110px] rounded-xl bg-muted animate-pulse" />
                  ))
                ) : (
                  Array.from({ length: count }, (_, ci) => {
                    const sn         = slotNum(ti, ci);
                    const bookId     = slotMap[sn] ?? null;
                    const book       = bookId ? bookMap[bookId] : null;
                    const customName = slotNames[String(sn)] ?? "";

                    return (
                      <div
                        key={ci}
                        style={FOLD}
                        className={cn(
                          "w-[110px] min-h-[110px] rounded-xl border p-2.5 space-y-1.5",
                          book
                            ? cn(tier.bg, tier.border)
                            : "bg-background border-dashed border-muted-foreground/25"
                        )}
                      >
                        {/* Custom name */}
                        <div className="min-h-[14px]">
                          {customName && (
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-widest truncate block",
                              book ? tier.color : "text-muted-foreground/60"
                            )}>
                              {customName}
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        {book ? (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold leading-tight line-clamp-3">
                              {book.gameName}
                            </p>
                            <p className="text-[9px] text-muted-foreground font-mono">
                              {book.pack}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-12">
                            <span className="text-[9px] text-muted-foreground/40">Empty</span>
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

      {/* Summary footer */}
      {!loading && totalAllocated > 0 && (
        <div className="flex items-center gap-3 flex-wrap border-t pt-3 text-xs text-muted-foreground">
          {TIERS.map((tier, ti) => {
            const count  = tierCounts[String(tier.price)] ?? 0;
            if (count === 0) return null;
            const filled = Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
              .filter((sn) => slotMap[sn]).length;
            return (
              <span key={tier.price} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", tier.dot)} />
                <span className={cn("font-semibold", tier.color)}>{tier.label}</span>
                <span>{filled}/{count}</span>
              </span>
            );
          })}
          <span className="ml-auto font-semibold">{filledCount}/{totalAllocated} total</span>
        </div>
      )}
    </div>
  );
}
