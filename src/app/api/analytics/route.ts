import { requireOwner, errResponse } from "@/lib/validate";
import { listBooks, listAllShifts, listSlots, listEmployees, getOrg } from "@/lib/db";

const PRICE_TIERS = [1, 2, 5, 10, 20, 30, 50];

export async function GET() {
  try {
    const { orgId } = await requireOwner();

    const [books, shifts, slots, employees, org] = await Promise.all([
      listBooks(orgId),
      listAllShifts(orgId),
      listSlots(orgId),
      listEmployees(orgId),
      getOrg(orgId),
    ]);

    type BookR  = Record<string, unknown>;
    type ShiftR = Record<string, unknown>;
    type SlotR  = Record<string, unknown>;
    type EmpR   = Record<string, unknown>;

    // ── Book breakdown by price tier ──────────────────────────────────────────
    const booksByTier: Record<number, { active: number; settled: number; unactivated: number; total: number }> = {};
    for (const tier of PRICE_TIERS) booksByTier[tier] = { active: 0, settled: 0, unactivated: 0, total: 0 };

    for (const b of books as BookR[]) {
      const price  = (b.price as number) ?? 0;
      const status = (b.status as string) ?? "unactivated";
      if (!booksByTier[price]) booksByTier[price] = { active: 0, settled: 0, unactivated: 0, total: 0 };
      booksByTier[price].total += 1;
      if (status === "active")      booksByTier[price].active      += 1;
      else if (status === "settled") booksByTier[price].settled    += 1;
      else                           booksByTier[price].unactivated += 1;
    }

    // ── Shift aggregation ─────────────────────────────────────────────────────
    let totalTicketsSold = 0;
    const soldByTier: Record<number, number> = {};
    const soldByDay:  Record<string, number> = {};  // "YYYY-MM-DD" → count

    // Build slot→book→price map for shift attribution
    const slotBookMap: Record<number, string | null> = {};
    for (const s of slots as SlotR[]) {
      slotBookMap[s.slotNum as number] = (s.bookId as string) ?? null;
    }
    const bookPriceMap: Record<string, number> = {};
    for (const b of books as BookR[]) {
      bookPriceMap[b.bookId as string] = (b.price as number) ?? 0;
    }

    for (const sh of shifts as ShiftR[]) {
      const start = sh.ticketStart as number ?? 0;
      const end   = sh.ticketEnd  as number;
      if (end == null) continue; // active shift, not yet clocked out
      const sold = end - start;
      if (sold <= 0) continue;
      totalTicketsSold += sold;

      // Attribute to tier via slot number
      const slotN  = sh.slotNum as number;
      const bookId = slotBookMap[slotN];
      const price  = bookId ? (bookPriceMap[bookId] ?? 0) : 0;
      if (price > 0) soldByTier[price] = (soldByTier[price] ?? 0) + sold;

      // By day
      const day = (sh.clockIn as string)?.slice(0, 10) ?? "";
      if (day) soldByDay[day] = (soldByDay[day] ?? 0) + sold;
    }

    // Last 7 days trend
    const trend: { day: string; sold: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend.push({ day: key, sold: soldByDay[key] ?? 0 });
    }

    // ── Warnings ──────────────────────────────────────────────────────────────
    const warnings: { type: string; message: string; severity: "error" | "warning" }[] = [];

    const totalSlots = (org as Record<string, unknown>)?.slots as number ?? 0;
    const filledSlots = (slots as SlotR[]).filter((s) => s.bookId).length;
    const emptySlots  = Math.max(0, totalSlots - filledSlots);
    if (emptySlots > 0)
      warnings.push({ type: "empty_slots", message: `${emptySlots} slot${emptySlots > 1 ? "s" : ""} with no book assigned`, severity: "warning" });

    const pendingEmps = (employees as EmpR[]).filter((e) => e.status === "pending").length;
    if (pendingEmps > 0)
      warnings.push({ type: "pending_employees", message: `${pendingEmps} employee${pendingEmps > 1 ? "s" : ""} awaiting approval`, severity: "warning" });

    // Books active but never got a slot
    const slottedBookIds = new Set((slots as SlotR[]).map((s) => s.bookId).filter(Boolean));
    const activeNoSlot = (books as BookR[]).filter((b) => b.status === "active" && !slottedBookIds.has(b.bookId)).length;
    if (activeNoSlot > 0)
      warnings.push({ type: "active_no_slot", message: `${activeNoSlot} active book${activeNoSlot > 1 ? "s" : ""} not assigned to any slot`, severity: "error" });

    // Books active for more than 30 days without settling
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const staleBooks = (books as BookR[]).filter(
      (b) => b.status === "active" && b.activatedAt && (b.activatedAt as string) < thirtyDaysAgo
    ).length;
    if (staleBooks > 0)
      warnings.push({ type: "stale_books", message: `${staleBooks} book${staleBooks > 1 ? "s" : ""} active for over 30 days — consider settling`, severity: "warning" });

    // ── Summary counts ────────────────────────────────────────────────────────
    const totalBooks        = (books as BookR[]).length;
    const activeBooks       = (books as BookR[]).filter((b) => b.status === "active").length;
    const settledBooks      = (books as BookR[]).filter((b) => b.status === "settled").length;
    const totalEmployees    = (employees as EmpR[]).length;
    const activeEmployees   = (employees as EmpR[]).filter((e) => e.status === "active").length;

    return Response.json({
      summary: { totalBooks, activeBooks, settledBooks, totalEmployees, activeEmployees, totalTicketsSold, filledSlots, totalSlots },
      booksByTier,
      soldByTier,
      trend,
      warnings,
    });
  } catch (err) { return errResponse(err); }
}
