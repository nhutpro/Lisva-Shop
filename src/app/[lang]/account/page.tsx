import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { PasswordForm, ProfileForm } from "@/components/account/forms";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/lib/auth/current-user";

export default async function AccountPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <ProfileContent locale={locale} auth={dict.auth} />
    </Suspense>
  );
}

async function ProfileContent({ locale, auth }: { locale: Locale; auth: Dictionary["auth"] }) {
  const user = await requireUser(locale, localePath(locale, "/account"));
  return (
    <>
      <p className="mb-6 text-lg text-muted-foreground">{format(auth.account.welcome, { name: user.name ?? user.email })}</p>
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="profile-title" className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
          <h2 id="profile-title" className="mb-5 text-2xl font-medium">
            {auth.account.profile}
          </h2>
          <ProfileForm locale={locale} auth={auth} user={user} />
        </section>
        <section aria-labelledby="password-title" className="rounded-lg bg-surface p-6 shadow-soft sm:p-8">
          <h2 id="password-title" className="mb-5 text-2xl font-medium">
            {auth.account.passwordTitle}
          </h2>
          <PasswordForm locale={locale} auth={auth} />
        </section>
      </div>
    </>
  );
}
