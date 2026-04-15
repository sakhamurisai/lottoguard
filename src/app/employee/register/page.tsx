"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Hourglass } from "@phosphor-icons/react";

type Phase = "form" | "pending";

export default function EmployeeRegisterPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", inviteCode: "" });
  const [codeError, setCodeError] = useState("");

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === "inviteCode") setCodeError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    // Validate invite code (demo)
    if (form.inviteCode.toUpperCase() !== "QS1-4821-XK") {
      setCodeError("Invalid invite code. Ask your store owner for the correct code.");
      setLoading(false);
      return;
    }

    // TODO: POST /api/auth/employee-register
    setLoading(false);
    setPhase("pending");
  }

  if (phase === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center space-y-5">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Hourglass weight="fill" className="size-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Registration Submitted!</h1>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            Your request has been sent to the store owner. You&apos;ll be able to log in once they approve your account.
          </p>
        </div>
        <Link
          href="/login?role=employee"
          className="text-sm bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:opacity-90 transition-opacity font-medium"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg">
            <ShieldCheck weight="fill" className="text-primary size-6" />
            LottoGuard
          </Link>
          <h1 className="text-xl font-bold">Create employee account</h1>
          <p className="text-muted-foreground text-sm">You need an invite code from your store owner.</p>
        </div>

        <form onSubmit={submit} className="border rounded-xl p-6 space-y-4 bg-card">
          {[
            { key: "name",       label: "Full Name",     placeholder: "Alex Rivera",      type: "text"  },
            { key: "email",      label: "Email",         placeholder: "alex@example.com", type: "email" },
            { key: "phone",      label: "Phone Number",  placeholder: "614-555-0204",     type: "tel"   },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-sm font-medium block mb-1.5">{label}</label>
              <input
                type={type}
                required
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}

          <div>
            <label className="text-sm font-medium block mb-1.5">Invite Code</label>
            <input
              type="text"
              required
              placeholder="QS1-4821-XK"
              value={form.inviteCode}
              onChange={(e) => set("inviteCode", e.target.value)}
              className={`w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 ${codeError ? "border-destructive focus:ring-destructive/40" : "focus:ring-primary/40"}`}
            />
            {codeError && <p className="text-xs text-destructive mt-1">{codeError}</p>}
          </div>

          {/* Demo hint */}
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            Demo invite code: <span className="font-mono font-medium text-foreground">QS1-4821-XK</span>
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />}
            {loading ? "Submitting…" : "Request Access"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login?role=employee" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
