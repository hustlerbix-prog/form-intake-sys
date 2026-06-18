/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable server-side X-Powered-By header
  poweredByHeader: false,

  // Vercel serverless functions: bump timeout for AI routes (scraper + analyzer can take ~45s)
  // Set per-route via route segment config instead; this is a global safety net.
  experimental: {
    // Instrument serverless trace to include only what's needed (reduces cold start size)
    outputFileTracingIncludes: {
      "/api/answer": ["./src/**/*"],
      "/api/submit-profile": ["./src/**/*"],
    },
  },

  // Prevent bundling heavy server-only modules into the client
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@playwright/browser-chromium",
    "puppeteer",
    "cheerio",
  ],

  images: {
    // Allow Vercel Image Optimization for any external host you may add
    remotePatterns: [],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
