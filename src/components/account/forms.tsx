"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import {
  changePasswordAction,
  loginAction,
  registerAction,
  saveAddressAction,
  updateProfileAction,
} from "@/app/[lang]/account/actions";
import { primaryButton } from "@/components/cart/cart-parts";
import { CheckoutField } from "@/components/cart/checkout-field";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { idleState, type FormState } from "@/lib/auth/form-state";
import { cn } from "@/lib/utils";
import { fieldErrorText, formErrorText, showsBanner } from "./form-helpers";

type Auth = Dictionary["auth"];
type Common = { locale: Locale; auth: Auth };

/** Wraps a form: shows the problem banner (and moves focus to it), a success message, and a pending state. */
function FormFrame({
  state,
  pending,
  auth,
  successText,
  children,
}: {
  state: FormState;
  pending: boolean;
  auth: Auth;
  successText?: string;
  children: ReactNode;
}) {
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") bannerRef.current?.focus();
  }, [state]);

  return (
    <div aria-busy={pending}>
      {showsBanner(state) && (
        <div ref={bannerRef} tabIndex={-1} role="alert" className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 outline-none">
          <p className="font-medium text-destructive">{auth.formError.title}</p>
          <p className="mt-1 text-sm">{formErrorText(state.error, auth)}</p>
        </div>
      )}
      {state.status === "success" && successText && (
        <p role="status" className="mb-5 rounded-md border border-green-600/30 bg-green-600/5 p-4 text-sm text-green-800">
          {successText}
        </p>
      )}
      {children}
    </div>
  );
}

const submitClass = cn(primaryButton, "h-12 w-full sm:w-auto sm:min-w-56");

export function LoginForm({ locale, auth, next }: Common & { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, idleState);
  const t = auth.login;
  const email = state.status === "error" ? state.values.email : "";

  return (
    <FormFrame state={state} pending={pending} auth={auth}>
      <form action={action} noValidate className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        <CheckoutField id="email" name="email" type="email" label={t.email} defaultValue={email} autoComplete="email" required error={fieldErrorText(state, "email", auth)} />
        <CheckoutField id="password" name="password" type="password" label={t.password} autoComplete="current-password" required error={fieldErrorText(state, "password", auth)} />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.submitting : t.submit}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t.noAccount}{" "}
        <Link href={`${localePath(locale, "/register")}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground underline underline-offset-4">
          {t.registerLink}
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{t.guestNote}</p>
    </FormFrame>
  );
}

export function RegisterForm({ locale, auth, next }: Common & { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, idleState);
  const t = auth.register;
  const v = state.status === "error" ? state.values : {};

  return (
    <FormFrame state={state} pending={pending} auth={auth}>
      <form action={action} noValidate className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        <CheckoutField id="name" name="name" label={t.name} defaultValue={v.name} autoComplete="name" maxLength={100} required error={fieldErrorText(state, "name", auth)} />
        <CheckoutField id="email" name="email" type="email" label={t.email} defaultValue={v.email} autoComplete="email" maxLength={200} required error={fieldErrorText(state, "email", auth)} />
        <div>
          <CheckoutField id="password" name="password" type="password" label={t.password} autoComplete="new-password" maxLength={128} required error={fieldErrorText(state, "password", auth)} />
          <p className="mt-1.5 text-sm text-muted-foreground">{t.passwordHint}</p>
        </div>
        <CheckoutField id="phone" name="phone" type="tel" inputMode="tel" label={t.phone} optionalLabel={t.optional} defaultValue={v.phone} autoComplete="tel" maxLength={20} error={fieldErrorText(state, "phone", auth)} />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.submitting : t.submit}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t.haveAccount}{" "}
        <Link href={`${localePath(locale, "/login")}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground underline underline-offset-4">
          {t.loginLink}
        </Link>
      </p>
    </FormFrame>
  );
}

