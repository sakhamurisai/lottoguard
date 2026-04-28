import { requireOwner, errResponse } from "@/lib/validate";
import { listBooks, listAllShifts, listSlots, listEmployees } from "@/lib/db";

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];

export async function GET(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "7d";

    const cutoffDays: Record<string, number | null> = { "7d": 7, "30d": 30, "90d": 90, "all": null };
    const days = cutoffDays[period] ?? 7;
    const cutoff = days !== null ? new Date(Date.now() - days * 86_400_000).toISOString() : null;

    const [books, allShifts, slots, employees] = await Promise.all([
      listBooks(orgId),
      listAllShifts(orgId),
      listSlots(orgId),
      listEmployees(orgId),
    ]);

    const shifts = cutoff
      ? (allShifts as Record<string, unknown>[]).filter((sh) => ((sh.clockIn as string) ?? "") >= cutoff)
      : (allShifts as Record<string, unknown>[]);

    type BookR  = Record<string, unknown>;
    type SlotR  = Record<string, unknown>;
    type EmpR   = Record<string, unknown>;

    // ── Book breakdown by price tier ──────────────────────────────────────────
    const booksByTier: Record<number, { active: number; settled: number; unactivated: number; total: number }> = {};
    for (const tier of PRICE_TIERS) booksByTier[tier] = { active: 0, settled: 0, unactivated: 0, total: 0 };

    for (const b of books as BookR[]) {
      const price  = (b.price as number) ?? 0;
      const status = (b.status as string) ?? "inactive";
      if (!booksByTier[price]) booksByTier[price] = { active: 0, settled: 0, unactivated: 0, total: 0 };
      booksByTier[price].total += 1;
      if (status === "active")       booksByTier[price].active      += 1;
      else if (status === "settled") booksByTier[price].settled     += 1;
      else                           booksByTier[price].unactivated += 1;
    }

    // ── Shift aggregation (period-filtered) ───────────────────────────────────
    let totalTicketsSold = 0;
    const soldByTier: Record<number, number> = {};
    const soldByDay:  Record<string, number> = {};

    const slotBookMap: Record<number, string | null> = {};
    for (const s of slots as SlotR[]) {
      slotBookMap[s.slotNum as number] = (s.bookId as string) ?? null;
    }
    const bookPriceMap: Record<string, number> = {};
    for (const b of books as BookR[]) {
      bookPriceMap[b.bookId as string] = (b.price as number) ?? 0;
    }

    for (const sh of shifts) {
      const start = (sh.ticketStart as number) ?? 0;
      const end   = sh.ticketEnd  as number;
      if (end == null) continue;
      const sold = end - start;
      if (sold <= 0) continue;
      totalTicketsSold += sold;

      const slotN  = sh.slotNum as number;
      const bookId = slotBookMap[slotN];
      const price  = bookId ? (bookPriceMap[bookId] ?? 0) : 0;
      if (price > 0) soldByTier[price] = (soldByTier[price] ?? 0) + sold;

      const day = (sh.clockIn as string)?.slice(0, 10) ?? "";
      if (day) soldByDay[day] = (soldByDay[day] ?? 0) + sold;
    }

    // ── Trend (days based on period) ─────────────────────────────────────────
    const trendDays = days ?? 7;
    const trend: { day: string; sold: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend.push({ day: key, sold: soldByDay[key] ?? 0 });
    }

    // ── Estimated revenue ─────────────────────────────────────────────────────
    const estimatedRevenue = Object.entries(soldByTier)
      .reduce((sum, [price, sold]) => sum + Number(price) * sold, 0);

    // ── Warnings ──────────────────────────────────────────────────────────────
    const warnings: { type: string; message: string; severity: "error" | "warning" }[] = [];

    const pendingEmps = (employees as EmpR[]).filter((e) => e.status === "pending").length;
    if (pendingEmps > 0)
      warnings.push({ type: "pending_employees", message: `${pendingEmps} employee${pendingEmps > 1 ? "s" : ""} awaiting approval`, severity: "warning" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const staleBooks    = (books as BookR[]).filter(
      (b) => b.status === "active" && b.activatedAt && (b.activatedAt as string) < thirtyDaysAgo
    ).length;
    if (staleBooks > 0)
      warnings.push({ type: "stale_books", message: `${staleBooks} book${staleBooks > 1 ? "s" : ""} active for over 30 days — consider settling`, severity: "warning" });

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalBooks      = (books as BookR[]).length;
    const activeBooks     = (books as BookR[]).filter((b) => b.status === "active").length;
    const settledBooks    = (books as BookR[]).filter((b) => b.status === "settled").length;
    const totalEmployees  = (employees as EmpR[]).length;
    const activeEmployees = (employees as EmpR[]).filter((e) => e.status === "active").length;
    const totalSlots      = (slots as SlotR[]).length;
    const filledSlots     = (slots as SlotR[]).filter((s) => s.bookId).length;

    return Response.json({
      summary: { totalBooks, activeBooks, settledBooks, totalEmployees, activeEmployees, totalTicketsSold, filledSlots, totalSlots },
      booksByTier,
      soldByTier,
      estimatedRevenue,
      trend,
      warnings,
      period,
    });
  } catch (err) { return errResponse(err); }
}
