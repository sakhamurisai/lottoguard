import Link from "next/link";
import {
  ShieldCheck, Camera, Clock, GridFour, Users, Bell, ListChecks,
  ArrowRight, CheckCircle, Star, Ticket,
} from "@phosphor-icons/react/dist/ssr";
import { MarketingNav } from "@/components/marketing-nav";

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Camera,
    title: "AI Receipt Scanning",
    body: "Snap a photo of any lottery delivery receipt. OpenAI Vision extracts game ID, pack number, ticket range, and price — instantly.",
  },
  {
    icon: Clock,
    title: "Shift Tracking",
    body: "Employees clock in and out with starting and ending ticket numbers. The system automatically calculates tickets sold per shift.",
  },
  {
    icon: GridFour,
    title: "Slot Management",
    body: "Visual grid shows every machine slot in real time — which book is assigned, its status, and how many tickets remain.",
  },
  {
    icon: Users,
    title: "Employee Management",
    body: "Invite employees with a secure code. Approve or reject registrations. Disable access instantly if needed.",
  },
  {
    icon: Bell,
    title: "Fraud Alerts",
    body: "Get notified the moment ticket counts don't add up, a slot goes unmanned, or a book isn't settled after its sell-through.",
  },
  {
    icon: ListChecks,
    title: "Full Audit Trail",
    body: "Every activation, settlement, shift, and employee action is logged with timestamps — ready for Ohio Lottery compliance review.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Register your store",
    body: "Enter your organization details and Ohio retail number. Your account is ready in under 2 minutes.",
  },
  {
    num: "02",
    title: "Onboard your team",
    body: "Share your invite code with employees. They register, you approve — one tap.",
  },
  {
    num: "03",
    title: "Track every ticket",
    body: "Scan receipts to add books, activate slots, track shifts, and settle books. Fraud has nowhere to hide.",
  },
];

const TESTIMONIALS = [
  {
    quote: "We caught a $400 discrepancy on day one. LottoGuard paid for itself before the end of the first week.",
    name: "Michael R.",
    role: "Owner, Sunoco — Columbus, OH",
    initials: "MR",
  },
  {
    quote: "The receipt scanning alone saves my manager 45 minutes every delivery day. It's just fast.",
    name: "Sandra T.",
    role: "Owner, BP Express — Dayton, OH",
    initials: "ST",
  },
  {
    quote: "I can see exactly who sold what on every shift, from my phone. No more guessing.",
    name: "Kevin L.",
    role: "Manager, Circle K — Cleveland, OH",
    initials: "KL",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "Perfect for single-location stores getting started.",
    features: ["Up to 5 employees", "Up to 10 lottery slots", "Receipt scanning", "Shift tracking", "Email support"],
    cta: "Start Free Trial",
    href: "/owner/signup",
    highlight: false,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/mo",
    desc: "For stores that need unlimited scale and priority support.",
    features: ["Unlimited employees", "Unlimited slots", "Everything in Starter", "Fraud alert notifications", "Priority support", "Compliance audit export"],
    cta: "Start Free Trial",
    href: "/owner/signup",
    highlight: true,
  },
];

const STATS = [
  { value: "500+",  label: "Ohio stores" },
  { value: "$2.1M", label: "Losses prevented" },
  { value: "4.9★",  label: "Average rating" },
  { value: "99.9%", label: "Uptime" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <MarketingNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-14 items-center">
          {/* Left */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-medium text-primary bg-primary/5">
              <ShieldCheck weight="fill" className="size-3.5" />
              Ohio Lottery Compliant
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              Stop lottery fraud.<br />
              <span className="text-primary">Protect every ticket.</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              The all-in-one platform for Ohio gas stations to track scratch-off inventory,
              manage employees, and prevent theft — from scan to settlement.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/owner/signup"
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Start Free Trial <ArrowRight weight="bold" className="size-4" />
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 border px-6 py-3 rounded-md font-medium hover:bg-accent transition-colors"
              >
                Sign In
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              No credit card required · Setup in under 5 minutes · Cancel anytime
            </p>
          </div>

          {/* Right — dashboard mockup */}
          <div className="hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="border-b py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to run a clean operation</h2>
            <p className="text-muted-foreground">From the first scan to the final settlement, LottoGuard handles every step of the lottery workflow.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="border rounded-xl p-5 space-y-3 hover:shadow-sm transition-shadow">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="border-b py-20 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Up and running in minutes</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="space-y-3">
                <span className="text-4xl font-black text-primary/20">{s.num}</span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="border-b py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Trusted by Ohio store owners</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="border rounded-xl p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} weight="fill" className="size-4 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-1">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="border-b py-20 bg-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">14-day free trial on all plans. No credit card required.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={`border rounded-xl p-6 space-y-5 ${p.highlight ? "border-primary ring-2 ring-primary/20 bg-background" : ""}`}
              >
                {p.highlight && (
                  <div className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-0.5 rounded-full">Most Popular</div>
                )}
                <div>
                  <p className="font-semibold text-lg">{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-black">{p.price}</span>
                    <span className="text-muted-foreground text-sm">{p.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                </div>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle weight="fill" className="size-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`block text-center py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90 ${
                    p.highlight
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-accent"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <Ticket weight="fill" className="size-10 text-primary mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to stop lottery fraud at your store?
          </h2>
          <p className="text-muted-foreground">
            Join 500+ Ohio retailers who trust LottoGuard to protect their lottery revenue every day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/owner/signup"
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Start Free Trial <ArrowRight weight="bold" className="size-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 border px-8 py-3 rounded-md font-medium hover:bg-accent transition-colors"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <ShieldCheck weight="fill" className="text-primary size-4" />
            LottoGuard
          </div>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Support"].map((l) => (
              <a key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LottoGuard. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ── Dashboard mockup component ────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative rounded-xl border shadow-2xl overflow-hidden bg-background text-[10px] select-none">
      {/* Fake browser bar */}
      <div className="border-b bg-muted/40 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400" />
          <div className="size-2.5 rounded-full bg-yellow-400" />
          <div className="size-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-muted rounded px-2 py-0.5 text-[9px] text-muted-foreground font-mono">
          app.lottoguard.io/owner
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-28 border-r bg-sidebar p-2 space-y-0.5 shrink-0">
          <div className="flex items-center gap-1 px-1.5 py-2 mb-2">
            <ShieldCheck weight="fill" className="size-3 text-primary" />
            <span className="font-bold text-sidebar-foreground text-[9px]">LottoGuard</span>
          </div>
          {["Dashboard", "Inventory", "Activate/Settle", "Slots", "Employees"].map((item, i) => (
            <div
              key={item}
              className={`px-2 py-1.5 rounded text-[9px] ${i === 0 ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/60"}`}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 space-y-3">
          <p className="font-semibold text-[11px]">Dashboard</p>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: "Active Books", v: "12" },
              { l: "Slots Filled", v: "8/10" },
              { l: "Pending", v: "3" },
              { l: "Sold Today", v: "247" },
            ].map((s) => (
              <div key={s.l} className="border rounded p-2">
                <p className="text-muted-foreground text-[8px]">{s.l}</p>
                <p className="font-bold text-sm">{s.v}</p>
              </div>
            ))}
          </div>
          {/* Slot grid */}
          <div className="border rounded p-2 space-y-1.5">
            <p className="font-medium text-[9px]">Slot Overview</p>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  className={`aspect-square rounded flex items-center justify-center font-medium ${
                    n <= 8 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
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
  );
}
