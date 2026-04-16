"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House, Package, ToggleLeft, GridFour,
  UsersThree, Gear, SignOut, List, X, ShieldCheck,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { AuthGuard } from "@/components/auth-guard";

const NAV = [
  { label: "Dashboard",         icon: House,       href: "/owner" },
  { label: "Inventory",         icon: Package,     href: "/owner/inventory" },
  { label: "Activate / Settle", icon: ToggleLeft,  href: "/owner/books" },
  { label: "Slots",             icon: GridFour,    href: "/owner/slots" },
  { label: "Management",        icon: UsersThree,  href: "/owner/management" },
  { label: "Settings",          icon: Gear,        href: "/owner/settings" },
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
    <aside className="flex flex-col w-60 h-full border-r bg-sidebar">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b">
        <div className="flex items-center gap-2.5 font-bold text-sidebar-foreground">
          <ShieldCheck weight="fill" className="text-primary size-5" />
          LottoGuard
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground p-1 rounded-lg">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, icon: Icon, href }) => {
          const active = href === "/owner" ? path === "/owner" : path.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-3 space-y-0.5">
        <div className="px-3 py-2 rounded-xl bg-muted/40">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name}</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">{user?.orgName}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
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
  const path = usePathname();

  const currentPage = NAV.find((n) =>
    n.href === "/owner" ? path === "/owner" : path.startsWith(n.href)
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="w-64 h-full shadow-2xl">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 border-b px-4 py-3 sticky top-0 bg-background/80 backdrop-blur-md z-40">
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
        </header>

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
