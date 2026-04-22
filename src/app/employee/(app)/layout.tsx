"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/components/auth-provider";

function EmployeeShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() { logout(); router.push("/login?role=employee"); }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b px-4 py-3 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md z-40">
        <div className="flex items-center gap-2.5 font-semibold">
          <ShieldCheck className="text-primary size-5" />
          <span className="hidden sm:inline text-sm">LottoGuard</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.orgName}</p>
          </div>
          <div className="sm:hidden text-right">
            <p className="text-sm font-medium leading-none">{user?.name?.split(" ")[0]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

export default function EmployeeAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="employee">
      <EmployeeShell>{children}</EmployeeShell>
    </AuthGuard>
  );
}
