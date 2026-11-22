/** Placeholder for account and admin content that waits for the session. */
export function AccountSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-6 md:grid-cols-2">
      <span className="sr-only">…</span>
      <div aria-hidden className="h-72 animate-pulse rounded-lg bg-surface shadow-soft" />
      <div aria-hidden className="h-72 animate-pulse rounded-lg bg-surface shadow-soft" />
    </div>
  );
}
