"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type Tab = "owner" | "employee";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [tab, setTab] = useState<Tab>((params.get("role") as Tab) ?? "owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(user.role === "owner" ? "/owner" : "/employee");
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, tab);
      router.push(tab === "owner" ? "/owner" : "/employee");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-primary text-primary-foreground p-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <ShieldCheck weight="fill" className="size-7" />
          LottoGuard
        </Link>
        <div className="space-y-4">
          <p className="text-3xl font-bold leading-tight">Protect every ticket, every shift.</p>
          <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-xs">
            500+ Ohio retailers trust LottoGuard to prevent scratch-off fraud and keep their lottery operation clean.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/40">© {new Date().getFullYear()} LottoGuard</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-7">
          <Link href="/" className="lg:hidden flex items-center gap-2 font-bold text-xl justify-center">
            <ShieldCheck weight="fill" className="text-primary size-6" />
            LottoGuard
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Role tabs */}
          <div className="flex bg-muted rounded-xl p-1">
            {(["owner", "employee"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize",
                  tab === t
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "owner" ? "Owner / Manager" : "Employee"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 pr-11 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
            >
              {loading
                ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : <><span>Sign In</span><ArrowRight weight="bold" className="size-4" /></>
              }
            </button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {tab === "owner"
              ? <>New store? <Link href="/owner/signup" className="text-primary font-medium hover:underline">Register your organization</Link></>
              : <>New employee? <Link href="/employee/register" className="text-primary font-medium hover:underline">Register with invite code</Link></>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
