// Checks an uploaded picture by its real content, never by the file name or the type the browser claims.
// SVG is not accepted on purpose: it can carry scripts.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageKind = {
  ext: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
};
export type ImageCheck =
  | ({ ok: true } & ImageKind)
  | { ok: false; code: "EMPTY" | "TOO_LARGE" | "BAD_TYPE" };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

export function inspectImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, code: "EMPTY" };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, code: "TOO_LARGE" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { ok: true, ext: "jpg", contentType: "image/jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { ok: true, ext: "png", contentType: "image/png" };
  // WebP: "RIFF" + 4 size bytes + "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { ok: true, ext: "webp", contentType: "image/webp" };
  }
  return { ok: false, code: "BAD_TYPE" };
}

export const CONTENT_TYPES: Record<ImageKind["ext"], ImageKind["contentType"]> =
  {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
