"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, ProhibitInset, Copy, ArrowClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type EmpStatus = "pending" | "active" | "disabled";
type Employee = { sub: string; name: string; email: string; phone: string; status: EmpStatus; createdAt: string };

const TABS: { label: string; value: EmpStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
];

const STATUS_STYLE: Record<EmpStatus, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  disabled: "bg-muted text-muted-foreground",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<EmpStatus | "all">("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const visible = tab === "all" ? employees : employees.filter((e) => e.status === tab);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Employee Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{employees.length} employees registered</p>
        </div>
        <div className="flex items-center gap-2">
          {inviteCode && (
            <div className="flex items-center gap-2 border rounded-xl px-4 py-2 bg-muted/30 text-sm">
              <span className="text-muted-foreground text-xs">Invite code</span>
              <span className="font-mono font-semibold">{inviteCode}</span>
              <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                <Copy className="size-4" />
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
      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const count = t.value === "all" ? employees.length : employees.filter((e) => e.status === t.value).length;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              {count > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="border rounded-2xl divide-y overflow-hidden shadow-sm">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="size-9 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-32" />
                  <div className="h-3 bg-muted rounded animate-pulse w-48" />
                </div>
              </div>
            ))
          : visible.map((e) => (
              <div key={e.sub} className="flex items-center justify-between px-4 py-4 gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{e.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.email} · {e.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[e.status])}>
                    {e.status}
                  </span>
                  <div className="flex gap-0.5">
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
          <p className="text-center text-sm text-muted-foreground py-10">No employees in this category.</p>
        )}
      </div>
    </div>
  );
}
