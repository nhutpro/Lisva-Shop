"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  deleteProductAction,
  saveProductAction,
} from "@/app/[lang]/admin/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Issue } from "@/lib/admin/errors";
import { issueLocation } from "@/lib/admin/issue-location";
import {
  addColor,
  addVariant,
  moveItem,
  removeColor,
  removeVariant,
  suggestSku,
  toDraft,
  emptyDraft,
  type Draft,
} from "@/lib/admin/editor-state";
import { adminIdle } from "@/lib/admin/form-state";
import type { ProductEditorData } from "@/lib/admin/product-schema";
import type {
  BrandRow,
  CategoryRow,
  SizeRow,
} from "@/lib/admin/reference-data";
import { slugify } from "@/lib/slug";
import { uploadImage, type UploadResult } from "@/lib/storage/upload-client";
import { cn } from "@/lib/utils";
import {
  Card,
  SelectField,
  TextField,
  button,
  control,
  ghostButton,
  issueFor,
  issueText,
} from "./admin-ui";

type Props = {
  locale: Locale;
  dict: Dictionary;
  initial: ProductEditorData | null;
  categories: CategoryRow[];
  brands: BrandRow[];
  sizes: SizeRow[];
  /** Public address of the product, for "view in shop" (edit mode, active products). */
  shopHref?: string;
  /** True when a translator is configured: empty English fields are filled in when saving. */
  autoTranslate?: boolean;
};

const iconButton =
  "grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border";

/**
 * After a save the page is rendered again with the saved data, and `version` changes so the form starts from
 * that data (new ids for new colors and variants). This wrapper is not remounted, so it remembers the save and
 * the "saved" message survives the restart of the form.
 */
export function ProductEditor({
  version,
  ...props
}: Props & { version?: string }) {
  const [justSaved, setJustSaved] = useState(false);
  return (
    <ProductEditorForm
      key={version}
      {...props}
      justSaved={justSaved}
      onSavedChange={setJustSaved}
    />
  );
}

