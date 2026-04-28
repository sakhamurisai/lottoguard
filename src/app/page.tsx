"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, Camera, Clock, GridFour, Users, Bell, ListChecks,
  ArrowRight, CheckCircle, Star, Ticket, Warning,
  Lock, FileText, ChartLineUp, Play, Pause, SealWarning,
  ArrowUpRight, TrendUp,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MarketingNav } from "@/components/LandingTopbar";

// ── Scroll reveal ──────────────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-animate]");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const delay = Number((entry.target as HTMLElement).dataset.delay ?? 0);
          const add = () => entry.target.classList.add("is-visible");
          delay ? setTimeout(add, delay) : add();
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.07, rootMargin: "0px 0px -50px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ── Counter ───────────────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || fired.current) return;
        fired.current = true;
        const t0 = performance.now();
        const dur = 2200;
        const tick = (now: number) => {
          const p = Math.min((now - t0) / dur, 1);
          setN(Math.round((1 - Math.pow(1 - p, 4)) * to));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const IVORY   = "#F8F5EF";
const CREAM   = "#EDE8DE";
const CARD    = "#FFFDF9";
const FOREST  = "#2B5C3F";
const FOREST2 = "#1E4030";
const DEEP_BG = "#0C1810";
const GOLD    = "#C4902A";
const GOLDT   = "linear-gradient(135deg,#C4902A 0%,#E8B84B 100%)";
const FORESTG = "linear-gradient(135deg,#2B5C3F 0%,#3A7A52 100%)";
const TXT     = "#1A1A14";
const MUTED   = "#6B6356";
const DIM     = "#A09080";
const BD      = "rgba(43,92,63,0.1)";
const BDH     = "rgba(43,92,63,0.22)";

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Camera,     title: "AI Receipt Scanning",    body: "Photograph any delivery slip. Vision AI pulls game IDs, pack numbers, and ticket ranges in seconds — no manual entry.",         isGold: false },
  { icon: Clock,      title: "Shift-Level Tracking",   body: "Employees clock in with a starting ticket, out with an ending ticket. Cash reconciliation runs automatically.",                isGold: true  },
  { icon: GridFour,   title: "Visual Slot Board",      body: "A live grid by price tier — $1 through $50. Assign books to each slot. Gaps and mismatches surface the moment they occur.",    isGold: false },
  { icon: Users,      title: "Role-Based Access",      body: "Owners and employees see different interfaces. Approve registrations with one tap, revoke access instantly.",                  isGold: true  },
  { icon: Bell,       title: "Real-Time Fraud Alerts", body: "Ticket count mismatches, drawer over/short, unassigned books — a push notification before small gaps become real losses.",     isGold: false },
  { icon: ListChecks, title: "Complete Audit Trail",   body: "Every activation, settlement, shift, and employee action is timestamped and exportable — ready for Ohio Lottery compliance.", isGold: true  },
];

const STEPS = [
  { num: "01", title: "Register your store",  body: "Enter your org details and Ohio retail number. Your account is live in under 2 minutes with no IT setup." },
  { num: "02", title: "Onboard your team",    body: "Share a single invite code. Employees self-register and you approve each one with a single tap from your dashboard." },
  { num: "03", title: "Track every ticket",   body: "Scan receipts, assign books to slots, run shifts, and settle books. Every discrepancy surfaces automatically." },
];

const TESTIMONIALS = [
  { quote: "We caught a $400 discrepancy on day one. LottoGuard paid for itself before the end of the first week.", name: "Michael R.", role: "Owner — Sunoco, Columbus OH",       initials: "MR" },
  { quote: "The receipt scanning alone saves my manager 45 minutes every delivery day. The ROI is immediate.",       name: "Sandra T.",  role: "Owner — BP Express, Dayton OH",    initials: "ST" },
  { quote: "I can see exactly who sold what on every shift from my phone. No more guessing at end of day.",          name: "Kevin L.",   role: "Manager — Circle K, Cleveland OH", initials: "KL" },
];

const PRICING = [
  {
    name: "Starter", price: 49,
    desc: "Single-location stores getting organized.",
    features: ["Up to 5 employees", "Up to 10 lottery slots", "AI receipt scanning", "Shift tracking & clock in/out", "Email support"],
    cta: "Start free trial", href: "/owner/signup", highlight: false,
  },
  {
    name: "Professional", price: 99,
    desc: "Unlimited scale with priority support.",
    features: ["Unlimited employees", "Unlimited slots", "Everything in Starter", "Real-time fraud alerts", "Compliance export", "Priority support"],
    cta: "Start free trial", href: "/owner/signup", highlight: true,
  },
];

