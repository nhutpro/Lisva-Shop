const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const date = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** 1250000 -> "1.250.000 ₫" (same in every UI language). */
export function formatVnd(amount: number): string {
  return vnd.format(amount);
}

/** dd/MM/yyyy in Vietnam time. */
export function formatDate(value: Date | string | number): string {
  return date.format(new Date(value));
}
