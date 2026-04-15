"use client";

import { useEffect, useState } from "react";
import { X, ArrowClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Slot = { slotNum: number; bookId: string | null };
type Book = { bookId: string; gameId: string; gameName: string; pack: string; price: number; status: string };

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [unassigned, setUnassigned] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

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
      const { books } = await booksRes.json();
      setUnassigned((books as Book[]).filter((b) => b.status === "inactive" && !b.bookId));
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
      setSelected(null);
    }
    setUpdating(null);
  }

  const active = slots.filter((s) => s.bookId).length;
  const selectedSlot = slots.find((s) => s.num === selected || s.slotNum === selected);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Slots</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{active} of {slots.length} filled</p>
        </div>
        <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Slot grid */}
      <div className={cn("grid gap-3", slots.length <= 10 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-6")}>
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
            ))
          : slots.map((s) => (
              <button
                key={s.slotNum}
                onClick={() => setSelected(s.slotNum === selected ? null : s.slotNum)}
                disabled={updating === s.slotNum}
                className={cn(
                  "relative border rounded-2xl p-3 text-left transition-all",
                  s.bookId
                    ? "bg-primary/6 border-primary/20 hover:border-primary/40"
                    : "border-dashed hover:bg-muted/50",
                  selected === s.slotNum && "ring-2 ring-primary ring-offset-2"
                )}
              >
                <p className="text-xs text-muted-foreground mb-1">Slot {s.slotNum}</p>
                {updating === s.slotNum
                  ? <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin block" />
                  : s.bookId
                    ? (
                      <>
                        <p className="text-xs font-semibold leading-snug line-clamp-2">
                          {unassigned.find((b) => b.bookId === s.bookId)?.gameName ?? "Book assigned"}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); assign(s.slotNum, null); }}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    )
                    : <p className="text-xs text-muted-foreground">Empty</p>
                }
              </button>
            ))
        }
      </div>

      {/* Assignment panel */}
      {selectedSlot && !selectedSlot.bookId && (
        <div className="border rounded-2xl p-5 space-y-3 bg-muted/20">
          <p className="text-sm font-semibold">Assign a book to Slot {selectedSlot.slotNum}</p>
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inactive unassigned books available. Add books in Inventory first.</p>
          ) : (
            <div className="space-y-2">
              {unassigned.map((b) => (
                <button
                  key={b.bookId}
                  onClick={() => assign(selectedSlot.slotNum, b.bookId)}
                  className="w-full flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent transition-colors text-sm"
                >
                  <span className="font-medium">{b.gameName} <span className="font-normal text-muted-foreground text-xs ml-1">{b.pack}</span></span>
                  <span className="text-muted-foreground text-xs">${b.price}/ticket</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
