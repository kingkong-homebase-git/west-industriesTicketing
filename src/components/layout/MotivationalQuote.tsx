"use client";

import { useEffect, useState } from "react";
import { pickQuote } from "@/lib/quotes";

/**
 * Desktop-only rotating motivational quote shown in the header. A fresh quote is
 * picked on each load (client-side, after mount — avoids a hydration mismatch).
 * Hidden on mobile. Rendered in the script font with the brand sunset gradient.
 */
export default function MotivationalQuote() {
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    setQuote(pickQuote());
  }, []);

  return (
    <div className="hidden md:flex flex-1 min-w-0 items-center justify-center px-6">
      {quote && (
        <p
          key={quote}
          title={quote}
          style={{ fontFamily: "var(--font-script)" }}
          className="quote-animate truncate text-xl lg:text-2xl leading-none select-none bg-gradient-to-r from-[#fb923c] via-[#f9568a] to-[#c026d3] bg-clip-text text-transparent"
        >
          {quote}
        </p>
      )}
    </div>
  );
}
