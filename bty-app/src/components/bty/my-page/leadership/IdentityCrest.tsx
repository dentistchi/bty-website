/**
 * Minimal prestige mark — not a complex emblem; stillness + identity.
 */
export function IdentityCrest({ "aria-label": ariaLabel }: { "aria-label": string }) {
  return (
    <div
      role="img"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-950 shadow-inner ring-1 ring-white/5"
      aria-label={ariaLabel}
    >
      <svg
        viewBox="0 0 48 48"
        className="h-9 w-9 text-cyan-200/50"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        aria-hidden
      >
        <circle cx="24" cy="24" r="14" opacity="0.35" />
        <path d="M24 10v28M14 24h20" opacity="0.45" />
        <path d="M17 17l14 14M31 17L17 31" opacity="0.25" />
      </svg>
    </div>
  );
}
