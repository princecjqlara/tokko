import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Increase server-side body size limit
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Force rebuild - ensure API routes are included
};

export default nextConfig;
// Trigger redeploy after connecting correct repo
// Redeploy after connecting to correct repository - Thu Dec  4 17:26:16 MPST 2025
