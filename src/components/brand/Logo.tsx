import { cn } from "@/lib/utils";

/**
 * Hemisphere mark — a domed half-globe with meridian/parallel arcs, gradient
 * fill and a soft glow. Scales cleanly and reads in both light and dark themes.
 */
export function HemisphereMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("drop-shadow-[0_0_8px_rgba(59,130,246,0.55)]", className)}
    >
      <defs>
        <linearGradient id="hemi-fill" x1="4" y1="4" x2="28" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7cc0ff" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {/* Dome */}
      <path d="M3 21 A13 13 0 0 1 29 21 Z" fill="url(#hemi-fill)" />
      {/* Meridian arcs */}
      <path d="M16 8 Q9 14.5 16 21" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M16 8 Q23 14.5 16 21" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* Parallel */}
      <path d="M5.5 15.5 Q16 19.5 26.5 15.5" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* Base bar */}
      <rect x="2.5" y="21" width="27" height="2.6" rx="1.3" fill="#2563eb" />
      <rect x="2.5" y="21" width="27" height="2.6" rx="1.3" fill="#60a5fa" fillOpacity="0.25" />
    </svg>
  );
}

/** Mark + "Hemisphere" wordmark. */
export function BrandLogo({
  size = 28,
  className,
  textClassName,
}: {
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <HemisphereMark size={size} className="shrink-0" />
      <span
        className={cn(
          "font-bold tracking-tight bg-gradient-to-r from-text-primary via-text-primary to-accent bg-clip-text text-transparent",
          textClassName
        )}
      >
        Hemisphere
      </span>
    </span>
  );
}
