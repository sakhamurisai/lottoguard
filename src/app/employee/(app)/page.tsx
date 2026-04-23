"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock, CheckCircle, Ticket, TrendingUp,
  Camera, Keyboard, AlertTriangle, X,
  ArrowRight, BarChart2, LayoutGrid, Bell,
  Upload, Eye, RotateCcw, BookOpen,
  CheckSquare, Square, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BookInfo = { gameName: string; pack: string; price: number; status: string; ticketStart?: number; gameId?: string };

type ShiftStatus = "active" | "completed";
type Shift = {
  shiftId:    string;
  slotNum:    number;
  ticketStart: number;
  ticketEnd?:  number;
  clockIn:     string;
  clockOut?:   string;
  status:      ShiftStatus;
  sold?:       number;
  bookPrice?:  number;
  gameName?:   string;
  shiftBooks?: ScannedEntry[];
  finalCalc?:  number;
  drawerCash?: number;
  discrepancySeverity?: "none" | "over" | "short";
};

type SlotInfo = {
  slotNum: number;
  bookId:  string | null;
  gameName?: string;
  pack?:   string;
  price?:  number;
  ticketStart?: number;
};

type ScannedEntry = {
  serial:      string;
  ticketStart: number;
  slotNum:     number;
  bookId:      string;
  gameName?:   string;
  price?:      number;
};

type Tab = "shift" | "dashboard" | "alerts";

type AlertEntry = {
  id:        string;
  severity:  "error" | "warning" | "info";
  message:   string;
  timestamp: string;
};

type VerifyResult =
  | { valid: true;  slotNum: number; bookId: string; gameId: string; bookNum: string; gameName: string; price: number; ticketStart: number; status: string }
  | { valid: false; reason: "not_found" | "settled" | "no_slot" | "wrong_ticket"; message: string; slotNum?: number; bookId?: string; gameName?: string; price?: number; inventoryStart?: number; ticketStart?: number };

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
  | "start"
  | "scan_grid"
  | "scan_choose"
  | "scanning"
  | "preview"
  | "active"
  | "clockout_scan"
  | "clockout_receipt_sales"
  | "clockout_receipt_cashes"
  | "clockout_drawer"
  | "clockout_confirm";

// ─────────────────────────────────────────────────────────────────────────────
// Local-storage alerts
// ─────────────────────────────────────────────────────────────────────────────

const ALERTS_KEY = "lg_emp_alerts";

function loadAlerts(sub: string): AlertEntry[] {
  try {
    const raw = localStorage.getItem(`${ALERTS_KEY}_${sub}`);
    return raw ? (JSON.parse(raw) as AlertEntry[]) : [];
  } catch { return []; }
}

function saveAlerts(sub: string, alerts: AlertEntry[]) {
  try {
    localStorage.setItem(`${ALERTS_KEY}_${sub}`, JSON.stringify(alerts.slice(0, 50)));
  } catch { /* storage full */ }
}

