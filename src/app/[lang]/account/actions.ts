"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getClientKey } from "@/lib/client-key";
import { hasLocale, localePath, defaultLocale, type Locale } from "@/i18n/config";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/auth/addresses";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { getCurrentUser, getSessionToken } from "@/lib/auth/current-user";
import type { FormState, FormValues } from "@/lib/auth/form-state";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { authenticate, changePassword, registerUser, updateProfile } from "@/lib/auth/service";
import { createSession, revokeSession } from "@/lib/auth/session";

// Thin server actions. Each one checks the session itself (never trusting the page that rendered it),
// calls a tested function from src/lib/auth, and returns plain data. They never log personal data.

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const localeOf = (formData: FormData): Locale => {
  const value = text(formData, "locale");
  return hasLocale(value) ? value : defaultLocale;
};

/** Values to put back in the form after an error. Passwords are never sent back. */
const valuesOf = (formData: FormData, names: string[]): FormValues =>
  Object.fromEntries(names.map((n) => [n, text(formData, n)]));

/** Starts a new session (a fresh token every time, so an old one cannot be reused) and sets the cookie. */
async function startSession(userId: string) {
  const store = await cookies();
  await revokeSession(db, store.get(SESSION_COOKIE)?.value);
  const { token, expires } = await createSession(db, userId);
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
}

export async function registerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData);
  const fields = ["name", "email", "phone"];
  const result = await registerUser(
    { db },
    { name: text(formData, "name"), email: text(formData, "email"), password: text(formData, "password"), phone: text(formData, "phone") },
    await getClientKey(),
  );
  if (!result.ok) return { status: "error", error: result.error, values: valuesOf(formData, fields) };

  await startSession(result.value.id);
  redirect(safeNextPath(text(formData, "next")) ?? localePath(locale, "/account"));
}

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData);
  const result = await authenticate({ db }, { email: text(formData, "email"), password: text(formData, "password") }, await getClientKey());
  if (!result.ok) return { status: "error", error: result.error, values: valuesOf(formData, ["email"]) };

  await startSession(result.value.id);
  redirect(safeNextPath(text(formData, "next")) ?? localePath(locale, "/account"));
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const store = await cookies();
  await revokeSession(db, store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  redirect(localePath(locale));
}

/** The signed-in user, or a redirect to the login page. */
async function actingUser(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(localePath(locale, "/login"));
  return user;
}

export async function updateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await actingUser(localeOf(formData));
  const result = await updateProfile(db, user.id, { name: text(formData, "name"), phone: text(formData, "phone") });
  if (!result.ok) return { status: "error", error: result.error, values: valuesOf(formData, ["name", "phone"]) };
  refresh(); // the greeting and the header show the new name
  return { status: "success", message: "profile_saved" };
}

export async function changePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await actingUser(localeOf(formData));
  const result = await changePassword(
    { db },
    user.id,
    {
      currentPassword: text(formData, "currentPassword"),
      newPassword: text(formData, "newPassword"),
      confirmPassword: text(formData, "confirmPassword"),
    },
    await getSessionToken(),
  );
  return result.ok ? { status: "success", message: "password_changed" } : { status: "error", error: result.error, values: {} };
}

const ADDRESS_FIELDS = ["recipientName", "phone", "province", "district", "ward", "street"];

export async function saveAddressAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await actingUser(localeOf(formData));
  const raw = {
    ...Object.fromEntries(ADDRESS_FIELDS.map((n) => [n, text(formData, n)])),
    isDefault: formData.get("isDefault") === "on",
  };
  const result = await saveAddress(db, user.id, raw, text(formData, "addressId") || undefined);
  if (!result.ok) return { status: "error", error: result.error, values: valuesOf(formData, [...ADDRESS_FIELDS, "addressId"]) };
  refresh(); // the list of addresses on the page changed
  return { status: "success", message: "address_saved" };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await actingUser(localeOf(formData));
  await deleteAddress(db, user.id, text(formData, "addressId"));
  redirect(localePath(localeOf(formData), "/account/addresses"));
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const user = await actingUser(localeOf(formData));
  await setDefaultAddress(db, user.id, text(formData, "addressId"));
  redirect(localePath(localeOf(formData), "/account/addresses"));
}
