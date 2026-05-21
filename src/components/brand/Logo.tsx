import { cn } from "@/lib/utils";

/**
 * Hemisphere mark — the brand logo (orange→magenta sunset "H" under a dome).
 * Transparent PNG (white bg removed) so it sits cleanly on dark and light.
 * Sized by height; width scales with the logo's aspect ratio.
 */
export function HemisphereMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hemisphere-logo.png"
      alt="Hemisphere"
      height={size}
      style={{ height: size, width: "auto" }}
      className={cn("select-none drop-shadow-[0_0_10px_rgba(249,115,22,0.35)]", className)}
    />
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
