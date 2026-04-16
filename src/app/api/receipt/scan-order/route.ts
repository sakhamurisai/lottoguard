import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PROMPT = `You are a specialized OCR system for Ohio Lottery terminal "Confirm Order" receipts — the thermal paper receipt printed by the Ohio Lottery terminal (located in the store) when a retailer places or confirms a scratch-off book order.

ACCURACY IS CRITICAL: Extract every character with 100% precision. These receipts are used for cross-referencing against physical delivery receipts to verify order fulfillment.

DOCUMENT CONTEXT:
When an Ohio Lottery retailer uses their in-store lottery terminal to order or confirm delivery of scratch-off books, the terminal prints this "Confirm Order" receipt. It serves as:
- The retailer's copy of what was ordered through the lottery terminal system
- The document cross-referenced against the physical delivery receipt upon arrival
- Legal documentation for inventory ordering

DOCUMENT STRUCTURE (thermal receipt, narrow format):

1. HEADER (CRITICAL)
   - Must contain the text "CONFIRM ORDER" or "Confirmed Order" or similar
   - Ohio Lottery system name/branding
   - Terminal ID number
   - Retailer number
   - Date and time of order

2. ORDER INFORMATION
   - Order Number (CRITICAL — used to cross-reference delivery receipt)
   - Order date and time
   - Retailer/terminal number

3. ORDERED ITEMS LIST (one line/entry per book ordered):
   - Game identifier or game number
   - Game name/description
   - Dollar value per ticket ($1, $5, $10, $20, $30, $50)
   - Total book value (face value × tickets per book, typically 300)
   - Status: C = Confirmed, NC = Not Confirmed

4. TOTALS
   - Total number of books ordered
   - Grand total dollar value

5. FOOTER
   - Confirmation code or authorization number
   - Terminal receipt number

CRITICAL EXTRACTION RULES:
1. The order number is the single most important field — capture it exactly
2. Status "C" means Confirmed, "NC" means Not Confirmed — extract exactly as printed
3. bookValue should be the total dollar value of the entire book/pack
4. rawText must be the COMPLETE text of the entire receipt — every character

Return ONLY raw JSON (zero markdown, zero code fences):
{
  "headerText": "exact complete header text as printed",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "retailerNum": "retailer number EXACTLY as printed",
  "terminalNum": "terminal ID/number if present or null",
  "orderNumber": "order number — CRITICAL, must be exact as printed",
  "books": [
    {
      "gameId": "game identifier as printed",
      "gameName": "game name as printed",
      "ticketValue": 5,
      "bookValue": 1500,
      "status": "C"
    }
  ],
  "totalBooks": 5,
  "totalValue": 7500,
  "rawText": "COMPLETE VERBATIM TEXT of every single character in the receipt, preserving newlines as \\n"
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
      max_tokens: 2000,
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