export function ProfileForm({ locale, auth, user }: Common & { user: { email: string; name: string | null; phone: string | null } }) {
  const [state, action, pending] = useActionState(updateProfileAction, idleState);
  const t = auth.account;
  const v = state.status === "error" ? state.values : { name: user.name ?? "", phone: user.phone ?? "" };

  return (
    <FormFrame state={state} pending={pending} auth={auth} successText={state.status === "success" ? t.profile_saved : undefined}>
      <form action={action} noValidate className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium">{t.email}</label>
          <input id="profile-email" value={user.email} readOnly aria-describedby="profile-email-note" className="h-12 w-full rounded-sm border border-border bg-secondary px-4 text-base text-muted-foreground" />
          <p id="profile-email-note" className="mt-1.5 text-sm text-muted-foreground">{t.emailNote}</p>
        </div>
        <CheckoutField id="profile-name" name="name" label={t.name} defaultValue={v.name} autoComplete="name" maxLength={100} required error={fieldErrorText(state, "name", auth)} />
        <CheckoutField id="profile-phone" name="phone" type="tel" inputMode="tel" label={t.phone} defaultValue={v.phone} autoComplete="tel" maxLength={20} error={fieldErrorText(state, "phone", auth)} />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.saving : t.save}
        </button>
      </form>
    </FormFrame>
  );
}

export function PasswordForm({ locale, auth }: Common) {
  const [state, action, pending] = useActionState(changePasswordAction, idleState);
  const t = auth.account;

  return (
    <FormFrame state={state} pending={pending} auth={auth} successText={state.status === "success" ? t.password_changed : undefined}>
      <form action={action} noValidate className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <CheckoutField id="currentPassword" name="currentPassword" type="password" label={t.currentPassword} autoComplete="current-password" maxLength={128} required error={fieldErrorText(state, "currentPassword", auth)} />
        <CheckoutField id="newPassword" name="newPassword" type="password" label={t.newPassword} autoComplete="new-password" maxLength={128} required error={fieldErrorText(state, "newPassword", auth)} />
        <CheckoutField id="confirmPassword" name="confirmPassword" type="password" label={t.confirmPassword} autoComplete="new-password" maxLength={128} required error={fieldErrorText(state, "confirmPassword", auth)} />
        <p className="text-sm text-muted-foreground">{t.passwordHint}</p>
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.saving : t.passwordSubmit}
        </button>
      </form>
    </FormFrame>
  );
}

export type EditableAddress = {
  id?: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
};

export function AddressForm({ locale, auth, address, cancelHref }: Common & { address: EditableAddress; cancelHref: string }) {
  const [state, action, pending] = useActionState(saveAddressAction, idleState);
  const router = useRouter();
  const t = auth.addresses;
  // After saving, close the form and show the updated list.
  useEffect(() => {
    if (state.status === "success") router.replace(cancelHref);
  }, [state, router, cancelHref]);
  const initial: Record<string, string> = {
    recipientName: address.recipientName,
    phone: address.phone,
    province: address.province,
    district: address.district,
    ward: address.ward,
    street: address.street,
  };
  const v: Record<string, string> = state.status === "error" ? state.values : initial;
  const err = (name: string) => fieldErrorText(state, name, auth);

  return (
    <FormFrame state={state} pending={pending} auth={auth} successText={state.status === "success" ? t.address_saved : undefined}>
      <form action={action} noValidate className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {address.id && <input type="hidden" name="addressId" value={address.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckoutField id="recipientName" name="recipientName" label={t.recipientName} defaultValue={v.recipientName} autoComplete="name" maxLength={100} required error={err("recipientName")} />
          <CheckoutField id="address-phone" name="phone" type="tel" inputMode="tel" label={t.phone} defaultValue={v.phone} autoComplete="tel" maxLength={20} required error={err("phone")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <CheckoutField id="province" name="province" label={t.province} defaultValue={v.province} autoComplete="address-level1" maxLength={100} required error={err("province")} />
          <CheckoutField id="district" name="district" label={t.district} defaultValue={v.district} autoComplete="address-level2" maxLength={100} required error={err("district")} />
          <CheckoutField id="ward" name="ward" label={t.ward} defaultValue={v.ward} maxLength={100} required error={err("ward")} />
        </div>
        <CheckoutField id="street" name="street" label={t.street} defaultValue={v.street} autoComplete="street-address" maxLength={200} required error={err("street")} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" name="isDefault" defaultChecked={address.isDefault} className="size-4 accent-gold" />
          {t.isDefault}
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={submitClass}>
            {pending ? t.saving : t.save}
          </button>
          <Link href={cancelHref} className="inline-flex h-12 items-center rounded-full border border-border px-6 text-sm hover:border-primary">
            {t.cancel}
          </Link>
        </div>
      </form>
    </FormFrame>
  );
}
