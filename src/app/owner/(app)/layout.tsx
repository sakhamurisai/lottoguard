"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck, Package, ToggleLeft, GridFour,
  Users, Gear, SignOut, List, X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { AuthGuard } from "@/components/auth-guard";

const NAV = [
  { label: "Dashboard",        icon: ShieldCheck, href: "/owner" },
  { label: "Inventory",        icon: Package,     href: "/owner/inventory" },
  { label: "Activate / Settle",icon: ToggleLeft,  href: "/owner/books" },
  { label: "Slots",            icon: GridFour,    href: "/owner/slots" },
  { label: "Employees",        icon: Users,       href: "/owner/employees" },
  { label: "Settings",         icon: Gear,        href: "/owner/settings" },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const path = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login?role=owner");
  }

  return (
    <aside className="flex flex-col w-56 h-full border-r bg-sidebar">
      <div className="flex items-center justify-between px-4 py-5 border-b">
        <div className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <ShieldCheck weight="fill" className="text-primary size-5" />
          LottoGuard
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, icon: Icon, href }) => {
          const active = href === "/owner" ? path === "/owner" : path.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 space-y-0.5">
        <div className="px-3 py-1.5">
          <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name}</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">{user?.orgName}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <SignOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="w-56 h-full shadow-xl">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 border-b px-4 py-3 sticky top-0 bg-background/80 backdrop-blur-md z-40">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <List className="size-5" />
          </button>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <ShieldCheck weight="fill" className="text-primary size-4" />
            LottoGuard
          </div>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="owner">
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}
