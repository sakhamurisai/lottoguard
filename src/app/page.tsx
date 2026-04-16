"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, Camera, Clock, GridFour, Users, Bell, ListChecks,
  ArrowRight, CheckCircle, Star, Ticket,
  Warning, TrendUp, Package, BookOpen, Truck,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MarketingNav } from "@/components/marketing-nav";

// ── Scroll reveal ─────────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal, .reveal-l, .reveal-r");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("revealed"); }),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired.current) {
        fired.current = true;
        const start = performance.now();
        const dur = 1400;
        const tick = (now: number) => {
          const t = Math.min((now - start) / dur, 1);
          setN(Math.round((1 - Math.pow(1 - t, 3)) * to));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Camera,
    title: "AI Receipt Scanning",
    body: "Photograph any delivery slip. Vision AI pulls game IDs, pack numbers, and ticket ranges — no manual data entry ever again.",
    accent: "#6366f1",
    bg: "bg-indigo-50",
    ic: "text-indigo-600",
  },
  {
    icon: Clock,
    title: "Shift Tracking",
    body: "Employees clock in with a ticket number, clock out, and the system auto-calculates tickets sold per shift with zero math on your end.",
    accent: "#0ea5e9",
    bg: "bg-sky-50",
    ic: "text-sky-600",
  },
  {
    icon: GridFour,
    title: "Slot Management",
    body: "A live kanban grid by price tier — $1 through $50. Assign active books to each slot. Gaps surface instantly.",
    accent: "#10b981",
    bg: "bg-emerald-50",
    ic: "text-emerald-600",
  },
  {
    icon: Users,
    title: "Employee Management",
    body: "Share an invite code. Approve registrations in one tap. Disable access the moment an employee leaves.",
    accent: "#f59e0b",
    bg: "bg-amber-50",
    ic: "text-amber-600",
  },
  {
    icon: Bell,
    title: "Fraud Alerts",
    body: "Ticket count mismatches, unmanned slots, unsettled books — you're notified before a discrepancy becomes a real loss.",
    accent: "#ef4444",
    bg: "bg-red-50",
    ic: "text-red-500",
  },
  {
    icon: ListChecks,
    title: "Full Audit Trail",
    body: "Every activation, settlement, shift, and employee action is timestamped and exportable — ready for Ohio Lottery compliance.",
    accent: "#8b5cf6",
    bg: "bg-violet-50",
    ic: "text-violet-600",
  },
];

const STEPS = [
  { num: "1", title: "Register your store", body: "Enter your org details and Ohio retail number. Account live in under 2 minutes." },
  { num: "2", title: "Onboard your team",   body: "Share your invite code. Employees register, you approve with a single tap."  },
  { num: "3", title: "Track every ticket",  body: "Scan receipts, assign slots, run shifts, settle books. Fraud has nowhere to hide." },
];

const TESTIMONIALS = [
  { quote: "We caught a $400 discrepancy on day one. LottoGuard paid for itself before the end of the first week.", name: "Michael R.", role: "Owner, Sunoco — Columbus, OH", initials: "MR" },
  { quote: "The receipt scanning alone saves my manager 45 minutes every delivery day. It's just fast.", name: "Sandra T.", role: "Owner, BP Express — Dayton, OH", initials: "ST" },
  { quote: "I can see exactly who sold what on every shift from my phone. No more guessing.", name: "Kevin L.", role: "Manager, Circle K — Cleveland, OH", initials: "KL" },
];

const PRICING = [
  {
    name: "Starter", price: 49, desc: "Single-location stores getting started.",
    features: ["Up to 5 employees", "Up to 10 lottery slots", "AI receipt scanning", "Shift tracking", "Email support"],
    cta: "Start free trial", href: "/owner/signup", highlight: false,
  },
  {
    name: "Professional", price: 99, desc: "Unlimited scale and priority support.",
    features: ["Unlimited employees", "Unlimited slots", "Everything in Starter", "Fraud alert notifications", "Priority support", "Compliance export"],
    cta: "Start free trial", href: "/owner/signup", highlight: true,
  },
];

const STATS = [
  { to: 500,  prefix: "",  suffix: "+",  label: "Ohio retailers"      },
  { to: 2100, prefix: "$", suffix: "K+", label: "Losses prevented"    },
  { to: 99,   prefix: "",  suffix: "%",  label: "Uptime guaranteed"   },
  { to: 45,   prefix: "",  suffix: "m",  label: "Saved per delivery"  },
];

