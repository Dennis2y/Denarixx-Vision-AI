import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.replit.dev",
    "*.kirk.replit.dev",
    "*.repl.co",
  ],
  devIndicators: false,
  outputFileTracingRoot: path.join(process.cwd(), ".."),
};

export default nextConfig;
