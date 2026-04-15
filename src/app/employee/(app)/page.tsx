"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, Clock, ArrowRight, CheckCircle,
  Ticket, SignOut, TrendUp,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type ShiftStatus = "active" | "completed";
type Shift = {
  shiftId: string; slotNum: number; ticketStart: number; ticketEnd?: number;
  clockIn: string; clockOut?: string; status: ShiftStatus; sold?: number;
};

// ── Live timer ─────────────────────────────────────────────────────────────────

function useElapsed(clockInIso: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!clockInIso) { setElapsed(0); return; }
    const start = new Date(clockInIso).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [active, setActive] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTicket, setStartTicket] = useState("");
  const [slotNum, setSlotNum] = useState("4");
  const [endTicket, setEndTicket] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<Shift | null>(null);
  const [error, setError] = useState("");

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
    if (r.ok) { setActive(data.shift as Shift); setStartTicket(""); }
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
    } else {
      setError((await r.json()).error ?? "Failed to clock out.");
    }
    setSubmitting(false);
  }

  function handleLogout() { logout(); router.push("/login?role=employee"); }

  const totalSold = shifts.reduce((sum, s) => sum + (s.sold ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
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

        {/* Shift summary modal */}
        {summary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-background border rounded-3xl p-7 w-full max-w-sm space-y-5 shadow-2xl">
              <div className="text-center space-y-2">
                <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle weight="fill" className="size-9 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold">Shift Complete</h2>
                <p className="text-muted-foreground text-sm">{fmtDate(summary.clockIn)} · {fmtTime(summary.clockIn)} – {fmtTime(summary.clockOut!)}</p>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Sold", value: String(totalSold), icon: Ticket },
            { label: "Shifts",     value: String(shifts.length), icon: Clock },
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Slot Number</label>
                  <input type="number" required min={1} value={slotNum} onChange={(e) => setSlotNum(e.target.value)}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Starting Ticket #</label>
                  <input type="number" required min={0} placeholder="e.g. 142" value={startTicket} onChange={(e) => setStartTicket(e.target.value)}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Enter the ticket number shown on the machine before your shift.</p>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
                {submitting ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <><Clock className="size-4" /> Clock In</>}
              </button>
            </form>
          ) : (
            <form onSubmit={clockOut} className="space-y-4">
              <div className="border rounded-2xl px-4 py-3 bg-background/60 space-y-0.5">
                <p className="text-xs text-muted-foreground">Clocked in</p>
                <p className="font-medium text-sm">{fmtTime(active.clockIn)} · Slot {active.slotNum} · Starting ticket #{active.ticketStart}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ending Ticket #</label>
                <input type="number" required min={active.ticketStart} placeholder="e.g. 198" value={endTicket} onChange={(e) => setEndTicket(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
                {endTicket && Number(endTicket) >= active.ticketStart && (
                  <p className="text-xs text-emerald-600 font-semibold">
                    {Number(endTicket) - active.ticketStart} tickets will be recorded as sold.
                  </p>
                )}
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-destructive text-white py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
                {submitting ? <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <><ArrowRight weight="bold" className="size-4" /> Clock Out & Submit</>}
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
                    <div className="space-y-2"><div className="h-4 bg-muted rounded animate-pulse w-28" /><div className="h-3 bg-muted rounded animate-pulse w-20" /></div>
                    <div className="h-4 bg-muted rounded animate-pulse w-16" />
                  </div>
                ))
              : shifts.map((s) => (
                  <div key={s.shiftId} className="flex items-center justify-between px-4 py-4 hover:bg-muted/20 transition-colors gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{fmtDate(s.clockIn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtTime(s.clockIn)}{s.clockOut ? ` – ${fmtTime(s.clockOut)}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{s.sold ?? 0} sold</p>
                      <p className="text-xs text-muted-foreground">#{s.ticketStart} → #{s.ticketEnd ?? "?"}</p>
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
