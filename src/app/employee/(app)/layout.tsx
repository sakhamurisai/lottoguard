"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock, GridFour, ShieldCheck, SignOut,
  CaretLeft, CaretRight, List, X, Bell, ChartBar,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/components/auth-provider";

const ALERTS_KEY = "lg_emp_alerts";

function getAlertCount(userId: string): number {
  try {
    const raw = localStorage.getItem(`${ALERTS_KEY}_${userId}`);
    if (!raw) return 0;
    return (JSON.parse(raw) as { severity: string }[]).filter(
      (a) => a.severity === "error"
    ).length;
  } catch { return 0; }
}

const NAV = [
  { label: "Clock In/Out", icon: Clock,    href: "/employee",           exact: true  },
  { label: "Dashboard",    icon: ChartBar, href: "/employee/dashboard", exact: false },
  { label: "Alerts",       icon: Bell,     href: "/employee/alerts",    exact: false, alertBadge: true },
  { label: "Slots",        icon: GridFour, href: "/employee/slots",     exact: false },
] as const;

function Sidebar({
  collapsed,
  setCollapsed,
  onClose,
  alertCount,
}: {
  collapsed: boolean;
  setCollapsed?: (v: boolean) => void;
  onClose?: () => void;
  alertCount: number;
}) {
  const path = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login?role=employee");
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r bg-sidebar transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-56"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b shrink-0",
          collapsed ? "justify-center px-2 py-5" : "justify-between px-4 py-5"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 font-bold text-sidebar-foreground overflow-hidden">
            <ShieldCheck weight="fill" className="text-primary size-5 shrink-0" />
            <span className="text-sm truncate">LottoGuard</span>
          </div>
        )}
        {collapsed && (
          <ShieldCheck weight="fill" className="text-primary size-5" />
        )}

        {onClose ? (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        ) : setCollapsed ? (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0"
          >
            {collapsed ? (
              <CaretRight className="size-3.5" />
            ) : (
              <CaretLeft className="size-3.5" />
            )}
          </button>
        ) : null}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, icon: Icon, href, exact, ...rest }) => {
          const hasBadge = "alertBadge" in rest && rest.alertBadge;
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition-all",
                collapsed && "justify-center",
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" weight={active ? "fill" : "regular"} />
              {!collapsed && <span className="truncate flex-1">{label}</span>}
              {hasBadge && alertCount > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none",
                    collapsed ? "absolute -top-1 -right-1" : "",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-destructive text-white"
                  )}
                >
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout footer */}
      <div className="border-t p-2 space-y-0.5 shrink-0">
        {!collapsed && (
          <div className="px-2.5 py-2 rounded-xl bg-muted/60 mb-0.5">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.orgName}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center gap-3 px-2.5 py-2.5 w-full rounded-xl text-sm text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors",
            collapsed && "justify-center"
          )}
        >
          <SignOut className="size-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

function EmployeeShell({ children }: { children: React.ReactNode }) {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [alertCount,  setAlertCount]  = useState(0);
  const { user } = useAuth();
  const path = usePathname();

  // Refresh badge when navigating (covers the case where alerts page clears them)
  useEffect(() => {
    if (!user?.id) return;
    setAlertCount(getAlertCount(user.id));
  }, [user?.id, path]);

  const currentPage = NAV.find((n) =>
    n.exact ? path === n.href : path.startsWith(n.href)
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — sticky full-height */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          alertCount={alertCount}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-56 h-full shadow-2xl">
            <Sidebar
              collapsed={false}
              alertCount={alertCount}
              onClose={() => setMobileOpen(false)}
            />
          </div>
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 border-b px-4 py-3 sticky top-0 bg-card/90 backdrop-blur-md z-40">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground"
          >
            <List className="size-5" />
          </button>
          <div className="flex items-center gap-2 font-bold text-sm flex-1">
            <ShieldCheck weight="fill" className="text-primary size-4" />
            {currentPage?.label ?? "LottoGuard"}
          </div>
          {alertCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-white min-w-[18px] text-center">
              {alertCount}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function EmployeeAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard role="employee">
      <EmployeeShell>{children}</EmployeeShell>
    </AuthGuard>
  );
}
