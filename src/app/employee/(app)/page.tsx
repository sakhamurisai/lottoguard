"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Clock, ArrowRight, CheckCircle,
  Ticket, SignOut, TrendUp, Camera, Keyboard,
  Spinner, Warning, X,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type ShiftStatus = "active" | "completed";
type Shift = {
  shiftId: string; slotNum: number; ticketStart: number; ticketEnd?: number;
  clockIn: string; clockOut?: string; status: ShiftStatus; sold?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// Extract the 3-digit ticket number from a serial number NNNN-NNNNNNN-NNN-N
function extractTicketNum(serial: string): number | null {
  const parts = serial.replace(/\s/g, "").split("-");
  if (parts.length === 4 && parts[2].length === 3) {
    const n = parseInt(parts[2], 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

// ── Serial scan modal ─────────────────────────────────────────────────────────

type ScanMode  = "choose" | "camera" | "manual";
type ScanState = "idle" | "uploading" | "scanning" | "done" | "error";

interface SerialScanModalProps {
  label: string;   // "Starting" | "Ending"
  onConfirm: (ticketNum: number, serial: string) => void;
  onClose: () => void;
}

function SerialScanModal({ label, onConfirm, onClose }: SerialScanModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode,        setMode]        = useState<ScanMode>("choose");
  const [scanState,   setScanState]   = useState<ScanState>("idle");
  const [serial,      setSerial]      = useState("");
  const [scannedInfo, setScannedInfo] = useState<{ serial: string; confidence: string } | null>(null);
  const [scanError,   setScanError]   = useState("");
  const [manualVal,   setManualVal]   = useState("");

  async function handleFile(file: File) {
    setScanState("uploading");
    setScanError("");
    try {
      // 1. Get presigned URL for employee
      const presignRes = await fetch("/api/upload/employee-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { url, key } = await presignRes.json() as { url: string; key: string };

      // 2. Upload to S3
      const up = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!up.ok) throw new Error("Upload failed");

      // 3. Scan for serial
      setScanState("scanning");
      const scanRes = await fetch("/api/receipt/scan-serial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!scanRes.ok) throw new Error("Could not read ticket");
      const { data } = await scanRes.json() as { data: { serialNumber: string | null; confidence: string; reason?: string } };

      if (!data.serialNumber) {
        setScanError(data.reason ?? "Could not detect a serial number. Please try a clearer photo.");
        setScanState("error");
        return;
      }

      setScannedInfo({ serial: data.serialNumber, confidence: data.confidence });
      setSerial(data.serialNumber);
      setScanState("done");
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Unexpected error");
      setScanState("error");
    }
  }

  function confirmSerial(s: string) {
    const n = extractTicketNum(s);
    if (n === null) { setScanError("Could not extract ticket number from serial. Please enter manually."); return; }
    onConfirm(n, s);
  }

  const isBusy = scanState === "uploading" || scanState === "scanning";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <div>
            <h2 className="font-semibold">{label} Ticket</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Scan or enter the ticket serial number</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode chooser */}
          {mode === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("camera")}
                className="flex flex-col items-center gap-3 border-2 rounded-2xl p-5 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Camera className="size-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Take Photo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Scan with camera</p>
                </div>
              </button>
              <button
                onClick={() => setMode("manual")}
                className="flex flex-col items-center gap-3 border-2 rounded-2xl p-5 hover:border-primary hover:bg-primary/5 transition-all group"
              >
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

          {/* Camera upload */}
          {mode === "camera" && (
            <div className="space-y-4">
              {(scanState === "idle" || scanState === "error") && (
                <>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Camera className="size-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">Tap to take photo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Point at the serial number on the ticket
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                  </div>
                  {scanError && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40 rounded-xl text-sm text-amber-800 dark:text-amber-300">
                      <Warning className="size-4 shrink-0 mt-0.5" />
                      {scanError}
                    </div>
                  )}
                  <button onClick={() => setMode("manual")} className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Enter manually instead
                  </button>
                </>
              )}

              {isBusy && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Spinner className="size-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    {scanState === "uploading" ? "Uploading photo…" : "Reading serial number…"}
                  </p>
                </div>
              )}

              {scanState === "done" && scannedInfo && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle weight="fill" className="size-5 text-emerald-600 shrink-0" />
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Serial number found</p>
                    </div>
                    <p className="font-mono text-lg font-bold text-center py-2 bg-background/60 rounded-xl">
                      {scannedInfo.serial}
                    </p>
                    <p className="text-xs text-center text-muted-foreground capitalize">
                      Confidence: {scannedInfo.confidence}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Ticket #{extractTicketNum(scannedInfo.serial) ?? "?"} will be recorded
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Manual entry */}
          {mode === "manual" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Serial Number</label>
                <input
                  type="text"
                  placeholder="NNNN-NNNNNNN-NNN-N"
                  value={manualVal}
                  onChange={(e) => { setManualVal(e.target.value); setScanError(""); }}
                  className="w-full border rounded-xl px-4 py-3 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <p className="text-xs text-muted-foreground">Format: 1234-1234567-012-3</p>
              </div>
              {scanError && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40 rounded-xl text-sm text-amber-800 dark:text-amber-300">
                  <Warning className="size-4 shrink-0 mt-0.5" />
                  {scanError}
                </div>
              )}
              {manualVal && extractTicketNum(manualVal) !== null && (
                <p className="text-xs text-emerald-600 font-medium">
                  Ticket #{extractTicketNum(manualVal)} will be recorded
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => mode === "choose" ? onClose() : setMode("choose")}
            className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            {mode === "choose" ? "Cancel" : "Back"}
          </button>

          {mode === "camera" && scanState === "done" && scannedInfo && (
            <button
              onClick={() => confirmSerial(scannedInfo.serial)}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Use Serial
            </button>
          )}

          {mode === "manual" && (
            <button
              onClick={() => confirmSerial(manualVal)}
              disabled={!manualVal}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [shifts,    setShifts]    = useState<Shift[]>([]);
  const [active,    setActive]    = useState<Shift | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [slotNum,   setSlotNum]   = useState("4");
  const [startTicket, setStartTicket] = useState("");
  const [startSerial, setStartSerial] = useState("");
  const [endTicket,   setEndTicket]   = useState("");
  const [endSerial,   setEndSerial]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [summary,     setSummary]     = useState<Shift | null>(null);
  const [error,       setError]       = useState("");

  // Scan modal
  const [scanModal, setScanModal] = useState<"start" | "end" | null>(null);

  const elapsed = useElapsed(active?.clockIn ?? null);

  async function load() {
    const r = await fetch("/api/shifts");
    if (r.ok) {
      const data = await r.json();
      setShifts((data.shifts as Shift[]).filter((s) => s.status === "completed"));
      setActive(data.active as Shift | null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function clockIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clock_in", ticketStart: Number(startTicket), slotNum: Number(slotNum) }),
    });
    const data = await r.json();
    if (r.ok) { setActive(data.shift as Shift); setStartTicket(""); setStartSerial(""); }
    else setError(data.error ?? "Failed to clock in.");
    setSubmitting(false);
  }

  async function clockOut(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setError("");
    setSubmitting(true);
    const r = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clock_out", shiftId: active.shiftId, ticketEnd: Number(endTicket) }),
    });
    if (r.ok) {
      const completed: Shift = {
        ...active,
        ticketEnd: Number(endTicket),
        clockOut: new Date().toISOString(),
        status: "completed",
        sold: Math.max(0, Number(endTicket) - active.ticketStart),
      };
      setSummary(completed);
      setShifts((prev) => [completed, ...prev]);
      setActive(null);
      setEndTicket("");
      setEndSerial("");
    } else {
      setError((await r.json()).error ?? "Failed to clock out.");
    }
    setSubmitting(false);
  }

  function handleLogout() { logout(); router.push("/login?role=employee"); }

  const totalSold = shifts.reduce((sum, s) => sum + (s.sold ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Modals */}
      {scanModal && (
        <SerialScanModal
          label={scanModal === "start" ? "Starting" : "Ending"}
          onConfirm={(ticketNum, serial) => {
            if (scanModal === "start") {
              setStartTicket(String(ticketNum));
              setStartSerial(serial);
            } else {
              setEndTicket(String(ticketNum));
              setEndSerial(serial);
            }
            setScanModal(null);
          }}
          onClose={() => setScanModal(null)}
        />
      )}

      {/* Shift complete modal */}
      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-3xl p-7 w-full max-w-sm space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle weight="fill" className="size-9 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold">Shift Complete</h2>
              <p className="text-muted-foreground text-sm">
                {fmtDate(summary.clockIn)} · {fmtTime(summary.clockIn)} – {fmtTime(summary.clockOut!)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Sold",     value: String(summary.sold ?? 0) },
                { label: "Start #",  value: `#${summary.ticketStart}` },
                { label: "End #",    value: `#${summary.ticketEnd}` },
              ].map((s) => (
                <div key={s.label} className="border rounded-2xl py-3">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSummary(null)}
              className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2.5 font-semibold">
          <ShieldCheck weight="fill" className="text-primary size-5" />
          <span className="hidden sm:inline">LottoGuard</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.orgName}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Sign out">
            <SignOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Sold", value: String(totalSold),    icon: Ticket },
            { label: "Shifts",     value: String(shifts.length), icon: Clock  },
            { label: "Slot",       value: active ? `#${active.slotNum}` : "—", icon: TrendUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="border rounded-2xl p-3 text-center space-y-1 shadow-sm">
              <Icon className="size-4 text-muted-foreground mx-auto" />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Shift card */}
        <div className={cn(
          "rounded-3xl border p-6 space-y-5 shadow-sm transition-colors",
          active && "border-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-950/10"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30")} />
              <span className="text-sm font-semibold">{active ? "Shift in progress" : "Not clocked in"}</span>
            </div>
            {active && (
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {fmtDuration(elapsed)}
              </span>
            )}
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/8 rounded-xl px-3 py-2">{error}</p>}

          {!active ? (
            <form onSubmit={clockIn} className="space-y-4">
              {/* Slot number */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Slot Number</label>
                <input
                  type="number" required min={1} value={slotNum}
                  onChange={(e) => setSlotNum(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>

              {/* Starting ticket */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Starting Ticket #</label>
                  <button
                    type="button"
                    onClick={() => setScanModal("start")}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Camera className="size-3.5" />
                    Scan ticket
                  </button>
                </div>
                {startSerial && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                    <CheckCircle weight="fill" className="size-3.5 text-primary shrink-0" />
                    <span className="font-mono text-primary truncate">{startSerial}</span>
                    <button type="button" onClick={() => { setStartSerial(""); setStartTicket(""); }} className="text-muted-foreground hover:text-foreground ml-auto">
                      <X className="size-3" />
                    </button>
                  </div>
                )}
                <input
                  type="number" required min={0} placeholder="e.g. 025" value={startTicket}
                  onChange={(e) => setStartTicket(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <p className="text-xs text-muted-foreground">Enter the ticket number shown on the current ticket, or scan it.</p>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
                {submitting
                  ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  : <><Clock className="size-4" /> Clock In</>
                }
              </button>
            </form>
          ) : (
            <form onSubmit={clockOut} className="space-y-4">
              <div className="border rounded-2xl px-4 py-3 bg-background/60 space-y-0.5">
                <p className="text-xs text-muted-foreground">Clocked in</p>
                <p className="font-medium text-sm">
                  {fmtTime(active.clockIn)} · Slot {active.slotNum} · Starting ticket #{active.ticketStart}
                </p>
              </div>

              {/* Ending ticket */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Ending Ticket #</label>
                  <button
                    type="button"
                    onClick={() => setScanModal("end")}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Camera className="size-3.5" />
                    Scan ticket
                  </button>
                </div>
                {endSerial && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                    <CheckCircle weight="fill" className="size-3.5 text-primary shrink-0" />
                    <span className="font-mono text-primary truncate">{endSerial}</span>
                    <button type="button" onClick={() => { setEndSerial(""); setEndTicket(""); }} className="text-muted-foreground hover:text-foreground ml-auto">
                      <X className="size-3" />
                    </button>
                  </div>
                )}
                <input
                  type="number" required min={active.ticketStart} placeholder="e.g. 057" value={endTicket}
                  onChange={(e) => setEndTicket(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                {endTicket && Number(endTicket) >= active.ticketStart && (
                  <p className="text-xs text-emerald-600 font-semibold">
                    {Number(endTicket) - active.ticketStart} tickets will be recorded as sold.
                  </p>
                )}
              </div>

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-destructive text-white py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
                {submitting
                  ? <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <><ArrowRight weight="bold" className="size-4" /> Clock Out & Submit</>
                }
              </button>
            </form>
          )}
        </div>

        {/* Shift history */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
            <Ticket className="size-4" /> Shift History
          </h2>
          <div className="border rounded-2xl divide-y overflow-hidden shadow-sm">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-28" />
                      <div className="h-3 bg-muted rounded animate-pulse w-20" />
                    </div>
                    <div className="h-4 bg-muted rounded animate-pulse w-16" />
                  </div>
                ))
              : shifts.map((s) => (
                  <div key={s.shiftId} className="flex items-center justify-between px-4 py-4 hover:bg-muted/20 transition-colors gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{fmtDate(s.clockIn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtTime(s.clockIn)}{s.clockOut ? ` – ${fmtTime(s.clockOut)}` : ""}
                        {" · Slot "}{s.slotNum}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{s.sold ?? 0} sold</p>
                      <p className="text-xs text-muted-foreground font-mono">#{s.ticketStart}→#{s.ticketEnd ?? "?"}</p>
                    </div>
                    <CheckCircle weight="fill" className="size-4 text-emerald-500 shrink-0" />
                  </div>
                ))
            }
            {!loading && shifts.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">No completed shifts yet.</p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