const LOGOS = ["Sunoco", "BP Express", "Circle K", "Marathon", "Speedway", "GetGo", "Sheetz", "Thorntons"];

const COMPLIANCE_CARDS = [
  { icon: ListChecks,  title: "Full Audit Log",         body: "Every activation, clock-in, and settlement is timestamped and permanently recorded."          },
  { icon: Lock,        title: "Role-Based Access",      body: "Owners and employees see only what they need. Access revokes the moment someone leaves."        },
  { icon: FileText,    title: "Compliance Export",      body: "One-click export formatted for Ohio Lottery compliance review requirements."                    },
  { icon: ChartLineUp, title: "Discrepancy Detection",  body: "Drawer reconciliation runs at every clock-out. Over/short alerts reach owners within seconds."  },
];

// ── 3D Tilt Card ──────────────────────────────────────────────────────────────
function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateZ(8px)`;
    el.style.boxShadow = `${-x * 14}px ${-y * 14}px 48px rgba(43,92,63,0.1), 0 4px 20px rgba(43,92,63,0.06)`;
    el.style.borderColor = BDH;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "";
    el.style.borderColor = BD;
  };

  return (
    <div ref={ref} className={className}
      style={{ ...style, transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease" }}
      onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {children}
    </div>
  );
}

// ── Hero Mockup ───────────────────────────────────────────────────────────────
function HeroMockup() {
  const tabs = ["Dashboard", "Inventory", "Books", "Slots", "Employees", "Log"];
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setActive((p) => (p + 1) % tabs.length), 3000);
    return () => clearInterval(id);
  }, [playing, tabs.length]);

  const MBD    = "rgba(255,255,255,0.07)";
  const MMUTED = "rgba(255,255,255,0.28)";
  const MFG    = "#3A8C5A";
  const MGD    = "#C4902A";

  const TIER_ROWS = [
    { label: "$1",  filled: [true, true, true, false, false], c: { bg: "rgba(58,140,90,0.1)",  bd: "rgba(58,140,90,0.25)",  tx: MFG } },
    { label: "$5",  filled: [true, true, true, true, true],   c: { bg: "rgba(196,144,42,0.1)", bd: "rgba(196,144,42,0.25)", tx: MGD } },
    { label: "$10", filled: [true, true, false, false],       c: { bg: "rgba(58,140,90,0.1)",  bd: "rgba(58,140,90,0.25)",  tx: MFG } },
    { label: "$20", filled: [true, false, false],             c: { bg: "rgba(196,144,42,0.1)", bd: "rgba(196,144,42,0.25)", tx: MGD } },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-12 rounded-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(43,92,63,0.2) 0%,transparent 65%)", filter: "blur(24px)" }} />
      <div className="absolute -inset-px rounded-2xl pointer-events-none"
        style={{ background: "linear-gradient(135deg,rgba(58,140,90,0.35) 0%,rgba(196,144,42,0.15) 50%,transparent 80%)" }} />

      <div className="relative rounded-2xl overflow-hidden border shadow-2xl"
        style={{ background: "linear-gradient(160deg,#111D15 0%,#0C1810 100%)", borderColor: "rgba(255,255,255,0.08)" }}>

        {/* Chrome bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: "rgba(255,255,255,0.02)", borderColor: MBD }}>
          <div className="flex gap-2">
            {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
              <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="flex-1 ml-2">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 max-w-xs border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: MBD }}>
              <ShieldCheck weight="fill" className="w-3.5 h-3.5" style={{ color: MFG }} />
              <span className="text-[10px] font-mono truncate" style={{ color: MMUTED }}>app.lottoguard.io/owner</span>
            </div>
          </div>
          <button onClick={() => setPlaying((p) => !p)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
            {playing
              ? <Pause weight="fill" className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.22)" }} />
              : <Play  weight="fill" className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.22)" }} />}
          </button>
        </div>

        <div className="flex" style={{ height: 408 }}>
          {/* Sidebar */}
          <div className="w-40 border-r shrink-0 flex flex-col" style={{ background: "rgba(255,255,255,0.015)", borderColor: MBD }}>
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: MBD }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: FORESTG }}>
                <ShieldCheck weight="fill" className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>LottoGuard</span>
            </div>
            <div className="p-2.5 space-y-0.5 flex-1">
              {tabs.map((t, i) => (
                <button key={t} onClick={() => { setActive(i); setPlaying(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200"
                  style={active === i
                    ? { background: "rgba(58,140,90,0.15)", color: MFG, border: "1px solid rgba(58,140,90,0.25)" }
                    : { color: MMUTED, border: "1px solid transparent" }}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.008)" }}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: MBD }}>
              <div>
                <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>{tabs[active]}</p>
                <p className="text-[10px]" style={{ color: MMUTED }}>Sunoco Columbus · Updated just now</p>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border"
                style={{ background: "rgba(58,140,90,0.1)", borderColor: "rgba(58,140,90,0.25)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: MFG }} />
                <span className="text-[10px] font-medium" style={{ color: MFG }}>2 active</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { l: "Books",  v: "87",    c: MFG       },
                  { l: "Slots",  v: "14/20", c: MGD       },
                  { l: "Sold",   v: "340",   c: MFG       },
                  { l: "Alerts", v: "1",     c: "#f87171" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border p-3 space-y-1.5"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: MBD }}>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: MMUTED }}>{s.l}</p>
                    <p className="text-xl font-bold leading-none tabular-nums" style={{ color: s.c }}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* Slot board */}
              <div className="rounded-xl border p-4 space-y-2.5" style={{ background: "rgba(255,255,255,0.018)", borderColor: MBD }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Slot Board</p>
                  <span className="text-[9px]" style={{ color: MMUTED }}>14 active · 6 empty</span>
                </div>
                {TIER_ROWS.map((tier) => (
                  <div key={tier.label} className="flex items-center gap-2.5">
                    <div className="w-9 shrink-0 rounded-lg border px-1 py-2 text-center"
                      style={{ background: tier.c.bg, borderColor: tier.c.bd }}>
                      <p className="text-[9px] font-bold" style={{ color: tier.c.tx }}>{tier.label}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {tier.filled.map((on, ci) => (
                        <div key={ci}
                          className="w-11 h-8 rounded-lg border flex items-center justify-center text-[9px] font-semibold"
                          style={on
                            ? { background: tier.c.bg, borderColor: tier.c.bd, color: tier.c.tx }
                            : { borderStyle: "dashed", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.15)" }}
                        >{on ? `#${ci + 1}` : "○"}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Alert */}
              <div className="rounded-xl border flex items-center gap-3 p-3"
                style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.18)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,158,11,0.12)" }}>
                  <Warning weight="fill" className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>Drawer short $12.50 · Shift #1874</p>
                  <p className="text-[9px]" style={{ color: MMUTED }}>J. Martinez · Slot #7 — 4 min ago</p>
                </div>
                <span className="text-[9px] font-semibold shrink-0 px-2 py-1 rounded-md border"
                  style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.2)" }}>
                  Review
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards — light glass treatment */}
      <div className="absolute -bottom-5 -right-5 sm:-right-8 rounded-2xl border p-3.5 flex items-center gap-3 animate-float-slow z-10"
        style={{ background: "rgba(255,253,249,0.96)", backdropFilter: "blur(14px)", borderColor: "rgba(43,92,63,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", maxWidth: 196 }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
          <SealWarning weight="fill" className="w-4 h-4" style={{ color: "#ef4444" }} />
        </div>
        <div>
          <p className="text-[11px] font-semibold" style={{ color: TXT }}>Fraud prevented</p>
          <p className="text-[9px]" style={{ color: MUTED }}>$42 discrepancy caught</p>
        </div>
      </div>

      <div className="absolute -top-5 -left-5 sm:-left-8 rounded-2xl border p-3.5 flex items-center gap-3 animate-float-slow-2 z-10"
        style={{ background: "rgba(255,253,249,0.96)", backdropFilter: "blur(14px)", borderColor: "rgba(43,92,63,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", maxWidth: 200 }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
          style={{ background: "rgba(43,92,63,0.1)", borderColor: "rgba(43,92,63,0.22)" }}>
          <Clock weight="fill" className="w-4 h-4" style={{ color: FOREST }} />
        </div>
        <div>
          <p className="text-[11px] font-semibold" style={{ color: TXT }}>Shift active</p>
          <p className="text-[9px]" style={{ color: MUTED }}>J. Martinez · 3h 24m</p>
        </div>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  const c = light ? "#E8B84B" : GOLD;
  return (
    <div className="inline-flex items-center gap-3 text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: c }}>
      <span className="w-5 h-0.5 rounded-full" style={{ background: c, opacity: 0.5 }} />
      {children}
      <span className="w-5 h-0.5 rounded-full" style={{ background: c, opacity: 0.5 }} />
    </div>
  );
}

// ── GradText ──────────────────────────────────────────────────────────────────
function GradText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={className}
      style={{ backgroundImage: "linear-gradient(135deg,#2B5C3F 10%,#3D7A52 45%,#C4902A 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
      {children}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useScrollReveal();

  return (
    <div style={{ background: IVORY, color: TXT }} className="min-h-screen antialiased overflow-x-hidden">

      {/* Grain texture overlay */}
      <div className="pointer-events-none fixed inset-0 z-[200] animate-grain"
        style={{
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <MarketingNav ivory />

      {/* ══ HERO ════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(circle,rgba(43,92,63,0.055) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="absolute -top-[20%] -right-[10%] w-[72vw] h-[72vw] max-w-[900px] max-h-[900px] rounded-full"
            style={{ background: "radial-gradient(circle,rgba(196,144,42,1) 0%,transparent 70%)", filter: "blur(120px)", opacity: 0.07, animation: "blob-drift-1 22s ease-in-out infinite" }} />
          <div className="absolute bottom-0 -left-[15%] w-[62vw] h-[62vw] max-w-[800px] max-h-[800px] rounded-full"
            style={{ background: "radial-gradient(circle,rgba(43,92,63,1) 0%,transparent 70%)", filter: "blur(100px)", opacity: 0.09, animation: "blob-drift-2 28s ease-in-out infinite" }} />
          <div className="absolute bottom-0 left-0 right-0 h-56 pointer-events-none"
            style={{ background: `linear-gradient(to bottom,transparent,${IVORY})` }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 w-full py-20 sm:py-28">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-16 lg:gap-10 items-center">

            {/* Copy */}
            <div className="space-y-8 lg:space-y-9">
              <div data-animate className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-semibold border"
                style={{ background: "rgba(43,92,63,0.07)", borderColor: "rgba(43,92,63,0.2)", color: FOREST }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: FOREST }} />
                Ohio Lottery Compliance Ready
              </div>

              <h1 data-animate data-delay="80"
                className="text-[52px] sm:text-[66px] lg:text-[76px] leading-[0.96] tracking-[-0.028em] font-bold"
                style={{ fontFamily: "var(--font-display,var(--font-sans))" }}>
                Every lottery<br />ticket,{" "}
                <GradText>accounted for.</GradText>
              </h1>

              <p data-animate data-delay="160" className="text-lg leading-relaxed max-w-md" style={{ color: MUTED }}>
                The all-in-one operations platform for Ohio gas stations. Scan receipts in seconds, manage every shift, and get alerted the moment numbers don&rsquo;t add up.
              </p>

              <div data-animate data-delay="240" className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Link href="/owner/signup"
                  className="relative group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-sm overflow-hidden transition-all hover:scale-[1.03] hover:shadow-lg"
                  style={{ background: FORESTG, color: "#fff", boxShadow: "0 4px 20px rgba(43,92,63,0.3)" }}>
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)", animation: "shine 0.6s ease forwards" }} />
                  Start free trial — 14 days
                  <ArrowRight weight="bold" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="/login"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm border transition-all"
                  style={{ borderColor: BD, color: MUTED }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = BDH; e.currentTarget.style.background = "rgba(43,92,63,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = BD; e.currentTarget.style.background = "transparent"; }}>
                  Sign in to dashboard
                </Link>
              </div>

              <div data-animate data-delay="320" className="flex items-center gap-5 text-xs" style={{ color: DIM }}>
                {["No credit card", "5-min setup", "Cancel anytime"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle weight="fill" className="w-3.5 h-3.5" style={{ color: FOREST }} />{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Mockup */}
            <div data-animate="fade-right" data-delay="200" className="relative lg:pl-4">
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ══ LOGO TICKER ════════════════════════════════════════════════════════ */}
      <div className="border-y py-6 overflow-hidden" style={{ background: CREAM, borderColor: BD }}>
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: DIM }}>
          Trusted by retailers at
        </p>
        <div className="flex animate-ticker whitespace-nowrap select-none">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} className="inline-flex items-center gap-2.5 px-10 text-sm font-semibold" style={{ color: DIM }}>
              <span className="w-1 h-1 rounded-full" style={{ background: DIM, opacity: 0.4 }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* ══ STATS (dark forest section) ════════════════════════════════════════ */}
      <section className="py-24 sm:py-28 relative overflow-hidden" style={{ background: DEEP_BG }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="absolute -left-24 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(43,92,63,1) 0%,transparent 70%)", filter: "blur(60px)", opacity: 0.5 }} />
        <div className="absolute -right-24 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(196,144,42,0.8) 0%,transparent 70%)", filter: "blur(60px)", opacity: 0.25 }} />

        <div className="relative max-w-4xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 rounded-3xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.06)", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
            {[
              { to: 500,  prefix: "",  suffix: "+",    label: "Ohio retailers"     },
              { to: 2100, prefix: "$", suffix: "K+",   label: "Losses prevented"   },
              { to: 99,   prefix: "",  suffix: "%",    label: "Uptime guaranteed"  },
              { to: 45,   prefix: "",  suffix: " min", label: "Saved per delivery" },
            ].map((s, i) => (
              <div key={s.label} data-animate data-delay={i * 90}
                className="p-8 sm:p-10 text-center space-y-2" style={{ background: DEEP_BG }}>
                <p className="text-4xl sm:text-5xl font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-display,var(--font-sans))", backgroundImage: GOLDT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <div data-animate><SectionLabel>Features</SectionLabel></div>
            <h2 data-animate data-delay="100"
              className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-display,var(--font-sans))", color: TXT }}>
              Everything to run a<br />clean operation
            </h2>
            <p data-animate data-delay="200" className="text-base leading-relaxed" style={{ color: MUTED }}>
              From first delivery scan to final settlement — the complete lottery workflow, handled.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body, isGold }, i) => {
              const accent  = isGold ? GOLD : FOREST;
              const accentG = isGold ? GOLDT : FORESTG;
              return (
                <div key={title} data-animate data-delay={i * 55}>
                  <TiltCard
                    className="group relative rounded-2xl p-6 space-y-4 border overflow-hidden cursor-default h-full"
                    style={{ background: CARD, borderColor: BD }}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl"
                      style={{ background: accentG }} />
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center border"
                      style={{
                        background: isGold ? "rgba(196,144,42,0.09)" : "rgba(43,92,63,0.09)",
                        borderColor: isGold ? "rgba(196,144,42,0.22)" : "rgba(43,92,63,0.22)",
                      }}>
                      <Icon weight="bold" className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-base" style={{ color: TXT }}>{title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
                    </div>
                  </TiltCard>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ PRODUCT SHOWCASE ════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 overflow-hidden" style={{ background: CREAM }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="relative rounded-3xl p-10 sm:p-14 lg:p-16 border overflow-hidden"
            style={{ background: CARD, borderColor: BD }}>
            <div className="absolute inset-0 pointer-events-none opacity-30"
              style={{ backgroundImage: "radial-gradient(circle,rgba(43,92,63,0.04) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />

            <div className="relative grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
              <div className="space-y-8">
                <SectionLabel>Dashboard</SectionLabel>
                <h2 data-animate="fade-left"
                  className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
                  style={{ fontFamily: "var(--font-display,var(--font-sans))", color: TXT }}>
                  Everything visible.<br />
                  <span style={{ color: DIM }}>Nothing hidden.</span>
                </h2>
                <p data-animate="fade-left" data-delay="100" className="text-base leading-relaxed" style={{ color: MUTED }}>
                  Your owner dashboard puts shipment history, active books, slot fill rates, shift data, and pending approvals on a single screen — updated in real time.
                </p>
                <ul className="space-y-3.5">
                  {[
                    "Live slot board with book status per position",
                    "Shift-by-shift ticket comparison across all employees",
                    "One-tap approve or disable employee access",
                    "Exportable audit log for Ohio Lottery compliance",
                    "Automated fraud alert notifications",
                  ].map((item, i) => (
                    <li key={item} data-animate="fade-left" data-delay={200 + i * 60}
                      className="flex items-start gap-3 text-sm" style={{ color: MUTED }}>
                      <CheckCircle weight="fill" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: FOREST }} />{item}
                    </li>
                  ))}
                </ul>
                <Link href="/owner/signup"
                  data-animate="fade-left" data-delay="520"
                  className="inline-flex items-center gap-2 text-sm font-semibold group transition-all"
                  style={{ color: FOREST }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = FOREST2)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = FOREST)}>
                  Try it free
                  <ArrowUpRight weight="bold" className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Compact slot board mockup */}
              <div data-animate="fade-right" data-delay="80">
                <div className="relative">
                  <div className="absolute -inset-px rounded-2xl pointer-events-none"
                    style={{ background: "linear-gradient(135deg,rgba(43,92,63,0.25),rgba(196,144,42,0.1),transparent 65%)" }} />
                  <div className="relative rounded-2xl overflow-hidden border shadow-xl"
                    style={{ background: DEEP_BG, borderColor: "rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center gap-3 px-4 py-3 border-b"
                      style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
                      <div className="flex gap-1.5">
                        {["#ff5f5680", "#ffbd2e80", "#27c93f80"].map((c) => (
                          <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                        app.lottoguard.io/owner/slots
                      </span>
                    </div>
                    <div className="flex">
                      <div className="w-28 border-r p-2 space-y-1"
                        style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.07)" }}>
                        {["Dashboard", "Inventory", "Books", "Slots", "Employees"].map((item, i) => (
                          <div key={item} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium"
                            style={i === 3
                              ? { background: "rgba(58,140,90,0.15)", color: "#3A8C5A", border: "1px solid rgba(58,140,90,0.25)" }
                              : { color: "rgba(255,255,255,0.22)" }}>
                            {item}
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>Slot Board</p>
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full border"
                            style={{ color: "#3A8C5A", background: "rgba(58,140,90,0.1)", borderColor: "rgba(58,140,90,0.25)" }}>
                            5 empty
                          </span>
                        </div>
                        {[
                          { label: "$1",  f: 4, t: 5, c: { bg: "rgba(58,140,90,0.1)",  bd: "rgba(58,140,90,0.25)",  tx: "#3A8C5A" } },
                          { label: "$5",  f: 5, t: 5, c: { bg: "rgba(196,144,42,0.1)", bd: "rgba(196,144,42,0.25)", tx: "#C4902A" } },
                          { label: "$10", f: 3, t: 5, c: { bg: "rgba(58,140,90,0.1)",  bd: "rgba(58,140,90,0.25)",  tx: "#3A8C5A" } },
                          { label: "$20", f: 2, t: 4, c: { bg: "rgba(196,144,42,0.1)", bd: "rgba(196,144,42,0.25)", tx: "#C4902A" } },
                        ].map((tier) => (
                          <div key={tier.label} className="flex items-center gap-2">
                            <div className="w-9 shrink-0 rounded-lg border py-2 text-center text-[9px] font-bold"
                              style={{ background: tier.c.bg, borderColor: tier.c.bd, color: tier.c.tx }}>
                              {tier.label}
                            </div>
                            <div className="flex gap-1">
                              {Array.from({ length: tier.t }, (_, i) => (
                                <div key={i}
                                  className="w-9 h-8 rounded-lg border flex items-center justify-center text-[9px] font-semibold"
                                  style={i < tier.f
                                    ? { background: tier.c.bg, borderColor: tier.c.bd, color: tier.c.tx }
                                    : { borderStyle: "dashed", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.15)" }}>
                                  {i < tier.f ? `#${i + 1}` : "○"}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1">
                          <TrendUp weight="fill" className="w-3.5 h-3.5" style={{ color: "#3A8C5A" }} />
                          <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>All $5 slots filled</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <div data-animate><SectionLabel>How It Works</SectionLabel></div>
            <h2 data-animate data-delay="100"
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display,var(--font-sans))", color: TXT }}>
              Up and running in minutes
            </h2>
            <p data-animate data-delay="200" className="text-base" style={{ color: MUTED }}>
              Three steps. No IT team. No hardware.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+36px)] right-[calc(16.67%+36px)] h-px"
              style={{ background: `linear-gradient(90deg,${FOREST}55,${GOLD}55)` }} />
            {STEPS.map(({ num, title, body }, i) => (
              <div key={num} data-animate data-delay={i * 110} className="space-y-5">
                <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center border"
                  style={{ background: "rgba(43,92,63,0.06)", borderColor: "rgba(43,92,63,0.18)" }}>
                  <span className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-display,var(--font-sans))", backgroundImage: GOLDT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {num}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-base" style={{ color: TXT }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMPLIANCE / SECURITY ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 relative overflow-hidden" style={{ background: CREAM }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-start">
            <div className="space-y-8">
              <div><SectionLabel>Compliance &amp; Security</SectionLabel></div>
              <h2 data-animate="fade-left"
                className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
                style={{ fontFamily: "var(--font-display,var(--font-sans))", color: TXT }}>
                Built for Ohio Lottery<br />compliance, by design.
              </h2>
              <p data-animate="fade-left" data-delay="100" className="text-base leading-relaxed" style={{ color: MUTED }}>
                Every transaction, shift change, and inventory adjustment is logged, timestamped, and permanently attributable. LottoGuard keeps you audit-ready every day of the year.
              </p>
              <ul className="space-y-4">
                {[
                  "Complete, tamper-proof action log for all employees",
                  "Role-based access — owners and employees see only what they need",
                  "One-click compliance export for Ohio Lottery requirements",
                  "Automatic discrepancy detection at every shift close",
                  "Instant emergency alerts when cash doesn't reconcile",
                ].map((item, i) => (
                  <li key={item} data-animate="fade-left" data-delay={200 + i * 60}
                    className="flex items-start gap-3 text-sm" style={{ color: MUTED }}>
                    <CheckCircle weight="fill" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: FOREST }} />{item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {COMPLIANCE_CARDS.map(({ icon: Icon, title, body }, i) => (
                <div key={title} data-animate data-delay={i * 80}
                  className="group rounded-2xl p-5 space-y-3.5 border transition-all duration-300 cursor-default hover:-translate-y-0.5"
                  style={{ background: CARD, borderColor: BD }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = BDH)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = BD)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                    style={{ background: "rgba(43,92,63,0.09)", borderColor: "rgba(43,92,63,0.2)" }}>
                    <Icon weight="bold" className="w-5 h-5" style={{ color: FOREST }} />
                  </div>
                  <p className="font-semibold text-sm" style={{ color: TXT }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: DIM }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <div data-animate><SectionLabel>Testimonials</SectionLabel></div>
            <h2 data-animate data-delay="100"
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display,var(--font-sans))", color: TXT }}>
              Trusted by Ohio store owners
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ quote, name, role, initials }, i) => (
              <div key={name} data-animate data-delay={i * 100}
                className="group rounded-2xl p-7 space-y-5 border transition-all duration-300 hover:-translate-y-1 cursor-default"
                style={{ background: CARD, borderColor: BD }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = BDH)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = BD)}>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} weight="fill" className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: BD }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border"
                    style={{ background: "rgba(43,92,63,0.09)", borderColor: "rgba(43,92,63,0.22)", color: FOREST }}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: TXT }}>{name}</p>
                    <p className="text-xs" style={{ color: DIM }}>{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 sm:py-28" style={{ background: CREAM }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 space-y-16">
          <div className="text-center space-y-5 max-w-lg mx-auto">
            <div data-animate><SectionLabel>Pricing</SectionLabel></div>
            <h2 data-animate data-delay="100"
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display,var(--font-sans))", color: TXT }}>
              Simple, honest pricing
            </h2>
            <p data-animate data-delay="200" className="text-base" style={{ color: MUTED }}>
              14-day free trial. No credit card. Cancel anytime.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 items-start">
            {PRICING.map((p, i) => (
              <div key={p.name} data-animate data-delay={i * 110}
                className="rounded-2xl p-8 space-y-7 border relative overflow-hidden"
                style={{
                  background:  p.highlight ? FOREST2 : CARD,
                  borderColor: p.highlight ? "rgba(43,92,63,0.5)" : BD,
                  boxShadow:   p.highlight ? "0 0 60px rgba(43,92,63,0.12)" : "none",
                }}>
                {p.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: "linear-gradient(90deg,transparent,rgba(196,144,42,0.6),transparent)" }} />
                )}
                {p.highlight && (
                  <span className="inline-block text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full border"
                    style={{ background: "rgba(196,144,42,0.12)", borderColor: "rgba(196,144,42,0.3)", color: "#E8B84B" }}>
                    Most Popular
                  </span>
                )}
                <div className="space-y-2">
                  <p className="font-semibold text-base" style={{ color: p.highlight ? "rgba(255,255,255,0.9)" : TXT }}>{p.name}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-bold tracking-tight tabular-nums"
                      style={{ fontFamily: "var(--font-display,var(--font-sans))", backgroundImage: p.highlight ? GOLDT : FORESTG, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      ${p.price}
                    </span>
                    <span className="text-sm" style={{ color: p.highlight ? "rgba(255,255,255,0.35)" : DIM }}>/mo</span>
                  </div>
                  <p className="text-sm" style={{ color: p.highlight ? "rgba(255,255,255,0.5)" : MUTED }}>{p.desc}</p>
                </div>
                <ul className="space-y-3.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <CheckCircle weight="fill" className="w-4 h-4 shrink-0" style={{ color: p.highlight ? "#E8B84B" : FOREST }} />
                      <span style={{ color: p.highlight ? "rgba(255,255,255,0.65)" : MUTED }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href}
                  className="block text-center py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={p.highlight
                    ? { background: GOLDT, color: "#1A1A14", boxShadow: "0 4px 20px rgba(196,144,42,0.3)" }
                    : { background: FORESTG, color: "#fff", boxShadow: "0 4px 16px rgba(43,92,63,0.2)" }}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═══════════════════════════════════════════════════════════ */}
      <section className="py-28 sm:py-36 relative overflow-hidden" style={{ background: DEEP_BG }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(43,92,63,0.35) 0%,transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg,transparent,rgba(196,144,42,0.4),transparent)" }} />

        <div className="relative max-w-xl mx-auto px-5 sm:px-8 text-center space-y-8">
          <div data-animate="scale-in"
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border"
            style={{ background: "rgba(43,92,63,0.25)", borderColor: "rgba(58,140,90,0.3)" }}>
            <Ticket weight="bold" className="w-8 h-8" style={{ color: "#3A8C5A" }} />
          </div>
          <h2 data-animate data-delay="100"
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-display,var(--font-sans))", color: "#F8F5EF" }}>
            Ready to protect<br />
            <span style={{ backgroundImage: GOLDT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              every ticket you sell?
            </span>
          </h2>
          <p data-animate data-delay="200" className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Join 500+ Ohio retailers trusting LottoGuard to protect their lottery revenue — every day, every shift.
          </p>
          <div data-animate data-delay="300" className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/owner/signup"
              className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-sm overflow-hidden transition-all hover:scale-[1.03]"
              style={{ background: FORESTG, color: "#fff", boxShadow: "0 4px 28px rgba(43,92,63,0.4)" }}>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)", animation: "shine 0.6s ease forwards" }} />
              Start your free trial
              <ArrowRight weight="bold" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm border transition-all hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}>
              Sign in to dashboard
            </Link>
          </div>
          <p data-animate data-delay="400" className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
            No credit card · 14-day trial · Full access from day one
          </p>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <footer style={{ background: "#070F09", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="space-y-5 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: FORESTG }}>
                  <ShieldCheck weight="fill" className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>LottoGuard</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>
                Enterprise lottery operations platform for Ohio gas station retailers.
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(196,144,42,0.4)" }}>
                Ohio Lottery Compliance Ready
              </p>
            </div>

            {[
              { label: "Product", links: ["Features", "Pricing", "Security", "Compliance", "Changelog"] },
              { label: "Company", links: ["About", "Privacy Policy", "Terms of Service", "Contact", "Support"] },
            ].map((col) => (
              <div key={col.label} className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>{col.label}</p>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.22)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
                      >{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Get started</p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.22)" }}>14-day free trial. No credit card required.</p>
              <Link href="/owner/signup"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 border"
                style={{ background: "rgba(43,92,63,0.25)", borderColor: "rgba(58,140,90,0.3)", color: "#3A8C5A" }}>
                Start free trial <ArrowRight weight="bold" className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>© {new Date().getFullYear()} LottoGuard, Inc. All rights reserved.</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>Built for Ohio retailers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
