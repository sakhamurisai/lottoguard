import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import {
  createDeliveryReceipt, createOrderReceipt,
  listDeliveryReceipts, listOrderReceipts, getOrg,
} from "@/lib/db";

const storeSchema = z.object({
  deliveryData: z.record(z.string(), z.unknown()),
  orderData:    z.record(z.string(), z.unknown()),
});

function normalize(s: string | null | undefined) {
  return (s ?? "").toString().replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function datesMatch(d1: string | null, d2: string | null): boolean {
  if (!d1 || !d2) return false;
  return d1.slice(0, 10) === d2.slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const body = storeSchema.parse(await req.json());
    const { deliveryData: dd, orderData: od } = body;

    const org = await getOrg(orgId) as Record<string, unknown> | null;
    const orgRetailerNum = normalize(org?.retailNum as string);

    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Delivery receipt validations ──────────────────────────────────────────
    const headerOk = (dd.headerText as string ?? "").toLowerCase().includes("instant ticket delivery");
    if (!headerOk) errors.push('Delivery receipt header does not contain "Instant Ticket Delivery Receipt"');

    const deliveryRetailer = normalize(dd.retailerNum as string);
    if (!deliveryRetailer) {
      errors.push("Delivery receipt: retailer number not found");
    } else if (deliveryRetailer !== orgRetailerNum) {
      errors.push(`Delivery receipt retailer # (${dd.retailerNum}) does not match your registered retailer # (${org?.retailNum})`);
    }

    // ── Confirm order validations ─────────────────────────────────────────────
    const orderHeaderOk = (od.headerText as string ?? "").toLowerCase().includes("confirm order") ||
      (od.headerText as string ?? "").toLowerCase().includes("confirmed");
    if (!orderHeaderOk) errors.push('Confirm order receipt header does not contain "Confirm Order"');

    const orderRetailer = normalize(od.retailerNum as string);
    if (!orderRetailer) {
      errors.push("Confirm order receipt: retailer number not found");
    } else if (orderRetailer !== orgRetailerNum) {
      errors.push(`Confirm order retailer # (${od.retailerNum}) does not match your registered retailer # (${org?.retailNum})`);
    }

    if (!od.orderNumber) errors.push("Confirm order receipt: order number not found");

    // ── Cross-validations ─────────────────────────────────────────────────────
    if (deliveryRetailer && orderRetailer && deliveryRetailer !== orderRetailer) {
      errors.push(`Retailer numbers differ between receipts: delivery has ${dd.retailerNum}, order has ${od.retailerNum}`);
    }

    if (!datesMatch(dd.date as string, od.date as string)) {
      warnings.push(`Date mismatch: delivery receipt dated ${dd.date ?? "unknown"}, confirm order dated ${od.date ?? "unknown"} — please verify`);
    }

    const ddOrderNum = normalize(dd.orderNumber as string);
    const odOrderNum = normalize(od.orderNumber as string);
    if (ddOrderNum && odOrderNum && ddOrderNum !== odOrderNum) {
      errors.push(`Order number mismatch: delivery shows ${dd.orderNumber}, confirm order shows ${od.orderNumber}`);
    }

    const deliveryBooks = (dd.games as { packNumbers?: string[] }[] ?? [])
      .reduce((sum, g) => sum + (g.packNumbers?.length ?? 0), 0);
    const orderBooks = (od.books as unknown[] ?? []).length;
    if (deliveryBooks > 0 && orderBooks > 0 && deliveryBooks !== orderBooks) {
      warnings.push(`Book count differs: delivery receipt has ${deliveryBooks} books, confirm order has ${orderBooks} books`);
    }

    // ── Store receipts ─────────────────────────────────────────────────────────
    const [deliveryId, orderId] = await Promise.all([
      createDeliveryReceipt(orgId, {
        ...dd,
        validationErrors: errors,
        validationWarnings: warnings,
      }),
      createOrderReceipt(orgId, {
        ...od,
        validationErrors: errors,
        validationWarnings: warnings,
      }),
    ]);

    return Response.json({
      valid: errors.length === 0,
      errors,
      warnings,
      receipts: { deliveryId, orderId },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const [deliveries, orders] = await Promise.all([
      listDeliveryReceipts(orgId),
      listOrderReceipts(orgId),
    ]);
    return Response.json({ deliveries, orders });
  } catch (err) {
    return errResponse(err);
  }
}
