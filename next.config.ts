import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
