import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { veryfiExtract, VeryfiLineItem } from "@/lib/veryfi";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PARSE_SYSTEM = `You are a data parser for Ohio Lottery terminal "Confirm Order" receipts. You receive:
1. ocr_text — verbatim OCR transcript from a specialist OCR engine. Trust every character.
2. line_items — Veryfi structured items (use as a hint only).

Parse ocr_text into the JSON schema below, then SELF-VERIFY before returning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARSING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. orderNumber is the single most critical field — extract it exactly, preserving dashes, slashes, and leading zeros.
2. Extract every ordered book line item from the Game-Book column. Each row has: gameId, bookNumber, ticketValue, bookValue, status C or NC.
3. The Game-Book column value is formatted as "NNNN-NNNNNNN" (e.g., "0962-0110830"): gameId = "0962", bookNumber = "0110830". Preserve ALL leading zeros in bookNumber exactly as printed.
4. retailerNum and terminalNum must be preserved exactly as printed.
5. Dollar amounts always have two decimal places.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY SELF-CHECK BEFORE RETURNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  a) Verify orderNumber is present and non-empty.
  b) Count books array length → should equal totalBooks printed on receipt.
  c) Sum all bookValue entries → should equal totalValue. If not, re-read each line.
  d) Record any failures in _discrepancies.`;

const PARSE_USER_TMPL = (ocrText: string, lineItems: VeryfiLineItem[]) =>
  JSON.stringify({ ocr_text: ocrText, line_items: lineItems }, null, 0);

const PARSE_SCHEMA = `Return ONLY raw JSON (no markdown, no code fences):
{
  "headerText": "exact header text as printed",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "retailerNum": "retailer number EXACTLY as printed — preserve all formatting and leading zeros",
  "terminalNum": "terminal ID exactly as printed or null",
  "orderNumber": "order number EXACTLY as printed — preserve dashes, slashes, leading zeros",
  "books": [
    {
      "gameId": "game number only — e.g. '0962' from '0962-0110830'",
      "bookNumber": "book/pack serial — the part after the dash, e.g. '0110830' — preserve all leading zeros — null if not parseable",
      "gameName": "game name if visible or null",
      "ticketValue": 5,
      "bookValue": 1500,
      "status": "C"
    }
  ],
  "totalBooks": 5,
  "totalValue": 7500,
  "_discrepancies": []
}`;

// ── Server-side cross-validation ─────────────────────────────────────────────

interface BookEntry { bookValue?: number; bookNumber?: string }

interface OrderData {
  orderNumber?:    string | null;
  retailerNum?:    string | null;
  books?:          BookEntry[];
  totalBooks?:     number;
  totalValue?:     number;
  _discrepancies?: string[];
  [key: string]:   unknown;
}

function serverValidate(data: OrderData): string[] {
  const issues: string[] = [];
  const books = data.books ?? [];

  if (!data.orderNumber) {
    issues.push("Order number could not be extracted — re-upload a clearer image of the receipt header");
  }

  if (data.totalBooks != null && books.length !== data.totalBooks) {
    issues.push(
      `Receipt says ${data.totalBooks} books but ${books.length} line item${books.length !== 1 ? "s" : ""} were extracted — a row may have been missed`
    );
  }

  const sumValues = books.reduce((s, b) => s + (b.bookValue ?? 0), 0);
  if (data.totalValue != null && Math.abs(sumValues - data.totalValue) > 0.50) {
    issues.push(
      `Sum of book values ($${sumValues.toFixed(2)}) ≠ totalValue ($${data.totalValue.toFixed(2)}) — possible digit misread`
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

    // ── Step 1: Veryfi OCR ──────────────────────────────────────────────────
    const vDoc      = await veryfiExtract(readUrl);
    const ocrText   = vDoc.ocr_text  ?? "";
    const lineItems = vDoc.line_items ?? [];

    if (!ocrText.trim()) {
      return Response.json(
        { error: "Could not read the receipt image. Please upload a clearer photo." },
        { status: 422 }
      );
    }

    // ── Step 2: GPT-4o-mini structured parsing ──────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: `${PARSE_SYSTEM}\n\n${PARSE_SCHEMA}` },
        { role: "user",   content: PARSE_USER_TMPL(ocrText, lineItems) },
      ],
      max_tokens: 3000,
    });

    const raw  = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const data = JSON.parse(json) as OrderData;

    // ── Step 3: Server-side cross-validation ───────────────────────────────
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
