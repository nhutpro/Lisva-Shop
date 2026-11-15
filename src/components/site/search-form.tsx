import { Search } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Props = { id: string; locale: Locale; label: string; placeholder: string; submit: string; className?: string };

/** Plain GET form: works without JavaScript. `id` must be unique on the page (header and menu both render one). */
export function SearchForm({ id, locale, label, placeholder, submit, className }: Props) {
  return (
    <form action={localePath(locale, "/products")} method="get" role="search" className={cn("flex items-center", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name="q"
        type="search"
        maxLength={80}
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 w-full min-w-0 rounded-full border border-border bg-background pr-12 pl-4 text-sm outline-none transition-shadow duration-300 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        aria-label={submit}
        className="-ml-11 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Search className="size-4" aria-hidden />
      </button>
    </form>
  );
}
