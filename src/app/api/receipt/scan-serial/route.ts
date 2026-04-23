import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { veryfiExtract } from "@/lib/veryfi";
import { requireEmployee, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PARSE_SYSTEM = `You are a data parser extracting an Ohio Lottery ticket serial number from OCR text. You receive:
- ocr_text — verbatim OCR transcript of a lottery ticket, terminal screen, or receipt.

SERIAL NUMBER FORMAT: NNNN-NNNNNNN-NNN-N  (total 15 digits + 3 hyphens)
  Segment 1: 4 digits (game/type identifier)
  Segment 2: 7 digits (unique pack identifier)
  Segment 3: 3 digits (ticket number within pack)
  Segment 4: 1 check digit
  Example: 1008-0160737-025-9

PARSING RULES:
1. Scan the entire ocr_text for any sequence matching the serial format.
2. The number may appear with or without hyphens — if without hyphens, it is 15 consecutive digits.
3. If multiple candidates exist, prefer the one that exactly matches NNNN-NNNNNNN-NNN-N.
4. Format the result with hyphens: NNNN-NNNNNNN-NNN-N.
5. Validate total digit count = 15.

Return ONLY raw JSON (no markdown, no code fences):
{
  "serialNumber": "NNNN-NNNNNNN-NNN-N formatted with hyphens, or null if not found",
  "confidence": "high | medium | low",
  "packNumber": "the 7-digit middle segment or null",
  "gameCode": "the 4-digit first segment or null",
  "ticketNumber": "the 3-digit third segment or null",
  "rawText": "full ocr_text passed through verbatim",
  "reason": "if serialNumber is null: why it could not be found"
}`;

export async function POST(req: Request) {
  try {
    await requireEmployee();
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
        { data: { serialNumber: null, confidence: "low", reason: "Image could not be read. Please try a clearer photo." } }
      );
    }

    // ── Step 2: GPT-4o-mini parse ───────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user",   content: JSON.stringify({ ocr_text: ocrText }) },
      ],
      max_tokens: 500,
    });

    const raw  = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const data = JSON.parse(json);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError)
      return Response.json({ error: "Could not read image. Please try again." }, { status: 422 });
    return errResponse(err);
  }
}
