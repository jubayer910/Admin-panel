import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pin the root, in case a lockfile sits in a parent folder
  turbopack: { root: __dirname },
};

export default nextConfig;
