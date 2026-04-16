import { requireOwner, errResponse } from "@/lib/validate";
import { listShiftsByEmployee } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOwner();
    const { id: sub } = await params;
    const shifts = await listShiftsByEmployee(orgId, sub);
    return Response.json({ shifts });
  } catch (err) {
    return errResponse(err);
  }
}
