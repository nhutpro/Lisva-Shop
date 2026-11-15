"use client";

import { useParams } from "next/navigation";
import en from "@/i18n/dictionaries/en.json";
import vi from "@/i18n/dictionaries/vi.json";

// Error boundaries are Client Components and cannot call getDictionary(), so both small error texts are bundled.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = (lang === "en" ? en : vi).error;

  return (
    <div role="alert" className="mx-auto w-[min(640px,92vw)] py-24 text-center">
      <h1 className="text-3xl font-medium">{t.title}</h1>
      <p className="mt-3 text-muted-foreground">{t.text}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {t.retry}
      </button>
    </div>
  );
}
