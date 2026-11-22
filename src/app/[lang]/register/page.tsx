import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/account/forms";
import { localePath, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-redirect";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.register.title, robots: { index: false, follow: false } };
}

export default async function RegisterPage({ searchParams }: PageProps<"/[lang]/register">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto w-[min(480px,92vw)] pt-12">
      <h1 className="text-4xl font-medium">{dict.auth.register.title}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{dict.auth.register.subtitle}</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-secondary" aria-hidden />}>
        <RegisterContent searchParams={searchParams} locale={locale} auth={dict.auth} />
      </Suspense>
    </div>
  );
}

async function RegisterContent({
  searchParams,
  locale,
  auth,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  locale: Locale;
  auth: Dictionary["auth"];
}) {
  const next = safeNextPath((await searchParams).next) ?? undefined;
  if (await getCurrentUser()) redirect(next ?? localePath(locale, "/account"));
  return <RegisterForm locale={locale} auth={auth} next={next} />;
}
