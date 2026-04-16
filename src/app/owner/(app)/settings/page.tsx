"use client";

import { useEffect, useState } from "react";
import { Copy, FloppyDisk, ArrowClockwise } from "@phosphor-icons/react";

type OrgForm = {
  orgName: string; llcName: string; address: string;
  retailNum: string; phone: string; slots: string;
};

export default function SettingsPage() {
  const [form,       setForm]       = useState<OrgForm>({ orgName: "", llcName: "", address: "", retailNum: "", phone: "", slots: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error,      setError]      = useState("");

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
    if (!confirm("Regenerate invite code? The old code will stop working immediately.")) return;
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

  const orgFields: { key: keyof OrgForm; label: string; placeholder?: string; type?: string }[] = [
    { key: "orgName",   label: "Organization Name",        placeholder: "e.g. Lucky Stop LLC" },
    { key: "llcName",   label: "LLC / Legal Name",         placeholder: "e.g. Lucky Stop Convenience LLC" },
    { key: "address",   label: "Store Address",            placeholder: "e.g. 123 Main St, Columbus OH 43201" },
    { key: "retailNum", label: "Ohio Lottery Retailer #",  placeholder: "e.g. 0123456" },
    { key: "phone",     label: "Phone Number",             placeholder: "e.g. (614) 555-0100" },
    { key: "slots",     label: "Number of Lottery Slots",  placeholder: "e.g. 10", type: "number" },
  ];

  function field(key: keyof OrgForm, value: string, label: string, placeholder?: string, type = "text") {
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm font-medium">{label}</label>
        {loading
          ? <div className="h-10 bg-muted rounded-xl animate-pulse" />
          : (
            <input
              type={type}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
          )
        }
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl space-y-10">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {/* ── Organization ── */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Organization</h2>
        <form onSubmit={save} className="space-y-4">
          {orgFields.map(({ key, label, placeholder, type }) =>
            field(key, form[key], label, placeholder, type)
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={saving || loading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
            <FloppyDisk className="size-4" />
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </button>
        </form>
      </section>

      {/* ── Invite code ── */}
      <section className="space-y-4 border-t pt-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Employee Invite Code</h2>
        <p className="text-sm text-muted-foreground">
          Share this code with employees so they can register for your store.
        </p>
        <div className="flex items-center gap-3 border rounded-2xl px-5 py-4 bg-muted/20">
          {loading
            ? <div className="h-7 bg-muted rounded animate-pulse flex-1" />
            : <span className="font-mono text-xl font-bold tracking-widest flex-1 select-all">{inviteCode}</span>
          }
          <button onClick={copyCode} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            <Copy className="size-4" />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button onClick={regenerateCode} disabled={regenerating || loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowClockwise className={cn("size-3.5", regenerating && "animate-spin")} />
          {regenerating ? "Regenerating…" : "Regenerate code"}
        </button>
        <p className="text-xs text-muted-foreground">
          Regenerating will immediately invalidate the old code. Employees who have already registered are not affected.
        </p>
      </section>

      {/* ── Support ── */}
      <section className="space-y-4 border-t pt-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Support</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Need help? Reach us at:</p>
          <div className="flex flex-col gap-1.5 text-sm">
            <span>📧 support@lottoguard.app</span>
            <span>📞 (614) 555-0199</span>
          </div>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section className="border-t pt-8 space-y-4">
        <h2 className="text-xs font-semibold text-destructive uppercase tracking-widest">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting your organization will permanently remove all data. This cannot be undone.
        </p>
        <button className="border border-destructive/40 text-destructive text-sm px-4 py-2.5 rounded-xl hover:bg-destructive/8 transition-colors">
          Delete Organization
        </button>
      </section>
    </div>
  );
}

// cn helper (tiny — avoids import if tree-shaken differently)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
