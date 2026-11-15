// Simple vector illustrations used until real product photos exist (decorative, hidden from screen readers).

export function WatchArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden focusable="false">
      <rect x="70" y="0" width="60" height="260" rx="18" fill="#B9B3A5" />
      <circle cx="100" cy="130" r="64" fill="#16140F" />
      <circle cx="100" cy="130" r="56" fill="#F6F4EF" />
      <path d="M100 130V92M100 130l22 13" stroke="#16140F" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="100" cy="130" r="4" fill="#B08D57" />
    </svg>
  );
}

export function ShoeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 120" className={className} aria-hidden focusable="false">
      <ellipse cx="110" cy="108" rx="96" ry="8" fill="rgba(0,0,0,.12)" />
      <path d="M10 80c0-20 20-24 40-30l30-30c8 8 22 14 40 18l60 14c20 4 30 12 30 24v12H10z" fill="#16140F" />
      <rect x="10" y="88" width="200" height="14" rx="7" fill="#fff" stroke="#ccc" />
    </svg>
  );
}

/** Picks the illustration for a category slug. */
export function CategoryArt({ slug, className }: { slug: string; className?: string }) {
  return slug.includes("dong-ho") ? <WatchArt className={className} /> : <ShoeArt className={className} />;
}
