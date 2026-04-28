"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowClockwise, CheckCircle, X, User,
  Package, Clock, CurrencyDollar, GridFour,
  Warning, SealWarning, Info,
  ArrowDown, ArrowUp,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Severity = "emergency" | "important" | "warning" | "info";
type Category = "all" | "inventory" | "shifts" | "cash" | "slots";

type Notif = {
  SK:        string;
  notifId:   string;
  type:      string;
  severity:  Severity;
  message:   string;
  empName?:  string;
  detail?:   Record<string, unknown>;
  read:      boolean;
  createdAt: string;
};

// ── Mappings ──────────────────────────────────────────────────────────────────
const TYPE_TO_CATEGORY: Record<string, Category> = {
  book_sold_out:             "inventory",
  book_action_failed:        "inventory",
  book_activated:            "inventory",
  book_settled:              "inventory",
  receipt_scan_failed:       "inventory",
  duplicate_pack_detected:   "inventory",
  shift_clock_in:            "shifts",
  shift_clock_out:           "shifts",
  shift_started:             "shifts",
  shift_ended:               "shifts",
  employee_approved:         "shifts",
  employee_disabled:         "shifts",
  shift_discrepancy_over:    "cash",
  shift_discrepancy_short:   "cash",
  cash_over:                 "cash",
  cash_short:                "cash",
  drawer_mismatch:           "cash",
  auto_slot_assigned:        "slots",
  slot_updated_by_employee:  "slots",
  slot_book_removed:         "slots",
  slot_empty:                "slots",
};

function getCategory(type: string): Category {
  return TYPE_TO_CATEGORY[type] ?? "inventory";
}

const CATEGORY_CFG: Record<Exclude<Category, "all">, {
  label:     string;
  icon:      React.ElementType;
  cardBg:    string;
  cardBorder:string;
  badge:     string;
  tabColor:  string;
  dot:       string;
}> = {
  inventory: {
    label:      "Inventory",
    icon:       Package,
    cardBg:     "bg-orange-50",
    cardBorder: "border-orange-200",
    badge:      "bg-orange-100 text-orange-700 border-orange-200",
    tabColor:   "text-orange-600",
    dot:        "bg-orange-500",
  },
  shifts: {
    label:      "Shifts",
    icon:       Clock,
    cardBg:     "bg-blue-50",
    cardBorder: "border-blue-200",
    badge:      "bg-blue-100 text-blue-700 border-blue-200",
    tabColor:   "text-blue-600",
    dot:        "bg-blue-500",
  },
  cash: {
    label:      "Cash Draws",
    icon:       CurrencyDollar,
    cardBg:     "bg-emerald-50",
    cardBorder: "border-emerald-200",
    badge:      "bg-emerald-100 text-emerald-700 border-emerald-200",
    tabColor:   "text-emerald-600",
    dot:        "bg-emerald-500",
  },
  slots: {
    label:      "Slot Issues",
    icon:       GridFour,
    cardBg:     "bg-violet-50",
    cardBorder: "border-violet-200",
    badge:      "bg-violet-100 text-violet-700 border-violet-200",
    tabColor:   "text-violet-600",
    dot:        "bg-violet-500",
  },
};

