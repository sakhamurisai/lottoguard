"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle, XCircle, ProhibitInset, Copy, ArrowClockwise,
  MagnifyingGlass, X, UsersThree, Clock, Phone, Envelope, Sparkle,
  CaretDown, DotsThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type EmpStatus = "pending" | "active" | "disabled";
type Employee = { sub: string; name: string; email: string; phone: string; status: EmpStatus; createdAt: string };

const TABS: { label: string; value: EmpStatus | "all"; tone: string }[] = [
  { label: "All",      value: "all",      tone: "text-foreground" },
  { label: "Pending",  value: "pending",  tone: "text-amber-600" },
  { label: "Active",   value: "active",   tone: "text-emerald-600" },
  { label: "Disabled", value: "disabled", tone: "text-muted-foreground" },
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function EmployeesPage() {
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<EmpStatus | "all">("all");
  const [updating,   setUpdating]   = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [query,      setQuery]      = useState("");
  const [sortBy,     setSortBy]     = useState<"recent" | "name" | "status">("recent");

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

  async function setStatus(sub: string, status: "active" | "disabled") {
    setUpdating(sub);
    const r = await fetch(`/api/employees/${sub}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) setEmployees((prev) => prev.map((e) => e.sub === sub ? { ...e, status } : e));
    setUpdating(null);
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Derived
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
        e.email.toLowerCase().includes(q) ||
        (e.phone ?? "").includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name")   return a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [employees, tab, query, sortBy]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <UsersThree weight="fill" className="size-6 text-primary" />
            Employees
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your team — approve, disable, or re-enable accounts
          </p>
        </div>
        <button onClick={load} className="self-start sm:self-auto p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Total",    value: counts.all,      color: "text-foreground",     bg: "bg-muted/30 border-border" },
          { label: "Pending",  value: counts.pending,  color: "text-amber-700",      bg: "bg-amber-50 border-amber-200" },
          { label: "Active",   value: counts.active,   color: "text-emerald-700",    bg: "bg-emerald-50 border-emerald-200" },
          { label: "Disabled", value: counts.disabled, color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
        ].map((s) => (
          <div key={s.label} className={cn("border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between", s.bg)}>
            <span className="text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">{s.label}</span>
            <span className={cn("text-base sm:text-xl font-black tabular-nums", s.color)}>{loading ? "—" : s.value}</span>
          </div>
        ))}
      </div>

      {/* Invite code card */}
      {inviteCode && (
        <div className="border rounded-2xl p-3 sm:p-4 bg-gradient-to-br from-primary/5 to-emerald-50/40 flex items-center gap-3 flex-wrap">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkle weight="fill" className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee Invite Code</p>
            <p className="text-base sm:text-lg font-black font-mono tracking-wider">{inviteCode}</p>
          </div>
          <button onClick={copyCode}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
              copied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-background hover:bg-muted text-foreground border-border"
            )}>
            {copied ? <><CheckCircle weight="fill" className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or phone…"
            className="w-full border rounded-xl pl-10 pr-9 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="relative shrink-0">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-full sm:w-auto appearance-none border rounded-xl pl-3 pr-9 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium">
            <option value="recent">Most recent</option>
            <option value="name">Name (A→Z)</option>
            <option value="status">By status</option>
          </select>
          <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => {
          const count = counts[t.value as keyof typeof counts];
          const isActive = tab === t.value;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
                isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t.label}
              <span className={cn("ml-1.5 text-xs tabular-nums", isActive && t.tone, "font-bold")}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Pending highlight banner */}
      {counts.pending > 0 && tab !== "pending" && (
        <button onClick={() => setTab("pending")}
          className="w-full text-left border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors rounded-2xl p-3 sm:p-4 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Clock weight="fill" className="size-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {counts.pending} employee{counts.pending !== 1 ? "s" : ""} awaiting approval
            </p>
            <p className="text-xs text-amber-700">Click here to review and approve them</p>
          </div>
          <span className="text-xs font-bold text-amber-700 px-2 py-1 bg-amber-100 rounded-full shrink-0">Review →</span>
        </button>
      )}

      {/* Employee list */}
      <div className="border rounded-2xl overflow-hidden shadow-sm bg-card">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="size-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-32" />
                  <div className="h-3 bg-muted rounded animate-pulse w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-2">
            <UsersThree className="size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {query ? "No employees match your search" : counts.all === 0 ? "No employees yet" : "No employees in this category"}
            </p>
            {query && (
              <button onClick={() => setQuery("")} className="text-xs text-primary hover:underline font-semibold">
                Clear search
              </button>
            )}
            {counts.all === 0 && inviteCode && (
              <p className="text-xs text-muted-foreground max-w-sm">
                Share the invite code <span className="font-mono font-bold">{inviteCode}</span> with employees so they can sign up.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {visible.map((e) => (
              <div key={e.sub} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 hover:bg-muted/30 transition-colors">
                <div className="size-10 sm:size-11 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 ring-2 ring-background shadow-sm"
                  style={{ background: avatarColor(e.name) }}>
                  {e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{e.name}</p>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border", STATUS_STYLE[e.status])}>
                      {e.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Envelope className="size-3 shrink-0" />
                      <span className="truncate">{e.email}</span>
                    </span>
                    {e.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3 shrink-0" />
                        {e.phone}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 sm:hidden">
                    Joined {fmtAgo(e.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
                    Joined {fmtDate(e.createdAt)}
                  </span>
                  <div className="flex gap-1">
                    {updating === e.sub ? (
                      <span className="size-7 rounded-lg flex items-center justify-center">
                        <span className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </span>
                    ) : e.status === "pending" ? (
                      <>
                        <button onClick={() => setStatus(e.sub, "active")} title="Approve"
                          className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors border border-emerald-200">
                          <CheckCircle weight="fill" className="size-4" />
                        </button>
                        <button onClick={() => setStatus(e.sub, "disabled")} title="Reject"
                          className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors border border-transparent hover:border-rose-200">
                          <XCircle className="size-4" />
                        </button>
                      </>
                    ) : e.status === "active" ? (
                      <button onClick={() => setStatus(e.sub, "disabled")} title="Disable"
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                        <ProhibitInset className="size-4" />
                      </button>
                    ) : (
                      <button onClick={() => setStatus(e.sub, "active")} title="Re-enable"
                        className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors border border-emerald-200">
                        <CheckCircle className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
