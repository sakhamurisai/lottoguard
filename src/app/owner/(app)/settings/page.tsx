"use client";

import { useEffect, useState } from "react";
import {
  Copy, FloppyDisk, ArrowClockwise, Buildings, UsersFour,
  Headset, Warning, CheckCircle, UserCircle, GridFour,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

type OrgForm = {
  orgName: string; llcName: string; address: string;
  retailNum: string; phone: string; slots: string;
};

type Tab = "profile" | "organization" | "invite" | "support" | "danger";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",      label: "Profile",      icon: UserCircle  },
  { id: "organization", label: "Organization", icon: Buildings   },
  { id: "invite",       label: "Invite Code",  icon: UsersFour   },
  { id: "support",      label: "Support",      icon: Headset     },
  { id: "danger",       label: "Danger Zone",  icon: Warning     },
];

const ORG_FIELDS: { key: keyof OrgForm; label: string; placeholder: string; type?: string }[] = [
  { key: "orgName",   label: "Organization Name",       placeholder: "e.g. Lucky Stop LLC"                   },
  { key: "llcName",   label: "LLC / Legal Name",        placeholder: "e.g. Lucky Stop Convenience LLC"       },
  { key: "address",   label: "Store Address",           placeholder: "e.g. 123 Main St, Columbus OH 43201"   },
  { key: "retailNum", label: "Ohio Lottery Retailer #", placeholder: "e.g. 0123456"                          },
  { key: "phone",     label: "Phone Number",            placeholder: "e.g. (614) 555-0100"                   },
  { key: "slots",     label: "Total Lottery Slot Budget", placeholder: "e.g. 10",          type: "number"     },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab,         setTab]         = useState<Tab>("profile");
  const [form,        setForm]        = useState<OrgForm>({ orgName: "", llcName: "", address: "", retailNum: "", phone: "", slots: "" });
  const [inviteCode,  setInviteCode]  = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [regenerating,setRegenerating]= useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) {
        const { org } = await r.json();
        setForm({
          orgName:   (org.orgName   as string) ?? "",
          llcName:   (org.llcName   as string) ?? "",
          address:   (org.address   as string) ?? "",
          retailNum: (org.retailNum as string) ?? "",
          phone:     (org.phone     as string) ?? "",
          slots:     String(org.slots ?? ""),
        });
        setInviteCode((org.inviteCode as string) ?? "");
      }
      setLoading(false);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, slots: Number(form.slots) }),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError((await r.json()).error ?? "Failed to save.");
    setSaving(false);
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateCode() {
    if (!confirm("Regenerate invite code? The old code stops working immediately.")) return;
    setRegenerating(true);
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, slots: Number(form.slots), regenerateInvite: true }),
    });
    if (r.ok) {
      const { org } = await r.json();
      setInviteCode((org?.inviteCode as string) ?? inviteCode);
    }
    setRegenerating(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your organization and account preferences.</p>
      </div>

      <div className="flex gap-6 min-h-[500px]">

        {/* ── Tab sidebar ── */}
        <nav className="w-44 shrink-0 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
                tab === id
                  ? id === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                  : id === "danger"
                    ? "text-destructive/70 hover:bg-destructive/8 hover:text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0">

          {/* Profile */}
          {tab === "profile" && (
            <div className="border rounded-2xl p-6 space-y-6 bg-background shadow-sm">
              <div>
                <h2 className="font-semibold text-base">Your profile</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Account information tied to your owner login.</p>
              </div>

              <div className="max-w-lg space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-black text-primary shrink-0">
                    {user?.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                  </div>
                  <div>
                    <p className="font-semibold">{user?.name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{user?.email ?? "—"}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Owner
                    </span>
                  </div>
                </div>

                <div className="border-t pt-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Full name</label>
                    <input
                      readOnly
                      value={user?.name ?? ""}
                      className="w-full border rounded-xl px-4 py-2.5 text-sm bg-muted/30 text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">Name is set from your Cognito account.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email address</label>
                    <input
                      readOnly
                      value={user?.email ?? ""}
                      className="w-full border rounded-xl px-4 py-2.5 text-sm bg-muted/30 text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support if needed.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Organization</label>
                    <input
                      readOnly
                      value={user?.orgName ?? ""}
                      className="w-full border rounded-xl px-4 py-2.5 text-sm bg-muted/30 text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Slot budget quick-access */}
                <div className="border rounded-2xl p-4 bg-primary/4 border-primary/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <GridFour weight="fill" className="size-4 text-primary" />
                    <p className="text-sm font-semibold">Slot budget</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your store currently has a slot budget set in Organization settings. To increase the number of physical lottery slots in your machine, update it there.
                  </p>
                  <button
                    onClick={() => setTab("organization")}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Go to Organization settings →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Organization */}
          {tab === "organization" && (
            <div className="border rounded-2xl p-6 space-y-6 bg-background shadow-sm">
              <div>
                <h2 className="font-semibold text-base">Organization details</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your store information and Ohio Lottery configuration.</p>
              </div>

              <form onSubmit={save} className="space-y-4 max-w-lg">
                {ORG_FIELDS.map(({ key, label, placeholder, type }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-sm font-medium">{label}</label>
                    {loading
                      ? <div className="h-10 bg-muted rounded-xl animate-pulse" />
                      : (
                        <input
                          type={type ?? "text"}
                          placeholder={placeholder}
                          value={form[key]}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                        />
                      )
                    }
                  </div>
                ))}

                {error && (
                  <p className="text-sm text-destructive flex items-center gap-1.5">
                    <Warning className="size-4" />{error}
                  </p>
                )}
                {saved && (
                  <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle weight="fill" className="size-4" />Saved successfully!
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving || loading}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
                >
                  <FloppyDisk className="size-4" />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </form>
            </div>
          )}

          {/* Invite code */}
          {tab === "invite" && (
            <div className="border rounded-2xl p-6 space-y-6 bg-background shadow-sm">
              <div>
                <h2 className="font-semibold text-base">Employee invite code</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Share this code with employees so they can register and join your store.
                </p>
              </div>

              <div className="space-y-3 max-w-md">
                <div className="flex items-center gap-3 border rounded-2xl px-5 py-4 bg-muted/20">
                  {loading
                    ? <div className="h-8 bg-muted rounded animate-pulse flex-1" />
                    : <span className="font-mono text-2xl font-black tracking-widest flex-1 select-all">{inviteCode}</span>
                  }
                  <button
                    onClick={copyCode}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium shrink-0"
                  >
                    <Copy className="size-4" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Employees enter this code during registration to join your store. You still need to approve each employee before they can clock in.
                </p>

                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm font-medium">Regenerate code</p>
                  <p className="text-xs text-muted-foreground">
                    Generates a new code and immediately invalidates the old one. Employees who have already registered are not affected.
                  </p>
                  <button
                    onClick={regenerateCode}
                    disabled={regenerating || loading}
                    className="flex items-center gap-1.5 text-sm border rounded-xl px-4 py-2.5 hover:bg-muted transition-colors font-medium disabled:opacity-50"
                  >
                    <ArrowClockwise className={cn("size-4", regenerating && "animate-spin")} />
                    {regenerating ? "Regenerating…" : "Regenerate invite code"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Support */}
          {tab === "support" && (
            <div className="border rounded-2xl p-6 space-y-6 bg-background shadow-sm">
              <div>
                <h2 className="font-semibold text-base">Support</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Need help? We&apos;re here for you.</p>
              </div>

              <div className="max-w-md space-y-4">
                <div className="border rounded-2xl p-5 space-y-3">
                  <p className="text-sm font-semibold">Contact us</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📧</span>
                      <a href="mailto:support@lottoguard.app" className="hover:text-foreground transition-colors">support@lottoguard.app</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">📞</span>
                      <a href="tel:6145550199" className="hover:text-foreground transition-colors">(614) 555-0199</a>
                    </div>
                  </div>
                </div>

                <div className="border rounded-2xl p-5 space-y-3">
                  <p className="text-sm font-semibold">Response times</p>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex justify-between"><span>Email support</span><span className="font-medium text-foreground">Within 24 hrs</span></div>
                    <div className="flex justify-between"><span>Phone (business hours)</span><span className="font-medium text-foreground">Same day</span></div>
                    <div className="flex justify-between"><span>Critical issues</span><span className="font-medium text-foreground">Within 2 hrs</span></div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Business hours: Mon–Fri 8am–6pm ET
                </div>
              </div>
            </div>
          )}

          {/* Danger zone */}
          {tab === "danger" && (
            <div className="border border-destructive/30 rounded-2xl p-6 space-y-6 bg-destructive/3 shadow-sm">
              <div>
                <h2 className="font-semibold text-base text-destructive">Danger zone</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Irreversible actions. Proceed with caution.
                </p>
              </div>

              <div className="max-w-md space-y-4">
                <div className="border border-destructive/20 rounded-2xl p-5 space-y-3 bg-background">
                  <div>
                    <p className="text-sm font-semibold">Delete organization</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently deletes your organization, all employees, books, shifts, and slot data. This cannot be undone.
                    </p>
                  </div>
                  <button className="border border-destructive/40 text-destructive text-sm px-4 py-2.5 rounded-xl hover:bg-destructive/8 transition-colors font-medium">
                    Delete organization
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
