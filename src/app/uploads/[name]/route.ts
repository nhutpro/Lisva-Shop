import { CONTENT_TYPES } from "@/lib/storage/image-check";
import { getLocalStorage, STORED_NAME } from "@/lib/storage/local";

// Serves uploaded pictures from the storage folder. Names are random and never change, so browsers and the
// CDN may keep them for a year. Only names this app generated can be asked for.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!STORED_NAME.test(name))
    return new Response("Not found", { status: 404 });

  const bytes = await getLocalStorage().read(name);
  if (!bytes) return new Response("Not found", { status: 404 });

  const ext = name.split(".")[1] as keyof typeof CONTENT_TYPES;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": CONTENT_TYPES[ext],
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
