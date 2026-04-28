"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, Camera, Clock, GridFour, Users, Bell, ListChecks,
  ArrowRight, CheckCircle, Star, Ticket,
  Warning, TrendUp,
  Lock, FileText, ChartLineUp, Play, Pause,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MarketingNav } from "@/components/LandingTopbar";

// ── Types ────────────────────────────────────────────────────────────────────
interface CounterProps {
  to: number;
  prefix?: string;
  suffix?: string;
}

interface SectionLabelProps {
  children: React.ReactNode;
  variant?: "default" | "dark" | "primary";
}

interface Feature {
  icon: React.ElementType;
  title: string;
  body: string;
}

interface Step {
  num: string;
  title: string;
  body: string;
}

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

interface PricingTier {
  name: string;
  price: number;
  desc: string;
  features: string[];
  cta: string;
  href: string;
  highlight: boolean;
}

interface ComplianceItem {
  icon: React.ElementType;
  title: string;
  body: string;
}

interface TierSlot {
  label: string;
  slots: boolean[];
}

interface StatItem {
  to: number;
  prefix: string;
  suffix: string;
  label: string;
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "" }: CounterProps) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          const start = performance.now();
          const duration = 1500;
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setN(Math.round(eased * to));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [to]);

  return (
    <span ref={ref}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, variant = "default" }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3 text-xs font-semibold tracking-widest uppercase",
        variant === "dark" && "text-muted-foreground/60",
        variant === "primary" && "text-primary/80",
        variant === "default" && "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "w-6 h-px",
          variant === "dark" && "bg-muted-foreground/30",
          variant === "primary" && "bg-primary/40",
          variant === "default" && "bg-border"
        )}
      />
      {children}
    </span>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES: Feature[] = [
  {
    icon: Camera,
    title: "AI Receipt Scanning",
    body: "Photograph any delivery slip. Vision AI pulls game IDs, pack numbers, and ticket ranges in seconds — no manual entry, no transcription errors.",
  },
  {
    icon: Clock,
    title: "Shift-Level Tracking",
    body: "Employees clock in with a starting ticket and out with an ending ticket. Tickets sold, time on shift, and cash drawer reconciliation — all automatic.",
  },
  {
    icon: GridFour,
    title: "Visual Slot Board",
    body: "A live grid organized by price tier — $1 through $50. Assign active books to each slot. Gaps and mismatches surface the moment they occur.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    body: "Owners and employees see different interfaces. Share an invite code, approve registrations with one tap, revoke access the moment someone leaves.",
  },
  {
    icon: Bell,
    title: "Real-Time Fraud Alerts",
    body: "Ticket count mismatches, drawer over/short, empty slots, unassigned books — you get a push notification before small gaps become real losses.",
  },
  {
    icon: ListChecks,
    title: "Complete Audit Trail",
    body: "Every activation, settlement, shift, and employee action is timestamped, attributable, and exportable — ready for Ohio Lottery compliance reviews.",
  },
];

const STEPS: Step[] = [
  {
    num: "01",
    title: "Register your store",
    body: "Enter your org details and Ohio retail number. Your account is live in under 2 minutes with no IT setup required.",
  },
  {
    num: "02",
    title: "Onboard your team",
    body: "Share a single invite code. Employees self-register and you approve each one with a single tap from your dashboard.",
  },
  {
    num: "03",
    title: "Track every ticket",
    body: "Scan receipts, assign books to slots, run shifts, and settle books. Every discrepancy surfaces automatically.",
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We caught a $400 discrepancy on day one. LottoGuard paid for itself before the end of the first week.",
    name: "Michael R.",
    role: "Owner — Sunoco, Columbus OH",
    initials: "MR",
  },
  {
    quote:
      "The receipt scanning alone saves my manager 45 minutes every delivery day. The ROI is immediate.",
    name: "Sandra T.",
    role: "Owner — BP Express, Dayton OH",
    initials: "ST",
  },
  {
    quote:
      "I can see exactly who sold what on every shift from my phone. No more guessing at end of day.",
    name: "Kevin L.",
    role: "Manager — Circle K, Cleveland OH",
    initials: "KL",
  },
];

