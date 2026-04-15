import { requireOwner, errResponse } from "@/lib/validate";
import { listEmployees } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const employees = await listEmployees(orgId);
    return Response.json({ employees });
  } catch (err) { return errResponse(err); }
}
