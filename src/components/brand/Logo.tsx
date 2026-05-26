"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hemisphere mark — the brand logo (orange→magenta sunset "H" under a dome).
 * Transparent PNG (white bg removed) so it sits cleanly on dark and light.
 * Sized by height; width scales with the logo's aspect ratio. If the image
 * fails to load, falls back to a clean gradient "H" badge (never the broken-
 * image icon).
 */
export function HemisphereMark({ size = 28, className }: { size?: number; className?: string }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        aria-label="Hemisphere"
        style={{ height: size, width: size, fontSize: size * 0.62 }}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-extrabold leading-none text-white shrink-0 select-none bg-gradient-to-br from-[#fb923c] via-[#f9568a] to-[#c026d3] drop-shadow-[0_0_10px_rgba(249,115,22,0.35)]",
          className
        )}
      >
        H
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hemisphere-logo.png"
      alt="Hemisphere"
      height={size}
      style={{ height: size, width: "auto" }}
      onError={() => setErrored(true)}
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
          // Single cohesive sunset gradient that matches the logo mark
          // (orange → coral → magenta), so the wordmark merges with the logo
          // and stays bright/legible on dark backgrounds.
          "font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#fb923c] via-[#f9568a] to-[#c026d3]",
          textClassName
        )}
      >
        Hemisphere
      </span>
    </span>
  );
}
