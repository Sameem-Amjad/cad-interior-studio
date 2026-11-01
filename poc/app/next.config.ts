import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // web-ifc ships a node build that references fs/path; keep it out of the browser bundle.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
  // The WASM + heavy 3D deps are client-only; nothing here is prerendered on the server.
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default nextConfig;
