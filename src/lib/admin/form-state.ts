// Plain types shared by the admin server actions and the admin forms (no server imports here).
import type { Issue } from "./errors";

export type AdminFormState =
  | { status: "idle" }
  | {
      status: "error";
      /** A stable code the page turns into text (an AdminErrorCode or an order/payment problem). */
      code: string;
      issues?: Issue[];
      /** Which item caused it (for example the variant that is out of stock), and how many things use a record. */
      variantId?: string;
      usedBy?: number;
    }
  | { status: "success"; message: AdminSuccess };

export type AdminSuccess =
  | "status_changed"
  | "shipping_saved"
  | "payment_saved"
  | "note_added"
  | "saved"
  | "deleted";

export const adminIdle: AdminFormState = { status: "idle" };
