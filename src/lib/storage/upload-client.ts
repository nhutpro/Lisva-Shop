import { MAX_IMAGE_BYTES } from "./image-check";

const CODES = [
  "EMPTY",
  "TOO_LARGE",
  "BAD_TYPE",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "UNKNOWN",
] as const;
export type UploadCode = (typeof CODES)[number];
export type UploadResult =
  { ok: true; url: string } | { ok: false; code: UploadCode };

const codeOf = (value: unknown): UploadCode =>
  CODES.find((c) => c === value) ?? "UNKNOWN";

/** Sends one picture to the admin upload route. The server checks it again; these checks only save a round trip. */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, code: "EMPTY" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: "TOO_LARGE" };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    return { ok: false, code: "BAD_TYPE" };

  const body = new FormData();
  body.set("file", file);
  try {
    const response = await fetch("/api/admin/upload", { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as {
      url?: unknown;
      error?: unknown;
    };
    if (response.ok && typeof data.url === "string")
      return { ok: true, url: data.url };
    return { ok: false, code: codeOf(data.error) };
  } catch {
    return { ok: false, code: "UNKNOWN" };
  }
}
