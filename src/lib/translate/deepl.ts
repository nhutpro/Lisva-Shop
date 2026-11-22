import { z } from "zod";
import type { Translator } from "./types";

// Translation with the DeepL API (free or pro key) through plain fetch. Best effort: any problem (no quota, bad key,
// unsupported language, network) returns null and the caller carries on without a translation. Product texts are
// never logged. See https://developers.deepl.com/api-reference/translate

const TIMEOUT_MS = 20_000;
const MAX_TEXTS_PER_REQUEST = 50;
const MAX_CHARS_PER_REQUEST = 40_000; // far below DeepL's 128 KiB request limit, even with Vietnamese accents

const reply = z.object({
  translations: z.array(z.object({ text: z.string() })),
});

export type DeeplConfig = {
  apiKey: string;
  baseUrl: string;
  sourceLang: string;
  targetLang: string;
};

/** Free keys end in ":fx" and use a different host from pro keys. */
export function getDeeplConfig(
  env: Record<string, string | undefined> = process.env,
): DeeplConfig | null {
  const apiKey = env.DEEPL_API_KEY?.trim();
  if (!apiKey) return null;
  const defaultBase = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  return {
    apiKey,
    baseUrl: (env.DEEPL_API_BASE_URL?.trim() || defaultBase).replace(/\/$/, ""),
    sourceLang: env.DEEPL_SOURCE_LANG?.trim().toUpperCase() || "VI",
    targetLang: env.DEEPL_TARGET_LANG?.trim().toUpperCase() || "EN-US",
  };
}

/** Splits the texts into groups that respect DeepL's limits, keeping their order. */
export function batches(texts: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const text of texts) {
    if (
      current.length > 0 &&
      (current.length >= MAX_TEXTS_PER_REQUEST ||
        chars + text.length > MAX_CHARS_PER_REQUEST)
    ) {
      groups.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

export function createDeeplTranslator(config: DeeplConfig): Translator {
  const translateGroup = async (texts: string[]): Promise<string[] | null> => {
    const response = await fetch(`${config.baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `DeepL-Auth-Key ${config.apiKey}`,
      },
      body: JSON.stringify({
        text: texts,
        source_lang: config.sourceLang,
        target_lang: config.targetLang,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null; // 403 bad key, 456 quota used up, 400 unsupported language, 429/5xx busy...
    const body = reply.safeParse(await response.json());
    if (!body.success || body.data.translations.length !== texts.length)
      return null;
    return body.data.translations.map((t) => t.text.trim());
  };

  return async (texts) => {
    if (texts.length === 0) return [];
    try {
      const out: string[] = [];
      for (const group of batches(texts)) {
        const part = await translateGroup(group);
        if (!part) return null; // all or nothing: never save half a translation
        out.push(...part);
      }
      return out;
    } catch {
      return null;
    }
  };
}

/**
 * Remembers recent translations (in memory, per server process) so saving the same text again, for example after
 * a form error elsewhere, does not spend the monthly quota twice. Only successful results are kept.
 */
export function withCache(translate: Translator, maxEntries = 500): Translator {
  const cache = new Map<string, string>();
  return async (texts) => {
    const missing = [...new Set(texts.filter((t) => !cache.has(t)))];
    if (missing.length > 0) {
      const result = await translate(missing);
      if (!result) return null;
      missing.forEach((t, i) => {
        if (cache.size >= maxEntries)
          cache.delete(cache.keys().next().value as string);
        cache.set(t, result[i]);
      });
    }
    return texts.map((t) => cache.get(t) as string);
  };
}

let shared: { key: string; translator: Translator } | undefined;

/** The translator for this environment, or undefined when no DEEPL_API_KEY is set. */
export function getTranslator(
  env: Record<string, string | undefined> = process.env,
): Translator | undefined {
  const config = getDeeplConfig(env);
  if (!config) return undefined;
  const key = JSON.stringify(config);
  if (shared?.key !== key)
    shared = { key, translator: withCache(createDeeplTranslator(config)) };
  return shared.translator;
}
