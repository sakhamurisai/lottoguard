import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PROMPT = `You are a specialized OCR system for Ohio Lottery terminal action receipts — thermal receipts printed when a retailer activates, deactivates, or settles a lottery scratch-off book using their in-store lottery terminal.

ACCURACY IS CRITICAL: The book/pack number must be extracted perfectly to match against inventory records.

DOCUMENT CONTEXT:
Ohio Lottery retailers use their in-store lottery terminal to manage the lifecycle of scratch-off books:
- ACTIVATE: Opening/starting a new book for sale. Terminal prints activation receipt.
- DEACTIVATE: Temporarily closing a book (end of shift, day close). Terminal prints deactivation receipt.
- SETTLE: Reconciling a sold-out or retired book. Terminal prints settlement/settlement report.

These receipts are used to:
- Verify the correct book was acted upon (book number must match inventory)
- Create an audit trail for compliance
- Track book lifecycle transitions

DOCUMENT STRUCTURE (thermal receipt, narrow format):
1. ACTION TYPE clearly stated: "Activated", "Deactivated", "Settled", "Open", "Closed", "Settlement Report"
2. Book/Pack Number: The specific inventory book ID (e.g., 001234, P-001, or alphanumeric)
3. Game Information: Game ID and/or game name if printed
4. Date and time the action occurred
5. Terminal Number: The lottery terminal that processed the action (e.g., T-001, TRM-12345)
6. Retailer Number: Store's lottery retailer ID (must match store's registered number)
7. Status confirmation text

KEY IDENTIFICATION SIGNALS:
- "ACTIVATED" or "OPEN" → action = "activate"
- "DEACTIVATED" or "CLOSED" or "CLOSE" → action = "deactivate"
- "SETTLED" or "SETTLEMENT" or "RECONCILE" → action = "settle"

CRITICAL: Extract the book/pack number with 100% accuracy — it must exactly match the book number in our inventory database.

Return ONLY raw JSON (zero markdown, zero code fences):
{
  "action": "activate" | "deactivate" | "settle" | "unknown",
  "bookNumber": "exact book/pack number as printed — preserve all formatting and leading zeros",
  "gameId": "game ID/number if visible or null",
  "gameName": "game name if visible or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "terminalNum": "terminal number exactly as printed or null",
  "retailerNum": "retailer number exactly as printed or null",
  "status": "status text exactly as it appears on the receipt",
  "rawText": "COMPLETE VERBATIM TEXT of the entire receipt — every character"
}`.trim();

export async function POST(req: Request) {
  try {
    await requireOwner();
    const { key } = schema.parse(await req.json());

    const readUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
      { expiresIn: 60 }
    );

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: readUrl, detail: "high" } },
        ],
      }],
      max_tokens: 1000,
    });

    const raw = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const data = JSON.parse(json);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError) return Response.json({ error: "Could not parse receipt. Please upload a clearer image." }, { status: 422 });
    return errResponse(err);
  }
}
