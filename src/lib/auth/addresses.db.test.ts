// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "../../test/db";
import { deleteAddress, listAddresses, saveAddress, setDefaultAddress } from "./addresses";
import { MAX_ADDRESSES } from "./schemas";

let an: string;
let binh: string;

const home = { recipientName: "Nguyễn An", phone: "0912 345 678", province: "TP. Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé", street: "12 Lê Lợi" };
const office = { ...home, recipientName: "An (công ty)", street: "99 Nguyễn Huệ" };

const saved = async (userId: string, raw: Record<string, unknown>, id?: string) => {
  const r = await saveAddress(testDb, userId, raw, id);
  if (!r.ok) throw new Error(`save failed: ${JSON.stringify(r.error)}`);
  return r.value;
};

beforeEach(async () => {
  await resetDb();
  an = (await testDb.user.create({ data: { email: "an@example.com" } })).id;
  binh = (await testDb.user.create({ data: { email: "binh@example.com" } })).id;
});

describe("saving addresses", () => {
  it("normalizes the phone and makes the first address the default", async () => {
    const first = await saved(an, home);
    expect(first).toMatchObject({ phone: "0912345678", isDefault: true, street: "12 Lê Lợi" });
    expect((await saved(an, office)).isDefault).toBe(false);
  });

  it("moves the default when another address is saved as the default", async () => {
    const a = await saved(an, home);
    const b = await saved(an, { ...office, isDefault: true });

    const list = await listAddresses(testDb, an);
    expect(list.map((x) => [x.id, x.isDefault])).toEqual([[b.id, true], [a.id, false]]); // default listed first
  });

  it("updates an address and can promote it to the default", async () => {
    const a = await saved(an, home);
    const b = await saved(an, office);
    const edited = await saved(an, { ...office, street: "100 Nguyễn Huệ", isDefault: true }, b.id);

    expect(edited).toMatchObject({ id: b.id, street: "100 Nguyễn Huệ", isDefault: true });
    expect((await listAddresses(testDb, an)).find((x) => x.id === a.id)?.isDefault).toBe(false);
  });

  it("reports field problems and saves nothing", async () => {
    const result = await saveAddress(testDb, an, { ...home, recipientName: "", phone: "123", street: "" });
    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_INPUT", fieldErrors: { recipientName: "required", phone: "invalid_phone", street: "required" } },
    });
    expect(await testDb.address.count()).toBe(0);
  });

  it("allows at most 10 addresses per user", async () => {
    for (let i = 0; i < MAX_ADDRESSES; i++) await saved(an, { ...home, street: `${i} Đường` });
    expect(await saveAddress(testDb, an, home)).toEqual({ ok: false, error: { code: "LIMIT_REACHED" } });
    expect((await saveAddress(testDb, binh, home)).ok).toBe(true); // the limit is per user
  });
});

describe("one user cannot touch another user's addresses", () => {
  it("lists only the user's own", async () => {
    await saved(an, home);
    await saved(binh, office);
    expect((await listAddresses(testDb, an)).map((a) => a.street)).toEqual(["12 Lê Lợi"]);
  });

  it("cannot edit, delete or make default someone else's address", async () => {
    const mine = await saved(an, home);

    expect(await saveAddress(testDb, binh, { ...office, street: "hacked" }, mine.id)).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await deleteAddress(testDb, binh, mine.id)).toBe(false);
    expect(await setDefaultAddress(testDb, binh, mine.id)).toBe(false);

    const row = await testDb.address.findUniqueOrThrow({ where: { id: mine.id } });
    expect([row.street, row.userId]).toEqual(["12 Lê Lợi", an]);
  });

  it("treats an unknown id like someone else's address", async () => {
    expect(await saveAddress(testDb, an, home, "nope")).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await deleteAddress(testDb, an, "nope")).toBe(false);
  });
});

describe("deleting and the default", () => {
  it("promotes the oldest remaining address when the default is deleted", async () => {
    const a = await saved(an, home);
    const b = await saved(an, office);
    const c = await saved(an, { ...office, street: "3 Đường C" });

    expect(await deleteAddress(testDb, an, a.id)).toBe(true);
    const list = await listAddresses(testDb, an);
    expect(list.map((x) => [x.id, x.isDefault])).toEqual([[b.id, true], [c.id, false]]);
  });

  it("keeps the default when another address is deleted, and allows deleting the last one", async () => {
    const a = await saved(an, home);
    const b = await saved(an, office);
    await deleteAddress(testDb, an, b.id);
    expect((await listAddresses(testDb, an))[0]).toMatchObject({ id: a.id, isDefault: true });

    expect(await deleteAddress(testDb, an, a.id)).toBe(true);
    expect(await listAddresses(testDb, an)).toEqual([]);
  });

  it("setDefaultAddress switches the default", async () => {
    const a = await saved(an, home);
    const b = await saved(an, office);
    expect(await setDefaultAddress(testDb, an, b.id)).toBe(true);
    expect((await listAddresses(testDb, an)).map((x) => [x.id, x.isDefault])).toEqual([[b.id, true], [a.id, false]]);
  });
});
