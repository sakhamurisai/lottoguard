import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { updateEmployee, deleteEmployee } from "@/lib/db";

const schema = z.object({
  status: z.enum(["active", "disabled"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id: sub } = await params;
    const { status } = schema.parse(await req.json());
    await updateEmployee(orgId, sub, { status });
    return Response.json({ message: "Employee updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id: sub } = await params;
    await deleteEmployee(orgId, sub);
    return Response.json({ message: "Employee deleted" });
  } catch (err) {
    return errResponse(err);
  }
}
