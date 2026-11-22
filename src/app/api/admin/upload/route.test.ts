// @vitest-environment node
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({
  current: null as null | { role: "ADMIN" | "CUSTOMER" },
}));
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => user.current,
}));

import { GET } from "../../../uploads/[name]/route";
import { POST } from "./route";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lisva-route-"));
  vi.stubEnv("UPLOAD_DIR", dir);
  user.current = { role: "ADMIN" };
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
// A real fetch sets Content-Length and the multipart type; build the same here.
const upload = async (
  content: BlobPart,
  headers: Record<string, string> = {},
  name = "photo.jpg",
  withLength = true,
) => {
  const form = new FormData();
  form.set("file", new File([content], name, { type: "image/jpeg" }));
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  return POST(
    new Request("http://shop.test/api/admin/upload", {
      method: "POST",
      body,
      headers: {
        host: "shop.test",
        "content-type": encoded.headers.get("content-type")!,
        ...(withLength ? { "content-length": String(body.length) } : {}),
        ...headers,
      },
    }),
  );
};

describe("POST /api/admin/upload", () => {
  it("stores a picture for an administrator and returns its address", async () => {
    const response = await upload(JPEG);
    expect(response.status).toBe(200);
    const { url } = await response.json();
    expect(url).toMatch(/^\/uploads\/[a-f0-9]{32}\.jpg$/);
    expect(await readdir(dir)).toHaveLength(1);

    const served = await GET(new Request("http://shop.test" + url), {
      params: Promise.resolve({ name: url.split("/").pop() }),
    });
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect([...new Uint8Array(await served.arrayBuffer())]).toEqual([...JPEG]);
  });

  it("refuses guests (401) and customers (403) and stores nothing", async () => {
    user.current = null;
    expect((await upload(JPEG)).status).toBe(401);
    user.current = { role: "CUSTOMER" };
    expect((await upload(JPEG)).status).toBe(403);
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("refuses a request without a length (its size could not be limited) and a junk Origin", async () => {
    const noLength = await upload(JPEG, {}, "photo.jpg", false);
    expect(noLength.status).toBe(411);
    expect(await noLength.json()).toEqual({ error: "LENGTH_REQUIRED" });
    for (const origin of ["null", "not a url"]) {
      expect((await upload(JPEG, { origin })).status).toBe(403);
    }
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("refuses a request that comes from another website", async () => {
    const response = await upload(JPEG, { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("judges the content, not the name: a script named photo.jpg is refused", async () => {
    const response = await upload("<script>alert(1)</script>", {}, "photo.jpg");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "BAD_TYPE" });
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("refuses a missing file and an oversized one", async () => {
    const empty = new Response(new FormData());
    const emptyBody = new Uint8Array(await empty.arrayBuffer());
    const none = await POST(
      new Request("http://shop.test/api/admin/upload", {
        method: "POST",
        body: emptyBody,
        headers: {
          host: "shop.test",
          "content-type": empty.headers.get("content-type")!,
          "content-length": String(emptyBody.length),
        },
      }),
    );
    expect(none.status).toBe(400);
    const big = new Uint8Array(5 * 1024 * 1024 + 10);
    big.set([0xff, 0xd8, 0xff]);
    const response = await upload(big);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "TOO_LARGE" });
  });
});

describe("with Cloudinary configured", () => {
  it("saves through Cloudinary and returns its address, nothing on the local disk", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "k");
    vi.stubEnv("CLOUDINARY_API_SECRET", "s");
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            secure_url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
            public_id: "a",
          }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await upload(JPEG);
    expect(await response.json()).toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await readdir(dir)).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("reports UNKNOWN (and stores nothing) when Cloudinary fails", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "k");
    vi.stubEnv("CLOUDINARY_API_SECRET", "s");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({ ok: false, status: 500, json: async () => ({}) }) as Response,
      ),
    );
    const response = await upload(JPEG);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "UNKNOWN" });
    vi.unstubAllGlobals();
  });
});

describe("GET /uploads/[name]", () => {
  it("answers 404 for unknown names and path tricks", async () => {
    for (const name of ["nope.jpg", "../x.jpg", `${"a".repeat(32)}.jpg`]) {
      const response = await GET(new Request("http://shop.test/uploads/x"), {
        params: Promise.resolve({ name }),
      });
      expect(response.status).toBe(404);
    }
  });
});
