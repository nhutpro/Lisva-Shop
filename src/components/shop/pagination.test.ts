import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(2, 2)).toEqual([1, 2]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("keeps the first and last page and a window around the current one, with gaps", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });

  it("does not insert a gap for a single missing page", () => {
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageWindow(8, 10)).toEqual([1, null, 7, 8, 9, 10]);
  });
});
