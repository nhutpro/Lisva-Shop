/** Placeholder while the product list loads; sits in the static shell. */
export function ProductsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" role="status" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} aria-hidden className="rounded-md bg-surface p-3 pb-5 shadow-soft">
          <div className="aspect-square animate-pulse rounded-sm bg-secondary" />
          <div className="mt-4 h-3 w-1/3 animate-pulse rounded-full bg-secondary" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-secondary" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-secondary" />
        </div>
      ))}
    </div>
  );
}
