"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle, XCircle, ProhibitInset, Copy,
  ArrowClockwise, Clock, TrendUp, Ticket,
  UserCircle, CalendarBlank, Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  disabled: "bg-muted text-muted-foreground",
};

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
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const visible     = tab === "all" ? employees : employees.filter((e) => e.status === tab);
  const totalSold   = shifts.reduce((s, sh) => s + (sh.sold ?? 0), 0);
  const pendingCount= employees.filter((e) => e.status === "pending").length;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0 && (
              <span className="text-amber-600 font-medium">{pendingCount} pending · </span>
            )}
            {employees.length} total employees
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {inviteCode && (
            <div className="flex items-center gap-2 border rounded-xl px-4 py-2 bg-muted/30 text-sm">
              <span className="text-muted-foreground text-xs">Invite</span>
              <span className="font-mono font-bold tracking-widest">{inviteCode}</span>
              <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="size-3.5" />
              </button>
              {copied && <span className="text-xs text-emerald-600 font-medium">Copied!</span>}
            </div>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Body: two columns ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: employee list ── */}
        <div className="w-72 shrink-0 border-r flex flex-col">

          {/* Filter tabs */}
          <div className="flex border-b px-2 pt-2 gap-0.5 shrink-0">
            {TABS.map((t) => {
              const count = t.value === "all" ? employees.length : employees.filter((e) => e.status === t.value).length;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-t-lg transition-colors",
                    tab === t.value
                      ? "border border-b-0 border-border bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Employee rows */}
          <div className="flex-1 overflow-y-auto divide-y">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="size-8 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded animate-pulse w-24" />
                    <div className="h-2.5 bg-muted rounded animate-pulse w-32" />
                  </div>
                </div>
              ))
            ) : visible.length === 0 ? (
              <div className="py-12 text-center px-4">
                <p className="text-sm text-muted-foreground">No employees here.</p>
              </div>
            ) : (
              visible.map((emp) => (
                <button
                  key={emp.sub}
                  onClick={() => selectEmployee(emp)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group",
                    selected?.sub === emp.sub
                      ? "bg-primary/8 border-l-2 border-primary"
                      : "hover:bg-muted/40 border-l-2 border-transparent"
                  )}
                >
                  <div className={cn(
                    "size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    selected?.sub === emp.sub ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {initials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", selected?.sub === emp.sub && "text-primary")}>
                      {emp.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", STATUS_STYLE[emp.status])}>
                    {emp.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <UserCircle className="size-12 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground">Select an employee to view their details and shift history.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">

              {/* Employee header */}
              <div className="px-6 py-5 border-b shrink-0 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-black text-primary shrink-0">
                    {initials(selected.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-base">{selected.name}</p>
                    <p className="text-sm text-muted-foreground">{selected.email}</p>
                    {selected.phone && <p className="text-sm text-muted-foreground">{selected.phone}</p>}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full capitalize", STATUS_STYLE[selected.status])}>
                    {selected.status}
                  </span>
                  {updating === selected.sub ? (
                    <span className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <>
                      {selected.status === "pending" && (
                        <>
                          <button
                            onClick={() => setStatus(selected.sub, "active")}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle className="size-3.5" />Approve
                          </button>
                          <button
                            onClick={() => setStatus(selected.sub, "disabled")}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-destructive hover:bg-red-100 transition-colors"
                          >
                            <XCircle className="size-3.5" />Reject
                          </button>
                        </>
                      )}
                      {selected.status === "active" && (
                        <button
                          onClick={() => setStatus(selected.sub, "disabled")}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border hover:bg-muted transition-colors text-muted-foreground"
                        >
                          <ProhibitInset className="size-3.5" />Disable
                        </button>
                      )}
                      {selected.status === "disabled" && (
                        <button
                          onClick={() => setStatus(selected.sub, "active")}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle className="size-3.5" />Re-enable
                        </button>
                      )}
                      <button
                        onClick={() => deleteEmp(selected.sub)}
                        disabled={deleting}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-destructive hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Delete employee permanently"
                      >
                        {deleting
                          ? <span className="size-3.5 rounded-full border-2 border-destructive border-t-transparent animate-spin" />
                          : <Trash className="size-3.5" />
                        }
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b shrink-0">
                <div className="border rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <CalendarBlank className="size-3 text-muted-foreground" />
                    <p className="text-lg font-black">{shifts.length}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Total shifts</p>
                </div>
                <div className="border rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Ticket className="size-3 text-muted-foreground" />
                    <p className="text-lg font-black text-primary">{totalSold}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Tickets sold</p>
                </div>
                <div className="border rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendUp className="size-3 text-muted-foreground" />
                    <p className="text-lg font-black">{shifts.length > 0 ? Math.round(totalSold / shifts.length) : 0}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg per shift</p>
                </div>
              </div>

              {/* Joined date */}
              <div className="px-6 py-3 border-b shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarBlank className="size-3.5" />
                Joined {fmtDate(selected.createdAt)}
              </div>

              {/* Shift history */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-3 flex items-center gap-2 border-b sticky top-0 bg-background/95 backdrop-blur-sm">
                  <TrendUp className="size-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Shift History</h3>
                </div>

                {shiftsLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : shifts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                    <Clock className="size-9 text-muted-foreground/25" />
                    <p className="text-sm text-muted-foreground">No shifts recorded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {shifts.map((s) => (
                      <div key={s.shiftId} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-semibold">{fmtDate(s.clockIn)}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtTime(s.clockIn)}
                              {s.clockOut ? ` – ${fmtTime(s.clockOut)}` : " · Active now"}
                              {" · "}Slot {s.slotNum}
                            </p>
                            {s.clockOut && (
                              <p className="text-xs text-muted-foreground">
                                Duration: {fmtDuration(s.clockIn, s.clockOut)}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-primary">{s.sold ?? 0} sold</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              #{s.ticketStart}–#{s.ticketEnd ?? "?"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
