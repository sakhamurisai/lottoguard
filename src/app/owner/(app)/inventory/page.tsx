"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera, Plus, X, MagnifyingGlass, ArrowClockwise,
  CheckCircle, XCircle, Warning, Upload, FileText,
  CheckSquare, Square, Trash, ArrowRight, ArrowLeft,
  ImageBroken, PencilSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

type BookStatus = "active" | "inactive" | "settled";
type Book = {
  bookId: string; gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
  status: BookStatus; slot: number | null; createdAt: string;
};

type ReviewBook = {
  gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
};

type Step = "idle" | "method" | "delivery" | "delivery-result" | "order" | "order-result" | "cross-validate" | "review";

type ValidationCheck = { label: string; status: "pass" | "fail" | "warn"; detail?: string };

const STATUS_STYLE: Record<BookStatus, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  inactive: "bg-muted text-muted-foreground",
  settled:  "bg-blue-100 text-blue-700",
};

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];

function ValidationBadge({ check }: { check: ValidationCheck }) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-xl px-4 py-3 text-sm border",
      check.status === "pass" && "bg-emerald-50 border-emerald-200",
      check.status === "fail" && "bg-red-50 border-red-200",
      check.status === "warn" && "bg-amber-50 border-amber-200",
    )}>
      {check.status === "pass" && <CheckCircle weight="fill" className="size-4 text-emerald-600 mt-0.5 shrink-0" />}
      {check.status === "fail" && <XCircle weight="fill" className="size-4 text-red-600 mt-0.5 shrink-0" />}
      {check.status === "warn" && <Warning weight="fill" className="size-4 text-amber-600 mt-0.5 shrink-0" />}
      <div>
        <p className={cn("font-medium",
          check.status === "pass" && "text-emerald-800",
          check.status === "fail" && "text-red-800",
          check.status === "warn" && "text-amber-800",
        )}>{check.label}</p>
        {check.detail && <p className="text-xs mt-0.5 opacity-70">{check.detail}</p>}
      </div>
    </div>
  );
}

