/**
 * Copies the assets that `next build` leaves OUT of the standalone bundle.
 *
 * With `output: "standalone"`, Next emits .next/standalone/server.js but does
 * NOT include .next/static or public/ — the server expects those to sit next to
 * it at runtime. Without this copy the freshly built server requests asset
 * hashes that 404, so pages render as unstyled HTML with no client JS.
 *
 * Wired as `postbuild` so it runs automatically after `pnpm build`. Pure Node
 * fs so it works on both the Linux droplet and a Windows dev machine.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error(
    "[copy-standalone-assets] .next/standalone not found — run `next build` " +
      "with output:'standalone' first."
  );
  process.exit(1);
}

function sync(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[copy-standalone-assets] skip (missing): ${src}`);
    return;
  }
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-standalone-assets] copied ${src} -> ${dest}`);
}

sync(join(root, ".next", "static"), join(standalone, ".next", "static"));
sync(join(root, "public"), join(standalone, "public"));
console.log("[copy-standalone-assets] done");
