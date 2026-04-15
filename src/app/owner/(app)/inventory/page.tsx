"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, PencilSimple, Plus, X, MagnifyingGlass, ArrowClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type BookStatus = "active" | "inactive" | "settled";
type Book = {
  bookId: string; gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
  status: BookStatus; slot: number | null; createdAt: string;
};

const STATUS_STYLE: Record<BookStatus, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  settled:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const EMPTY_FORM = { gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" };

export default function InventoryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inventory");
    if (r.ok) setBooks((await r.json()).books as Book[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = books.filter((b) =>
    [b.gameName, b.gameId, b.pack].some((v) => v.toLowerCase().includes(query.toLowerCase()))
  );

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ticketStart: Number(form.ticketStart), ticketEnd: Number(form.ticketEnd), price: Number(form.price) }),
    });
    if (res.ok) {
      const { book } = await res.json();
      setBooks((prev) => [book, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } else {
      setFormError((await res.json()).error ?? "Failed to add book.");
    }
    setSubmitting(false);
  }

  async function handleScan(file: File) {
    setScanning(true);
    setFormError("");
    try {
      // 1. Get presigned URL
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Upload failed");
      const { url, key } = await presignRes.json();

      // 2. Upload to S3
      await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      // 3. OpenAI Vision scan
      const scanRes = await fetch("/api/receipt/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!scanRes.ok) throw new Error("Could not extract receipt data.");
      const { extracted } = await scanRes.json();

      setForm({
        gameId:      extracted.gameId ?? "",
        gameName:    extracted.gameName ?? "",
        pack:        extracted.pack ?? "",
        ticketStart: String(extracted.ticketStart ?? ""),
        ticketEnd:   String(extracted.ticketEnd ?? ""),
        price:       String(extracted.price ?? ""),
      });
      setMode("manual");
    } catch (err: unknown) {
      setFormError((err as Error).message);
    }
    setScanning(false);
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{books.length} books on record</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity font-medium shadow-sm"
          >
            <Plus className="size-4" /> Add Book
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search game name, ID, pack…"
          className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
        />
      </div>

      {/* Table */}
      <div className="border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {["Game", "Pack", "Tickets", "Price", "Slot", "Status", "Added", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-16" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.map((b) => (
                    <tr key={b.bookId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.gameName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{b.gameId}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{b.pack}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">#{b.ticketStart}–#{b.ticketEnd}</td>
                      <td className="px-4 py-3">${b.price}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.slot ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[b.status])}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
                          <PencilSimple className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-muted-foreground text-sm">{query ? "No books match your search." : "No books yet. Add your first book."}</p>
          </div>
        )}
      </div>

      {/* Add Book modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Add Lottery Book</h2>
              <button onClick={() => { setShowForm(false); setFormError(""); setForm(EMPTY_FORM); }} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Mode toggle */}
              <div className="flex bg-muted rounded-xl p-1">
                {(["manual", "camera"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all",
                      mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {m === "camera" && <Camera className="size-4" />}
                    {m === "manual" ? "Manual Entry" : "Scan Receipt"}
                  </button>
                ))}
              </div>

              {mode === "camera" ? (
                <div className="space-y-3">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-8 text-center space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Camera className={cn("size-8 mx-auto text-muted-foreground", scanning && "animate-pulse")} />
                    <p className="text-sm font-medium">{scanning ? "Scanning receipt…" : "Upload receipt photo"}</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or HEIC · OpenAI Vision extracts all fields</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScan(f); }} />
                </div>
              ) : (
                <form onSubmit={addBook} className="space-y-3">
                  {[
                    { key: "gameId",      label: "Game ID",          placeholder: "G-4821",    type: "text"   },
                    { key: "gameName",    label: "Game Name",        placeholder: "Gold Rush", type: "text"   },
                    { key: "pack",        label: "Pack Number",      placeholder: "P-001",     type: "text"   },
                    { key: "ticketStart", label: "Ticket Start #",   placeholder: "1",         type: "number" },
                    { key: "ticketEnd",   label: "Ticket End #",     placeholder: "300",       type: "number" },
                    { key: "price",       label: "Price per Ticket ($)", placeholder: "5",     type: "number" },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs font-medium block mb-1">{label}</label>
                      <input
                        type={type}
                        required
                        placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full border rounded-xl px-3.5 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                      />
                    </div>
                  ))}
                  {formError && <p className="text-xs text-destructive">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="flex-1 border rounded-xl py-2.5 text-sm hover:bg-muted transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center">
                      {submitting ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : "Add Book"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
