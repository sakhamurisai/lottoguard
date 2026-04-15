import { requireAuth, errResponse } from "@/lib/validate";
import { getOrg } from "@/lib/db";

export async function GET() {
  try {
    const payload = await requireAuth();
    const org = await getOrg(payload.orgId);

    return Response.json({
      user: {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        orgId: payload.orgId,
        orgName: (org as Record<string, unknown>)?.orgName ?? "",
      },
    });
  } catch (err) {
    return errResponse(err);
  }
}
