import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Passwords are stored only as salted scrypt hashes: "scrypt$N$r$p$salt$hash" (base64).
// The cost parameters travel with the hash, so they can be raised later and old hashes still verify.

export type ScryptCost = { N: number; r: number; p: number };

/** OWASP's recommended scrypt setting with 32 MiB of memory: N=2^15, r=8, p=3. */
export const DEFAULT_COST: ScryptCost = { N: 2 ** 15, r: 8, p: 3 };

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// A stored hash is trusted, but never let a corrupted value make us allocate gigabytes.
const MAX_N = 2 ** 20;
const MAX_R = 16;
const MAX_P = 16;

const derive = (password: string, salt: Buffer, { N, r, p }: ScryptCost): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const options: ScryptOptions = { N, r, p, maxmem: 128 * N * r * 2 + 1024 * 1024 };
    // NFKC: the same Vietnamese password typed with a composed or a decomposed accent must match.
    scryptCallback(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export async function hashPassword(password: string, cost: ScryptCost = DEFAULT_COST): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, cost);
  return ["scrypt", cost.N, cost.r, cost.p, salt.toString("base64"), key.toString("base64")].join("$");
}

type Parsed = { cost: ScryptCost; salt: Buffer; key: Buffer };

function parse(stored: string): Parsed | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N < 2 || (N & (N - 1)) !== 0 || N > MAX_N || r < 1 || r > MAX_R || p < 1 || p > MAX_P) {
    return null;
  }
  const salt = Buffer.from(parts[4], "base64");
  const key = Buffer.from(parts[5], "base64");
  return salt.length > 0 && key.length === KEY_LENGTH ? { cost: { N, r, p }, salt, key } : null;
}

/** True when the password matches. A malformed stored hash never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const candidate = await derive(password, parsed.salt, parsed.cost);
  return timingSafeEqual(candidate, parsed.key);
}

/** True when a stored hash was made with weaker settings than `cost` (rehash it after a successful login). */
export function needsRehash(stored: string, cost: ScryptCost = DEFAULT_COST): boolean {
  const parsed = parse(stored);
  if (!parsed) return true;
  return parsed.cost.N < cost.N || parsed.cost.r < cost.r || parsed.cost.p < cost.p;
}

let dummyHash: Promise<string> | undefined;

/**
 * A hash of a throwaway password. Checking a login attempt for an unknown email against it takes
 * as long as checking a real account, so response time does not reveal which emails exist.
 */
export function getDummyHash(cost: ScryptCost = DEFAULT_COST): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"), cost);
  return dummyHash;
}
