"use client";

import { useActionState } from "react";
import { addNoteAction, changeStatusAction, paymentAction, shippingFeeAction } from "@/app/[lang]/admin/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminIdle, type AdminFormState } from "@/lib/admin/form-state";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, SelectField, TextField, button, ghostButton } from "./admin-ui";

type OrderStatus = "PENDING_CONTACT" | "CONTACTED" | "CONFIRMED" | "SHIPPING" | "COMPLETED" | "CANCELLED";

export type OrderActionsData = {
  id: string;
  status: OrderStatus;
  nextStatuses: OrderStatus[];
  shippingFee: number | null;
  paymentStatus: "UNPAID" | "PAID";
  paymentMethod: "COD" | "BANK_TRANSFER" | "OTHER" | null;
  paidAt: string | null;
  paymentNote: string | null;
  items: { variantId: string | null; productName: string }[];
};

type Props = { order: OrderActionsData; dict: Dictionary };

/** Shows the outcome of the last action: an error in words, or a short confirmation. */
function Result({ state, dict, items = [] }: { state: AdminFormState; dict: Dictionary; items?: OrderActionsData["items"] }) {
  const t = dict.admin.order;
  if (state.status === "error") {
    const name = items.find((i) => i.variantId === state.variantId)?.productName ?? "";
    const messages = t.errors as Record<string, string>;
    const text = state.code === "OUT_OF_STOCK" ? format(t.errors.OUT_OF_STOCK, { name }) : (messages[state.code] ?? t.errors.UNKNOWN);
    return (
      <p role="alert" className="mt-3 rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {text}
      </p>
    );
  }
  if (state.status === "success") {
    const messages = t.success as Record<string, string>;
    return (
      <p role="status" className="mt-3 text-sm text-green-800">
        {messages[state.message] ?? dict.admin.common.saved}
      </p>
    );
  }
  return null;
}

function StatusCard({ order, dict }: Props) {
  const t = dict.admin.order;
  const [state, action, pending] = useActionState(changeStatusAction, adminIdle);
  const [primary, ...others] = order.nextStatuses.filter((s) => s !== "CANCELLED");
  const canCancel = order.nextStatuses.includes("CANCELLED");

  return (
    <Card title={t.moveTo} id="status-card">
      {order.nextStatuses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noNext}</p>
      ) : (
        <form action={action} aria-busy={pending} className="flex flex-wrap gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          {primary && (
            <button type="submit" name="to" value={primary} disabled={pending} className={button}>
              {dict.admin.statusActions[primary]}
            </button>
          )}
          {others.map((s) => (
            <button key={s} type="submit" name="to" value={s} disabled={pending} className={ghostButton}>
              {dict.admin.statusActions[s]}
            </button>
          ))}
          {canCancel && (
            <ConfirmButton
              name="to"
              value="CANCELLED"
              disabled={pending}
              label={dict.admin.statusActions.CANCELLED}
              confirmLabel={t.cancelAsk}
              className={cn(ghostButton, "text-destructive")}
            />
          )}
        </form>
      )}
      <Result state={state} dict={dict} items={order.items} />
    </Card>
  );
}

function ShippingCard({ order, dict }: Props) {
  const t = dict.admin.order;
  const [state, action, pending] = useActionState(shippingFeeAction, adminIdle);
  const error = state.status === "error" ? (state.issues?.[0] ? dict.admin.editor.issues[state.issues[0].code as keyof typeof dict.admin.editor.issues] : undefined) : undefined;

  return (
    <Card title={t.shippingTitle} id="shipping-card">
      <form action={action} aria-busy={pending} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="orderId" value={order.id} />
        <div className="min-w-40 flex-1">
          <TextField id="shippingFee" name="shippingFee" inputMode="numeric" label={t.shippingTitle} defaultValue={order.shippingFee ?? ""} error={error} maxLength={12} />
        </div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? dict.admin.common.saving : t.shippingSave}
        </button>
      </form>
      <Result state={state} dict={dict} />
    </Card>
  );
}

function PaymentCard({ order, dict }: Props) {
  const t = dict.admin.order;
  const [state, action, pending] = useActionState(paymentAction, adminIdle);

  return (
    <Card title={t.paymentTitle} id="payment-card">
      {order.paymentStatus === "PAID" ? (
        <div className="text-sm">
          <p className="font-medium text-green-800">{dict.paymentStatus.PAID}</p>
          {order.paymentMethod && <p className="mt-1 text-muted-foreground">{t.methods[order.paymentMethod]}</p>}
          {order.paidAt && <p className="text-muted-foreground">{format(t.paidOn, { date: formatDate(order.paidAt) })}</p>}
          {order.paymentNote && <p className="mt-1">{order.paymentNote}</p>}
        </div>
      ) : (
        <form action={action} aria-busy={pending} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.unpaid}</p>
          <input type="hidden" name="orderId" value={order.id} />
          <SelectField id="payment-method" name="method" label={t.method} defaultValue="BANK_TRANSFER">
            {(["BANK_TRANSFER", "COD", "OTHER"] as const).map((m) => (
              <option key={m} value={m}>
                {t.methods[m]}
              </option>
            ))}
          </SelectField>
          <TextField id="payment-note" name="note" label={t.paymentNote} maxLength={300} />
          <button type="submit" disabled={pending} className={button}>
            {pending ? dict.admin.common.saving : t.paymentSave}
          </button>
        </form>
      )}
      <Result state={state} dict={dict} />
    </Card>
  );
}

function NoteCard({ order, dict }: Props) {
  const t = dict.admin.order;
  const [state, action, pending] = useActionState(addNoteAction, adminIdle);
  const error = state.status === "error" && state.issues?.[0] ? dict.admin.editor.issues[state.issues[0].code as keyof typeof dict.admin.editor.issues] : undefined;

  return (
    <form action={action} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="orderId" value={order.id} />
      <TextField id="note-body" name="body" multiline label={t.notesTitle} hint={t.notesHint} placeholder={t.notePlaceholder} maxLength={1000} error={error} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? dict.admin.common.saving : t.noteAdd}
      </button>
      <Result state={state} dict={dict} />
    </form>
  );
}

/** The things the owner can do with an order. Each form is separate, so one problem never blocks the others. */
export function OrderActions({ order, dict }: Props) {
  return (
    <div className="space-y-6">
      <StatusCard order={order} dict={dict} />
      <ShippingCard order={order} dict={dict} />
      <PaymentCard order={order} dict={dict} />
      <Card>
        <NoteCard order={order} dict={dict} />
      </Card>
    </div>
  );
}
