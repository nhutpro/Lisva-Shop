import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { FormError, FormState } from "@/lib/auth/form-state";

type AuthDict = Dictionary["auth"];

/** The sentence for a failed form (not the per-field messages). */
export function formErrorText(error: FormError, auth: AuthDict): string {
  if (error.code === "RATE_LIMITED") {
    return format(auth.formError.RATE_LIMITED, { minutes: Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)) });
  }
  const messages = auth.formError as Record<string, string>;
  return messages[error.code] ?? auth.formError.UNKNOWN;
}

/** The translated message for one field, or undefined. */
export function fieldErrorText(state: FormState, name: string, auth: AuthDict): string | undefined {
  if (state.status !== "error") return undefined;
  const code = state.error.fieldErrors?.[name];
  return code ? auth.fieldErrors[code] : undefined;
}

/** Whether the top banner should say something besides "check the fields" (that message adds nothing per-field). */
export const showsBanner = (state: FormState): state is Extract<FormState, { status: "error" }> =>
  state.status === "error";