const PRICING: PricingTier[] = [
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

const STATS: StatItem[] = [
  { to: 500, prefix: "", suffix: "+", label: "Ohio retailers" },
  { to: 2100, prefix: "$", suffix: "K+", label: "Losses prevented" },
  { to: 99, prefix: "", suffix: "%", label: "Uptime guaranteed" },
  { to: 45, prefix: "", suffix: "m", label: "Saved per delivery" },
];

const LOGOS = [
  "Sunoco",
  "BP Express",
  "Circle K",
  "Marathon",
  "Speedway",
  "GetGo",
  "Sheetz",
  "Thorntons",
];

const COMPLIANCE: ComplianceItem[] = [
  {
    icon: ListChecks,
    title: "Full Audit Log",
    body: "Every activation, clock-in, settlement, and employee action is timestamped and permanently recorded.",
  },
  {
    icon: Lock,
    title: "Role-Based Access",
    body: "Owners and employees see only what they need. Access revokes instantly when an employee leaves.",
  },
  {
    icon: FileText,
    title: "Compliance Export",
    body: "One-click export of shift data, inventory history, and discrepancy reports — formatted for Ohio Lottery reviews.",
  },
  {
    icon: ChartLineUp,
    title: "Discrepancy Detection",
    body: "Drawer reconciliation runs automatically at every clock-out. Over/short notifications reach owners within seconds.",
  },
];

const TIER_SLOTS_MOCKUP: TierSlot[] = [
  { label: "$1", slots: [true, true, true, false, false] },
  { label: "$5", slots: [true, true, true, true, true] },
  { label: "$10", slots: [true, true, false, false] },
  { label: "$20", slots: [true, false, false] },
];

const FOLD = {
  clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
};

// ── Hero Mockup ──────────────────────────────────────────────────────────────
function HeroMockup() {
  const [activeTab, setActiveTab] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const tabs = ["Dashboard", "Inventory", "Books", "Slots", "Employees", "Log"];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying, tabs.length]);

  const tierColors = [
    { bg: "bg-chart-2/10", border: "border-chart-2/20", text: "text-chart-2" },
    { bg: "bg-primary/10", border: "border-primary/20", text: "text-primary" },
    { bg: "bg-chart-1/10", border: "border-chart-1/20", text: "text-chart-1" },
    { bg: "bg-chart-5/10", border: "border-chart-5/20", text: "text-chart-5" },
  ];

  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="absolute -inset-8 bg-gradient-to-b from-primary/5 via-transparent to-transparent rounded-3xl blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl border border-border shadow-2xl shadow-foreground/5 overflow-hidden bg-card">
        {/* Chrome bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex-1 flex items-center gap-3 ml-2">
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 max-w-sm w-full border border-border">
              <ShieldCheck weight="fill" className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                app.lottoguard.io/owner
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            {isPlaying ? (
              <Pause weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Play weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </div>

        <div className="flex" style={{ height: "420px" }}>
          {/* Sidebar */}
          <div className="w-[160px] border-r border-border bg-muted/20 shrink-0 flex flex-col">
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <ShieldCheck weight="fill" className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xs font-bold text-foreground">LottoGuard</span>
            </div>
            <div className="p-2.5 space-y-1 flex-1">
              {tabs.map((label, i) => (
                <button
                  key={label}
                  onClick={() => {
                    setActiveTab(i);
                    setIsPlaying(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200",
                    activeTab === i
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden bg-muted/10">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
              <div>
                <p className="text-xs font-semibold text-foreground">{tabs[activeTab]}</p>
                <p className="text-[10px] text-muted-foreground">Sunoco Columbus · Updated just now</p>
              </div>
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-medium text-primary">2 shifts active</span>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto" style={{ height: "calc(420px - 49px)" }}>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Books", val: "87", sub: "+12 this week" },
                  { label: "Active Slots", val: "14/20", sub: "70% occupied" },
                  { label: "Sold Today", val: "340", sub: "tickets" },
                  { label: "Alerts", val: "1", sub: "needs review" },
                ].map((s) => (
                  <div key={s.label} className="bg-card rounded-xl border border-border p-3 space-y-1">
                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                    <p className="text-xl font-bold text-foreground leading-none">{s.val}</p>
                    <p className="text-[9px] text-muted-foreground">{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Slot Board</p>
                  <span className="text-[9px] text-muted-foreground font-medium">14 active · 6 empty</span>
                </div>
                {TIER_SLOTS_MOCKUP.map((tier, ti) => (
                  <div key={tier.label} className="flex items-center gap-3">
                    <div className={cn("w-11 shrink-0 rounded-lg border px-2 py-2 text-center", tierColors[ti].bg, tierColors[ti].border)}>
                      <p className={cn("text-[10px] font-bold leading-none", tierColors[ti].text)}>{tier.label}</p>
                    </div>
                    <div className="flex gap-2">
                      {tier.slots.map((filled, ci) => (
                        <div
                          key={ci}
                          style={filled ? FOLD : undefined}
                          className={cn(
                            "w-12 h-10 rounded-lg border flex items-center justify-center transition-all",
                            filled
                              ? cn(tierColors[ti].bg, tierColors[ti].border)
                              : "bg-card border-dashed border-border"
                          )}
                        >
                          <span className={cn("text-[10px] font-semibold", filled ? tierColors[ti].text : "text-muted-foreground/40")}>
                            {filled ? `#${ci + 1}` : "○"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                  <Warning weight="fill" className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">Drawer short $12.50 · Shift #1874</p>
                  <p className="text-[10px] text-muted-foreground">Employee: J. Martinez · Slot #7 — 4 min ago</p>
                </div>
                <span className="text-[9px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1 shrink-0">
                  Review
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <div className="absolute -bottom-4 -right-4 sm:-right-6 bg-card border border-border rounded-xl shadow-lg p-3.5 flex items-center gap-3 animate-float z-10" style={{ maxWidth: "200px" }}>
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <CheckCircle weight="fill" className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-foreground">Fraud prevented</p>
          <p className="text-[9px] text-muted-foreground">$42 discrepancy caught</p>
        </div>
      </div>

      <div className="absolute -top-4 -left-4 sm:-left-6 bg-card border border-border rounded-xl shadow-lg p-3.5 flex items-center gap-3 animate-float z-10" style={{ animationDelay: "1.6s", maxWidth: "210px" }}>
        <div className="w-9 h-9 rounded-lg bg-chart-2/10 border border-chart-2/20 flex items-center justify-center shrink-0">
          <Clock weight="fill" className="w-4 h-4 text-chart-2" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-foreground">Shift in progress</p>
          <p className="text-[9px] text-muted-foreground">J. Martinez · 3h 24m</p>
        </div>
      </div>
    </div>
  );
}

// ── Showcase Mockup ──────────────────────────────────────────────────────────
function ShowcaseMockup() {
  const TIERS = [
    { label: "$1", filled: 4, total: 5 },
    { label: "$5", filled: 5, total: 5 },
    { label: "$10", filled: 3, total: 5 },
    { label: "$20", filled: 2, total: 4 },
  ];

  const tierColors = [
    { bg: "bg-chart-2/10", border: "border-chart-2/20", text: "text-chart-2" },
    { bg: "bg-primary/10", border: "border-primary/20", text: "text-primary" },
    { bg: "bg-chart-1/10", border: "border-chart-1/20", text: "text-chart-1" },
    { bg: "bg-chart-5/10", border: "border-chart-5/20", text: "text-chart-5" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-border shadow-xl overflow-hidden bg-card">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex-1 flex items-center">
            <span className="text-[10px] text-muted-foreground font-mono">app.lottoguard.io/owner/slots</span>
          </div>
        </div>

        <div className="flex">
          <div className="w-[120px] border-r border-border bg-muted/20 shrink-0 p-2.5 space-y-1">
            {["Dashboard", "Inventory", "Books", "Slots", "Employees"].map((item, i) => (
              <div
                key={item}
                className={cn(
                  "px-3 py-2 rounded-lg text-[10px] font-medium",
                  i === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="flex-1 p-4 space-y-3.5 bg-muted/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">Slot Board</p>
                <p className="text-[10px] text-muted-foreground">14 / 19 slots filled</p>
              </div>
              <span className="text-[9px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                5 empty
              </span>
            </div>

            {TIERS.map((tier, ti) => (
              <div key={tier.label} className="flex items-center gap-3">
                <div className={cn("w-12 shrink-0 rounded-lg border px-2 py-2.5 text-center", tierColors[ti].bg, tierColors[ti].border)}>
                  <p className={cn("text-xs font-bold leading-none", tierColors[ti].text)}>{tier.label}</p>
                  <p className={cn("text-[9px] mt-0.5 font-medium opacity-60", tierColors[ti].text)}>
                    {tier.filled}/{tier.total}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: tier.total }, (_, i) => (
                    <div
                      key={i}
                      style={i < tier.filled ? FOLD : undefined}
                      className={cn(
                        "w-14 h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5",
                        i < tier.filled
                          ? cn(tierColors[ti].bg, tierColors[ti].border)
                          : "bg-card border-dashed border-border"
                      )}
                    >
                      <span className={cn("text-[9px] font-semibold", i < tier.filled ? tierColors[ti].text : "text-muted-foreground/40")}>
                        #{i + 1}
                      </span>
                      <span className={cn("text-[8px] font-medium", i < tier.filled ? "opacity-60 " + tierColors[ti].text : "text-muted-foreground/30")}>
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

      <div className="absolute -bottom-3 -right-3 bg-card border border-border rounded-xl shadow-lg px-3.5 py-2.5 flex items-center gap-2.5">
        <TrendUp weight="fill" className="w-4 h-4 text-primary" />
        <p className="text-[10px] font-semibold text-foreground">All $5 slots filled</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground antialiased">
      <MarketingNav />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Background pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(201, 42, 42, 0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-primary/5 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
          {/* Headline */}
          <div className="mt-8 text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground">
              Stop lottery fraud
              <br />
              <span className="text-primary">before it costs you.</span>
            </h1>
          </div>

          {/* Subtext */}
          <p className="mt-6 text-center text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            The all-in-one operations platform for Ohio gas stations. Scan receipts in seconds, manage every shift, and get alerted the moment numbers don&rsquo;t add up.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/owner/signup"
              className="group inline-flex items-center gap-2.5 bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-all w-full sm:w-auto justify-center shadow-sm"
            >
              Start free trial — 14 days
              <ArrowRight weight="bold" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-card border border-border px-7 py-3.5 rounded-xl font-semibold text-sm text-foreground hover:bg-muted transition-all w-full sm:w-auto justify-center"
            >
              Sign in to dashboard
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            No credit card required · Setup in under 5 minutes · Cancel anytime
          </p>

          {/* Mockup */}
          <div className="mt-16">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ══ LOGO TICKER ═══════════════════════════════════════════════════════ */}
      <div className="border-y border-border bg-muted/30 py-5 overflow-hidden">
        <p className="text-center text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-4">
          Trusted by retailers at
        </p>
        <div className="flex animate-ticker whitespace-nowrap select-none">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} className="inline-flex items-center gap-2.5 px-10 text-sm font-semibold text-muted-foreground/50">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ══ STATS ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-card">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-4xl sm:text-5xl font-bold tracking-tight text-primary">
                  <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-sm text-muted-foreground mt-2 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 sm:py-28 border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <SectionLabel variant="primary">Features</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-foreground">
              Everything to run a
              <br />
              clean operation
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              From first delivery scan to final settlement — the complete lottery workflow, handled.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group bg-card rounded-2xl border border-border p-6 space-y-4 hover:shadow-lg hover:border-primary/20 transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon weight="bold" className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-base text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRODUCT SHOWCASE ══════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-card overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            <div className="space-y-8">
              <div className="space-y-5">
                <SectionLabel variant="primary">Dashboard</SectionLabel>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-foreground">
                  Everything visible.
                  <br />
                  <span className="text-muted-foreground">Nothing hidden.</span>
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Your owner dashboard puts shipment history, active books, slot fill rates, shift data, and pending approvals on a single screen — updated in real time.
                </p>
              </div>

              <ul className="space-y-4">
                {[
                  "Live slot board with book status per position",
                  "Shift-by-shift ticket comparison across all employees",
                  "One-tap approve or disable employee access",
                  "Exportable audit log for Ohio Lottery compliance",
                  "Automated fraud alert notifications",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/owner/signup"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all group"
              >
                Try it free
                <ArrowUpRight weight="bold" className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            <div>
              <ShowcaseMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ══ COMPLIANCE / SECURITY ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-foreground">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-start">
            <div className="space-y-8">
              <div className="space-y-5">
                <SectionLabel variant="dark">Compliance & Security</SectionLabel>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-background">
                  Built for Ohio Lottery
                  <br />
                  compliance, by design.
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Every transaction, shift change, and inventory adjustment is logged, timestamped, and permanently attributable. LottoGuard keeps you audit-ready every day of the year.
                </p>
              </div>

              <ul className="space-y-3.5">
                {[
                  "Complete, tamper-proof action log for all employees",
                  "Role-based access — owners and employees see only what they need",
                  "One-click compliance export formatted for Ohio Lottery requirements",
                  "Automatic discrepancy detection at every shift close",
                  "Instant emergency alerts when cash doesn't reconcile",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-background/80">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMPLIANCE.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="bg-background/5 border border-background/10 rounded-2xl p-5 space-y-3.5 hover:bg-background/8 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Icon weight="bold" className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-semibold text-sm text-background">{title}</p>
                    <p className="text-xs text-background/60 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-card">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <SectionLabel>How It Works</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Up and running in minutes
            </h2>
            <p className="text-muted-foreground text-base">Three steps. No IT team. No hardware.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-9 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-px bg-border" />

            {STEPS.map(({ num, title, body }) => (
              <div key={num} className="space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{num}</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-base text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <SectionLabel variant="primary">Testimonials</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Trusted by Ohio store owners
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, role, initials }) => (
              <div
                key={name}
                className="bg-card rounded-2xl border border-border p-7 space-y-5 hover:shadow-lg hover:border-primary/10 transition-all duration-200"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} weight="fill" className="w-3.5 h-3.5 text-chart-5" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ═══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 sm:py-28 bg-card">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <SectionLabel variant="primary">Pricing</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Simple, honest pricing
            </h2>
            <p className="text-muted-foreground text-base">14-day free trial. No credit card. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 items-start">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "rounded-2xl p-8 space-y-8 transition-all duration-200",
                  p.highlight
                    ? "bg-primary text-primary-foreground shadow-xl"
                    : "bg-card border border-border hover:shadow-md"
                )}
              >
                {p.highlight && (
                  <span className="inline-block bg-primary-foreground/15 border border-primary-foreground/20 text-[10px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full">
                    Most Popular
                  </span>
                )}
                <div className="space-y-2">
                  <p className="font-semibold text-base">{p.name}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-bold tracking-tight">${p.price}</span>
                    <span className={cn("text-sm", p.highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      /mo
                    </span>
                  </div>
                  <p className={cn("text-sm leading-relaxed", p.highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {p.desc}
                  </p>
                </div>

                <ul className="space-y-3.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <CheckCircle
                        weight="fill"
                        className={cn("w-4 h-4 shrink-0", p.highlight ? "text-primary-foreground" : "text-primary")}
                      />
                      <span className={p.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  className={cn(
                    "block text-center py-3.5 rounded-xl text-sm font-semibold transition-all",
                    p.highlight
                      ? "bg-primary-foreground text-primary hover:bg-background"
                      : "bg-primary text-primary-foreground hover:opacity-90"
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
      <section className="py-24 sm:py-32 bg-muted/30 border-t border-border">
        <div className="max-w-xl mx-auto px-5 sm:px-8 text-center space-y-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Ticket weight="bold" className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-foreground">
            Ready to protect
            <br />
            <span className="text-primary">every ticket you sell?</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Join 500+ Ohio retailers trusting LottoGuard to protect their lottery revenue — every day, every shift.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/owner/signup"
              className="group inline-flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-sm"
            >
              Start your free trial
              <ArrowRight weight="bold" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-card border border-border px-8 py-4 rounded-xl font-semibold text-sm text-foreground hover:bg-muted transition-all"
            >
              Sign in to dashboard
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">No credit card · 14-day trial · Full access from day one</p>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer className="bg-foreground text-background/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 pb-14 border-b border-background/10">
            <div className="space-y-5 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <ShieldCheck weight="fill" className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold text-background">LottoGuard</span>
              </div>
              <p className="text-xs text-background/40 leading-relaxed">
                Enterprise lottery operations platform built for Ohio gas station retailers.
              </p>
              <p className="text-[10px] text-background/30 font-semibold uppercase tracking-wider">
                SOC 2 compliant · 99.9% uptime
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-background uppercase tracking-wider">Product</p>
              <ul className="space-y-3">
                {["Features", "Pricing", "Security", "Compliance", "Changelog"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-background/40 hover:text-background transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-background uppercase tracking-wider">Company</p>
              <ul className="space-y-3">
                {["About", "Privacy Policy", "Terms of Service", "Contact", "Support"].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-background/40 hover:text-background transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-background uppercase tracking-wider">Get started</p>
              <p className="text-xs text-background/40 leading-relaxed">
                14-day free trial. No credit card required. Cancel anytime.
              </p>
              <Link
                href="/owner/signup"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Start free trial <ArrowRight weight="bold" className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-background/30">
              © {new Date().getFullYear()} LottoGuard, Inc. All rights reserved. Built for Ohio retailers.
            </p>
            <p className="text-xs text-background/30">Ohio Lottery Compliance Ready</p>
          </div>
        </div>
      </footer>
    </div>
  );
}