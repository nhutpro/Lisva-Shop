import { describe, expect, it } from "vitest";
import { inspectImage, MAX_IMAGE_BYTES } from "./image-check";

const bytes = (...b: number[]) =>
  new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("inspectImage", () => {
  it("recognises JPEG, PNG and WebP by their content", () => {
    expect(inspectImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({
      ok: true,
      ext: "jpg",
      contentType: "image/jpeg",
    });
    expect(
      inspectImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toMatchObject({ ok: true, ext: "png" });
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0,
    ]);
    expect(inspectImage(webp)).toMatchObject({
      ok: true,
      ext: "webp",
      contentType: "image/webp",
    });
  });

  it("refuses SVG, scripts, text and other files, whatever their name", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    expect(
      inspectImage(
        text(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      ),
    ).toEqual({ ok: false, code: "BAD_TYPE" });
    expect(inspectImage(text("<html></html>"))).toEqual({
      ok: false,
      code: "BAD_TYPE",
    });
    expect(inspectImage(text("GIF89a......"))).toEqual({
      ok: false,
      code: "BAD_TYPE",
    });
    expect(
      inspectImage(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45,
        ]),
      ),
    ).toEqual({ ok: false, code: "BAD_TYPE" });
  });

  it("refuses empty and oversized files", () => {
    expect(inspectImage(new Uint8Array())).toEqual({
      ok: false,
      code: "EMPTY",
    });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(inspectImage(big)).toEqual({ ok: false, code: "TOO_LARGE" });
    const limit = new Uint8Array(MAX_IMAGE_BYTES);
    limit.set([0xff, 0xd8, 0xff]);
    expect(inspectImage(limit).ok).toBe(true);
  });
});
