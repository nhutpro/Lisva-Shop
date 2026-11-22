// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCloudinaryStorage,
  getCloudinaryConfig,
  signParams,
} from "./cloudinary";
import { getImageStorage } from "./index";

afterEach(() => vi.unstubAllGlobals());

const env = {
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "key123",
  CLOUDINARY_API_SECRET: "s3cret",
};
const config = getCloudinaryConfig(env)!;

describe("getCloudinaryConfig", () => {
  it("needs all three settings, with a default folder and API address", () => {
    expect(getCloudinaryConfig({})).toBeNull();
    expect(() =>
      getCloudinaryConfig({ ...env, CLOUDINARY_API_SECRET: " " }),
    ).toThrow("Missing: CLOUDINARY_API_SECRET");
    expect(() =>
      getCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: "demo" }),
    ).toThrow("CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
    expect(config).toMatchObject({
      cloudName: "demo",
      folder: "lisva/products",
      baseUrl: "https://api.cloudinary.com",
    });
    expect(
      getCloudinaryConfig({
        ...env,
        CLOUDINARY_FOLDER: "shop",
        CLOUDINARY_API_BASE_URL: "http://x.test/",
      }),
    ).toMatchObject({ folder: "shop", baseUrl: "http://x.test" });
  });
});

describe("signParams", () => {
  it("matches the example in Cloudinary's documentation (sorted parameters + secret, SHA-1)", () => {
    const signature = signParams(
      {
        timestamp: 1315060510,
        eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
        public_id: "sample_image",
      },
      "abcd",
    );
    expect(signature).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
});

describe("createCloudinaryStorage", () => {
  const ok = (extra = {}) =>
    vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            secure_url:
              "https://res.cloudinary.com/demo/image/upload/v1/lisva/products/abc.png",
            public_id: "lisva/products/abc",
            ...extra,
          }),
        }) as Response,
    );

  it("sends the file with a signature (never the secret) and returns the https address", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);
    const result = await createCloudinaryStorage(config, () => 1700000000).put(
      new Uint8Array([1, 2, 3]),
      "png",
    );
    expect(result).toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/v1/lisva/products/abc.png",
      publicId: "lisva/products/abc",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    const form = init.body as FormData;
    expect(form.get("api_key")).toBe("key123");
    expect(form.get("folder")).toBe("lisva/products");
    expect(form.get("timestamp")).toBe("1700000000");
    expect(form.get("signature")).toBe(
      signParams({ folder: "lisva/products", timestamp: 1700000000 }, "s3cret"),
    );
    expect((form.get("file") as File).type).toBe("image/png");
    expect([...form.values()].some((v) => v === "s3cret")).toBe(false);
  });

  it("throws when Cloudinary refuses, answers something unexpected, or is unreachable", async () => {
    const storage = createCloudinaryStorage(config);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({ ok: false, status: 401, json: async () => ({}) }) as Response,
      ),
    );
    await expect(storage.put(new Uint8Array([1]), "jpg")).rejects.toThrow(
      "401",
    );
    vi.stubGlobal("fetch", ok({ secure_url: "http://insecure.example/a.png" }));
    await expect(storage.put(new Uint8Array([1]), "jpg")).rejects.toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(storage.put(new Uint8Array([1]), "jpg")).rejects.toThrow(
      "offline",
    );
  });
});

describe("getImageStorage", () => {
  it("uses Cloudinary when it is configured, and the local folder otherwise", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            secure_url: "https://res.cloudinary.com/demo/x.png",
            public_id: "x",
          }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    const { url } = await getImageStorage(env).put(new Uint8Array([1]), "png");
    expect(url).toBe("https://res.cloudinary.com/demo/x.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
