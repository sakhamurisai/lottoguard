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

    // Build book lookup by bookId
    const bookMap: Record<string, { gameName: string; price: number; ticketStart: number; ticketEnd: number }> = {};
    for (const b of books) {
      const id = b.bookId as string;
      bookMap[id] = {
        gameName:    (b.gameName    as string) ?? "",
        price:       (b.price       as number) ?? 0,
        ticketStart: (b.ticketStart as number) ?? 0,
        ticketEnd:   (b.ticketEnd   as number) ?? 0,
      };
    }

    // Get slot name map from org
    const slotNames = (org?.slotNames as Record<string, string>) ?? {};

    // Return only slots that have an active book assigned
    const slots = rawSlots
      .filter((s) => s.bookId)
      .map((s) => {
        const num  = s.slotNum as number;
        const book = bookMap[s.bookId as string];
        return {
          slotNum:  num,
          name:     slotNames[String(num)] ?? null,
          bookId:   s.bookId as string,
          gameName: book?.gameName ?? "",
          price:    book?.price ?? 0,
        };
      })
      .sort((a, b) => a.slotNum - b.slotNum);

    return Response.json({ slots });
  } catch (err) {
    return errResponse(err);
  }
}
