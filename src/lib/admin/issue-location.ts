// Turns the path of a validation problem ("variants.0.sku") into where the field is in the product editor,
// so the page can list the problems and jump to them. Pure, so it is easy to test.

export type IssueLocation = {
  /** The id of the input (or of the section for a problem that belongs to a whole list). */
  elementId: string;
  /** Which editor part it belongs to, and which row (0-based) when it is in a list. */
  section: "basic" | "pricing" | "specs" | "colors" | "variants" | "images";
  field: string;
  index?: number;
};

const BASIC = new Set([
  "nameVi",
  "nameEn",
  "slug",
  "categoryId",
  "brandId",
  "descriptionVi",
  "descriptionEn",
]);
const PRICING = new Set(["price", "compareAtPrice", "status", "featured"]);

// Fields whose input id differs from their name in the data.
const VARIANT_IDS: Record<string, string> = {
  colorKey: "color",
  sizeId: "size",
  sku: "sku",
  price: "price",
  stock: "stock",
};
const IMAGE_IDS: Record<string, string> = {
  url: "url",
  altVi: "altVi",
  altEn: "altEn",
  colorKey: "target",
  variantKey: "target",
};

export function issueLocation(path: string): IssueLocation | null {
  const [head, rawIndex, field = ""] = path.split(".");
  if (BASIC.has(head))
    return { elementId: head, section: "basic", field: head };
  if (PRICING.has(head))
    return { elementId: head, section: "pricing", field: head };

  const index = Number(rawIndex);
  const hasRow =
    rawIndex !== undefined && Number.isInteger(index) && index >= 0;
  if (head === "specs")
    return hasRow
      ? { elementId: `spec-${index}-${field}`, section: "specs", field, index }
      : { elementId: "specs", section: "specs", field: "" };
  if (head === "colors")
    return hasRow
      ? {
          elementId: `color-${index}-${field}`,
          section: "colors",
          field,
          index,
        }
      : { elementId: "colors", section: "colors", field: "" };
  if (head === "variants") {
    return hasRow && VARIANT_IDS[field]
      ? {
          elementId: `variant-${index}-${VARIANT_IDS[field]}`,
          section: "variants",
          field,
          index,
        }
      : { elementId: "variants", section: "variants", field: "" };
  }
  if (head === "images") {
    return hasRow && IMAGE_IDS[field]
      ? {
          elementId: `image-${index}-${IMAGE_IDS[field]}`,
          section: "images",
          field,
          index,
        }
      : { elementId: "images", section: "images", field: "" };
  }
  return null;
}
