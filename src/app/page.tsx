"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, Camera, Clock, GridFour, Users, Bell, ListChecks,
  ArrowRight, CheckCircle, Star, Ticket,
  Warning, TrendUp, Package, BookOpen, Truck,
  Lock, FileText, ChartLineUp,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MarketingNav } from "@/components/marketing-nav";



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
        const dur = 1500;
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

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={cn(
      "text-[11px] font-bold uppercase tracking-[0.12em]",
      light ? "text-zinc-400" : "text-primary"
    )}>
      {children}
    </p>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Camera,
    title: "AI Receipt Scanning",
    body: "Photograph any delivery slip. Vision AI pulls game IDs, pack numbers, and ticket ranges in seconds — no manual entry, no transcription errors.",
    bg: "bg-indigo-50", ic: "text-indigo-600", border: "border-indigo-100",
  },
  {
    icon: Clock,
    title: "Shift-Level Tracking",
    body: "Employees clock in with a starting ticket and out with an ending ticket. Tickets sold, time on shift, and cash drawer reconciliation — all automatic.",
    bg: "bg-sky-50", ic: "text-sky-600", border: "border-sky-100",
  },
  {
    icon: GridFour,
    title: "Visual Slot Board",
    body: "A live grid organized by price tier — $1 through $50. Assign active books to each slot. Gaps and mismatches surface the moment they occur.",
    bg: "bg-emerald-50", ic: "text-emerald-600", border: "border-emerald-100",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    body: "Owners and employees see different interfaces. Share an invite code, approve registrations with one tap, revoke access the moment someone leaves.",
    bg: "bg-amber-50", ic: "text-amber-600", border: "border-amber-100",
  },
  {
    icon: Bell,
    title: "Real-Time Fraud Alerts",
    body: "Ticket count mismatches, drawer over/short, empty slots, unassigned books — you get a push notification before small gaps become real losses.",
    bg: "bg-red-50", ic: "text-red-500", border: "border-red-100",
  },
  {
    icon: ListChecks,
    title: "Complete Audit Trail",
    body: "Every activation, settlement, shift, and employee action is timestamped, attributable, and exportable — ready for Ohio Lottery compliance reviews.",
    bg: "bg-violet-50", ic: "text-violet-600", border: "border-violet-100",
  },
];

const STEPS = [
  { num: "01", title: "Register your store",  body: "Enter your org details and Ohio retail number. Your account is live in under 2 minutes with no IT setup required." },
  { num: "02", title: "Onboard your team",    body: "Share a single invite code. Employees self-register and you approve each one with a single tap from your dashboard."  },
  { num: "03", title: "Track every ticket",   body: "Scan receipts, assign books to slots, run shifts, and settle books. Every discrepancy surfaces automatically." },
];

