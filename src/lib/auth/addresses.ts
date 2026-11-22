import type { PrismaClient } from "@prisma/client";
import { zodFieldErrors, type FieldErrors } from "../validation";
import { ADDRESS_FIELDS, MAX_ADDRESSES, addressSchema } from "./schemas";

// Every function takes the signed-in user's id and only ever touches that user's addresses.

export type AddressData = {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
};

type AddressField = (typeof ADDRESS_FIELDS)[number];

export type AddressResult =
  | { ok: true; value: AddressData }
  | { ok: false; error: { code: "INVALID_INPUT"; fieldErrors: FieldErrors<AddressField> } | { code: "NOT_FOUND" | "LIMIT_REACHED" } };

const select = { id: true, recipientName: true, phone: true, province: true, district: true, ward: true, street: true, isDefault: true } as const;

/** Default address first, then oldest first. */
export const listAddresses = (db: PrismaClient, userId: string): Promise<AddressData[]> =>
  db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select });

/** Creates an address, or updates one of the user's own when `addressId` is given. */
export async function saveAddress(
  db: PrismaClient,
  userId: string,
  raw: Record<string, unknown>,
  addressId?: string,
): Promise<AddressResult> {
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", fieldErrors: zodFieldErrors(parsed.error, raw, ADDRESS_FIELDS) } };
  }
  const { isDefault, ...fields } = parsed.data;

  return db.$transaction(async (tx) => {
    const existing = await tx.address.count({ where: { userId } });
    if (addressId) {
      const own = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
      if (!own) return { ok: false, error: { code: "NOT_FOUND" } } as const;
    } else if (existing >= MAX_ADDRESSES) {
      return { ok: false, error: { code: "LIMIT_REACHED" } } as const;
    }

    // The first address is always the default.
    const makeDefault = isDefault || (!addressId && existing === 0);
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });

    const value = addressId
      ? await tx.address.update({ where: { id: addressId }, data: { ...fields, ...(makeDefault ? { isDefault: true } : {}) }, select })
      : await tx.address.create({ data: { ...fields, userId, isDefault: makeDefault }, select });
    return { ok: true, value } as const;
  });
}

/** Deletes one of the user's addresses. If it was the default, the oldest remaining one becomes the default. */
export async function deleteAddress(db: PrismaClient, userId: string, addressId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId }, select: { isDefault: true } });
    if (!address) return false;
    await tx.address.delete({ where: { id: addressId } });
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return true;
  });
}

export async function setDefaultAddress(db: PrismaClient, userId: string, addressId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const own = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
    if (!own) return false;
    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    await tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
    return true;
  });
}
