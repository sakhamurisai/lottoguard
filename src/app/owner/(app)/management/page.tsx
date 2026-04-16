"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle, XCircle, ProhibitInset, Copy,
  ArrowClockwise, X, Clock, TrendUp, Ticket,
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
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<EmpStatus | "all">("all");
  const [updating, setUpdating]   = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  // Drawer
  const [drawer, setDrawer]               = useState<Employee | null>(null);
  const [shifts, setShifts]               = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [empRes, settingsRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/settings"),
    ]);
    if (empRes.ok) setEmployees((await empRes.json()).employees as Employee[]);
    if (settingsRes.ok) {
      const { org } = await settingsRes.json();
      setInviteCode((org as Record<string, unknown>).inviteCode as string ?? "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openDrawer(emp: Employee) {
    setDrawer(emp);
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
      if (drawer?.sub === sub) setDrawer((d) => d ? { ...d, status } : d);
    }
    setUpdating(null);
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const visible = tab === "all" ? employees : employees.filter((e) => e.status === tab);
  const totalSold = shifts.reduce((sum, s) => sum + (s.sold ?? 0), 0);

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {employees.filter((e) => e.status === "pending").length > 0
              ? <span className="text-amber-600 font-medium">{employees.filter((e) => e.status === "pending").length} pending approval · </span>
              : null}
            {employees.length} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {inviteCode && (
            <div className="flex items-center gap-2 border rounded-xl px-4 py-2 bg-muted/30 text-sm">
              <span className="text-muted-foreground text-xs">Invite code</span>
              <span className="font-mono font-bold tracking-widest">{inviteCode}</span>
              <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="size-3.5" />
              </button>
              {copied && <span className="text-xs text-emerald-600 font-medium">Copied!</span>}
            </div>
          )}
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground shrink-0">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
          const count = t.value === "all" ? employees.length : employees.filter((e) => e.status === t.value).length;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                tab === t.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              {count > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Employee list */}
      <div className="border rounded-2xl divide-y overflow-hidden shadow-sm">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="size-9 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-32" />
                  <div className="h-3 bg-muted rounded animate-pulse w-48" />
                </div>
                <div className="h-6 bg-muted rounded-full animate-pulse w-16" />
              </div>
            ))
          : visible.map((e) => (
              <div key={e.sub}
                onClick={() => openDrawer(e)}
                className="flex items-center justify-between px-4 py-4 gap-4 hover:bg-muted/20 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {initials(e.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{e.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.email}{e.phone ? ` · ${e.phone}` : ""}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[e.status])}>
                    {e.status}
                  </span>
                  {/* Action buttons — stop propagation so row click doesn't fire */}
                  <div className="flex gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                    {updating === e.sub
                      ? <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      : (
                        <>
                          {e.status === "pending" && (
                            <>
                              <button onClick={() => setStatus(e.sub, "active")} title="Approve"
                                className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors">
                                <CheckCircle className="size-4" />
                              </button>
                              <button onClick={() => setStatus(e.sub, "disabled")} title="Reject"
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-destructive transition-colors">
                                <XCircle className="size-4" />
                              </button>
                            </>
                          )}
                          {e.status === "active" && (
                            <button onClick={() => setStatus(e.sub, "disabled")} title="Disable"
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <ProhibitInset className="size-4" />
                            </button>
                          )}
                          {e.status === "disabled" && (
                            <button onClick={() => setStatus(e.sub, "active")} title="Re-enable"
                              className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors">
                              <CheckCircle className="size-4" />
                            </button>
                          )}
                        </>
                      )
                    }
                  </div>
                </div>
              </div>
            ))
        }
        {!loading && visible.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No employees in this category.</p>
          </div>
        )}
      </div>

      {/* Shift-history drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="w-full max-w-sm bg-background border-l shadow-2xl flex flex-col overflow-hidden">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {initials(drawer.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{drawer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{drawer.email}</p>
                </div>
              </div>
              <button onClick={() => setDrawer(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0 ml-2">
                <X className="size-4" />
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b shrink-0">
              <div className="border rounded-xl p-2.5 text-center">
                <p className={cn("text-sm font-bold capitalize", STATUS_STYLE[drawer.status])}>{drawer.status}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Status</p>
              </div>
              <div className="border rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="size-3 text-muted-foreground" />
                  <p className="text-sm font-bold">{shifts.length}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Shifts</p>
              </div>
              <div className="border rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Ticket className="size-3 text-muted-foreground" />
                  <p className="text-sm font-bold text-primary">{totalSold}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Sold</p>
              </div>
            </div>

            {/* Shift list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-3 flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur-sm border-b">
                <TrendUp className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Shift History</h3>
              </div>

              {shiftsLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : shifts.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No shifts recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {shifts.map((s) => (
                    <div key={s.shiftId} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{fmtDate(s.clockIn)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtTime(s.clockIn)}
                            {s.clockOut ? ` – ${fmtTime(s.clockOut)}` : " · Active"}
                            {" · Slot "}{s.slotNum}
                          </p>
                          {s.clockOut && (
                            <p className="text-xs text-muted-foreground">
                              Duration: {fmtDuration(s.clockIn, s.clockOut)}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{s.sold ?? 0} sold</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            #{s.ticketStart}→#{s.ticketEnd ?? "?"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
