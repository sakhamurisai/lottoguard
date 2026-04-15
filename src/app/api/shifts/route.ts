import { z } from "zod";
import { requireEmployee, errResponse } from "@/lib/validate";
import { listShifts, getActiveShift, clockIn, clockOut } from "@/lib/db";

export async function GET() {
  try {
    const { orgId, sub } = await requireEmployee();
    const [shifts, active] = await Promise.all([
      listShifts(orgId, sub),
      getActiveShift(orgId, sub),
    ]);
    return Response.json({ shifts, active });
  } catch (err) { return errResponse(err); }
}

const clockInSchema  = z.object({ action: z.literal("clock_in"),  ticketStart: z.coerce.number().int().min(0), slotNum: z.coerce.number().int().min(1) });
const clockOutSchema = z.object({ action: z.literal("clock_out"), ticketEnd: z.coerce.number().int().min(0),   shiftId: z.string() });

export async function POST(req: Request) {
  try {
    const payload = await requireEmployee();
    const body = z.union([clockInSchema, clockOutSchema]).parse(await req.json());

    if (body.action === "clock_in") {
      const existing = await getActiveShift(payload.orgId, payload.sub);
      if (existing) return Response.json({ error: "You already have an active shift." }, { status: 409 });
      const shift = await clockIn(payload.orgId, payload.sub, payload.name, body.ticketStart, body.slotNum);
      return Response.json({ shift }, { status: 201 });
    }

    await clockOut(payload.orgId, payload.sub, body.shiftId, body.ticketEnd);
    return Response.json({ message: "Clocked out successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.errors[0].message }, { status: 400 });
    return errResponse(err);
  }
}
