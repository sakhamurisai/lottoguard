import Link from "next/link";
import { TrendUp, Warning, CheckCircle } from "@phosphor-icons/react/dist/ssr";

const STATS = [
  { label: "Active Books", value: "12", sub: "+2 this week" },
  { label: "Slots Filled", value: "8 / 10", sub: "80% capacity" },
  { label: "Pending Approvals", value: "3", sub: "employees waiting" },
  { label: "Tickets Sold Today", value: "247", sub: "+14% vs yesterday" },
];

const ACTIVITY = [
  { ok: true,  msg: "Book #4821 activated — Slot 3",         time: "2 min ago" },
  { ok: false, msg: "Employee Maria Chen awaiting approval",  time: "18 min ago" },
  { ok: true,  msg: "Book #4799 settled — $1,240 collected", time: "1 hr ago" },
  { ok: false, msg: "Slot 7 empty — no book assigned",       time: "3 hr ago" },
];

export default function OwnerDashboard() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back — Quick Stop #1</p>
        </div>
        <Link
          href="/owner/inventory"
          className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + Add Book
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="border rounded-lg p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendUp className="size-3" />{s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Activity */}
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-sm">Recent Activity</h2>
          <ul className="space-y-2">
            {ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {a.ok
                  ? <CheckCircle weight="fill" className="size-4 text-green-500 mt-0.5 shrink-0" />
                  : <Warning weight="fill" className="size-4 text-yellow-500 mt-0.5 shrink-0" />}
                <span className="flex-1">{a.msg}</span>
                <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Slot grid */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Slots</h2>
            <Link href="/owner/slots" className="text-xs text-primary hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={`aspect-square rounded flex flex-col items-center justify-center text-xs font-medium border gap-0.5 ${
                  n <= 8
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted text-muted-foreground border-dashed"
                }`}
              >
                <span>{n}</span>
                <span className="text-[9px] opacity-60">{n <= 8 ? "active" : "empty"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
