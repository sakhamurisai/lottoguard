"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, List, X } from "@phosphor-icons/react";

const LINKS = [
  { label: "Features",    href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing",     href: "#pricing" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <ShieldCheck weight="fill" className="text-primary size-6" />
          LottoGuard
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link
            href="/owner/signup"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity font-medium"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen((v) => !v)} className="md:hidden text-muted-foreground hover:text-foreground">
          {open ? <X className="size-5" /> : <List className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t bg-background px-4 py-4 space-y-2">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2 border-t mt-2">
            <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-center border rounded-md py-2 hover:bg-muted">Sign In</Link>
            <Link href="/owner/signup" onClick={() => setOpen(false)} className="text-sm text-center bg-primary text-primary-foreground rounded-md py-2 hover:opacity-90">Start Free Trial</Link>
          </div>
        </div>
      )}
    </header>
  );
}
