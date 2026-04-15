"use client";

import { useEffect, useState } from "react";
import { Copy, FloppyDisk } from "@phosphor-icons/react";

type OrgForm = {
  orgName: string; llcName: string; address: string;
  retailNum: string; phone: string; slots: string;
};

export default function SettingsPage() {
  const [form, setForm] = useState<OrgForm>({ orgName: "", llcName: "", address: "", retailNum: "", phone: "", slots: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) {
        const { org } = await r.json();
        setForm({
          orgName:   (org.orgName as string) ?? "",
          llcName:   (org.llcName as string) ?? "",
          address:   (org.address as string) ?? "",
          retailNum: (org.retailNum as string) ?? "",
          phone:     (org.phone as string) ?? "",
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

  const fields: { key: keyof OrgForm; label: string; type?: string }[] = [
    { key: "orgName",   label: "Organization Name" },
    { key: "llcName",   label: "LLC Name" },
    { key: "address",   label: "Address" },
    { key: "retailNum", label: "Ohio Retail Number" },
    { key: "phone",     label: "Phone Number" },
    { key: "slots",     label: "Number of Lottery Slots", type: "number" },
  ];

  return (
    <div className="p-6 max-w-xl space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {/* Org form */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Organization</h2>
        <form onSubmit={save} className="space-y-4">
          {fields.map(({ key, label, type }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium">{label}</label>
              {loading
                ? <div className="h-10 bg-muted rounded-xl animate-pulse" />
                : (
                  <input
                    type={type ?? "text"}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                )
              }
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={saving || loading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm">
            <FloppyDisk className="size-4" />
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </button>
        </form>
      </section>

      {/* Invite code */}
      <section className="space-y-3 border-t pt-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Employee Invite Code</h2>
        <div className="flex items-center gap-3 border rounded-2xl px-5 py-4 bg-muted/20">
          {loading
            ? <div className="h-7 bg-muted rounded animate-pulse flex-1" />
            : <span className="font-mono text-xl font-bold tracking-widest flex-1">{inviteCode}</span>
          }
          <button onClick={copyCode} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            <Copy className="size-4" />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Share this code with employees so they can register. Regenerating invalidates the old code.</p>
        <button className="text-xs text-destructive hover:underline">Regenerate code</button>
      </section>

      {/* Danger zone */}
      <section className="border-t pt-6 space-y-3">
        <h2 className="text-xs font-semibold text-destructive uppercase tracking-widest">Danger Zone</h2>
        <button className="border border-destructive/40 text-destructive text-sm px-4 py-2.5 rounded-xl hover:bg-destructive/8 transition-colors">
          Delete Organization
        </button>
      </section>
    </div>
  );
}
