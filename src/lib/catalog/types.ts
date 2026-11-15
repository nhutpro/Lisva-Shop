// Plain, serializable data shapes passed from the database layer to pages.
// No Decimal, Date or class instances, so they are safe to cache and to pass to Client Components.
import type { Spec } from "./specs";

export type ProductCardData = {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string | null;
  brandName: string;
  categorySlug: string;
  /** Lowest effective price over the active variants. */
  fromPrice: number;
  /** True when variants have different prices (show "from"). */
  priceVaries: boolean;
  compareAtPrice: number | null;
  image: { url: string; altVi: string | null; altEn: string | null } | null;
  colors: { nameVi: string; nameEn: string | null; hex: string | null }[];
  inStock: boolean;
};

export type ListResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
};

export type CategoryData = {
  slug: string;
  nameVi: string;
  nameEn: string | null;
  parentSlug: string | null;
  count: number;
};

export type ListFacets = {
  brands: { slug: string; name: string }[];
  sizes: { label: string; type: "SHOE" | "WATCH" }[];
  colors: { nameVi: string; nameEn: string | null; hex: string | null }[];
  priceMin: number | null;
  priceMax: number | null;
};

export type SizeData = {
  id: string;
  label: string;
  type: "SHOE" | "WATCH";
  footLengthCm: number | null;
  usSize: string | null;
};

export type ColorData = { id: string; nameVi: string; nameEn: string | null; hex: string | null };

export type VariantData = {
  id: string;
  sku: string;
  colorId: string | null;
  sizeId: string | null;
  /** Effective price (variant price, else product price). */
  price: number;
  stock: number;
};

export type ImageData = {
  id: string;
  url: string;
  altVi: string | null;
  altEn: string | null;
  variantId: string | null;
  colorId: string | null;
  position: number;
};

export type ProductDetailData = {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string | null;
  descriptionVi: string | null;
  descriptionEn: string | null;
  brandName: string;
  category: { slug: string; nameVi: string; nameEn: string | null };
  price: number;
  compareAtPrice: number | null;
  specs: Spec[];
  colors: ColorData[];
  sizes: SizeData[];
  variants: VariantData[];
  images: ImageData[];
};

export type HomeData = {
  featured: ProductCardData[];
  newest: ProductCardData[];
  categories: CategoryData[];
};
