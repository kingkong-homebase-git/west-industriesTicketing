import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres", "bcryptjs"],
  experimental: {
    // Allow 10MB document uploads via server actions (default cap is 1MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
