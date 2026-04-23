import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { veryfiExtract, VeryfiLineItem } from "@/lib/veryfi";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PARSE_SYSTEM = `You are a data parser for Ohio Lottery "INSTANT TICKET DELIVERY RECEIPT" documents.
You receive:
  1. ocr_text — verbatim OCR transcript. Trust every character.
  2. line_items — Veryfi line items (use as a hint only, not ground truth).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT DOCUMENT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP-LEFT HEADER:
  "Ohio Lottery"
  "INSTANT TICKET DELIVERY RECEIPT"
  "Shipment #: [value]  Retailer #: [value]"  ← BOTH on the SAME LINE
  "Consigned to:"
  [Store name]
  [Street address]
  [City, State ZIP]

TOP-RIGHT:
  "Station: [value]"
  "WH Auditor: [name]"
  "Date: M/D/YYYY H:MM:SS AM/PM"
  "Order #: [value]"

DELIVERY TABLE — exact column headers:
  ID | Description | Ticket Value | Quantity | Pack Value | Total | Pack List

  • ID            → gameId: the numeric game identifier exactly as printed (e.g. 962, 1023, 847).
                    No leading zeros in this column.
  • Description   → format is "$PRICE-GAME NAME" (e.g. "$10-CASINO NIGHTS", "$5-LET IT SNOW").
                    gameDescription = full string as printed.
                    gameName        = the part AFTER the first "-" with the "$PRICE" prefix stripped
                                     (e.g. "CASINO NIGHTS", "LET IT SNOW").
  • Ticket Value  → ticketValue as a number (face value per ticket, e.g. 10.00 → 10).
  • Quantity      → packQuantity (number of individual books in this row).
  • Pack Value    → packValue (dollar value of one book).
  • Total         → packTotal (Pack Value × Quantity).
  • Pack List     → space-separated individual pack/book numbers.
                    Extract each as a SEPARATE string in the packNumbers array.
                    Preserve EXACTLY as printed — leading zeros matter (0110830 ≠ 110830).
                    Pack numbers may be 6 digits (e.g. 180717) or 7 digits (e.g. 0110830).

FOOTER (page 1 or last page):
  "Total packs issued: N"

PAGE 2 (summary, may be a separate page):
  "Total retail value: $X,XXX.XX"
  "Box #: N of N"
  "Manifest #: XXXXXXX"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MULTI-PAGE CONTINUATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If this is a continuation page (no "Ohio Lottery" header, just more table rows):
  set isContinuation: true, set all header/retailer fields to null, extract games normally.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY SELF-CHECK BEFORE RETURNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH game:
  a) Count packNumbers array length → MUST equal packQuantity. Re-read Pack List column if not.
  b) Check packTotal ≈ packValue × packQuantity (±$0.50). Re-read if not.
After all games:
  c) Sum all packQuantity → MUST equal totalPacksIssued.
List any failures in _discrepancies.

Return ONLY raw JSON (no markdown, no code fences):
{
  "isContinuation": false,
  "headerText": "INSTANT TICKET DELIVERY RECEIPT or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "shipmentId": "Shipment # value exactly as printed or null",
  "orderNumber": "Order # value exactly as printed or null",
  "retailerNum": "Retailer # value EXACTLY as printed (no leading zeros in this document)",
  "retailerName": "store name as printed or null",
  "retailerAddress": "full address on one line or null",
  "station": "Station value or null",
  "auditor": "WH Auditor name or null",
  "ticketType": "Instant Ticket",
  "totalRetailValue": 14950.00,
  "manifestId": "Manifest # value or null",
  "games": [
    {
      "gameId": "962",
      "gameDescription": "$10-CASINO NIGHTS",
      "gameName": "CASINO NIGHTS",
      "ticketValue": 10,
      "packQuantity": 1,
      "packValue": 500.00,
      "packTotal": 500.00,
      "packNumbers": ["0110830"]
    }
  ],
  "totalPacksIssued": 37,
  "_discrepancies": []
}`;

const PARSE_USER_TMPL = (ocrText: string, lineItems: VeryfiLineItem[]) =>
  JSON.stringify({ ocr_text: ocrText, line_items: lineItems }, null, 0);

// ── Server-side cross-validation ──────────────────────────────────────────────

interface GameEntry {
  gameId?:          string;
  gameDescription?: string;
  gameName?:        string;
  ticketValue?:     number;
  packQuantity?:    number;
  packValue?:       number;
  packTotal?:       number;
  packNumbers?:     string[];
}

interface DeliveryData {
  isContinuation?:   boolean;
  headerText?:       string | null;
  retailerNum?:      string | null;
  retailerAddress?:  string | null;
  totalRetailValue?: number;
  games?:            GameEntry[];
  totalPacksIssued?: number;
  _discrepancies?:   string[];
  pageCount?:        number;
  continuationCount?: number;
  [key: string]:     unknown;
}

function serverValidate(data: DeliveryData): string[] {
  const issues: string[] = [];
  const games = data.games ?? [];

  for (const g of games) {
    const label     = g.gameId ? `Game ${g.gameId}` : `"${g.gameDescription}"`;
    const extracted = g.packNumbers?.length ?? 0;

    if (g.packQuantity != null && extracted !== g.packQuantity) {
      issues.push(
        `${label}: Quantity column says ${g.packQuantity} but ${extracted} pack number${extracted !== 1 ? "s" : ""} were extracted from Pack List`
      );
    }

    if ((g.packNumbers?.length ?? 0) > 1) {
      const lengths = new Set((g.packNumbers ?? []).map(p => String(p).length));
      if (lengths.size > 1) {
        issues.push(
          `${label}: pack numbers have inconsistent digit lengths (${[...lengths].join(", ")}) — possible leading-zero extraction error`
        );
      }
    }

    if (g.packValue != null && g.packQuantity != null && g.packTotal != null) {
      const expected = Math.round(g.packValue * g.packQuantity * 100) / 100;
      const actual   = Math.round(g.packTotal  * 100) / 100;
      if (Math.abs(expected - actual) > 0.50) {
        issues.push(
          `${label}: packValue($${g.packValue}) × qty(${g.packQuantity}) = $${expected.toFixed(2)} but Total column shows $${actual.toFixed(2)}`
        );
      }
    }
  }

  const sumQty = games.reduce((s, g) => s + (g.packQuantity ?? 0), 0);
  if (data.totalPacksIssued != null && sumQty !== data.totalPacksIssued) {
    issues.push(
      `Sum of Quantity values (${sumQty}) ≠ "Total packs issued" (${data.totalPacksIssued}) — a game row may be missing or a digit is wrong`
    );
  }

  return issues;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    await requireOwner();
    const { key } = schema.parse(await req.json());

    const readUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
      { expiresIn: 300 }
    );

    const vDoc      = await veryfiExtract(readUrl);
    const ocrText   = vDoc.ocr_text  ?? "";
    const lineItems = vDoc.line_items ?? [];

    if (!ocrText.trim()) {
      return Response.json(
        { error: "Could not read the receipt image. Please upload a clearer photo." },
        { status: 422 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user",   content: PARSE_USER_TMPL(ocrText, lineItems) },
      ],
      max_tokens: 8000,
    });

    const raw  = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const data = JSON.parse(json) as DeliveryData;

    const serverIssues = serverValidate(data);
    if (serverIssues.length > 0) {
      data._discrepancies = [...(data._discrepancies ?? []), ...serverIssues];
    }

    return Response.json({ data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError)
      return Response.json({ error: "Could not parse receipt data. Please upload a clearer image." }, { status: 422 });
    return errResponse(err);
  }
}
