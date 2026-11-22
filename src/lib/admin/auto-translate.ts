import type { Translator } from "../translate/types";

// Fills English fields the owner left empty, from the Vietnamese text, BEFORE the form is validated. English the
// owner typed is never changed. Without a translator, or when it fails, the input is returned untouched and the
// normal validation then reports the missing English (English stays compulsory).

const MAX_ITEMS = 120;
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const has = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

/** Pairs [object, viField, enField] where Vietnamese is present and English is empty. */
function missing(raw: Obj): { target: Obj; vi: string; en: string }[] {
  const found: { target: Obj; vi: string; en: string }[] = [];
  const check = (target: unknown, vi: string, en: string) => {
    if (isObj(target) && has(target[vi]) && !has(target[en]))
      found.push({ target, vi, en });
  };
  check(raw, "nameVi", "nameEn");
  check(raw, "descriptionVi", "descriptionEn");
  const each = (list: unknown, fn: (item: unknown) => void) =>
    Array.isArray(list) && list.forEach(fn);
  each(raw.specs, (s) => {
    check(s, "labelVi", "labelEn");
    check(s, "valueVi", "valueEn");
  });
  each(raw.colors, (c) => check(c, "nameVi", "nameEn"));
  each(raw.images, (i) => check(i, "altVi", "altEn"));
  return found;
}

async function apply(raw: Obj, translate: Translator): Promise<Obj> {
  const next = structuredClone(raw);
  const slots = missing(next);
  if (slots.length === 0 || slots.length > MAX_ITEMS) return raw;
  const english = await translate(
    slots.map((s) => (s.target[s.vi] as string).trim()),
  ).catch(() => null);
  if (!english || english.length !== slots.length) return raw;
  slots.forEach((slot, i) => {
    if (english[i]) slot.target[slot.en] = english[i];
  });
  return next;
}

/** The product editor's payload with empty English filled in (when a translator is available). */
export async function fillEnglish(
  raw: unknown,
  translate?: Translator,
): Promise<unknown> {
  if (!translate || !isObj(raw)) return raw;
  return apply(raw, translate);
}

/** The category form's values: only the name. */
export async function fillCategoryEnglish(
  raw: Record<string, unknown>,
  translate?: Translator,
): Promise<Record<string, unknown>> {
  if (!translate || !has(raw.nameVi) || has(raw.nameEn)) return raw;
  const result = await translate([raw.nameVi.trim()]).catch(() => null);
  return result?.[0] ? { ...raw, nameEn: result[0] } : raw;
}
