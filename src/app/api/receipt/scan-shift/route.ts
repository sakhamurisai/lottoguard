import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { veryfiExtract, VeryfiLineItem } from "@/lib/veryfi";
import { requireEmployee, errResponse } from "@/lib/validate";
import { getOrg } from "@/lib/db";

const schema = z.object({
  key:  z.string().min(1),
  type: z.enum(["sales", "cashes"]),
});

// ── GPT-4o-mini parsing prompts ───────────────────────────────────────────────

const SALES_SYSTEM = `You are a data parser for Ohio Lottery terminal "SALES - TODAY" receipts. You receive:
1. ocr_text — verbatim OCR transcript. Trust every character.
2. line_items — Veryfi structured items (hint only).

Parse ocr_text into the JSON schema. Then SELF-VERIFY:
  a) Receipt MUST contain "SALES - TODAY" or "SALES TODAY" — if absent, set unclear:true with reason.
  b) All dollar amounts must be non-negative numbers with two decimal places.
  c) Sum lineItems amounts — should roughly match grossSales (may differ slightly from credits).
  d) If any required field is missing or zero when it shouldn't be, re-check ocr_text.

FIELD DEFINITIONS:
- terminalNumber: terminal/retailer ID printed on receipt (digits only)
- grossSales: GROSS SALE / GROSS SALES — the primary daily sales total
- onlineNetSales: ONLINE NET TOTAL / ONLINE NET SALES / ONLINE NET — net online lottery figure
- cashlessInstant: CASHLESS INSTANT SALES / INSTANT NET TOTAL / CASHLESS INSTANT — instant/scratch-off figure
- lineItems: every individual game line with its name and dollar amount

Return ONLY raw JSON (no markdown, no code fences):
{
  "unclear": false,
  "reason": null,
  "receiptType": "SALES - TODAY",
  "terminalNumber": "1234",
  "receiptDate": "YYYY-MM-DD",
  "receiptTime": "HH:MM",
  "grossSales": 435.00,
  "onlineNetSales": 413.00,
  "cashlessInstant": 235.00,
  "lineItems": [{ "name": "Pick 3", "amount": 112.00 }],
  "_discrepancies": []
}`;

const CASHES_SYSTEM = `You are a data parser for Ohio Lottery terminal "CASHES - TODAY" receipts. You receive:
1. ocr_text — verbatim OCR transcript. Trust every character.
2. line_items — Veryfi structured items (hint only).

Parse ocr_text into the JSON schema. Then SELF-VERIFY:
  a) Receipt MUST contain "CASHES - TODAY" or "CASHES TODAY" — if absent, set unclear:true.
  b) Sum lineItems amounts → must equal totalCashes. If sum ≠ totalCashes by more than $0.01, re-check ocr_text for a missed line or misread digit.
  c) totalCashes must be non-negative.

FIELD DEFINITIONS:
- terminalNumber: terminal/retailer ID printed on receipt
- totalCashes: TOTAL CASHES / TOTAL CASH / CASH TOTAL — the final total
- lineItems: every cashed game/ticket line with name and dollar amount

Return ONLY raw JSON (no markdown, no code fences):
{
  "unclear": false,
  "reason": null,
  "receiptType": "CASHES - TODAY",
  "terminalNumber": "1234",
  "receiptDate": "YYYY-MM-DD",
  "receiptTime": "HH:MM",
  "totalCashes": 320.00,
  "lineItems": [{ "name": "Pick 3", "amount": 50.00 }],
  "_discrepancies": []
}`;

const PARSE_USER_TMPL = (ocrText: string, lineItems: VeryfiLineItem[]) =>
  JSON.stringify({ ocr_text: ocrText, line_items: lineItems }, null, 0);

// ── Server-side validation ────────────────────────────────────────────────────

interface LineItem { amount?: number }

interface ShiftResult {
  unclear?:         boolean;
  reason?:          string;
  terminalNumber?:  string;
  receiptDate?:     string;
  receiptTime?:     string;
  grossSales?:      number;
  onlineNetSales?:  number;
  cashlessInstant?: number;
  totalCashes?:     number;
  lineItems?:       LineItem[];
  _discrepancies?:  string[];
  [key: string]:    unknown;
}

