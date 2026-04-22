"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise, UploadSimple, X, CheckCircle,
  Warning, Spinner, FileMagnifyingGlass, Camera, Upload, ArrowRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Status = "inactive" | "active" | "settled";
type Book = {
  bookId: string; gameId: string; gameName: string; pack: string; price: number;
  slot: number | null; status: Status; activatedAt: string | null; settledAt: string | null;
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
  book: Book;
  action: ActionType;
  onConfirm: () => void;
  onClose: () => void;
}

function ReceiptModal({ book, action, onConfirm, onClose }: ReceiptModalProps) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [state,    setState]  = useState<ModalState>({ type: "idle" });
  const [photos,   setPhotos] = useState<{ file: File; preview: string }[]>([]);
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

              {/* Photo grid */}
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
  const [books,   setBooks]   = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Status | "all">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<{ book: Book; action: ActionType } | null>(null);

  // Error log
  const [errorLog, setErrorLog] = useState<{ bookId: string; gameName: string; msg: string }[]>([]);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inventory");
    if (r.ok) setBooks((await r.json()).books as Book[]);
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
      if (book) setErrorLog((prev) => [...prev, { bookId, gameName: book.gameName, msg: data.error ?? "Update failed" }]);
    }
    setUpdating(null);
    setModal(null);
  }

  // Bulk actions
  async function bulkUpdate(fromStatus: Status, toStatus: Status) {
    const targets = books.filter((b) => b.status === fromStatus);
    for (const b of targets) await updateStatus(b.bookId, toStatus);
  }

  function openModal(book: Book, action: ActionType) {
    setModal({ book, action });
  }

  function handleConfirm() {
    if (!modal) return;
    const status: Status =
      modal.action === "activate"   ? "active"   :
      modal.action === "deactivate" ? "inactive" : "settled";
    updateStatus(modal.book.bookId, status);
  }

  const visible = tab === "all" ? books : books.filter((b) => b.status === tab);
  const inactiveCount = books.filter((b) => b.status === "inactive").length;
  const activeCount   = books.filter((b) => b.status === "active").length;

  return (
    <div className="p-6 space-y-5">
      {modal && (
        <ReceiptModal
          book={modal.book}
          action={modal.action}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Activate / Deactivate / Settle</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {inactiveCount > 0 && (
            <button onClick={() => bulkUpdate("inactive", "active")} disabled={!!updating}
              className="text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50">
              Activate All ({inactiveCount})
            </button>
          )}
          {activeCount > 0 && (
            <button onClick={() => bulkUpdate("active", "inactive")} disabled={!!updating}
              className="text-xs px-3 py-2 rounded-xl border hover:bg-accent transition-colors font-medium disabled:opacity-50">
              Deactivate All ({activeCount})
            </button>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Error log */}
      {errorLog.length > 0 && (
        <div className="border border-destructive/30 rounded-2xl p-4 space-y-2 bg-destructive/5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-destructive uppercase tracking-widest">Error Log</p>
            <button onClick={() => setErrorLog([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          {errorLog.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-destructive">
              <X className="size-3.5 shrink-0 mt-0.5" />
              <span><span className="font-medium">{e.gameName}</span>: {e.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
          const count = t.value === "all" ? books.length : books.filter((b) => b.status === t.value).length;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
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
          <table className="w-full text-sm min-w-[640px]">
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
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(b.activatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(b.settledAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {updating === b.bookId && (
                            <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          )}
                          {updating !== b.bookId && b.status === "inactive" && (
                            <button onClick={() => openModal(b, "activate")}
                              className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium inline-flex items-center gap-1">
                              <FileMagnifyingGlass className="size-3" />
                              Activate
                            </button>
                          )}
                          {updating !== b.bookId && b.status === "active" && (
                            <>
                              <button onClick={() => openModal(b, "deactivate")}
                                className="text-xs px-3 py-1 rounded-lg border hover:bg-accent transition-colors font-medium">
                                Deactivate
                              </button>
                              <button onClick={() => openModal(b, "settle")}
                                className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-1">
                                <FileMagnifyingGlass className="size-3" />
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
