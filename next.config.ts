import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    cpus: 1,
  },
  outputFileTracingExcludes: {
    "/*": [
      "./hoodatm-release.tar.gz",
      "./dev-preview.log",
      "./.deploy/**/*",
      "./.data/**/*",
    ],
  },
};

export default nextConfig;
