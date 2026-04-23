import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { veryfiExtract } from "@/lib/veryfi";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PARSE_SYSTEM = `You are a data parser for Ohio Lottery terminal action receipts — thermal receipts printed when a retailer activates, deactivates, or settles a scratch-off book. You receive:
1. ocr_text — verbatim OCR transcript from a specialist OCR engine. Trust every character.
2. line_items — Veryfi items (hint only).

Parse ocr_text into the JSON schema. Then SELF-VERIFY before returning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARSING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. bookNumber is the most critical field. Extract it exactly as printed — preserve all characters, dashes, leading zeros, and spaces.
2. action must be one of: activate / deactivate / settle / unknown.
   Signals: ACTIVATED/ACTIVATE/OPEN/OPENED → activate
            DEACTIVATED/DEACTIVATE/CLOSED/CLOSE → deactivate
            SETTLED/SETTLE/SETTLEMENT/RECONCILE → settle
3. retailerNum and terminalNum must be preserved exactly.

SELF-CHECK:
  a) Re-read bookNumber from ocr_text character by character and confirm it matches what you extracted.
  b) Confirm action is unambiguously one of the four values.
  c) Note any uncertainty in _discrepancies.

Return ONLY raw JSON (no markdown, no code fences):
{
  "action": "activate | deactivate | settle | unknown",
  "bookNumber": "exact book/pack number as printed — ALL characters preserved",
  "gameId": "game ID if visible or null",
  "gameName": "game name if visible or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "terminalNum": "terminal number exactly as printed or null",
  "retailerNum": "retailer number exactly as printed or null",
  "status": "status text exactly as printed",
  "_discrepancies": []
}`;

const PARSE_USER_TMPL = (ocrText: string) =>
  JSON.stringify({ ocr_text: ocrText }, null, 0);

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
    const vDoc    = await veryfiExtract(readUrl);
    const ocrText = vDoc.ocr_text ?? "";

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
        { role: "system", content: PARSE_SYSTEM },
        { role: "user",   content: PARSE_USER_TMPL(ocrText) },
      ],
      max_tokens: 1500,
    });

    const raw  = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const data = JSON.parse(json);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError)
      return Response.json({ error: "Could not parse receipt data. Please upload a clearer image." }, { status: 422 });
    return errResponse(err);
  }
}
