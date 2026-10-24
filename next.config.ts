import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // The owner side moved behind sign-in (/app/own); keep old links working.
    return [
      { source: "/own", destination: "/app/own", permanent: false },
      { source: "/calgary", destination: "/app/own", permanent: false },
      { source: "/calgary/:plan", destination: "/app/own/:plan", permanent: false },
    ];
  },
  async headers() {
    // Baseline security headers for every route. No sensitive data is
    // cached publicly: user-scoped pages call auth() (dynamic), and the
    // only static pages are the public landing / /demo / /privacy.
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
