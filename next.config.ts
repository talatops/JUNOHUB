import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
    "https://*.ngrok.io",
  ],
  reactCompiler: true,
};

export default nextConfig;
