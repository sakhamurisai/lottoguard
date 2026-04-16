"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, EnvelopeSimple } from "@phosphor-icons/react";

function VerifyContent() {
  const params = useSearchParams();
  const email    = params.get("email") ?? "";
  const redirect = params.get("redirect") ?? "/owner";

  const router = useRouter();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  function handleChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = char;
    setCode(next);
    if (char && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = [...code];
    digits.forEach((d, i) => { next[i] = d; });
    setCode(next);
    const focusIdx = Math.min(digits.length, 5);
    inputs.current[focusIdx]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length < 6) { setError("Enter all 6 digits."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Verification failed."); return; }

      // Always send to login — by the time the user types credentials, DynamoDB GSI is consistent
      const role = redirect.startsWith("/owner") ? "owner" : "employee";
      router.push(
        `/login?verified=1&role=${role}&email=${encodeURIComponent(email)}`
      );
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    setResendMsg("");
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "resend" }),
      });
      const data = await res.json();
      if (res.ok) setResendMsg("New code sent — check your inbox.");
      else setError(data.error ?? "Could not resend code.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setResending(false);
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
        <div className="space-y-4">
          <EnvelopeSimple className="size-12 opacity-80" />
          <p className="text-2xl font-bold leading-tight">Check your inbox.</p>
          <p className="text-sm text-primary-foreground/70">
            We sent a 6-digit code to<br />
            <span className="font-semibold text-primary-foreground">{email || "your email"}</span>
          </p>
        </div>
        <p className="text-xs text-primary-foreground/40">© {new Date().getFullYear()} LottoGuard</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="lg:hidden flex items-center gap-2 font-bold text-xl">
            <ShieldCheck weight="fill" className="text-primary size-6" />
            LottoGuard
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Enter the 6-digit code we sent to <span className="text-foreground font-medium">{email}</span>
            </p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            {/* OTP input */}
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-3 text-center">
                {error}
              </p>
            )}
            {resendMsg && (
              <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                {resendMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || code.join("").length < 6}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting
                ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : "Verify email"}
            </button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Didn&apos;t receive it?</p>
            <button
              onClick={resend}
              disabled={resending}
              className="text-sm text-primary font-medium hover:underline disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