const TESTIMONIALS = [
  {
    quote: "We caught a $400 discrepancy on day one. LottoGuard paid for itself before the end of the first week.",
    name: "Michael R.", role: "Owner — Sunoco, Columbus OH", initials: "MR",
  },
  {
    quote: "The receipt scanning alone saves my manager 45 minutes every delivery day. The ROI is immediate.",
    name: "Sandra T.", role: "Owner — BP Express, Dayton OH", initials: "ST",
  },
  {
    quote: "I can see exactly who sold what on every shift from my phone. No more guessing at end of day.",
    name: "Kevin L.", role: "Manager — Circle K, Cleveland OH", initials: "KL",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: 49,
    desc: "Single-location stores getting organized.",
    features: [
      "Up to 5 employees",
      "Up to 10 lottery slots",
      "AI receipt scanning",
      "Shift tracking & clock in/out",
      "Email support",
    ],
    cta: "Start free trial",
    href: "/owner/signup",
    highlight: false,
  },
  {
    name: "Professional",
    price: 99,
    desc: "Unlimited scale with priority support.",
    features: [
      "Unlimited employees",
      "Unlimited slots",
      "Everything in Starter",
      "Real-time fraud alerts",
      "Compliance export",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/owner/signup",
    highlight: true,
  },
];

const STATS = [
  { to: 500,  prefix: "",  suffix: "+",  label: "Ohio retailers"      },
  { to: 2100, prefix: "$", suffix: "K+", label: "Losses prevented"    },
  { to: 99,   prefix: "",  suffix: "%",  label: "Uptime guaranteed"   },
  { to: 45,   prefix: "",  suffix: "m",  label: "Saved per delivery"  },
];

const LOGOS = ["Sunoco", "BP Express", "Circle K", "Marathon", "Speedway", "GetGo", "Sheetz", "Thorntons"];

const COMPLIANCE = [
  { icon: ListChecks, title: "Full Audit Log",        body: "Every activation, clock-in, settlement, and employee action is timestamped and permanently recorded." },
  { icon: Lock,       title: "Role-Based Access",      body: "Owners and employees see only what they need. Access revokes instantly when an employee leaves." },
  { icon: FileText,   title: "Compliance Export",      body: "One-click export of shift data, inventory history, and discrepancy reports — formatted for Ohio Lottery reviews." },
  { icon: ChartLineUp, title: "Discrepancy Detection", body: "Drawer reconciliation runs automatically at every clock-out. Over/short notifications reach owners within seconds." },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {


  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 antialiased">
      <MarketingNav />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28"
        style={{ backgroundColor: "#F8F8F6" }}>

        {/* Subtle dot grid */}
        <div className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.055) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Faint radial light at top */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse at center top, oklch(0.50 0.260 264.4), transparent 65%)" }}
        />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8">

          {/* Badge */}
          <div className="flex justify-center hero-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-zinc-200 shadow-sm px-4 py-1.5 text-[11px] font-semibold text-zinc-500">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live for Ohio Lottery retailers
            </span>
          </div>

          {/* Headline */}
          <div className="mt-7 text-center hero-2">
            <h1 className="text-[2.75rem] sm:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-black tracking-tighter leading-[1.0] text-zinc-950">
              Stop lottery fraud<br />
              <span className="text-gradient">before it costs you.</span>
            </h1>
          </div>

          {/* Subtext */}
          <p className="mt-6 text-center text-base sm:text-lg text-zinc-500 leading-relaxed max-w-xl mx-auto hero-3">
            The all-in-one operations platform for Ohio gas stations. Scan receipts in seconds, manage every shift, and get alerted the moment numbers don&rsquo;t add up.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 hero-4">
            <Link
              href="/owner/signup"
              className="group inline-flex items-center gap-2.5 bg-primary text-primary-foreground px-7 py-3.5 rounded-2xl font-bold text-sm shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all w-full sm:w-auto justify-center"
            >
              Start free trial — 14 days
              <ArrowRight weight="bold" className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white border border-zinc-200 px-7 py-3.5 rounded-2xl font-semibold text-sm text-zinc-700 hover:bg-zinc-50 hover:-translate-y-0.5 transition-all w-full sm:w-auto justify-center shadow-sm"
            >
              Sign in to dashboard
            </Link>
          </div>

          <p className="mt-3.5 text-center text-xs text-zinc-400 hero-4">
            No credit card required · Setup in under 5 minutes · Cancel anytime
          </p>

          {/* Mockup */}
          <div className="mt-14 hero-5">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ══ LOGO TICKER ═══════════════════════════════════════════════════════ */}
      <div className="border-y bg-white py-4 overflow-hidden">
        <p className="text-center text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">
          Trusted by retailers at
        </p>
        <div className="flex animate-ticker whitespace-nowrap select-none">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-8 text-sm font-bold text-zinc-300">
              <span className="size-1 rounded-full bg-zinc-300" />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ══ STATS ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white border-b">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <div key={s.label} className="text-center" style={{ transitionDelay: `${i * 80}ms` }}>
                <p className="text-4xl sm:text-5xl font-black tracking-tighter text-gradient">
                  <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-sm text-zinc-500 mt-2 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 sm:py-28 border-b" style={{ backgroundColor: "#F8F8F6" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4  max-w-lg mx-auto">
            <SectionLabel>Features</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[1.05] text-zinc-950">
              Everything to run a<br />clean operation
            </h2>
            <p className="text-zinc-500 text-base leading-relaxed">
              From first delivery scan to final settlement — the complete lottery workflow, handled.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body, bg, ic, border }, i) => (
              <div
                key={title}
                className=" group bg-white rounded-2xl border border-zinc-200 p-6 space-y-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className={cn("size-11 rounded-xl border flex items-center justify-center", bg, border)}>
                  <Icon weight="fill" className={cn("size-5", ic)} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-[15px] text-zinc-900">{title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRODUCT SHOWCASE ══════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 border-b bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

            <div className="space-y-7">
              <div className="space-y-4">
                <SectionLabel>Dashboard</SectionLabel>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[1.05] text-zinc-950">
                  Everything visible.<br />
                  <span className="text-gradient">Nothing hidden.</span>
                </h2>
                <p className="text-zinc-500 text-base leading-relaxed">
                  Your owner dashboard puts shipment history, active books, slot fill rates, shift data, and pending approvals on a single screen — updated in real time.
                </p>
              </div>

              <ul className="space-y-3.5">
                {[
                  "Live slot board with book status per position",
                  "Shift-by-shift ticket comparison across all employees",
                  "One-tap approve or disable employee access",
                  "Exportable audit log for Ohio Lottery compliance",
                  "Automated fraud alert notifications",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-zinc-600">
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

            <div className="">
              <ShowcaseMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ══ COMPLIANCE / SECURITY (DARK) ══════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">

          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-start">

            <div className="space-y-7">
              <div className="space-y-4">
                <SectionLabel light>Compliance &amp; Security</SectionLabel>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[1.05] text-white">
                  Built for Ohio Lottery<br />compliance, by design.
                </h2>
                <p className="text-zinc-400 text-base leading-relaxed">
                  Every transaction, shift change, and inventory adjustment is logged, timestamped, and permanently attributable. LottoGuard keeps you audit-ready every day of the year.
                </p>
              </div>

              <ul className="space-y-3">
                {[
                  "Complete, tamper-proof action log for all employees",
                  "Role-based access — owners and employees see only what they need",
                  "One-click compliance export formatted for Ohio Lottery requirements",
                  "Automatic discrepancy detection at every shift close",
                  "Instant emergency alerts when cash doesn't reconcile",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                    <CheckCircle weight="fill" className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMPLIANCE.map(({ icon: Icon, title, body }, i) => (
                <div
                  key={title}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 hover:bg-white/8 transition-colors"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon weight="fill" className="size-5 text-zinc-300" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-sm text-white">{title}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-28 border-b" style={{ backgroundColor: "#F8F8F6" }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4 max-w-lg mx-auto">
            <SectionLabel>How It Works</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950">
              Up and running in minutes
            </h2>
            <p className="text-zinc-500 text-base">Three steps. No IT team. No hardware.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div className="hidden sm:block absolute top-[26px] left-[calc(33.33%+20px)] right-[calc(33.33%+20px)] h-px bg-zinc-200" />

            {STEPS.map(({ num, title, body }, i) => (
              <div key={num} className="space-y-4" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="size-13 w-13 h-13 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center">
                  <span className="text-base font-black text-primary">{num}</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-[15px] text-zinc-900">{title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 border-b bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4 max-w-lg mx-auto">
            <SectionLabel>Testimonials</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950">
              Trusted by Ohio store owners
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ quote, name, role, initials }, i) => (
              <div
                key={name}
                className=" bg-white rounded-2xl border border-zinc-200 p-7 space-y-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} weight="fill" className="size-3.5 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-zinc-600">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-1 border-t border-zinc-100">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{name}</p>
                    <p className="text-xs text-zinc-400">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ═══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 sm:py-28 border-b" style={{ backgroundColor: "#F8F8F6" }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 space-y-14">

          <div className="text-center space-y-4 max-w-lg mx-auto">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950">
              Simple, honest pricing
            </h2>
            <p className="text-zinc-500 text-base">14-day free trial. No credit card. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 items-start">
            {PRICING.map((p, i) => (
              <div
                key={p.name}
                className={cn(
                  " rounded-2xl p-7 space-y-7 transition-all duration-200",
                  p.highlight
                    ? "bg-zinc-950 text-white shadow-2xl"
                    : "bg-white border border-zinc-200 hover:shadow-md hover:-translate-y-0.5"
                )}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                {p.highlight && (
                  <span className="inline-block bg-white/10 border border-white/20 text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full text-zinc-300">
                    Most Popular
                  </span>
                )}
                <div className="space-y-1">
                  <p className={cn("font-bold text-base", p.highlight ? "text-white" : "text-zinc-900")}>{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={cn("text-5xl font-black tracking-tighter", p.highlight ? "text-white" : "text-zinc-950")}>
                      ${p.price}
                    </span>
                    <span className={cn("text-sm", p.highlight ? "text-zinc-400" : "text-zinc-400")}>/mo</span>
                  </div>
                  <p className={cn("text-sm leading-relaxed", p.highlight ? "text-zinc-400" : "text-zinc-500")}>{p.desc}</p>
                </div>

                <ul className="space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle
                        weight="fill"
                        className={cn("size-4 shrink-0", p.highlight ? "text-emerald-400" : "text-primary")}
                      />
                      <span className={p.highlight ? "text-zinc-300" : "text-zinc-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  className={cn(
                    "block text-center py-3.5 rounded-xl text-sm font-bold transition-all",
                    p.highlight
                      ? "bg-white text-zinc-950 hover:bg-zinc-100"
                      : "bg-zinc-950 text-white hover:bg-zinc-800"
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-[#f9f3f6] border-b">
        <div className="max-w-xl mx-auto px-5 sm:px-8 text-center space-y-7">
          <div className="size-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto">
            <Ticket weight="fill" className="size-7 text-primary" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[1.05] text-zinc-950">
            Ready to protect<br />
            <span className="text-gradient">every ticket you sell?</span>
          </h2>
          <p className="text-zinc-500 text-base leading-relaxed">
            Join 500+ Ohio retailers trusting LottoGuard to protect their lottery revenue — every day, every shift.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/owner/signup"
              className="group inline-flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold text-sm shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all"
            >
              Start your free trial
              <ArrowRight weight="bold" className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white border border-zinc-200 px-8 py-4 rounded-2xl font-semibold text-sm text-zinc-700 hover:bg-zinc-50 hover:-translate-y-0.5 transition-all shadow-sm"
            >
              Sign in to dashboard
            </Link>
          </div>
          <p className="text-xs text-zinc-400">No credit card · 14-day trial · Full access from day one</p>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer className="bg-zinc-950 text-zinc-400">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/10">

            {/* Brand */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-xl bg-primary flex items-center justify-center">
                  <ShieldCheck weight="fill" className="size-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-white">LottoGuard</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Enterprise lottery operations platform built for Ohio gas station retailers.
              </p>
              <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
                SOC 2 compliant · 99.9% uptime
              </p>
            </div>

            {/* Product */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-white uppercase tracking-wider">Product</p>
              <ul className="space-y-2.5">
                {["Features", "Pricing", "Security", "Compliance", "Changelog"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-white uppercase tracking-wider">Company</p>
              <ul className="space-y-2.5">
                {["About", "Privacy Policy", "Terms of Service", "Contact", "Support"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-white uppercase tracking-wider">Get started</p>
              <p className="text-xs text-zinc-500 leading-relaxed">14-day free trial. No credit card required. Cancel anytime.</p>
              <Link
                href="/owner/signup"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Start free trial <ArrowRight weight="bold" className="size-3" />
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} LottoGuard, Inc. All rights reserved. Built for Ohio retailers.
            </p>
            <p className="text-xs text-zinc-600">
              Ohio Lottery Compliance Ready
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Hero mockup ───────────────────────────────────────────────────────────────
const FOLD = { clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" };

function HeroMockup() {
  const TIER_SLOTS = [
    { label: "$1",  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  slots: [true, true, true, false, false] },
    { label: "$5",  bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   slots: [true, true, true, true, true]   },
    { label: "$10", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", slots: [true, true, false, false]        },
    { label: "$20", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", slots: [true, false, false]              },
  ];

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Glow base */}
      <div className="absolute -inset-6 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl blur-3xl pointer-events-none" />

      {/* Browser shell */}
      <div className="relative rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden bg-white">

        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-zinc-50/90">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-400" />
            <div className="size-3 rounded-full bg-amber-400" />
            <div className="size-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 flex items-center gap-2 max-w-xs">
            <ShieldCheck weight="fill" className="size-3 text-primary shrink-0" />
            <span className="text-[10px] text-zinc-400 font-mono">app.lottoguard.io/owner</span>
          </div>
        </div>

        <div className="flex" style={{ height: "390px" }}>

          {/* Sidebar */}
          <div className="w-[148px] border-r bg-zinc-50 shrink-0 flex flex-col">
            <div className="flex items-center gap-2 px-3 py-3.5 border-b">
              <div className="size-6 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <ShieldCheck weight="fill" className="size-3.5 text-white" />
              </div>
              <span className="text-[11px] font-bold text-zinc-800">LottoGuard</span>
            </div>
            <div className="p-2 space-y-0.5 flex-1">
              {[
                { label: "Dashboard",  active: true  },
                { label: "Inventory",  active: false },
                { label: "Books",      active: false },
                { label: "Slots",      active: false },
                { label: "Employees",  active: false },
                { label: "Error Log",  active: false },
              ].map(({ label, active }) => (
                <div key={label} className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[10px] font-medium",
                  active ? "bg-primary/10 text-primary" : "text-zinc-500"
                )}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 overflow-hidden" style={{ backgroundColor: "#F8F8F6" }}>
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white/80">
              <div>
                <p className="text-[11px] font-bold text-zinc-800">Dashboard</p>
                <p className="text-[9px] text-zinc-400">Sunoco Columbus · Updated just now</p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-semibold text-emerald-700">2 shifts active</span>
              </div>
            </div>

            <div className="p-4 space-y-3 overflow-hidden">
              {/* Stat cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total Books",  val: "87",    sub: "+12 this week", color: "text-zinc-800"    },
                  { label: "Active Slots", val: "14/20", sub: "70% occupied",  color: "text-primary"     },
                  { label: "Sold Today",   val: "340",   sub: "tickets",       color: "text-emerald-600" },
                  { label: "Alerts",       val: "1",     sub: "needs review",  color: "text-amber-600"   },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-2.5 space-y-0.5">
                    <p className="text-[8px] text-zinc-400 font-medium">{s.label}</p>
                    <p className={cn("text-[17px] font-black leading-none", s.color)}>{s.val}</p>
                    <p className="text-[7px] text-zinc-400">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Slot board */}
              <div className="bg-white rounded-xl border border-zinc-200 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-zinc-700">Slot Board</p>
                  <span className="text-[7px] text-zinc-400 font-medium">14 active · 6 empty</span>
                </div>
                {TIER_SLOTS.map(tier => (
                  <div key={tier.label} className="flex items-center gap-2">
                    <div className={cn("w-9 shrink-0 rounded-lg border px-1 py-1.5 text-center", tier.bg, tier.border)}>
                      <p className={cn("text-[8px] font-black leading-none", tier.text)}>{tier.label}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {tier.slots.map((filled, ci) => (
                        <div
                          key={ci}
                          style={filled ? FOLD : undefined}
                          className={cn(
                            "w-10 h-8 rounded-lg border flex items-center justify-center",
                            filled
                              ? cn(tier.bg, tier.border)
                              : "bg-white border-dashed border-zinc-200"
                          )}
                        >
                          <span className={cn("text-[8px] font-bold", filled ? tier.text : "text-zinc-300")}>
                            {filled ? `#${ci + 1}` : "○"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent alert */}
              <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-2.5">
                <div className="size-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Warning weight="fill" className="size-3.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-zinc-800">Drawer short $12.50 · Shift #1874</p>
                  <p className="text-[8px] text-zinc-400">Employee: J. Martinez · Slot #7 — 4 min ago</p>
                </div>
                <div className="text-[7px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">Review</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating card — fraud caught */}
      <div className="absolute -bottom-5 -right-4 sm:-right-6 bg-white border border-zinc-200 rounded-2xl shadow-xl p-3 flex items-center gap-2.5 animate-float z-10"
        style={{ maxWidth: "190px" }}>
        <div className="size-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <CheckCircle weight="fill" className="size-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-zinc-900">Fraud prevented</p>
          <p className="text-[8px] text-zinc-400">$42 discrepancy caught</p>
        </div>
      </div>

      {/* Floating card — shift in progress */}
      <div className="absolute -top-5 -left-4 sm:-left-6 bg-white border border-zinc-200 rounded-2xl shadow-xl p-3 flex items-center gap-2.5 animate-float z-10"
        style={{ animationDelay: "1.6s", maxWidth: "200px" }}>
        <div className="size-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
          <Clock weight="fill" className="size-4 text-blue-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-zinc-900">Shift in progress</p>
          <p className="text-[8px] text-zinc-400">J. Martinez · 3h 24m</p>
        </div>
      </div>
    </div>
  );
}

// ── Showcase mockup ───────────────────────────────────────────────────────────
function ShowcaseMockup() {
  const TIERS = [
    { label: "$1",  filled: 4, total: 5, bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700"   },
    { label: "$5",  filled: 5, total: 5, bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700"    },
    { label: "$10", filled: 3, total: 5, bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700"  },
    { label: "$20", filled: 2, total: 4, bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700"  },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-zinc-200 shadow-xl overflow-hidden bg-white">
        {/* Chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-zinc-50/90">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400" />
            <div className="size-2.5 rounded-full bg-amber-400" />
            <div className="size-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-3 bg-white border border-zinc-200 rounded px-2 py-0.5">
            <span className="text-[9px] text-zinc-400 font-mono">app.lottoguard.io/owner/slots</span>
          </div>
        </div>

        <div className="flex">
          {/* Mini sidebar */}
          <div className="w-[110px] border-r bg-zinc-50 shrink-0 p-2 space-y-0.5">
            {["Dashboard", "Inventory", "Books", "Slots", "Employees"].map((item, i) => (
              <div key={item} className={cn(
                "px-2 py-1.5 rounded-md text-[9px] font-medium",
                i === 3 ? "bg-primary/10 text-primary" : "text-zinc-400"
              )}>
                {item}
              </div>
            ))}
          </div>

          {/* Slots content */}
          <div className="flex-1 p-4 space-y-3" style={{ backgroundColor: "#F8F8F6" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-800">Slot Board</p>
                <p className="text-[9px] text-zinc-400">14 / 19 slots filled</p>
              </div>
              <div className="text-[8px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                5 empty
              </div>
            </div>

            {TIERS.map((tier) => (
              <div key={tier.label} className="flex items-center gap-2">
                <div className={cn("w-10 shrink-0 rounded-lg border px-1.5 py-2 text-center", tier.bg, tier.border)}>
                  <p className={cn("text-[9px] font-black leading-none", tier.text)}>{tier.label}</p>
                  <p className={cn("text-[7px] mt-0.5 font-medium opacity-60", tier.text)}>{tier.filled}/{tier.total}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: tier.total }, (_, i) => (
                    <div
                      key={i}
                      style={i < tier.filled ? FOLD : undefined}
                      className={cn(
                        "w-11 h-9 rounded-lg border flex flex-col items-center justify-center gap-0.5",
                        i < tier.filled
                          ? cn(tier.bg, tier.border)
                          : "bg-white border-dashed border-zinc-200"
                      )}
                    >
                      <span className={cn("text-[7px] font-bold", i < tier.filled ? tier.text : "text-zinc-300")}>
                        #{i + 1}
                      </span>
                      <span className={cn("text-[6px] font-medium", i < tier.filled ? "opacity-60 " + tier.text : "text-zinc-200")}>
                        {i < tier.filled ? "active" : "empty"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Callout */}
      <div className="absolute -bottom-3 -right-3 bg-white border border-zinc-200 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
        <TrendUp weight="fill" className="size-3.5 text-primary" />
        <p className="text-[10px] font-bold text-zinc-800">All $5 slots filled</p>
      </div>
    </div>
  );
}
