import OpenAI from "openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { requireOwner, errResponse } from "@/lib/validate";

const schema = z.object({ key: z.string().min(1) });

const PROMPT = `
You are analyzing an Ohio Lottery scratch-off ticket delivery receipt.
Extract the following fields and return them as a single JSON object (no markdown):
{
  "gameId":      string,   // e.g. "G-4821"
  "gameName":    string,   // e.g. "Gold Rush Riches"
  "pack":        string,   // e.g. "P-001"
  "ticketStart": number,   // starting ticket number in the pack
  "ticketEnd":   number,   // ending ticket number in the pack
  "price":       number    // price per ticket in dollars (e.g. 5)
}
If a field is not visible, use null for strings and 0 for numbers.
`.trim();

export async function POST(req: Request) {
  try {
    await requireOwner();
    const { key } = schema.parse(await req.json());

    // Generate a short-lived read URL for OpenAI
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
      max_tokens: 300,
    });

    const raw = resp.choices[0].message.content ?? "{}";
    // Strip any accidental markdown code fences
    const json = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(json);

    return Response.json({ extracted });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.errors[0].message }, { status: 400 });
    if (err instanceof SyntaxError) return Response.json({ error: "Could not parse receipt data from image." }, { status: 422 });
    return errResponse(err);
  }
}
