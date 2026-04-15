import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { listSlots, upsertSlot, getOrg } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const [slots, org] = await Promise.all([listSlots(orgId), getOrg(orgId)]);

    // Build full grid up to org's slot count
    const total = (org as Record<string, unknown>)?.slots as number ?? 10;
    const map = Object.fromEntries(slots.map((s: Record<string, unknown>) => [s.slotNum, s]));
    const grid = Array.from({ length: total }, (_, i) => ({
      slotNum: i + 1,
      bookId: (map[i + 1] as Record<string, unknown>)?.bookId ?? null,
    }));

    return Response.json({ slots: grid, total });
  } catch (err) { return errResponse(err); }
}

const schema = z.object({
  slotNum: z.number().int().min(1),
  bookId:  z.string().nullable(),
});

export async function PATCH(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const { slotNum, bookId } = schema.parse(await req.json());
    await upsertSlot(orgId, slotNum, bookId);
    return Response.json({ message: "Slot updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.errors[0].message }, { status: 400 });
    return errResponse(err);
  }
}