function ProductEditorForm({
  locale,
  dict,
  initial,
  categories,
  brands,
  sizes,
  shopHref,
  autoTranslate,
  justSaved,
  onSavedChange,
}: Props & { justSaved: boolean; onSavedChange: (saved: boolean) => void }) {
  const t = dict.admin.editor;
  /** The "saved" message; a product that is not for sale says why it is not in the shop. */
  const savedText = (status: string) =>
    status === "ACTIVE" ? t.saved : `${t.saved} ${t.savedNotForSale}`;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() =>
    initial ? toDraft(initial) : emptyDraft(),
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [banner, setBanner] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(
    justSaved
      ? { kind: "success", text: savedText(initial?.status ?? "DRAFT") }
      : null,
  );
  const [pending, startTransition] = useTransition();
  const bannerRef = useRef<HTMLDivElement>(null);
  // A new product's URL name follows its name until the owner types their own.
  const slugEdited = useRef(Boolean(initial));

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const error = (path: string) => issueText(issueFor(issues, path), t.issues);

  /** A readable name for the field of a problem, e.g. "Phiên bản 1 · Mã SKU". */
  const fieldLabel = (path: string): string => {
    const location = issueLocation(path);
    if (!location) return path;
    const row = location.index === undefined ? "" : ` ${location.index + 1}`;
    const pick = (group: Record<string, string>, key: string) =>
      group[key] ?? key;
    switch (location.section) {
      case "basic":
      case "pricing": {
        const names: Record<string, string> = {
          categoryId: t.fields.category,
          brandId: t.fields.brand,
        };
        return (
          names[location.field] ??
          pick(t.fields as Record<string, string>, location.field)
        );
      }
      case "specs":
        return `${t.sections.specs}${row}${location.field ? ` · ${pick(t.specs as Record<string, string>, location.field)}` : ""}`;
      case "colors":
        return `${t.sections.colors}${row}${location.field ? ` · ${pick(t.colors as Record<string, string>, location.field)}` : ""}`;
      case "variants": {
        const names: Record<string, string> = {
          colorKey: t.variants.color,
          sizeId: t.variants.size,
        };
        const name = location.field
          ? (names[location.field] ??
            pick(t.variants as Record<string, string>, location.field))
          : "";
        return `${location.index === undefined ? t.sections.variants : format(t.variants.row, { n: location.index + 1 })}${name ? ` · ${name}` : ""}`;
      }
      case "images": {
        const names: Record<string, string> = {
          colorKey: t.images.target,
          variantKey: t.images.target,
        };
        const name = location.field
          ? (names[location.field] ??
            pick(t.images as unknown as Record<string, string>, location.field))
          : "";
        return `${location.index === undefined ? t.sections.images : format(t.images.row, { n: location.index + 1 })}${name ? ` · ${name}` : ""}`;
      }
    }
  };

  /** Scrolls to the field of a problem and puts the cursor there. */
  const goToIssue = (path: string) => {
    const location = issueLocation(path);
    const element = location
      ? document.getElementById(location.elementId)
      : null;
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => element.focus({ preventScroll: true }), 250);
  };

  const brandPrefix = brands.find((b) => b.id === draft.brandId)?.skuPrefix;
  const colorName = (key: string | null) =>
    draft.colors.find((c) => c.key === key)?.nameVi ?? "";
  const sizeLabel = (id: string | null) =>
    sizes.find((s) => s.id === id)?.label ?? "";

  const save = () =>
    startTransition(async () => {
      onSavedChange(false);
      const result = await saveProductAction(draft);
      if (result.ok) {
        setIssues([]);
        if (!draft.id) {
          router.replace(
            localePath(locale, `/admin/products/${result.value.id}`),
          );
          return;
        }
        onSavedChange(true);
        setBanner({ kind: "success", text: savedText(draft.status) });
      } else {
        setIssues(result.error.issues ?? []);
        const messages = t.errors as Record<string, string>;
        setBanner({
          kind: "error",
          text:
            result.error.code === "IN_USE"
              ? format(t.errors.IN_USE, { count: result.error.usedBy ?? 0 })
              : (messages[result.error.code] ?? t.errors.UNKNOWN),
        });
      }
    });

  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadErrors = t.images.uploadErrors as Record<string, string>;

  /** Uploads files one by one; each result goes to `onDone`. Problems are shown above the pictures. */
  const uploadFiles = async (files: File[], onDone: (url: string) => void) => {
    setUploadError(null);
    setUploading((n) => n + files.length);
    for (const file of files) {
      const result: UploadResult = await uploadImage(file);
      if (result.ok) onDone(result.url);
      else
        setUploadError(
          `${file.name}: ${uploadErrors[result.code] ?? uploadErrors.UNKNOWN}`,
        );
      setUploading((n) => n - 1);
    }
  };
  const addUploaded = (url: string) =>
    setDraft((d) => ({
      ...d,
      images: [
        ...d.images,
        { url, altVi: "", altEn: "", colorKey: null, variantKey: null },
      ],
    }));

  useEffect(() => {
    if (banner) bannerRef.current?.focus();
  }, [banner]);

  const topLevel = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parentId === id);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
        aria-busy={pending}
        className="space-y-6"
      >
        {banner && (
          <div
            ref={bannerRef}
            tabIndex={-1}
            role={banner.kind === "error" ? "alert" : "status"}
            className={cn(
              "rounded-md border p-4 text-sm outline-none",
              banner.kind === "error"
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-green-600/30 bg-green-600/5 text-green-800",
            )}
          >
            <p>{banner.text}</p>
            {banner.kind === "error" && issues.length > 0 && (
              <ul role="list" className="mt-3 list-disc space-y-1 pl-5">
                {issues.slice(0, 12).map((issue) => (
                  <li key={`${issue.path}:${issue.code}`}>
                    <a
                      href={`#${issueLocation(issue.path)?.elementId ?? ""}`}
                      onClick={(event) => {
                        event.preventDefault();
                        goToIssue(issue.path);
                      }}
                      className="font-medium underline underline-offset-4"
                    >
                      {fieldLabel(issue.path)}
                    </a>
                    : {issueText(issue.code, t.issues)}
                  </li>
                ))}
                {issues.length > 12 && <li>…</li>}
              </ul>
            )}
          </div>
        )}

        <Card title={t.sections.basic} id="basic">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="nameVi"
              label={t.fields.nameVi}
              value={draft.nameVi}
              maxLength={200}
              error={error("nameVi")}
              onChange={(e) =>
                update({
                  nameVi: e.target.value,
                  ...(slugEdited.current
                    ? {}
                    : { slug: slugify(e.target.value, 100) }),
                })
              }
            />
            <TextField
              id="nameEn"
              label={t.fields.nameEn}
              hint={autoTranslate ? t.autoTranslate : undefined}
              value={draft.nameEn}
              maxLength={200}
              error={error("nameEn")}
              onChange={(e) => update({ nameEn: e.target.value })}
            />
            <div>
              <TextField
                id="slug"
                label={t.fields.slug}
                value={draft.slug}
                maxLength={100}
                hint={t.fields.slugHint}
                error={error("slug")}
                onChange={(e) => {
                  slugEdited.current = true;
                  update({ slug: e.target.value });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  slugEdited.current = false;
                  update({ slug: slugify(draft.nameVi, 100) });
                }}
                className="mt-1 text-xs underline underline-offset-4"
              >
                {t.fields.suggest}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="categoryId"
                label={t.fields.category}
                value={draft.categoryId}
                onChange={(e) => update({ categoryId: e.target.value })}
                error={error("categoryId")}
              >
                <option value="">{t.fields.choose}</option>
                {topLevel.map((c) => [
                  <option key={c.id} value={c.id}>
                    {c.nameVi}
                  </option>,
                  ...childrenOf(c.id).map((child) => (
                    <option key={child.id} value={child.id}>
                      {`${c.nameVi} › ${child.nameVi}`}
                    </option>
                  )),
                ])}
              </SelectField>
              <SelectField
                id="brandId"
                label={t.fields.brand}
                value={draft.brandId}
                onChange={(e) => update({ brandId: e.target.value })}
                error={error("brandId")}
              >
                <option value="">{t.fields.choose}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField
              id="descriptionVi"
              multiline
              label={t.fields.descriptionVi}
              value={draft.descriptionVi}
              maxLength={5000}
              error={error("descriptionVi")}
              onChange={(e) => update({ descriptionVi: e.target.value })}
            />
            <TextField
              id="descriptionEn"
              multiline
              label={t.fields.descriptionEn}
              hint={autoTranslate ? t.autoTranslate : undefined}
              value={draft.descriptionEn}
              maxLength={5000}
              error={error("descriptionEn")}
              onChange={(e) => update({ descriptionEn: e.target.value })}
            />
          </div>
        </Card>

        <Card title={t.sections.pricing} id="pricing">
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField
              id="price"
              inputMode="numeric"
              label={t.fields.price}
              value={draft.price}
              maxLength={12}
              error={error("price")}
              onChange={(e) => update({ price: e.target.value })}
            />
            <TextField
              id="compareAtPrice"
              inputMode="numeric"
              label={`${t.fields.compareAtPrice} ${dict.admin.common.optional}`}
              value={draft.compareAtPrice}
              maxLength={12}
              hint={t.fields.compareHint}
              error={error("compareAtPrice")}
              onChange={(e) => update({ compareAtPrice: e.target.value })}
            />
            <SelectField
              id="status"
              label={t.fields.status}
              value={draft.status}
              onChange={(e) =>
                update({ status: e.target.value as Draft["status"] })
              }
              hint={t.statusHint}
              error={error("status")}
            >
              {(["DRAFT", "ACTIVE", "ARCHIVED"] as const).map((s) => (
                <option key={s} value={s}>
                  {dict.admin.products.statusLabels[s]}
                </option>
              ))}
            </SelectField>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-sm">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => update({ featured: e.target.checked })}
                className="size-4 accent-gold"
              />
              {t.fields.featured}
            </label>
          </div>
        </Card>

        <Card
          title={t.sections.specs}
          id="specs"
          action={
            <button
              type="button"
              onClick={() =>
                update({
                  specs: [
                    ...draft.specs,
                    { labelVi: "", labelEn: "", valueVi: "", valueEn: "" },
                  ],
                })
              }
              className={ghostButton}
            >
              <Plus className="size-4" aria-hidden />
              {t.specs.add}
            </button>
          }
        >
          {draft.specs.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.specs.empty}</p>
          )}
          <ul role="list" className="space-y-3">
            {draft.specs.map((s, i) => (
              <li
                key={i}
                className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <TextField
                  id={`spec-${i}-labelVi`}
                  label={t.specs.labelVi}
                  value={s.labelVi}
                  maxLength={80}
                  error={error(`specs.${i}.labelVi`)}
                  onChange={(e) =>
                    update({
                      specs: draft.specs.map((x, j) =>
                        j === i ? { ...x, labelVi: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`spec-${i}-labelEn`}
                  label={t.specs.labelEn}
                  value={s.labelEn}
                  maxLength={80}
                  onChange={(e) =>
                    update({
                      specs: draft.specs.map((x, j) =>
                        j === i ? { ...x, labelEn: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`spec-${i}-valueVi`}
                  label={t.specs.valueVi}
                  value={s.valueVi}
                  maxLength={200}
                  error={error(`specs.${i}.valueVi`)}
                  onChange={(e) =>
                    update({
                      specs: draft.specs.map((x, j) =>
                        j === i ? { ...x, valueVi: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`spec-${i}-valueEn`}
                  label={t.specs.valueEn}
                  value={s.valueEn}
                  maxLength={200}
                  onChange={(e) =>
                    update({
                      specs: draft.specs.map((x, j) =>
                        j === i ? { ...x, valueEn: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`${dict.admin.common.remove} ${s.labelVi}`}
                  onClick={() =>
                    update({ specs: draft.specs.filter((_, j) => j !== i) })
                  }
                  className={cn(iconButton, "sm:mt-7")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={t.sections.colors}
          id="colors"
          action={
            <button
              type="button"
              onClick={() => setDraft(addColor)}
              className={ghostButton}
            >
              <Plus className="size-4" aria-hidden />
              {t.colors.add}
            </button>
          }
        >
          {draft.colors.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.colors.empty}</p>
          )}
          <ul role="list" className="space-y-3">
            {draft.colors.map((c, i) => (
              <li
                key={c.key}
                className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_180px_auto]"
              >
                <TextField
                  id={`color-${i}-nameVi`}
                  label={t.colors.nameVi}
                  value={c.nameVi}
                  maxLength={60}
                  error={error(`colors.${i}.nameVi`)}
                  onChange={(e) =>
                    update({
                      colors: draft.colors.map((x, j) =>
                        j === i ? { ...x, nameVi: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`color-${i}-nameEn`}
                  label={t.colors.nameEn}
                  value={c.nameEn}
                  maxLength={60}
                  onChange={(e) =>
                    update({
                      colors: draft.colors.map((x, j) =>
                        j === i ? { ...x, nameEn: e.target.value } : x,
                      ),
                    })
                  }
                />
                <div>
                  <label
                    htmlFor={`color-${i}-hex`}
                    className="mb-1.5 block text-sm font-medium"
                  >
                    {t.colors.hex}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`color-${i}-hex`}
                      value={c.hex}
                      maxLength={7}
                      placeholder={t.colors.hexHint}
                      aria-invalid={error(`colors.${i}.hex`) ? true : undefined}
                      onChange={(e) =>
                        update({
                          colors: draft.colors.map((x, j) =>
                            j === i ? { ...x, hex: e.target.value } : x,
                          ),
                        })
                      }
                      className={cn(control, "h-11")}
                    />
                    <span
                      aria-hidden
                      className="size-8 shrink-0 rounded-full ring-1 ring-border"
                      style={{
                        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(c.hex)
                          ? c.hex
                          : "transparent",
                      }}
                    />
                  </div>
                  {error(`colors.${i}.hex`) && (
                    <p className="mt-1 text-xs text-destructive">
                      {error(`colors.${i}.hex`)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`${dict.admin.common.remove} ${c.nameVi}`}
                  onClick={() => setDraft((d) => removeColor(d, c.key))}
                  className={cn(iconButton, "sm:mt-7")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={t.sections.variants}
          id="variants"
          action={
            <button
              type="button"
              onClick={() => setDraft(addVariant)}
              className={ghostButton}
            >
              <Plus className="size-4" aria-hidden />
              {t.variants.add}
            </button>
          }
        >
          <p className="mb-4 text-sm text-muted-foreground">
            {t.variants.note}
          </p>
          {error("variants") && (
            <p className="mb-3 text-sm text-destructive">{error("variants")}</p>
          )}
          <ul role="list" className="space-y-4">
            {draft.variants.map((v, i) => {
              const rowError = error(`variants.${i}`);
              const patch = (p: Partial<Draft["variants"][number]>) =>
                update({
                  variants: draft.variants.map((x, j) =>
                    j === i ? { ...x, ...p } : x,
                  ),
                });
              return (
                <li key={v.key} className="rounded-md border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {format(t.variants.row, { n: i + 1 })}
                    </p>
                    <button
                      type="button"
                      aria-label={`${t.variants.remove} ${i + 1}`}
                      disabled={draft.variants.length <= 1}
                      onClick={() => setDraft((d) => removeVariant(d, v.key))}
                      className={iconButton}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  {rowError && (
                    <p className="mb-2 text-sm text-destructive">{rowError}</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-6">
                    {draft.colors.length > 0 && (
                      <SelectField
                        id={`variant-${i}-color`}
                        label={t.variants.color}
                        value={v.colorKey ?? ""}
                        error={error(`variants.${i}.colorKey`)}
                        onChange={(e) =>
                          patch({ colorKey: e.target.value || null })
                        }
                      >
                        <option value="">{t.variants.noColor}</option>
                        {draft.colors.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.nameVi || "…"}
                          </option>
                        ))}
                      </SelectField>
                    )}
                    <SelectField
                      id={`variant-${i}-size`}
                      label={t.variants.size}
                      value={v.sizeId ?? ""}
                      error={error(`variants.${i}.sizeId`)}
                      onChange={(e) =>
                        patch({ sizeId: e.target.value || null })
                      }
                    >
                      <option value="">{t.variants.noSize}</option>
                      {(["SHOE", "WATCH"] as const).map((type) => (
                        <optgroup
                          key={type}
                          label={dict.admin.catalog.types[type]}
                        >
                          {sizes
                            .filter((s) => s.type === type)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </SelectField>
                    <div className="sm:col-span-2">
                      <TextField
                        id={`variant-${i}-sku`}
                        label={t.variants.sku}
                        value={v.sku}
                        maxLength={64}
                        error={error(`variants.${i}.sku`)}
                        onChange={(e) =>
                          patch({ sku: e.target.value.toUpperCase() })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            sku: suggestSku({
                              prefix: brandPrefix,
                              product: draft.nameVi || draft.slug,
                              color: colorName(v.colorKey),
                              size: sizeLabel(v.sizeId),
                            }),
                          })
                        }
                        className="mt-1 text-xs underline underline-offset-4"
                      >
                        {t.variants.suggestSku}
                      </button>
                    </div>
                    <TextField
                      id={`variant-${i}-price`}
                      inputMode="numeric"
                      label={t.variants.price}
                      placeholder={t.variants.priceHint}
                      value={v.price}
                      maxLength={12}
                      error={error(`variants.${i}.price`)}
                      onChange={(e) => patch({ price: e.target.value })}
                    />
                    <TextField
                      id={`variant-${i}-stock`}
                      inputMode="numeric"
                      label={t.variants.stock}
                      value={v.stock}
                      maxLength={7}
                      error={error(`variants.${i}.stock`)}
                      onChange={(e) => patch({ stock: e.target.value })}
                    />
                  </div>
                  <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={v.isActive}
                      onChange={(e) => patch({ isActive: e.target.checked })}
                      className="size-4 accent-gold"
                    />
                    {t.variants.active}
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title={t.sections.images}
          id="images"
          action={
            <div className="flex flex-wrap gap-2">
              <label
                className={cn(
                  ghostButton,
                  "cursor-pointer focus-within:ring-2 focus-within:ring-ring",
                )}
              >
                <Upload className="size-4" aria-hidden />
                {t.images.uploadMany}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length) void uploadFiles(files, addUploaded);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  update({
                    images: [
                      ...draft.images,
                      {
                        url: "",
                        altVi: "",
                        altEn: "",
                        colorKey: null,
                        variantKey: null,
                      },
                    ],
                  })
                }
                className={ghostButton}
              >
                <Plus className="size-4" aria-hidden />
                {t.images.add}
              </button>
            </div>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {uploading > 0 ? t.images.uploading : t.images.uploadHint}
          </p>
          {uploadError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {uploadError}
            </p>
          )}
          {draft.images.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.images.empty}</p>
          )}
          <ul role="list" className="space-y-4">
            {draft.images.map((img, i) => {
              const patch = (p: Partial<Draft["images"][number]>) =>
                update({
                  images: draft.images.map((x, j) =>
                    j === i ? { ...x, ...p } : x,
                  ),
                });
              const target = img.colorKey
                ? `color:${img.colorKey}`
                : img.variantKey
                  ? `variant:${img.variantKey}`
                  : "general";
              return (
                <li key={i} className="rounded-md border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {format(t.images.row, { n: i + 1 })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`${t.images.up} ${i + 1}`}
                        disabled={i === 0}
                        onClick={() =>
                          update({ images: moveItem(draft.images, i, i - 1) })
                        }
                        className={iconButton}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`${t.images.down} ${i + 1}`}
                        disabled={i === draft.images.length - 1}
                        onClick={() =>
                          update({ images: moveItem(draft.images, i, i + 1) })
                        }
                        className={iconButton}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`${t.images.remove} ${i + 1}`}
                        onClick={() =>
                          update({
                            images: draft.images.filter((_, j) => j !== i),
                          })
                        }
                        className={iconButton}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary">
                        {img.url && (
                          <Image
                            src={img.url}
                            alt={t.images.preview}
                            fill
                            sizes="80px"
                            unoptimized
                            className="object-contain p-1"
                          />
                        )}
                      </div>
                      <label
                        className={cn(
                          ghostButton,
                          "cursor-pointer focus-within:ring-2 focus-within:ring-ring",
                        )}
                      >
                        <Upload className="size-4" aria-hidden />
                        {t.images.upload}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label={`${t.images.upload} ${i + 1}`}
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file)
                              void uploadFiles([file], (url) =>
                                setDraft((d) => ({
                                  ...d,
                                  images: d.images.map((x, j) =>
                                    j === i ? { ...x, url } : x,
                                  ),
                                })),
                              );
                          }}
                        />
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <TextField
                        id={`image-${i}-url`}
                        label={`${t.images.url} (${t.images.orLink})`}
                        hint={t.images.urlHint}
                        value={img.url}
                        maxLength={500}
                        error={error(`images.${i}.url`)}
                        onChange={(e) => patch({ url: e.target.value })}
                      />
                    </div>
                    <TextField
                      id={`image-${i}-altVi`}
                      label={t.images.altVi}
                      value={img.altVi}
                      maxLength={200}
                      onChange={(e) => patch({ altVi: e.target.value })}
                    />
                    <TextField
                      id={`image-${i}-altEn`}
                      label={t.images.altEn}
                      value={img.altEn}
                      maxLength={200}
                      onChange={(e) => patch({ altEn: e.target.value })}
                    />
                    <SelectField
                      id={`image-${i}-target`}
                      label={t.images.target}
                      value={target}
                      error={
                        error(`images.${i}.colorKey`) ??
                        error(`images.${i}.variantKey`)
                      }
                      onChange={(e) => {
                        const [kind, key] = e.target.value.split(":");
                        patch({
                          colorKey: kind === "color" ? key : null,
                          variantKey: kind === "variant" ? key : null,
                        });
                      }}
                    >
                      <option value="general">{t.images.general}</option>
                      {draft.colors.map((c) => (
                        <option key={c.key} value={`color:${c.key}`}>
                          {format(t.images.color, { name: c.nameVi || "…" })}
                        </option>
                      ))}
                      {draft.variants.map((v, n) => (
                        <option key={v.key} value={`variant:${v.key}`}>
                          {format(t.images.variant, {
                            name: [
                              colorName(v.colorKey),
                              sizeLabel(v.sizeId),
                              v.sku || `#${n + 1}`,
                            ]
                              .filter(Boolean)
                              .join(" / "),
                          })}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/95 p-4 shadow-lift backdrop-blur">
          <button type="submit" disabled={pending} className={button}>
            {pending ? t.saving : t.save}
          </button>
          <Link
            href={localePath(locale, "/admin/products")}
            className={ghostButton}
          >
            {t.backToList}
          </Link>
          {shopHref && (
            <Link
              href={shopHref}
              target="_blank"
              className="text-sm underline underline-offset-4"
            >
              {dict.admin.products.viewInShop}
            </Link>
          )}
        </div>
      </form>
      {draft.id && (
        <div className="mt-4 flex justify-end">
          <DeleteProduct id={draft.id} locale={locale} dict={dict} />
        </div>
      )}
    </>
  );
}

/** Its own form (a form cannot sit inside the editor form). Deleting needs two clicks. */
function DeleteProduct({
  id,
  locale,
  dict,
}: {
  id: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.editor;
  const [state, action, pending] = useActionState(
    deleteProductAction,
    adminIdle,
  );

  return (
    <form action={action} className="ml-auto flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.code === "IN_USE"
            ? format(t.errors.IN_USE, { count: state.usedBy ?? 0 })
            : ((t.errors as Record<string, string>)[state.code] ??
              t.errors.UNKNOWN)}
        </p>
      )}
      <ConfirmButton
        disabled={pending}
        label={t.delete}
        confirmLabel={dict.admin.common.confirmDelete}
        className={cn(ghostButton, "text-destructive")}
      />
    </form>
  );
}