const LOGOS = ["Sunoco", "BP Express", "Circle K", "Marathon", "Speedway", "GetGo", "Sheetz", "Thorntons"];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useReveal();

  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <MarketingNav />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white pt-16 pb-24 sm:pt-24 sm:pb-32">

        {/* Subtle radial gradient behind headline */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-[0.07]"
          style={{ background: "radial-gradient(ellipse at center top, oklch(0.50 0.260 264.4), transparent 70%)" }}
        />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8">

          {/* Top badge */}
          <div className="flex justify-center hero-1">
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Now live for Ohio Lottery retailers
            </span>
          </div>

          {/* Headline */}
          <div className="mt-8 text-center hero-2">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-foreground">
              Stop lottery fraud<br />
              <span className="text-gradient">before it costs you.</span>
            </h1>
          </div>

          {/* Subtext */}
          <p className="mt-6 text-center text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto hero-3">
            The all-in-one platform for Ohio gas stations — scan receipts in seconds, manage every shift, and get alerted the moment numbers don&rsquo;t add up.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 hero-4">
            <Link
              href="/owner/signup"
              className="group flex items-center gap-2.5 bg-primary text-primary-foreground px-7 py-3.5 rounded-2xl font-semibold text-sm shadow-md hover:opacity-90 transition-all hover:-translate-y-0.5 w-full sm:w-auto justify-center"
            >
              Start free trial — 14 days
              <ArrowRight weight="bold" className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 border px-7 py-3.5 rounded-2xl font-semibold text-sm hover:bg-muted/50 transition-all hover:-translate-y-0.5 w-full sm:w-auto justify-center"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground hero-4">
            No credit card required · Setup in under 5 minutes · Cancel anytime
          </p>

          {/* Dashboard mockup */}
          <div className="mt-16 hero-5">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ══ SOCIAL PROOF TICKER ═══════════════════════════════════════════════ */}
      <div className="border-y bg-muted/30 py-3 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap select-none">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-8 text-xs font-semibold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ══ STATS ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 border-b">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-4">
            {STATS.map((s, i) => (
              <div key={s.label} className={cn("text-center reveal")} style={{ transitionDelay: `${i * 75}ms` }}>
                <p className="text-4xl sm:text-5xl font-black tracking-tight text-gradient">
                  <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 sm:py-28 border-b bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4 reveal max-w-xl mx-auto">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Features</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Everything to run a<br />clean operation
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              From first scan to final settlement — the complete lottery workflow, handled.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {FEATURES.map(({ icon: Icon, title, body, bg, ic }) => (
              <div
                key={title}
                className="reveal group bg-white rounded-2xl border p-6 space-y-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={cn("size-10 rounded-xl flex items-center justify-center", bg)}>
                  <Icon weight="fill" className={cn("size-5", ic)} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-[15px]">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRODUCT SHOWCASE ══════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 border-b overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

            <div className="space-y-6 reveal-l">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">Dashboard</p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                Everything visible.<br />
                <span className="text-gradient">Nothing hidden.</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Your owner dashboard shows shipment history, active books, slot fill rates, shift data, and pending employee approvals — all on one screen.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Live slot grid with book and status per position",
                  "Shift-by-shift ticket comparison across all employees",
                  "One-tap approve or disable employees",
                  "Exportable audit log for Ohio Lottery compliance",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle weight="fill" className="size-4 text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/owner/signup"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all"
              >
                Try it free <ArrowRight weight="bold" className="size-4" />
              </Link>
            </div>

            <div className="reveal-r">
              <ShowcaseMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-28 border-b bg-[#fafafa]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4 reveal">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Up and running in minutes</h2>
            <p className="text-muted-foreground text-base">Three steps. No IT team needed.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6 relative">
            {/* Connector */}
            <div className="hidden sm:block absolute top-8 left-[calc(33.33%+16px)] right-[calc(33.33%+16px)] h-px bg-border" />
            {STEPS.map(({ num, title, body }, i) => (
              <div key={num} className={cn("reveal space-y-4")} style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="size-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                  <span className="text-xl font-black text-primary">{num}</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 border-b">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-3 reveal">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Testimonials</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Trusted by Ohio store owners</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 stagger">
            {TESTIMONIALS.map(({ quote, name, role, initials }, i) => (
              <div
                key={name}
                className="reveal bg-white rounded-2xl border p-7 space-y-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} weight="fill" className="size-3.5 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ═══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 sm:py-28 border-b bg-[#fafafa]">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4 reveal">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Pricing</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Simple, honest pricing</h2>
            <p className="text-muted-foreground text-base">14-day free trial. No credit card. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {PRICING.map((p, i) => (
              <div
                key={p.name}
                className={cn(
                  "reveal rounded-2xl p-7 space-y-6 transition-all duration-200",
                  p.highlight
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:-translate-y-1"
                    : "bg-white border hover:shadow-md hover:-translate-y-0.5"
                )}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {p.highlight && (
                  <span className="inline-block border border-white/30 text-[11px] font-bold px-3 py-0.5 rounded-full bg-white/15">
                    Most Popular
                  </span>
                )}
                <div>
                  <p className={cn("font-bold text-base", p.highlight ? "text-primary-foreground" : "")}>{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={cn("text-5xl font-black", p.highlight ? "text-primary-foreground" : "")}>
                      ${p.price}
                    </span>
                    <span className={cn("text-sm", p.highlight ? "text-primary-foreground/60" : "text-muted-foreground")}>/mo</span>
                  </div>
                  <p className={cn("text-sm mt-1.5", p.highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>{p.desc}</p>
                </div>
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle
                        weight="fill"
                        className={cn("size-4 shrink-0", p.highlight ? "text-primary-foreground/70" : "text-primary")}
                      />
                      <span className={p.highlight ? "text-primary-foreground/90" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={cn(
                    "block text-center py-3 rounded-xl text-sm font-bold transition-all",
                    p.highlight
                      ? "bg-white text-primary hover:bg-white/90"
                      : "border bg-background hover:bg-muted"
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 border-b bg-white">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center space-y-7 reveal">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Ticket weight="fill" className="size-7 text-primary" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Ready to protect<br />
            <span className="text-gradient">every ticket you sell?</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Join 500+ Ohio retailers trusting LottoGuard to protect their lottery revenue — every day, every shift.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/owner/signup"
              className="group flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md hover:opacity-90 transition-all hover:-translate-y-0.5"
            >
              Start your free trial
              <ArrowRight weight="bold" className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 border px-8 py-3.5 rounded-2xl font-semibold text-sm hover:bg-muted transition-all hover:-translate-y-0.5"
            >
              Sign in to dashboard
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">No credit card · 14-day trial · Full access from day one</p>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer className="border-t py-10 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5 font-bold text-sm">
            <div className="size-7 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck weight="fill" className="size-3.5 text-white" />
            </div>
            LottoGuard
          </div>
          <div className="flex gap-6">
            {["Features", "Pricing", "Privacy", "Terms", "Support"].map((l) => (
              <a key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LottoGuard. Built for Ohio retailers.</p>
        </div>
      </footer>
    </div>
  );
}

// ── Hero mockup ───────────────────────────────────────────────────────────────
function HeroMockup() {
  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Soft shadow base */}
      <div className="absolute -inset-3 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl blur-2xl" />

      {/* Browser shell */}
      <div className="relative rounded-2xl border shadow-2xl overflow-hidden bg-white">

        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-400" />
            <div className="size-3 rounded-full bg-yellow-400" />
            <div className="size-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4 bg-white border rounded-lg px-3 py-1 flex items-center gap-2">
            <ShieldCheck weight="fill" className="size-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-mono">app.lottoguard.io/owner</span>
          </div>
        </div>

        {/* App layout */}
        <div className="flex" style={{ height: "360px" }}>

          {/* Sidebar */}
          <div className="w-40 border-r bg-sidebar shrink-0 flex flex-col">
            <div className="flex items-center gap-2 px-4 py-4 border-b">
              <div className="size-6 rounded-lg bg-primary flex items-center justify-center">
                <ShieldCheck weight="fill" className="size-3.5 text-white" />
              </div>
              <span className="text-xs font-bold">LottoGuard</span>
            </div>
            <nav className="flex-1 p-2 space-y-0.5">
              {[
                { label: "Dashboard",  active: true  },
                { label: "Inventory",  active: false },
                { label: "Books",      active: false },
                { label: "Slots",      active: false },
                { label: "Management", active: false },
              ].map(({ label, active }) => (
                <div
                  key={label}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[11px] font-medium",
                    active ? "bg-accent text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </div>
              ))}
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 p-5 space-y-4 overflow-hidden bg-[#fafafa]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Dashboard</p>
                <p className="text-[10px] text-muted-foreground">Sunoco Columbus · Updated just now</p>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Truck,     label: "Shipments",   val: "14",    color: "text-primary"      },
                { icon: Package,   label: "Total Books", val: "87",    color: "text-purple-500"   },
                { icon: BookOpen,  label: "Active",      val: "12",    color: "text-emerald-500"  },
                { icon: GridFour,  label: "Slots",       val: "8/10",  color: "text-blue-500"     },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    <s.icon className={cn("size-3", s.color)} weight="fill" />
                  </div>
                  <p className="text-lg font-black">{s.val}</p>
                </div>
              ))}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Activity */}
              <div className="bg-white rounded-xl border p-3 space-y-2">
                <p className="text-[10px] font-semibold">Recent Activity</p>
                {[
                  { ok: true,  msg: "Shipment received — 24 books" },
                  { ok: true,  msg: "Lucky 7s activated — Slot 4"  },
                  { ok: false, msg: "2 employees awaiting approval" },
                ].map((a) => (
                  <div key={a.msg} className="flex items-center gap-2">
                    <div className={cn("size-1.5 rounded-full shrink-0", a.ok ? "bg-emerald-500" : "bg-amber-400")} />
                    <span className="text-[9px] text-muted-foreground truncate">{a.msg}</span>
                  </div>
                ))}
              </div>
              {/* Slot grid */}
              <div className="bg-white rounded-xl border p-3 space-y-2">
                <p className="text-[10px] font-semibold">Slot Overview</p>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <div
                      key={n}
                      className={cn(
                        "aspect-square rounded-md flex items-center justify-center font-bold",
                        n <= 8
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-dashed"
                      )}
                      style={{ fontSize: "8px" }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — bottom right */}
      <div className="absolute -bottom-4 -right-4 bg-white border rounded-2xl shadow-xl p-3 flex items-center gap-2.5 animate-float">
        <div className="size-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <CheckCircle weight="fill" className="size-4.5 text-emerald-500" />
        </div>
        <div>
          <p className="text-[11px] font-bold">Fraud prevented</p>
          <p className="text-[9px] text-muted-foreground">Ticket gap detected · Slot 3</p>
        </div>
      </div>

      {/* Floating badge — top left */}
      <div className="absolute -top-4 -left-4 bg-white border rounded-2xl shadow-xl p-3 flex items-center gap-2.5 animate-float" style={{ animationDelay: "1.5s" }}>
        <div className="size-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Warning weight="fill" className="size-4.5 text-amber-500" />
        </div>
        <div>
          <p className="text-[11px] font-bold">Alert</p>
          <p className="text-[9px] text-muted-foreground">3 slots empty</p>
        </div>
      </div>
    </div>
  );
}

// ── Showcase mockup ───────────────────────────────────────────────────────────
function ShowcaseMockup() {
  const TIERS = [
    { label: "$1",  filled: 5, total: 6, c: "bg-green-100 text-green-700 border-green-200"    },
    { label: "$5",  filled: 6, total: 6, c: "bg-blue-100 text-blue-700 border-blue-200"       },
    { label: "$10", filled: 3, total: 5, c: "bg-violet-100 text-violet-700 border-violet-200" },
    { label: "$20", filled: 2, total: 4, c: "bg-purple-100 text-purple-700 border-purple-200" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-3 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl blur-2xl" />

      <div className="relative rounded-2xl border shadow-xl overflow-hidden bg-white">
        {/* Chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400" />
            <div className="size-2.5 rounded-full bg-yellow-400" />
            <div className="size-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-3 bg-white border rounded px-2 py-0.5">
            <span className="text-[9px] text-muted-foreground font-mono">app.lottoguard.io/owner/slots</span>
          </div>
        </div>

        <div className="flex">
          {/* Mini sidebar */}
          <div className="w-28 border-r bg-sidebar shrink-0 p-2 space-y-0.5">
            {["Dashboard", "Inventory", "Books", "Slots", "Management"].map((item, i) => (
              <div key={item} className={cn("px-2 py-1.5 rounded-md text-[9px] font-medium",
                i === 3 ? "bg-accent text-foreground" : "text-muted-foreground")}>
                {item}
              </div>
            ))}
          </div>

          {/* Slots content */}
          <div className="flex-1 p-4 space-y-3 bg-[#fafafa]">
            <div>
              <p className="text-xs font-bold">Slots</p>
              <p className="text-[9px] text-muted-foreground">16 / 21 filled</p>
            </div>

            {TIERS.map((tier) => (
              <div key={tier.label} className="flex items-center gap-2">
                <div className={cn("w-10 shrink-0 rounded-lg border px-1.5 py-2 text-center", tier.c)}>
                  <p className="text-[10px] font-black leading-none">{tier.label}</p>
                  <p className="text-[7px] mt-0.5 opacity-70">{tier.filled}/{tier.total}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: tier.total }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-12 h-10 rounded-lg border flex flex-col items-center justify-center gap-0.5",
                        i < tier.filled
                          ? cn(tier.c, "opacity-90")
                          : "bg-white text-muted-foreground border-dashed"
                      )}
                    >
                      <span className="text-[7px] font-bold opacity-60">#{i + 1}</span>
                      <span className="text-[6px] opacity-60">{i < tier.filled ? "active" : "empty"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Callout bubble */}
      <div className="absolute -bottom-3 -right-3 bg-white border rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
        <TrendUp weight="fill" className="size-3.5 text-primary" />
        <p className="text-[10px] font-semibold">All $5 slots active</p>
      </div>
    </div>
  );
}
