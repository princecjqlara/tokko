import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Increase server-side body size limit
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
