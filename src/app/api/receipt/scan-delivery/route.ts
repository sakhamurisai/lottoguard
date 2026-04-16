import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PROMPT = `You are a specialized OCR and data extraction system for Ohio Lottery "Instant Ticket Delivery Receipt" documents — critical legal financial records used for inventory reconciliation and Ohio Lottery Commission compliance.

ACCURACY IS PARAMOUNT: Extract EVERY SINGLE character with 100% fidelity. Errors in book numbers or dollar amounts have serious legal and financial consequences for the retailer.

DOCUMENT CONTEXT:
Ohio Lottery retailers receive this physical receipt when scratch-off lottery books are delivered to their store by the Ohio Lottery distribution system. The receipt serves as:
- Legal proof of delivery
- Primary inventory intake record
- The document used to verify the physical books received match what was ordered

DOCUMENT STRUCTURE (read top-to-bottom, left-to-right):

1. HEADER SECTION
   - Document title: typically "INSTANT TICKET DELIVERY RECEIPT" or "Ohio Lottery - Instant Ticket Delivery Receipt"
   - Ohio Lottery branding/logo text
   - Date (MM/DD/YYYY) and Time

2. RETAILER INFORMATION
   - Retailer Number (unique store identifier, e.g., "12345" or "R-12345")
   - Store/Retailer Name
   - Complete mailing address (street number, street name, city, state, ZIP)

3. SHIPMENT/ORDER INFORMATION
   - Shipment Number or ID
   - Order Number or Confirmation Number (critical for cross-referencing)
   - Ticket Type (e.g., "Scratch-Off", "Instant Ticket")

4. GAME DELIVERY TABLE (MOST CRITICAL SECTION)
   This is a multi-column table with one row per game/denomination. Columns are:
   ┌─────────┬──────────────────┬──────────┬───────┬────────────┬──────────┬─────────────────────┐
   │ Game ID │ Game Description │ Ticket $ │ Packs │ Pack Value │  Total   │ Pack Numbers (List) │
   └─────────┴──────────────────┴──────────┴───────┴────────────┴──────────┴─────────────────────┘
   - Game ID: numeric or alphanumeric game code
   - Game Description: full game name (e.g., "GOLD RUSH RICHES", "LUCKY 7s")
   - Ticket $: face value per ticket (1, 2, 5, 10, 20, 30, or 50)
   - Packs: number of packs/books delivered for this game
   - Pack Value: dollar value of one complete pack (Ticket $ × tickets per pack, usually 300)
   - Total: Pack Value × number of Packs
   - Pack Numbers: THE INDIVIDUAL BOOK/PACK SERIAL NUMBERS — list every one (e.g., 001234, 001235, 001236)
     These are the actual inventory book numbers that go into the system

5. FOOTER
   - Total Packs Issued (grand total across all games)
   - Authorized signature line(s)
   - Any additional reference numbers

CRITICAL EXTRACTION RULES:
1. Pack Numbers must be extracted with EXACT precision — leading zeros matter (001234 ≠ 1234)
2. Ticket $ is the FACE VALUE per individual ticket (not the pack value)
3. Every game row in the table must be extracted as a separate entry in the "games" array
4. rawText must contain the COMPLETE verbatim text — not a summary, not paraphrased

Return ONLY this JSON (absolutely zero markdown, zero code fences — raw JSON starting with {):
{
  "headerText": "exact complete header text as printed on the document",
  "date": "YYYY-MM-DD or null if unreadable",
  "time": "HH:MM or null if unreadable",
  "shipmentId": "shipment number as printed or null",
  "orderNumber": "order/confirmation number as printed or null",
  "retailerNum": "retailer number EXACTLY as printed — preserve all leading zeros and formatting",
  "retailerName": "store or retailer name as printed",
  "retailerAddress": "complete delivery address on a single line (street, city, state ZIP)",
  "ticketType": "ticket type description as printed",
  "games": [
    {
      "gameId": "game ID/number exactly as printed",
      "gameDescription": "full game name/description exactly as printed",
      "ticketValue": 5,
      "packQuantity": 3,
      "packValue": 1500.00,
      "packTotal": 4500.00,
      "packNumbers": ["001234", "001235", "001236"]
    }
  ],
  "totalPacksIssued": 10,
  "rawText": "COMPLETE VERBATIM TEXT of every single line in the document from top to bottom, preserving line breaks as \\n — this must be the full text, not a summary"
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
      max_tokens: 4000,
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
