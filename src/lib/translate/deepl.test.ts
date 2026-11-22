// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  batches,
  createDeeplTranslator,
  getDeeplConfig,
  getTranslator,
  withCache,
} from "./deepl";

afterEach(() => vi.unstubAllGlobals());

const answer = (texts: (s: string) => string, status = 200) =>
  vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { text: string[] };
    return {
      ok: status === 200,
      status,
      json: async () => ({
        translations: body.text.map((t) => ({ text: texts(t) })),
      }),
    } as Response;
  });

describe("getDeeplConfig", () => {
  it("is off without a key; free keys (:fx) use the free host, others the pro host", () => {
    expect(getDeeplConfig({})).toBeNull();
    expect(getDeeplConfig({ DEEPL_API_KEY: " " })).toBeNull();
    expect(getDeeplConfig({ DEEPL_API_KEY: "abc:fx" })).toMatchObject({
      baseUrl: "https://api-free.deepl.com",
      sourceLang: "VI",
      targetLang: "EN-US",
    });
    expect(getDeeplConfig({ DEEPL_API_KEY: "abc" })).toMatchObject({
      baseUrl: "https://api.deepl.com",
    });
    expect(
      getDeeplConfig({
        DEEPL_API_KEY: "abc:fx",
        DEEPL_SOURCE_LANG: "vi",
        DEEPL_TARGET_LANG: "en-gb",
        DEEPL_API_BASE_URL: "http://x.test/",
      }),
    ).toMatchObject({
      baseUrl: "http://x.test",
      sourceLang: "VI",
      targetLang: "EN-GB",
    });
    expect(getTranslator({})).toBeUndefined();
    expect(getTranslator({ DEEPL_API_KEY: "k:fx" })).toBeTypeOf("function");
  });
});

describe("batches", () => {
  it("keeps the order and respects the count and size limits", () => {
    const many = Array.from({ length: 120 }, (_, i) => `t${i}`);
    const groups = batches(many);
    expect(groups.map((g) => g.length)).toEqual([50, 50, 20]);
    expect(groups.flat()).toEqual(many);
    expect(
      batches(["a".repeat(30_000), "b".repeat(30_000), "c"]).map(
        (g) => g.length,
      ),
    ).toEqual([1, 2]);
    expect(batches([])).toEqual([]);
  });
});

describe("createDeeplTranslator", () => {
  const config = getDeeplConfig({ DEEPL_API_KEY: "secret:fx" })!;

  it("sends the texts with the key in the header and returns the translations in order", async () => {
    const fetchMock = answer((t) => `EN(${t})`);
    vi.stubGlobal("fetch", fetchMock);
    expect(await createDeeplTranslator(config)(["Đồng hồ", "Thép"])).toEqual([
      "EN(Đồng hồ)",
      "EN(Thép)",
    ]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "DeepL-Auth-Key secret:fx",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      text: ["Đồng hồ", "Thép"],
      source_lang: "VI",
      target_lang: "EN-US",
    });
    expect(String(init.body)).not.toContain("secret");
  });

  it("splits a long list over several requests", async () => {
    const fetchMock = answer((t) => t.toUpperCase());
    vi.stubGlobal("fetch", fetchMock);
    const texts = Array.from({ length: 60 }, (_, i) => `t${i}`);
    expect(await createDeeplTranslator(config)(texts)).toEqual(
      texts.map((t) => t.toUpperCase()),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null for a bad key (403), a used-up quota (456), a wrong count, junk, or a network error", async () => {
    const t = createDeeplTranslator(config);
    for (const status of [400, 403, 429, 456, 500]) {
      vi.stubGlobal(
        "fetch",
        answer((x) => x, status),
      );
      expect(await t(["a"])).toBeNull();
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ translations: [] }),
          }) as Response,
      ),
    );
    expect(await t(["a"])).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ nope: 1 }),
          }) as Response,
      ),
    );
    expect(await t(["a"])).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await t(["a"])).toBeNull();
  });

  it("makes no request for an empty list, and gives nothing if a later group fails", async () => {
    const fetchMock = answer((x) => x);
    vi.stubGlobal("fetch", fetchMock);
    expect(await createDeeplTranslator(config)([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        call++;
        const body = JSON.parse(init.body as string) as { text: string[] };
        return {
          ok: call === 1,
          status: call === 1 ? 200 : 456,
          json: async () => ({
            translations: body.text.map((x) => ({ text: x })),
          }),
        } as Response;
      }),
    );
    expect(
      await createDeeplTranslator(config)(
        Array.from({ length: 60 }, (_, i) => `t${i}`),
      ),
    ).toBeNull();
  });
});

describe("withCache", () => {
  it("translates each text once, keeps the order, and does not cache failures", async () => {
    const inner = vi.fn(async (texts: string[]) =>
      texts.map((t) => `EN(${t})`),
    );
    const cached = withCache(inner);
    expect(await cached(["a", "b"])).toEqual(["EN(a)", "EN(b)"]);
    expect(await cached(["b", "c", "a", "b"])).toEqual([
      "EN(b)",
      "EN(c)",
      "EN(a)",
      "EN(b)",
    ]);
    expect(inner.mock.calls.map((c) => c[0])).toEqual([["a", "b"], ["c"]]);
    expect(await cached(["a"])).toEqual(["EN(a)"]);
    expect(inner).toHaveBeenCalledTimes(2);

    const failing = vi.fn<(t: string[]) => Promise<string[] | null>>(
      async () => null,
    );
    const c2 = withCache(failing);
    expect(await c2(["x"])).toBeNull();
    failing.mockResolvedValueOnce(["EN(x)"]);
    expect(await c2(["x"])).toEqual(["EN(x)"]);
  });

  it("is bounded", async () => {
    const inner = vi.fn(async (texts: string[]) =>
      texts.map((t) => `EN(${t})`),
    );
    const cached = withCache(inner, 2);
    await cached(["a", "b", "c"]);
    await cached(["a"]); // "a" was evicted, so it is translated again
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
