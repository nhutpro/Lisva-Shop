import { createHash } from "node:crypto";
import { z } from "zod";
import { CONTENT_TYPES, type ImageKind } from "./image-check";

// Stores pictures on Cloudinary through its upload API (plain fetch, no extra package). The server signs the
// request with the API secret, so the secret never reaches the browser. The database keeps only the returned
// https address. See https://cloudinary.com/documentation/authentication_signatures

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  baseUrl: string;
};

const TIMEOUT_MS = 30_000;

/**
 * The configuration from the environment, or null when Cloudinary is not used at all (local storage is used then).
 * A half-filled setup throws, naming the missing variables: silently falling back to the local disk would let the
 * owner believe pictures are safe in the cloud.
 */
export function getCloudinaryConfig(
  env: Record<string, string | undefined> = process.env,
): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName && !apiKey && !apiSecret) return null;
  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName && "CLOUDINARY_CLOUD_NAME",
      !apiKey && "CLOUDINARY_API_KEY",
      !apiSecret && "CLOUDINARY_API_SECRET",
    ].filter(Boolean);
    throw new Error(
      `Cloudinary is partly configured. Missing: ${missing.join(", ")}`,
    );
  }
  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: env.CLOUDINARY_FOLDER?.trim() || "lisva/products",
    baseUrl: (
      env.CLOUDINARY_API_BASE_URL?.trim() || "https://api.cloudinary.com"
    ).replace(/\/$/, ""),
  };
}

/** SHA-1 of the parameters sorted by name ("a=1&b=2") followed directly by the API secret, in hex. */
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(text + apiSecret)
    .digest("hex");
}

const uploaded = z.object({
  secure_url: z.url().refine((u) => u.startsWith("https://"), "https only"),
  public_id: z.string().min(1),
});

export function createCloudinaryStorage(
  config: CloudinaryConfig,
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  return {
    /** Uploads the picture and returns its https address. Throws when Cloudinary refuses or cannot be reached. */
    async put(
      bytes: Uint8Array,
      ext: ImageKind["ext"],
    ): Promise<{ url: string; publicId: string }> {
      const timestamp = now();
      const signed = { folder: config.folder, timestamp };
      const body = new FormData();
      body.set(
        "file",
        new Blob([new Uint8Array(bytes)], { type: CONTENT_TYPES[ext] }),
        `upload.${ext}`,
      );
      body.set("api_key", config.apiKey);
      body.set("timestamp", String(timestamp));
      body.set("folder", config.folder);
      body.set("signature", signParams(signed, config.apiSecret));

      const response = await fetch(
        `${config.baseUrl}/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
        {
          method: "POST",
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!response.ok)
        throw new Error(`Cloudinary upload failed (${response.status})`);
      const result = uploaded.parse(await response.json());
      return { url: result.secure_url, publicId: result.public_id };
    },
  };
}
