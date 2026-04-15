"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Eye, EyeSlash, CheckCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";

type Step = 0 | 1;

const ORG_FIELDS: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: "orgName",   label: "Organization Name",       placeholder: "Quick Stop #1" },
  { key: "llcName",   label: "LLC Name",                placeholder: "Quick Stop LLC" },
  { key: "address",   label: "Street Address",          placeholder: "1234 Main St, Columbus, OH 43201" },
  { key: "retailNum", label: "Ohio Retail Number",      placeholder: "OH-4821" },
  { key: "phone",     label: "Phone Number",            placeholder: "614-555-0199" },
  { key: "slots",     label: "Number of Lottery Slots", placeholder: "10", type: "number" },
];

export default function OwnerSignupPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    orgName: "", llcName: "", address: "", retailNum: "", phone: "", slots: "",
    email: "", password: "",
  });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 0) { setStep(1); return; }

    setSubmitting(true);
    try {
      // 1. Create account
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slots: Number(form.slots) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Signup failed");

      // 2. Auto-login
      await login(form.email, form.password, "owner");
      router.push("/owner");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] shrink-0 bg-primary text-primary-foreground p-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <ShieldCheck weight="fill" className="size-7" />
          LottoGuard
        </Link>
        <div className="space-y-5">
          <p className="text-2xl font-bold leading-tight">Start protecting your store today.</p>
          <ul className="space-y-3">
            {["Free 14-day trial", "Setup in under 5 minutes", "No credit card required", "Cancel anytime"].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-primary-foreground/80">
                <CheckCircle weight="fill" className="size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/40">© {new Date().getFullYear()} LottoGuard</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-7">
          <Link href="/" className="lg:hidden flex items-center gap-2 font-bold text-xl">
            <ShieldCheck weight="fill" className="text-primary size-6" />
            LottoGuard
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground text-sm mt-1">Step {step + 1} of 2 — {step === 0 ? "Organization details" : "Account credentials"}</p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <form onSubmit={next} className="space-y-4">
            {step === 0 && ORG_FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type={type ?? "text"}
                  required
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>
            ))}

            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email address</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="owner@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      className="w-full border rounded-xl px-4 py-2.5 pr-11 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  By creating an account you agree to our{" "}
                  <a href="#" className="text-primary hover:underline">Terms</a> and{" "}
                  <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
                </p>
              </>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              {step > 0 && (
                <button type="button" onClick={() => setStep(0)}
                  className="flex-1 border rounded-xl py-3 text-sm font-medium hover:bg-muted transition-colors">
                  ← Back
                </button>
              )}
              <button type="submit" disabled={submitting}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
                {submitting
                  ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  : step === 0 ? "Continue →" : "Create Account"
                }
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login?role=owner" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
