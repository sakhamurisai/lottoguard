"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck, List, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Features",     href: "#features"     },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing",      href: "#pricing"      },
];

export function MarketingNav({ dark = false, ivory = false }: { dark?: boolean; ivory?: boolean }) {
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  if (ivory) {
    return (
      <header
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background:   scrolled ? "rgba(248,245,239,0.92)" : "#F8F5EF",
          borderBottom: scrolled ? "1px solid rgba(43,92,63,0.1)" : "1px solid rgba(43,92,63,0.08)",
          backdropFilter: scrolled ? "blur(16px) saturate(1.4)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-[15px] shrink-0" style={{ color: "#2B5C3F" }}>
            <div className="size-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg,#2B5C3F,#3A7A52)" }}>
              <ShieldCheck weight="fill" className="size-4 text-white" />
            </div>
            LottoGuard
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {LINKS.map((l) => (
              <a key={l.label} href={l.href}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ color: "#6B6356" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#2B5C3F")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6356")}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Link href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: "#6B6356" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2B5C3F")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6356")}
            >
              Sign in
            </Link>
            <Link href="/owner/signup"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-[1.03] hover:shadow-md"
              style={{ background: "linear-gradient(135deg,#2B5C3F,#3A7A52)", color: "#fff", boxShadow: "0 2px 12px rgba(43,92,63,0.25)" }}
            >
              Get started free
            </Link>
          </div>

          <button onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl transition-colors"
            style={{ color: "#6B6356" }}
          >
            {open ? <X className="size-5" /> : <List className="size-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden px-5 py-3 space-y-1 border-t"
            style={{ background: "rgba(248,245,239,0.98)", borderColor: "rgba(43,92,63,0.1)", backdropFilter: "blur(16px)" }}
          >
            {LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ color: "#6B6356" }}
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2 border-t mt-2" style={{ borderColor: "rgba(43,92,63,0.1)" }}>
              <Link href="/login" onClick={() => setOpen(false)}
                className="text-sm text-center rounded-xl py-2.5 font-medium border transition-colors"
                style={{ color: "#6B6356", borderColor: "rgba(43,92,63,0.15)" }}
              >
                Sign in
              </Link>
              <Link href="/owner/signup" onClick={() => setOpen(false)}
                className="text-sm text-center rounded-xl py-2.5 font-semibold"
                style={{ background: "linear-gradient(135deg,#2B5C3F,#3A7A52)", color: "#fff" }}
              >
                Get started free
              </Link>
            </div>
          </div>
        )}
      </header>
    );
  }

  if (dark) {
    return (
      <header
        className="sticky top-0 z-50 transition-all duration-500"
        style={{
          background:   scrolled ? "rgba(7,13,24,0.88)" : "transparent",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(1.5)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-bold text-[15px] shrink-0" style={{ color: "#f0f4f8" }}>
            <div className="size-8 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#00c9a7,#00a887)" }}>
              <ShieldCheck weight="fill" className="size-4 text-white" />
            </div>
            LottoGuard
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {LINKS.map((l) => (
              <a key={l.label} href={l.href}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Link href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: "rgba(255,255,255,0.45)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
            >
              Sign in
            </Link>
            <Link href="/owner/signup"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-[1.03] hover:shadow-lg"
              style={{ background: "linear-gradient(135deg,#00c9a7,#00a887)", color: "#fff", boxShadow: "0 2px 12px rgba(0,201,167,0.25)" }}
            >
              Get started free
            </Link>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {open ? <X className="size-5" /> : <List className="size-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden px-5 py-3 space-y-1 border-t"
            style={{ background: "rgba(7,13,24,0.98)", borderColor: "rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}
          >
            {LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2 border-t mt-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <Link href="/login" onClick={() => setOpen(false)}
                className="text-sm text-center rounded-xl py-2.5 font-medium border transition-colors"
                style={{ color: "rgba(255,255,255,0.55)", borderColor: "rgba(255,255,255,0.1)" }}
              >
                Sign in
              </Link>
              <Link href="/owner/signup" onClick={() => setOpen(false)}
                className="text-sm text-center rounded-xl py-2.5 font-semibold"
                style={{ background: "linear-gradient(135deg,#00c9a7,#00a887)", color: "#fff" }}
              >
                Get started free
              </Link>
            </div>
          </div>
        )}
      </header>
    );
  }

  /* ── Light mode (app pages) ─────────────────────────────────── */
  return (
    <header className={cn(
      "sticky top-0 z-50 transition-all duration-300",
      scrolled ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm" : "bg-background border-b border-border"
    )}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-[15px] text-foreground shrink-0">
          <div className="size-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <ShieldCheck weight="fill" className="size-4 text-primary-foreground" />
          </div>
          LottoGuard
        </Link>
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted font-medium"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted font-medium">
            Sign in
          </Link>
          <Link href="/owner/signup" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm">
            Get started free
          </Link>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="md:hidden p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors">
          {open ? <X className="size-5" /> : <List className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background px-5 py-3 space-y-1">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t border-border mt-2">
            <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-center border border-border text-foreground rounded-xl py-2.5 font-medium hover:bg-muted transition-colors">Sign in</Link>
            <Link href="/owner/signup" onClick={() => setOpen(false)} className="text-sm text-center bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold hover:opacity-90 transition-opacity">Get started free</Link>
          </div>
        </div>
      )}
    </header>
  );
}
