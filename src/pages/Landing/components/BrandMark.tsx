/**
 * The real Handy app icon, inline.
 *
 * This is the same geometry as public/favicon.svg and the mark
 * scripts/generate-app-icons.mjs rasterises for the PWA and the home screen —
 * a #f97316 tile at 22% corner radius with a round-capped white H. The landing
 * page used to approximate it with a CSS gradient and a text "H", which drifted
 * from the real thing in colour, radius and stroke weight; this can't.
 *
 * Inline rather than an <img src="/favicon.svg"> so it inherits the page's
 * rendering, costs no request, and can't flash in late.
 */
export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Handy"
      focusable="false"
    >
      <rect width="100" height="100" rx="22" fill="#f97316" />
      <path
        d="M33 26 V74 M67 26 V74 M33 50 H67"
        stroke="#ffffff"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
