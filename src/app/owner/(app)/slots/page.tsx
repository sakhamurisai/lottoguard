"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowClockwise, Plus, Minus, X, MagnifyingGlass, CheckCircle, PencilSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Slot = { slotNum: number; bookId: string | null };
type Book = { bookId: string; gameId: string; gameName: string; pack: string; price: number; status: string };

// 8 price tiers. Slot numbering: tierIndex × 20 + colIndex + 1
// $1→1-20, $2→21-40, $3→41-60, $5→61-80, $10→81-100,
// $20→101-120, $30→121-140, $50→141-160
const TIERS = [
  { price:  1, label:  "$1", color: "text-green-700 dark:text-green-300",   bg: "bg-green-50 dark:bg-green-950/50",   border: "border-green-200 dark:border-green-800/60",   headerBg: "bg-green-100 dark:bg-green-900/60",   dot: "bg-green-500"   },
  { price:  2, label:  "$2", color: "text-teal-700 dark:text-teal-300",     bg: "bg-teal-50 dark:bg-teal-950/50",     border: "border-teal-200 dark:border-teal-800/60",     headerBg: "bg-teal-100 dark:bg-teal-900/60",     dot: "bg-teal-500"    },
  { price:  5, label:  "$5", color: "text-blue-700 dark:text-blue-300",     bg: "bg-blue-50 dark:bg-blue-950/50",     border: "border-blue-200 dark:border-blue-800/60",     headerBg: "bg-blue-100 dark:bg-blue-900/60",     dot: "bg-blue-500"    },
  { price: 10, label: "$10", color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-950/50", border: "border-violet-200 dark:border-violet-800/60", headerBg: "bg-violet-100 dark:bg-violet-900/60", dot: "bg-violet-500"  },
  { price: 20, label: "$20", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/50", border: "border-purple-200 dark:border-purple-800/60", headerBg: "bg-purple-100 dark:bg-purple-900/60", dot: "bg-purple-500"  },
  { price: 30, label: "$30", color: "text-pink-700 dark:text-pink-300",     bg: "bg-pink-50 dark:bg-pink-950/50",     border: "border-pink-200 dark:border-pink-800/60",     headerBg: "bg-pink-100 dark:bg-pink-900/60",     dot: "bg-pink-500"    },
  { price: 50, label: "$50", color: "text-rose-700 dark:text-rose-300",     bg: "bg-rose-50 dark:bg-rose-950/50",     border: "border-rose-200 dark:border-rose-800/60",     headerBg: "bg-rose-100 dark:bg-rose-900/60",     dot: "bg-rose-500"    },
];
const MAX_PER_TIER = 20;

function slotNum(tierIdx: number, colIdx: number) {
  return tierIdx * MAX_PER_TIER + colIdx + 1;
}

const FOLD = { clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" };

// ── BookPicker modal ───────────────────────────────────────────────────────────

interface PickerProps {
  slotN:       number;
  tier:        typeof TIERS[0];
  currentId:   string | null;
  books:       Book[];          // all books, already loaded
  assignedIds: Set<string>;
  onAssign:    (bookId: string | null) => void;
  onClose:     () => void;
}

function BookPicker({ slotN, tier, currentId, books, assignedIds, onAssign, onClose }: PickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Active books of this price not in another slot (or currently in this slot)
  const pool = books.filter(
    (b) => b.status === "active" && b.price === tier.price &&
           (!assignedIds.has(b.bookId) || b.bookId === currentId)
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? pool.filter((b) =>
        b.gameName.toLowerCase().includes(q) ||
        b.gameId.toLowerCase().includes(q) ||
        b.pack.toLowerCase().includes(q)
      )
    : pool;

  const current = books.find((b) => b.bookId === currentId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">

        {/* Header */}
        <div className={cn("px-5 pt-4 pb-3 border-b space-y-3", tier.headerBg, tier.border)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Slot #{slotN}</p>
              <p className={cn("text-xs font-semibold", tier.color)}>
                {tier.label} ticket books · {pool.length} available
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Currently assigned */}
          {current && (
            <div className={cn("flex items-center justify-between rounded-xl px-3 py-2 border", tier.bg, tier.border)}>
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold truncate", tier.color)}>{current.gameName}</p>
                <p className="text-[10px] text-muted-foreground font-mono">Pack {current.pack}</p>
              </div>
              <button
                onClick={() => onAssign(null)}
                className="ml-2 shrink-0 text-[10px] text-destructive border border-destructive/30 rounded-lg px-2 py-1 hover:bg-destructive/10 transition-colors font-medium"
              >
                Clear
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search game name, ID or pack…"
              className="w-full border rounded-xl pl-8 pr-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Book list */}
        <div className="overflow-y-auto flex-1 divide-y">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MagnifyingGlass className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground font-medium">
                {pool.length === 0 ? `No active ${tier.label} books in inventory` : "No books match your search"}
              </p>
            </div>
          ) : (
            filtered.map((b) => {
              const isCurrent = b.bookId === currentId;
              return (
                <button
                  key={b.bookId}
                  onClick={() => onAssign(b.bookId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/50 transition-colors",
                    isCurrent && cn(tier.bg)
                  )}
                >
                  {/* Price bubble */}
                  <div className={cn(
                    "size-9 rounded-xl border flex items-center justify-center text-xs font-black shrink-0",
                    tier.bg, tier.color, tier.border
                  )}>
                    {tier.label}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.gameName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Pack {b.pack} · ID {b.gameId}
                    </p>
                  </div>
                  {isCurrent && (
                    <CheckCircle weight="fill" className={cn("size-4 shrink-0", tier.color)} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────

interface RenameProps {
  slotN:   number;
  current: string;
  onSave:  (name: string) => void;
  onClose: () => void;
}

function RenameModal({ slotN, current, onSave, onClose }: RenameProps) {
  const [value, setValue] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  function submit() { onSave(value); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background border rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Rename slot</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          value={value}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
          placeholder={`e.g. Machine ${slotN}, Counter left…`}
          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border rounded-xl py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>

        {value.trim() && (
          <button
            onClick={() => onSave("")}
            className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors text-center"
          >
            Clear name
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

interface Picker  { tierIdx: number; colIdx: number; slotN: number; currentId: string | null }
interface Renamer { slotN: number; current: string }

export default function SlotsPage() {
  const [slots,          setSlots]          = useState<Slot[]>([]);
  const [books,          setBooks]          = useState<Book[]>([]);
  const [tierCounts,     setTierCounts]     = useState<Record<string, number>>({});
  const [slotNames,      setSlotNames]      = useState<Record<string, string>>({});
  const [slotBudget,     setSlotBudget]     = useState<number>(0);   // org.slots cap
  const [loading,        setLoading]        = useState(true);
  const [updating,       setUpdating]       = useState<number | null>(null);
  const [savingTier,     setSavingTier]     = useState<number | null>(null);
  const [picker,         setPicker]         = useState<Picker | null>(null);
  const [renamer,        setRenamer]        = useState<Renamer | null>(null);

  async function load() {
    setLoading(true);
    const [slotsRes, booksRes, settingsRes] = await Promise.all([
      fetch("/api/slots"),
      fetch("/api/inventory"),
      fetch("/api/settings"),
    ]);
    if (slotsRes.ok)    setSlots((await slotsRes.json()).slots as Slot[]);
    if (booksRes.ok)    setBooks((await booksRes.json()).books as Book[]);
    if (settingsRes.ok) {
      const { org } = await settingsRes.json();
      const budget = (org?.slots as number) ?? 0;
      setSlotBudget(budget);
      setSlotNames((org?.slotNames as Record<string, string>) ?? {});

      const saved = (org?.tierSlotCounts as Record<string, number>) ?? {};
      // Default counts: distribute budget evenly across tiers (6 each or what fits)
      const defaultPer = Math.max(1, Math.floor(budget / TIERS.length));
      const defaults: Record<string, number> = {};
      let remaining = budget;
      TIERS.forEach((t, i) => {
        const count = saved[String(t.price)] ?? (i < TIERS.length - 1 ? Math.min(defaultPer, remaining) : remaining);
        defaults[String(t.price)] = Math.max(0, Math.min(count, remaining, MAX_PER_TIER));
        remaining -= defaults[String(t.price)];
      });
      setTierCounts(defaults);

      // Expand org slot store to support the block grid (does not change budget)
      if ((budget ?? 0) > 0) {
        const storeNeeded = Math.max(budget, 160);
        if (!org?.slots || (org.slots as number) < storeNeeded) {
          await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slots: storeNeeded }),
          });
          const sr2 = await fetch("/api/slots");
          if (sr2.ok) setSlots((await sr2.json()).slots as Slot[]);
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function assign(slotN: number, bookId: string | null) {
    setUpdating(slotN);
    const r = await fetch("/api/slots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotNum: slotN, bookId }),
    });
    if (r.ok) setSlots((prev) => prev.map((s) => s.slotNum === slotN ? { ...s, bookId } : s));
    setUpdating(null);
    setPicker(null);
  }

  async function changeTierCount(tierIdx: number, price: number, delta: 1 | -1) {
    const key    = String(price);
    const cur    = tierCounts[key] ?? 0;
    const totalAllocated = Object.values(tierCounts).reduce((a, b) => a + b, 0);

    // Enforce budget cap when adding
    if (delta === 1 && slotBudget > 0 && totalAllocated >= slotBudget) return;

    const next   = Math.min(MAX_PER_TIER, Math.max(0, cur + delta));
    if (next === cur) return;

    // Removing: clear the last column's assignment for this tier first
    if (delta === -1) {
      const lastColIdx = cur - 1;
      const sn         = slotNum(tierIdx, lastColIdx);
      const existing   = slots.find((s) => s.slotNum === sn);
      if (existing?.bookId) await assign(sn, null);
    }

    const newCounts = { ...tierCounts, [key]: next };
    setTierCounts(newCounts);
    setSavingTier(price);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierSlotCounts: newCounts }),
    });
    setSavingTier(null);
  }

  async function renameSlot(slotN: number, name: string) {
    const trimmed = name.trim();
    const newNames = { ...slotNames, [String(slotN)]: trimmed };
    if (!trimmed) delete newNames[String(slotN)];
    setSlotNames(newNames);
    setRenamer(null);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotNames: newNames }),
    });
  }

  const assignedBookIds   = new Set(slots.filter((s) => s.bookId).map((s) => s.bookId!));
  const totalAllocated    = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const totalCells        = totalAllocated;
  const budgetRemaining   = slotBudget > 0 ? slotBudget - totalAllocated : 0;
  const atBudgetCap       = slotBudget > 0 && totalAllocated >= slotBudget;

  const filledCount = TIERS.reduce((total, t, ti) => {
    const count = tierCounts[String(t.price)] ?? 0;
    return total + Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
      .filter((sn) => slots.find((s) => s.slotNum === sn)?.bookId).length;
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
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {filledCount} / {totalCells} filled
                {slotBudget > 0 && ` · ${totalAllocated}/${slotBudget} slots allocated`}
              </p>
              {atBudgetCap && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                  Budget full — increase in Settings
                </span>
              )}
              {!atBudgetCap && slotBudget > 0 && (
                <span className="text-xs text-muted-foreground">
                  {budgetRemaining} slot{budgetRemaining !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {atBudgetCap && !loading && (
            <Link
              href="/owner/settings"
              className="text-xs font-medium text-primary border border-primary/30 rounded-xl px-3 py-1.5 hover:bg-primary/5 transition-colors"
            >
              Increase budget →
            </Link>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Grid rows */}
      <div className="space-y-3">
        {TIERS.map((tier, ti) => {
          const count    = tierCounts[String(tier.price)] ?? 6;
          const isSaving = savingTier === tier.price;
          const tierFilled = Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
            .filter((sn) => slots.find((s) => s.slotNum === sn)?.bookId).length;

          return (
            <div key={tier.price} className="flex items-start gap-2">

              {/* ── Row label ── */}
              <div className={cn(
                "rounded-xl border px-2.5 py-3 flex flex-col items-center justify-center gap-0.5 w-14 shrink-0",
                tier.headerBg, tier.border
              )}>
                <span className={cn("text-lg font-black leading-none", tier.color)}>{tier.label}</span>
                <span className="text-[9px] text-muted-foreground">ticket</span>
                <span className={cn("text-[9px] font-bold", tier.color)}>{tierFilled}/{count}</span>
              </div>

              {/* ── Slot cards ── */}
              <div className="flex-1 flex flex-wrap gap-2">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[110px] h-[110px] rounded-xl bg-muted animate-pulse" />
                  ))
                ) : (
                  Array.from({ length: count }, (_, ci) => {
                    const sn           = slotNum(ti, ci);
                    const slotData     = slots.find((s) => s.slotNum === sn);
                    const assignedBook = books.find((b) => b.bookId === slotData?.bookId);
                    const isUpdating   = updating === sn;
                    const customName   = slotNames[String(sn)] ?? "";

                    return (
                      <div key={ci} className="relative group/card">
                        <button
                          style={FOLD}
                          disabled={isUpdating}
                          onClick={() => setPicker({ tierIdx: ti, colIdx: ci, slotN: sn, currentId: slotData?.bookId ?? null })}
                          className={cn(
                            "w-[110px] min-h-[110px] rounded-xl border p-2.5 text-left space-y-1.5",
                            "transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                            assignedBook
                              ? cn(tier.bg, tier.border, "hover:brightness-95")
                              : "bg-background border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
                          )}
                        >
                          {/* Custom name row */}
                          <div className="flex items-center justify-between min-h-[14px]">
                            {customName ? (
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-widest truncate max-w-[72px]",
                                assignedBook ? tier.color : "text-muted-foreground/60"
                              )}>
                                {customName}
                              </span>
                            ) : (
                              <span /> /* spacer */
                            )}
                          </div>

                          {/* Content */}
                          {isUpdating ? (
                            <div className="flex items-center justify-center h-12">
                              <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                          ) : assignedBook ? (
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold leading-tight line-clamp-3">
                                {assignedBook.gameName}
                              </p>
                              <p className="text-[9px] text-muted-foreground font-mono">
                                {assignedBook.pack}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-12 gap-1">
                              <Plus className="size-4 text-muted-foreground/30" />
                              <span className="text-[9px] text-muted-foreground/40">Assign</span>
                            </div>
                          )}
                        </button>

                        {/* Pencil rename button — appears on card hover */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamer({ slotN: sn, current: customName }); }}
                          title="Rename slot"
                          className={cn(
                            "absolute top-1.5 right-1.5 size-5 rounded-md flex items-center justify-center",
                            "opacity-0 group-hover/card:opacity-100 transition-opacity",
                            "bg-background/80 hover:bg-background border shadow-sm"
                          )}
                        >
                          <PencilSimple className="size-2.5 text-muted-foreground" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Per-row add/remove controls ── */}
              <div className="flex flex-col gap-1 shrink-0 pt-1">
                <button
                  onClick={() => changeTierCount(ti, tier.price, 1)}
                  disabled={loading || isSaving || count >= MAX_PER_TIER || atBudgetCap}
                  title={atBudgetCap ? "Budget full — increase slot budget in Settings" : `Add slot to ${tier.label} row`}
                  className={cn(
                    "size-7 rounded-lg border flex items-center justify-center transition-colors",
                    "hover:bg-primary/10 hover:border-primary/40 hover:text-primary",
                    "disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground"
                  )}
                >
                  {isSaving
                    ? <span className="size-3 rounded-full border border-foreground border-t-transparent animate-spin" />
                    : <Plus className="size-3.5" />
                  }
                </button>
                <button
                  onClick={() => changeTierCount(ti, tier.price, -1)}
                  disabled={loading || isSaving || count <= 1}
                  title={`Remove last slot from ${tier.label} row`}
                  className={cn(
                    "size-7 rounded-lg border flex items-center justify-center transition-colors",
                    "hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive",
                    "disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground"
                  )}
                >
                  <Minus className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {!loading && (
        <div className="flex items-center gap-3 flex-wrap border-t pt-3 text-xs text-muted-foreground">
          {TIERS.map((tier, ti) => {
            const count  = tierCounts[String(tier.price)] ?? 6;
            const filled = Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
              .filter((sn) => slots.find((s) => s.slotNum === sn)?.bookId).length;
            return (
              <span key={tier.price} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", tier.dot)} />
                <span className={cn("font-semibold", tier.color)}>{tier.label}</span>
                <span>{filled}/{count}</span>
              </span>
            );
          })}
          <span className="ml-auto font-semibold">{filledCount}/{totalCells} total</span>
        </div>
      )}

      {/* Rename modal */}
      {renamer && (
        <RenameModal
          slotN={renamer.slotN}
          current={renamer.current}
          onSave={(name) => renameSlot(renamer.slotN, name)}
          onClose={() => setRenamer(null)}
        />
      )}

      {/* Book picker modal */}
      {picker && (
        <BookPicker
          slotN={picker.slotN}
          tier={TIERS[picker.tierIdx]}
          currentId={picker.currentId}
          books={books}
          assignedIds={assignedBookIds}
          onAssign={(bookId) => assign(picker.slotN, bookId)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
