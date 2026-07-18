import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // Image optimization
  images: {
    remotePatterns: [
      // Country flag CDN
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "hatscripts.github.io" },
    ],
  },
  // Experimental flags (Next 16)
  experimental: {
    // Enable typed routes later when stable
  },
};

export default nextConfig;
