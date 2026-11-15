import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import vi_ from "@/i18n/dictionaries/vi.json";
import { useCartStore } from "@/lib/cart/store";
import type { ProductDetailData } from "@/lib/catalog/types";
import { ProductPurchase } from "./product-purchase";

// next/image needs the Next.js runtime; a plain <img> is enough to test our own logic.
vi.mock("next/image", () => ({
  // `fill` and `priority` are Next-only props and must not reach the DOM element.
  default: ({ fill, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

const labels = vi_.product;
const render_ = (product: ProductDetailData) =>
  render(<ProductPurchase product={product} locale="vi" cartHref="/vi/cart" labels={labels} fromLabel={vi_.common.from} />);

const base = {
  id: "p1",
  slug: "runner",
  nameVi: "Giày chạy bộ Runner",
  nameEn: "Runner shoes",
  descriptionVi: null,
  descriptionEn: null,
  brandName: "Zoomer",
  category: { slug: "giay", nameVi: "Giày", nameEn: "Shoes" },
  price: 2_000_000,
  compareAtPrice: null,
  specs: [] as ProductDetailData["specs"],
};

const img = (id: string, extra = {}) => ({ id, url: `/${id}.jpg`, altVi: id, altEn: null, variantId: null, colorId: null, position: 0, ...extra });

// Black: 41 (3 left), 42 (2 left, own price). White: 42 only (plenty).
const shoe: ProductDetailData = {
  ...base,
  colors: [
    { id: "c-blk", nameVi: "Đen", nameEn: "Black", hex: "#111111" },
    { id: "c-wht", nameVi: "Trắng", nameEn: "White", hex: "#ffffff" },
  ],
  sizes: [
    { id: "s41", label: "41", type: "SHOE", footLengthCm: 25.5, usSize: "8" },
    { id: "s42", label: "42", type: "SHOE", footLengthCm: 26.5, usSize: "9" },
  ],
  variants: [
    { id: "v1", sku: "BLK-41", colorId: "c-blk", sizeId: "s41", price: 2_000_000, stock: 3 },
    { id: "v2", sku: "BLK-42", colorId: "c-blk", sizeId: "s42", price: 2_200_000, stock: 2 },
    { id: "v3", sku: "WHT-42", colorId: "c-wht", sizeId: "s42", price: 2_000_000, stock: 20 },
  ],
  images: [img("general"), img("black-1", { colorId: "c-blk" }), img("black-42-own", { variantId: "v2" })],
};

const noOptions: ProductDetailData = {
  ...base,
  slug: "digital",
  nameVi: "Đồng hồ điện tử",
  price: 590_000,
  colors: [],
  sizes: [],
  variants: [{ id: "d1", sku: "DIGI", colorId: null, sizeId: null, price: 590_000, stock: 12 }],
  images: [img("watch")],
};

const radio = (name: RegExp) => screen.getByRole("radio", { name });
const cart = () => useCartStore.getState().items;

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
});

describe("a product without options", () => {
  it("shows no pickers and adds straight to the cart", async () => {
    const user = userEvent.setup();
    render_(noOptions);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/590\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Còn hàng/)).toBeInTheDocument();
    expect(screen.getByText(/DIGI/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: labels.addToCart }));
    expect(cart()).toEqual([{ variantId: "d1", quantity: 1 }]);
    expect(screen.getByText(labels.added)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: labels.viewCart })).toHaveAttribute("href", "/vi/cart");
  });

  it("adding twice makes quantity 2", async () => {
    const user = userEvent.setup();
    render_(noOptions);
    await user.click(screen.getByRole("button", { name: labels.addToCart }));
    await user.click(screen.getByRole("button", { name: labels.addToCart }));
    expect(cart()).toEqual([{ variantId: "d1", quantity: 2 }]);
  });
});

