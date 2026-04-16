import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { listSlots, upsertSlot, getOrg, updateOrg } from "@/lib/db";

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

const postSchema = z.object({
  action: z.enum(["add", "remove"]),
});

// POST — add or remove a slot column across all price tiers
export async function POST(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const { action } = postSchema.parse(await req.json());
    const org = await getOrg(orgId);
    const o = org as Record<string, unknown>;
    const current: number = (o?.slotsPerTier as number) ?? 6;
    const next = action === "add" ? current + 1 : Math.max(1, current - 1);
    // Ensure total org slots covers all tier blocks (8 tiers × 20 max per tier = 160)
    const totalSlots = Math.max((o?.slots as number ?? 0), 8 * 20);
    await updateOrg(orgId, { slotsPerTier: next, slots: totalSlots });
    return Response.json({ slotsPerTier: next });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const { slotNum, bookId } = schema.parse(await req.json());
    await upsertSlot(orgId, slotNum, bookId);
    return Response.json({ message: "Slot updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
