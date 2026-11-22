// @vitest-environment node
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalStorage, getUploadDir, STORED_NAME } from "./local";

let dir: string;
beforeEach(
  async () => void (dir = await mkdtemp(join(tmpdir(), "lisva-uploads-"))),
);
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("local storage", () => {
  it("stores a picture under a random name and reads it back", async () => {
    const storage = createLocalStorage(join(dir, "nested", "folder")); // created on demand
    const { name, url } = await storage.put(new Uint8Array([1, 2, 3]), "png");
    expect(name).toMatch(STORED_NAME);
    expect(url).toBe(`/uploads/${name}`);
    expect([...(await storage.read(name))!]).toEqual([1, 2, 3]);
    expect((await storage.put(new Uint8Array([1]), "png")).name).not.toBe(name);
  });

  it("only reads and removes names it generated (no path tricks)", async () => {
    const storage = createLocalStorage(dir);
    await storage.put(new Uint8Array([9]), "jpg");
    for (const bad of [
      "../secret.png",
      "..%2Fsecret.png",
      "a.png",
      "/etc/passwd",
      `${"a".repeat(32)}.svg`,
      `${"A".repeat(32)}.png`,
    ]) {
      expect(await storage.read(bad)).toBeNull();
      await storage.remove(bad);
    }
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("removes a stored picture, and is quiet when it is already gone", async () => {
    const storage = createLocalStorage(dir);
    const { name } = await storage.put(new Uint8Array([1]), "webp");
    await storage.remove(name);
    await storage.remove(name);
    expect(await storage.read(name)).toBeNull();
  });

  it("uses UPLOAD_DIR when set", () => {
    expect(getUploadDir({ UPLOAD_DIR: "/data/pics" })).toBe("/data/pics");
    expect(getUploadDir({})).toMatch(/\.uploads$/);
  });
});
