"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  deleteBrandAction,
  deleteCategoryAction,
  deleteSizeAction,
  saveBrandAction,
  saveCategoryAction,
  saveSizeAction,
} from "@/app/[lang]/admin/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminIdle, type AdminFormState } from "@/lib/admin/form-state";
import type { BrandRow, CategoryRow, SizeRow } from "@/lib/admin/reference-data";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { SelectField, TextField, button, ghostButton, issueFor, issueText } from "./admin-ui";

type Common = { dict: Dictionary; backHref: string };

function useDone(state: AdminFormState, backHref: string) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.replace(backHref);
  }, [state, router, backHref]);
}

function Banner({ state, dict }: { state: AdminFormState; dict: Dictionary }) {
  if (state.status !== "error") return null;
  const messages = dict.admin.catalog.errors as Record<string, string>;
  const text = state.code === "IN_USE" ? format(dict.admin.catalog.errors.IN_USE, { count: state.usedBy ?? 0 }) : (messages[state.code] ?? messages.UNKNOWN);
  return (
    <p role="alert" className="mb-4 rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {text}
    </p>
  );
}

const problem = (state: AdminFormState, path: string, dict: Dictionary) =>
  state.status === "error" ? issueText(issueFor(state.issues, path), dict.admin.editor.issues) : undefined;

function Actions({ pending, dict, backHref }: { pending: boolean; dict: Dictionary; backHref: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={pending} className={button}>
        {pending ? dict.admin.common.saving : dict.admin.common.save}
      </button>
      <Link href={backHref} className={ghostButton}>
        {dict.admin.common.cancel}
      </Link>
    </div>
  );
}

export function BrandForm({ dict, backHref, brand }: Common & { brand?: BrandRow }) {
  const [state, action, pending] = useActionState(saveBrandAction, adminIdle);
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [touched, setTouched] = useState(Boolean(brand));
  const t = dict.admin.catalog;
  useDone(state, backHref);

  return (
    <form action={action} noValidate aria-busy={pending} className="space-y-4">
      <Banner state={state} dict={dict} />
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <TextField id="brand-name" name="name" label={t.name} value={name} maxLength={60} error={problem(state, "name", dict)}
        onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
      <TextField id="brand-slug" name="slug" label={t.slug} value={slug} maxLength={80} error={problem(state, "slug", dict)}
        onChange={(e) => { setTouched(true); setSlug(e.target.value); }} />
      <TextField id="brand-prefix" name="skuPrefix" label={t.skuPrefix} hint={t.skuPrefixHint} defaultValue={brand?.skuPrefix} maxLength={8} error={problem(state, "skuPrefix", dict)} />
      <Actions pending={pending} dict={dict} backHref={backHref} />
    </form>
  );
}

export function CategoryForm({ dict, backHref, category, categories }: Common & { category?: CategoryRow; categories: CategoryRow[] }) {
  const [state, action, pending] = useActionState(saveCategoryAction, adminIdle);
  const [nameVi, setNameVi] = useState(category?.nameVi ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [touched, setTouched] = useState(Boolean(category));
  const t = dict.admin.catalog;
  useDone(state, backHref);
  // Only a main category can be a parent, and a category that has sub-categories cannot move under another.
  const parents = categories.filter((c) => !c.parentId && c.id !== category?.id);
  const canHaveParent = !category || category.childCount === 0;

  return (
    <form action={action} noValidate aria-busy={pending} className="space-y-4">
      <Banner state={state} dict={dict} />
      {category && <input type="hidden" name="id" value={category.id} />}
      <TextField id="cat-nameVi" name="nameVi" label={t.nameVi} value={nameVi} maxLength={80} error={problem(state, "nameVi", dict)}
        onChange={(e) => { setNameVi(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
      <TextField id="cat-nameEn" name="nameEn" label={t.nameEn} defaultValue={category?.nameEn ?? ""} maxLength={80} error={problem(state, "nameEn", dict)} />
      <TextField id="cat-slug" name="slug" label={t.slug} value={slug} maxLength={80} error={problem(state, "slug", dict)}
        onChange={(e) => { setTouched(true); setSlug(e.target.value); }} />
      {canHaveParent && (
        <SelectField id="cat-parent" name="parentId" label={t.parent} defaultValue={category?.parentId ?? ""} error={problem(state, "parentId", dict)}>
          <option value="">{t.noParent}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.nameVi}</option>
          ))}
        </SelectField>
      )}
      <TextField id="cat-position" name="position" inputMode="numeric" label={t.position} defaultValue={category?.position ?? 0} maxLength={5} error={problem(state, "position", dict)} />
      <Actions pending={pending} dict={dict} backHref={backHref} />
    </form>
  );
}

export function SizeForm({ dict, backHref, size }: Common & { size?: SizeRow }) {
  const [state, action, pending] = useActionState(saveSizeAction, adminIdle);
  const t = dict.admin.catalog;
  useDone(state, backHref);

  return (
    <form action={action} noValidate aria-busy={pending} className="space-y-4">
      <Banner state={state} dict={dict} />
      {size && <input type="hidden" name="id" value={size.id} />}
      <SelectField id="size-type" name="type" label={t.type} defaultValue={size?.type ?? "SHOE"} error={problem(state, "type", dict)}>
        <option value="SHOE">{t.types.SHOE}</option>
        <option value="WATCH">{t.types.WATCH}</option>
      </SelectField>
      <TextField id="size-label" name="label" label={t.label} defaultValue={size?.label} maxLength={12} error={problem(state, "label", dict)} />
      <TextField id="size-position" name="position" inputMode="numeric" label={t.position} defaultValue={size?.position ?? 0} maxLength={5} error={problem(state, "position", dict)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="size-foot" name="footLengthCm" inputMode="decimal" label={`${t.footLength} ${dict.admin.common.optional}`} defaultValue={size?.footLengthCm ?? ""} maxLength={5} error={problem(state, "footLengthCm", dict)} />
        <TextField id="size-us" name="usSize" label={`${t.usSize} ${dict.admin.common.optional}`} defaultValue={size?.usSize ?? ""} maxLength={8} error={problem(state, "usSize", dict)} />
      </div>
      <Actions pending={pending} dict={dict} backHref={backHref} />
    </form>
  );
}

const deleteActions = { brand: deleteBrandAction, category: deleteCategoryAction, size: deleteSizeAction } as const;

/** Delete button for one row. It needs two clicks, and explains when the row is still in use. */
export function DeleteRow({ kind, id, dict, label, className }: { kind: keyof typeof deleteActions; id: string; dict: Dictionary; label: string; className?: string }) {
  const [state, action, pending] = useActionState(deleteActions[kind], adminIdle);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton disabled={pending} label={dict.admin.common.delete} confirmLabel={dict.admin.common.confirmDelete} aria-label={label} className={cn(ghostButton, "text-destructive", className)} />
      {state.status === "error" && (
        <p role="alert" className="max-w-52 text-right text-xs text-destructive">
          {state.code === "IN_USE" ? format(dict.admin.catalog.errors.IN_USE, { count: state.usedBy ?? 0 }) : ((dict.admin.catalog.errors as Record<string, string>)[state.code] ?? dict.admin.catalog.errors.UNKNOWN)}
        </p>
      )}
    </form>
  );
}
