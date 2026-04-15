"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Status = "inactive" | "active" | "settled";
type Book = {
  bookId: string; gameId: string; gameName: string; pack: string; price: number;
  slot: number | null; status: Status; activatedAt: string | null; settledAt: string | null;
};

const TABS: { label: string; value: Status | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Settled", value: "settled" },
];

const STATUS_STYLE: Record<Status, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  settled:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status | "all">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inventory");
    if (r.ok) setBooks((await r.json()).books as Book[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(bookId: string, status: Status, slot: number | null = null) {
    setUpdating(bookId);
    const body: Record<string, unknown> = { status };
    if (slot !== undefined) body.slot = slot;
    const r = await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      setBooks((prev) => prev.map((b) =>
        b.bookId !== bookId ? b : {
          ...b, status,
          activatedAt: status === "active" ? new Date().toISOString() : b.activatedAt,
          settledAt:   status === "settled" ? new Date().toISOString() : b.settledAt,
          slot: status === "settled" ? null : (slot ?? b.slot),
        }
      ));
    }
    setUpdating(null);
  }

  const visible = tab === "all" ? books : books.filter((b) => b.status === tab);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Activate / Deactivate / Settle</h1>
        <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const count = t.value === "all" ? books.length : books.filter((b) => b.status === t.value).length;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {["Game", "Pack", "Price", "Slot", "Status", "Activated", "Settled", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-16" /></td>
                    ))}</tr>
                  ))
                : visible.map((b) => (
                    <tr key={b.bookId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.gameName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{b.gameId}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{b.pack}</td>
                      <td className="px-4 py-3">${b.price}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.slot ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[b.status])}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(b.activatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(b.settledAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {updating === b.bookId && <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
                          {updating !== b.bookId && b.status === "inactive" && (
                            <button onClick={() => updateStatus(b.bookId, "active")}
                              className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium">
                              Activate
                            </button>
                          )}
                          {updating !== b.bookId && b.status === "active" && (
                            <>
                              <button onClick={() => updateStatus(b.bookId, "inactive")}
                                className="text-xs px-3 py-1 rounded-lg border hover:bg-accent transition-colors font-medium">
                                Deactivate
                              </button>
                              <button onClick={() => updateStatus(b.bookId, "settled")}
                                className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium">
                                Settle
                              </button>
                            </>
                          )}
                          {updating !== b.bookId && b.status === "settled" && (
                            <span className="text-xs text-muted-foreground">Completed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!loading && visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">No books in this category.</p>
        )}
      </div>
    </div>
  );
}
