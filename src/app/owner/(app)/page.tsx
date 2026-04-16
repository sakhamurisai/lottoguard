"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TrendUp, Warning, CheckCircle, ArrowClockwise,
  Package, GridFour, Users, BookOpen,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type Book = { status: string; activatedAt?: string; settledAt?: string; gameName: string; slot?: number | null };
type Slot = { slotNum: number; bookId: string | null };
type Employee = { status: string; name: string };

type Stats = {
  activeBooks: number;
  slotsFilled: number;
  totalSlots: number;
  pendingEmployees: number;
};

type ActivityItem = { ok: boolean; msg: string; time: string };

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400)return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)} d ago`;
}

export default function OwnerDashboard() {
  const { user } = useAuth();

  const [stats, setStats]      = useState<Stats | null>(null);
  const [slots, setSlots]      = useState<Slot[]>([]);
  const [activity, setActivity]= useState<ActivityItem[]>([]);
  const [loading, setLoading]  = useState(true);

  async function load() {
    setLoading(true);
    const [booksRes, slotsRes, empsRes] = await Promise.all([
      fetch("/api/inventory"),
      fetch("/api/slots"),
      fetch("/api/employees"),
    ]);

    const books: Book[]     = booksRes.ok  ? (await booksRes.json()).books      : [];
    const slotData: { slots: Slot[]; total: number } = slotsRes.ok ? await slotsRes.json() : { slots: [], total: 0 };
    const emps: Employee[]  = empsRes.ok   ? (await empsRes.json()).employees   : [];

    const activeBooks     = books.filter((b) => b.status === "active").length;
    const slotsFilled     = slotData.slots.filter((s) => s.bookId).length;
    const pendingEmployees= emps.filter((e) => e.status === "pending").length;

    setStats({ activeBooks, slotsFilled, totalSlots: slotData.total, pendingEmployees });
    setSlots(slotData.slots);

    // Build activity feed from recent events
    const events: ActivityItem[] = [];
    books
      .filter((b) => b.activatedAt)
      .sort((a, b) => new Date(b.activatedAt!).getTime() - new Date(a.activatedAt!).getTime())
      .slice(0, 2)
      .forEach((b) => events.push({ ok: true, msg: `${b.gameName} activated${b.slot ? ` — Slot ${b.slot}` : ""}`, time: timeAgo(b.activatedAt!) }));
    books
      .filter((b) => b.settledAt)
      .sort((a, b) => new Date(b.settledAt!).getTime() - new Date(a.settledAt!).getTime())
      .slice(0, 1)
      .forEach((b) => events.push({ ok: true, msg: `${b.gameName} settled`, time: timeAgo(b.settledAt!) }));
    emps
      .filter((e) => e.status === "pending")
      .slice(0, 2)
      .forEach((e) => events.push({ ok: false, msg: `${e.name} awaiting approval`, time: "recently" }));
    slotData.slots
      .filter((s) => !s.bookId)
      .slice(0, 1)
      .forEach((s) => events.push({ ok: false, msg: `Slot ${s.slotNum} is empty — no book assigned`, time: "" }));

    setActivity(events.slice(0, 5));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const STAT_CARDS = stats
    ? [
        { label: "Active Books",      value: String(stats.activeBooks),                         icon: BookOpen, color: "text-primary"  },
        { label: "Slots Filled",      value: `${stats.slotsFilled} / ${stats.totalSlots}`,      icon: GridFour, color: "text-emerald-500" },
        { label: "Pending Approvals", value: String(stats.pendingEmployees),                     icon: Users,    color: "text-amber-500"   },
        { label: "Inventory",         value: String(stats.activeBooks + (stats.totalSlots - stats.slotsFilled)), icon: Package, color: "text-purple-500" },
      ]
    : [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.orgName ?? "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <Link
            href="/owner/inventory"
            className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity font-medium shadow-sm"
          >
            + Add Book
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-2xl p-4 space-y-3">
                <div className="h-3 bg-muted rounded animate-pulse w-20" />
                <div className="h-8 bg-muted rounded animate-pulse w-12" />
                <div className="h-3 bg-muted rounded animate-pulse w-24" />
              </div>
            ))
          : STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="border rounded-2xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <Icon className={cn("size-4", color)} />
                </div>
                <p className="text-3xl font-black tracking-tight">{value}</p>
              </div>
            ))
        }
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Activity feed */}
        <div className="border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recent Activity</h2>
            {loading && <ArrowClockwise className="size-3.5 text-muted-foreground animate-spin" />}
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="size-4 rounded-full bg-muted animate-pulse shrink-0 mt-0.5" />
                  <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity yet. Add books and employees to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  {a.ok
                    ? <CheckCircle weight="fill" className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    : <Warning weight="fill" className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  }
                  <span className="flex-1 leading-snug">{a.msg}</span>
                  {a.time && <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Slot grid */}
        <div className="border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Slot Overview</h2>
            <Link href="/owner/slots" className="text-xs text-primary hover:underline font-medium">
              Manage →
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2">
                {slots.map((s) => (
                  <div
                    key={s.slotNum}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-semibold border gap-0.5 transition-colors",
                      s.bookId
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/40 text-muted-foreground border-dashed"
                    )}
                  >
                    <span>{s.slotNum}</span>
                    <span className="text-[9px] opacity-60">{s.bookId ? "active" : "empty"}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary/40 inline-block" />Active</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-muted-foreground/30 inline-block" />Empty</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick links — mobile only */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {[
          { label: "Inventory",        href: "/owner/inventory",  icon: Package },
          { label: "Activate / Settle",href: "/owner/books",      icon: BookOpen },
          { label: "Slots",            href: "/owner/slots",      icon: GridFour },
          { label: "Management",        href: "/owner/management", icon: Users },
        ].map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href}
            className="flex items-center gap-2.5 border rounded-2xl px-4 py-3.5 text-sm font-medium hover:bg-accent transition-colors">
            <Icon className="size-4 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
