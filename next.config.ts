import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep Prisma + pg as Node externals so Turbopack does not bundle the
  // generated client (fixes "Cannot read properties of undefined (reading 'graph')"
  // during `next build` in some Docker/Linux environments).
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@prisma/adapter-pg",
    "@prisma/driver-adapter-utils",
    "pg",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.shopify.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "*.myshopify.com",
      },
      {
        protocol: "https",
        hostname: "*.ngrok.com",
      },
      {
        protocol: "https",
        hostname: "*.ngrok.io",
      },
      {
        protocol: "https",
        hostname: "*.ngrok-free.dev",
      },
      {
        protocol: "https",
        hostname: "junohub-product-images.s3.us-east-1.amazonaws.com",
      },
    ],
  },
  // Allow ngrok origin for development (fixes cross-origin warnings)
  allowedDevOrigins: [
    "https://precontributive-tribally-dione.ngrok-free.dev",
    "https://*.ngrok-free.dev",
    "https://*.ngrok-free.app",
    "https://brave-destined-gelding.ngrok-free.app",
    "brave-destined-gelding.ngrok-free.app",
    "*.ngrok-free.app",
    "https://*.ngrok.io",
  ],
  reactCompiler: true,
};

export default nextConfig;
