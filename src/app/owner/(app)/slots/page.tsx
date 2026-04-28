"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise, Plus, Minus, X, MagnifyingGlass, CheckCircle, PencilSimple, Warning,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Slot = { slotNum: number; bookId: string | null };
type Book = { bookId: string; gameId: string; gameName: string; pack: string; price: number; status: string };

// 7 price tiers — slot numbering: tierIndex × 20 + colIndex + 1
// $1→1-20, $2→21-40, $5→61-80, $10→81-100, $20→101-120, $30→121-140, $50→141-160
const TIERS = [
  {
    price:  1, label:  "$1",
    color:  "text-emerald-700",   bg:  "bg-emerald-50",   border: "border-emerald-200",
    headerBg: "bg-emerald-100",   dot: "bg-emerald-500",  activeBg: "bg-emerald-500",
    ringColor: "ring-emerald-400",
  },
  {
    price:  2, label:  "$2",
    color:  "text-teal-700",      bg:  "bg-teal-50",      border: "border-teal-200",
    headerBg: "bg-teal-100",      dot: "bg-teal-500",     activeBg: "bg-teal-500",
    ringColor: "ring-teal-400",
  },
  {
    price:  5, label:  "$5",
    color:  "text-sky-700",       bg:  "bg-sky-50",       border: "border-sky-200",
    headerBg: "bg-sky-100",       dot: "bg-sky-500",      activeBg: "bg-sky-500",
    ringColor: "ring-sky-400",
  },
  {
    price: 10, label: "$10",
    color:  "text-blue-700",      bg:  "bg-blue-50",      border: "border-blue-200",
    headerBg: "bg-blue-100",      dot: "bg-blue-500",     activeBg: "bg-blue-500",
    ringColor: "ring-blue-400",
  },
  {
    price: 20, label: "$20",
    color:  "text-violet-700",    bg:  "bg-violet-50",    border: "border-violet-200",
    headerBg: "bg-violet-100",    dot: "bg-violet-500",   activeBg: "bg-violet-500",
    ringColor: "ring-violet-400",
  },
  {
    price: 30, label: "$30",
    color:  "text-fuchsia-700",   bg:  "bg-fuchsia-50",   border: "border-fuchsia-200",
    headerBg: "bg-fuchsia-100",   dot: "bg-fuchsia-500",  activeBg: "bg-fuchsia-500",
    ringColor: "ring-fuchsia-400",
  },
  {
    price: 50, label: "$50",
    color:  "text-rose-700",      bg:  "bg-rose-50",      border: "border-rose-200",
    headerBg: "bg-rose-100",      dot: "bg-rose-500",     activeBg: "bg-rose-500",
    ringColor: "ring-rose-400",
  },
];

const MAX_PER_TIER = 20;

function slotNum(tierIdx: number, colIdx: number) {
  return tierIdx * MAX_PER_TIER + colIdx + 1;
}

