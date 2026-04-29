"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera, Plus, X, MagnifyingGlass, ArrowClockwise,
  CheckCircle, XCircle, Warning, Upload, FileText,
  CheckSquare, Square, ArrowRight, ArrowLeft,
  ImageBroken, PencilSimple, FloppyDisk, Paperclip,
  Image as ImageIcon, Spinner, Truck, Package,
  Trash, DotsThreeVertical, CaretRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

// ── Types ─────────────────────────────────────────────────────────────────────

type BookStatus = "active" | "inactive" | "settled";

type Book = {
  bookId: string; gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
  status: BookStatus; slot: number | null; createdAt: string;
  updatedAt?: string; receiptKey?: string | null; shipmentId?: string | null;
};

type Shipment = {
  shipmentId: string; name?: string; orderNumber?: string; shipmentNum?: string;
  date?: string; retailerNum?: string; totalBooks: number;
  notes?: string; source?: "ai" | "manual"; createdAt: string; updatedAt?: string;
};

type ReviewBook = {
  gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
};

type Step =
  | "idle" | "method"
  | "delivery" | "delivery-result"
  | "order"   | "order-result"
  | "review"
  | "manual";

type ValidationCheck = { label: string; status: "pass" | "fail" | "warn"; detail?: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<BookStatus, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  settled:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const PRICE_COLOR: Record<number, string> = {
  1:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  2:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  3:  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  5:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  10: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  20: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  30: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  50: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseDetailValues(detail: string): { delivery: string; order: string } | null {
  const vs   = detail.match(/^Delivery:\s*(.+?)\s+vs\s+Order:\s*(.+)$/);
  if (vs)   return { delivery: vs[1], order: vs[2] };
  const pipe = detail.match(/^Delivery:\s*(.+?)\s*\|\s*Order:\s*(.+)$/);
  if (pipe) return { delivery: pipe[1], order: pipe[2] };
  return null;
}

// "048159" and "48159" both normalize to "48159" so they compare as equal.
function normRetailer(s: string): string {
  return (s ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "");
}

function normalizeAddress(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\b[a-z]{2}\s+\d{5}(-\d{4})?\b/g, "") // strip state + zip ("oh 45169")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addressesMatch(receipt: string, org: string): boolean {
  const nr = normalizeAddress(receipt);
  const no = normalizeAddress(org);
  if (!nr || !no) return false;
  return nr.includes(no) || no.includes(nr);
}

// ── ValidationBadge ───────────────────────────────────────────────────────────

function ValidationBadge({ check, onClick }: { check: ValidationCheck; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3 text-sm border",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        check.status === "pass" && "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40",
        check.status === "fail" && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40",
        check.status === "warn" && "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40",
      )}
    >
      {check.status === "pass" && <CheckCircle weight="fill" className="size-4 text-emerald-600 mt-0.5 shrink-0" />}
      {check.status === "fail" && <XCircle    weight="fill" className="size-4 text-red-600 mt-0.5 shrink-0" />}
      {check.status === "warn" && <Warning    weight="fill" className="size-4 text-amber-600 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-sm",
          check.status === "pass" && "text-emerald-800 dark:text-emerald-300",
          check.status === "fail" && "text-red-800 dark:text-red-300",
          check.status === "warn" && "text-amber-800 dark:text-amber-300",
        )}>{check.label}</p>
        {check.detail && <p className="text-xs mt-0.5 opacity-70">{check.detail}</p>}
      </div>
      {onClick && (
        <CaretRight className={cn(
          "size-4 shrink-0 mt-0.5",
          check.status === "fail" && "text-red-400 dark:text-red-500",
          check.status === "warn" && "text-amber-400 dark:text-amber-500",
          check.status === "pass" && "text-emerald-400 dark:text-emerald-500",
        )} />
      )}
    </div>
  );
}

// ── UploadZone ────────────────────────────────────────────────────────────────

function UploadZone({ scanning, onFiles, error, onRetry }: {
  scanning: boolean; onFiles: (files: File[]) => void; error?: string | null; onRetry?: () => void;
}) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = 10 - photos.length;
    if (remaining <= 0) return;
    const added = Array.from(fileList).slice(0, remaining).map(f => ({
      file: f, preview: URL.createObjectURL(f),
    }));
    setPhotos(prev => [...prev, ...added]);
    onRetry?.();
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  if (error && photos.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5 bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40 flex items-start gap-3">
          <ImageBroken className="size-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Could not read image</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">{error}</p>
            <ul className="text-xs text-amber-600 dark:text-amber-500 mt-2 space-y-1 list-disc ml-4">
              <li>Ensure the receipt is flat and fully in frame</li>
              <li>Use bright, even lighting — avoid shadows</li>
              <li>Hold the camera steady and close enough to read text</li>
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { onRetry?.(); cameraRef.current?.click(); }}
            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-4 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
            <Camera className="size-4" /> Camera
          </button>
          <button onClick={() => { onRetry?.(); galleryRef.current?.click(); }}
            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-4 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
            <Upload className="size-4" /> Upload
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80 transition-colors">
                <X className="size-3" />
              </button>
            </div>
          ))}
          {photos.length < 10 && !scanning && (
            <button type="button" onClick={() => galleryRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Upload className="size-5" />
            </button>
          )}
        </div>
      )}

      {scanning ? (
        <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-3 bg-muted/10">
          <span className="size-12 rounded-full border-4 border-primary border-t-transparent animate-spin block mx-auto" />
          <p className="text-sm font-semibold">Scanning with AI…</p>
          <p className="text-xs text-muted-foreground">Extracting every character from the receipt</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-8 text-center space-y-3">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Upload className="size-7 text-primary" />
          </div>
          <p className="font-semibold text-sm">Add up to 10 photos</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, HEIC · Up to 10 images</p>
          <div className="flex justify-center gap-3 pt-1">
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
          <button type="button" disabled={scanning}
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-1.5 border rounded-xl py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Camera className="size-4" />
          </button>
          <button type="button" disabled={scanning}
            onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-1.5 border rounded-xl py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Upload className="size-4" />
          </button>
          <button type="button" disabled={scanning || photos.length === 0}
            onClick={() => onFiles(photos.map(p => p.file))}
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
  );
}

// ── ShipmentCard ──────────────────────────────────────────────────────────────

function ShipmentCard({
  shipment, books, onClick,
}: {
  shipment: Shipment | null; // null = "manual entries" virtual card
  books: Book[];
  onClick: () => void;
}) {
  const isManual   = shipment === null;
  const activeCount   = books.filter((b) => b.status === "active").length;
  const inactiveCount = books.filter((b) => b.status === "inactive").length;
  const settledCount  = books.filter((b) => b.status === "settled").length;
  const dateStr = shipment
    ? (shipment.date ? new Date(shipment.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : fmtDate(shipment.createdAt))
    : "Various";

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col border rounded-2xl p-4 bg-card hover:border-primary/50 hover:shadow-md transition-all text-left w-full overflow-hidden"
    >
      {/* Top accent stripe */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-1 rounded-t-2xl",
        isManual ? "bg-muted-foreground/20" : "bg-primary/70"
      )} />

      {/* Icon + order number */}
      <div className="flex items-start justify-between gap-2 mt-2 mb-3">
        <div className={cn(
          "size-9 rounded-xl flex items-center justify-center shrink-0",
          isManual ? "bg-muted" : "bg-primary/10 group-hover:bg-primary/20 transition-colors"
        )}>
          {isManual
            ? <Package className="size-4 text-muted-foreground" />
            : <Truck className="size-4 text-primary" />
          }
        </div>
        <CaretRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1.5 shrink-0" />
      </div>

      {/* Shipment identifier */}
      <div className="flex-1 min-w-0 space-y-0.5 mb-3">
        {isManual ? (
          <p className="font-semibold text-sm text-muted-foreground">Manual Entries</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm truncate">
                {shipment!.name || (shipment!.shipmentNum ? `Shipment ${shipment!.shipmentNum}` : "Shipment")}
              </p>
              {shipment!.source && (
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0",
                  shipment!.source === "ai"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
                )}>
                  {shipment!.source === "ai" ? "AI" : "Manual"}
                </span>
              )}
            </div>
            {shipment!.orderNumber && (
              <p className="font-mono text-xs text-muted-foreground">#{shipment!.orderNumber}</p>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">{dateStr}</p>
      </div>

      {/* Book count */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-2xl font-black text-foreground">{books.length}</span>
        <span className="text-xs text-muted-foreground font-medium">book{books.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1">
        {activeCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
            {activeCount} active
          </span>
        )}
        {inactiveCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {inactiveCount} inactive
          </span>
        )}
        {settledCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
            {settledCount} settled
          </span>
        )}
        {books.length === 0 && (
          <span className="text-xs text-muted-foreground">No books</span>
        )}
      </div>
    </button>
  );
}

// ── ShipmentDrawer ────────────────────────────────────────────────────────────

