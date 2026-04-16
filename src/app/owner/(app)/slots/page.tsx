"use client";

import { useEffect, useState } from "react";
import { X, ArrowClockwise, GridFour } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Slot = { slotNum: number; bookId: string | null };
type Book = {
  bookId: string; gameId: string; gameName: string;
  pack: string; price: number; status: string;
};

// Price tier metadata
const PRICE_TIERS: { price: number; color: string; bg: string; border: string }[] = [
  { price:  1, color: "text-green-700 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/40",  border: "border-green-200 dark:border-green-800/60"  },
  { price:  2, color: "text-teal-700 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-950/40",    border: "border-teal-200 dark:border-teal-800/60"    },
  { price:  3, color: "text-sky-700 dark:text-sky-400",      bg: "bg-sky-50 dark:bg-sky-950/40",      border: "border-sky-200 dark:border-sky-800/60"      },
  { price:  5, color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/40",    border: "border-blue-200 dark:border-blue-800/60"    },
  { price: 10, color: "text-violet-700 dark:text-violet-400",bg: "bg-violet-50 dark:bg-violet-950/40",border: "border-violet-200 dark:border-violet-800/60"},
  { price: 20, color: "text-purple-700 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-950/40",border: "border-purple-200 dark:border-purple-800/60"},
  { price: 30, color: "text-pink-700 dark:text-pink-400",    bg: "bg-pink-50 dark:bg-pink-950/40",    border: "border-pink-200 dark:border-pink-800/60"    },
  { price: 50, color: "text-rose-700 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-950/40",    border: "border-rose-200 dark:border-rose-800/60"    },
];

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  settled:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function SlotsPage() {
  const [slots,      setSlots]      = useState<Slot[]>([]);
  const [books,      setBooks]      = useState<Book[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<number | null>(null);   // selected price tier
  const [slotPanel,  setSlotPanel]  = useState<Slot | null>(null);     // slot being assigned
  const [updating,   setUpdating]   = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [slotsRes, booksRes] = await Promise.all([
      fetch("/api/slots"),
      fetch("/api/inventory"),
    ]);
    if (slotsRes.ok) {
      const { slots: s } = await slotsRes.json();
      setSlots(s as Slot[]);
    }
    if (booksRes.ok) {
      const { books: b } = await booksRes.json();
      setBooks(b as Book[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function assign(slotNum: number, bookId: string | null) {
    setUpdating(slotNum);
    const r = await fetch("/api/slots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotNum, bookId }),
    });
    if (r.ok) {
      setSlots((prev) => prev.map((s) => s.slotNum === slotNum ? { ...s, bookId } : s));
      setSlotPanel(null);
    }
    setUpdating(null);
  }

  // Group books by price
  function booksAtPrice(price: number) {
    return books.filter((b) => b.price === price);
  }

  function slotsAtPrice(price: number) {
    const assignedBookIds = new Set(
      slots.filter((s) => s.bookId).map((s) => s.bookId!)
    );
    return books
      .filter((b) => b.price === price && assignedBookIds.has(b.bookId))
      .length;
  }

  function totalAtPrice(price: number) {
    return booksAtPrice(price).length;
  }

  function activeAtPrice(price: number) {
    return booksAtPrice(price).filter((b) => b.status === "active").length;
  }

  // Prices that actually have books
  const presentPrices = new Set(books.map((b) => b.price));
  const visibleTiers = PRICE_TIERS.filter((t) => presentPrices.has(t.price));

  // Slots assigned to books at selected price
  const selectedTier = PRICE_TIERS.find((t) => t.price === selected);
  const selectedBooks = selected !== null ? booksAtPrice(selected) : [];

  // Unassigned slots for the slot panel
  const assignedSlotNums = new Set(slots.filter((s) => s.bookId).map((s) => s.slotNum));
  const emptySlots = slots.filter((s) => !s.bookId);
  const inactiveBooks = books.filter((b) => b.status === "inactive" && !slots.find((s) => s.bookId === b.bookId));

  const filledSlots = slots.filter((s) => s.bookId).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Slots</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filledSlots} of {slots.length} filled
          </p>
        </div>
        <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Price tier cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : visibleTiers.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-12 text-center space-y-2">
          <GridFour className="size-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">No books in inventory yet.</p>
          <p className="text-xs text-muted-foreground">Add books via Inventory to see price categories here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visibleTiers.map((tier) => {
            const total  = totalAtPrice(tier.price);
            const active = activeAtPrice(tier.price);
            const inSlot = slotsAtPrice(tier.price);
            const isSelected = selected === tier.price;

            return (
              <button
                key={tier.price}
                onClick={() => setSelected(isSelected ? null : tier.price)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all hover:shadow-md",
                  tier.bg, tier.border,
                  isSelected && "ring-2 ring-primary ring-offset-2 shadow-md"
                )}
              >
                <p className={cn("text-2xl font-black", tier.color)}>${tier.price}</p>
                <p className={cn("text-xs font-medium mt-1", tier.color)}>
                  {total} book{total !== 1 ? "s" : ""}
                </p>
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs text-muted-foreground">{active} active</p>
                  <p className="text-xs text-muted-foreground">{inSlot} in slots</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected price detail */}
      {selected !== null && selectedTier && (
        <div className={cn("border rounded-2xl overflow-hidden shadow-sm", selectedTier.border)}>
          <div className={cn("px-5 py-3.5 border-b flex items-center justify-between", selectedTier.bg, selectedTier.border)}>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-black", selectedTier.color)}>${selected}</span>
              <span className={cn("text-sm font-medium", selectedTier.color)}>ticket books</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="size-4" />
            </button>
          </div>

          {selectedBooks.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No books at this price.</p>
          ) : (
            <div className="divide-y">
              {selectedBooks.map((b) => {
                const slot = slots.find((s) => s.bookId === b.bookId);
                return (
                  <div key={b.bookId} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.gameName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{b.pack}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                        STATUS_STYLE[b.status] ?? "bg-muted text-muted-foreground")}>
                        {b.status}
                      </span>
                      {slot
                        ? (
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg", selectedTier.bg, selectedTier.color, selectedTier.border, "border")}>
                              Slot {slot.slotNum}
                            </span>
                            <button
                              onClick={() => assign(slot.slotNum, null)}
                              disabled={updating === slot.slotNum}
                              title="Remove from slot"
                              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-muted"
                            >
                              {updating === slot.slotNum
                                ? <span className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin block" />
                                : <X className="size-3.5" />
                              }
                            </button>
                          </div>
                        )
                        : (
                          <button
                            onClick={() => setSlotPanel({ slotNum: -1, bookId: b.bookId })}
                            className="text-xs px-3 py-1.5 rounded-lg border hover:bg-accent transition-colors font-medium"
                          >
                            Assign slot
                          </button>
                        )
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Assign-slot panel (empty slot picker) */}
      {slotPanel && slotPanel.slotNum === -1 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Choose a slot</h3>
              <button onClick={() => setSlotPanel(null)} className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>
            {emptySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No empty slots available. All slots are filled.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {emptySlots.map((s) => (
                  <button
                    key={s.slotNum}
                    disabled={updating === s.slotNum}
                    onClick={() => assign(s.slotNum, slotPanel.bookId)}
                    className="aspect-square border-2 border-dashed rounded-xl flex items-center justify-center text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    {updating === s.slotNum
                      ? <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      : s.slotNum
                    }
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* All slots grid — always shown at the bottom */}
      <div className="border rounded-2xl p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <GridFour className="size-4 text-muted-foreground" />
          All Slots
        </h2>
        {loading ? (
          <div className={cn("grid gap-2", slots.length <= 10 ? "grid-cols-5" : "grid-cols-6 sm:grid-cols-8")}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className={cn("grid gap-2", slots.length <= 10 ? "grid-cols-5" : "grid-cols-6 sm:grid-cols-8")}>
            {slots.map((s) => {
              const book = books.find((b) => b.bookId === s.bookId);
              const tier = book ? PRICE_TIERS.find((t) => t.price === book.price) : null;
              return (
                <div
                  key={s.slotNum}
                  title={book ? `${book.gameName} · $${book.price}` : `Slot ${s.slotNum} – empty`}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-bold border gap-0.5 transition-colors",
                    book && tier
                      ? cn(tier.bg, tier.color, tier.border)
                      : "bg-muted/40 text-muted-foreground border-dashed"
                  )}
                >
                  <span>{s.slotNum}</span>
                  {book ? (
                    <span className="text-[9px] opacity-70">${book.price}</span>
                  ) : (
                    <span className="text-[9px] opacity-50">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary/40 inline-block" />
            Filled
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-muted-foreground/30 inline-block" />
            Empty
          </span>
          <span className="ml-auto">{filledSlots}/{slots.length} filled</span>
        </div>
      </div>
    </div>
  );
}
