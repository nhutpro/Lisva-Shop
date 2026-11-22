import Link from "next/link";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { AddressForm, type EditableAddress } from "@/components/account/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { listAddresses } from "@/lib/auth/addresses";
import { requireUser } from "@/lib/auth/current-user";
import { MAX_ADDRESSES } from "@/lib/auth/schemas";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { deleteAddressAction, setDefaultAddressAction } from "../actions";

const small =
  "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export default async function AddressesPage({ searchParams }: PageProps<"/[lang]/account/addresses">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AddressesContent searchParams={searchParams} locale={locale} auth={dict.auth} />
    </Suspense>
  );
}

async function AddressesContent({
  searchParams,
  locale,
  auth,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  locale: Locale;
  auth: Dictionary["auth"];
}) {
  const here = localePath(locale, "/account/addresses");
  const user = await requireUser(locale, here);
  const addresses = await listAddresses(db, user.id);
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : undefined;
  const editing = editId ? addresses.find((a) => a.id === editId) : undefined;
  const adding = params.new !== undefined && addresses.length < MAX_ADDRESSES;
  const t = auth.addresses;

  const form: EditableAddress | null = editing
    ? editing
    : adding
      ? { recipientName: user.name ?? "", phone: user.phone ?? "", province: "", district: "", ward: "", street: "", isDefault: addresses.length === 0 }
      : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
      <section aria-labelledby="addresses-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="addresses-title" className="text-2xl font-medium">
            {t.title}
          </h2>
          {addresses.length < MAX_ADDRESSES ? (
            <Link href={`${here}?new`} className={small}>
              {t.add}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">{format(t.limitNote, { max: MAX_ADDRESSES })}</p>
          )}
        </div>

        {addresses.length === 0 ? (
          <p className="rounded-lg bg-surface p-8 text-muted-foreground shadow-soft">{t.empty}</p>
        ) : (
          <ul role="list" className="space-y-4">
            {addresses.map((a) => (
              <li key={a.id} className={cn("rounded-md bg-surface p-5 shadow-soft", a.isDefault && "ring-1 ring-gold")}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{a.recipientName}</p>
                  {a.isDefault && <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-[#7a5a1f]">{t.default}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">{a.phone}</p>
                <p className="mt-1 text-sm">{[a.street, a.ward, a.district, a.province].join(", ")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`${here}?edit=${a.id}`} aria-label={format(t.editLabel, { street: a.street })} className={small}>
                    {t.edit}
                  </Link>
                  {!a.isDefault && (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="addressId" value={a.id} />
                      <button type="submit" aria-label={format(t.setDefaultAsking, { street: a.street })} className={small}>
                        {t.makeDefault}
                      </button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="addressId" value={a.id} />
                    <ConfirmButton label={t.delete} confirmLabel={`${t.delete}?`} aria-label={format(t.deleteLabel, { street: a.street })} className={small} />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {form && (
        <section aria-labelledby="address-form-title" className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
          <h2 id="address-form-title" className="mb-5 text-2xl font-medium">
            {editing ? t.editTitle : t.newTitle}
          </h2>
          {/* key: switching between addresses must start a fresh form */}
          <AddressForm key={editing?.id ?? "new"} locale={locale} auth={auth} address={form} cancelHref={here} />
        </section>
      )}
    </div>
  );
}
