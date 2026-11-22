import { createCloudinaryStorage, getCloudinaryConfig } from "./cloudinary";
import type { ImageKind } from "./image-check";
import { getLocalStorage } from "./local";

/** What the upload route needs from a storage: save the picture, give back the address the database keeps. */
export type ImageStorage = {
  put(bytes: Uint8Array, ext: ImageKind["ext"]): Promise<{ url: string }>;
};

/** Cloudinary when its three settings are present, otherwise a folder on this server. */
export function getImageStorage(
  env: Record<string, string | undefined> = process.env,
): ImageStorage {
  const cloudinary = getCloudinaryConfig(env);
  return cloudinary ? createCloudinaryStorage(cloudinary) : getLocalStorage();
}
