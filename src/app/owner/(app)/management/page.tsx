"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle, XCircle, ProhibitInset, Copy,
  ArrowClockwise, Clock, TrendUp, Ticket,
  UserCircle, CalendarBlank, Trash, MagnifyingGlass, X,
  CaretLeft, ChartBar, ArrowUp, ArrowDown, UsersThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TrendArea, CHART_COLORS } from "@/components/charts";

type EmpStatus = "pending" | "active" | "disabled";
type Employee = {
  sub: string; name: string; email: string;
  phone: string; status: EmpStatus; createdAt: string;
};
type Shift = {
  shiftId: string; slotNum: number; ticketStart: number;
  ticketEnd?: number; clockIn: string; clockOut?: string; sold?: number;
};

const TABS: { label: string; value: EmpStatus | "all" }[] = [
  { label: "All",      value: "all"      },
  { label: "Pending",  value: "pending"  },
  { label: "Active",   value: "active"   },
  { label: "Disabled", value: "disabled" },
];

const STATUS_STYLE: Record<EmpStatus, string> = {
  pending:  "bg-amber-100 text-amber-700 border-amber-200",
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  disabled: "bg-muted text-muted-foreground border-border",
};

function avatarColor(name: string): string {
  const palette = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#3b82f6"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(clockIn: string, clockOut: string) {
  const mins = Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function fmtAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ManagementPage() {
  const [employees,     setEmployees]     = useState<Employee[]>([]);
  const [inviteCode,    setInviteCode]    = useState("");
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState<EmpStatus | "all">("all");
  const [updating,      setUpdating]      = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);
  const [selected,      setSelected]      = useState<Employee | null>(null);
  const [shifts,        setShifts]        = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [query,         setQuery]         = useState("");
  const [shiftRange,    setShiftRange]    = useState<"all" | "30d" | "7d">("30d");
  const [shiftSlot,     setShiftSlot]     = useState<number | "all">("all");

  async function load() {
    setLoading(true);
    const [empRes, settingsRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/settings"),
    ]);
    if (empRes.ok)      setEmployees((await empRes.json()).employees as Employee[]);
    if (settingsRes.ok) {
      const { org } = await settingsRes.json();
      setInviteCode((org as Record<string, unknown>).inviteCode as string ?? "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function selectEmployee(emp: Employee) {
    setSelected(emp);
    setShifts([]);
    setShiftsLoading(true);
    setShiftSlot("all");
    const r = await fetch(`/api/employees/${emp.sub}/shifts`);
    if (r.ok) setShifts((await r.json()).shifts as Shift[]);
    setShiftsLoading(false);
  }

  async function setStatus(sub: string, status: "active" | "disabled") {
    setUpdating(sub);
    const r = await fetch(`/api/employees/${sub}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      setEmployees((prev) => prev.map((e) => e.sub === sub ? { ...e, status } : e));
      if (selected?.sub === sub) setSelected((d) => d ? { ...d, status } : d);
    }
    setUpdating(null);
  }

  async function deleteEmp(sub: string) {
    if (!confirm("Permanently delete this employee? This cannot be undone.")) return;
    setDeleting(true);
    const r = await fetch(`/api/employees/${sub}`, { method: "DELETE" });
    if (r.ok) {
      setEmployees((prev) => prev.filter((e) => e.sub !== sub));
      setSelected(null);
      setShifts([]);
    }
    setDeleting(false);
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:      employees.length,
    pending:  employees.filter((e) => e.status === "pending").length,
    active:   employees.filter((e) => e.status === "active").length,
    disabled: employees.filter((e) => e.status === "disabled").length,
  }), [employees]);

  const visible = useMemo(() => {
    let list = tab === "all" ? employees : employees.filter((e) => e.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, tab, query]);

  // Filter shifts by range and slot
  const visibleShifts = useMemo(() => {
    const cutoff = shiftRange === "all" ? 0
      : shiftRange === "7d" ? Date.now() - 7 * 86_400_000
      : Date.now() - 30 * 86_400_000;
    return shifts.filter((s) => {
      const t = new Date(s.clockIn).getTime();
      if (cutoff && t < cutoff) return false;
      if (shiftSlot !== "all" && s.slotNum !== shiftSlot) return false;
      return true;
    });
  }, [shifts, shiftRange, shiftSlot]);

  const totalSold     = visibleShifts.reduce((s, sh) => s + (sh.sold ?? 0), 0);
  const avgPerShift   = visibleShifts.length > 0 ? Math.round(totalSold / visibleShifts.length) : 0;
  const totalMinutes  = visibleShifts.reduce((acc, sh) =>
    acc + (sh.clockOut ? Math.round((new Date(sh.clockOut).getTime() - new Date(sh.clockIn).getTime()) / 60000) : 0), 0);
  const totalHours    = (totalMinutes / 60).toFixed(1);

  const uniqueSlots = useMemo(() => {
    const set = new Set<number>(); shifts.forEach((s) => set.add(s.slotNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [shifts]);

  // Build daily chart
  const shiftChart = useMemo(() => {
    if (visibleShifts.length === 0) return [];
    const byDay: Record<string, number> = {};
    for (const s of visibleShifts) {
      const day = s.clockIn.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + (s.sold ?? 0);
    }
    const entries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([day, sold]) => ({ day, sold }));
  }, [visibleShifts]);

  const showDetail   = !!selected;
  const pendingCount = counts.pending;

  return (
    <div className="flex flex-col h-full max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex items-start sm:items-center justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <UsersThree weight="fill" className="size-6 text-primary" />
            Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0 && (
              <span className="text-amber-600 font-semibold">{pendingCount} pending · </span>
            )}
            {employees.length} total employees
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {inviteCode && (
            <div className="flex items-center gap-2 border rounded-xl px-2.5 sm:px-3 py-2 bg-muted/30 text-sm">
              <span className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider font-bold">Invite</span>
              <span className="font-mono font-bold tracking-wider text-xs sm:text-sm">{inviteCode}</span>
              <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <CheckCircle weight="fill" className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: list (hidden on mobile when detail open) */}
        <div className={cn(
          "flex flex-col w-full sm:w-80 shrink-0 sm:border-r",
          showDetail && "hidden sm:flex"
        )}>
          {/* Filter tabs */}
          <div className="flex border-b px-2 pt-2 gap-0.5 shrink-0 overflow-x-auto">
            {TABS.map((t) => {
              const count = counts[t.value as keyof typeof counts];
              return (
                <button key={t.value} onClick={() => setTab(t.value)}
                  className={cn(
                    "px-3 py-2 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap",
                    tab === t.value
                      ? "border border-b-0 border-border bg-background text-foreground -mb-px"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  {t.label}
                  {count > 0 && <span className="ml-1 opacity-70 tabular-nums">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="p-3 border-b shrink-0">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full border rounded-xl pl-9 pr-8 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="size-9 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded animate-pulse w-24" />
                      <div className="h-2.5 bg-muted rounded animate-pulse w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="py-12 text-center px-4">
                <UsersThree className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{query ? "No employees match your search." : "No employees here."}</p>
              </div>
            ) : (
              <div className="divide-y">
                {visible.map((emp) => (
                  <button key={emp.sub} onClick={() => selectEmployee(emp)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left transition-colors group",
                      selected?.sub === emp.sub
                        ? "bg-primary/8 border-l-2 border-primary"
                        : "hover:bg-muted/40 border-l-2 border-transparent"
                    )}>
                    <div className="size-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ring-2 ring-background"
                      style={{ background: avatarColor(emp.name) }}>
                      {initials(emp.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold truncate", selected?.sub === emp.sub && "text-primary")}>
                        {emp.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border", STATUS_STYLE[emp.status])}>
                      {emp.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: detail (full screen on mobile when an employee is selected) */}
        <div className={cn("flex-1 overflow-y-auto", !showDetail && "hidden sm:block")}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <UserCircle className="size-14 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground max-w-xs">
                Select an employee from the list to view their details, shift history, and performance trend.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Mobile back */}
              <button onClick={() => setSelected(null)}
                className="sm:hidden flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground border-b">
                <CaretLeft className="size-4" /> Back to list
              </button>

              {/* Employee header */}
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="size-12 sm:size-14 rounded-full flex items-center justify-center text-base font-black text-white shrink-0 ring-2 ring-background shadow-sm"
                    style={{ background: avatarColor(selected.name) }}>
                    {initials(selected.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base sm:text-lg leading-tight">{selected.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{selected.email}</p>
                    {selected.phone && <p className="text-xs sm:text-sm text-muted-foreground">{selected.phone}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border", STATUS_STYLE[selected.status])}>
                        {selected.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Joined {fmtAgo(selected.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {updating === selected.sub ? (
                    <span className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <>
                      {selected.status === "pending" && (
                        <>
                          <button onClick={() => setStatus(selected.sub, "active")}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                            <CheckCircle weight="fill" className="size-3.5" />Approve
                          </button>
                          <button onClick={() => setStatus(selected.sub, "disabled")}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                            <XCircle className="size-3.5" />Reject
                          </button>
                        </>
                      )}
                      {selected.status === "active" && (
                        <button onClick={() => setStatus(selected.sub, "disabled")}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border hover:bg-muted transition-colors text-muted-foreground">
                          <ProhibitInset className="size-3.5" />Disable
                        </button>
                      )}
                      {selected.status === "disabled" && (
                        <button onClick={() => setStatus(selected.sub, "active")}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                          <CheckCircle weight="fill" className="size-3.5" />Re-enable
                        </button>
                      )}
                      <button onClick={() => deleteEmp(selected.sub)} disabled={deleting}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                        title="Delete employee permanently">
                        {deleting
                          ? <span className="size-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                          : <Trash className="size-3.5" />}
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Shift filters */}
              <div className="px-4 sm:px-6 py-3 border-b flex items-center gap-2 flex-wrap shrink-0">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Range:</span>
                <div className="flex items-center gap-0.5 border rounded-lg bg-muted/40 p-0.5">
                  {(["7d", "30d", "all"] as const).map((r) => (
                    <button key={r} onClick={() => setShiftRange(r)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded transition-all uppercase",
                        shiftRange === r ? "bg-background shadow-sm" : "text-muted-foreground"
                      )}>
                      {r === "all" ? "All time" : r}
                    </button>
                  ))}
                </div>

                {uniqueSlots.length > 0 && (
                  <>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Slot:</span>
                    <select value={shiftSlot} onChange={(e) => setShiftSlot(e.target.value === "all" ? "all" : Number(e.target.value))}
                      className="border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium">
                      <option value="all">All slots</option>
                      {uniqueSlots.map((s) => (<option key={s} value={s}>Slot #{s}</option>))}
                    </select>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
                <div className="border rounded-xl p-2.5 sm:p-3 bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarBlank className="size-3 text-muted-foreground" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">Shifts</p>
                  </div>
                  <p className="text-xl sm:text-2xl font-black tabular-nums">{visibleShifts.length}</p>
                </div>
                <div className="border rounded-xl p-2.5 sm:p-3 bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ticket className="size-3 text-primary" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">Tickets</p>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{totalSold.toLocaleString()}</p>
                </div>
                <div className="border rounded-xl p-2.5 sm:p-3 bg-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="size-3 text-violet-600" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">Hours</p>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-violet-700 tabular-nums">{totalHours}</p>
                </div>
              </div>

              {/* Mini trend chart */}
              {shiftChart.length > 1 && (
                <div className="px-4 sm:px-6 py-4 border-b shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ChartBar weight="fill" className="size-3.5 text-primary" />
                      Sales by day
                    </p>
                    <p className="text-xs text-muted-foreground">avg <span className="font-bold tabular-nums text-foreground">{avgPerShift}</span>/shift</p>
                  </div>
                  <TrendArea data={shiftChart} dataKey="sold" color={CHART_COLORS.primary} height={120}
                    valueFormatter={(v) => `${v.toLocaleString()} sold`}
                    labelFormatter={(d) => d.slice(5)} />
                </div>
              )}

              {/* Shift history */}
              <div className="px-4 sm:px-6 py-3 flex items-center gap-2 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                <TrendUp className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Shift History {visibleShifts.length > 0 && `· ${visibleShifts.length} shift${visibleShifts.length !== 1 ? "s" : ""}`}
                </h3>
              </div>

              {shiftsLoading ? (
                <div className="p-4 sm:p-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : visibleShifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                  <Clock className="size-10 text-muted-foreground/25" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {shifts.length === 0 ? "No shifts recorded yet." : "No shifts in this range."}
                  </p>
                  {shifts.length > 0 && shiftRange !== "all" && (
                    <button onClick={() => setShiftRange("all")} className="text-xs text-primary hover:underline font-semibold">
                      Show all time
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {visibleShifts.slice().sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).map((s) => {
                    const sold = s.sold ?? 0;
                    const isActive = !s.clockOut;
                    return (
                      <div key={s.shiftId} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold">{fmtDate(s.clockIn)}</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                Slot #{s.slotNum}
                              </span>
                              {isActive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {fmtTime(s.clockIn)}
                              {s.clockOut ? ` – ${fmtTime(s.clockOut)} · ${fmtDuration(s.clockIn, s.clockOut)}` : " · in progress"}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              Tickets #{s.ticketStart}{s.ticketEnd != null ? `–#${s.ticketEnd}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-black text-primary tabular-nums">{sold.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">tickets sold</p>
                            {sold > avgPerShift && avgPerShift > 0 && (
                              <span className="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-0.5 mt-0.5">
                                <ArrowUp className="size-2.5" weight="bold" /> above avg
                              </span>
                            )}
                            {sold < avgPerShift / 2 && avgPerShift > 0 && (
                              <span className="text-[10px] font-bold text-amber-700 inline-flex items-center gap-0.5 mt-0.5">
                                <ArrowDown className="size-2.5" weight="bold" /> below avg
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
