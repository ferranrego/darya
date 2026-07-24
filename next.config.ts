import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // @ts-ignore
  turbopack: {
    root: "./",
  },
};

export default nextConfig;
