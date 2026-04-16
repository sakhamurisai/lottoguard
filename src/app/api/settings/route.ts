import { z } from "zod";
import { randomUUID } from "crypto";
import { requireOwner, errResponse } from "@/lib/validate";
import { getOrg, updateOrg } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const org = await getOrg(orgId);
    if (!org) return Response.json({ error: "Organization not found" }, { status: 404 });
    return Response.json({ org });
  } catch (err) { return errResponse(err); }
}

const schema = z.object({
  orgName:         z.string().min(1).optional(),
  llcName:         z.string().min(1).optional(),
  address:         z.string().min(1).optional(),
  retailNum:       z.string().min(1).optional(),
  phone:           z.string().min(7).optional(),
  slots:           z.coerce.number().int().min(1).max(500).optional(),
  slotsPerTier:    z.coerce.number().int().min(1).max(20).optional(),
  tierSlotCounts:  z.record(z.string(), z.number().int().min(1).max(20)).optional(),
  slotNames:       z.record(z.string(), z.string().max(40)).optional(),
  regenerateInvite: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const { regenerateInvite, ...rest } = schema.parse(await req.json());
    const updates: Record<string, unknown> = { ...rest };
    if (regenerateInvite) {
      const org = await getOrg(orgId);
      const retailNum = (org as Record<string, unknown>)?.retailNum as string ?? "";
      const suffix = randomUUID().slice(0, 4).toUpperCase();
      updates.inviteCode = `${retailNum.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6)}-${suffix}`;
    }
    await updateOrg(orgId, updates);
    const org = await getOrg(orgId);
    return Response.json({ message: "Settings saved", org });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