describe("a product with color and size", () => {
  it("asks the shopper to choose instead of failing silently, and adds nothing", async () => {
    const user = userEvent.setup();
    render_(shoe);

    await user.click(screen.getByRole("button", { name: labels.addToCart }));
    expect(screen.getByText(labels.chooseBoth)).toBeInTheDocument();
    expect(cart()).toEqual([]);

    await user.click(radio(/^Đen/));
    await user.click(screen.getByRole("button", { name: labels.addToCart }));
    expect(screen.getByText(labels.chooseSize)).toBeInTheDocument();
    expect(screen.queryByText(labels.chooseBoth)).not.toBeInTheDocument();
    expect(cart()).toEqual([]);
  });

  it("shows 'from' price until a variant is chosen, then that variant's price, stock and SKU", async () => {
    const user = userEvent.setup();
    render_(shoe);

    expect(screen.queryByText(/SKU/)).not.toBeInTheDocument(); // no SKU before a variant is chosen
    expect(screen.getByText(vi_.common.from)).toBeInTheDocument();
    expect(screen.getByText(/2\.000\.000/)).toBeInTheDocument();

    await user.click(radio(/^Đen/));
    await user.click(radio(/^42/));
    expect(screen.getByText(/2\.200\.000/)).toBeInTheDocument(); // variant's own price
    expect(screen.queryByText(vi_.common.from)).not.toBeInTheDocument();
    expect(screen.getByText("Chỉ còn 2 sản phẩm")).toBeInTheDocument();
    expect(screen.getByText(/BLK-42/)).toBeInTheDocument();
  });

  it("disables combinations that do not exist", async () => {
    const user = userEvent.setup();
    render_(shoe);

    // Nothing chosen yet: everything that exists somewhere is selectable.
    expect(radio(/^Trắng/)).toBeEnabled();
    expect(radio(/^41/)).toBeEnabled();

    // White only comes in 42, so with 41 chosen White is unavailable.
    await user.click(radio(/^41/));
    expect(radio(/^Trắng/)).toBeDisabled();
    expect(radio(/^Trắng/)).toHaveAccessibleName(new RegExp(labels.optionUnavailable));
    expect(radio(/^Đen/)).toBeEnabled();
  });

  it("clears a size that no longer exists with the newly chosen color", async () => {
    const user = userEvent.setup();
    render_(shoe);
    await user.click(radio(/^41/));
    await user.click(radio(/^Đen/));
    expect(radio(/^41/)).toBeChecked();

    // Going from Black to White: 41 does not exist in White, so choosing White first is blocked...
    expect(radio(/^Trắng/)).toBeDisabled();
    // ...while choosing 42 first and then White works.
    await user.click(radio(/^42/));
    await user.click(radio(/^Trắng/));
    expect(radio(/^Trắng/)).toBeChecked();
    expect(radio(/^42/)).toBeChecked();
  });

  it("adds exactly the chosen variant to the cart and confirms it", async () => {
    const user = userEvent.setup();
    render_(shoe);

    await user.click(radio(/^Trắng/));
    await user.click(radio(/^42/));
    await user.click(screen.getByRole("button", { name: labels.addToCart }));

    expect(cart()).toEqual([{ variantId: "v3", quantity: 1 }]);
    expect(screen.getByText(labels.added)).toBeInTheDocument();

    // Changing the selection removes the confirmation.
    await user.click(radio(/^Đen/));
    expect(screen.queryByText(labels.added)).not.toBeInTheDocument();
  });

  it("switches the photos with the selection: general, then color, then the variant's own", async () => {
    const user = userEvent.setup();
    render_(shoe);
    const gallery = screen.getByRole("group", { name: labels.gallery });
    const main = () => within(gallery).getAllByRole("img")[0];

    expect(main()).toHaveAttribute("src", "/general.jpg");
    await user.click(radio(/^Đen/));
    expect(main()).toHaveAttribute("src", "/black-1.jpg");
    await user.click(radio(/^41/)); // no own photo: still the color's
    expect(main()).toHaveAttribute("src", "/black-1.jpg");
    await user.click(radio(/^42/)); // has its own photo
    expect(main()).toHaveAttribute("src", "/black-42-own.jpg");
  });

  it("shows a size guide with foot length for shoes", async () => {
    const user = userEvent.setup();
    render_(shoe);
    await user.click(screen.getByText(labels.sizeGuide.title));
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "42" })).toBeInTheDocument();
    expect(within(table).getByText("26.5")).toBeInTheDocument();
  });
});

describe("sold out", () => {
  it("disables the button when nothing is in stock", () => {
    render_({ ...noOptions, variants: [{ ...noOptions.variants[0], stock: 0 }] });
    expect(screen.getByRole("button", { name: labels.soldOutButton })).toBeDisabled();
    // "Hết hàng" is shown twice: in the stock line and on the disabled button.
    expect(screen.getAllByText(labels.soldOut)).toHaveLength(2);
  });

  it("disables a size whose variants are all sold out", () => {
    render_({
      ...shoe,
      variants: shoe.variants.map((v) => (v.id === "v1" ? { ...v, stock: 0 } : v)),
    });
    // 41 only exists in Black and is now sold out.
    expect(radio(/^41/)).toBeDisabled();
    expect(radio(/^41/)).toHaveAccessibleName(new RegExp(labels.optionSoldOut));
  });
});

describe("a product with a single color", () => {
  it("selects that color for the shopper", async () => {
    const user = userEvent.setup();
    render_({
      ...shoe,
      colors: [shoe.colors[0]],
      variants: shoe.variants.filter((v) => v.colorId === "c-blk"),
    });
    expect(radio(/^Đen/)).toBeChecked();
    await user.click(radio(/^41/));
    await user.click(screen.getByRole("button", { name: labels.addToCart }));
    expect(cart()).toEqual([{ variantId: "v1", quantity: 1 }]);
  });
});