const FOLD = { clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" };

// ── BookPicker modal ──────────────────────────────────────────────────────────
interface PickerProps {
  slotN:       number;
  tier:        typeof TIERS[0];
  currentId:   string | null;
  books:       Book[];
  assignedIds: Set<string>;
  onAssign:    (bookId: string | null) => void;
  onClose:     () => void;
}

function BookPicker({ slotN, tier, currentId, books, assignedIds, onAssign, onClose }: PickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pool = books.filter(
    (b) => b.status === "active" && b.price === tier.price &&
           (!assignedIds.has(b.bookId) || b.bookId === currentId)
  );

  const q        = query.trim().toLowerCase();
  const filtered = q ? pool.filter((b) =>
    b.gameName.toLowerCase().includes(q) || b.gameId.toLowerCase().includes(q) || b.pack.toLowerCase().includes(q)
  ) : pool;

  const current = books.find((b) => b.bookId === currentId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[80vh]">

        <div className={cn("px-5 pt-4 pb-3 border-b space-y-3", tier.headerBg, tier.border)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Slot #{slotN}</p>
              <p className={cn("text-xs font-semibold", tier.color)}>
                {tier.label} books · {pool.length} available
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/10 transition-colors text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>

          {current && (
            <div className={cn("flex items-center justify-between rounded-xl px-3 py-2 border", tier.bg, tier.border)}>
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold truncate", tier.color)}>{current.gameName}</p>
                <p className="text-[10px] text-muted-foreground font-mono">Pack {current.pack}</p>
              </div>
              <button
                onClick={() => onAssign(null)}
                className="ml-2 shrink-0 text-[10px] text-destructive border border-destructive/30 rounded-lg px-2 py-1 hover:bg-destructive/10 transition-colors font-medium">
                Clear
              </button>
            </div>
          )}

          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              ref={inputRef} value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search game, ID or pack…"
              className="w-full border rounded-xl pl-8 pr-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 divide-y">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center px-5">
              <MagnifyingGlass className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground font-medium">
                {pool.length === 0 ? `No active ${tier.label} books in inventory` : "No books match your search"}
              </p>
            </div>
          ) : (
            filtered.map((b) => {
              const isCurrent = b.bookId === currentId;
              return (
                <button key={b.bookId} onClick={() => onAssign(b.bookId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/50 transition-colors",
                    isCurrent && cn(tier.bg)
                  )}>
                  <div className={cn("size-9 rounded-xl border flex items-center justify-center text-xs font-black shrink-0", tier.bg, tier.color, tier.border)}>
                    {tier.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.gameName}</p>
                    <p className="text-xs text-muted-foreground font-mono">Pack {b.pack} · ID {b.gameId}</p>
                  </div>
                  {isCurrent && <CheckCircle weight="fill" className={cn("size-4 shrink-0", tier.color)} />}
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
interface RenameProps { slotN: number; current: string; onSave: (name: string) => void; onClose: () => void }

function RenameModal({ slotN, current, onSave, onClose }: RenameProps) {
  const [value, setValue] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background border rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Rename slot #{slotN}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
        <input
          ref={inputRef} value={value} maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(value); if (e.key === "Escape") onClose(); }}
          placeholder={`e.g. Machine ${slotN}, Counter left…`}
          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded-xl py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
          <button onClick={() => onSave(value)} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
        {value.trim() && (
          <button onClick={() => onSave("")} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors text-center">
            Clear name
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
interface Picker  { tierIdx: number; colIdx: number; slotN: number; currentId: string | null }
interface Renamer { slotN: number; current: string }

export default function SlotsPage() {
  const [slots,       setSlots]       = useState<Slot[]>([]);
  const [books,       setBooks]       = useState<Book[]>([]);
  const [tierCounts,  setTierCounts]  = useState<Record<string, number>>({});
  const [slotNames,   setSlotNames]   = useState<Record<string, string>>({});
  const [slotBudget,  setSlotBudget]  = useState<number>(0);
  const [loading,     setLoading]     = useState(true);
  const [updating,    setUpdating]    = useState<number | null>(null);
  const [savingTier,  setSavingTier]  = useState<number | null>(null);
  const [picker,      setPicker]      = useState<Picker | null>(null);
  const [renamer,     setRenamer]     = useState<Renamer | null>(null);

  async function load() {
    setLoading(true);
    const [slotsRes, booksRes, settingsRes] = await Promise.all([
      fetch("/api/slots"),
      fetch("/api/inventory"),
      fetch("/api/settings"),
    ]);

    if (slotsRes.ok)  setSlots((await slotsRes.json()).slots as Slot[]);
    if (booksRes.ok)  setBooks((await booksRes.json()).books as Book[]);

    if (settingsRes.ok) {
      const { org } = await settingsRes.json();
      const budget   = (org?.slots as number) ?? 0;
      setSlotBudget(budget);
      setSlotNames((org?.slotNames as Record<string, string>) ?? {});

      const saved = (org?.tierSlotCounts as Record<string, number>) ?? {};

      // Distribute budget across tiers, strictly clamped to budget total
      let remaining = budget;
      const defaultPer = budget > 0 ? Math.max(1, Math.floor(budget / TIERS.length)) : 1;
      const counts: Record<string, number> = {};

      TIERS.forEach((t, i) => {
        const requested = saved[String(t.price)] ?? (i < TIERS.length - 1 ? defaultPer : remaining);
        const allocated = Math.max(0, Math.min(requested, remaining, MAX_PER_TIER));
        counts[String(t.price)] = allocated;
        remaining -= allocated;
      });

      setTierCounts(counts);
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
    const key   = String(price);
    const cur   = tierCounts[key] ?? 0;
    const total = Object.values(tierCounts).reduce((a, b) => a + b, 0);

    if (delta === 1 && slotBudget > 0 && total >= slotBudget) return;

    const next = Math.min(MAX_PER_TIER, Math.max(0, cur + delta));
    if (next === cur) return;

    if (delta === -1) {
      const sn = slotNum(tierIdx, cur - 1);
      const ex = slots.find((s) => s.slotNum === sn);
      if (ex?.bookId) await assign(sn, null);
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
    const trimmed  = name.trim();
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

  const assignedBookIds = new Set(slots.filter((s) => s.bookId).map((s) => s.bookId!));
  const totalAllocated  = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const budgetRemaining = slotBudget > 0 ? slotBudget - totalAllocated : 0;
  const atBudgetCap     = slotBudget > 0 && totalAllocated >= slotBudget;
  const budgetPct       = slotBudget > 0 ? Math.round((totalAllocated / slotBudget) * 100) : 0;

  const filledCount = TIERS.reduce((total, t, ti) => {
    const count = tierCounts[String(t.price)] ?? 0;
    return total + Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
      .filter((sn) => slots.find((s) => s.slotNum === sn)?.bookId).length;
  }, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight">Slots</h1>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {filledCount} of {totalAllocated} slot{totalAllocated !== 1 ? "s" : ""} assigned a book
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {atBudgetCap && !loading && (
            <Link href="/owner/settings"
              className="text-xs font-medium text-primary border border-primary/30 rounded-xl px-3 py-1.5 hover:bg-primary/5 transition-colors">
              Increase budget →
            </Link>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Budget bar */}
      {!loading && slotBudget > 0 && (
        <div className={cn(
          "rounded-2xl border p-4 space-y-3",
          atBudgetCap ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border"
        )}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {atBudgetCap && <Warning weight="fill" className="size-4 text-amber-600 shrink-0" />}
              <p className="text-sm font-semibold">
                Slot budget: {totalAllocated} / {slotBudget} allocated
              </p>
            </div>
            <div className="flex items-center gap-3">
              {atBudgetCap ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
                  Budget full
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {budgetRemaining} slot{budgetRemaining !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 bg-background rounded-full overflow-hidden border">
              <div
                className={cn("h-full rounded-full transition-all duration-500", atBudgetCap ? "bg-amber-500" : "bg-primary")}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span>{slotBudget} max</span>
            </div>
          </div>

          {atBudgetCap && (
            <p className="text-xs text-amber-700">
              All {slotBudget} physical slots are allocated. To add more, increase your slot budget in{" "}
              <Link href="/owner/settings" className="font-semibold underline underline-offset-2">Settings → Organization</Link>.
            </p>
          )}
        </div>
      )}

      {/* Tier rows */}
      <div className="space-y-3">
        {TIERS.map((tier, ti) => {
          const count      = tierCounts[String(tier.price)] ?? 0;
          const isSaving   = savingTier === tier.price;
          const canAdd     = !atBudgetCap && count < MAX_PER_TIER;
          const tierFilled = Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
            .filter((sn) => slots.find((s) => s.slotNum === sn)?.bookId).length;

          return (
            <div key={tier.price} className={cn(
              "rounded-2xl border overflow-hidden transition-all",
              tier.border,
              count === 0 && "opacity-60"
            )}>
              {/* Tier header */}
              <div className={cn("flex items-center justify-between px-3 sm:px-4 py-2.5 gap-3 border-b", tier.headerBg, tier.border)}>
                <div className="flex items-center gap-3">
                  <div className={cn("size-10 rounded-xl border flex flex-col items-center justify-center shrink-0", tier.bg, tier.border)}>
                    <span className={cn("text-base font-black leading-none", tier.color)}>{tier.label}</span>
                    <span className="text-[8px] text-muted-foreground font-medium">ticket</span>
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", tier.color)}>{tier.label} Price Tier</p>
                    <p className="text-xs text-muted-foreground">
                      {tierFilled}/{count} filled
                      {count === 0 && " · no slots allocated"}
                    </p>
                  </div>
                </div>

                {/* Per-tier +/- controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Slots:</span>
                  <button
                    onClick={() => changeTierCount(ti, tier.price, -1)}
                    disabled={loading || isSaving || count <= 0}
                    className={cn(
                      "size-7 rounded-lg border flex items-center justify-center transition-colors text-muted-foreground",
                      "hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}>
                    <Minus className="size-3.5" />
                  </button>

                  <span className={cn(
                    "min-w-[2rem] text-center text-sm font-bold tabular-nums",
                    isSaving && "opacity-40"
                  )}>
                    {isSaving
                      ? <span className="size-3 inline-block rounded-full border border-foreground border-t-transparent animate-spin" />
                      : count
                    }
                  </span>

                  <button
                    onClick={() => changeTierCount(ti, tier.price, 1)}
                    disabled={loading || isSaving || !canAdd}
                    title={atBudgetCap ? `Slot budget full (${slotBudget} max) — increase in Settings` : `Add ${tier.label} slot`}
                    className={cn(
                      "size-7 rounded-lg border flex items-center justify-center transition-colors text-muted-foreground",
                      "hover:bg-primary/10 hover:border-primary/40 hover:text-primary",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Slot cards grid */}
              {count > 0 && (
                <div className={cn("p-3 sm:p-4", tier.bg)}>
                  <div className="flex flex-wrap gap-2">
                    {loading ? (
                      Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                        <div key={i} className="w-[104px] h-[104px] sm:w-[110px] sm:h-[110px] rounded-xl bg-muted/60 animate-pulse" />
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
                                "w-[104px] min-h-[104px] sm:w-[110px] sm:min-h-[110px] rounded-xl border p-2.5 text-left space-y-1.5",
                                "transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                                assignedBook
                                  ? cn("bg-background", tier.border, "hover:brightness-97 shadow-sm")
                                  : cn("bg-background/60 border-dashed", tier.border.replace("border-", "border-").replace("200", "300"), "hover:bg-background hover:shadow-md")
                              )}>
                              {/* Slot number + custom name */}
                              <div className="flex items-center justify-between min-h-[14px]">
                                <span className={cn("text-[9px] font-bold tabular-nums", tier.color)}>#{sn}</span>
                                {customName && (
                                  <span className={cn(
                                    "text-[8px] font-bold uppercase tracking-widest truncate max-w-[55px] ml-1",
                                    assignedBook ? tier.color : "text-muted-foreground/60"
                                  )}>
                                    {customName}
                                  </span>
                                )}
                              </div>

                              {isUpdating ? (
                                <div className="flex items-center justify-center h-14">
                                  <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                </div>
                              ) : assignedBook ? (
                                <div className="space-y-1">
                                  <div className={cn("inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md", tier.bg, tier.color, tier.border, "border")}>
                                    {tier.label}
                                  </div>
                                  <p className="text-[10px] font-semibold leading-tight line-clamp-2">
                                    {assignedBook.gameName}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground font-mono">
                                    {assignedBook.pack}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-14 gap-1.5">
                                  <div className={cn("size-7 rounded-lg border-2 border-dashed flex items-center justify-center", tier.border)}>
                                    <Plus className={cn("size-3.5", tier.color, "opacity-50")} />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground/60 font-medium">Assign</span>
                                </div>
                              )}
                            </button>

                            {/* Rename button on hover */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamer({ slotN: sn, current: customName }); }}
                              title="Rename slot"
                              className={cn(
                                "absolute top-1.5 right-1.5 size-5 rounded-md flex items-center justify-center",
                                "opacity-0 group-hover/card:opacity-100 transition-opacity",
                                "bg-background/90 hover:bg-background border shadow-sm"
                              )}>
                              <PencilSimple className="size-2.5 text-muted-foreground" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Empty tier message */}
              {count === 0 && !loading && (
                <div className={cn("px-4 py-3 text-xs text-muted-foreground flex items-center gap-2", tier.bg)}>
                  <Plus className="size-3" />
                  No slots allocated — use + to add one (requires budget remaining)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      {!loading && (
        <div className="rounded-2xl border bg-muted/30 p-3 sm:p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
            {TIERS.map((tier, ti) => {
              const count  = tierCounts[String(tier.price)] ?? 0;
              if (count === 0) return null;
              const filled = Array.from({ length: count }, (_, ci) => slotNum(ti, ci))
                .filter((sn) => slots.find((s) => s.slotNum === sn)?.bookId).length;
              return (
                <span key={tier.price} className="flex items-center gap-1.5 text-xs">
                  <span className={cn("size-2 rounded-full", tier.dot)} />
                  <span className={cn("font-bold", tier.color)}>{tier.label}</span>
                  <span className="text-muted-foreground">{filled}/{count}</span>
                </span>
              );
            })}
            <span className="ml-auto text-xs font-bold text-foreground">
              {filledCount}/{totalAllocated} total assigned
            </span>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renamer && (
        <RenameModal
          slotN={renamer.slotN} current={renamer.current}
          onSave={(name) => renameSlot(renamer.slotN, name)}
          onClose={() => setRenamer(null)}
        />
      )}

      {/* Book picker modal */}
      {picker && (
        <BookPicker
          slotN={picker.slotN} tier={TIERS[picker.tierIdx]}
          currentId={picker.currentId} books={books}
          assignedIds={assignedBookIds}
          onAssign={(bookId) => assign(picker.slotN, bookId)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
