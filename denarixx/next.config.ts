import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.replit.dev",
    "*.kirk.replit.dev",
    "*.repl.co",
  ],
  devIndicators: false,
};

export default nextConfig;
