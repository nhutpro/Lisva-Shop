import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { ProductEditor } from "@/components/admin/product-editor";
import { localePath, type Locale } from "@/i18n/config";
import {
  getDictionary,
  getLocale,
  type Dictionary,
} from "@/i18n/get-dictionary";
import { getAdminProduct } from "@/lib/admin/products";
import {
  listBrands,
  listCategories,
  listSizes,
} from "@/lib/admin/reference-data";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getTranslator } from "@/lib/translate/deepl";

export default async function EditProductPage({
  params,
}: PageProps<"/[lang]/admin/products/[id]">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <EditProductContent params={params} locale={locale} dict={dict} />
    </Suspense>
  );
}

async function EditProductContent({
  params,
  locale,
  dict,
}: {
  params: Promise<{ id: string }>;
  locale: Locale;
  dict: Dictionary;
}) {
  await requireAdmin();
  const { id } = await params;
  const [product, categories, brands, sizes] = await Promise.all([
    getAdminProduct(db, id),
    listCategories(db),
    listBrands(db),
    listSizes(db),
  ]);
  if (!product) notFound();

  // After a save the page is rendered again with the saved data (new ids for new colors and variants).
  // A new `key` makes the editor start from that data instead of its old working copy.
  const version = createHash("sha1")
    .update(JSON.stringify(product))
    .digest("hex")
    .slice(0, 12);

  return (
    <div>
      <h2 className="mb-5 text-3xl font-medium">
        {dict.admin.editor.titleEdit}: {product.nameVi}
      </h2>
      <ProductEditor
        version={version}
        locale={locale}
        dict={dict}
        initial={product}
        categories={categories}
        brands={brands}
        sizes={sizes}
        autoTranslate={Boolean(getTranslator())}
        shopHref={
          product.status === "ACTIVE"
            ? localePath(locale, `/products/${product.slug}`)
            : undefined
        }
      />
    </div>
  );
}
