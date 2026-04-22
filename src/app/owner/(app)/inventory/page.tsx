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
  shipmentId: string; orderNumber?: string; shipmentNum?: string;
  date?: string; retailerNum?: string; totalBooks: number;
  notes?: string; createdAt: string; updatedAt?: string;
};

type ReviewBook = {
  gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
};

type Step =
  | "idle" | "method"
  | "delivery" | "delivery-result"
  | "order"   | "order-result"
  | "review";

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

// ── ValidationBadge ───────────────────────────────────────────────────────────

function ValidationBadge({ check }: { check: ValidationCheck }) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-xl px-4 py-3 text-sm border",
      check.status === "pass" && "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40",
      check.status === "fail" && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40",
      check.status === "warn" && "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40",
    )}>
      {check.status === "pass" && <CheckCircle weight="fill" className="size-4 text-emerald-600 mt-0.5 shrink-0" />}
      {check.status === "fail" && <XCircle    weight="fill" className="size-4 text-red-600 mt-0.5 shrink-0" />}
      {check.status === "warn" && <Warning    weight="fill" className="size-4 text-amber-600 mt-0.5 shrink-0" />}
      <div>
        <p className={cn("font-medium text-sm",
          check.status === "pass" && "text-emerald-800 dark:text-emerald-300",
          check.status === "fail" && "text-red-800 dark:text-red-300",
          check.status === "warn" && "text-amber-800 dark:text-amber-300",
        )}>{check.label}</p>
        {check.detail && <p className="text-xs mt-0.5 opacity-70">{check.detail}</p>}
      </div>
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
            {shipment!.orderNumber && (
              <p className="font-mono text-xs text-muted-foreground">#{shipment!.orderNumber}</p>
            )}
            {shipment!.shipmentNum && (
              <p className="font-semibold text-sm">Shipment {shipment!.shipmentNum}</p>
            )}
            {!shipment!.shipmentNum && !shipment!.orderNumber && (
              <p className="font-semibold text-sm text-muted-foreground">Shipment</p>
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
  shipment, books, isManual,
  onClose, onBookUpdated, onBookDeleted, onShipmentDeleted, onShipmentUpdated,
}: {
  shipment: Shipment | null;
  books: Book[];
  isManual: boolean;
  onClose: () => void;
  onBookUpdated: (b: Book) => void;
  onBookDeleted: (bookId: string) => void;
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
    orderNumber: shipment?.orderNumber ?? "",
    shipmentNum: shipment?.shipmentNum ?? "",
    date:        shipment?.date ?? "",
    notes:       shipment?.notes ?? "",
  });
  const [shipmentSaving,  setShipmentSaving]  = useState(false);

  const [delShipmentConfirm, setDelShipmentConfirm] = useState(false);
  const [delShipmentBusy,    setDelShipmentBusy]    = useState(false);

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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-primary shrink-0" />
              <p className="font-bold text-base truncate">
                {isManual ? "Manual Entries" : (shipment?.shipmentNum ? `Shipment ${shipment.shipmentNum}` : "Shipment")}
              </p>
            </div>
            {shipment?.orderNumber && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Order #{shipment.orderNumber}</p>
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

                      {/* Tickets range */}
                      <p className="text-xs text-muted-foreground">
                        Tickets #{b.ticketStart} – #{b.ticketEnd} · Slot {b.slot ?? "—"}
                      </p>

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
  const [crossChecks,    setCrossChecks]    = useState<ValidationCheck[]>([]);

  // Review state
  const [reviewBooks, setReviewBooks] = useState<ReviewBook[]>([]);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [edits,       setEdits]       = useState<Record<number, Partial<ReviewBook>>>({});
  const [importing,   setImporting]   = useState(false);
  const [importDone,  setImportDone]  = useState(false);

  // Manual entry
  const [manualForm, setManualForm] = useState({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
  const [manualError,      setManualError]      = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [orgRetailerNum, setOrgRetailerNum] = useState("");
  const [orgAddress,     setOrgAddress]     = useState("");

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
    setReviewBooks([]);
    setSelected(new Set());
    setEdits({});
    setImportDone(false);
    setManualForm({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
    setManualError("");
  }

  const PREV_STEP: Partial<Record<Step, Step>> = {
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

  const isModalOpen = step !== "idle" && step !== "method";
  const isWide      = step === "review" || step === "order-result";

  // ── Scan helpers ──────────────────────────────────────────────────────────

  async function uploadAndScan(files: File[], endpoint: string): Promise<Record<string, unknown> | null> {
    setScanError(null);
    setScanning(true);
    try {
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

  function validateDelivery(data: Record<string, unknown>): ValidationCheck[] {
    const norm = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];
    checks.push({
      label: 'Header contains "Instant Ticket Delivery Receipt"',
      status: (data.headerText as string ?? "").toLowerCase().includes("instant ticket delivery") ? "pass" : "fail",
      detail: `Found: "${data.headerText}"`,
    });
    const rn = norm(data.retailerNum as string); const orgRn = norm(orgRetailerNum);
    checks.push({
      label: `Retailer number matches (${orgRetailerNum})`,
      status: !rn ? "fail" : rn === orgRn ? "pass" : "fail",
      detail: !rn ? "Not found" : rn === orgRn ? `Matched: ${data.retailerNum}` : `Receipt has: ${data.retailerNum}`,
    });
    checks.push({
      label: "Address verified",
      status: "warn",
      detail: (data.retailerAddress as string)
        ? `Receipt: ${data.retailerAddress} | Registered: ${orgAddress}`
        : "Address not found — verify manually",
    });
    return checks;
  }

  function validateOrder(data: Record<string, unknown>): ValidationCheck[] {
    const norm = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];
    checks.push({
      label: 'Header contains "Confirm Order"',
      status: (data.headerText as string ?? "").toLowerCase().includes("confirm") ? "pass" : "fail",
      detail: `Found: "${data.headerText}"`,
    });
    const rn = norm(data.retailerNum as string); const orgRn = norm(orgRetailerNum);
    checks.push({
      label: `Retailer number matches (${orgRetailerNum})`,
      status: !rn ? "fail" : rn === orgRn ? "pass" : "fail",
      detail: !rn ? "Not found" : rn === orgRn ? `Matched: ${data.retailerNum}` : `Receipt has: ${data.retailerNum}`,
    });
    checks.push({
      label: "Order number present",
      status: data.orderNumber ? "pass" : "fail",
      detail: data.orderNumber ? `Order #: ${data.orderNumber}` : "Not found",
    });
    return checks;
  }

  function crossValidate(dd: Record<string, unknown>, od: Record<string, unknown>): ValidationCheck[] {
    const norm = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];
    const dr = norm(dd.retailerNum as string); const or2 = norm(od.retailerNum as string);
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
    const dOrd = norm(dd.orderNumber as string); const oOrd = norm(od.orderNumber as string);
    checks.push({
      label: "Order numbers match",
      status: !dOrd || !oOrd ? "warn" : dOrd === oOrd ? "pass" : "fail",
      detail: dOrd === oOrd ? `Order #: ${dd.orderNumber}` : !dOrd || !oOrd ? "One or both missing" : `Delivery: ${dd.orderNumber} vs Order: ${od.orderNumber}`,
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
    const data = await uploadAndScan(files, "/api/receipt/scan-delivery");
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

  const failCount = crossChecks.filter((c) => c.status === "fail").length;
  const warnCount = crossChecks.filter((c) => c.status === "warn").length;

  const showManualCard = !query ? manualBooks.length > 0 : filteredManual.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Drawer */}
      {openShipmentId && (
        <ShipmentDrawer
          shipment={openShipmentId === "manual" ? null : openShipment}
          books={drawerBooks}
          isManual={openShipmentId === "manual"}
          onClose={() => setOpenShipmentId(null)}
          onBookUpdated={(b) => setBooks((prev) => prev.map((x) => x.bookId === b.bookId ? b : x))}
          onBookDeleted={(id) => setBooks((prev) => prev.filter((x) => x.bookId !== id))}
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

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shipment # or game name…"
          className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
      </div>

      {/* Shipment grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 border rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filteredShipments.length === 0 && !showManualCard ? (
        <div className="text-center py-16 space-y-3 border border-dashed rounded-2xl">
          <Truck className="size-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {query ? "No shipments or books match your search." : "No shipments yet. Click Add Books to get started."}
          </p>
          {!query && (
            <button onClick={() => setStep("method")} className="text-xs text-primary hover:underline font-medium">
              + Add your first shipment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {filteredShipments.map((s) => (
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
              books={filteredManual}
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
              <h2 className="font-bold text-lg">Add Books</h2>
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
                  <p className="font-semibold text-sm">Scan Shipment Receipts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload delivery receipt + confirm order — AI extracts all books automatically and creates a shipment record.</p>
                </div>
              </button>

              <div className="pt-1">
                <p className="text-xs text-center text-muted-foreground mb-3">or add a single book manually</p>
                <form onSubmit={addManual} className="space-y-2.5">
                  {[
                    { key: "gameId",      label: "Game ID",   ph: "G-4821" },
                    { key: "gameName",    label: "Game Name", ph: "Gold Rush" },
                    { key: "pack",        label: "Pack #",    ph: "P-001" },
                    { key: "ticketStart", label: "Start #",   ph: "1",   type: "number" },
                    { key: "ticketEnd",   label: "End #",     ph: "300", type: "number" },
                    { key: "price",       label: "Price ($)", ph: "5",   type: "number" },
                  ].map(({ key, label, ph, type }) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-xs font-medium w-20 shrink-0 text-muted-foreground">{label}</label>
                      <input type={type ?? "text"} required placeholder={ph}
                        value={manualForm[key as keyof typeof manualForm]}
                        onChange={(e) => setManualForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  ))}
                  {manualError && <p className="text-xs text-destructive">{manualError}</p>}
                  <button type="submit" disabled={manualSubmitting}
                    className="w-full bg-muted hover:bg-muted/80 border rounded-xl py-2 text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {manualSubmitting ? <span className="size-4 rounded-full border-2 border-foreground border-t-transparent animate-spin" /> : "Add Single Book"}
                  </button>
                </form>
              </div>
            </div>
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
                    <p className="text-xs mt-1 text-blue-700 dark:text-blue-400">The physical receipt from the Ohio Lottery shipment. Contains the list of all books in this delivery.</p>
                  </div>
                  <UploadZone scanning={scanning} onFiles={handleDeliveryScan} error={scanError} onRetry={() => setScanError(null)} />
                </div>
              )}

              {/* Delivery result */}
              {step === "delivery-result" && deliveryData && (() => {
                type DeliveryGame = { gameId: string; gameDescription: string; ticketValue: number; packQuantity?: number; packValue?: number; packTotal?: number; packNumbers?: string[] };
                const dGames = (deliveryData.games as DeliveryGame[]) ?? [];
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
                          <span className="text-xs text-muted-foreground">{dGames.length} game{dGames.length !== 1 ? "s" : ""} · {dGames.reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0)} books</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/20 border-b">
                              <tr>
                                {["Game ID", "Name", "Ticket $", "Packs", "Pack Value", "Pack Numbers"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {dGames.map((g, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{g.gameId}</td>
                                  <td className="px-3 py-2 max-w-[160px] truncate" title={g.gameDescription}>{g.gameDescription}</td>
                                  <td className="px-3 py-2 font-medium">${g.ticketValue}</td>
                                  <td className="px-3 py-2">{g.packQuantity ?? (g.packNumbers?.length ?? "—")}</td>
                                  <td className="px-3 py-2">{g.packValue != null ? `$${g.packValue.toLocaleString()}` : "—"}</td>
                                  <td className="px-3 py-2">
                                    <span className="font-mono text-muted-foreground">
                                      {(g.packNumbers ?? []).slice(0, 3).join(", ")}
                                      {(g.packNumbers?.length ?? 0) > 3 && ` +${(g.packNumbers!.length - 3)} more`}
                                    </span>
                                  </td>
                                </tr>
                              ))}
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
                type DeliveryGame = { gameId: string; gameDescription: string; ticketValue: number; packQuantity?: number; packValue?: number; packNumbers?: string[] };
                type OrderBook   = { gameId: string; gameName: string; ticketValue: number; bookValue?: number; status?: string };
                const dGames = (deliveryData.games as DeliveryGame[]) ?? [];
                const oBooks = (orderData.books as OrderBook[]) ?? [];
                return (
                  <div className="p-5 space-y-5">

                    {/* Side-by-side tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                      {/* Delivery receipt table */}
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
                              ) : dGames.map((g, i) => (
                                <tr key={i} className="hover:bg-muted/10">
                                  <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{g.gameId}</td>
                                  <td className="px-3 py-2 max-w-[120px] truncate" title={g.gameDescription}>{g.gameDescription}</td>
                                  <td className="px-3 py-2 font-medium">${g.ticketValue}</td>
                                  <td className="px-3 py-2">{g.packQuantity ?? (g.packNumbers?.length ?? "—")}</td>
                                  <td className="px-3 py-2">{g.packValue != null ? `$${g.packValue.toLocaleString()}` : "—"}</td>
                                  <td className="px-3 py-2 font-mono text-muted-foreground">
                                    {(g.packNumbers ?? []).slice(0, 2).join(", ")}
                                    {(g.packNumbers?.length ?? 0) > 2 && ` +${g.packNumbers!.length - 2}`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Confirm order table */}
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b flex items-center justify-between">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Confirm Order</p>
                          <span className="text-xs text-muted-foreground">
                            {oBooks.filter(b => b.status === "C").length} confirmed · {oBooks.length} total
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/20 border-b">
                              <tr>
                                {["Game ID", "Name", "$", "Book Value", "Status"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {oBooks.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No books extracted</td></tr>
                              ) : oBooks.map((b, i) => (
                                <tr key={i} className="hover:bg-muted/10">
                                  <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{b.gameId}</td>
                                  <td className="px-3 py-2 max-w-[120px] truncate" title={b.gameName}>{b.gameName}</td>
                                  <td className="px-3 py-2 font-medium">${b.ticketValue}</td>
                                  <td className="px-3 py-2">{b.bookValue != null ? `$${b.bookValue.toLocaleString()}` : "—"}</td>
                                  <td className="px-3 py-2">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded font-semibold",
                                      b.status === "C"  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                      b.status === "NC" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                      "bg-muted text-muted-foreground"
                                    )}>{b.status ?? "—"}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Cross-validation */}
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm font-semibold">Cross-Validation</p>
                      <div className="space-y-2">{crossChecks.map((c, i) => <ValidationBadge key={i} check={c} />)}</div>
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
