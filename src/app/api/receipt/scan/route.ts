import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PROMPT = `
You are analyzing an Ohio Lottery scratch-off ticket delivery receipt or inventory sheet.

Your job:
1. Extract EVERY lottery book listed in the image as an array.
2. If the image is too blurry, dark, angled, or otherwise unreadable, set "unclear" to true.

Return ONLY valid JSON — no markdown, no explanation:

{
  "unclear": false,
  "reason": null,
  "books": [
    {
      "gameId":      "G-4821",
      "gameName":    "Gold Rush Riches",
      "pack":        "P-001",
      "ticketStart": 1,
      "ticketEnd":   300,
      "price":       5
    }
  ]
}

If the image is unclear, return:
{
  "unclear": true,
  "reason": "One-sentence explanation of why the image could not be read.",
  "books": []
}

Rules:
- Extract ALL books visible, not just the first one.
- "price" is the face value per ticket in USD (number, not string).
- "ticketStart" and "ticketEnd" are integers.
- If a specific field is unreadable for one book, use null for strings and 0 for numbers.
- Never invent data that is not visible in the image.
`.trim();

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
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: readUrl, detail: "high" } },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const raw = resp.choices[0].message.content ?? "{}";
    const json = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(json) as {
      unclear: boolean;
      reason: string | null;
      books: {
        gameId: string; gameName: string; pack: string;
        ticketStart: number; ticketEnd: number; price: number;
      }[];
    };

    if (result.unclear) {
      return Response.json({ unclear: true, reason: result.reason ?? "Image could not be read." }, { status: 422 });
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