const SEVERITY_CFG: Record<Severity, { label: string; icon: React.ElementType; badge: string; dot: string; row: string }> = {
  emergency: { label: "Emergency", icon: SealWarning, badge: "bg-red-100 text-red-700 border-red-200",     dot: "bg-red-500",    row: "border-red-200"    },
  important: { label: "Important", icon: Warning,     badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", row: "border-orange-200" },
  warning:   { label: "Warning",   icon: Warning,     badge: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-400",  row: "border-amber-200"  },
  info:      { label: "Info",      icon: Info,        badge: "bg-blue-100 text-blue-700 border-blue-200",      dot: "bg-blue-400",   row: "border-border"     },
};

const TYPE_LABEL: Record<string, string> = {
  auto_slot_assigned:        "Auto Slot Assigned",
  book_sold_out:             "Book Sold Out",
  slot_updated_by_employee:  "Slot Updated by Employee",
  shift_discrepancy_over:    "Cash Over",
  shift_discrepancy_short:   "Cash Short",
  book_action_failed:        "Book Action Failed",
  shift_clock_in:            "Employee Clocked In",
  shift_clock_out:           "Employee Clocked Out",
  duplicate_pack_detected:   "Duplicate Pack Detected",
  slot_book_removed:         "Book Removed from Slot",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

// ── Rich detail panel ─────────────────────────────────────────────────────────
function DetailPanel({ notif }: { notif: Notif }) {
  const d = notif.detail ?? {};

  // Cash discrepancy — most important, get a dedicated rich view
  if (notif.type === "shift_discrepancy_short" || notif.type === "shift_discrepancy_over") {
    const isShort   = notif.type === "shift_discrepancy_short";
    const diff      = Math.abs((d.diff as number) ?? (d.discrepancy as number) ?? 0);
    const calcCash  = (d.calcCash  as number) ?? (d.expected   as number) ?? 0;
    const actual    = (d.cashDrawer as number) ?? (d.actual     as number) ?? 0;
    const shiftId   = (d.shiftId   as string) ?? "";
    const slotNum   = (d.slotNum   as number | string);

    return (
      <div className="space-y-3">
        {/* Big headline */}
        <div className={cn(
          "flex items-center gap-4 rounded-2xl p-4 border",
          isShort ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
        )}>
          <div className={cn("text-4xl font-black tabular-nums leading-none", isShort ? "text-red-600" : "text-emerald-600")}>
            {isShort ? "−" : "+"}${diff.toFixed(2)}
          </div>
          <div>
            <p className="font-bold text-sm">{isShort ? "Drawer Short" : "Drawer Over"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isShort
                ? `$${calcCash.toFixed(2)} expected — only $${actual.toFixed(2)} found`
                : `$${calcCash.toFixed(2)} expected — $${actual.toFixed(2)} found`}
            </p>
          </div>
        </div>

        {/* Expected vs Actual */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected</p>
            <p className="text-lg font-black tabular-nums">${calcCash.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Based on ticket sales</p>
          </div>
          <div className={cn("rounded-xl p-3 space-y-0.5 border", isShort ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual Drawer</p>
            <p className={cn("text-lg font-black tabular-nums", isShort ? "text-red-600" : "text-emerald-600")}>
              ${actual.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">Counted by employee</p>
          </div>
        </div>

        {/* Extra details */}
        <div className="space-y-1.5 text-xs">
          {notif.empName && (
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
              <User className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Employee</span>
              <span className="font-semibold ml-auto">{notif.empName}</span>
            </div>
          )}
          {shiftId && (
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
              <Clock className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Shift ID</span>
              <span className="font-mono font-semibold ml-auto">{shiftId}</span>
            </div>
          )}
          {slotNum != null && (
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
              <GridFour className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Slot</span>
              <span className="font-semibold ml-auto">#{slotNum}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Book sold out
  if (notif.type === "book_sold_out") {
    const gameName = (d.gameName as string) ?? "";
    const gameId   = (d.gameId   as string) ?? "";
    const pack     = (d.pack     as string) ?? "";
    const slotNum  = (d.slotNum  as number | string);
    const price    = (d.price    as number);

    return (
      <div className="space-y-3">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Book Fully Sold</p>
          <p className="font-bold text-sm">{gameName || "Unknown Game"}</p>
          {gameId && <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {gameId}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {pack && (
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <p className="text-muted-foreground uppercase tracking-wider text-[9px] font-bold">Pack</p>
              <p className="font-bold mt-0.5">{pack}</p>
            </div>
          )}
          {price != null && (
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <p className="text-muted-foreground uppercase tracking-wider text-[9px] font-bold">Price</p>
              <p className="font-bold mt-0.5">${price}</p>
            </div>
          )}
          {slotNum != null && (
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <p className="text-muted-foreground uppercase tracking-wider text-[9px] font-bold">Slot</p>
              <p className="font-bold mt-0.5">#{slotNum}</p>
            </div>
          )}
        </div>
        {notif.empName && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 text-xs">
            <User className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Last sold by</span>
            <span className="font-semibold ml-auto">{notif.empName}</span>
          </div>
        )}
      </div>
    );
  }

  // Slot updated by employee
  if (notif.type === "slot_updated_by_employee" || notif.type === "auto_slot_assigned") {
    const slotNum   = (d.slotNum   as number | string);
    const bookId    = (d.bookId    as string) ?? (d.newBookId as string) ?? "";
    const oldBookId = (d.oldBookId as string) ?? "";
    const gameName  = (d.gameName  as string) ?? "";
    const pack      = (d.pack      as string) ?? "";

    return (
      <div className="space-y-3">
        {slotNum != null && (
          <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl p-4">
            <div className="size-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
              <GridFour weight="fill" className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Slot #{slotNum}</p>
              <p className="text-sm font-semibold">{notif.type === "auto_slot_assigned" ? "Auto-assigned by system" : "Updated by employee"}</p>
            </div>
          </div>
        )}

        {(oldBookId || gameName || bookId) && (
          <div className="space-y-2">
            {oldBookId && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs">
                <ArrowDown className="size-3 text-red-500 shrink-0" />
                <span className="text-muted-foreground">Removed</span>
                <span className="font-mono font-semibold ml-auto text-red-600">{oldBookId}</span>
              </div>
            )}
            {(bookId || gameName) && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs">
                <ArrowUp className="size-3 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">Assigned</span>
                <span className="font-semibold ml-auto text-emerald-700">{gameName || bookId}</span>
              </div>
            )}
            {pack && (
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 text-xs">
                <Package className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Pack</span>
                <span className="font-semibold ml-auto">{pack}</span>
              </div>
            )}
          </div>
        )}

        {notif.empName && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 text-xs">
            <User className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Employee</span>
            <span className="font-semibold ml-auto">{notif.empName}</span>
          </div>
        )}
      </div>
    );
  }

  // Generic fallback — structured key/value
  if (!d || Object.keys(d).length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No additional details recorded.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(d).map(([key, val]) => {
        if (val == null || val === "") return null;
        const label   = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        const isMoney = key.toLowerCase().includes("cash") || key.toLowerCase().includes("diff") || key.toLowerCase().includes("calc") || key.toLowerCase().includes("amount");
        const display = typeof val === "number" && isMoney
          ? `$${Math.abs(val as number).toFixed(2)}`
          : String(val);
        return (
          <div key={key} className="flex items-start gap-2 bg-muted/40 rounded-xl px-3 py-2 text-xs">
            <span className="text-muted-foreground w-28 shrink-0">{label}</span>
            <span className="font-semibold break-all ml-auto">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ErrorLogPage() {
  const [notifs,   setNotifs]   = useState<Notif[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Category>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/notifications");
    if (r.ok) {
      const d = await r.json() as { notifications: Notif[] };
      // Sort newest first
      const sorted = (d.notifications ?? []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifs(sorted);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(sk: string) {
    setNotifs((prev) => prev.map((n) => n.SK === sk ? { ...n, read: true } : n));
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sk }),
    });
  }

  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  async function markCategoryRead(cat: Exclude<Category, "all">) {
    const targets = notifs.filter((n) => getCategory(n.type) === cat && !n.read);
    setNotifs((prev) => prev.map((n) => getCategory(n.type) === cat ? { ...n, read: true } : n));
    await Promise.all(targets.map((n) =>
      fetch("/api/notifications", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sk: n.SK }),
      })
    ));
  }

  function toggleExpand(sk: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sk) ? next.delete(sk) : next.add(sk);
      return next;
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = filter === "all" ? notifs : notifs.filter((n) => getCategory(n.type) === filter);
  const unread   = notifs.filter((n) => !n.read).length;

  const catCounts = (["inventory", "shifts", "cash", "slots"] as Exclude<Category, "all">[]).reduce(
    (acc, cat) => {
      acc[cat] = notifs.filter((n) => getCategory(n.type) === cat).length;
      return acc;
    },
    {} as Record<Exclude<Category, "all">, number>
  );

  const catUnread = (["inventory", "shifts", "cash", "slots"] as Exclude<Category, "all">[]).reduce(
    (acc, cat) => {
      acc[cat] = notifs.filter((n) => getCategory(n.type) === cat && !n.read).length;
      return acc;
    },
    {} as Record<Exclude<Category, "all">, number>
  );

  // Group by date (already sorted newest-first)
  const grouped: { date: string; items: Notif[] }[] = [];
  for (const n of filtered) {
    const date = fmtDate(n.createdAt);
    const last = grouped[grouped.length - 1];
    if (last?.date === date) { last.items.push(n); }
    else { grouped.push({ date, items: [n] }); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Error Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            System alerts sorted by most recent — click any row for details
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-1.5">
              <CheckCircle className="size-3.5" />Mark all read
            </button>
          )}
          <button onClick={load}
            className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Category summary cards */}
      {!loading && notifs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["inventory", "shifts", "cash", "slots"] as Exclude<Category, "all">[]).map((cat) => {
            const cfg    = CATEGORY_CFG[cat];
            const Icon   = cfg.icon;
            const count  = catCounts[cat];
            const unreadN = catUnread[cat];
            const isActive = filter === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilter(isActive ? "all" : cat)}
                className={cn(
                  "rounded-2xl border p-4 text-left space-y-2 transition-all hover:brightness-95 active:scale-[0.98]",
                  cfg.cardBg, cfg.cardBorder,
                  isActive && "ring-2 ring-offset-1 ring-current/30"
                )}>
                <div className="flex items-center justify-between">
                  <div className={cn("size-8 rounded-xl flex items-center justify-center", cfg.badge.split(" ")[0])}>
                    <Icon weight="bold" className={cn("size-4", cfg.tabColor)} />
                  </div>
                  {unreadN > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markCategoryRead(cat); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                      Clear {unreadN}
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-black leading-none">{count}</p>
                  <p className={cn("text-xs font-semibold mt-0.5", cfg.tabColor)}>{cfg.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {unreadN > 0 ? `${unreadN} unread` : "All read"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-0.5 flex-wrap border-b overflow-x-auto">
        {([
          { id: "all"       as Category, label: "All",        icon: null     },
          { id: "inventory" as Category, label: "Inventory",  icon: Package  },
          { id: "shifts"    as Category, label: "Shifts",     icon: Clock    },
          { id: "cash"      as Category, label: "Cash Draws", icon: CurrencyDollar },
          { id: "slots"     as Category, label: "Slot Issues",icon: GridFour },
        ]).map(({ id, label, icon: Icon }) => {
          const active = filter === id;
          const count  = id === "all" ? notifs.length : catCounts[id as Exclude<Category, "all">];
          const unreadN = id === "all"
            ? notifs.filter((n) => !n.read).length
            : catUnread[id as Exclude<Category, "all">];
          const catCfg = id !== "all" ? CATEGORY_CFG[id as Exclude<Category, "all">] : null;
          return (
            <button key={id} onClick={() => setFilter(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                active
                  ? cn("border-primary text-primary")
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {Icon && <Icon className="size-3.5" />}
              {label}
              <span className={cn(
                "ml-0.5 text-xs px-1.5 py-0.5 rounded-full font-semibold",
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
              {unreadN > 0 && !active && (
                <span className={cn("size-1.5 rounded-full shrink-0",
                  catCfg ? catCfg.dot : "bg-primary"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="size-10 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <CheckCircle weight="fill" className="size-8 text-emerald-500" />
          </div>
          <p className="font-semibold">No {filter === "all" ? "" : CATEGORY_CFG[filter as Exclude<Category, "all">].label.toLowerCase()} alerts</p>
          <p className="text-sm text-muted-foreground">Everything looks good.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date} className="space-y-2">
              {/* Date separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-muted/50 rounded-full">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Notification rows */}
              {items.map((n) => {
                const cat    = getCategory(n.type);
                const catCfg = cat !== "all" ? CATEGORY_CFG[cat] : null;
                const sevCfg = SEVERITY_CFG[n.severity];
                const CatIcon = catCfg?.icon ?? Package;
                const isOpen = expanded.has(n.SK);
                const hasDetail = n.detail && Object.keys(n.detail).length > 0;

                return (
                  <div key={n.SK}
                    className={cn(
                      "border rounded-2xl overflow-hidden transition-all",
                      sevCfg.row,
                      !n.read && "ring-1 ring-inset ring-primary/10"
                    )}>

                    {/* Main row */}
                    <button
                      onClick={() => { toggleExpand(n.SK); if (!n.read) markRead(n.SK); }}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02] transition-all">

                      {/* Category icon */}
                      <div className={cn(
                        "size-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5",
                        catCfg?.cardBg, catCfg?.cardBorder
                      )}>
                        <CatIcon weight="fill" className={cn("size-4", catCfg?.tabColor)} />
                        {!n.read && (
                          <span className={cn("absolute -top-0.5 -right-0.5 size-2 rounded-full border-2 border-background", sevCfg.dot)} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {catCfg && (
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide", catCfg.badge)}>
                              {catCfg.label}
                            </span>
                          )}
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", sevCfg.badge)}>
                            {sevCfg.label}
                          </span>
                          {!n.read && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">NEW</span>
                          )}
                        </div>

                        <p className="text-sm font-medium leading-snug">
                          {TYPE_LABEL[n.type] ?? n.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug">{n.message}</p>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {n.empName && (
                            <span className="flex items-center gap-1">
                              <User className="size-3" />{n.empName}
                            </span>
                          )}
                          <span>{fmtDateTime(n.createdAt)}</span>
                        </div>
                      </div>

                      {/* Expand indicator */}
                      <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
                        {hasDetail && (
                          <span className={cn(
                            "text-xs text-muted-foreground transition-transform duration-200",
                            isOpen && "rotate-180"
                          )}>▾</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t px-4 py-4 bg-background/60 space-y-3">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                          What happened
                        </p>
                        <DetailPanel notif={n} />
                      </div>
                    )}

                    {/* Dismiss button when unread and not expanded */}
                    {!n.read && !isOpen && (
                      <div className="border-t px-4 py-2 flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n.SK); }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <X className="size-3" />Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
