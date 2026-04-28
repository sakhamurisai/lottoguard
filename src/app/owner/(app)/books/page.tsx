"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowClockwise, UploadSimple, X, CheckCircle,
  Warning, Spinner, FileMagnifyingGlass, Camera, Upload, ArrowRight,
  Package, MagnifyingGlass, Funnel, ToggleLeft, BookOpen, Lightning,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const TIER_HEX: Record<number, string> = {
   1: "#10b981",  2: "#14b8a6",  5: "#0ea5e9", 10: "#3b82f6",
  20: "#8b5cf6", 30: "#d946ef", 50: "#f43f5e",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "inactive" | "active" | "settled";

type Book = {
  bookId:      string;
  gameId:      string;
  gameName:    string;
  pack:        string;
  price:       number;
  slot:        number | null;
  status:      Status;
  activatedAt: string | null;
  settledAt:   string | null;
  shipmentId?: string | null;
};

type Shipment = {
  shipmentId:   string;
  shipmentNum?: string;
  orderNumber?: string;
  date?:        string;
  totalBooks?:  number;
  notes?:       string;
  createdAt:    string;
};

type ActionType = "activate" | "deactivate" | "settle";

const TABS: { label: string; value: Status | "all" }[] = [
  { label: "All",      value: "all"      },
  { label: "Active",   value: "active"   },
  { label: "Inactive", value: "inactive" },
  { label: "Settled",  value: "settled"  },
];

const STATUS_STYLE: Record<Status, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  settled:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const ACTION_LABEL: Record<ActionType, string> = {
  activate:   "Activate",
  deactivate: "Deactivate",
  settle:     "Settle",
};

const ACTION_COLOR: Record<ActionType, string> = {
  activate:   "bg-emerald-600 hover:bg-emerald-700 text-white",
  deactivate: "border border-border hover:bg-accent text-foreground",
  settle:     "bg-blue-600 hover:bg-blue-700 text-white",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}

// ── Receipt scan modal ────────────────────────────────────────────────────────

type ScanResult = {
  action: string; bookNumber: string | null; gameId: string | null;
  gameName: string | null; date: string | null; terminalNum: string | null;
  retailerNum: string | null; status: string | null;
};

type ModalState =
  | { type: "idle" }
  | { type: "uploading" }
  | { type: "scanning" }
  | { type: "result"; scan: ScanResult; warnings: string[]; errors: string[] }
  | { type: "confirming" };

interface ReceiptModalProps {
  book:      Book;
  action:    ActionType;
  onConfirm: () => void;
  onClose:   () => void;
}

function ReceiptModal({ book, action, onConfirm, onClose }: ReceiptModalProps) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [state,    setState]    = useState<ModalState>({ type: "idle" });
  const [photos,   setPhotos]   = useState<{ file: File; preview: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = 10 - photos.length;
    if (remaining <= 0) return;
    const added = Array.from(fileList).slice(0, remaining).map(f => ({
      file: f, preview: URL.createObjectURL(f),
    }));
    setPhotos(prev => [...prev, ...added]);
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleScan() {
    if (photos.length === 0) return;
    setState({ type: "uploading" });
    try {
      for (const { file } of photos) {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        if (!presignRes.ok) continue;
        const { url, key } = await presignRes.json() as { url: string; key: string };
        const uploadRes = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!uploadRes.ok) continue;

        setState({ type: "scanning" });
        const scanRes = await fetch("/api/receipt/scan-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        if (!scanRes.ok) continue;
        const { data } = await scanRes.json() as { data: ScanResult };

        const warnings: string[] = [];
        const errors:   string[] = [];

        const expectedAction = action === "activate" ? "activate" : action === "deactivate" ? "deactivate" : "settle";
        if (data.action && data.action !== "unknown" && data.action !== expectedAction) {
          errors.push(`Receipt says "${data.action}" but you are trying to ${action} this book.`);
        }

        const normalizedExtracted = (data.bookNumber ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
        const normalizedBook      = (book.pack ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (normalizedExtracted && normalizedBook && normalizedExtracted !== normalizedBook) {
          warnings.push(`Receipt book # (${data.bookNumber}) differs from selected book pack (${book.pack}). Verify before confirming.`);
        }

        setState({ type: "result", scan: data, warnings, errors });
        return;
      }
      setState({ type: "result", scan: { action: "unknown", bookNumber: null, gameId: null, gameName: null, date: null, terminalNum: null, retailerNum: null, status: null }, warnings: [], errors: ["Could not read any of the uploaded receipts. Try clearer photos."] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setState({ type: "result", scan: { action: "unknown", bookNumber: null, gameId: null, gameName: null, date: null, terminalNum: null, retailerNum: null, status: null }, warnings: [], errors: [msg] });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  const isIdle     = state.type === "idle";
  const isBusy     = state.type === "uploading" || state.type === "scanning" || state.type === "confirming";
  const hasResult  = state.type === "result";
  const hasErrors  = hasResult && state.errors.length > 0;
  const canConfirm = hasResult && state.errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <div>
            <h2 className="font-semibold">{ACTION_LABEL[action]}: {book.gameName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pack {book.pack} · ${book.price}/ticket</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Upload zone */}
          {(isIdle || hasResult) && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {isIdle ? "Upload terminal receipt (optional)" : "Re-scan receipt"}
              </p>

              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80 transition-colors">
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 10 && (
                    <button type="button" onClick={() => galleryRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      <Upload className="size-4" />
                    </button>
                  )}
                </div>
              )}

              {photos.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 text-center transition-colors space-y-3",
                    dragOver ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <UploadSimple className="size-6 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Drag & drop or choose photos (up to 10)</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP, HEIC</p>
                  <div className="flex justify-center gap-3">
                    <button type="button" onClick={() => cameraRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-medium hover:bg-primary/20 transition-colors">
                      <Camera className="size-3.5" /> Camera
                    </button>
                    <button type="button" onClick={() => galleryRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-medium hover:bg-primary/20 transition-colors">
                      <Upload className="size-3.5" /> Gallery
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => cameraRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 border rounded-xl py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all">
                    <Camera className="size-4" />
                  </button>
                  <button type="button" onClick={() => galleryRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 border rounded-xl py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all">
                    <Upload className="size-4" />
                  </button>
                  <button type="button" onClick={handleScan} disabled={photos.length === 0}
                    className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <ArrowRight className="size-4" /> Scan
                  </button>
                </div>
              )}

              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>
          )}

          {/* Busy states */}
          {(state.type === "uploading" || state.type === "scanning") && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Spinner className="size-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                {state.type === "uploading" ? "Uploading receipt…" : "Reading receipt with AI…"}
              </p>
            </div>
          )}

          {/* Scan result */}
          {hasResult && (
            <div className="space-y-3">
              {state.errors.map((e, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-destructive/8 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <X className="size-4 shrink-0 mt-0.5" />
                  {e}
                </div>
              ))}
              {state.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40 rounded-xl text-sm text-amber-800 dark:text-amber-300">
                  <Warning className="size-4 shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
              {!hasErrors && (
                <div className="flex gap-2 items-start p-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40 rounded-xl text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle weight="fill" className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Receipt verified</p>
                    {state.scan.bookNumber && <p className="text-xs mt-0.5">Book: {state.scan.bookNumber}</p>}
                    {state.scan.gameName && <p className="text-xs">Game: {state.scan.gameName}</p>}
                    {state.scan.date && <p className="text-xs">Date: {state.scan.date}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {state.type === "confirming" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Spinner className="size-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Updating book status…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} disabled={isBusy}
            className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
            Cancel
          </button>
          {isIdle && (
            <button onClick={onConfirm}
              className={cn("flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors", ACTION_COLOR[action])}>
              Skip & {ACTION_LABEL[action]}
            </button>
          )}
          {canConfirm && (
            <button onClick={onConfirm} disabled={isBusy}
              className={cn("flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50", ACTION_COLOR[action])}>
              Confirm {ACTION_LABEL[action]}
            </button>
          )}
          {hasErrors && (
            <button onClick={onConfirm} disabled={isBusy}
              className="flex-1 border border-amber-400 text-amber-700 dark:text-amber-400 rounded-xl py-2.5 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50">
              Override & {ACTION_LABEL[action]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BooksPage() {
  const [books,     setBooks]     = useState<Book[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Status | "all">("all");
  const [updating,  setUpdating]  = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("");
  const [query,        setQuery]        = useState("");
  const [priceFilter,  setPriceFilter]  = useState<number | "all">("all");
  const [view,         setView]         = useState<"table" | "cards">("table");

  const [modal, setModal] = useState<{ book: Book; action: ActionType } | null>(null);

  async function load() {
    setLoading(true);
    const [booksRes, shipmentsRes] = await Promise.all([
      fetch("/api/inventory"),
      fetch("/api/shipments"),
    ]);
    if (booksRes.ok)     setBooks((await booksRes.json()).books as Book[]);
    if (shipmentsRes.ok) setShipments((await shipmentsRes.json()).shipments as Shipment[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(bookId: string, status: Status) {
    setUpdating(bookId);
    const r = await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      setBooks((prev) => prev.map((b) =>
        b.bookId !== bookId ? b : {
          ...b, status,
          activatedAt: status === "active"  ? new Date().toISOString() : b.activatedAt,
          settledAt:   status === "settled" ? new Date().toISOString() : b.settledAt,
        }
      ));
    } else {
      const data = await r.json() as { error?: string };
      const book = books.find((b) => b.bookId === bookId);
      // Persist failure to the error log
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:     "book_action_failed",
          severity: "important",
          message:  `Failed to ${status === "active" ? "activate" : status === "settled" ? "settle" : "deactivate"} "${book?.gameName ?? "book"}" (Pack ${book?.pack ?? bookId}): ${data.error ?? "Update failed"}`,
          detail:   { bookId, gameName: book?.gameName, pack: book?.pack, targetStatus: status, error: data.error ?? "Update failed" },
        }),
      }).catch(() => {});
    }
    setUpdating(null);
    setModal(null);
  }

  async function bulkUpdate(fromStatus: Status, toStatus: Status) {
    const targets = booksInView.filter((b) => b.status === fromStatus);
    for (const b of targets) await updateStatus(b.bookId, toStatus);
  }

  function openModal(book: Book, action: ActionType) { setModal({ book, action }); }

  function handleConfirm() {
    if (!modal) return;
    const status: Status =
      modal.action === "activate"   ? "active"   :
      modal.action === "deactivate" ? "inactive" : "settled";
    updateStatus(modal.book.bookId, status);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const booksInView = useMemo(() => {
    let list = selectedShipmentId
      ? books.filter((b) => b.shipmentId === selectedShipmentId)
      : books;
    if (priceFilter !== "all") list = list.filter((b) => b.price === priceFilter);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((b) =>
        b.gameName.toLowerCase().includes(q) ||
        b.gameId.toLowerCase().includes(q) ||
        b.pack.toLowerCase().includes(q)
      );
    }
    return list;
  }, [books, selectedShipmentId, priceFilter, query]);

  const visible       = tab === "all" ? booksInView : booksInView.filter((b) => b.status === tab);
  const inactiveCount = booksInView.filter((b) => b.status === "inactive").length;
  const activeCount   = booksInView.filter((b) => b.status === "active").length;
  const settledCount  = booksInView.filter((b) => b.status === "settled").length;
  const selectedShipment = shipments.find((s) => s.shipmentId === selectedShipmentId);
  const totalValue = booksInView.reduce((sum, b) => sum + b.price, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">
      {modal && (
        <ReceiptModal
          book={modal.book}
          action={modal.action}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <ToggleLeft weight="fill" className="size-6 text-primary" />
            Activate / Settle
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Manage book statuses · scan terminal receipts to verify</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {inactiveCount > 0 && (
            <button onClick={() => bulkUpdate("inactive", "active")} disabled={!!updating}
              className="text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
              <Lightning weight="fill" className="size-3.5" /> Activate All ({inactiveCount})
            </button>
          )}
          {activeCount > 0 && (
            <button onClick={() => bulkUpdate("active", "inactive")} disabled={!!updating}
              className="text-xs px-3 py-2 rounded-xl border hover:bg-muted transition-colors font-semibold disabled:opacity-50">
              Deactivate All ({activeCount})
            </button>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Active",    value: activeCount,   color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Inactive",  value: inactiveCount, color: "text-foreground",  bg: "bg-muted/40 border-border" },
          { label: "Settled",   value: settledCount,  color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
          { label: "Est. Value", value: `$${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue.toLocaleString()}`, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between", bg)}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={cn("text-base sm:text-lg font-black tabular-nums", color)}>{loading ? "—" : value}</span>
          </div>
        ))}
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────────── */}
      <div className="border rounded-2xl bg-card shadow-sm p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search game, pack, or game ID…"
              className="w-full border rounded-xl pl-10 pr-9 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Shipment select */}
          <select value={selectedShipmentId}
            onChange={(e) => { setSelectedShipmentId(e.target.value); setTab("all"); }}
            disabled={loading}
            className="border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-64 shrink-0 font-medium">
            <option value="">All Shipments ({books.length} books)</option>
            {shipments.map((s) => (
              <option key={s.shipmentId} value={s.shipmentId}>
                {s.shipmentNum ? `#${s.shipmentNum}` : "(no number)"}
                {s.totalBooks != null ? ` · ${s.totalBooks} books` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Selected shipment chip */}
        {selectedShipment && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
            <Package className="size-3.5 text-primary shrink-0" />
            <p className="text-xs font-medium flex-1 truncate">
              <span className="font-bold">Shipment {selectedShipment.shipmentNum ?? "(no #)"}</span>
              <span className="text-muted-foreground"> · {fmtDate(selectedShipment.date ?? selectedShipment.createdAt)}</span>
              {selectedShipment.orderNumber && <span className="text-muted-foreground"> · Order {selectedShipment.orderNumber}</span>}
            </p>
            <button onClick={() => setSelectedShipmentId("")} className="shrink-0 text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1">
              <X className="size-3" /> Clear
            </button>
          </div>
        )}

        {/* Price tier chips + view toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
            <Funnel className="size-3" /> Price:
          </span>
          {(["all", 1, 2, 5, 10, 20, 30, 50] as const).map((p) => {
            const isActive = priceFilter === p;
            return (
              <button key={p} onClick={() => setPriceFilter(p)}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded-full border transition-all tabular-nums",
                  isActive
                    ? "text-white border-transparent shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                )}
                style={isActive && p !== "all" ? { background: TIER_HEX[p] } : isActive ? { background: "#0f172a" } : undefined}>
                {p === "all" ? "All" : `$${p}`}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-0.5 border rounded-lg bg-muted/40 p-0.5 hidden sm:flex">
            {(["table", "cards"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded transition-all capitalize",
                  view === v ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => {
          const count = t.value === "all"
            ? booksInView.length
            : booksInView.filter((b) => b.status === t.value).length;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
                tab === t.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t.label}
              <span className={cn("ml-1.5 text-xs tabular-nums", tab === t.value ? "text-primary font-bold" : "text-muted-foreground")}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Mobile cards (always on small screens, optional on large) ────────── */}
      <div className={cn("space-y-2 sm:hidden", view === "cards" && "sm:block sm:space-y-3")}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 border rounded-2xl bg-muted/40 animate-pulse" />
            ))
          : visible.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl space-y-2">
              <BookOpen className="size-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No books match your filters</p>
              {(query || priceFilter !== "all" || selectedShipmentId) && (
                <button onClick={() => { setQuery(""); setPriceFilter("all"); setSelectedShipmentId(""); }}
                  className="text-xs text-primary hover:underline font-semibold">
                  Clear all filters
                </button>
              )}
            </div>
          ) : visible.map((b) => (
            <div key={b.bookId} className="border rounded-2xl bg-card p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="size-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: `${TIER_HEX[b.price]}1a`, color: TIER_HEX[b.price] }}>
                    ${b.price}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{b.gameName}</p>
                    <p className="text-xs text-muted-foreground font-mono">Pack {b.pack} · {b.gameId}</p>
                    {b.slot && <p className="text-xs text-muted-foreground mt-0.5">Slot #{b.slot}</p>}
                  </div>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold capitalize shrink-0", STATUS_STYLE[b.status])}>
                  {b.status}
                </span>
              </div>

              {(b.activatedAt || b.settledAt) && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2.5">
                  {b.activatedAt && <span>Activated {fmt(b.activatedAt)}</span>}
                  {b.settledAt && <span>Settled {fmt(b.settledAt)}</span>}
                </div>
              )}

              <div className="flex gap-2">
                {updating === b.bookId ? (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-2 py-1.5">
                    <span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Updating…
                  </span>
                ) : b.status === "inactive" ? (
                  <button onClick={() => openModal(b, "activate")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-semibold inline-flex items-center gap-1.5">
                    <FileMagnifyingGlass className="size-3.5" /> Activate
                  </button>
                ) : b.status === "active" ? (
                  <>
                    <button onClick={() => openModal(b, "deactivate")}
                      className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors font-semibold">
                      Deactivate
                    </button>
                    <button onClick={() => openModal(b, "settle")}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-1.5">
                      <FileMagnifyingGlass className="size-3.5" /> Settle
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 py-1.5">
                    <CheckCircle weight="fill" className="size-3.5 text-blue-500" /> Settled — read only
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────────────── */}
      <div className={cn("hidden sm:block border rounded-2xl overflow-hidden shadow-sm bg-card", view === "cards" && "sm:hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                {["Game", "Pack", "Price", "Slot", "Status", "Activated", "Settled", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                        <p className="font-semibold">{b.gameName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{b.gameId}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{b.pack}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                          style={{ background: `${TIER_HEX[b.price]}1a`, color: TIER_HEX[b.price] }}>
                          ${b.price}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{b.slot ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold capitalize", STATUS_STYLE[b.status])}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(b.activatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(b.settledAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {updating === b.bookId && (
                            <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          )}
                          {updating !== b.bookId && b.status === "inactive" && (
                            <button onClick={() => openModal(b, "activate")}
                              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-semibold inline-flex items-center gap-1">
                              <FileMagnifyingGlass className="size-3" /> Activate
                            </button>
                          )}
                          {updating !== b.bookId && b.status === "active" && (
                            <>
                              <button onClick={() => openModal(b, "deactivate")}
                                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors font-semibold">
                                Deactivate
                              </button>
                              <button onClick={() => openModal(b, "settle")}
                                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-1">
                                <FileMagnifyingGlass className="size-3" /> Settle
                              </button>
                            </>
                          )}
                          {updating !== b.bookId && b.status === "settled" && (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <CheckCircle weight="fill" className="size-3 text-blue-500" /> Done
                            </span>
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
          <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
            <BookOpen className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No books match your filters.</p>
            {(query || priceFilter !== "all" || selectedShipmentId) && (
              <button onClick={() => { setQuery(""); setPriceFilter("all"); setSelectedShipmentId(""); }}
                className="text-xs text-primary hover:underline font-semibold">
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
