import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { veryfiExtract } from "@/lib/veryfi";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PARSE_SYSTEM = `You are a data parser extracting lottery book records from Ohio Lottery delivery receipt or inventory sheet OCR text. You receive:
- ocr_text — verbatim OCR transcript. Trust every character.
- line_items — Veryfi structured items (use as a hint, not ground truth).

PARSING RULES:
1. Extract EVERY lottery book listed in the document — do not skip any.
2. gameId: the game identifier code (e.g. "G-4821", "4821", numeric).
3. gameName: full game name exactly as printed.
4. pack: the book/pack serial number exactly as printed — preserve all characters and leading zeros.
5. ticketStart / ticketEnd: integer ticket numbers for the range in this book.
6. price: face value per individual ticket in USD (integer: 1, 2, 5, 10, 20, 30, or 50).
7. If a field is not visible for a book, use null for strings and 0 for numbers.
8. Never invent data not present in ocr_text.

SELF-CHECK: Count the books you extracted and confirm it matches any "Total" or count line in the document.

If ocr_text is completely unreadable or no books can be found, set unclear:true.

Return ONLY raw JSON (no markdown, no code fences):
{
  "unclear": false,
  "reason": null,
  "books": [
    {
      "gameId": "G-4821",
      "gameName": "Gold Rush Riches",
      "pack": "P-001",
      "ticketStart": 1,
      "ticketEnd": 300,
      "price": 5
    }
  ]
}`;

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
        { unclear: true, reason: "Could not read the image. Please upload a clearer photo." },
        { status: 422 }
      );
    }

    // ── Step 2: GPT-4o-mini parse ───────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user",   content: JSON.stringify({ ocr_text: ocrText, line_items: lineItems }) },
      ],
      max_tokens: 2000,
    });

    const raw  = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(json) as {
      unclear: boolean;
      reason:  string | null;
      books:   { gameId: string; gameName: string; pack: string; ticketStart: number; ticketEnd: number; price: number }[];
    };

    if (result.unclear) {
      return Response.json(
        { unclear: true, reason: result.reason ?? "Image could not be read." },
        { status: 422 }
      );
    }

    return Response.json({ unclear: false, books: result.books ?? [] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError)
      return Response.json({ unclear: true, reason: "Could not parse the image. Please try a clearer photo." }, { status: 422 });
    return errResponse(err);
  }
}
