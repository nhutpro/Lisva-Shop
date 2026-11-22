"use server";

import { Prisma } from "@prisma/client";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultLocale, hasLocale, localePath } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getTranslator } from "@/lib/translate/deepl";
import type { AdminResult } from "@/lib/admin/errors";
import type { AdminFormState } from "@/lib/admin/form-state";
import { deleteProduct, saveProduct } from "@/lib/admin/products";
import {
  deleteBrand,
  deleteCategory,
  deleteSize,
  saveBrand,
  saveCategory,
  saveSize,
} from "@/lib/admin/reference-data";
import { OrderError } from "@/lib/orders/errors";
import {
  addOrderNote,
  changeOrderStatus,
  recordPayment,
  setShippingFee,
} from "@/lib/orders/manage-order";

// Every action starts with requireAdmin(): the page that showed the button is never trusted.
// Mutations then call a tested function from src/lib/admin or src/lib/orders, refresh the admin page, and
// invalidate the shop's cached catalog (tag "products") when products or stock may have changed.

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};
const fields = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  );

/** The order does not exist (any other database problem must not be hidden behind "not found"). */
const isMissingRecord = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2025" || error.code === "P2003");

const fromResult = (
  result: AdminResult<unknown>,
  message: "saved" | "deleted",
): AdminFormState =>
  result.ok
    ? { status: "success", message }
    : {
        status: "error",
        code: result.error.code,
        issues: result.error.issues,
        usedBy: result.error.usedBy,
      };

// ---------- Orders ----------

const orderStatus = z.enum([
  "PENDING_CONTACT",
  "CONTACTED",
  "CONFIRMED",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED",
]);

export async function changeStatusAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const to = orderStatus.safeParse(text(formData, "to"));
  if (!to.success) return { status: "error", code: "INVALID_INPUT" };

  try {
    await changeOrderStatus(db, text(formData, "orderId"), to.data, admin.id);
  } catch (error) {
    if (error instanceof OrderError) {
      const variantId =
        typeof error.detail?.variantId === "string"
          ? error.detail.variantId
          : undefined;
      return { status: "error", code: error.code, variantId };
    }
    throw error;
  }
  updateTag("products"); // confirming or cancelling changes stock
  refresh();
  return { status: "success", message: "status_changed" };
}

export async function shippingFeeAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const raw = text(formData, "shippingFee").replace(/[\s.,]/g, "");
  const fee = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(fee))
    return {
      status: "error",
      code: "INVALID_INPUT",
      issues: [
        { path: "shippingFee", code: raw === "" ? "required" : "invalid" },
      ],
    };

  try {
    await setShippingFee(db, text(formData, "orderId"), fee);
  } catch (error) {
    if (error instanceof OrderError)
      return { status: "error", code: error.code };
    throw error;
  }
  refresh();
  return { status: "success", message: "shipping_saved" };
}

const paymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["COD", "BANK_TRANSFER", "OTHER"]),
  note: z.string().trim().max(300).optional(),
});

export async function paymentAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse({
    ...fields(formData),
    note: text(formData, "note") || undefined,
  });
  if (!parsed.success) return { status: "error", code: "INVALID_INPUT" };
  try {
    await recordPayment(db, parsed.data.orderId, {
      method: parsed.data.method,
      note: parsed.data.note,
    });
  } catch (error) {
    if (error instanceof OrderError)
      return { status: "error", code: error.code };
    throw error;
  }
  refresh();
  return { status: "success", message: "payment_saved" };
}

export async function addNoteAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const body = text(formData, "body").trim();
  if (body.length === 0 || body.length > 1000) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      issues: [{ path: "body", code: body ? "too_long" : "required" }],
    };
  }
  try {
    await addOrderNote(db, text(formData, "orderId"), body, admin.id);
  } catch (error) {
    if (isMissingRecord(error)) return { status: "error", code: "NOT_FOUND" };
    throw error;
  }
  refresh();
  return { status: "success", message: "note_added" };
}

// ---------- Products ----------

/** The editor sends the whole product as one object. */
export async function saveProductAction(
  input: unknown,
): Promise<AdminResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const result = await saveProduct(db, input, getTranslator());
  if (result.ok) {
    updateTag("products");
    refresh();
  }
  return result;
}

export async function deleteProductAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await deleteProduct(db, text(formData, "id"));
  if (result.ok) {
    updateTag("products");
    // Go to the list from here: re-rendering this product's own page would show "not found" first.
    const locale = text(formData, "locale");
    redirect(
      localePath(hasLocale(locale) ? locale : defaultLocale, "/admin/products"),
    );
  }
  return fromResult(result, "deleted");
}

// ---------- Brands, categories, sizes ----------

export async function saveBrandAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await saveBrand(
    db,
    fields(formData),
    text(formData, "id") || undefined,
  );
  if (result.ok) {
    updateTag("products");
    refresh();
  }
  return fromResult(result, "saved");
}

export async function deleteBrandAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await deleteBrand(db, text(formData, "id"));
  if (result.ok) {
    updateTag("products");
    refresh();
  }
  return fromResult(result, "deleted");
}

export async function saveCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await saveCategory(
    db,
    fields(formData),
    text(formData, "id") || undefined,
    getTranslator(),
  );
  if (result.ok) {
    updateTag("categories");
    updateTag("products");
    refresh();
  }
  return fromResult(result, "saved");
}

export async function deleteCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await deleteCategory(db, text(formData, "id"));
  if (result.ok) {
    updateTag("categories");
    updateTag("products");
    refresh();
  }
  return fromResult(result, "deleted");
}

export async function saveSizeAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await saveSize(
    db,
    fields(formData),
    text(formData, "id") || undefined,
  );
  if (result.ok) {
    updateTag("products");
    refresh();
  }
  return fromResult(result, "saved");
}

export async function deleteSizeAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const result = await deleteSize(db, text(formData, "id"));
  if (result.ok) {
    updateTag("products");
    refresh();
  }
  return fromResult(result, "deleted");
}
