// eslint-disable-next-line @typescript-eslint/no-require-imports
const VeryfiSDK = require("@veryfi/veryfi-sdk");

export interface VeryfiLineItem {
  description?: string;
  quantity?:    number;
  unit_price?:  number;
  total?:       number;
  sku?:         string;
  upc?:         string;
  [key: string]: unknown;
}

export interface VeryfiDocument {
  id?:        number;
  ocr_text?:  string;
  date?:      string;
  time?:      string;
  total?:     number;
  subtotal?:  number;
  tax?:       number;
  vendor?: {
    name?:    string;
    address?: string;
    [key: string]: unknown;
  };
  line_items?: VeryfiLineItem[];
  [key: string]: unknown;
}

let _client: ReturnType<typeof createClient> | null = null;

function createClient() {
  return new VeryfiSDK(
    process.env.VERYFI_CLIENT_ID!,
    process.env.VERYFI_CLIENT_SECRET!,
    process.env.VERYFI_USERNAME!,
    process.env.VERYFI_API_KEY!,
  ) as {
    process_document_from_url: (
      file_url: string,
      file_urls: null,
      categories: null,
      auto_delete: boolean,
      boost_mode: boolean,
      external_id: null,
      max_pages_to_process: number,
    ) => Promise<VeryfiDocument>;
  };
}

export function getVeryfiClient() {
  if (!_client) _client = createClient();
  return _client;
}

/** Extract raw OCR text + line items from an image URL via Veryfi. */
export async function veryfiExtract(imageUrl: string): Promise<VeryfiDocument> {
  const client = getVeryfiClient();
  const doc = await client.process_document_from_url(
    imageUrl,
    null,
    null,
    true,   // auto_delete — don't persist documents in Veryfi
    false,  // boost_mode false = full-quality OCR
    null,
    1,
  );
  return doc;
}
