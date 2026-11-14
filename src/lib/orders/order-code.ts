import { randomInt } from "node:crypto";

// No 0/O/1/I so codes are easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** "LV-2611-7KQ2": year+month in Vietnam time, then 4 random characters. */
export function generateOrderCode(
  now: Date = new Date(),
  rand: (max: number) => number = randomInt,
): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yy = String(vn.getUTCFullYear()).slice(-2);
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ALPHABET[rand(ALPHABET.length)];
  return `LV-${yy}${mm}-${suffix}`;
}
