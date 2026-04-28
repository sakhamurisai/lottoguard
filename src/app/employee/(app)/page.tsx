"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, CheckCircle, Check,
  Camera, AlertTriangle, X,
  ArrowRight, ArrowLeft,
  Upload, Eye, RotateCcw, BookOpen, RefreshCw,
  Sun, Users, Scan, Hash,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Serial parser  format: GGGG-BBBBBBB-TTT-C
// ─────────────────────────────────────────────────────────────────────────────

const TICKET_SERIAL_RE = /^(\d{4})-(\d{7})-(\d{3})-\d$/;
function parseTicketSerial(s: string) {
  const m = TICKET_SERIAL_RE.exec(s.trim());
  if (!m) return null;
  return { gameId: m[1], bookNum: m[2], ticketNum: parseInt(m[3], 10) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ShiftStatus = "active" | "completed";

type Shift = {
  shiftId:             string;
  slotNum:             number;
  ticketStart:         number;
  ticketEnd?:          number;
  clockIn:             string;
  clockOut?:           string;
  status:              ShiftStatus;
  sold?:               number;
  bookPrice?:          number;
  gameName?:           string;
  shiftBooks?:         ScannedEntry[];
  finalCalc?:          number;
  drawerCash?:         number;
  discrepancySeverity?: "none" | "over" | "short";
};

type SlotInfo = {
  slotNum:      number;
  bookId:       string | null;
  gameId?:      string;
  gameName?:    string;
  pack?:        string;
  price?:       number;
  ticketStart?: number;
  status?:      string;
};

type ScannedEntry = {
  serial:      string;
  ticketStart: number;
  slotNum:     number;
  bookId:      string;
  gameName?:   string;
  price?:      number;
};

type AlertEntry = {
  id:        string;
  severity:  "error" | "warning" | "info";
  message:   string;
  timestamp: string;
};

type ReceiptData = {
  raw:             string;
  grossSales?:     number;
  onlineNetSales:  number;
  cashlessInstant: number;
  terminalNumber?: string;
  receiptDate?:    string;
  receiptTime?:    string;
};

type CashesData = {
  raw:             string;
  totalCashes:     number;
  terminalNumber?: string;
  receiptDate?:    string;
  receiptTime?:    string;
};

type ClockStep =
  | "idle"
  | "slot_select"
  | "slot_tickets"
  | "preview"
  | "active"
  | "clockout_slots"
  | "clockout_receipt_sales"
  | "clockout_receipt_cashes"
  | "clockout_drawer";

// ─────────────────────────────────────────────────────────────────────────────
// Local-storage alerts
// ─────────────────────────────────────────────────────────────────────────────

const ALERTS_KEY = "lg_emp_alerts";

function pushAlert(sub: string, severity: AlertEntry["severity"], message: string) {
  try {
    const raw = localStorage.getItem(`${ALERTS_KEY}_${sub}`);
    const existing: AlertEntry[] = raw ? JSON.parse(raw) : [];
    const entry: AlertEntry = { id: crypto.randomUUID(), severity, message, timestamp: new Date().toISOString() };
    localStorage.setItem(`${ALERTS_KEY}_${sub}`, JSON.stringify([entry, ...existing].slice(0, 50)));
  } catch { /* storage full */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function useElapsed(clockInIso: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!clockInIso) { setElapsed(0); return; }
    const start = new Date(clockInIso).getTime();
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockInIso]);
  return elapsed;
}

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600).toString().padStart(2, "0");
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TIERS = [
  { price:  1, label:  "$1", color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  headerBg: "bg-green-100"  },
  { price:  2, label:  "$2", color: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-200",   headerBg: "bg-teal-100"   },
  { price:  5, label:  "$5", color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   headerBg: "bg-blue-100"   },
  { price: 10, label: "$10", color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", headerBg: "bg-violet-100" },
  { price: 20, label: "$20", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", headerBg: "bg-purple-100" },
  { price: 30, label: "$30", color: "text-pink-700",   bg: "bg-pink-50",   border: "border-pink-200",   headerBg: "bg-pink-100"   },
  { price: 50, label: "$50", color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200",   headerBg: "bg-rose-100"   },
];
const MAX_PER_TIER = 20;
function slotNumFromTier(tierIdx: number, colIdx: number) { return tierIdx * MAX_PER_TIER + colIdx + 1; }
const FOLD = { clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" };

// ─────────────────────────────────────────────────────────────────────────────
// Step progress indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-start w-full py-1">
      {steps.map((label, i) => (
        <div key={i} className="flex items-start flex-1">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className={cn(
              "size-9 rounded-full flex items-center justify-center font-bold border-2 transition-all",
              i < current
                ? "bg-primary border-primary text-primary-foreground"
                : i === current
                ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/15"
                : "bg-background border-border text-muted-foreground/40"
            )}>
              {i < current
                ? <Check className="size-4" />
                : <span className="text-sm">{i + 1}</span>
              }
            </div>
            <span className={cn(
              "text-[11px] font-semibold text-center whitespace-nowrap leading-tight",
              i === current ? "text-primary"     :
              i < current  ? "text-primary/60"  :
              "text-muted-foreground/40"
            )}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              "flex-1 h-[2px] mt-[17px] mx-2",
              i < current ? "bg-primary" : "bg-border"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt uploader
// ─────────────────────────────────────────────────────────────────────────────

type ReceiptUploaderProps = {
  type:      "sales" | "cashes";
  onSuccess: (data: ReceiptData | CashesData) => void;
  onSkip:    () => void;
};

function ReceiptUploader({ type, onSuccess, onSkip }: ReceiptUploaderProps) {
  const [scanning, setScanning] = useState(false);
  const [errors,   setErrors]   = useState<string[]>([]);
  const [photos,   setPhotos]   = useState<{ file: File; preview: string }[]>([]);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const label = type === "sales" ? "Sales Today" : "Cashes Today";

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = 10 - photos.length;
    if (remaining <= 0) return;
    const added = Array.from(fileList).slice(0, remaining).map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setPhotos(prev => [...prev, ...added]);
    setErrors([]);
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleScan() {
    if (photos.length === 0) return;
    setErrors([]);
    setScanning(true);
    for (const { file } of photos) {
      try {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        if (!presignRes.ok) continue;
        const { url, key } = await presignRes.json() as { url: string; key: string };
        await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        const scanRes  = await fetch("/api/receipt/scan-shift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, type }),
        });
        const scanData = await scanRes.json() as {
          unclear: boolean; valid: boolean; errors: string[]; data: Record<string, unknown>;
        };
        if (scanRes.ok && !scanData.unclear && (scanData.valid || scanData.errors.length === 0)) {
          setScanning(false);
          onSuccess(scanData.data as ReceiptData | CashesData);
          return;
        }
      } catch { /* try next */ }
    }
    setErrors(["Could not read any of the uploaded receipts. Try taking clearer photos."]);
    setScanning(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Upload {label} Receipt</p>
        <p className="text-xs text-muted-foreground">
          Take photos or upload from your device (up to 10). Must say &ldquo;{type === "sales" ? "SALES - TODAY" : "CASHES - TODAY"}&rdquo;.
        </p>
      </div>

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
          {photos.length < 10 && (
            <button type="button" disabled={scanning} onClick={() => galleryRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
              <Upload className="size-5" />
            </button>
          )}
        </div>
      )}

      {scanning && (
        <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-xl text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" /> Scanning receipts…
        </div>
      )}

      {errors.map((e, i) => (
        <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />{e}
        </div>
      ))}

      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {photos.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={scanning} onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 border-2 rounded-xl py-3 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Camera className="size-4" /> Camera
          </button>
          <button type="button" disabled={scanning} onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-2 border-2 rounded-xl py-3 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Upload className="size-4" /> Upload
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={scanning} onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center border rounded-xl py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Camera className="size-4" />
          </button>
          <button type="button" disabled={scanning} onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center border rounded-xl py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Upload className="size-4" />
          </button>
          <button type="button" disabled={scanning || photos.length === 0} onClick={handleScan}
            className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {scanning ? <RefreshCw className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {scanning ? "…" : "Scan"}
          </button>
        </div>
      )}

      <button type="button" onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
        Skip for now
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot select grid — interactive, used at clock-in to pick slots to work
// ─────────────────────────────────────────────────────────────────────────────

function SlotSelectGrid({
  slots, slotNames, tierCounts, selected, onToggle,
}: {
  slots:      SlotInfo[];
  slotNames:  Record<string, string>;
  tierCounts: Record<string, number>;
  selected:   Set<number>;
  onToggle:   (slotNum: number) => void;
}) {
  const slotMap: Record<number, SlotInfo> = {};
  for (const s of slots) slotMap[s.slotNum] = s;

  const effectiveCounts = Object.values(tierCounts).some(c => c > 0)
    ? tierCounts
    : Object.fromEntries(
        TIERS.map((t, ti) => {
          const colMax = slots
            .filter(s => s.bookId)
            .filter(s => Math.floor((s.slotNum - 1) / MAX_PER_TIER) === ti)
            .reduce((m, s) => Math.max(m, (s.slotNum - 1) % MAX_PER_TIER + 1), 0);
          return [String(t.price), colMax];
        })
      );

  const hasAny = Object.values(effectiveCounts).some(c => c > 0);
  if (!hasAny) return (
    <div className="py-10 text-center space-y-3">
      <div className="size-14 rounded-full bg-muted flex items-center justify-center mx-auto">
        <BookOpen className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">No slots configured yet.</p>
      <p className="text-xs text-muted-foreground">Contact your manager to set up the slot board.</p>
    </div>
  );

  return (
    <div className="space-y-2.5">
      {TIERS.map((tier, ti) => {
        const count = effectiveCounts[String(tier.price)] ?? 0;
        if (count === 0) return null;
        return (
          <div key={tier.price} className="flex items-start gap-2">
            <div className={cn(
              "rounded-xl border px-2 py-2.5 flex flex-col items-center justify-center gap-0.5 w-12 shrink-0",
              tier.headerBg, tier.border
            )}>
              <span className={cn("text-sm font-black leading-none", tier.color)}>{tier.label}</span>
              <span className="text-[8px] text-muted-foreground">ticket</span>
            </div>

            <div className="flex-1 flex flex-wrap gap-1.5">
              {Array.from({ length: count }, (_, ci) => {
                const sn         = slotNumFromTier(ti, ci);
                const slot       = slotMap[sn];
                const hasBook    = !!slot?.bookId;
                const isSoldOut  = slot?.status === "settled";
                const isInactive = slot?.status === "inactive";
                const canSelect  = hasBook && !isSoldOut;
                const isSelected = selected.has(sn);
                const customName = slotNames[String(sn)] ?? "";

                return (
                  <button
                    key={ci}
                    type="button"
                    onClick={() => { if (canSelect) onToggle(sn); }}
                    disabled={!canSelect}
                    className="relative shrink-0"
                  >
                    <div
                      style={FOLD}
                      className={cn(
                        "w-[96px] min-h-[96px] rounded-xl border p-2 space-y-1 transition-all select-none",
                        !canSelect && "opacity-40 cursor-not-allowed",
                        hasBook && !isSoldOut
                          ? cn(tier.bg, tier.border)
                          : isSoldOut
                          ? "bg-gray-50 border-gray-200"
                          : "bg-background border-dashed border-muted-foreground/20",
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1 shadow-md"
                          : canSelect
                          ? "hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 cursor-pointer"
                          : ""
                      )}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[8px] font-bold text-muted-foreground/60">#{sn}</span>
                        {customName && (
                          <span className={cn("text-[7px] font-bold uppercase truncate max-w-[54px]", tier.color)}>
                            {customName}
                          </span>
                        )}
                      </div>

                      {hasBook ? (
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-semibold leading-tight line-clamp-2">
                            {slot.gameName ?? `Game ${slot.gameId ?? ""}`}
                          </p>
                          <p className="text-[8px] text-muted-foreground font-mono">{slot.pack}</p>
                          <div className={cn(
                            "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-bold mt-0.5",
                            isSoldOut  ? "bg-gray-100 text-gray-500"    :
                            isInactive ? "bg-amber-50 text-amber-700"   :
                            "bg-emerald-50 text-emerald-700"
                          )}>
                            <span className={cn("size-1 rounded-full",
                              isSoldOut  ? "bg-gray-400"  :
                              isInactive ? "bg-amber-500" : "bg-emerald-500"
                            )} />
                            {isSoldOut ? "Sold Out" : isInactive ? "Inactive" : "Active"}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-10">
                          <span className="text-[8px] text-muted-foreground/40">Empty</span>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 pointer-events-none">
                        <CheckCircle className="size-4 text-primary drop-shadow-sm" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active-shift slot grid — read-only with status badges + sold-out buttons
// ─────────────────────────────────────────────────────────────────────────────

function ActiveSlotGrid({
  slots, slotNames, tierCounts, activeSlots, onSoldOut,
}: {
  slots:       SlotInfo[];
  slotNames:   Record<string, string>;
  tierCounts:  Record<string, number>;
  activeSlots: Set<number>;
  onSoldOut?:  (slotNum: number, bookId: string) => void;
}) {
  const slotMap: Record<number, SlotInfo> = {};
  for (const s of slots) slotMap[s.slotNum] = s;

  const effectiveCounts = Object.values(tierCounts).some(c => c > 0)
    ? tierCounts
    : Object.fromEntries(
        TIERS.map((t, ti) => {
          const colMax = slots
            .filter(s => s.bookId)
            .filter(s => Math.floor((s.slotNum - 1) / MAX_PER_TIER) === ti)
            .reduce((m, s) => Math.max(m, (s.slotNum - 1) % MAX_PER_TIER + 1), 0);
          return [String(t.price), colMax];
        })
      );

  const hasAny = Object.values(effectiveCounts).some(c => c > 0);
  if (!hasAny) return (
    <p className="text-xs text-muted-foreground py-3 text-center">No slots configured by manager.</p>
  );

  return (
    <div className="space-y-2.5">
      {TIERS.map((tier, ti) => {
        const count = effectiveCounts[String(tier.price)] ?? 0;
        if (count === 0) return null;
        return (
          <div key={tier.price} className="flex items-start gap-2">
            <div className={cn(
              "rounded-xl border px-2 py-2.5 flex flex-col items-center justify-center gap-0.5 w-12 shrink-0",
              tier.headerBg, tier.border
            )}>
              <span className={cn("text-sm font-black leading-none", tier.color)}>{tier.label}</span>
              <span className="text-[8px] text-muted-foreground">ticket</span>
            </div>

            <div className="flex-1 flex flex-wrap gap-1.5">
              {Array.from({ length: count }, (_, ci) => {
                const sn         = slotNumFromTier(ti, ci);
                const slot       = slotMap[sn];
                const hasBook    = !!slot?.bookId;
                const isSoldOut  = slot?.status === "settled";
                const isInactive = slot?.status === "inactive";
                const isWorking  = activeSlots.has(sn);
                const customName = slotNames[String(sn)] ?? "";

                return (
                  <div key={ci} className="relative">
                    <div
                      style={FOLD}
                      className={cn(
                        "w-[96px] min-h-[96px] rounded-xl border p-2 space-y-1",
                        hasBook && !isSoldOut ? cn(tier.bg, tier.border) :
                        isSoldOut             ? "bg-gray-50 border-gray-200" :
                        "bg-background border-dashed border-muted-foreground/20",
                        isWorking && "ring-2 ring-emerald-500 ring-offset-1"
                      )}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[8px] font-bold text-muted-foreground/60">#{sn}</span>
                        {customName && (
                          <span className={cn("text-[7px] font-bold uppercase truncate max-w-[54px]", tier.color)}>
                            {customName}
                          </span>
                        )}
                      </div>

                      {hasBook ? (
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-semibold leading-tight line-clamp-2">
                            {slot.gameName ?? `Game ${slot.gameId ?? ""}`}
                          </p>
                          <p className="text-[8px] text-muted-foreground font-mono">{slot.pack}</p>
                          <div className={cn(
                            "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-bold mt-0.5",
                            isSoldOut  ? "bg-gray-100 text-gray-500"    :
                            isInactive ? "bg-amber-50 text-amber-700"   :
                            "bg-emerald-50 text-emerald-700"
                          )}>
                            <span className={cn("size-1 rounded-full",
                              isSoldOut  ? "bg-gray-400"  :
                              isInactive ? "bg-amber-500" : "bg-emerald-500"
                            )} />
                            {isSoldOut ? "Sold Out" : isInactive ? "Inactive" : "Active"}
                          </div>
                          {onSoldOut && !isSoldOut && slot.bookId && (
                            <button
                              onClick={() => onSoldOut(sn, slot.bookId!)}
                              className="w-full mt-0.5 text-[7px] px-1 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors font-semibold leading-tight"
                            >
                              Sold Out
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-10">
                          <span className="text-[8px] text-muted-foreground/40">Empty</span>
                        </div>
                      )}
                    </div>

                    {isWorking && (
                      <div className="absolute top-0.5 right-0.5 drop-shadow-sm">
                        <CheckCircle className="size-3.5 text-emerald-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [shifts,     setShifts]     = useState<Shift[]>([]);
  const [active,     setActive]     = useState<Shift | null>(null);
  const [slots,      setSlots]      = useState<SlotInfo[]>([]);
  const [slotNames,  setSlotNames]  = useState<Record<string, string>>({});
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [loading,    setLoading]    = useState(true);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [clockStep, setClockStep] = useState<ClockStep>("idle");

  // Shift type prompt
  const [shiftTypeModal, setShiftTypeModal] = useState(false);
  const [shiftType,      setShiftType]      = useState<"start" | "continuation" | null>(null);

  // Slot entry popup (used during slot_tickets step)
  const [activeSlotPopup,  setActiveSlotPopup]  = useState<number | null>(null);
  const [slotPopupSerial,  setSlotPopupSerial]  = useState("");
  const [slotPopupMode,    setSlotPopupMode]    = useState<"number" | "serial">("number");

  // Day close
  const [isDayClose, setIsDayClose] = useState(false);

  // Clock-in state
  const [selectedSlots,    setSelectedSlots]    = useState<number[]>([]);
  const [slotTicketInputs, setSlotTicketInputs] = useState<Record<number, string>>({});
  const [clockInError,     setClockInError]     = useState("");
  const [submitting,       setSubmitting]       = useState(false);

  // Clock-out state
  const [slotEndInputs,  setSlotEndInputs]  = useState<Record<number, string>>({});
  const [salesReceipt,   setSalesReceipt]   = useState<ReceiptData | null>(null);
  const [cashesReceipt,  setCashesReceipt]  = useState<CashesData | null>(null);
  const [drawerCash,     setDrawerCash]     = useState("");
  const [discrepNote,    setDiscrepNote]    = useState("");
  const [summary,        setSummary]        = useState<{
    finalCalc: number; drawerCash: number; discrepancySeverity: string; diff: number;
  } | null>(null);

  const elapsed = useElapsed(active?.clockIn ?? null);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadSlots = useCallback(async () => {
    const r = await fetch("/api/employee/slots");
    if (r.ok) {
      const data = await r.json() as {
        slotMap: Record<number, string | null>;
        bookMap: Record<string, { gameName: string; pack: string; price: number; status: string; ticketStart?: number; gameId?: string }>;
        slotNames:      Record<string, string>;
        tierSlotCounts: Record<string, number>;
      };
      const list: SlotInfo[] = Object.entries(data.slotMap).map(([n, bookId]) => {
        const bk = bookId ? data.bookMap[bookId] : undefined;
        return {
          slotNum:     Number(n),
          bookId:      bk ? bookId : null,
          gameId:      bk?.gameId,
          gameName:    bk?.gameName,
          pack:        bk?.pack,
          price:       bk?.price,
          ticketStart: bk?.ticketStart,
          status:      bk?.status,
        };
      });
      setSlots(list.sort((a, b) => a.slotNum - b.slotNum));
      setSlotNames(data.slotNames      ?? {});
      setTierCounts(data.tierSlotCounts ?? {});
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shifts");
    if (res.ok) {
      const data = await res.json() as { shifts: Shift[]; active: Shift | null };
      setShifts(data.shifts.filter(s => s.status === "completed"));
      setActive(data.active);
      if (data.active) setClockStep("active");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadSlots(); }, [load, loadSlots]);

  useEffect(() => { if (active) setClockStep("active"); }, [active]);

  // ── Alert helper ──────────────────────────────────────────────────────────

  function addAlert(severity: AlertEntry["severity"], message: string) {
    if (user?.id) pushAlert(user.id, severity, message);
  }

  // ── Clock In ──────────────────────────────────────────────────────────────

  async function handleClockIn() {
    if (selectedSlots.length === 0) return;
    setSubmitting(true);
    setClockInError("");

    const entries = [...selectedSlots].sort((a, b) => a - b).map(sn => {
      const slot = slots.find(s => s.slotNum === sn)!;
      return { slotNum: sn, bookId: slot.bookId!, ticketStart: parseInt(slotTicketInputs[sn], 10) };
    });

    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clock_in", entries, isStartShift: shiftType === "start" }),
    });
    const data = await r.json() as { shift?: Shift & { shiftBooks?: ScannedEntry[] }; error?: string };
    if (r.ok && data.shift) {
      setActive(data.shift as Shift);
      setClockStep("active");
      setSelectedSlots([]);
      setSlotTicketInputs({});
      addAlert("info", `Shift started — ${entries.length} slot(s) registered.`);
    } else {
      const msg = data.error ?? "Failed to clock in.";
      setClockInError(msg);
      addAlert("error", msg);
    }
    setSubmitting(false);
  }

  // ── Clock Out ─────────────────────────────────────────────────────────────

  async function submitClockOut() {
    if (!active || !drawerCash) return;
    setSubmitting(true);

    const books = active.shiftBooks ?? [{ slotNum: active.slotNum, ticketStart: active.ticketStart, bookId: "", serial: "" }];
    const shiftEndEntries = books.map(sb => ({
      slotNum:   sb.slotNum,
      ticketEnd: parseInt(slotEndInputs[sb.slotNum] ?? "0", 10),
    }));

    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:          "clock_out",
        shiftId:         active.shiftId,
        shiftEndEntries,
        drawerCash:      Number(drawerCash),
        discrepancyNote: discrepNote || undefined,
        salesReceipt:    salesReceipt  ?? undefined,
        cashesReceipt:   cashesReceipt ?? undefined,
        isDayClose,
      }),
    });
    const data = await r.json() as {
      message?: string; error?: string;
      finalCalc: number; drawerCash: number;
      discrepancySeverity: string; diff: number;
    };
    if (r.ok) {
      setSummary({ finalCalc: data.finalCalc, drawerCash: data.drawerCash, discrepancySeverity: data.discrepancySeverity, diff: data.diff });
      const totalSold = shiftEndEntries.reduce((sum, e) => {
        const sb = books.find(b => b.slotNum === e.slotNum);
        return sum + Math.max(0, e.ticketEnd - (sb?.ticketStart ?? 0));
      }, 0);
      setShifts(prev => [{
        ...active,
        ticketEnd:           shiftEndEntries[0]?.ticketEnd ?? 0,
        clockOut:            new Date().toISOString(),
        status:              "completed",
        sold:                totalSold,
        finalCalc:           data.finalCalc,
        drawerCash:          data.drawerCash,
        discrepancySeverity: data.discrepancySeverity as Shift["discrepancySeverity"],
      }, ...prev]);
      setActive(null);
      setClockStep("idle");
      resetClockOut();
    } else {
      addAlert("error", data.error ?? "Clock out failed.");
    }
    setSubmitting(false);
  }

  function resetClockOut() {
    setSlotEndInputs({});
    setSalesReceipt(null);
    setCashesReceipt(null);
    setDrawerCash("");
    setDiscrepNote("");
    setIsDayClose(false);
    setShiftType(null);
  }

  // ── Book sold out (mid-shift) ─────────────────────────────────────────────

  async function handleBookSoldOut(slotNum: number, bookId: string) {
    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "book_sold_out", bookId, slotNum }),
    });
    if (r.ok) {
      addAlert("info", `Slot #${slotNum} — book marked sold out. Manager notified.`);
      await loadSlots();
    } else {
      const d = await r.json() as { error?: string };
      addAlert("error", d.error ?? "Failed to mark book sold out.");
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const activeBookSet = new Set((active?.shiftBooks ?? []).map(sb => sb.slotNum));

  const shiftBooksForClockout = active?.shiftBooks?.length
    ? active.shiftBooks
    : active
    ? [{ slotNum: active.slotNum, ticketStart: active.ticketStart, bookId: "", serial: "", gameName: active.gameName, price: active.bookPrice }]
    : [];

  const canClockOut = shiftBooksForClockout.length > 0 && shiftBooksForClockout.every(sb => {
    const end = parseInt(slotEndInputs[sb.slotNum] ?? "", 10);
    return !isNaN(end) && end > sb.ticketStart;
  });

  const liveCalc = (() => {
    let ticketSale = 0;
    for (const sb of shiftBooksForClockout) {
      const end = parseInt(slotEndInputs[sb.slotNum] ?? "", 10);
      if (!isNaN(end) && end > sb.ticketStart) {
        ticketSale += (end - sb.ticketStart) * (sb.price ?? 0);
      }
    }
    return ticketSale + (salesReceipt?.onlineNetSales ?? 0) + (salesReceipt?.cashlessInstant ?? 0) - (cashesReceipt?.totalCashes ?? 0);
  })();

  const drawerNum = Number(drawerCash) || 0;
  const liveDiff  = liveCalc - drawerNum;
  const needsNote = drawerCash ? Math.abs(liveDiff) > 0.01 : false;

  const isOver  = summary?.discrepancySeverity === "over";
  const isShort = summary?.discrepancySeverity === "short";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col">

      {/* ── Shift complete summary modal ── */}
      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-3xl p-7 w-full max-w-sm space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className={cn("size-16 rounded-full flex items-center justify-center mx-auto",
                isOver ? "bg-red-100" : isShort ? "bg-amber-100" : "bg-emerald-100")}>
                {isOver || isShort
                  ? <AlertTriangle className={cn("size-9", isOver ? "text-red-600" : "text-amber-600")} />
                  : <CheckCircle className="size-9 text-emerald-600" />
                }
              </div>
              <h2 className="text-xl font-bold">
                {isOver ? "Discrepancy — Manager Notified" : isShort ? "Shift Complete (Review Sent)" : "Shift Complete!"}
              </h2>
              {(isOver || isShort) && (
                <p className={cn("text-sm font-medium", isOver ? "text-red-600" : "text-amber-600")}>
                  {isOver
                    ? `$${Math.abs(summary.diff).toFixed(2)} over drawer`
                    : `Drawer $${Math.abs(summary.diff).toFixed(2)} over calculated`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { label: "Calculated", value: `$${summary.finalCalc.toFixed(2)}` },
                { label: "Drawer",     value: `$${summary.drawerCash.toFixed(2)}` },
              ].map(s => (
                <div key={s.label} className="border rounded-2xl py-3">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setSummary(null); router.push("/employee/dashboard"); }}
              className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity">
              View Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Shift type modal (Start / Continuation) ── */}
      {shiftTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Clock className="size-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Starting Your Shift</h2>
              <p className="text-sm text-muted-foreground">
                Is this the start of the day, or are you taking over from another employee?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShiftType("start");
                  setShiftTypeModal(false);
                  setClockStep("slot_select");
                }}
                className="flex flex-col items-center gap-2.5 p-4 border-2 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                <Sun className="size-6 text-amber-500" />
                <div className="text-center">
                  <p className="text-sm font-bold">Start of Day</p>
                  <p className="text-xs text-muted-foreground">First shift today</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShiftType("continuation");
                  setShiftTypeModal(false);
                  setClockStep("slot_select");
                }}
                className="flex flex-col items-center gap-2.5 p-4 border-2 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                <Users className="size-6 text-blue-500" />
                <div className="text-center">
                  <p className="text-sm font-bold">Continuation</p>
                  <p className="text-xs text-muted-foreground">Taking over mid-day</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShiftTypeModal(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Slot entry popup (blurred overlay, used in slot_tickets step) ── */}
      {activeSlotPopup !== null && (() => {
        const sn         = activeSlotPopup;
        const slot       = slots.find(s => s.slotNum === sn);
        const tierIdx    = Math.floor((sn - 1) / MAX_PER_TIER);
        const tier       = TIERS[tierIdx];
        const val        = slotTicketInputs[sn] ?? "";
        const customName = slotNames[String(sn)] ?? "";
        const parsed     = slotPopupMode === "serial" ? parseTicketSerial(slotPopupSerial) : null;

        function closePopup() {
          setActiveSlotPopup(null);
          setSlotPopupSerial("");
          setSlotPopupMode("number");
        }

        function handlePopupDone() {
          if (slotPopupMode === "serial" && parsed) {
            setSlotTicketInputs(prev => ({ ...prev, [sn]: String(parsed.ticketNum) }));
          }
          closePopup();
        }

        const isDoneEnabled = slotPopupMode === "number"
          ? (val !== "" && !isNaN(parseInt(val, 10)))
          : parsed !== null;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.55)" }}
            onClick={closePopup}
          >
            <div
              className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={cn("px-5 py-4", tier?.headerBg ?? "bg-muted/40")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={FOLD} className={cn(
                      "size-10 rounded-xl border flex items-center justify-center font-black text-sm shrink-0",
                      tier ? cn(tier.bg, tier.color, tier.border) : "bg-muted text-muted-foreground"
                    )}>
                      {tier?.label ?? `#${sn}`}
                    </div>
                    <div>
                      <p className="text-sm font-bold">Slot #{sn}</p>
                      {customName && <p className="text-xs text-muted-foreground">{customName}</p>}
                    </div>
                  </div>
                  <button onClick={closePopup} className="p-1.5 rounded-xl hover:bg-black/10 transition-colors">
                    <X className="size-4" />
                  </button>
                </div>
                {slot?.gameName && (
                  <p className="text-xs text-muted-foreground mt-2.5">
                    {slot.gameName}{slot.pack ? ` · Pack ${slot.pack}` : ""}
                  </p>
                )}
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-xl">
                  {([
                    { id: "number" as const, icon: Hash, label: "Ticket #" },
                    { id: "serial" as const, icon: Scan, label: "Serial Scan" },
                  ]).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setSlotPopupMode(id)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                        slotPopupMode === id
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>

                {slotPopupMode === "number" ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Starting Ticket #
                    </label>
                    <input
                      type="number"
                      min="0"
                      autoFocus
                      placeholder={slot?.ticketStart != null ? String(slot.ticketStart) : "e.g. 025"}
                      value={val}
                      onChange={e => {
                        setSlotTicketInputs(prev => ({ ...prev, [sn]: e.target.value }));
                        setClockInError("");
                      }}
                      className="w-full border rounded-xl px-4 py-3 text-2xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition font-mono font-black text-center"
                    />
                    {slot?.ticketStart != null && (
                      <p className="text-xs text-muted-foreground text-center">
                        Expected: <span className="font-mono font-semibold text-foreground">#{slot.ticketStart}</span>
                        {" "}— enter the first unsold ticket in this book
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ticket Serial Number
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="1069-0012055-094-0"
                      value={slotPopupSerial}
                      onChange={e => {
                        setSlotPopupSerial(e.target.value);
                        const p = parseTicketSerial(e.target.value);
                        if (p) setSlotTicketInputs(prev => ({ ...prev, [sn]: String(p.ticketNum) }));
                      }}
                      className="w-full border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: <span className="font-mono">GGGG-BBBBBBB-TTT-C</span>
                    </p>
                    {parsed && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                        <p className="font-semibold">Decoded successfully</p>
                        <p>Game ID: <span className="font-mono">{parsed.gameId}</span> · Book: <span className="font-mono">{parsed.bookNum}</span></p>
                        <p className="font-bold">Starting Ticket: <span className="font-mono text-sm">#{parsed.ticketNum}</span></p>
                      </div>
                    )}
                    {slotPopupSerial && !parsed && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="size-3.5 shrink-0" /> Enter the full serial to decode
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handlePopupDone}
                  disabled={!isDoneEnabled}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="size-4" /> Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Active shift timer pill ── */}
      {active && (
        <div className="px-4 pt-3 flex justify-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Shift in progress · {fmtDuration(elapsed)}
            {(active.shiftBooks?.length ?? 0) > 1 && (
              <span className="ml-1 text-emerald-600 opacity-70">· {active.shiftBooks!.length} slots</span>
            )}
          </div>
        </div>
      )}

      <main className={cn(
        "w-full px-4 flex-1 flex flex-col",
        clockStep === "slot_select" || clockStep === "active"
          ? "max-w-3xl mx-auto py-4"
          : "max-w-lg mx-auto py-8"
      )}>
        <div className="flex-1 flex flex-col">

            {/* ── IDLE ── */}
            {clockStep === "idle" && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
                <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-primary/5">
                  <Clock className="size-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold">Ready to clock in?</p>
                  <p className="text-base text-muted-foreground">
                    Hi {user?.name?.split(" ")[0] ?? "there"} — select your slots to begin your shift.
                  </p>
                </div>
                <button
                  onClick={() => { setShiftTypeModal(true); setClockInError(""); }}
                  className="w-full max-w-xs flex items-center justify-center gap-2.5 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity shadow-md"
                >
                  <Clock className="size-5" /> Clock In
                </button>
              </div>
            )}

            {/* ── SLOT SELECT (full-width) ── */}
            {clockStep === "slot_select" && (
              <div className="space-y-4">
                {/* Header — stays narrow */}
                <div className="max-w-lg mx-auto space-y-5">
                  <button
                    onClick={() => { setClockStep("idle"); setSelectedSlots([]); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="size-4" /> Back
                  </button>
                  <StepBar steps={["Select Slots", "Start Tickets", "Review"]} current={0} />
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div>
                      <p className="text-xl font-bold">Select Your Slots</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tap every slot you will operate this shift.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      {selectedSlots.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full border border-primary/20">
                          {selectedSlots.length} selected
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const allSelectable = slots
                            .filter(s => s.bookId && s.status !== "settled")
                            .map(s => s.slotNum);
                          setSelectedSlots(allSelectable);
                        }}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Select All
                      </button>
                    </div>
                  </div>

                  {clockInError && (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />{clockInError}
                    </div>
                  )}
                </div>

                {/* Slot grid — full width */}
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin" /> Loading slots…
                  </div>
                ) : (
                  <SlotSelectGrid
                    slots={slots}
                    slotNames={slotNames}
                    tierCounts={tierCounts}
                    selected={new Set(selectedSlots)}
                    onToggle={sn => setSelectedSlots(prev =>
                      prev.includes(sn) ? prev.filter(n => n !== sn) : [...prev, sn]
                    )}
                  />
                )}

                {/* Continue — stays narrow */}
                <div className="max-w-lg mx-auto">
                  <button
                    onClick={() => {
                      if (selectedSlots.length === 0) { setClockInError("Select at least one slot to continue."); return; }
                      setClockInError("");
                      setClockStep("slot_tickets");
                    }}
                    disabled={selectedSlots.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                  >
                    <ArrowRight className="size-4" />
                    Continue with {selectedSlots.length > 0
                      ? `${selectedSlots.length} slot${selectedSlots.length !== 1 ? "s" : ""}`
                      : "selected slots"}
                  </button>
                </div>
              </div>
            )}

            {/* ── SLOT TICKETS ── */}
            {clockStep === "slot_tickets" && (
              <div className="space-y-5">
                <div className="space-y-5">
                  <button onClick={() => { setClockStep("slot_select"); setClockInError(""); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="size-4" /> Back
                  </button>
                  <StepBar steps={["Select Slots", "Start Tickets", "Review"]} current={1} />
                  <div className="pt-1">
                    <p className="text-xl font-bold">Enter Starting Tickets</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tap each slot to enter the first unsold ticket number. You can type it directly or scan the serial.
                    </p>
                  </div>
                </div>

                {clockInError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />{clockInError}
                  </div>
                )}

                {/* Compact slot grid — tap to open popup */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[...selectedSlots].sort((a, b) => a - b).map(sn => {
                    const slot       = slots.find(s => s.slotNum === sn);
                    const tierIdx    = Math.floor((sn - 1) / MAX_PER_TIER);
                    const tier       = TIERS[tierIdx];
                    const val        = slotTicketInputs[sn] ?? "";
                    const isValid    = val !== "" && !isNaN(parseInt(val, 10));
                    const customName = slotNames[String(sn)] ?? "";

                    return (
                      <button
                        key={sn}
                        type="button"
                        onClick={() => {
                          setSlotPopupMode("number");
                          setSlotPopupSerial("");
                          setActiveSlotPopup(sn);
                        }}
                        className={cn(
                          "relative flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all hover:shadow-md active:scale-[0.98]",
                          isValid
                            ? cn("border-emerald-300", tier?.bg ?? "bg-background")
                            : "border-dashed border-muted-foreground/30 bg-background hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <span className={cn("text-xs font-black", tier?.color ?? "text-muted-foreground")}>
                            {tier?.label ?? `#${sn}`}
                          </span>
                          {isValid
                            ? <CheckCircle className="size-4 text-emerald-500" />
                            : <span className="text-[10px] text-muted-foreground/50 font-semibold">TAP</span>
                          }
                        </div>
                        <p className="text-xs font-bold leading-tight">
                          Slot #{sn}{customName ? <span className="font-normal text-muted-foreground"> · {customName}</span> : ""}
                        </p>
                        {slot?.gameName && (
                          <p className="text-[10px] text-muted-foreground truncate w-full mt-0.5">{slot.gameName}</p>
                        )}
                        <div className={cn(
                          "mt-2 w-full text-center text-xs rounded-lg py-1.5 font-mono font-bold transition-colors",
                          isValid
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-muted/60 text-muted-foreground"
                        )}>
                          {isValid ? `#${val}` : "Tap to enter"}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Progress indicator */}
                {selectedSlots.length > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    {selectedSlots.filter(sn => slotTicketInputs[sn]?.trim()).length} of {selectedSlots.length} slots entered
                  </p>
                )}

                <button
                  onClick={() => {
                    const allFilled = selectedSlots.every(sn => slotTicketInputs[sn]?.trim());
                    if (!allFilled) {
                      setClockInError("Please enter starting ticket numbers for all selected slots.");
                      return;
                    }
                    setClockInError("");
                    setClockStep("preview");
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 py-3.5 rounded-2xl font-semibold text-sm hover:bg-primary/20 transition-colors"
                >
                  <Eye className="size-4" /> Review & Confirm
                </button>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {clockStep === "preview" && (
              <div className="space-y-5">
                <div className="space-y-5">
                  <button onClick={() => { setClockStep("slot_tickets"); setClockInError(""); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="size-4" /> Back
                  </button>
                  <StepBar steps={["Select Slots", "Start Tickets", "Review"]} current={2} />
                  <div className="pt-1">
                    <p className="text-xl font-bold">Review & Start Shift</p>
                    <p className="text-sm text-muted-foreground mt-1">Confirm your slot assignments before clocking in.</p>
                  </div>
                </div>

                {clockInError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />{clockInError}
                  </div>
                )}

                <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-muted px-4 py-2.5">
                    <div className="grid grid-cols-4 text-xs font-semibold text-muted-foreground">
                      <span>Slot</span><span>Game</span><span>Start #</span><span className="text-right">Tier</span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {[...selectedSlots].sort((a, b) => a - b).map(sn => {
                      const slot    = slots.find(s => s.slotNum === sn);
                      const tierIdx = Math.floor((sn - 1) / MAX_PER_TIER);
                      const tier    = TIERS[tierIdx];
                      return (
                        <div key={sn} className="grid grid-cols-4 px-4 py-3 text-sm items-center hover:bg-muted/20 transition-colors">
                          <span className="font-bold">#{sn}</span>
                          <span className="text-xs truncate pr-1">{slot?.gameName ?? "—"}</span>
                          <span className="font-mono font-bold">#{slotTicketInputs[sn]}</span>
                          <span className={cn("text-right font-bold", tier?.color ?? "text-muted-foreground")}>
                            {tier?.label ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setClockStep("slot_tickets")}
                    className="flex-1 flex items-center justify-center gap-2 border rounded-2xl py-3 text-sm font-medium hover:bg-accent transition-colors">
                    <RotateCcw className="size-4" /> Edit
                  </button>
                  <button onClick={handleClockIn} disabled={submitting || selectedSlots.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm">
                    {submitting
                      ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      : <><Clock className="size-4" /> Start Shift</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ── ACTIVE SHIFT (full-width) ── */}
            {clockStep === "active" && active && (
              <div className="space-y-4">
                {/* Header — stays narrow */}
                <div className="max-w-lg mx-auto border-2 border-emerald-300/50 rounded-3xl p-5 bg-emerald-50/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-semibold text-emerald-800">Shift in progress</span>
                    </div>
                    <span className="font-mono text-xl font-black text-emerald-700 tabular-nums">
                      {fmtDuration(elapsed)}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-700/70">
                    Started at {fmtTime(active.clockIn)} · {fmtDate(active.clockIn)}
                  </p>

                  <div className="space-y-2">
                    {(active.shiftBooks?.length
                      ? active.shiftBooks
                      : [{ slotNum: active.slotNum, ticketStart: active.ticketStart, bookId: "", serial: "", gameName: active.gameName, price: active.bookPrice }]
                    ).sort((a, b) => a.slotNum - b.slotNum).map(sb => {
                      const tierIdx = Math.floor((sb.slotNum - 1) / MAX_PER_TIER);
                      const tier    = TIERS[tierIdx];
                      return (
                        <div key={sb.slotNum} className="bg-white/80 rounded-xl border border-emerald-100 px-3 py-2.5 flex items-center gap-3">
                          <div className={cn(
                            "size-8 rounded-lg border flex items-center justify-center text-[10px] font-black shrink-0",
                            tier ? cn(tier.bg, tier.color, tier.border) : "bg-muted text-muted-foreground"
                          )}>
                            {tier?.label ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{sb.gameName ?? `Slot #${sb.slotNum}`}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Slot #{sb.slotNum} · Starts at ticket #{sb.ticketStart}
                            </p>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-1.5 py-0.5 shrink-0">
                            Active
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Slot board — full width */}
                <div className="bg-card border rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="size-3.5" /> Current Slot Board
                  </p>
                  <ActiveSlotGrid
                    slots={slots}
                    slotNames={slotNames}
                    tierCounts={tierCounts}
                    activeSlots={activeBookSet}
                    onSoldOut={handleBookSoldOut}
                  />
                </div>

                {/* Clock out — stays narrow */}
                <div className="max-w-lg mx-auto">
                  <button
                    onClick={() => setClockStep("clockout_slots")}
                    className="w-full flex items-center justify-center gap-2 bg-destructive text-white py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <ArrowRight className="size-4" /> Clock Out
                  </button>
                </div>
              </div>
            )}

            {/* ── CLOCK OUT: End Tickets per Slot ── */}
            {clockStep === "clockout_slots" && active && (
              <div className="space-y-5">
                <div className="space-y-5">
                  <button onClick={() => setClockStep("active")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="size-4" /> Back
                  </button>
                  <StepBar steps={["End Tickets", "Sales", "Cashes", "Drawer"]} current={0} />
                  <div className="pt-1">
                    <p className="text-xl font-bold">Record Ending Tickets</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter the last ticket number you sold for each slot.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {shiftBooksForClockout.sort((a, b) => a.slotNum - b.slotNum).map(sb => {
                    const tierIdx    = Math.floor((sb.slotNum - 1) / MAX_PER_TIER);
                    const tier       = TIERS[tierIdx];
                    const val        = slotEndInputs[sb.slotNum] ?? "";
                    const endNum     = parseInt(val, 10);
                    const isValid    = val !== "" && !isNaN(endNum) && endNum > sb.ticketStart;
                    const sold       = isValid ? endNum - sb.ticketStart : null;
                    const saleAmt    = sold != null && sb.price ? sold * sb.price : null;
                    const customName = slotNames[String(sb.slotNum)] ?? "";
                    const hasInputErr = val !== "" && !isValid;

                    return (
                      <div key={sb.slotNum} className={cn("border rounded-2xl overflow-hidden shadow-sm", tier?.border ?? "border-border")}>
                        {/* Header */}
                        <div className={cn("px-4 py-3 flex items-center gap-3", tier?.headerBg ?? "bg-muted/40")}>
                          <div style={FOLD} className={cn(
                            "size-10 rounded-xl border flex items-center justify-center font-black text-sm shrink-0",
                            tier ? cn(tier.bg, tier.color, tier.border) : "bg-muted text-muted-foreground"
                          )}>
                            {tier?.label ?? `#${sb.slotNum}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold">
                              Slot #{sb.slotNum}{customName ? <span className="text-muted-foreground font-normal"> · {customName}</span> : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{sb.gameName ?? "—"}</p>
                          </div>
                          {isValid && sold != null && (
                            <div className="text-right shrink-0">
                              <p className={cn("text-sm font-black", tier?.color)}>{sold}</p>
                              <p className="text-[9px] text-muted-foreground">tickets</p>
                            </div>
                          )}
                        </div>

                        {/* Input area */}
                        <div className="px-4 py-3 space-y-2.5 bg-background">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Started at <span className="font-mono font-semibold text-foreground">#{sb.ticketStart}</span></span>
                            {sb.price != null && <span className="font-semibold">${sb.price} / ticket</span>}
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Ending Ticket #
                            </label>
                            <input
                              type="number"
                              min={sb.ticketStart + 1}
                              placeholder={`Greater than ${sb.ticketStart}`}
                              value={val}
                              onChange={e => setSlotEndInputs(prev => ({ ...prev, [sb.slotNum]: e.target.value }))}
                              className={cn(
                                "mt-1.5 w-full border rounded-xl px-4 py-3 text-base bg-background focus:outline-none focus:ring-2 transition font-mono font-bold",
                                hasInputErr
                                  ? "border-red-300 focus:ring-red-200"
                                  : isValid
                                  ? "border-emerald-300 focus:ring-emerald-200"
                                  : "focus:ring-primary/30"
                              )}
                            />
                          </div>

                          {hasInputErr && (
                            <p className="text-xs text-red-600">Must be greater than starting ticket #{sb.ticketStart}</p>
                          )}

                          {isValid && sold != null && (
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                              <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                              <div className="text-xs text-emerald-800">
                                <span className="font-bold">{sold} tickets sold</span>
                                {saleAmt != null && <span className="text-emerald-700"> · ${saleAmt.toFixed(2)}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setClockStep("clockout_receipt_sales")}
                  disabled={!canClockOut}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                >
                  Next: Upload Sales Receipt <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            {/* ── CLOCK OUT: Sales Receipt ── */}
            {clockStep === "clockout_receipt_sales" && (
              <div className="space-y-5">
                <button onClick={() => setClockStep("clockout_slots")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="size-4" /> Back
                </button>
                <StepBar steps={["End Tickets", "Sales", "Cashes", "Drawer"]} current={1} />
                <div className="pt-1">
                  <p className="text-xl font-bold">Upload Sales Receipt</p>
                  <p className="text-sm text-muted-foreground mt-1">Scan or photograph your sales receipt for today.</p>
                </div>

                {salesReceipt ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <CheckCircle className="size-4" /> Sales Receipt Scanned
                      </p>
                      <button onClick={() => setSalesReceipt(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Online Net:</span><span className="font-bold ml-1">${salesReceipt.onlineNetSales.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">Cashless Inst:</span><span className="font-bold ml-1">${salesReceipt.cashlessInstant.toFixed(2)}</span></div>
                    </div>
                  </div>
                ) : (
                  <ReceiptUploader
                    type="sales"
                    onSuccess={d => { setSalesReceipt(d as ReceiptData); }}
                    onSkip={() => setClockStep("clockout_receipt_cashes")}
                  />
                )}

                {salesReceipt && (
                  <button onClick={() => setClockStep("clockout_receipt_cashes")}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm">
                    Next: Upload Cashes Receipt <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            )}

            {/* ── CLOCK OUT: Cashes Receipt ── */}
            {clockStep === "clockout_receipt_cashes" && (
              <div className="space-y-5">
                <button onClick={() => setClockStep("clockout_receipt_sales")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="size-4" /> Back
                </button>
                <StepBar steps={["End Tickets", "Sales", "Cashes", "Drawer"]} current={2} />
                <div className="pt-1">
                  <p className="text-xl font-bold">Upload Cashes Receipt</p>
                  <p className="text-sm text-muted-foreground mt-1">Scan or photograph your cashes receipt for today.</p>
                </div>

                {cashesReceipt ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <CheckCircle className="size-4" /> Cashes Receipt Scanned
                      </p>
                      <button onClick={() => setCashesReceipt(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Total Cashes:</span>
                      <span className="font-bold ml-1">${cashesReceipt.totalCashes.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <ReceiptUploader
                    type="cashes"
                    onSuccess={d => { setCashesReceipt(d as CashesData); }}
                    onSkip={() => setClockStep("clockout_drawer")}
                  />
                )}

                {cashesReceipt && (
                  <button onClick={() => setClockStep("clockout_drawer")}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm">
                    Next: Cash Drawer <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            )}

            {/* ── CLOCK OUT: Cash Drawer ── */}
            {clockStep === "clockout_drawer" && active && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setClockStep("clockout_receipt_cashes")}
                      className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                    <div className="flex-1">
                      <StepBar steps={["End Tickets", "Sales", "Cashes", "Drawer"]} current={3} />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold">Cash Drawer Amount</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Count the drawer and enter the total before seeing the calculated amount.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">$</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={drawerCash}
                      onChange={e => setDrawerCash(e.target.value)}
                      className="w-full border-2 rounded-2xl pl-9 pr-4 py-4 text-2xl font-black bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition font-mono"
                    />
                  </div>
                </div>

                {/* Shift financial summary */}
                {drawerCash && (
                  <div className="border rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-muted/40 px-4 py-2.5 border-b">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shift Summary</p>
                    </div>
                    <div className="px-4 py-4 space-y-2.5">
                      {/* Per-slot ticket sales */}
                      {shiftBooksForClockout.sort((a, b) => a.slotNum - b.slotNum).map(sb => {
                        const end  = parseInt(slotEndInputs[sb.slotNum] ?? "", 10);
                        const sold = !isNaN(end) && end > sb.ticketStart ? end - sb.ticketStart : 0;
                        const amt  = sold * (sb.price ?? 0);
                        const tierIdx = Math.floor((sb.slotNum - 1) / MAX_PER_TIER);
                        const tier    = TIERS[tierIdx];
                        return (
                          <div key={sb.slotNum} className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span className={cn("text-[10px] font-bold", tier?.color)}>Slot #{sb.slotNum}</span>
                              {sb.price != null && <span className="text-[10px]">{tier?.label} × {sold}</span>}
                            </span>
                            <span className="font-mono font-medium">${amt.toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {(salesReceipt || cashesReceipt) && <div className="border-t" />}

                      {salesReceipt && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Online Net Sales</span>
                            <span className="font-mono font-medium">${salesReceipt.onlineNetSales.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cashless Instant</span>
                            <span className="font-mono font-medium">${salesReceipt.cashlessInstant.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {cashesReceipt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Cashes</span>
                          <span className="font-mono font-medium text-red-600">−${cashesReceipt.totalCashes.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="border-t pt-2.5 space-y-1.5">
                        <div className="flex justify-between font-bold text-sm">
                          <span>Calculated Total</span>
                          <span className="font-mono">${liveCalc.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm">
                          <span>Drawer Cash</span>
                          <span className="font-mono">${drawerNum.toFixed(2)}</span>
                        </div>
                        {drawerNum > 0 && (
                          <div className={cn(
                            "flex justify-between font-black text-base pt-1.5 border-t",
                            Math.abs(liveDiff) < 0.01
                              ? "text-emerald-600"
                              : liveDiff > 0
                              ? "text-red-600"
                              : "text-amber-600"
                          )}>
                            <span>
                              {Math.abs(liveDiff) < 0.01 ? "✓ Balanced" : liveDiff > 0 ? "⚠ Over by" : "△ Short by"}
                            </span>
                            {Math.abs(liveDiff) >= 0.01 && (
                              <span className="font-mono">${Math.abs(liveDiff).toFixed(2)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Discrepancy note — required when amounts don't match */}
                {needsNote && drawerCash && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="size-4" /> Discrepancy Note Required
                    </label>
                    <p className="text-xs text-muted-foreground">
                      There is a discrepancy between calculated and drawer amounts. Please explain — this note will be sent to your manager.
                    </p>
                    <textarea
                      rows={3} value={discrepNote}
                      onChange={e => setDiscrepNote(e.target.value)}
                      placeholder="Describe what happened during your shift…"
                      className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                    />
                  </div>
                )}

                {/* Day close toggle */}
                {drawerCash && (
                  <button
                    type="button"
                    onClick={() => setIsDayClose(v => !v)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left",
                      isDayClose
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-border bg-background hover:border-amber-200 hover:bg-amber-50/40"
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold">Day Close</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Last shift of the day? Toggle to mark as day close.</p>
                    </div>
                    <div className={cn(
                      "size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      isDayClose ? "bg-amber-500 border-amber-500" : "border-border"
                    )}>
                      {isDayClose && <Check className="size-3 text-white" />}
                    </div>
                  </button>
                )}

                <button
                  onClick={submitClockOut}
                  disabled={submitting || !drawerCash || (needsNote && !discrepNote.trim())}
                  className="w-full flex items-center justify-center gap-2 bg-destructive text-white py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
                >
                  {submitting
                    ? <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><ArrowRight className="size-4" /> Submit &amp; Clock Out{isDayClose ? " · Day Close" : ""}</>
                  }
                </button>
              </div>
            )}

        </div>

      </main>
    </div>
  );
}
