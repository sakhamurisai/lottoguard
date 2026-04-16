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

export function MarketingNav() {
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/90 backdrop-blur-xl border-b shadow-sm"
          : "bg-white border-b"
      )}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-[15px] shrink-0">
          <div className="size-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <ShieldCheck weight="fill" className="size-4 text-white" />
          </div>
          <span>LottoGuard</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/60 font-medium"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted/60 font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/owner/signup"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          {open ? <X className="size-5" /> : <List className="size-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t bg-white px-5 py-3 space-y-1">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/60 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t mt-2">
            <Link href="/login" onClick={() => setOpen(false)}
              className="text-sm text-center border rounded-xl py-2.5 font-medium hover:bg-muted transition-colors">
              Sign in
            </Link>
            <Link href="/owner/signup" onClick={() => setOpen(false)}
              className="text-sm text-center bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold hover:opacity-90 transition-opacity">
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
