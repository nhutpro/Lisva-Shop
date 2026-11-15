import type { ImgHTMLAttributes } from "react";

// Stand-in for next/image in component tests: a plain <img> without the Next-only props.
// Use it with: vi.mock("next/image", () => import("@/test/next-image-mock"));
export default function NextImageMock({
  fill,
  priority,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) {
  void fill;
  void priority;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt ?? ""} />;
}