function pushAlert(sub: string, severity: AlertEntry["severity"], message: string): AlertEntry[] {
  const existing = loadAlerts(sub);
  const entry: AlertEntry = { id: crypto.randomUUID(), severity, message, timestamp: new Date().toISOString() };
  const next = [entry, ...existing].slice(0, 50);
  saveAlerts(sub, next);
  return next;
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

function fmtDurationMs(ms: number) {
  const totalSecs = Math.round(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAlertTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function extractTicketNum(serial: string): number | null {
  const parts = serial.replace(/\s/g, "").split("-");
  if (parts.length === 4 && parts[2].length === 3) {
    const n = parseInt(parts[2], 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function parseScannedSerial(raw: string): string | null {
  const clean = raw.trim();
  if (/^\d{4}-\d{7}-\d{3}-\d$/.test(clean)) return clean;
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 15) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 11)}-${digits.slice(11, 14)}-${digits.slice(14)}`;
  }
  return null;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  return { mon, sun };
}

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];
const TIER_COLOR: Record<number, string> = {
   1: "bg-green-500",  2: "bg-teal-500",   5: "bg-blue-500",
  10: "bg-violet-500",20: "bg-purple-500", 30: "bg-pink-500", 50: "bg-rose-500",
};
const TIER_TEXT: Record<number, string> = {
   1: "text-green-700",  2: "text-teal-700",   5: "text-blue-700",
  10: "text-violet-700",20: "text-purple-700", 30: "text-pink-700", 50: "text-rose-700",
};

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
// Camera scanner component
// ─────────────────────────────────────────────────────────────────────────────

function LiveCameraScanner({ onDetect }: { onDetect: (serial: string) => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const [camError, setCamError] = useState("");

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let active  = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { BrowserMultiFormatReader, BrowserCodeReader } = await import("@zxing/browser");
        if (!active) return;
        const reader = new BrowserMultiFormatReader();
        cleanup = () => BrowserCodeReader.releaseAllStreams();
        await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } }, el,
          (result) => {
            if (!active || !result) return;
            const serial = parseScannedSerial(result.getText());
            if (serial) { active = false; onDetectRef.current(serial); }
          }
        );
      } catch (e) {
        if (active) setCamError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();
    return () => { active = false; cleanup?.(); };
  }, []);

  if (camError) return (
    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />{camError}
    </div>
  );

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="relative w-4/5 h-20 rounded-lg border-2 border-white/40 animate-pulse">
          <div className="absolute -top-px -left-px  w-5 h-5 border-t-[3px] border-l-[3px] border-primary rounded-tl" />
          <div className="absolute -top-px -right-px w-5 h-5 border-t-[3px] border-r-[3px] border-primary rounded-tr" />
          <div className="absolute -bottom-px -left-px  w-5 h-5 border-b-[3px] border-l-[3px] border-primary rounded-bl" />
          <div className="absolute -bottom-px -right-px w-5 h-5 border-b-[3px] border-r-[3px] border-primary rounded-br" />
        </div>
        <p className="absolute bottom-3 text-white/90 text-xs font-medium drop-shadow">Point at the barcode</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt uploader component
// ─────────────────────────────────────────────────────────────────────────────

type ReceiptUploaderProps = {
  type:       "sales" | "cashes";
  onSuccess:  (data: ReceiptData | CashesData) => void;
  onSkip:     () => void;
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

        const scanRes = await fetch("/api/receipt/scan-shift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, type }),
        });
        const scanData = await scanRes.json() as {
          unclear: boolean; reason?: string;
          valid: boolean; errors: string[]; data: Record<string, unknown>;
        };

        if (scanRes.ok && !scanData.unclear && (scanData.valid || scanData.errors.length === 0)) {
          setScanning(false);
          onSuccess(scanData.data as ReceiptData | CashesData);
          return;
        }
      } catch {
        // try next photo
      }
    }

    setErrors(["Could not read any of the uploaded receipts. Try taking clearer photos."]);
    setScanning(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Upload {label} Receipt</p>
        <p className="text-xs text-muted-foreground">
          Take photos or upload from your device (up to 10). The receipt must say &ldquo;{type === "sales" ? "SALES - TODAY" : "CASHES - TODAY"}&rdquo;.
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button" onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80 transition-colors"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {photos.length < 10 && (
            <button
              type="button" disabled={scanning}
              onClick={() => galleryRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
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

      {errors.length > 0 && (
        <div className="space-y-1.5">
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />{e}
            </div>
          ))}
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {photos.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={scanning}
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 border-2 rounded-xl py-3 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Camera className="size-4" /> Use Camera
          </button>
          <button type="button" disabled={scanning}
            onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-2 border-2 rounded-xl py-3 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50">
            <Upload className="size-4" /> Upload
          </button>
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
            onClick={handleScan}
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
// Live slot table
// ─────────────────────────────────────────────────────────────────────────────

function LiveSlotTable({ slots, scanned }: { slots: SlotInfo[]; scanned: ScannedEntry[] }) {
  const scannedSlots = new Set(scanned.map((s) => s.slotNum));
  const occupiedSlots = slots.filter((s) => s.bookId);
  if (occupiedSlots.length === 0) return null;

  return (
    <div className="border rounded-2xl overflow-hidden text-xs">
      <div className="grid grid-cols-4 bg-muted px-3 py-2 font-semibold text-muted-foreground">
        <span>Slot</span><span className="col-span-2">Book</span><span className="text-center">Status</span>
      </div>
      <div className="divide-y max-h-48 overflow-y-auto">
        {occupiedSlots.map((sl) => {
          const matched = scannedSlots.has(sl.slotNum);
          return (
            <div key={sl.slotNum} className={cn("grid grid-cols-4 px-3 py-2 items-center", matched && "bg-emerald-50/60")}>
              <span className="font-mono font-bold">#{sl.slotNum}</span>
              <span className="col-span-2 truncate text-muted-foreground">{sl.pack ?? sl.bookId?.slice(0, 8)}</span>
              <span className="text-center">
                {matched
                  ? <CheckSquare className="size-4 text-emerald-600 mx-auto" />
                  : <Square className="size-4 text-muted-foreground mx-auto" />
                }
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [shifts,   setShifts]   = useState<Shift[]>([]);
  const [active,   setActive]   = useState<Shift | null>(null);
  const [slots,    setSlots]    = useState<SlotInfo[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab,        setTab]        = useState<Tab>("shift");
  const [clockStep,  setClockStep]  = useState<ClockStep>("idle");
  const [scanMode,   setScanMode]   = useState<"choose" | "camera" | "manual">("choose");
  const [manualVal,  setManualVal]  = useState("");
  const [manualErr,  setManualErr]  = useState("");
  const [scanned,    setScanned]    = useState<ScannedEntry[]>([]);
  const [scanError,  setScanError]  = useState("");
  const [verifying,  setVerifying]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary,    setSummary]    = useState<{ finalCalc: number; drawerCash: number; discrepancySeverity: string; diff: number } | null>(null);

  // Clock-out state
  const [endTicket,      setEndTicket]      = useState("");
  const [salesReceipt,   setSalesReceipt]   = useState<ReceiptData | null>(null);
  const [cashesReceipt,  setCashesReceipt]  = useState<CashesData | null>(null);
  const [drawerCash,     setDrawerCash]     = useState("");
  const [discrepNote,    setDiscrepNote]    = useState("");

  // Alerts
  const [alerts,     setAlerts]     = useState<AlertEntry[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const elapsed = useElapsed(active?.clockIn ?? null);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadSlots = useCallback(async () => {
    const r = await fetch("/api/employee/slots");
    if (r.ok) {
      const data = await r.json() as {
        slotMap: Record<number, string | null>;
        bookMap: Record<string, { gameName: string; pack: string; price: number; status: string }>;
      };
      const list: SlotInfo[] = Object.entries(data.slotMap).map(([n, bookId]) => {
        const bk = bookId ? data.bookMap[bookId] : undefined;
        return { slotNum: Number(n), bookId, gameName: bk?.gameName, pack: bk?.pack, price: bk?.price };
      });
      setSlots(list.sort((a, b) => a.slotNum - b.slotNum));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shifts");
    if (res.ok) {
      const data = await res.json() as { shifts: Shift[]; active: Shift | null };
      setShifts(data.shifts.filter((s) => s.status === "completed"));
      setActive(data.active);
      if (data.active) setClockStep("active");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadSlots(); }, [load, loadSlots]);

  // Load alerts from localStorage
  useEffect(() => {
    if (!user?.id) return;
    const stored = loadAlerts(user.id);
    setAlerts(stored);
    setUnreadAlerts(stored.filter((a) => a.severity === "error").length);
  }, [user?.id]);

  useEffect(() => { if (active) setClockStep("active"); }, [active]);

  // ── Push alert helper ─────────────────────────────────────────────────────

  function addAlert(severity: AlertEntry["severity"], message: string) {
    if (!user?.id) return;
    const next = pushAlert(user.id, severity, message);
    setAlerts(next);
    if (severity === "error") setUnreadAlerts((p) => p + 1);
  }

  // ── Clock In ──────────────────────────────────────────────────────────────

  async function addScannedEntry(serial: string) {
    setScanError("");

    if (scanned.some((s) => s.serial === serial)) {
      setScanError("This ticket is already in the list."); return;
    }

    setVerifying(true);
    try {
      const res  = await fetch(`/api/employee/verify-ticket?serial=${encodeURIComponent(serial)}`);
      const data = await res.json() as VerifyResult;

      if (!data.valid) {
        // "no_slot" is non-blocking — show warning but still allow adding
        if (data.reason === "no_slot") {
          const ticketNum = extractTicketNum(serial) ?? 0;
          setScanned((prev) => [...prev, {
            serial,
            ticketStart: ticketNum,
            slotNum:     0,
            bookId:      data.bookId ?? "",
            gameName:    data.gameName,
            price:       data.price,
          }]);
          setScanError(`⚠ ${data.message}`);
        } else {
          // Hard block: not found, settled, wrong ticket
          setScanError(data.message);
          addAlert("error", data.message);
        }
        setVerifying(false);
        return;
      }

      setScanned((prev) => [...prev, {
        serial,
        ticketStart: data.ticketStart,
        slotNum:     data.slotNum,
        bookId:      data.bookId,
        gameName:    data.gameName,
        price:       data.price,
      }]);
      setScanMode("choose");
      setManualVal("");
    } catch {
      setScanError("Network error verifying ticket. Check your connection.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleClockIn() {
    if (scanned.length === 0) return;
    setSubmitting(true);
    setScanError("");
    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:  "clock_in",
        entries: scanned.map((s) => ({ serial: s.serial, slotNum: s.slotNum || undefined })),
      }),
    });
    const data = await r.json() as { shift?: Shift & { shiftBooks?: ScannedEntry[] }; error?: string };
    if (r.ok && data.shift) {
      setActive(data.shift as Shift);
      setClockStep("active");
      setScanned([]);
      addAlert("info", `Shift started — ${scanned.length} book(s) registered.`);
    } else {
      const msg = data.error ?? "Failed to clock in.";
      setScanError(msg);
      addAlert("error", msg);
    }
    setSubmitting(false);
  }

  // ── Clock Out ─────────────────────────────────────────────────────────────

  async function submitClockOut() {
    if (!active || !endTicket || !drawerCash) return;
    setSubmitting(true);
    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:      "clock_out",
        shiftId:     active.shiftId,
        ticketEnd:   Number(endTicket),
        drawerCash:  Number(drawerCash),
        discrepancyNote: discrepNote || undefined,
        salesReceipt:  salesReceipt  ?? undefined,
        cashesReceipt: cashesReceipt ?? undefined,
      }),
    });
    const data = await r.json() as {
      message?: string; error?: string;
      finalCalc: number; drawerCash: number;
      discrepancySeverity: string; diff: number;
    };
    if (r.ok) {
      setSummary({ finalCalc: data.finalCalc, drawerCash: data.drawerCash, discrepancySeverity: data.discrepancySeverity, diff: data.diff });
      setActive(null);
      setClockStep("idle");
      setShifts((prev) => [{
        ...active,
        ticketEnd: Number(endTicket),
        clockOut:  new Date().toISOString(),
        status:    "completed",
        sold:      Math.max(0, Number(endTicket) - active.ticketStart),
        finalCalc: data.finalCalc,
        drawerCash: data.drawerCash,
        discrepancySeverity: data.discrepancySeverity as Shift["discrepancySeverity"],
      }, ...prev]);
      resetClockOut();
    } else {
      addAlert("error", data.error ?? "Clock out failed.");
    }
    setSubmitting(false);
  }

  function resetClockOut() {
    setEndTicket(""); setSalesReceipt(null); setCashesReceipt(null);
    setDrawerCash(""); setDiscrepNote("");
  }

  // ── Book sold out (mid-shift) ─────────────────────────────────────────────

  async function handleBookSoldOut(slotNum: number, bookId: string) {
    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "book_sold_out", bookId, slotNum }),
    });
    if (r.ok) {
      addAlert("info", `Slot #${slotNum} — book marked as sold out. Manager notified.`);
      await loadSlots();
    } else {
      const d = await r.json() as { error?: string };
      addAlert("error", d.error ?? "Failed to mark book sold out.");
    }
  }

  // ── Dashboard metrics ─────────────────────────────────────────────────────

  const completed = shifts;
  const totalSold = completed.reduce((s, sh) => s + (sh.sold ?? 0), 0);
  const totalMs   = completed.reduce((s, sh) => {
    if (!sh.clockOut) return s;
    return s + (new Date(sh.clockOut).getTime() - new Date(sh.clockIn).getTime());
  }, 0);
  const avgPerShift = completed.length > 0 ? Math.round(totalSold / completed.length) : 0;

  // Tickets by price tier
  const soldByTier: Record<number, number> = {};
  for (const sh of completed) {
    const price = sh.bookPrice ?? 0;
    if (price > 0) soldByTier[price] = (soldByTier[price] ?? 0) + (sh.sold ?? 0);
  }
  const maxTierSold = Math.max(1, ...Object.values(soldByTier));

  // Hours this week
  const { mon, sun } = getWeekRange();
  const weekMs = completed.reduce((s, sh) => {
    if (!sh.clockOut) return s;
    const ci = new Date(sh.clockIn);
    if (ci < mon || ci > sun) return s;
    return s + (new Date(sh.clockOut).getTime() - ci.getTime());
  }, 0);

  // ── Render helpers ────────────────────────────────────────────────────────

  const canClockOut = !!endTicket && Number(endTicket) > (active?.ticketStart ?? 0);
  const isOver  = summary?.discrepancySeverity === "over";
  const isShort = summary?.discrepancySeverity === "short";

  // Final calc preview (before submit)
  const liveCalc = (() => {
    const ticketSale = active && endTicket
      ? Math.max(0, Number(endTicket) - active.ticketStart) * (active.bookPrice ?? 0)
      : 0;
    const onlineNet    = salesReceipt?.onlineNetSales  ?? 0;
    const cashlessInst = salesReceipt?.cashlessInstant ?? 0;
    const totalCashes  = cashesReceipt?.totalCashes    ?? 0;
    return ticketSale + onlineNet + cashlessInst - totalCashes;
  })();

  const drawerNum    = Number(drawerCash) || 0;
  const liveDiff     = liveCalc - drawerNum;
  const needsNote    = liveDiff > 0.01;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* Shift complete summary modal */}
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
                  {isOver ? `$${Math.abs(summary.diff).toFixed(2)} over drawer` : `Drawer $${Math.abs(summary.diff).toFixed(2)} over calculated`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { label: "Calculated", value: `$${summary.finalCalc.toFixed(2)}` },
                { label: "Drawer",     value: `$${summary.drawerCash.toFixed(2)}` },
              ].map((s) => (
                <div key={s.label} className="border rounded-2xl py-3">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setSummary(null); setTab("dashboard"); }}
              className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity">
              View Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Active shift timer pill */}
      {active && (
        <div className="px-4 pt-3 flex justify-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Shift in progress · {fmtDuration(elapsed)}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b px-4 mt-1">
        <div className="flex max-w-lg mx-auto gap-0">
          {([
            { id: "shift",     label: active ? "My Shift" : "Clock In/Out", icon: Clock    },
            { id: "dashboard", label: "Dashboard",                           icon: BarChart2 },
            { id: "alerts",    label: "Alerts",                              icon: Bell,     badge: unreadAlerts },
          ] as { id: Tab; label: string; icon: React.ElementType; badge?: number }[]).map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => { setTab(id); if (id === "alerts") setUnreadAlerts(0); }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
              {id === "shift" && active && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              {badge != null && badge > 0 && (
                <span className="absolute -top-0.5 right-1 size-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto w-full px-4 py-6 space-y-5">

        {/* ══════════════════════════════════════════════════════════════════
            DASHBOARD TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Tickets Sold",    value: totalSold.toLocaleString(),  icon: Ticket,     color: "text-primary"     },
                { label: "Shifts Worked",   value: String(completed.length),    icon: Clock,      color: "text-violet-600"  },
                { label: "Hours This Week", value: fmtDurationMs(weekMs),       icon: TrendingUp, color: "text-emerald-600" },
                { label: "Avg per Shift",   value: String(avgPerShift),         icon: LayoutGrid, color: "text-blue-600"    },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="border rounded-2xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <Icon className={cn("size-4", color)} />
                  </div>
                  <p className="text-3xl font-black tracking-tight">{value}</p>
                </div>
              ))}
            </div>

            {/* Tickets by price tier */}
            <div className="border rounded-2xl p-5 space-y-3 shadow-sm">
              <p className="text-sm font-semibold">Tickets Sold by Category</p>
              {PRICE_TIERS.filter((t) => (soldByTier[t] ?? 0) > 0).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No completed shifts yet.</p>
              ) : (
                PRICE_TIERS.map((price) => {
                  const sold = soldByTier[price] ?? 0;
                  if (!sold) return null;
                  const pct = Math.round((sold / maxTierSold) * 100);
                  return (
                    <div key={price} className="flex items-center gap-3">
                      <span className={cn("text-xs font-bold w-8 shrink-0", TIER_TEXT[price])}>
                        ${price}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", TIER_COLOR[price])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-12 text-right">{sold.toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Shift history */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" />Shift History
              </h2>
              <div className="border rounded-2xl divide-y overflow-hidden shadow-sm">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse w-28" />
                        <div className="h-3 bg-muted rounded animate-pulse w-20" />
                      </div>
                      <div className="h-4 bg-muted rounded animate-pulse w-16" />
                    </div>
                  ))
                ) : completed.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground">No completed shifts yet.</p>
                ) : (
                  completed.map((s) => {
                    const durationMs = s.clockOut
                      ? new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime() : 0;
                    return (
                      <div key={s.shiftId} className="px-4 py-4 hover:bg-muted/20 transition-colors space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{fmtDate(s.clockIn)}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtTime(s.clockIn)}{s.clockOut ? ` – ${fmtTime(s.clockOut)}` : ""}
                              {" · Slot "}{s.slotNum}
                              {durationMs > 0 && ` · ${fmtDurationMs(durationMs)}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-primary">{s.sold ?? 0} sold</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              #{s.ticketStart}→#{s.ticketEnd ?? "?"}
                            </p>
                          </div>
                        </div>
                        {s.finalCalc != null && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Final:</span>
                            <span className="font-semibold">${s.finalCalc.toFixed(2)}</span>
                            {s.discrepancySeverity === "over"  && <span className="text-red-600 font-medium">⚠ Over</span>}
                            {s.discrepancySeverity === "short" && <span className="text-amber-600 font-medium">△ Short</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SHIFT / CLOCK TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "shift" && (
          <>
            {/* ── IDLE: big Clock In button ── */}
            {clockStep === "idle" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
                <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="size-10 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-lg font-bold">Ready to start your shift?</p>
                  <p className="text-sm text-muted-foreground">
                    Hi {user?.name?.split(" ")[0] ?? "there"} — tap below to begin.
                  </p>
                </div>
                <button
                  onClick={() => setClockStep("start")}
                  className="w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Clock className="size-5" />Clock In
                </button>
              </div>
            )}

            {/* ── START: show ticket entry prompt + Start button ── */}
            {clockStep === "start" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
                <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ticket className="size-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-bold">Enter your starting ticket</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Scan or manually enter the serial number of the first ticket in each book you're working with.
                  </p>
                </div>
                <button
                  onClick={() => { setClockStep("scan_choose"); setScanMode("choose"); }}
                  className="w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base hover:opacity-90 transition-opacity shadow-sm"
                >
                  <ArrowRight className="size-5" />Start
                </button>
                <button onClick={() => setClockStep("idle")}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                  ← Back
                </button>
              </div>
            )}

            {/* ── SCAN CHOOSE + SCANNING ── */}
            {(clockStep === "scan_choose" || clockStep === "scanning") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setClockStep("start"); setScanned([]); setScanError(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                  <p className="text-sm font-semibold flex-1">Scan Starting Tickets</p>
                  {scanned.length > 0 && (
                    <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                      {scanned.length} scanned
                    </span>
                  )}
                </div>

                {/* Verifying spinner */}
                {verifying && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary font-medium">
                    <RefreshCw className="size-4 animate-spin shrink-0" />
                    Checking with manager&apos;s allocation…
                  </div>
                )}

                {!verifying && scanError && (
                  <div className={cn(
                    "flex items-start gap-2 text-sm rounded-xl px-4 py-3 border",
                    scanError.startsWith("⚠")
                      ? "text-amber-800 bg-amber-50 border-amber-200"
                      : "text-destructive bg-destructive/8 border-destructive/15"
                  )}>
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    {scanError.replace(/^⚠\s*/, "")}
                  </div>
                )}

                {/* Scan mode chooser */}
                {!verifying && scanMode === "choose" && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setScanMode("camera"); setClockStep("scanning"); }}
                      className="flex flex-col items-center gap-3 border-2 rounded-2xl p-5 hover:border-primary hover:bg-primary/5 transition-all group">
                      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Camera className="size-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">Scan Barcode</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Live camera</p>
                      </div>
                    </button>
                    <button onClick={() => { setScanMode("manual"); setClockStep("scanning"); }}
                      className="flex flex-col items-center gap-3 border-2 rounded-2xl p-5 hover:border-primary hover:bg-primary/5 transition-all group">
                      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Keyboard className="size-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">Enter Manually</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Type the number</p>
                      </div>
                    </button>
                  </div>
                )}

                {!verifying && scanMode === "camera" && (
                  <div className="space-y-3">
                    <LiveCameraScanner onDetect={(s) => { addScannedEntry(s); }} />
                    <button onClick={() => setScanMode("manual")}
                      className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
                      Enter manually instead
                    </button>
                  </div>
                )}

                {!verifying && scanMode === "manual" && (
                  <div className="space-y-3">
                    <input type="text" placeholder="1008-0160737-025-9" value={manualVal}
                      onChange={(e) => { setManualVal(e.target.value); setManualErr(""); setScanError(""); }}
                      className="w-full border rounded-xl px-4 py-3 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
                    <p className="text-xs text-muted-foreground">Format: GGGG-BBBBBBB-TTT-C</p>
                    {manualErr && <p className="text-xs text-destructive">{manualErr}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setScanMode("choose"); setScanError(""); }}
                        className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const s = parseScannedSerial(manualVal);
                          if (!s) { setManualErr("Check format: GGGG-BBBBBBB-TTT-C"); return; }
                          addScannedEntry(s);
                        }}
                        disabled={!manualVal}
                        className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                        Verify &amp; Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Live slot table — shows manager's allocations with match status */}
                {slots.filter((s) => s.bookId).length > 0 && (
                  <LiveSlotTable slots={slots} scanned={scanned} />
                )}

                {/* Verified scanned list */}
                {scanned.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Verified tickets ({scanned.length})
                    </p>
                    {scanned.map((s, i) => (
                      <div key={i} className={cn(
                        "flex items-center justify-between px-3 py-2.5 border rounded-xl",
                        s.slotNum ? "bg-emerald-50/50 border-emerald-200/60" : "bg-amber-50/50 border-amber-200/60"
                      )}>
                        <div className="flex items-start gap-2.5 min-w-0">
                          {s.slotNum
                            ? <CheckCircle className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                            : <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                          }
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold">{s.serial}</p>
                            <p className="text-xs text-muted-foreground">
                              Ticket #{s.ticketStart}
                              {s.slotNum
                                ? <span className="text-emerald-700 font-medium"> · Slot #{s.slotNum} ✓</span>
                                : <span className="text-amber-600"> · No slot (auto-assign at start)</span>
                              }
                              {s.gameName ? ` · ${s.gameName}` : ""}
                              {s.price ? ` · $${s.price}` : ""}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => { setScanned((prev) => prev.filter((_, idx) => idx !== i)); setScanError(""); }}
                          className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {scanned.length > 0 && !verifying && (
                  <button onClick={() => { setClockStep("preview"); setScanError(""); }}
                    className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 py-3 rounded-2xl text-sm font-semibold hover:bg-primary/20 transition-colors">
                    <Eye className="size-4" />I&apos;m Done — Preview ({scanned.length} book{scanned.length > 1 ? "s" : ""})
                  </button>
                )}
              </div>
            )}

            {/* ── PREVIEW ── */}
            {clockStep === "preview" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setClockStep("scan_choose")} className="text-xs text-muted-foreground hover:text-foreground">← Edit</button>
                  <p className="text-sm font-semibold flex-1">Preview & Confirm</p>
                </div>

                {scanError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />{scanError}
                  </div>
                )}

                <div className="border rounded-2xl divide-y overflow-hidden">
                  <div className="grid grid-cols-4 bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                    <span>Slot</span><span>Book</span><span>Ticket</span><span className="text-right">Price</span>
                  </div>
                  {scanned.map((s, i) => (
                    <div key={i} className="grid grid-cols-4 px-4 py-3 text-sm items-center">
                      <span className="font-bold">{s.slotNum || "Auto"}</span>
                      <span className="font-mono text-xs truncate">{s.serial.split("-")[1]}</span>
                      <span className="font-mono">#{s.ticketStart}</span>
                      <span className="text-right text-muted-foreground">{s.price ? `$${s.price}` : "—"}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setClockStep("scan_choose"); setScanMode("choose"); }}
                    className="flex-1 flex items-center justify-center gap-2 border rounded-2xl py-3 text-sm font-medium hover:bg-accent transition-colors">
                    <RotateCcw className="size-4" />Rescan
                  </button>
                  <button onClick={handleClockIn} disabled={submitting || scanned.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm">
                    {submitting
                      ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      : <><Clock className="size-4" />Save & Start Shift</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ── ACTIVE SHIFT ── */}
            {clockStep === "active" && active && (
              <div className="space-y-4">
                {/* Active shift card */}
                <div className="border-2 border-emerald-300/50 rounded-3xl p-5 bg-emerald-50/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-semibold text-emerald-800">Shift in progress</span>
                    </div>
                    <span className="font-mono text-xl font-black text-emerald-700 tabular-nums">
                      {fmtDuration(elapsed)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: "Slot",  value: `#${active.slotNum}`     },
                      { label: "Start", value: `#${active.ticketStart}` },
                      { label: "Since", value: fmtTime(active.clockIn)  },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/80 rounded-xl py-2.5 px-2 border border-emerald-100">
                        <p className="text-sm font-bold">{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mid-shift slot updates */}
                {slots.some((s) => s.bookId) && (
                  <div className="border rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <BookOpen className="size-3.5" />Active Slots — Mark Book Sold Out
                    </p>
                    <div className="divide-y rounded-xl border overflow-hidden">
                      {slots.filter((s) => s.bookId).map((sl) => (
                        <div key={sl.slotNum} className="flex items-center justify-between px-3 py-2.5 text-sm">
                          <div>
                            <span className="font-bold">Slot #{sl.slotNum}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{sl.pack ?? sl.bookId?.slice(0, 8)}</span>
                          </div>
                          <button
                            onClick={() => handleBookSoldOut(sl.slotNum, sl.bookId!)}
                            className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors font-medium">
                            Sold Out
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clock out button */}
                <button
                  onClick={() => setClockStep("clockout_scan")}
                  className="w-full flex items-center justify-center gap-2 bg-destructive text-white py-3.5 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
                  <ArrowRight className="size-4" />Clock Out
                </button>
              </div>
            )}

            {/* ── CLOCK OUT: End Ticket Scan ── */}
            {clockStep === "clockout_scan" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setClockStep("active")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                  <p className="text-sm font-semibold">Enter Ending Ticket</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ending Ticket Number</label>
                  <div className="flex gap-2">
                    <input type="number" required min={active?.ticketStart ?? 0}
                      placeholder="e.g. 057" value={endTicket}
                      onChange={(e) => setEndTicket(e.target.value)}
                      className="flex-1 border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
                    <button type="button" onClick={() => { setScanMode("camera"); }}
                      className="px-3.5 py-2.5 border rounded-xl hover:bg-muted transition-colors">
                      <Camera className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                  {endTicket && active && Number(endTicket) > active.ticketStart && (
                    <p className="text-sm font-bold text-emerald-600">
                      {Number(endTicket) - active.ticketStart} tickets will be recorded as sold.
                    </p>
                  )}
                  {endTicket && active && Number(endTicket) <= active.ticketStart && (
                    <p className="text-xs text-amber-600">Must be greater than start #{active.ticketStart}.</p>
                  )}
                </div>

                {/* Mid-shift sold-out marks */}
                {slots.filter((s) => s.bookId).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Mark any books sold out during shift</p>
                    {slots.filter((s) => s.bookId).map((sl) => (
                      <div key={sl.slotNum} className="flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm">
                        <span>Slot #{sl.slotNum} · <span className="font-mono text-xs text-muted-foreground">{sl.pack ?? sl.bookId?.slice(0, 8)}</span></span>
                        <button onClick={() => handleBookSoldOut(sl.slotNum, sl.bookId!)}
                          className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors font-medium">
                          Sold Out
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => setClockStep("clockout_receipt_sales")} disabled={!canClockOut}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm">
                  Next: Upload Sales Receipt <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            {/* ── CLOCK OUT: Sales Today Receipt ── */}
            {clockStep === "clockout_receipt_sales" && (
              <div className="space-y-4">
                <button onClick={() => setClockStep("clockout_scan")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                {salesReceipt ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <CheckCircle className="size-4" />Sales Receipt Scanned
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
                    onSuccess={(d) => { setSalesReceipt(d as ReceiptData); }}
                    onSkip={() => setClockStep("clockout_receipt_cashes")}
                  />
                )}
                {salesReceipt && (
                  <button onClick={() => setClockStep("clockout_receipt_cashes")}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
                    Next: Upload Cashes Receipt <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            )}

            {/* ── CLOCK OUT: Cashes Today Receipt ── */}
            {clockStep === "clockout_receipt_cashes" && (
              <div className="space-y-4">
                <button onClick={() => setClockStep("clockout_receipt_sales")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                {cashesReceipt ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <CheckCircle className="size-4" />Cashes Receipt Scanned
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
                    onSuccess={(d) => { setCashesReceipt(d as CashesData); }}
                    onSkip={() => setClockStep("clockout_drawer")}
                  />
                )}
                {cashesReceipt && (
                  <button onClick={() => setClockStep("clockout_drawer")}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
                    Next: Cash Drawer <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            )}

            {/* ── CLOCK OUT: Cash Drawer Entry ── */}
            {clockStep === "clockout_drawer" && active && (
              <div className="space-y-5">
                <button onClick={() => setClockStep("clockout_receipt_cashes")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>

                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Cash Drawer Amount</p>
                  <p className="text-xs text-muted-foreground">Count and enter the total cash in the drawer before seeing the calculated amount.</p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={drawerCash}
                      onChange={(e) => setDrawerCash(e.target.value)}
                      className="w-full border rounded-xl pl-7 pr-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition font-mono text-lg"
                    />
                  </div>
                </div>

                {drawerCash && (
                  <div className="p-4 border rounded-2xl space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground">Shift Summary</p>
                    <div className="space-y-1.5 text-sm">
                      {[
                        { label: "Ticket Sales", value: `$${(Math.max(0, Number(endTicket) - (active.ticketStart)) * (active.bookPrice ?? 0)).toFixed(2)}` },
                        { label: "Online Net",   value: `$${(salesReceipt?.onlineNetSales ?? 0).toFixed(2)}` },
                        { label: "Cashless Inst",value: `$${(salesReceipt?.cashlessInstant ?? 0).toFixed(2)}` },
                        { label: "Total Cashes", value: `−$${(cashesReceipt?.totalCashes ?? 0).toFixed(2)}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono font-medium">{value}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Calculated Total</span>
                        <span className="font-mono">${liveCalc.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Drawer Cash</span>
                        <span className="font-mono">${drawerNum.toFixed(2)}</span>
                      </div>
                      {drawerNum > 0 && (
                        <div className={cn("flex justify-between font-bold text-base pt-1 border-t",
                          Math.abs(liveDiff) < 0.01 ? "text-emerald-600" : liveDiff > 0 ? "text-red-600" : "text-amber-600")}>
                          <span>{Math.abs(liveDiff) < 0.01 ? "✓ Balanced" : liveDiff > 0 ? "⚠ Over by" : "△ Short by"}</span>
                          {Math.abs(liveDiff) >= 0.01 && <span className="font-mono">${Math.abs(liveDiff).toFixed(2)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {needsNote && drawerCash && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-red-700">
                      Discrepancy Note (required)
                    </label>
                    <p className="text-xs text-muted-foreground">Please explain the discrepancy. This note will be sent to the manager.</p>
                    <textarea
                      rows={3} value={discrepNote}
                      onChange={(e) => setDiscrepNote(e.target.value)}
                      placeholder="Describe what happened during your shift..."
                      className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                    />
                  </div>
                )}

                <button
                  onClick={submitClockOut}
                  disabled={submitting || !drawerCash || (needsNote && !discrepNote.trim())}
                  className="w-full flex items-center justify-center gap-2 bg-destructive text-white py-3.5 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
                  {submitting
                    ? <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><ArrowRight className="size-4" />Clock Out & Submit</>
                  }
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ALERTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "alerts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Alerts & Notifications</h2>
              {alerts.length > 0 && (
                <button
                  onClick={() => {
                    if (!user?.id) return;
                    saveAlerts(user.id, []);
                    setAlerts([]);
                    setUnreadAlerts(0);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="size-14 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No alerts yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
                      a.severity === "error"   && "bg-red-50 border-red-200 text-red-800",
                      a.severity === "warning" && "bg-amber-50 border-amber-200 text-amber-800",
                      a.severity === "info"    && "bg-blue-50 border-blue-200 text-blue-800",
                    )}
                  >
                    <AlertTriangle className={cn(
                      "size-4 shrink-0 mt-0.5",
                      a.severity === "error"   && "text-red-500",
                      a.severity === "warning" && "text-amber-500",
                      a.severity === "info"    && "text-blue-500",
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{a.message}</p>
                      <p className="text-xs opacity-60 mt-1">{fmtAlertTime(a.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = alerts.filter((x) => x.id !== a.id);
                        setAlerts(next);
                        if (user?.id) saveAlerts(user.id, next);
                      }}
                      className="shrink-0 opacity-40 hover:opacity-80 transition-opacity">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
