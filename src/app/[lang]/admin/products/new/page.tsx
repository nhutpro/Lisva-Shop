import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { ProductEditor } from "@/components/admin/product-editor";
import { type Locale } from "@/i18n/config";
import {
  getDictionary,
  getLocale,
  type Dictionary,
} from "@/i18n/get-dictionary";
import {
  listBrands,
  listCategories,
  listSizes,
} from "@/lib/admin/reference-data";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getTranslator } from "@/lib/translate/deepl";

export default async function NewProductPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <NewProductContent locale={locale} dict={dict} />
    </Suspense>
  );
}

async function NewProductContent({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  await requireAdmin();
  const [categories, brands, sizes] = await Promise.all([
    listCategories(db),
    listBrands(db),
    listSizes(db),
  ]);
  return (
    <div>
      <h2 className="mb-5 text-3xl font-medium">
        {dict.admin.editor.titleNew}
      </h2>
      <ProductEditor
        locale={locale}
        dict={dict}
        initial={null}
        categories={categories}
        brands={brands}
        sizes={sizes}
        autoTranslate={Boolean(getTranslator())}
      />
    </div>
  );
}
