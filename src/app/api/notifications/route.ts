import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { listNotifications, markNotificationRead, markAllNotificationsRead, createNotification } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const notifications = await listNotifications(orgId);
    const unreadCount = notifications.filter((n) => !n.read).length;
    return Response.json({ notifications, unreadCount });
  } catch (err) { return errResponse(err); }
}

const patchSchema = z.object({
  sk:    z.string().optional(),
  all:   z.boolean().optional(),
});

const postSchema = z.object({
  type:     z.string().min(1),
  severity: z.enum(["emergency", "important", "warning", "info"]),
  message:  z.string().min(1),
  detail:   z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const body = postSchema.parse(await req.json());
    const notif = await createNotification(orgId, body);
    return Response.json({ notif }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues[0]?.message }, { status: 400 });
    return errResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const body = patchSchema.parse(await req.json());
    if (body.all) {
      await markAllNotificationsRead(orgId);
    } else if (body.sk) {
      await markNotificationRead(orgId, body.sk);
    } else {
      return Response.json({ error: "Provide sk or all:true" }, { status: 400 });
    }
    return Response.json({ message: "Updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues[0]?.message }, { status: 400 });
    return errResponse(err);
  }
}
