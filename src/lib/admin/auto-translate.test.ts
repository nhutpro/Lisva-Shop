import { describe, expect, it, vi } from "vitest";
import type { Translator } from "../translate/types";
import { fillCategoryEnglish, fillEnglish } from "./auto-translate";

const fake = () =>
  vi.fn<Translator>(async (texts) => texts.map((t) => `EN(${t})`));

const raw = () => ({
  nameVi: "Đồng hồ thể thao",
  nameEn: "",
  descriptionVi: "Chống nước 50m",
  descriptionEn: "  ",
  specs: [
    { labelVi: "Chất liệu", labelEn: "", valueVi: "Thép", valueEn: "Steel" },
  ],
  colors: [{ key: "k", nameVi: "Đen", nameEn: "" }],
  images: [
    { url: "/a.png", altVi: "Mặt đồng hồ", altEn: "" },
    { url: "/b.png", altVi: "", altEn: "" },
  ],
  price: 1,
});

describe("fillEnglish", () => {
  it("translates only empty English next to Vietnamese text, in one call", async () => {
    const translate = fake();
    const result = (await fillEnglish(raw(), translate)) as ReturnType<
      typeof raw
    >;
    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0]).toEqual([
      "Đồng hồ thể thao",
      "Chống nước 50m",
      "Chất liệu",
      "Đen",
      "Mặt đồng hồ",
    ]);
    expect(result.nameEn).toBe("EN(Đồng hồ thể thao)");
    expect(result.descriptionEn).toBe("EN(Chống nước 50m)");
    expect(result.specs[0]).toMatchObject({
      labelEn: "EN(Chất liệu)",
      valueEn: "Steel",
    });
    expect(result.colors[0].nameEn).toBe("EN(Đen)");
    expect(result.images[0].altEn).toBe("EN(Mặt đồng hồ)");
    expect(result.images[1].altEn).toBe(""); // no Vietnamese alt, nothing to translate
    expect(result.price).toBe(1);
  });

  it("never changes English the owner typed and makes no call when nothing is missing", async () => {
    const translate = fake();
    const done = {
      ...raw(),
      nameEn: "Sports watch",
      descriptionEn: "Water resistant",
      specs: [],
      colors: [],
      images: [],
    };
    expect(await fillEnglish(done, translate)).toBe(done);
    expect(translate).not.toHaveBeenCalled();
  });

  it("returns the input untouched without a translator, on failure, on a wrong count, or for non-objects", async () => {
    const input = raw();
    expect(await fillEnglish(input)).toBe(input);
    expect(await fillEnglish(input, async () => null)).toBe(input);
    expect(await fillEnglish(input, async () => ["one"])).toBe(input);
    expect(
      await fillEnglish(input, async () => {
        throw new Error("boom");
      }),
    ).toBe(input);
    expect(await fillEnglish("text", fake())).toBe("text");
    expect(await fillEnglish(null, fake())).toBeNull();
    expect(
      await fillEnglish(
        { specs: "nope", colors: [null, 3], images: {} },
        fake(),
      ),
    ).toEqual({ specs: "nope", colors: [null, 3], images: {} });
  });

  it("does not mutate the input", async () => {
    const input = raw();
    await fillEnglish(input, fake());
    expect(input.nameEn).toBe("");
  });
});

describe("fillCategoryEnglish", () => {
  it("fills an empty English name, keeps a typed one", async () => {
    expect(
      await fillCategoryEnglish({ nameVi: "Giày", nameEn: "" }, fake()),
    ).toMatchObject({ nameEn: "EN(Giày)" });
    const typed = { nameVi: "Giày", nameEn: "Shoes" };
    expect(await fillCategoryEnglish(typed, fake())).toBe(typed);
    const none = { nameVi: "Giày" };
    expect(await fillCategoryEnglish(none)).toBe(none);
    expect(await fillCategoryEnglish(none, async () => null)).toBe(none);
  });
});
