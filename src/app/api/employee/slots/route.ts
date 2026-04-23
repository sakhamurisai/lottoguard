import { requireEmployee, errResponse } from "@/lib/validate";
import { listSlots, listBooks, getOrg } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireEmployee();

    const [rawSlots, books, org] = await Promise.all([
      listSlots(orgId),
      listBooks(orgId),
      getOrg(orgId),
    ]);

    // Book lookup by bookId
    const bookMap: Record<string, { gameName: string; pack: string; price: number; status: string; ticketStart?: number; gameId?: string }> = {};
    for (const b of books) {
      const id = b.bookId as string;
      bookMap[id] = {
        gameName:    (b.gameName    as string) ?? "",
        pack:        (b.pack        as string) ?? "",
        price:       (b.price       as number) ?? 0,
        status:      (b.status      as string) ?? "",
        ticketStart: (b.ticketStart as number | undefined),
        gameId:      (b.gameId      as string | undefined),
      };
    }

    // Slot assignment map: slotNum → bookId
    const slotMap: Record<number, string | null> = {};
    for (const s of rawSlots) {
      slotMap[s.slotNum as number] = (s.bookId as string | null) ?? null;
    }

    const slotNames      = (org?.slotNames      as Record<string, string>) ?? {};
    const tierSlotCounts = (org?.tierSlotCounts  as Record<string, number>) ?? {};
    const slotBudget     = (org?.slots           as number) ?? 0;

    return Response.json({ slotMap, bookMap, slotNames, tierSlotCounts, slotBudget });
  } catch (err) {
    return errResponse(err);
  }
}
