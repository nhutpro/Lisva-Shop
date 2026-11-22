import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageKind } from "./image-check";

// Pictures stored in a folder on the server's disk. This works for local development and for a server you
// manage (VPS). A host with a read-only or temporary disk (serverless) needs another storage behind the same
// functions: only `url` (what the database keeps) and these three functions matter to the rest of the app.

/** 32 random hex characters and a known extension: nothing the user typed ever becomes part of a path. */
export const STORED_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export const uploadUrl = (name: string) => `/uploads/${name}`;

export function getUploadDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.UPLOAD_DIR?.trim() || join(process.cwd(), ".uploads");
}

export function createLocalStorage(dir: string) {
  return {
    async put(
      bytes: Uint8Array,
      ext: ImageKind["ext"],
    ): Promise<{ name: string; url: string }> {
      await mkdir(dir, { recursive: true });
      const name = `${randomBytes(16).toString("hex")}.${ext}`;
      await writeFile(join(dir, name), bytes, { flag: "wx" }); // never overwrites
      return { name, url: uploadUrl(name) };
    },
    async read(name: string): Promise<Buffer | null> {
      if (!STORED_NAME.test(name)) return null;
      return readFile(join(dir, name)).catch(() => null);
    },
    async remove(name: string): Promise<void> {
      if (!STORED_NAME.test(name)) return;
      await unlink(join(dir, name)).catch(() => undefined);
    },
  };
}

export const getLocalStorage = () => createLocalStorage(getUploadDir());
