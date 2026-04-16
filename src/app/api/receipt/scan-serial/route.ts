import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { requireEmployee, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PROMPT = `You are extracting an Ohio Lottery ticket serial number from an image captured by a store employee at clock-in or clock-out.

CONTEXT:
Ohio Lottery scratch-off tickets have a unique serial number that employees use when starting/ending their shift to track which tickets were sold during their work period. Employees photograph the ticket or the terminal display showing the serial number.

OHIO LOTTERY SERIAL NUMBER FORMAT:
The standard format is: NNNN-NNNNNNN-NNN-N
Example: 1008-0160737-025-9
- Segment 1: 4 digits (game/type identifier)
- Hyphen
- Segment 2: 7 digits (unique pack identifier)
- Hyphen
- Segment 3: 3 digits (ticket number within pack)
- Hyphen
- Segment 4: 1 check digit

WHERE TO LOOK IN THE IMAGE:
- Directly on a scratch-off lottery ticket: serial number is usually printed on the front near the bottom, sometimes on the back
- On a lottery terminal screen display showing the current book/ticket information
- On a receipt/printout from the lottery terminal
- As a barcode with the number printed below it
- As plain printed text

The number may appear:
- With hyphens: 1234-1234567-123-1
- Without hyphens: 1234123456712 31
- As barcode digits: look for a string of 16 digits total

INSTRUCTIONS:
1. Scan the ENTIRE image for any number matching the serial format
2. If multiple numbers are visible, prefer the one that matches NNNN-NNNNNNN-NNN-N exactly
3. Validate: total digits should be 4+7+3+1 = 15 digits
4. If seen as a barcode, read the number printed beneath or alongside it

Return ONLY raw JSON (zero markdown, zero code fences):
{
  "serialNumber": "NNNN-NNNNNNN-NNN-N formatted with hyphens, or null if not found",
  "confidence": "high | medium | low",
  "packNumber": "the 7-digit middle segment if identifiable separately or null",
  "gameCode": "the 4-digit first segment if identifiable or null",
  "ticketNumber": "the 3-digit third segment or null",
  "rawText": "ALL text and numbers visible anywhere in the image",
  "reason": "if serialNumber is null: specific reason why it could not be extracted"
}`.trim();

export async function POST(req: Request) {
  try {
    await requireEmployee();
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
      max_tokens: 500,
    });

    const raw = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const data = JSON.parse(json);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    if (err instanceof SyntaxError) return Response.json({ error: "Could not read image. Please try again." }, { status: 422 });
    return errResponse(err);
  }
}
