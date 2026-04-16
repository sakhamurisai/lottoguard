"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Hourglass, Eye, EyeSlash, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Phase = "form" | "pending";

const FIELDS = [
  { key: "name",  label: "Full Name",    placeholder: "Alex Rivera",      type: "text"     },
  { key: "email", label: "Email",        placeholder: "alex@example.com", type: "email"    },
  { key: "phone", label: "Phone Number", placeholder: "614-555-0204",     type: "tel"      },
] as const;

export default function EmployeeRegisterPage() {
  const router = useRouter();
  const [phase, setPhase]       = useState<Phase>("form");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]       = useState("");
  const [codeErr, setCodeErr]   = useState("");
  const [confirm, setConfirm]   = useState("");
  const [form, setForm]         = useState({ name: "", email: "", phone: "", inviteCode: "", password: "" });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === "inviteCode") setCodeErr("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCodeErr("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:       form.name,
        email:      form.email,
        phone:      form.phone,
        inviteCode: form.inviteCode.trim().toUpperCase(),
        password:   form.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 400 && data.error?.toLowerCase().includes("invite")) {
        setCodeErr(data.error);
      } else {
        setError(data.error ?? "Registration failed. Please try again.");
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    // Redirect to email verify — after verify, employee goes to pending approval screen
    router.push(`/verify?email=${encodeURIComponent(form.email)}&redirect=/employee`);
    setPhase("pending");
  }

  if (phase === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center space-y-6">
        <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Hourglass weight="fill" className="size-10 text-primary" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h1 className="text-2xl font-bold">Registration Submitted</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your request has been sent to the store owner. You can sign in once they approve your account.
          </p>
        </div>
        <Link
          href="/login?role=employee"
          className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 bg-primary text-primary-foreground p-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <ShieldCheck weight="fill" className="size-7" />
          LottoGuard
        </Link>
        <div className="space-y-4">
          <p className="text-2xl font-bold leading-tight">Join your store's team.</p>
          <p className="text-primary-foreground/70 text-sm leading-relaxed">
            Get your invite code from your store owner, register, and start tracking shifts on day one.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/40">© {new Date().getFullYear()} LottoGuard</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2 font-bold text-xl justify-center">
            <ShieldCheck weight="fill" className="text-primary size-6" />
            LottoGuard
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create employee account</h1>
            <p className="text-muted-foreground text-sm mt-1">You'll need an invite code from your store owner.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type={type}
                  required
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>
            ))}

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
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

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  className={cn(
                    "w-full border rounded-xl px-4 py-2.5 pr-11 text-sm bg-background focus:outline-none focus:ring-2 transition",
                    confirm && confirm !== form.password
                      ? "border-destructive focus:ring-destructive/30"
                      : "focus:ring-primary/30"
                  )}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirm && confirm !== form.password && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <Warning className="size-3" />Passwords do not match
                </p>
              )}
            </div>

            {/* Invite code */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Invite Code</label>
              <input
                type="text"
                required
                placeholder="e.g. OH4821-XK9F"
                value={form.inviteCode}
                onChange={(e) => set("inviteCode", e.target.value)}
                className={cn(
                  "w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 transition font-mono uppercase tracking-widest",
                  codeErr ? "border-destructive focus:ring-destructive/30" : "focus:ring-primary/30"
                )}
              />
              {codeErr && <p className="text-xs text-destructive">{codeErr}</p>}
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading
                ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : "Request Access"
              }
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login?role=employee" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
