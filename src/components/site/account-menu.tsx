import Link from "next/link";
import { logoutAction } from "@/app/[lang]/account/actions";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserMenu } from "./user-menu";

type Props = { locale: Locale; dict: Dictionary };

const item = "block rounded-sm px-3 py-3 text-sm font-medium hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function LogoutForm({ locale, dict, className }: Props & { className: string }) {
  return (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={`${className} w-full text-left`}>
        {dict.auth.menu.logout}
      </button>
    </form>
  );
}

/** Header (tablet and desktop): "Sign in" for guests, a dropdown for signed-in users. Reads the session: render inside <Suspense>. */
export async function AccountMenu({ locale, dict }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href={localePath(locale, "/login")}
        className="hidden h-11 items-center rounded-full px-4 text-sm font-medium transition-colors duration-300 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:inline-flex"
      >
        {dict.auth.menu.login}
      </Link>
    );
  }

  const display = user.name ?? user.email;
  return (
    <UserMenu label={format(dict.auth.menu.label, { name: display })} initial={display.trim().charAt(0).toUpperCase()}>
      <p className="truncate px-3 py-2 text-xs text-muted-foreground">{display}</p>
      <Link href={localePath(locale, "/account")} className={item}>
        {dict.auth.menu.account}
      </Link>
      <Link href={localePath(locale, "/account/orders")} className={item}>
        {dict.auth.menu.orders}
      </Link>
      {user.role === "ADMIN" && (
        <Link href={localePath(locale, "/admin")} className={item}>
          {dict.auth.menu.admin}
        </Link>
      )}
      <LogoutForm locale={locale} dict={dict} className={item} />
    </UserMenu>
  );
}

/** The same links for the phone menu (a plain list, no dropdown). */
export async function AccountLinks({ locale, dict }: Props) {
  const user = await getCurrentUser();
  const row = "rounded-sm px-3 py-3.5 text-base font-medium hover:bg-secondary";

  if (!user) {
    return (
      <Link href={localePath(locale, "/login")} className={row}>
        {dict.auth.menu.login}
      </Link>
    );
  }
  return (
    <>
      <Link href={localePath(locale, "/account")} className={row}>
        {dict.auth.menu.account}
      </Link>
      <Link href={localePath(locale, "/account/orders")} className={row}>
        {dict.auth.menu.orders}
      </Link>
      {user.role === "ADMIN" && (
        <Link href={localePath(locale, "/admin")} className={row}>
          {dict.auth.menu.admin}
        </Link>
      )}
      <LogoutForm locale={locale} dict={dict} className={row} />
    </>
  );
}