function UploadZone({
  scanning, onFile, error, onRetry,
}: {
  scanning: boolean;
  onFile: (f: File) => void;
  error?: string | null;
  onRetry?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5 bg-amber-50 border border-amber-200 flex items-start gap-3">
          <ImageBroken className="size-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Could not read image</p>
            <p className="text-sm text-amber-700 mt-0.5">{error}</p>
            <ul className="text-xs text-amber-600 mt-2 space-y-1 list-disc ml-4">
              <li>Ensure the receipt is flat and fully in frame</li>
              <li>Use bright, even lighting — avoid shadows</li>
              <li>Hold the camera steady and close enough to read text</li>
            </ul>
          </div>
        </div>
        <button onClick={() => { onRetry?.(); ref.current?.click(); }}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-4 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
          <Camera className="size-4" /> Upload clearer image
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onFile(f); } }} />
      </div>
    );
  }

  return (
    <div>
      <div onClick={() => !scanning && ref.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center space-y-3 transition-colors",
          scanning ? "cursor-default bg-muted/10" : "cursor-pointer hover:bg-primary/5 hover:border-primary/40"
        )}>
        {scanning ? (
          <>
            <span className="size-12 rounded-full border-4 border-primary border-t-transparent animate-spin block mx-auto" />
            <p className="text-sm font-semibold">Scanning with AI…</p>
            <p className="text-xs text-muted-foreground">Extracting every character from the receipt</p>
          </>
        ) : (
          <>
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Upload className="size-7 text-primary" />
            </div>
            <p className="font-semibold text-sm">Tap to take photo or upload</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, HEIC · Camera or gallery</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">Choose photo</span>
            </div>
          </>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onFile(f); } }} />
    </div>
  );
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>("idle");

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [deliveryData, setDeliveryData] = useState<Record<string, unknown> | null>(null);
  const [orderData, setOrderData] = useState<Record<string, unknown> | null>(null);
  const [deliveryChecks, setDeliveryChecks] = useState<ValidationCheck[]>([]);
  const [orderChecks, setOrderChecks] = useState<ValidationCheck[]>([]);
  const [crossChecks, setCrossChecks] = useState<ValidationCheck[]>([]);

  // Review state
  const [reviewBooks, setReviewBooks] = useState<ReviewBook[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<number, Partial<ReviewBook>>>({});
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  // Manual entry
  const [manualForm, setManualForm] = useState({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
  const [manualError, setManualError] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inventory");
    if (r.ok) setBooks((await r.json()).books as Book[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Fetch org info for validation
  const [orgRetailerNum, setOrgRetailerNum] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) {
        const { org } = await r.json();
        setOrgRetailerNum((org.retailNum as string) ?? "");
        setOrgAddress((org.address as string) ?? "");
      }
    });
  }, []);

  const filtered = books.filter((b) =>
    [b.gameName, b.gameId, b.pack].some((v) => v.toLowerCase().includes(query.toLowerCase()))
  );

  function closeModal() {
    setStep("idle");
    setScanning(false);
    setScanError(null);
    setDeliveryData(null);
    setOrderData(null);
    setDeliveryChecks([]);
    setOrderChecks([]);
    setCrossChecks([]);
    setReviewBooks([]);
    setSelected(new Set());
    setEdits({});
    setImportDone(false);
    setManualForm({ gameId: "", gameName: "", pack: "", ticketStart: "", ticketEnd: "", price: "" });
    setManualError("");
  }

  async function uploadAndScan(file: File, endpoint: string): Promise<Record<string, unknown> | null> {
    setScanError(null);
    setScanning(true);
    try {
      const pr = await fetch("/api/upload/presign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!pr.ok) throw new Error("Upload failed");
      const { url, key } = await pr.json();
      await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const sr = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!sr.ok) { setScanError("Could not extract data from image. Try a clearer photo."); return null; }
      const { data } = await sr.json();
      return data as Record<string, unknown>;
    } catch (err: unknown) {
      setScanError((err as Error).message ?? "Upload failed");
      return null;
    } finally {
      setScanning(false);
    }
  }

  function validateDelivery(data: Record<string, unknown>): ValidationCheck[] {
    const normalize = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];

    const header = (data.headerText as string ?? "").toLowerCase();
    checks.push({
      label: 'Header contains "Instant Ticket Delivery Receipt"',
      status: header.includes("instant ticket delivery") ? "pass" : "fail",
      detail: header.includes("instant ticket delivery") ? `Found: "${data.headerText}"` : `Found: "${data.headerText}"`,
    });

    const rn = normalize(data.retailerNum as string);
    const orgRn = normalize(orgRetailerNum);
    checks.push({
      label: `Retailer number matches (${orgRetailerNum})`,
      status: !rn ? "fail" : rn === orgRn ? "pass" : "fail",
      detail: !rn ? "Not found in receipt" : rn === orgRn ? `Matched: ${data.retailerNum}` : `Receipt has: ${data.retailerNum}`,
    });

    checks.push({
      label: "Address verified against registered address",
      status: (data.retailerAddress as string) ? "warn" : "warn",
      detail: (data.retailerAddress as string)
        ? `Receipt address: ${data.retailerAddress} | Registered: ${orgAddress}`
        : "Address not found — verify manually",
    });

    return checks;
  }

  function validateOrder(data: Record<string, unknown>): ValidationCheck[] {
    const normalize = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];

    const header = (data.headerText as string ?? "").toLowerCase();
    checks.push({
      label: 'Header contains "Confirm Order"',
      status: header.includes("confirm") ? "pass" : "fail",
      detail: `Found: "${data.headerText}"`,
    });

    const rn = normalize(data.retailerNum as string);
    const orgRn = normalize(orgRetailerNum);
    checks.push({
      label: `Retailer number matches (${orgRetailerNum})`,
      status: !rn ? "fail" : rn === orgRn ? "pass" : "fail",
      detail: !rn ? "Not found in receipt" : rn === orgRn ? `Matched: ${data.retailerNum}` : `Receipt has: ${data.retailerNum}`,
    });

    checks.push({
      label: "Order number present",
      status: data.orderNumber ? "pass" : "fail",
      detail: data.orderNumber ? `Order #: ${data.orderNumber}` : "Order number not found in receipt",
    });

    return checks;
  }

  function crossValidate(dd: Record<string, unknown>, od: Record<string, unknown>): ValidationCheck[] {
    const normalize = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const checks: ValidationCheck[] = [];

    const dr = normalize(dd.retailerNum as string);
    const or = normalize(od.retailerNum as string);
    checks.push({
      label: "Retailer numbers match between both receipts",
      status: dr && or && dr === or ? "pass" : "fail",
      detail: dr === or ? `Both: ${dd.retailerNum}` : `Delivery: ${dd.retailerNum} vs Order: ${od.retailerNum}`,
    });

    const dd_ = (dd.date as string ?? "").slice(0, 10);
    const od_ = (od.date as string ?? "").slice(0, 10);
    checks.push({
      label: "Receipt dates match",
      status: dd_ && od_ && dd_ === od_ ? "pass" : "warn",
      detail: dd_ === od_ ? `Both: ${dd_}` : `Delivery: ${dd_ || "unknown"} | Order: ${od_ || "unknown"} — verify manually`,
    });

    const dOrd = normalize(dd.orderNumber as string);
    const oOrd = normalize(od.orderNumber as string);
    checks.push({
      label: "Order numbers match",
      status: !dOrd || !oOrd ? "warn" : dOrd === oOrd ? "pass" : "fail",
      detail: dOrd === oOrd ? `Order #: ${dd.orderNumber}` : !dOrd || !oOrd
        ? `One or both order numbers missing — verify manually`
        : `Delivery: ${dd.orderNumber} vs Order: ${od.orderNumber}`,
    });

    const deliveryBookCount = (dd.games as { packNumbers?: string[] }[] ?? [])
      .reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0);
    const orderBookCount = (od.books as unknown[] ?? []).length;
    checks.push({
      label: `Book counts match`,
      status: deliveryBookCount > 0 && orderBookCount > 0 && deliveryBookCount === orderBookCount ? "pass" : "warn",
      detail: deliveryBookCount === orderBookCount
        ? `Both: ${deliveryBookCount} books`
        : `Delivery: ${deliveryBookCount} books | Order: ${orderBookCount} books`,
    });

    return checks;
  }

  function buildReviewBooks(dd: Record<string, unknown>): ReviewBook[] {
    const games = (dd.games as {
      gameId: string; gameDescription: string; ticketValue: number;
      packNumbers?: string[];
    }[] ?? []);

    const books: ReviewBook[] = [];
    games.forEach((g) => {
      (g.packNumbers ?? []).forEach((pack) => {
        books.push({
          gameId: g.gameId ?? "",
          gameName: g.gameDescription ?? "",
          pack,
          ticketStart: 1,
          ticketEnd: 300,
          price: g.ticketValue ?? 0,
        });
      });
    });
    return books;
  }

  async function handleDeliveryScan(file: File) {
    const data = await uploadAndScan(file, "/api/receipt/scan-delivery");
    if (!data) return;
    setDeliveryData(data);
    setDeliveryChecks(validateDelivery(data));
    setStep("delivery-result");
  }

  async function handleOrderScan(file: File) {
    if (!deliveryData) return;
    const data = await uploadAndScan(file, "/api/receipt/scan-order");
    if (!data) return;
    setOrderData(data);
    setOrderChecks(validateOrder(data));
    const cross = crossValidate(deliveryData, data);
    setCrossChecks(cross);
    setStep("order-result");
  }

  function proceedToReview() {
    if (!deliveryData) return;
    const rb = buildReviewBooks(deliveryData);
    setReviewBooks(rb);
    setSelected(new Set(rb.map((_, i) => i)));
    setEdits({});
    setImportDone(false);
    setStep("review");
  }

  function bookVal(i: number, k: keyof ReviewBook) {
    return edits[i]?.[k] ?? reviewBooks[i]?.[k] ?? "";
  }

  function editBook(i: number, k: keyof ReviewBook, v: string | number) {
    setEdits((prev) => ({ ...prev, [i]: { ...prev[i], [k]: v } }));
  }

  async function importSelected() {
    setImporting(true);
    const toImport = reviewBooks
      .map((b, i) => ({ ...b, ...edits[i] }))
      .filter((_, i) => selected.has(i));

    await Promise.allSettled(
      toImport.map((b) =>
        fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b),
        }).then(async (r) => {
          if (r.ok) {
            const { book } = await r.json();
            setBooks((prev) => [book as Book, ...prev]);
          }
        })
      )
    );

    // Store receipts
    if (deliveryData && orderData) {
      await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryData, orderData }),
      });
    }

    setImporting(false);
    setImportDone(true);
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    setManualSubmitting(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...manualForm,
        ticketStart: Number(manualForm.ticketStart),
        ticketEnd: Number(manualForm.ticketEnd),
        price: Number(manualForm.price),
      }),
    });
    if (res.ok) {
      const { book } = await res.json();
      setBooks((prev) => [book as Book, ...prev]);
      closeModal();
    } else {
      setManualError((await res.json()).error ?? "Failed to add book.");
    }
    setManualSubmitting(false);
  }

  const failCount = crossChecks.filter((c) => c.status === "fail").length;
  const warnCount = crossChecks.filter((c) => c.status === "warn").length;

  const STEPS = [
    { id: "delivery", label: "Delivery Receipt" },
    { id: "order", label: "Confirm Order" },
    { id: "validate", label: "Validate" },
    { id: "review", label: "Review" },
  ];
  const stepIdx = step === "delivery" || step === "delivery-result" ? 0
    : step === "order" || step === "order-result" ? 1
    : step === "cross-validate" ? 2 : 3;

  const isModalOpen = step !== "idle" && step !== "method";
  const isWide = step === "review";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{books.length} books · {user?.orgName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowClockwise className={cn("size-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setStep("method")}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity font-semibold shadow-sm">
            <Plus className="size-4" /> Add Books
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search game, ID, pack…"
          className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
      </div>

      {/* Books table */}
      <div className="border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted/40 border-b">
              <tr>
                {["Game", "Pack", "Tickets", "Price", "Status", "Added"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                    ))}</tr>
                  ))
                : filtered.map((b) => (
                    <tr key={b.bookId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{b.gameName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{b.gameId}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{b.pack}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">#{b.ticketStart}–#{b.ticketEnd}</td>
                      <td className="px-4 py-3 font-semibold">${b.price}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium capitalize", STATUS_STYLE[b.status])}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-14 space-y-2">
            <FileText className="size-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">{query ? "No books match your search." : "No books yet. Click Add Books to get started."}</p>
          </div>
        )}
      </div>

      {/* ── Method chooser ───────────────────────────────────────────────────── */}
      {step === "method" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Add Books</h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setStep("delivery"); setScanError(null); }}
                className="w-full flex items-start gap-4 border-2 rounded-2xl p-4 hover:border-primary hover:bg-primary/5 transition-all text-left group">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Camera className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Scan Receipts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload delivery receipt + confirm order — AI extracts all books automatically</p>
                </div>
              </button>

              {/* Manual entry shortcut */}
              <div className="pt-1">
                <p className="text-xs text-center text-muted-foreground mb-3">or add a single book manually</p>
                <form onSubmit={addManual} className="space-y-2.5">
                  {[
                    { key: "gameId",   label: "Game ID",      ph: "G-4821" },
                    { key: "gameName", label: "Game Name",    ph: "Gold Rush" },
                    { key: "pack",     label: "Pack #",       ph: "P-001" },
                    { key: "ticketStart", label: "Start #",  ph: "1", type: "number" },
                    { key: "ticketEnd",   label: "End #",    ph: "300", type: "number" },
                    { key: "price",       label: "Price ($)", ph: "5", type: "number" },
                  ].map(({ key, label, ph, type }) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-xs font-medium w-20 shrink-0 text-muted-foreground">{label}</label>
                      <input type={type ?? "text"} required placeholder={ph}
                        value={manualForm[key as keyof typeof manualForm]}
                        onChange={(e) => setManualForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  ))}
                  {manualError && <p className="text-xs text-destructive">{manualError}</p>}
                  <button type="submit" disabled={manualSubmitting}
                    className="w-full bg-muted hover:bg-muted/80 border rounded-xl py-2 text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {manualSubmitting ? <span className="size-4 rounded-full border-2 border-foreground border-t-transparent animate-spin" /> : "Add Single Book"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-step receipt modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className={cn(
            "bg-background border rounded-3xl w-full shadow-2xl flex flex-col overflow-hidden",
            isWide ? "max-w-4xl max-h-[92vh]" : "max-w-lg max-h-[90vh]"
          )}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                {stepIdx > 0 && !importDone && (
                  <button onClick={() => setStep(
                    stepIdx === 1 ? "delivery-result"
                    : stepIdx === 2 ? "order-result"
                    : "cross-validate"
                  )} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                <h2 className="font-bold text-base">Add Books via Receipt</h2>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            {/* Progress steps */}
            {!importDone && (
              <div className="flex items-center px-5 py-3 border-b bg-muted/20 gap-1 shrink-0 overflow-x-auto">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1 shrink-0">
                    <div className={cn(
                      "flex items-center justify-center size-6 rounded-full text-xs font-bold transition-colors",
                      i < stepIdx ? "bg-emerald-500 text-white"
                      : i === stepIdx ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    )}>
                      {i < stepIdx ? <CheckCircle className="size-4" /> : i + 1}
                    </div>
                    <span className={cn("text-xs font-medium whitespace-nowrap",
                      i === stepIdx ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                    {i < STEPS.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">

              {/* Step: Delivery Receipt Upload */}
              {step === "delivery" && (
                <div className="p-5 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
                    <p className="font-semibold">Step 1: Instant Ticket Delivery Receipt</p>
                    <p className="text-xs mt-1 text-blue-700">This is the physical receipt that comes with the lottery book shipment from the Ohio Lottery distribution system.</p>
                  </div>
                  <UploadZone scanning={scanning} onFile={handleDeliveryScan} error={scanError} onRetry={() => setScanError(null)} />
                </div>
              )}

              {/* Step: Delivery Result */}
              {step === "delivery-result" && deliveryData && (
                <div className="p-5 space-y-4">
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-2 text-sm">
                    <p className="font-semibold">Extracted Data</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["Retailer #", deliveryData.retailerNum],
                        ["Date", deliveryData.date],
                        ["Shipment #", deliveryData.shipmentId],
                        ["Order #", deliveryData.orderNumber],
                        ["Books found", (deliveryData.games as { packNumbers?: string[] }[] ?? []).reduce((s, g) => s + (g.packNumbers?.length ?? 0), 0)],
                      ].map(([k, v]) => (
                        <div key={String(k)}>
                          <p className="text-muted-foreground">{String(k)}</p>
                          <p className="font-medium">{String(v ?? "—")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {deliveryChecks.map((c, i) => <ValidationBadge key={i} check={c} />)}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setScanError(null); setStep("delivery"); }}
                      className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                      Re-scan
                    </button>
                    <button onClick={() => setStep("order")}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm">
                      Continue <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Confirm Order Upload */}
              {step === "order" && (
                <div className="p-5 space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-sm text-purple-800">
                    <p className="font-semibold">Step 2: Confirm Order Receipt</p>
                    <p className="text-xs mt-1 text-purple-700">This is the receipt printed by your Ohio Lottery terminal when you confirmed the book order.</p>
                  </div>
                  <UploadZone scanning={scanning} onFile={handleOrderScan} error={scanError} onRetry={() => setScanError(null)} />
                  <button onClick={() => { if (deliveryData) { const cross = crossValidate(deliveryData, {}); setCrossChecks(cross); setOrderData({}); setOrderChecks([]); setStep("order-result"); } }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                    Skip confirm order receipt →
                  </button>
                </div>
              )}

              {/* Step: Order Result */}
              {step === "order-result" && orderData && (
                <div className="p-5 space-y-4">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Confirm Order Validation</p>
                    {orderChecks.map((c, i) => <ValidationBadge key={i} check={c} />)}
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Cross-Receipt Validation</p>
                    {crossChecks.map((c, i) => <ValidationBadge key={i} check={c} />)}
                    {crossChecks.some((c) => c.status === "fail") && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                        <strong>Errors detected.</strong> Review carefully before proceeding. Issues have been logged.
                      </div>
                    )}
                    {crossChecks.every((c) => c.status !== "fail") && crossChecks.some((c) => c.status === "warn") && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                        <strong>Warnings.</strong> Please review the highlighted items before importing.
                      </div>
                    )}
                    {crossChecks.every((c) => c.status === "pass") && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                        <strong>All checks passed!</strong> Ready to review and import books.
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setScanError(null); setStep("order"); }}
                      className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                      Re-scan
                    </button>
                    <button onClick={proceedToReview}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm">
                      Review Books <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Review */}
              {step === "review" && (
                <div className="flex flex-col h-full">
                  {importDone ? (
                    <div className="flex flex-col items-center justify-center p-10 gap-4 text-center">
                      <CheckCircle weight="fill" className="size-16 text-emerald-500" />
                      <div>
                        <p className="font-bold text-lg">Books imported!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selected.size} book{selected.size !== 1 ? "s" : ""} added to inventory.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { closeModal(); setTimeout(() => setStep("delivery"), 100); }}
                          className="border rounded-xl px-4 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                          <Camera className="size-4" /> Scan another
                        </button>
                        <button onClick={closeModal}
                          className="bg-primary text-primary-foreground rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <button onClick={() => selected.size === reviewBooks.length ? setSelected(new Set()) : setSelected(new Set(reviewBooks.map((_, i) => i)))}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            {selected.size === reviewBooks.length
                              ? <CheckSquare className="size-4 text-primary" />
                              : <Square className="size-4" />}
                            {selected.size === reviewBooks.length ? "Deselect all" : "Select all"}
                          </button>
                          <span className="text-xs text-muted-foreground">{selected.size} of {reviewBooks.length} selected</span>
                        </div>
                        <div className="flex gap-2 items-center text-xs">
                          {failCount > 0 && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full">{failCount} error{failCount !== 1 ? "s" : ""}</span>}
                          {warnCount > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                      {/* Table */}
                      <div className="overflow-auto flex-1">
                        <table className="w-full text-xs min-w-[700px]">
                          <thead className="bg-muted/30 sticky top-0">
                            <tr>
                              <th className="w-8 px-3 py-2.5" />
                              {["Game ID", "Game Name", "Pack #", "Start #", "End #", "Price ($)"].map((h) => (
                                <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground">{h}</th>
                              ))}
                              <th className="w-8 px-2 py-2.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {reviewBooks.map((_, i) => (
                              <tr key={i} className={cn("transition-colors", selected.has(i) ? "bg-primary/3" : "opacity-40")}>
                                <td className="px-3 py-2">
                                  <button onClick={() => setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
                                    {selected.has(i) ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}
                                  </button>
                                </td>
                                {(["gameId", "gameName", "pack"] as const).map((k) => (
                                  <td key={k} className="px-2 py-1.5">
                                    <input value={String(bookVal(i, k))} onChange={(e) => editBook(i, k, e.target.value)}
                                      className="w-full border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 text-xs" />
                                  </td>
                                ))}
                                {(["ticketStart", "ticketEnd", "price"] as const).map((k) => (
                                  <td key={k} className="px-2 py-1.5">
                                    <input type="number" value={String(bookVal(i, k))} onChange={(e) => editBook(i, k, Number(e.target.value))}
                                      className="w-20 border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 text-xs" />
                                  </td>
                                ))}
                                <td className="px-2 py-1.5">
                                  <button onClick={() => {
                                    setReviewBooks((prev) => prev.filter((_, j) => j !== i));
                                    setSelected((prev) => { const n = new Set<number>(); prev.forEach((v) => { if (v < i) n.add(v); else if (v > i) n.add(v - 1); }); return n; });
                                  }} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                                    <Trash className="size-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Footer */}
                      <div className="px-5 py-4 border-t shrink-0 flex items-center justify-between gap-4 bg-background flex-wrap">
                        <p className="text-xs text-muted-foreground">Tap any cell to edit before importing.</p>
                        <button onClick={importSelected} disabled={importing || selected.size === 0}
                          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm">
                          {importing ? <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Plus className="size-4" />}
                          Import {selected.size > 0 ? `${selected.size} book${selected.size !== 1 ? "s" : ""}` : ""}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
