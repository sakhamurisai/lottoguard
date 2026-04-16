import { z } from "zod";
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
  orgName:   z.string().min(1).optional(),
  llcName:   z.string().min(1).optional(),
  address:   z.string().min(1).optional(),
  retailNum: z.string().min(1).optional(),
  phone:     z.string().min(7).optional(),
  slots:     z.coerce.number().int().min(1).max(100).optional(),
});

export async function PUT(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const fields = schema.parse(await req.json());
    await updateOrg(orgId, fields);
    return Response.json({ message: "Settings saved" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