function ShipmentDrawer({
  shipment, books, isManual, slotNames,
  onClose, onBookUpdated, onBookDeleted, onBookAdded, onShipmentDeleted, onShipmentUpdated,
}: {
  shipment: Shipment | null;
  books: Book[];
  isManual: boolean;
  slotNames: Record<string, string>;
  onClose: () => void;
  onBookUpdated: (b: Book) => void;
  onBookDeleted: (bookId: string) => void;
  onBookAdded: (b: Book) => void;
  onShipmentDeleted: (shipmentId: string) => void;
  onShipmentUpdated: (s: Shipment) => void;
}) {
  const receiptFileRef = useRef<HTMLInputElement>(null);

  const [expandedBook, setExpandedBook]   = useState<string | null>(null);
  const [editingBook,  setEditingBook]    = useState<string | null>(null);
  const [bookForms,    setBookForms]      = useState<Record<string, Record<string, string>>>({});
  const [bookSaving,   setBookSaving]     = useState<string | null>(null);
  const [bookDeleting, setBookDeleting]   = useState<string | null>(null);
  const [delConfirm,   setDelConfirm]     = useState<string | null>(null);

  const [editingShipment, setEditingShipment] = useState(false);
  const [shipmentForm,    setShipmentForm]    = useState({
    name:        shipment?.name        ?? "",
    orderNumber: shipment?.orderNumber ?? "",
    shipmentNum: shipment?.shipmentNum ?? "",
    date:        shipment?.date ?? "",
    notes:       shipment?.notes ?? "",
  });
  const [shipmentSaving,  setShipmentSaving]  = useState(false);

  const [delShipmentConfirm, setDelShipmentConfirm] = useState(false);
  const [delShipmentBusy,    setDelShipmentBusy]    = useState(false);

  // Add book to this shipment
  const [addingBook,    setAddingBook]    = useState(false);
  const [addBookForm,   setAddBookForm]   = useState({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
  const [addBookError,  setAddBookError]  = useState("");
  const [addBookBusy,   setAddBookBusy]   = useState(false);

  // Receipt upload per book
  const [receiptUploading, setReceiptUploading] = useState<string | null>(null);
  const [receiptUrls,      setReceiptUrls]      = useState<Record<string, string>>({});

  function initBookForm(b: Book) {
    setBookForms((prev) => ({
      ...prev,
      [b.bookId]: {
        gameId:      b.gameId,
        gameName:    b.gameName,
        pack:        b.pack,
        ticketStart: String(b.ticketStart),
        ticketEnd:   String(b.ticketEnd),
        price:       String(b.price),
      },
    }));
  }

  async function saveBook(b: Book) {
    const f = bookForms[b.bookId];
    if (!f) return;
    setBookSaving(b.bookId);
    const r = await fetch(`/api/books/${b.bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId:      f.gameId,
        gameName:    f.gameName,
        pack:        f.pack,
        ticketStart: Number(f.ticketStart),
        ticketEnd:   Number(f.ticketEnd),
        price:       Number(f.price),
      }),
    });
    if (r.ok) {
      onBookUpdated({
        ...b, ...f,
        ticketStart: Number(f.ticketStart),
        ticketEnd:   Number(f.ticketEnd),
        price:       Number(f.price),
        updatedAt:   new Date().toISOString(),
      });
      setEditingBook(null);
    }
    setBookSaving(null);
  }

  async function deleteBook(b: Book) {
    setBookDeleting(b.bookId);
    const r = await fetch(`/api/books/${b.bookId}`, { method: "DELETE" });
    if (r.ok) onBookDeleted(b.bookId);
    setBookDeleting(null);
    setDelConfirm(null);
  }

  async function saveShipment() {
    if (!shipment) return;
    setShipmentSaving(true);
    const r = await fetch(`/api/shipments/${shipment.shipmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shipmentForm),
    });
    if (r.ok) {
      onShipmentUpdated({ ...shipment, ...shipmentForm, updatedAt: new Date().toISOString() });
      setEditingShipment(false);
    }
    setShipmentSaving(false);
  }

  async function deleteShipment() {
    if (!shipment) return;
    setDelShipmentBusy(true);
    const r = await fetch(`/api/shipments/${shipment.shipmentId}`, { method: "DELETE" });
    if (r.ok) {
      onShipmentDeleted(shipment.shipmentId);
      onClose();
    }
    setDelShipmentBusy(false);
  }

  async function submitAddBook(e: React.FormEvent) {
    e.preventDefault();
    setAddBookError("");
    const { gameId, gameName, pack, ticketStart, ticketEnd, price } = addBookForm;
    if (!gameId || !gameName || !pack || !ticketStart || !ticketEnd || !price) {
      setAddBookError("All fields are required."); return;
    }
    setAddBookBusy(true);
    const res = await fetch("/api/inventory", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId, gameName, pack,
        ticketStart: Number(ticketStart),
        ticketEnd:   Number(ticketEnd),
        price:       Number(price),
        shipmentId:  shipment?.shipmentId ?? null,
      }),
    });
    if (res.ok) {
      const { book } = await res.json();
      onBookAdded(book as Book);
      setAddBookForm({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
      setAddingBook(false);
    } else {
      setAddBookError((await res.json()).error ?? "Failed to add book.");
    }
    setAddBookBusy(false);
  }

  async function uploadReceipt(book: Book, file: File) {
    setReceiptUploading(book.bookId);
    try {
      const pr = await fetch("/api/upload/presign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!pr.ok) throw new Error("Presign failed");
      const { url, key } = await pr.json() as { url: string; key: string };
      await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const patchRes = await fetch(`/api/books/${book.bookId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptKey: key }),
      });
      if (!patchRes.ok) throw new Error("Patch failed");
      onBookUpdated({ ...book, receiptKey: key });

      const viewRes = await fetch(`/api/books/${book.bookId}?receiptKey=${encodeURIComponent(key)}`);
      if (viewRes.ok) {
        const { url: vu } = await viewRes.json() as { url: string };
        setReceiptUrls((prev) => ({ ...prev, [book.bookId]: vu }));
      }
    } catch { /* ignore */ }
    setReceiptUploading(null);
  }

  async function viewReceipt(book: Book) {
    if (receiptUrls[book.bookId]) return; // already loaded
    const r = await fetch(`/api/books/${book.bookId}?receiptKey=${encodeURIComponent(book.receiptKey!)}`);
    if (r.ok) {
      const { url } = await r.json() as { url: string };
      setReceiptUrls((prev) => ({ ...prev, [book.bookId]: url }));
    }
  }

  const bookFields: { key: string; label: string; type?: string }[] = [
    { key: "gameId",      label: "Game ID" },
    { key: "gameName",    label: "Game Name" },
    { key: "pack",        label: "Pack #" },
    { key: "ticketStart", label: "Start #",   type: "number" },
    { key: "ticketEnd",   label: "End #",     type: "number" },
    { key: "price",       label: "Price ($)", type: "number" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-background border-l shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b shrink-0 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Truck className="size-4 text-primary shrink-0" />
              <p className="font-bold text-base truncate">
                {isManual
                  ? "Manual Entries"
                  : (shipment?.name || (shipment?.shipmentNum ? `Shipment ${shipment.shipmentNum}` : "Shipment"))}
              </p>
              {!isManual && shipment?.source && (
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                  shipment.source === "ai"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
                )}>
                  {shipment.source === "ai" ? "AI" : "Manual"}
                </span>
              )}
            </div>
            {shipment?.orderNumber && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Order #{shipment.orderNumber}</p>
            )}
            {shipment?.shipmentNum && shipment.name && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">#{shipment.shipmentNum}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {books.length} book{books.length !== 1 ? "s" : ""}
              {shipment?.date ? ` · ${new Date(shipment.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isManual && !editingShipment && (
              <button onClick={() => setEditingShipment(true)}
                className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors font-medium">
                <PencilSimple className="size-3.5" /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Shipment edit form */}
        {editingShipment && shipment && (
          <div className="border-b px-5 py-4 space-y-3 bg-muted/20 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Edit Shipment</p>
            {[
              { key: "name",        label: "Display Name", ph: "e.g. Holiday Restock" },
              { key: "shipmentNum", label: "Shipment #",   ph: "e.g. SH-2024-001" },
              { key: "orderNumber", label: "Order #",       ph: "e.g. 1234567" },
              { key: "date",        label: "Delivery Date", ph: "YYYY-MM-DD" },
              { key: "notes",       label: "Notes",         ph: "Optional notes" },
            ].map(({ key, label, ph }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-xs font-medium w-24 shrink-0 text-muted-foreground">{label}</label>
                <input
                  value={shipmentForm[key as keyof typeof shipmentForm]}
                  placeholder={ph}
                  onChange={(e) => setShipmentForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingShipment(false)}
                className="flex-1 border rounded-lg py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={saveShipment} disabled={shipmentSaving}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5">
                {shipmentSaving ? <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <><FloppyDisk className="size-3.5" /> Save</>}
              </button>
            </div>
          </div>
        )}

        {/* Book list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {books.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Package className="size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No books in this shipment.</p>
            </div>
          ) : (
            books.map((b) => {
              const isExpanded = expandedBook === b.bookId;
              const isEditing  = editingBook  === b.bookId;
              const form       = bookForms[b.bookId] ?? {};

              return (
                <div key={b.bookId}>
                  {/* Book row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!isExpanded) { initBookForm(b); viewReceipt(b); }
                      setExpandedBook(isExpanded ? null : b.bookId);
                      setEditingBook(null);
                    }}
                  >
                    {/* Price dot */}
                    <div className={cn(
                      "size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                      PRICE_COLOR[b.price] ?? "bg-muted text-muted-foreground"
                    )}>
                      ${b.price}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.gameName}</p>
                      <p className="text-xs text-muted-foreground font-mono">Pack {b.pack}</p>
                    </div>

                    {/* Status + receipt indicator */}
                    <div className="flex items-center gap-2 shrink-0">
                      {b.receiptKey && <Paperclip className="size-3.5 text-muted-foreground" />}
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[b.status])}>
                        {b.status}
                      </span>
                      <CaretRight className={cn("size-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    </div>
                  </div>

                  {/* Expanded book detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-muted/10 border-t space-y-4">

                      {/* Fields */}
                      <div className="grid grid-cols-2 gap-2">
                        {bookFields.map(({ key, label, type }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                            {isEditing ? (
                              <input
                                type={type ?? "text"}
                                value={form[key] ?? ""}
                                onChange={(e) => setBookForms((prev) => ({
                                  ...prev,
                                  [b.bookId]: { ...prev[b.bookId], [key]: e.target.value },
                                }))}
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            ) : (
                              <p className="text-xs font-medium py-1.5 px-2.5 bg-background rounded-lg border">
                                {(b as Record<string, unknown>)[key] as string ?? "—"}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Tickets range + slot */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          Tickets #{b.ticketStart} – #{b.ticketEnd}
                        </p>
                        {b.slot != null ? (
                          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                            Slot #{b.slot}
                            {slotNames[String(b.slot)] && (
                              <span className="text-primary/70 font-normal">— {slotNames[String(b.slot)]}</span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                            No slot assigned
                          </span>
                        )}
                      </div>

                      {/* Receipt */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receipt</p>
                        {b.receiptKey ? (
                          <div className="space-y-2">
                            {receiptUrls[b.bookId] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={receiptUrls[b.bookId]} alt="Receipt" className="w-full rounded-xl border object-contain max-h-48 bg-muted/20" />
                            ) : (
                              <div className="flex items-center gap-2 p-3 border rounded-xl bg-background text-xs text-muted-foreground">
                                <Paperclip className="size-4 shrink-0" /> Receipt attached
                                <button onClick={() => viewReceipt(b)} className="ml-auto text-primary hover:underline">Load</button>
                              </div>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              {receiptUrls[b.bookId] && (
                                <a href={receiptUrls[b.bookId]} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors">
                                  <ImageIcon className="size-3.5" /> Full size
                                </a>
                              )}
                              <label className={cn(
                                "flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors cursor-pointer",
                                receiptUploading === b.bookId ? "opacity-60" : "hover:bg-accent"
                              )}>
                                {receiptUploading === b.bookId ? <Spinner className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                                Camera
                                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!receiptUploading}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(b, f); }} />
                              </label>
                              <label className={cn(
                                "flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors cursor-pointer",
                                receiptUploading === b.bookId ? "opacity-60" : "hover:bg-accent"
                              )}>
                                {receiptUploading === b.bookId ? <Spinner className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                Gallery
                                <input type="file" accept="image/*" className="hidden" disabled={!!receiptUploading}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(b, f); }} />
                              </label>
                            </div>
                          </div>
                        ) : receiptUploading === b.bookId ? (
                          <div className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-3 text-xs font-medium opacity-60">
                            <Spinner className="size-4 animate-spin" /> Uploading…
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-3 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
                              <Camera className="size-4" /> Camera
                              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!receiptUploading}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(b, f); }} />
                            </label>
                            <label className="flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-3 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
                              <Upload className="size-4" /> Upload
                              <input ref={receiptFileRef} type="file" accept="image/*" className="hidden" disabled={!!receiptUploading}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(b, f); }} />
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => setEditingBook(null)}
                              className="flex-1 border rounded-lg py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => saveBook(b)} disabled={bookSaving === b.bookId}
                              className="flex-1 bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5">
                              {bookSaving === b.bookId ? <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <><FloppyDisk className="size-3.5" /> Save</>}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingBook(b.bookId)}
                              className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                              <PencilSimple className="size-3.5" /> Edit
                            </button>
                            {delConfirm === b.bookId ? (
                              <div className="flex-1 flex gap-1.5">
                                <button onClick={() => setDelConfirm(null)}
                                  className="flex-1 border rounded-lg py-1.5 text-xs hover:bg-accent transition-colors">Cancel</button>
                                <button onClick={() => deleteBook(b)} disabled={bookDeleting === b.bookId}
                                  className="flex-1 bg-destructive text-white rounded-lg py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1">
                                  {bookDeleting === b.bookId ? <span className="size-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <><Trash className="size-3" /> Delete</>}
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setDelConfirm(b.bookId)}
                                className="flex items-center gap-1.5 border border-destructive/30 text-destructive rounded-lg px-3 py-1.5 text-xs hover:bg-destructive/8 transition-colors">
                                <Trash className="size-3.5" /> Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Book */}
        {!isManual && (
          <div className="border-t px-5 py-3 shrink-0">
            {addingBook ? (
              <form onSubmit={submitAddBook} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Add Book</p>
                  <button type="button" onClick={() => { setAddingBook(false); setAddBookError(""); }}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "gameId",      label: "Game ID",   ph: "G-4821" },
                    { key: "gameName",    label: "Game Name", ph: "Gold Rush" },
                    { key: "pack",        label: "Pack #",    ph: "P-001" },
                    { key: "price",       label: "Price ($)", ph: "5",   type: "number" },
                    { key: "ticketStart", label: "Start #",   ph: "1",   type: "number" },
                    { key: "ticketEnd",   label: "End #",     ph: "300", type: "number" },
                  ].map(({ key, label, ph, type }) => (
                    <div key={key}>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">{label}</label>
                      <input type={type ?? "text"} placeholder={ph}
                        value={addBookForm[key as keyof typeof addBookForm]}
                        onChange={(e) => setAddBookForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  ))}
                </div>
                {addBookError && <p className="text-xs text-destructive">{addBookError}</p>}
                <button type="submit" disabled={addBookBusy}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {addBookBusy
                    ? <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    : <><Plus className="size-3.5" /> Add Book to Shipment</>}
                </button>
              </form>
            ) : (
              <button onClick={() => setAddingBook(true)}
                className="flex items-center gap-2 text-xs text-primary hover:bg-primary/8 px-3 py-2 rounded-xl transition-colors w-full font-medium">
                <Plus className="size-3.5" /> Add book to this shipment
              </button>
            )}
          </div>
        )}

        {/* Shipment delete */}
        {!isManual && (
          <div className="border-t px-5 py-3 shrink-0">
            {!delShipmentConfirm ? (
              <button onClick={() => setDelShipmentConfirm(true)}
                className="flex items-center gap-2 text-xs text-destructive hover:bg-destructive/8 px-3 py-2 rounded-xl transition-colors w-full">
                <Trash className="size-3.5" /> Delete entire shipment ({books.length} books)
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-destructive font-medium">Delete this shipment and all {books.length} books? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setDelShipmentConfirm(false)}
                    className="flex-1 border rounded-lg py-1.5 text-xs hover:bg-accent transition-colors">Cancel</button>
                  <button onClick={deleteShipment} disabled={delShipmentBusy}
                    className="flex-1 bg-destructive text-white rounded-lg py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {delShipmentBusy ? <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <><Trash className="size-3.5" /> Delete</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user } = useAuth();

  const [books,     setBooks]     = useState<Book[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "settled">("all");
  const [filterPrice,  setFilterPrice]  = useState<number | "all">("all");
  const [sortBy,       setSortBy]       = useState<"date" | "name" | "books">("date");
  const [step,      setStep]      = useState<Step>("idle");

  // Drawer
  const [openShipmentId, setOpenShipmentId] = useState<string | "manual" | null>(null);

  // Scan state
  const [scanning,    setScanning]   = useState(false);
  const [scanError,   setScanError]  = useState<string | null>(null);
  const [deliveryData, setDeliveryData] = useState<Record<string, unknown> | null>(null);
  const [orderData,    setOrderData]    = useState<Record<string, unknown> | null>(null);
  const [deliveryChecks, setDeliveryChecks] = useState<ValidationCheck[]>([]);
  const [orderChecks,    setOrderChecks]    = useState<ValidationCheck[]>([]);
  const [crossChecks,      setCrossChecks]      = useState<ValidationCheck[]>([]);
  const [crossDetailCheck, setCrossDetailCheck] = useState<ValidationCheck | null>(null);
  const [deliveryEditing,  setDeliveryEditing]  = useState(false);
  const [orderEditing,     setOrderEditing]     = useState(false);

  // Review state
  const [reviewBooks,      setReviewBooks]      = useState<ReviewBook[]>([]);
  const [selected,         setSelected]         = useState<Set<number>>(new Set());
  const [edits,            setEdits]            = useState<Record<number, Partial<ReviewBook>>>({});
  const [importing,        setImporting]        = useState(false);
  const [importDone,       setImportDone]       = useState(false);
  const [duplicatePacks,   setDuplicatePacks]   = useState<string[]>([]); // pack numbers duplicated across existing books

  // Manual entry (legacy single-book state, now used within the manual shipment flow)
  const [manualForm, setManualForm] = useState({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
  const [manualError,      setManualError]      = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Manual shipment + books flow
  const [manualShipmentForm, setManualShipmentForm] = useState({ shipmentNum: "", orderNumber: "", date: "", notes: "" });
  const [pendingBooks,       setPendingBooks]       = useState<ReviewBook[]>([]);
  const [manualBookForm,     setManualBookForm]     = useState({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
  const [manualBookError,    setManualBookError]    = useState("");
  const [manualSaving,       setManualSaving]       = useState(false);
  const [manualSaveError,    setManualSaveError]    = useState("");

  const [orgRetailerNum, setOrgRetailerNum] = useState("");
  const [orgAddress,     setOrgAddress]     = useState("");
  const [slotNames,      setSlotNames]      = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [bRes, sRes, settingsRes] = await Promise.all([
      fetch("/api/inventory"),
      fetch("/api/shipments"),
      fetch("/api/settings"),
    ]);
    if (bRes.ok) setBooks((await bRes.json()).books as Book[]);
    if (sRes.ok) setShipments((await sRes.json()).shipments as Shipment[]);
    if (settingsRes.ok) {
      const { org } = await settingsRes.json();
      setOrgRetailerNum((org.retailNum as string) ?? "");
      setOrgAddress((org.address as string) ?? "");
      setSlotNames((org.slotNames as Record<string, string>) ?? {});
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Group books by shipmentId
  const shipmentBooks: Record<string, Book[]> = {};
  const manualBooks: Book[] = [];
  books.forEach((b) => {
    if (b.shipmentId) {
      if (!shipmentBooks[b.shipmentId]) shipmentBooks[b.shipmentId] = [];
      shipmentBooks[b.shipmentId].push(b);
    } else {
      manualBooks.push(b);
    }
  });

  // Search filtering — filter shipments whose books match, or manual books that match
  const qLower = query.toLowerCase();
  const filteredShipments = query
    ? shipments.filter((s) => {
        const booksInShipment = shipmentBooks[s.shipmentId] ?? [];
        return (
          (s.orderNumber ?? "").toLowerCase().includes(qLower) ||
          (s.shipmentNum ?? "").toLowerCase().includes(qLower) ||
          booksInShipment.some((b) => [b.gameName, b.gameId, b.pack].some((v) => v.toLowerCase().includes(qLower)))
        );
      })
    : shipments;

  const filteredManual = query
    ? manualBooks.filter((b) => [b.gameName, b.gameId, b.pack].some((v) => v.toLowerCase().includes(qLower)))
    : manualBooks;

  const sortedShipments = [...filteredShipments].sort((a, b) => {
    if (sortBy === "name") return (a.shipmentNum ?? "").localeCompare(b.shipmentNum ?? "");
    if (sortBy === "books") return (shipmentBooks[b.shipmentId]?.length ?? 0) - (shipmentBooks[a.shipmentId]?.length ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // date desc
  });

  const visibleShipments = sortedShipments.filter((s) => {
    const sBooks = shipmentBooks[s.shipmentId] ?? [];
    if (filterStatus !== "all" && !sBooks.some((b) => b.status === filterStatus)) return false;
    if (filterPrice  !== "all" && !sBooks.some((b) => b.price  === filterPrice))  return false;
    return true;
  });

  const visibleManual = filterStatus !== "all"
    ? filteredManual.filter((b) => b.status === filterStatus)
    : filteredManual;
  const showManualCard = visibleManual.length > 0;

  const totalActiveBooks   = books.filter((b) => b.status === "active").length;
  const totalInactiveBooks = books.filter((b) => b.status === "inactive").length;
  const totalSettledBooks  = books.filter((b) => b.status === "settled").length;
  const totalInventoryValue = books.reduce((sum, b) => sum + (b.price * (b.ticketEnd - b.ticketStart + 1)), 0);

  const openShipment = openShipmentId && openShipmentId !== "manual"
    ? shipments.find((s) => s.shipmentId === openShipmentId) ?? null
    : null;
  const drawerBooks  = openShipmentId === "manual"
    ? manualBooks
    : (openShipmentId ? shipmentBooks[openShipmentId] ?? [] : []);

  // ── Step navigation ──────────────────────────────────────────────────────

  function closeModal() {
    setStep("idle");
    setScanning(false);
    setScanError(null);
    setDeliveryData(null);
    setOrderData(null);
    setDeliveryChecks([]);
    setOrderChecks([]);
    setCrossChecks([]);
    setCrossDetailCheck(null);
    setDeliveryEditing(false);
    setOrderEditing(false);
    setReviewBooks([]);
    setSelected(new Set());
    setEdits({});
    setImportDone(false);
    setDuplicatePacks([]);
    setManualForm({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
    setManualError("");
    setManualShipmentForm({ shipmentNum: "", orderNumber: "", date: "", notes: "" });
    setPendingBooks([]);
    setManualBookForm({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
    setManualBookError("");
    setManualSaveError("");
  }

  const PREV_STEP: Partial<Record<Step, Step>> = {
    manual:             "method",
    delivery:           "method",
    "delivery-result":  "delivery",
    order:              "delivery-result",
    "order-result":     "order",
    review:             "order-result",
  };
  function goBack() {
    const prev = PREV_STEP[step];
    if (prev === "method") { closeModal(); setStep("method"); }
    else if (prev) setStep(prev);
  }

  const STEPS = [
    { id: "delivery", label: "Delivery Receipt" },
    { id: "order",    label: "Confirm Order"    },
    { id: "validate", label: "Validate"         },
    { id: "review",   label: "Review"           },
  ];
  const stepIdx = step === "delivery" || step === "delivery-result" ? 0
    : step === "order" || step === "order-result" ? 1
    : 3;

  const STEP_IDX_TARGET: Step[] = ["delivery-result", "order-result", "order-result", "review"];
  function jumpToStep(i: number) {
    if (i >= stepIdx) return;
    setStep(STEP_IDX_TARGET[i]);
  }

  const isModalOpen = step !== "idle" && step !== "method" && step !== "manual";
  const isWide      = step === "review" || step === "order-result";

  // ── Scan helpers ──────────────────────────────────────────────────────────

  async function uploadAndScan(files: File[], endpoint: string, mergeAll = false): Promise<Record<string, unknown> | null> {
    setScanError(null);
    setScanning(true);
    try {
      if (mergeAll) {
        // Scan every page and merge — used for delivery receipts that may span multiple pages
        const results: Record<string, unknown>[] = [];
        for (const file of files) {
          const pr = await fetch("/api/upload/presign", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type }),
          });
          if (!pr.ok) continue;
          const { url, key } = await pr.json();
          await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          const sr = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          });
          if (sr.ok) {
            const { data } = await sr.json();
            results.push(data as Record<string, unknown>);
          }
        }
        if (results.length === 0) { setScanError("Could not extract data from any photo. Try clearer images."); return null; }
        return mergeDeliveryPages(results);
      }

      // Default: return first successful scan
      for (const file of files) {
        const pr = await fetch("/api/upload/presign", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        if (!pr.ok) continue;
        const { url, key } = await pr.json();
        await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        const sr = await fetch(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        if (sr.ok) {
          const { data } = await sr.json();
          return data as Record<string, unknown>;
        }
      }
      setScanError("Could not extract data from any photo. Try clearer images.");
      return null;
    } catch (err: unknown) {
      setScanError((err as Error).message ?? "Upload failed");
      return null;
    } finally { setScanning(false); }
  }

  type DeliveryGame = { gameId: string; gameDescription: string; ticketValue: number; packQuantity?: number; packValue?: number; packTotal?: number; packNumbers?: string[] };

  function mergeDeliveryPages(pages: Record<string, unknown>[]): Record<string, unknown> {
    // The main page is the first non-continuation page (has header + retailer info)
    const mainPage = pages.find(p => !p.isContinuation) ?? pages[0];
    const allGames: DeliveryGame[] = [];
    let totalPacks = 0;

    for (const page of pages) {
      const games = (page.games as DeliveryGame[]) ?? [];
      allGames.push(...games);
      // Only count totalPacksIssued from the main page footer if available; else sum games
      if (!page.isContinuation && page.totalPacksIssued) {
        totalPacks = page.totalPacksIssued as number;
      } else {
        totalPacks += games.reduce((s, g) => s + (g.packQuantity ?? g.packNumbers?.length ?? 0), 0);
      }
    }

    // If main page already had a total, use it; otherwise use summed value
    const finalTotal = (mainPage.totalPacksIssued as number) || totalPacks;

    return {
      ...mainPage,
      games: allGames,
      totalPacksIssued: finalTotal,
      pageCount: pages.length,
      continuationCount: pages.filter(p => p.isContinuation).length,
    };
  }

  function validateDelivery(data: Record<string, unknown>): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    const pageCount = (data.pageCount as number) ?? 1;
    const contCount = (data.continuationCount as number) ?? 0;
    if (pageCount > 1) {
      checks.push({
        label: `Multi-page receipt merged (${pageCount} page${pageCount !== 1 ? "s" : ""})`,
        status: "pass",
        detail: `${pageCount - contCount} main page${pageCount - contCount !== 1 ? "s" : ""} + ${contCount} continuation page${contCount !== 1 ? "s" : ""} · ${((data.games as unknown[]) ?? []).length} games total`,
      });
    }

    checks.push({
      label: 'Header contains "Instant Ticket Delivery Receipt"',
      status: (data.headerText as string ?? "").toLowerCase().includes("instant ticket delivery") ? "pass" : "fail",
      detail: (data.headerText as string) ? `Found: "${data.headerText}"` : pageCount > 1 ? "Not found on page 1 — re-scan with the first page first" : "Not found",
    });

    // Check 3: Retailer number — leading zeros ignored ("048159" == "48159") → high-priority fail if wrong
    const rn = normRetailer(data.retailerNum as string);
    const orgRn = normRetailer(orgRetailerNum);
    checks.push({
      label: `Retailer number matches (${orgRetailerNum})`,
      status: !rn ? "fail" : rn === orgRn ? "pass" : "fail",
      detail: !rn
        ? (pageCount > 1 ? "Not found — make sure page 1 is included" : "Not found")
        : rn === orgRn
        ? `Matched: ${data.retailerNum}`
        : `Receipt has: ${data.retailerNum} — expected ${orgRetailerNum}`,
    });

    // Check 2: Address — street + city must match; state and zip are optional (medium severity)
    const receiptAddr = (data.retailerAddress as string) ?? "";
    const addrOk = receiptAddr ? addressesMatch(receiptAddr, orgAddress) : false;
    checks.push({
      label: "Address verified",
      status: !receiptAddr ? "warn" : addrOk ? "pass" : "warn",
      detail: !receiptAddr
        ? "Address not found on receipt — verify manually"
        : addrOk
        ? `Matched: ${receiptAddr}`
        : `Receipt: ${receiptAddr} | Registered: ${orgAddress} — street does not match`,
    });

    // Check 1: Every game's pack quantity must equal its extracted pack list length
    type GameRow = { gameId?: string; gameDescription?: string; packQuantity?: number; packNumbers?: string[] };
    const games = (data.games as GameRow[]) ?? [];
    const packMismatches: string[] = [];
    for (const g of games) {
      const qty       = g.packQuantity ?? 0;
      const extracted = g.packNumbers?.length ?? 0;
      if (qty > 0 && extracted !== qty) {
        const lbl = g.gameId ? `Game ${g.gameId}` : `"${g.gameDescription}"`;
        packMismatches.push(`${lbl}: qty=${qty}, extracted=${extracted}`);
      }
    }
    const totalBooks = games.reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0);
    checks.push({
      label: "Pack quantities match pack lists",
      status: packMismatches.length === 0 ? "pass" : "fail",
      detail: packMismatches.length === 0
        ? `All ${games.length} game${games.length !== 1 ? "s" : ""} verified — ${totalBooks} book${totalBooks !== 1 ? "s" : ""} total`
        : packMismatches.join(" · "),
    });

    // Surface any server-detected extraction discrepancies
    const discrepancies = (data._discrepancies as string[]) ?? [];
    for (const d of discrepancies) {
      checks.push({ label: "Extraction accuracy warning", status: "fail", detail: d });
    }

    return checks;
  }

  function validateOrder(data: Record<string, unknown>): ValidationCheck[] {
    const checks: ValidationCheck[] = [];
    checks.push({
      label: 'Header contains "Confirm Order"',
      status: (data.headerText as string ?? "").toLowerCase().includes("confirm") ? "pass" : "fail",
      detail: `Found: "${data.headerText}"`,
    });
    const rn = normRetailer(data.retailerNum as string);
    const orgRn = normRetailer(orgRetailerNum);
    checks.push({
      label: `Retailer number matches (${orgRetailerNum})`,
      status: !rn ? "fail" : rn === orgRn ? "pass" : "fail",
      detail: !rn ? "Not found" : rn === orgRn ? `Matched: ${data.retailerNum}` : `Receipt has: ${data.retailerNum} — expected ${orgRetailerNum}`,
    });
    checks.push({
      label: "Order number present",
      status: data.orderNumber ? "pass" : "fail",
      detail: data.orderNumber ? `Order #: ${data.orderNumber}` : "Not found",
    });

    const discrepancies = (data._discrepancies as string[]) ?? [];
    for (const d of discrepancies) {
      checks.push({ label: "Extraction accuracy warning", status: "fail", detail: d });
    }

    return checks;
  }

  function crossValidate(dd: Record<string, unknown>, od: Record<string, unknown>): ValidationCheck[] {
    const normStr = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];
    const dr = normRetailer(dd.retailerNum as string);
    const or2 = normRetailer(od.retailerNum as string);
    checks.push({
      label: "Retailer numbers match between both receipts",
      status: dr && or2 && dr === or2 ? "pass" : "fail",
      detail: dr === or2 ? `Both: ${dd.retailerNum}` : `Delivery: ${dd.retailerNum} vs Order: ${od.retailerNum}`,
    });
    const dd_ = (dd.date as string ?? "").slice(0, 10);
    const od_ = (od.date as string ?? "").slice(0, 10);
    checks.push({
      label: "Receipt dates match",
      status: dd_ && od_ && dd_ === od_ ? "pass" : "warn",
      detail: dd_ === od_ ? `Both: ${dd_}` : `Delivery: ${dd_ || "unknown"} | Order: ${od_ || "unknown"}`,
    });
    // Delivery Shipment # must match Confirm Order's Order #
    const dShip = normStr(dd.shipmentId as string); const oOrd = normStr(od.orderNumber as string);
    checks.push({
      label: "Shipment # matches Order #",
      status: !dShip || !oOrd ? "warn" : dShip === oOrd ? "pass" : "fail",
      detail: dShip === oOrd
        ? `Matched: ${dd.shipmentId}`
        : !dShip || !oOrd
        ? "One or both missing"
        : `Delivery: ${dd.shipmentId} vs Order: ${od.orderNumber}`,
    });
    const dc = (dd.games as { packNumbers?: string[] }[] ?? []).reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0);
    const oc = (od.books as unknown[] ?? []).length;
    checks.push({
      label: "Book counts match",
      status: dc > 0 && oc > 0 && dc === oc ? "pass" : "warn",
      detail: dc === oc ? `Both: ${dc} books` : `Delivery: ${dc} | Order: ${oc}`,
    });
    return checks;
  }

  function updateDeliveryGame(idx: number, field: string, value: unknown) {
    setDeliveryData(prev => {
      if (!prev) return prev;
      const games = [...((prev.games as Record<string, unknown>[]) ?? [])];
      games[idx] = { ...games[idx], [field]: value };
      return { ...prev, games };
    });
  }

  function updateDeliveryField(field: string, value: string) {
    setDeliveryData(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function applyDeliveryEdits() {
    if (deliveryData) {
      setDeliveryChecks(validateDelivery(deliveryData));
      if (orderData) setCrossChecks(crossValidate(deliveryData, orderData));
    }
    setDeliveryEditing(false);
  }

  function updateOrderBook(idx: number, field: string, value: unknown) {
    setOrderData(prev => {
      if (!prev) return prev;
      const books = [...((prev.books as Record<string, unknown>[]) ?? [])];
      books[idx] = { ...books[idx], [field]: value };
      return { ...prev, books };
    });
  }

  function updateOrderField(field: string, value: string) {
    setOrderData(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function applyOrderEdits() {
    if (orderData) {
      setOrderChecks(validateOrder(orderData));
      if (deliveryData) setCrossChecks(crossValidate(deliveryData, orderData));
    }
    setOrderEditing(false);
  }

  function buildReviewBooks(dd: Record<string, unknown>): ReviewBook[] {
    const games = dd.games as { gameId: string; gameDescription: string; ticketValue: number; packValue?: number; packNumbers?: string[] }[] ?? [];
    const out: ReviewBook[] = [];
    games.forEach((g) => {
      // ticketEnd = (packValue / ticketValue) - 1, e.g. $300 book / $1 ticket = 300 tickets → 0..299
      const ticketCount = g.packValue && g.ticketValue ? Math.round(g.packValue / g.ticketValue) : 300;
      const ticketEnd   = ticketCount - 1;
      (g.packNumbers ?? []).forEach((pack) => {
        out.push({ gameId: g.gameId ?? "", gameName: g.gameDescription ?? "", pack, ticketStart: 0, ticketEnd, price: g.ticketValue ?? 0 });
      });
    });
    return out;
  }

  async function handleDeliveryScan(files: File[]) {
    const data = await uploadAndScan(files, "/api/receipt/scan-delivery", true);
    if (!data) return;
    setDeliveryData(data);
    setDeliveryChecks(validateDelivery(data));
    setStep("delivery-result");
  }

  async function handleOrderScan(files: File[]) {
    if (!deliveryData) return;
    const data = await uploadAndScan(files, "/api/receipt/scan-order");
    if (!data) return;
    setOrderData(data);
    setOrderChecks(validateOrder(data));
    setCrossChecks(crossValidate(deliveryData, data));
    setStep("order-result");
  }

  function proceedToReview() {
    if (!deliveryData) return;
    const rb = buildReviewBooks(deliveryData);
    setReviewBooks(rb);
    setSelected(new Set(rb.map((_, i) => i)));
    setEdits({});
    setImportDone(false);

    // Check new packs against every pack already in the database
    const existingPacks = new Set(books.map((b) => `${b.gameId}|${b.pack}`));
    const dupes: string[] = [];
    for (const b of rb) {
      const key = `${b.gameId}|${b.pack}`;
      if (existingPacks.has(key)) dupes.push(`${b.gameName} · Pack ${b.pack}`);
    }
    setDuplicatePacks(dupes);

    setStep("review");
  }

  function bookVal(i: number, k: keyof ReviewBook) {
    return edits[i]?.[k] ?? reviewBooks[i]?.[k] ?? "";
  }
  function editReviewBook(i: number, k: keyof ReviewBook, v: string | number) {
    setEdits((prev) => ({ ...prev, [i]: { ...prev[i], [k]: v } }));
  }

  async function importSelected() {
    setImporting(true);

    // 1. Create shipment record
    const shipRes = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: deliveryData?.orderNumber as string ?? undefined,
        shipmentNum: deliveryData?.shipmentId  as string ?? undefined,
        date:        deliveryData?.date        as string ?? undefined,
        retailerNum: deliveryData?.retailerNum as string ?? undefined,
        totalBooks:  [...selected].length,
        source:      "ai",
      }),
    });
    const shipmentId: string | null = shipRes.ok ? (await shipRes.json()).shipment?.shipmentId ?? null : null;
    if (shipmentId) {
      setShipments((prev) => [...prev, { shipmentId, totalBooks: [...selected].length, createdAt: new Date().toISOString(), orderNumber: deliveryData?.orderNumber as string | undefined }]);
    }

    // 2. Import books linked to shipment
    const toImport = reviewBooks.map((b, i) => ({ ...b, ...edits[i] })).filter((_, i) => selected.has(i));
    await Promise.allSettled(
      toImport.map((b) =>
        fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...b, shipmentId }),
        }).then(async (r) => {
          if (r.ok) {
            const { book } = await r.json();
            setBooks((prev) => [book as Book, ...prev]);
          }
        })
      )
    );

    // 3. Store receipt records
    if (deliveryData && orderData) {
      await fetch("/api/receipts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryData, orderData }),
      });
    }

    setImporting(false);
    setImportDone(true);
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    setManualSubmitting(true);
    const res = await fetch("/api/inventory", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...manualForm,
        ticketStart: Number(manualForm.ticketStart),
        ticketEnd:   Number(manualForm.ticketEnd),
        price:       Number(manualForm.price),
        shipmentId:  null,
      }),
    });
    if (res.ok) { const { book } = await res.json(); setBooks((prev) => [book as Book, ...prev]); closeModal(); }
    else setManualError((await res.json()).error ?? "Failed to add book.");
    setManualSubmitting(false);
  }

  function addManualBook(e: React.FormEvent) {
    e.preventDefault();
    setManualBookError("");
    const { gameId, gameName, pack, ticketStart, ticketEnd, price } = manualBookForm;
    if (!gameId || !gameName || !pack || !ticketStart || !ticketEnd || !price) {
      setManualBookError("All fields required."); return;
    }
    setPendingBooks((prev) => [...prev, {
      gameId, gameName, pack,
      ticketStart: Number(ticketStart),
      ticketEnd:   Number(ticketEnd),
      price:       Number(price),
    }]);
    setManualBookForm({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
  }

  async function saveManualShipment() {
    if (pendingBooks.length === 0) { setManualSaveError("Add at least one book."); return; }
    setManualSaving(true);
    setManualSaveError("");
    const sRes = await fetch("/api/shipments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipmentNum:  manualShipmentForm.shipmentNum  || undefined,
        orderNumber:  manualShipmentForm.orderNumber  || undefined,
        date:         manualShipmentForm.date         || undefined,
        notes:        manualShipmentForm.notes        || undefined,
        totalBooks:   pendingBooks.length,
        source:       "manual",
      }),
    });
    if (!sRes.ok) { setManualSaveError("Failed to create shipment."); setManualSaving(false); return; }
    const { shipment: newShipment } = await sRes.json() as { shipment: Shipment };
    const created: Book[] = [];
    for (const b of pendingBooks) {
      const bRes = await fetch("/api/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...b, shipmentId: newShipment.shipmentId }),
      });
      if (bRes.ok) { const { book } = await bRes.json(); created.push(book as Book); }
    }
    setShipments((prev) => [newShipment, ...prev]);
    setBooks((prev) => [...created, ...prev]);
    setManualSaving(false);
    closeModal();
  }

  const failCount = crossChecks.filter((c) => c.status === "fail").length;
  const warnCount = crossChecks.filter((c) => c.status === "warn").length;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Drawer */}
      {openShipmentId && (
        <ShipmentDrawer
          shipment={openShipmentId === "manual" ? null : openShipment}
          books={drawerBooks}
          isManual={openShipmentId === "manual"}
          slotNames={slotNames}
          onClose={() => setOpenShipmentId(null)}
          onBookUpdated={(b) => setBooks((prev) => prev.map((x) => x.bookId === b.bookId ? b : x))}
          onBookDeleted={(id) => setBooks((prev) => prev.filter((x) => x.bookId !== id))}
          onBookAdded={(b) => setBooks((prev) => [b, ...prev])}
          onShipmentDeleted={(sid) => {
            setShipments((prev) => prev.filter((s) => s.shipmentId !== sid));
            setBooks((prev) => prev.filter((b) => b.shipmentId !== sid));
          }}
          onShipmentUpdated={(s) => setShipments((prev) => prev.map((x) => x.shipmentId === s.shipmentId ? s : x))}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {shipments.length} shipment{shipments.length !== 1 ? "s" : ""} · {books.length} books · {user?.orgName}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setStep("method")}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity font-semibold shadow-sm">
            <Plus className="size-4" /> Add Books
          </button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Summary stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active",   value: totalActiveBooks,   color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-200/60" },
            { label: "Inactive", value: totalInactiveBooks, color: "text-foreground",  bg: "bg-muted/60 border-border" },
            { label: "Settled",  value: totalSettledBooks,  color: "text-blue-600",    bg: "bg-blue-500/10 border-blue-200/60" },
            { label: "Est. Value", value: `$${totalInventoryValue >= 1000 ? `${(totalInventoryValue / 1000).toFixed(0)}k` : totalInventoryValue.toLocaleString()}`, color: "text-violet-600", bg: "bg-violet-500/10 border-violet-200/60" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={cn("border rounded-xl px-4 py-3 flex items-center justify-between", bg)}>
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <span className={cn("text-lg font-black", color)}>{loading ? "—" : value}</span>
            </div>
          ))}
        </div>

        {/* Search + filters row */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shipment #, order #, or game name…"
              className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-0.5 border rounded-xl overflow-hidden bg-muted/40 p-0.5 shrink-0">
            {(["all", "active", "inactive", "settled"] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize whitespace-nowrap",
                  filterStatus === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "name" | "books")}
            className="border rounded-xl px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0 font-medium text-muted-foreground">
            <option value="date">Sort: Newest</option>
            <option value="books">Sort: Most Books</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {/* Price tier filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Price:</span>
          {(["all", 1, 2, 5, 10, 20, 30, 50] as const).map((p) => (
            <button key={p} onClick={() => setFilterPrice(p)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-full border transition-all",
                filterPrice === p
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              )}>
              {p === "all" ? "All" : `$${p}`}
            </button>
          ))}
        </div>
      </div>

      {/* Shipment grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 border rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : visibleShipments.length === 0 && !showManualCard ? (
        <div className="text-center py-16 space-y-3 border border-dashed rounded-2xl">
          <Truck className="size-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {query || filterStatus !== "all" || filterPrice !== "all"
              ? "No shipments match your filters."
              : "No shipments yet. Click Add Books to get started."}
          </p>
          {(query || filterStatus !== "all" || filterPrice !== "all") && (
            <button
              onClick={() => { setQuery(""); setFilterStatus("all"); setFilterPrice("all"); }}
              className="text-xs text-primary hover:underline font-medium">
              Clear all filters
            </button>
          )}
          {!query && filterStatus === "all" && filterPrice === "all" && (
            <button onClick={() => setStep("method")} className="text-xs text-primary hover:underline font-medium">
              + Add your first shipment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {visibleShipments.map((s) => (
            <ShipmentCard
              key={s.shipmentId}
              shipment={s}
              books={shipmentBooks[s.shipmentId] ?? []}
              onClick={() => setOpenShipmentId(s.shipmentId)}
            />
          ))}
          {showManualCard && (
            <ShipmentCard
              shipment={null}
              books={visibleManual}
              onClick={() => setOpenShipmentId("manual")}
            />
          )}
        </div>
      )}

      {/* ── Method chooser ── */}
      {step === "method" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Add to Inventory</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All books must belong to a shipment.</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setStep("delivery"); setScanError(null); }}
                className="w-full flex items-start gap-4 border-2 rounded-2xl p-4 hover:border-primary hover:bg-primary/5 transition-all text-left group">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Truck className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">AI — Scan Receipt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload delivery + order receipts. AI reads every book automatically and creates the shipment.</p>
                </div>
              </button>

              <button onClick={() => { setStep("manual"); setManualSaveError(""); }}
                className="w-full flex items-start gap-4 border-2 rounded-2xl p-4 hover:border-primary hover:bg-primary/5 transition-all text-left group">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <PencilSimple className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Manual Entry</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter shipment details yourself and add books one by one. Every book is linked to the shipment you create.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual shipment + books flow ── */}
      {step === "manual" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <button onClick={() => { closeModal(); setStep("method"); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ArrowLeft className="size-4" />
                </button>
                <div>
                  <h2 className="font-bold text-base">Manual Shipment</h2>
                  <p className="text-xs text-muted-foreground">Create a shipment and add books to it</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Shipment details */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Shipment Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "shipmentNum",  label: "Shipment #", ph: "SH-1001" },
                    { key: "orderNumber",  label: "Order #",    ph: "ORD-5432" },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                      <input type="text" placeholder={ph}
                        value={manualShipmentForm[key as keyof typeof manualShipmentForm]}
                        onChange={(e) => setManualShipmentForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                  <input type="date"
                    value={manualShipmentForm.date}
                    onChange={(e) => setManualShipmentForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                  <input type="text" placeholder="e.g. Holiday restock"
                    value={manualShipmentForm.notes}
                    onChange={(e) => setManualShipmentForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              {/* Add book form */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Add Books</p>
                <form onSubmit={addManualBook} className="space-y-2 border rounded-2xl p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "gameId",      label: "Game ID",   ph: "G-4821" },
                      { key: "gameName",    label: "Game Name", ph: "Gold Rush" },
                      { key: "pack",        label: "Pack #",    ph: "P-001" },
                      { key: "price",       label: "Price ($)", ph: "5",   type: "number" },
                      { key: "ticketStart", label: "Start #",   ph: "1",   type: "number" },
                      { key: "ticketEnd",   label: "End #",     ph: "300", type: "number" },
                    ].map(({ key, label, ph, type }) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                        <input type={type ?? "text"} placeholder={ph}
                          value={manualBookForm[key as keyof typeof manualBookForm]}
                          onChange={(e) => setManualBookForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                    ))}
                  </div>
                  {manualBookError && <p className="text-xs text-destructive">{manualBookError}</p>}
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs font-medium hover:bg-muted transition-colors">
                    <Plus className="size-3.5" /> Add Book to List
                  </button>
                </form>
              </div>

              {/* Book list */}
              {pendingBooks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Books to Import ({pendingBooks.length})
                  </p>
                  <div className="space-y-1.5">
                    {pendingBooks.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 border rounded-xl px-3 py-2 bg-background text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{b.gameName}</p>
                          <p className="text-muted-foreground font-mono">
                            {b.gameId} · Pack {b.pack} · ${b.price} · #{b.ticketStart}–{b.ticketEnd}
                          </p>
                        </div>
                        <button type="button" onClick={() => setPendingBooks((prev) => prev.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-4 shrink-0 space-y-2">
              {manualSaveError && <p className="text-xs text-destructive">{manualSaveError}</p>}
              <button
                disabled={manualSaving || pendingBooks.length === 0}
                onClick={saveManualShipment}
                className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {manualSaving
                  ? <><span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> Saving…</>
                  : <><Package className="size-4" /> Save Shipment &amp; {pendingBooks.length} Book{pendingBooks.length !== 1 ? "s" : ""}</>}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {pendingBooks.length === 0 ? "Add at least one book above" : `Creates 1 shipment + ${pendingBooks.length} book${pendingBooks.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Cross-validation detail popup ── */}
      {crossDetailCheck && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setCrossDetailCheck(null)}
        >
          <div
            className="bg-background border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {crossDetailCheck.status === "fail" && <XCircle    weight="fill" className="size-5 text-red-500 shrink-0" />}
                {crossDetailCheck.status === "warn" && <Warning    weight="fill" className="size-5 text-amber-500 shrink-0" />}
                {crossDetailCheck.status === "pass" && <CheckCircle weight="fill" className="size-5 text-emerald-500 shrink-0" />}
                <p className="font-semibold text-sm leading-snug">{crossDetailCheck.label}</p>
              </div>
              <button
                onClick={() => setCrossDetailCheck(null)}
                className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Value cards */}
            {(() => {
              const parsed = parseDetailValues(crossDetailCheck.detail ?? "");
              if (parsed) {
                const isMismatch = parsed.delivery !== parsed.order;
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { side: "Delivery Receipt", Icon: Truck,    value: parsed.delivery },
                      { side: "Confirm Order",    Icon: FileText, value: parsed.order    },
                    ].map(({ side, Icon, value }) => (
                      <div key={side} className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Icon className="size-3" /> {side}
                        </p>
                        <div className={cn(
                          "rounded-xl px-3 py-2.5 text-sm font-mono font-medium border break-all",
                          isMismatch && crossDetailCheck.status === "fail"
                            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400"
                            : isMismatch && crossDetailCheck.status === "warn"
                            ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400",
                        )}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className={cn(
                  "rounded-xl px-4 py-3 text-sm border",
                  crossDetailCheck.status === "fail" && "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400",
                  crossDetailCheck.status === "warn" && "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400",
                  crossDetailCheck.status === "pass" && "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400",
                )}>
                  {crossDetailCheck.detail ?? "No detail available."}
                </div>
              );
            })()}

            {/* Footer hint */}
            <p className="text-xs text-muted-foreground">
              {crossDetailCheck.status === "fail"
                ? "This value must match between both receipts before importing."
                : crossDetailCheck.status === "warn"
                ? "Review this value carefully before proceeding."
                : "Values are consistent across both receipts."}
            </p>
          </div>
        </div>
      )}

      {/* ── Multi-step receipt modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className={cn(
            "bg-background border rounded-3xl w-full shadow-2xl flex flex-col overflow-hidden",
            isWide ? "max-w-4xl max-h-[92vh]" : "max-w-lg max-h-[90vh]"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                {!importDone && PREV_STEP[step] && (
                  <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" aria-label="Go back">
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                <h2 className="font-bold text-base">New Shipment via Receipt</h2>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            {/* Progress */}
            {!importDone && (
              <div className="flex items-center px-5 py-3 border-b bg-muted/20 gap-1 shrink-0 overflow-x-auto">
                {STEPS.map((s, i) => {
                  const isCompleted = i < stepIdx;
                  const isCurrent   = i === stepIdx;
                  return (
                    <div key={s.id} className="flex items-center gap-1 shrink-0">
                      <button onClick={() => jumpToStep(i)} disabled={!isCompleted}
                        className={cn("flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors",
                          isCompleted && "hover:bg-muted cursor-pointer", !isCompleted && "cursor-default")}>
                        <div className={cn(
                          "flex items-center justify-center size-6 rounded-full text-xs font-bold transition-colors",
                          isCompleted ? "bg-emerald-500 text-white"
                          : isCurrent  ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                        )}>
                          {isCompleted ? <CheckCircle className="size-4" /> : i + 1}
                        </div>
                        <span className={cn("text-xs font-medium whitespace-nowrap",
                          isCompleted ? "text-emerald-700 dark:text-emerald-400"
                          : isCurrent  ? "text-foreground" : "text-muted-foreground")}>
                          {s.label}
                        </span>
                      </button>
                      {i < STEPS.length - 1 && (
                        <div className={cn("w-4 h-px mx-1 transition-colors", isCompleted ? "bg-emerald-400" : "bg-border")} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">

              {/* Delivery upload */}
              {step === "delivery" && (
                <div className="p-5 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40 rounded-2xl p-4 text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold">Step 1: Instant Ticket Delivery Receipt</p>
                    <p className="text-xs mt-1 text-blue-700 dark:text-blue-400">The physical receipt from the Ohio Lottery shipment. If the receipt spans multiple pages, upload all pages together — the system will automatically detect and merge continuation pages.</p>
                  </div>
                  <UploadZone scanning={scanning} onFiles={handleDeliveryScan} error={scanError} onRetry={() => setScanError(null)} />
                </div>
              )}

              {/* Delivery result */}
              {step === "delivery-result" && deliveryData && (() => {
                type DeliveryGame = { gameId: string; gameDescription: string; ticketValue: number; packQuantity?: number; packValue?: number; packTotal?: number; packNumbers?: string[] };
                const dGames = (deliveryData.games as DeliveryGame[]) ?? [];
                const inputCls = "w-full bg-background border rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary";
                return (
                  <div className="p-5 space-y-4">
                    <p className="text-sm font-semibold">Delivery Receipt — Validation</p>
                    <div className="space-y-2">
                      {deliveryChecks.map((c, i) => <ValidationBadge key={i} check={c} />)}
                    </div>

                    {/* Extracted game table */}
                    {dGames.length > 0 && (
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Extracted Game Table</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{dGames.length} game{dGames.length !== 1 ? "s" : ""} · {dGames.reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0)} books</span>
                            {deliveryEditing ? (
                              <button onClick={applyDeliveryEdits}
                                className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
                                Save
                              </button>
                            ) : (
                              <button onClick={() => setDeliveryEditing(true)}
                                className="text-xs px-2.5 py-1 border rounded-lg hover:bg-accent transition-colors font-medium">
                                Edit
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Header field editor */}
                        {deliveryEditing && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b grid grid-cols-2 gap-2">
                            {[
                              { label: "Retailer #", field: "retailerNum" },
                              { label: "Shipment #", field: "shipmentId" },
                              { label: "Order #",    field: "orderNumber" },
                              { label: "Date",       field: "date" },
                            ].map(({ label, field }) => (
                              <label key={field} className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                                <input
                                  className={inputCls}
                                  value={(deliveryData[field] as string) ?? ""}
                                  onChange={e => updateDeliveryField(field, e.target.value)}
                                />
                              </label>
                            ))}
                            <label className="col-span-2 flex flex-col gap-0.5">
                              <span className="text-[10px] text-muted-foreground font-medium">Address</span>
                              <input
                                className={inputCls}
                                value={(deliveryData.retailerAddress as string) ?? ""}
                                onChange={e => updateDeliveryField("retailerAddress", e.target.value)}
                              />
                            </label>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/20 border-b">
                              <tr>
                                {["Game ID", "Name", "Ticket $", "Qty", "Pack Value", "Pack Total", "Pack Numbers (space-separated)"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {dGames.map((g, i) => {
                                const packQtyMismatch   = (g.packQuantity ?? 0) > 0 && (g.packNumbers?.length ?? 0) !== (g.packQuantity ?? 0);
                                const calcTotal         = (g.packValue ?? 0) * (g.packQuantity ?? 0);
                                const packTotalMismatch = g.packValue != null && g.packQuantity != null && g.packTotal != null
                                  && Math.abs(calcTotal - g.packTotal) > 0.50;
                                const rowErr = packQtyMismatch || packTotalMismatch;
                                return (
                                <tr key={i} className={cn("transition-colors",
                                  rowErr ? "bg-red-50 dark:bg-red-950/20"
                                  : deliveryEditing ? "bg-amber-50/40 dark:bg-amber-950/10"
                                  : "hover:bg-muted/10")}>
                                  <td className="px-3 py-2">
                                    {deliveryEditing
                                      ? <input className={inputCls} value={g.gameId ?? ""} onChange={e => updateDeliveryGame(i, "gameId", e.target.value)} />
                                      : <span className="font-mono font-medium whitespace-nowrap">{g.gameId}</span>}
                                  </td>
                                  <td className="px-3 py-2 max-w-[160px]">
                                    {deliveryEditing
                                      ? <input className={inputCls} value={g.gameDescription ?? ""} onChange={e => updateDeliveryGame(i, "gameDescription", e.target.value)} />
                                      : <span className="truncate block" title={g.gameDescription}>{g.gameDescription}</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {deliveryEditing
                                      ? <input className={inputCls} type="number" min={0} value={g.ticketValue ?? ""} onChange={e => updateDeliveryGame(i, "ticketValue", Number(e.target.value))} />
                                      : <span className="font-medium">${g.ticketValue}</span>}
                                  </td>
                                  {/* Qty */}
                                  <td className="px-3 py-2">
                                    {deliveryEditing
                                      ? <input className={cn(inputCls, "w-16", packQtyMismatch && "border-red-400 focus:ring-red-400")} type="number" min={0}
                                          value={g.packQuantity ?? ""}
                                          onChange={e => updateDeliveryGame(i, "packQuantity", Number(e.target.value))} />
                                      : <span className={cn("flex items-center gap-1", packQtyMismatch && "text-red-600 font-semibold")}>
                                          {packQtyMismatch && <span title={`Pack list has ${g.packNumbers?.length ?? 0} entries but Qty says ${g.packQuantity}`}><Warning weight="fill" className="size-3.5 shrink-0" /></span>}
                                          {g.packQuantity ?? (g.packNumbers?.length ?? "—")}
                                          {packQtyMismatch && <span className="text-muted-foreground font-normal text-[10px]">(list:{g.packNumbers?.length ?? 0})</span>}
                                        </span>}
                                  </td>
                                  {/* Pack Value */}
                                  <td className="px-3 py-2">
                                    {deliveryEditing
                                      ? <input className={cn(inputCls, "w-20", packTotalMismatch && "border-red-400 focus:ring-red-400")} type="number" min={0}
                                          value={g.packValue ?? ""}
                                          onChange={e => updateDeliveryGame(i, "packValue", Number(e.target.value))} />
                                      : <span className={cn("flex items-center gap-1", packTotalMismatch && "text-red-600 font-semibold")}>
                                          {packTotalMismatch && <span title={`$${g.packValue}×${g.packQuantity}=$${calcTotal.toFixed(0)} but receipt Total=$${g.packTotal}`}><Warning weight="fill" className="size-3.5 shrink-0" /></span>}
                                          {g.packValue != null ? `$${g.packValue.toLocaleString()}` : "—"}
                                        </span>}
                                  </td>
                                  {/* Pack Total (from receipt) */}
                                  <td className="px-3 py-2">
                                    {deliveryEditing
                                      ? <input className={cn(inputCls, "w-20")} type="number" min={0}
                                          value={g.packTotal ?? ""}
                                          onChange={e => updateDeliveryGame(i, "packTotal", Number(e.target.value))} />
                                      : <span className={cn(packTotalMismatch && "text-red-600 font-semibold")}>
                                          {g.packTotal != null ? `$${g.packTotal.toLocaleString()}` : "—"}
                                          {packTotalMismatch && <span className="block text-[10px] text-red-500 font-normal">calc: ${calcTotal.toFixed(0)}</span>}
                                        </span>}
                                  </td>
                                  {/* Pack Numbers */}
                                  <td className="px-3 py-2 min-w-[220px]">
                                    {deliveryEditing
                                      ? <input
                                          className={cn(inputCls, packQtyMismatch && "border-red-400 focus:ring-red-400")}
                                          value={(g.packNumbers ?? []).join(" ")}
                                          onChange={e => updateDeliveryGame(i, "packNumbers", e.target.value.trim().split(/\s+/).filter(Boolean))}
                                        />
                                      : <span className="font-mono text-muted-foreground">
                                          {(g.packNumbers ?? []).slice(0, 3).join(", ")}
                                          {(g.packNumbers?.length ?? 0) > 3 && ` +${(g.packNumbers!.length - 3)} more`}
                                        </span>}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => { setScanError(null); goBack(); }}
                        className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2">
                        <ArrowLeft className="size-4" /> Re-scan
                      </button>
                      <button onClick={() => { setScanError(null); setStep("order"); }}
                        className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        Next <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Order upload */}
              {step === "order" && (
                <div className="p-5 space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40 rounded-2xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
                    <p className="font-semibold">Step 2: Confirm Order Receipt</p>
                    <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-400">The terminal receipt confirming the book order — printed by the in-store lottery terminal.</p>
                  </div>
                  <UploadZone scanning={scanning} onFiles={handleOrderScan} error={scanError} onRetry={() => setScanError(null)} />
                </div>
              )}

              {/* Order result + cross-validate */}
              {step === "order-result" && orderData && deliveryData && (() => {
                type DeliveryGame = { gameId: string; gameDescription: string; ticketValue: number; packQuantity?: number; packValue?: number; packTotal?: number; packNumbers?: string[] };
                type OrderBook   = { gameId: string; gameName: string; bookNumber?: string; ticketValue: number; bookValue?: number; status?: string };
                const dGames = (deliveryData.games as DeliveryGame[]) ?? [];
                const oBooks = (orderData.books as OrderBook[]) ?? [];
                const inputCls = "w-full bg-background border rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary";
                return (
                  <div className="p-5 space-y-5">

                    {/* Side-by-side tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                      {/* Delivery receipt table (read-only summary; edit on previous step) */}
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Delivery Receipt</p>
                          <span className="text-xs text-muted-foreground">{dGames.reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0)} books</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/20 border-b">
                              <tr>
                                {["Game ID", "Name", "$", "Packs", "Pack Value", "Pack #s"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {dGames.length === 0 ? (
                                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No games extracted</td></tr>
                              ) : dGames.map((g, i) => {
                                const packQtyMismatch   = (g.packQuantity ?? 0) > 0 && (g.packNumbers?.length ?? 0) !== (g.packQuantity ?? 0);
                                const calcTotal         = (g.packValue ?? 0) * (g.packQuantity ?? 0);
                                const packTotalMismatch = g.packValue != null && g.packQuantity != null && g.packTotal != null
                                  && Math.abs(calcTotal - g.packTotal) > 0.50;
                                const rowErr = packQtyMismatch || packTotalMismatch;
                                return (
                                <tr key={i} className={cn("transition-colors", rowErr ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/10")}>
                                  <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{(g.gameId ?? "").split("-")[0] || g.gameId}</td>
                                  <td className="px-3 py-2 max-w-[120px] truncate" title={g.gameDescription}>{g.gameDescription}</td>
                                  <td className="px-3 py-2 font-medium">${g.ticketValue}</td>
                                  {/* Packs / Qty */}
                                  <td className="px-3 py-2">
                                    <span className={cn("flex items-center gap-1", packQtyMismatch && "text-red-600 font-semibold")}>
                                      {packQtyMismatch && <span title={`Pack list has ${g.packNumbers?.length ?? 0} entries but Qty says ${g.packQuantity}`}><Warning weight="fill" className="size-3.5 shrink-0" /></span>}
                                      {g.packQuantity ?? (g.packNumbers?.length ?? "—")}
                                      {packQtyMismatch && <span className="text-muted-foreground font-normal text-[10px]">(list:{g.packNumbers?.length ?? 0})</span>}
                                    </span>
                                  </td>
                                  {/* Pack Value */}
                                  <td className="px-3 py-2">
                                    <span className={cn("flex flex-col", packTotalMismatch && "text-red-600 font-semibold")}>
                                      <span className="flex items-center gap-1">
                                        {packTotalMismatch && <span title={`$${g.packValue}×${g.packQuantity}=$${calcTotal.toFixed(0)} but receipt Total=$${g.packTotal}`}><Warning weight="fill" className="size-3.5 shrink-0" /></span>}
                                        {g.packValue != null ? `$${g.packValue.toLocaleString()}` : "—"}
                                      </span>
                                      {packTotalMismatch && <span className="text-[10px] font-normal text-red-500">Total: ${g.packTotal?.toLocaleString()} (calc: ${calcTotal.toFixed(0)})</span>}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-muted-foreground">
                                    {(g.packNumbers ?? []).slice(0, 2).join(", ")}
                                    {(g.packNumbers?.length ?? 0) > 2 && ` +${g.packNumbers!.length - 2}`}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Confirm order table */}
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b flex items-center justify-between">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Confirm Order</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {oBooks.filter(b => b.status === "C").length} confirmed · {oBooks.length} total
                            </span>
                            {orderEditing ? (
                              <button onClick={applyOrderEdits}
                                className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
                                Save
                              </button>
                            ) : (
                              <button onClick={() => setOrderEditing(true)}
                                className="text-xs px-2.5 py-1 border rounded-lg hover:bg-accent transition-colors font-medium">
                                Edit
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Order header field editor */}
                        {orderEditing && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b grid grid-cols-2 gap-2">
                            {[
                              { label: "Retailer #",   field: "retailerNum" },
                              { label: "Order #",      field: "orderNumber" },
                              { label: "Date",         field: "date" },
                              { label: "Terminal",     field: "terminalNum" },
                            ].map(({ label, field }) => (
                              <label key={field} className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                                <input
                                  className={inputCls}
                                  value={(orderData[field] as string) ?? ""}
                                  onChange={e => updateOrderField(field, e.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/20 border-b">
                              <tr>
                                {["Game ID", "Book #", "$", "Book Value", "Status"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {oBooks.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No books extracted</td></tr>
                              ) : oBooks.map((b, i) => {
                                const resolvedBookNum = b.bookNumber ?? b.gameId?.split("-")[1];
                                const rowWarn = !resolvedBookNum;
                                return (
                                <tr key={i} className={cn("transition-colors",
                                  rowWarn ? "bg-amber-50 dark:bg-amber-950/20"
                                  : orderEditing ? "bg-amber-50/40 dark:bg-amber-950/10"
                                  : "hover:bg-muted/10")}>
                                  <td className="px-3 py-2">
                                    {orderEditing
                                      ? <input className={inputCls} value={(b.gameId ?? "").split("-")[0] || b.gameId} onChange={e => updateOrderBook(i, "gameId", e.target.value)} />
                                      : <span className="font-mono font-medium whitespace-nowrap">{(b.gameId ?? "").split("-")[0] || b.gameId}</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {orderEditing
                                      ? <input className={cn(inputCls, rowWarn && "border-amber-400 focus:ring-amber-400")} value={resolvedBookNum ?? ""} onChange={e => updateOrderBook(i, "bookNumber", e.target.value)} />
                                      : <span className="flex items-center gap-1 font-mono">
                                          {rowWarn && <span title="Book number could not be extracted"><Warning weight="fill" className="size-3.5 text-amber-500 shrink-0" /></span>}
                                          <span className={cn("max-w-[100px] truncate block", rowWarn && "text-amber-600 dark:text-amber-400")}
                                            title={resolvedBookNum ?? b.gameName}>
                                            {resolvedBookNum ?? "—"}
                                          </span>
                                        </span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {orderEditing
                                      ? <input className={inputCls} type="number" min={0} value={b.ticketValue ?? ""} onChange={e => updateOrderBook(i, "ticketValue", Number(e.target.value))} />
                                      : <span className="font-medium">${b.ticketValue}</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {orderEditing
                                      ? <input className={inputCls} type="number" min={0} value={b.bookValue ?? ""} onChange={e => updateOrderBook(i, "bookValue", Number(e.target.value))} />
                                      : <span>{b.bookValue != null ? `$${b.bookValue.toLocaleString()}` : "—"}</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {orderEditing
                                      ? <select className={inputCls} value={b.status ?? ""} onChange={e => updateOrderBook(i, "status", e.target.value)}>
                                          <option value="C">C</option>
                                          <option value="NC">NC</option>
                                        </select>
                                      : <span className={cn(
                                          "px-1.5 py-0.5 rounded font-semibold",
                                          b.status === "C"  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                          b.status === "NC" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                          "bg-muted text-muted-foreground"
                                        )}>{b.status ?? "—"}</span>}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Cross-validation */}
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm font-semibold">Cross-Validation</p>
                      <div className="space-y-2">
                        {crossChecks.map((c, i) => (
                          <ValidationBadge key={i} check={c} onClick={() => setCrossDetailCheck(c)} />
                        ))}
                      </div>
                      {failCount > 0 && (
                        <p className="text-xs text-destructive bg-destructive/8 px-3 py-2 rounded-xl">
                          {failCount} error{failCount > 1 ? "s" : ""} found. Verify the receipts before importing.
                        </p>
                      )}
                      {failCount === 0 && warnCount > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
                          {warnCount} warning{warnCount > 1 ? "s" : ""} — review carefully before proceeding.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => { setScanError(null); goBack(); }}
                        className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2">
                        <ArrowLeft className="size-4" /> Re-scan
                      </button>
                      <button onClick={proceedToReview}
                        className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        Review Books <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Review */}
              {step === "review" && (
                <div className="p-5 space-y-4">
                  {!importDone && (
                    <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                      <ArrowLeft className="size-3.5" /> Back to Validation
                    </button>
                  )}
                  {importDone ? (
                    <div className="text-center py-8 space-y-4">
                      <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                        <CheckCircle weight="fill" className="size-9 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">Shipment Created!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {[...selected].length} book{[...selected].length !== 1 ? "s" : ""} added as a new shipment.
                        </p>
                      </div>
                      <button onClick={closeModal}
                        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* ── Duplicate pack warning ─────────────────────────────────────── */}
                      {duplicatePacks.length > 0 && (
                        <div className="rounded-2xl border-2 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800/50 p-4 space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                              <Warning weight="fill" className="size-5 text-red-600" />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-red-800 dark:text-red-300">⚠ HIGH PRIORITY — Duplicate Packs Detected</p>
                              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                                {duplicatePacks.length} pack{duplicatePacks.length !== 1 ? "s" : ""} in this delivery already exist in your inventory. This may indicate a duplicate shipment.
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {duplicatePacks.map((d, i) => (
                              <div key={i} className="text-xs text-red-700 dark:text-red-400 bg-red-100/60 dark:bg-red-900/20 rounded-lg px-3 py-1.5 font-mono font-medium">
                                {d}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-red-600 dark:text-red-500 font-medium">
                            Review carefully before importing. Deselect any duplicates above.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{[...selected].length} of {reviewBooks.length} books selected</p>
                        <button onClick={() => setSelected(selected.size === reviewBooks.length ? new Set() : new Set(reviewBooks.map((_, i) => i)))}
                          className="text-xs text-primary hover:underline font-medium">
                          {selected.size === reviewBooks.length ? "Deselect all" : "Select all"}
                        </button>
                      </div>
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs min-w-[580px]">
                            <thead className="bg-muted/40 border-b">
                              <tr>
                                <th className="px-3 py-2.5 w-8" />
                                {["Game ID", "Name", "Pack", "Start", "End", "Price"].map((h) => (
                                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                                <th className="px-2 py-2.5 text-center font-semibold text-muted-foreground" title="Swap start/end for books numbered high-to-low">⇅</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {reviewBooks.map((b, i) => (
                                <tr key={i} className={cn("transition-colors", selected.has(i) ? "bg-primary/5" : "bg-muted/10 opacity-60")}>
                                  <td className="px-3 py-2">
                                    <button onClick={() => {
                                      const next = new Set(selected);
                                      next.has(i) ? next.delete(i) : next.add(i);
                                      setSelected(next);
                                    }}>
                                      {selected.has(i)
                                        ? <CheckSquare weight="fill" className="size-4 text-primary" />
                                        : <Square className="size-4 text-muted-foreground" />
                                      }
                                    </button>
                                  </td>
                                  {(["gameId", "gameName", "pack", "ticketStart", "ticketEnd", "price"] as (keyof ReviewBook)[]).map((k) => (
                                    <td key={k} className="px-3 py-2">
                                      <input
                                        value={String(bookVal(i, k))}
                                        onChange={(e) => editReviewBook(i, k, e.target.value)}
                                        className="w-full min-w-[60px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5 transition-colors"
                                      />
                                    </td>
                                  ))}
                                  {/* Inverse button — swaps start and end */}
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      title="Inverse: swap start ↔ end (for books numbered high-to-low)"
                                      onClick={() => {
                                        const start = Number(bookVal(i, "ticketStart"));
                                        const end   = Number(bookVal(i, "ticketEnd"));
                                        setEdits((prev) => ({ ...prev, [i]: { ...prev[i], ticketStart: end, ticketEnd: start } }));
                                      }}
                                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 border rounded px-1.5 py-0.5 text-[11px] font-bold transition-colors"
                                    >
                                      ⇅
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <button onClick={importSelected} disabled={importing || selected.size === 0}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                        {importing
                          ? <><span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> Creating shipment…</>
                          : <><Truck className="size-4" /> Create Shipment with {[...selected].length} Book{[...selected].length !== 1 ? "s" : ""}</>
                        }
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
