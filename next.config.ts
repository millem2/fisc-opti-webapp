import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker deployment (outputs a self-contained server in .next/standalone)
  output: "standalone",
};

export default nextConfig;
