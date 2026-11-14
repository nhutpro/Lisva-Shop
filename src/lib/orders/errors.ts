export type OrderErrorCode =
  | "VARIANT_NOT_FOUND"
  | "VARIANT_UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "ORDER_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "CODE_GENERATION_FAILED";

/** Expected business errors. The UI maps `code` to a translated message. */
export class OrderError extends Error {
  constructor(
    readonly code: OrderErrorCode,
    readonly detail?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "OrderError";
  }
}
