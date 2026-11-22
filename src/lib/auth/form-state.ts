// Plain types shared by the account server actions and the forms (no server imports here).
import type { FieldErrorCode } from "../validation";

export type FormValues = Record<string, string>;

export type FormError = {
  code: string;
  fieldErrors?: Record<string, FieldErrorCode>;
  retryAfterSeconds?: number;
};

/** What a form shows between submits. `values` brings back what was typed, `message` is a translated key suffix. */
export type FormState =
  | { status: "idle"; values?: FormValues }
  | { status: "error"; error: FormError; values: FormValues }
  | { status: "success"; message: "profile_saved" | "password_changed" | "address_saved" | "address_deleted" };

export const idleState: FormState = { status: "idle" };
