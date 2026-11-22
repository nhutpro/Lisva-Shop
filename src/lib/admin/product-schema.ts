import { z } from "zod";
import { emptyToUndefined } from "../orders/schema";
import { SLUG_PATTERN } from "../slug";

// The payload of the product editor. Existing colors and variants use their database id as `key`;
// new ones use any temporary key. Photos refer to a color or a variant by key.

const key = z.string().trim().min(1).max(64);
const text = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const noneToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;
const money = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.coerce.number().int().min(0, { message: "negative" }).max(1_000_000_000),
);
const optionalMoney = z.preprocess(noneToUndefined, money.optional());

const color = z.object({
  key,
  nameVi: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  hex: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, { message: "invalid_color" })
      .optional(),
  ),
});

const variant = z.object({
  key,
  colorKey: z.preprocess(noneToUndefined, key.optional()),
  sizeId: z.preprocess(noneToUndefined, z.string().min(1).max(64).optional()),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{1,63}$/, { message: "invalid_sku" }),
  price: optionalMoney,
  stock: z.coerce.number().int().min(0, { message: "negative" }).max(1_000_000),
  isActive: z.boolean().default(true),
});

const specRow = z.object({
  labelVi: z.string().trim().min(1).max(80),
  labelEn: z.string().trim().min(1).max(80),
  valueVi: z.string().trim().min(1).max(200),
  valueEn: z.string().trim().min(1).max(200),
});

// https:// links and paths inside this site ("/placeholders/x.svg"). "//host" and other schemes are refused.
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => /^https:\/\/[^\s/]/.test(u) || /^\/(?!\/)[^\s]*$/.test(u), {
    message: "invalid_url",
  });

const image = z.object({
  url: imageUrl,
  altVi: text(200),
  altEn: text(200),
  colorKey: z.preprocess(noneToUndefined, key.optional()),
  variantKey: z.preprocess(noneToUndefined, key.optional()),
});

export const productFormSchema = z
  .object({
    id: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    slug: z
      .string()
      .trim()
      .max(100)
      .refine((s) => SLUG_PATTERN.test(s), { message: "invalid_slug" }),
    categoryId: z.string().trim().min(1),
    brandId: z.string().trim().min(1),
    nameVi: z.string().trim().min(2).max(200),
    nameEn: z.string().trim().min(2).max(200),
    descriptionVi: z.string().trim().min(1).max(5000),
    descriptionEn: z.string().trim().min(1).max(5000),
    price: money,
    compareAtPrice: optionalMoney,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    featured: z.boolean().default(false),
    specs: z.array(specRow).max(30).default([]),
    colors: z.array(color).max(20).default([]),
    variants: z.array(variant).min(1).max(200),
    images: z.array(image).max(30).default([]),
  })
  .superRefine((p, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (p.compareAtPrice !== undefined && p.compareAtPrice < p.price)
      add(["compareAtPrice"], "compare_below_price");

    const colorKeys = new Set<string>();
    const colorNames = new Set<string>();
    p.colors.forEach((c, i) => {
      const name = c.nameVi.toLowerCase();
      if (colorKeys.has(c.key) || colorNames.has(name))
        add(["colors", i, "nameVi"], "duplicate_color");
      colorKeys.add(c.key);
      colorNames.add(name);
    });

    const hasColors = p.colors.length > 0;
    const sizedCount = p.variants.filter((v) => v.sizeId).length;
    const skus = new Set<string>();
    const combos = new Set<string>();
    const variantKeys = new Set<string>();

    p.variants.forEach((v, i) => {
      variantKeys.add(v.key);
      if (skus.has(v.sku)) add(["variants", i, "sku"], "duplicate_sku");
      skus.add(v.sku);

      // The shop can only find a variant by the options the product offers, so they must be consistent.
      if (v.colorKey && !colorKeys.has(v.colorKey))
        add(["variants", i, "colorKey"], "unknown_color");
      else if (hasColors && !v.colorKey)
        add(["variants", i, "colorKey"], "mixed_color_options");
      if (sizedCount > 0 && sizedCount < p.variants.length && !v.sizeId)
        add(["variants", i, "sizeId"], "mixed_size_options");

      const combo = `${v.colorKey ?? ""}|${v.sizeId ?? ""}`;
      if (combos.has(combo))
        add(["variants", i, "sizeId"], "duplicate_variant");
      combos.add(combo);
    });

    p.images.forEach((img, i) => {
      if (img.colorKey && img.variantKey)
        add(["images", i, "colorKey"], "image_target");
      else if (img.colorKey && !colorKeys.has(img.colorKey))
        add(["images", i, "colorKey"], "unknown_color");
      else if (img.variantKey && !variantKeys.has(img.variantKey))
        add(["images", i, "variantKey"], "unknown_variant");
    });
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductForm = z.output<typeof productFormSchema>;

/** The product exactly as the editor holds it: text fields are plain strings (empty when unset), numbers are numbers. */
export type ProductEditorData = {
  id?: string;
  slug: string;
  categoryId: string;
  brandId: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  price: number;
  compareAtPrice: number | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  featured: boolean;
  specs: {
    labelVi: string;
    labelEn: string;
    valueVi: string;
    valueEn: string;
  }[];
  colors: { key: string; nameVi: string; nameEn: string; hex: string }[];
  variants: {
    key: string;
    colorKey: string | null;
    sizeId: string | null;
    sku: string;
    price: number | null;
    stock: number;
    isActive: boolean;
  }[];
  images: {
    url: string;
    altVi: string;
    altEn: string;
    colorKey: string | null;
    variantKey: string | null;
  }[];
};