function serverValidate(
  result: ShiftResult,
  type: "sales" | "cashes",
  shiftDate: string,
  clockOutTime: string,
  orgTerminal: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const terminal = (result.terminalNumber ?? "").replace(/\D/g, "");
  const orgT     = orgTerminal.replace(/\D/g, "");
  if (orgT && terminal && terminal !== orgT) {
    errors.push(`Terminal mismatch: receipt shows ${terminal}, store terminal is ${orgT}.`);
  }

  if (result.receiptDate && result.receiptDate !== shiftDate) {
    errors.push(`Receipt date (${result.receiptDate}) does not match today's date (${shiftDate}).`);
  }

  if (result.receiptTime && clockOutTime) {
    const [rH, rM] = result.receiptTime.split(":").map(Number);
    const [cH, cM] = clockOutTime.split(":").map(Number);
    if (Math.abs(rH * 60 + rM - (cH * 60 + cM)) > 10) {
      errors.push(
        `Receipt time (${result.receiptTime}) is more than 10 minutes from clock-out (${clockOutTime}). Print a fresh receipt and re-upload.`
      );
    }
  }

  if (type === "sales") {
    if (result.onlineNetSales == null)
      errors.push("Could not extract Online Net Sales.");
    if (result.cashlessInstant == null)
      errors.push("Could not extract Cashless Instant Sales.");

    if (result.lineItems && result.grossSales != null && result.grossSales > 0) {
      const lineSum = result.lineItems.reduce((s, li) => s + (li.amount ?? 0), 0);
      if (lineSum > 0 && Math.abs(lineSum - result.grossSales) > result.grossSales * 0.20) {
        errors.push(
          `Line items sum ($${lineSum.toFixed(2)}) differs significantly from Gross Sales ($${result.grossSales.toFixed(2)}) — possible extraction error.`
        );
      }
    }
  } else {
    if (result.totalCashes == null)
      errors.push("Could not extract Total Cashes.");

    if (result.lineItems && result.totalCashes != null) {
      const lineSum = result.lineItems.reduce((s, li) => s + (li.amount ?? 0), 0);
      if (lineSum > 0 && Math.abs(lineSum - result.totalCashes) > 0.01) {
        errors.push(
          `Line items sum ($${lineSum.toFixed(2)}) ≠ Total Cashes ($${result.totalCashes.toFixed(2)}) — a line may be missing or a digit misread.`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const payload       = await requireEmployee();
    const { key, type } = schema.parse(await req.json());
    const org           = await getOrg(payload.orgId);
    const orgTerminal   = ((org as Record<string, unknown>)?.retailNum as string) ?? "";

    const readUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
      { expiresIn: 300 }
    );

    // ── Step 1: Veryfi OCR ──────────────────────────────────────────────────
    const vDoc      = await veryfiExtract(readUrl);
    const ocrText   = vDoc.ocr_text  ?? "";
    const lineItems = vDoc.line_items ?? [];

    if (!ocrText.trim()) {
      return Response.json(
        { unclear: true, reason: "Could not read the receipt image. Please upload a clearer photo." },
        { status: 422 }
      );
    }

    // ── Step 2: GPT-4o-mini structured parsing ──────────────────────────────
    const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system  = type === "sales" ? SALES_SYSTEM : CASHES_SYSTEM;

    const resp = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: PARSE_USER_TMPL(ocrText, lineItems) },
      ],
      max_tokens: 2000,
    });

    const raw    = resp.choices[0].message.content ?? "{}";
    const json   = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(json) as ShiftResult;

    if (result.unclear) {
      return Response.json(
        { unclear: true, reason: result.reason ?? "Image could not be read." },
        { status: 422 }
      );
    }

    // ── Step 3: Server-side validation ─────────────────────────────────────
    const now       = new Date();
    const shiftDate = now.toISOString().slice(0, 10);
    const clockTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const { valid, errors } = serverValidate(result, type, shiftDate, clockTime, orgTerminal);

    return Response.json({ unclear: false, valid, errors, data: result });
  } catch (err) {
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError)
      return Response.json({ unclear: true, reason: "Could not parse the image. Please try a clearer photo." }, { status: 422 });
    return errResponse(err);
  }
}
