import type { NextConfig } from "next";

// Pictures linked from another website are only shown when that host is listed (comma separated) in IMAGE_HOSTS,
// for example IMAGE_HOSTS=cdn.example.com,pub-abc.r2.dev. Pictures uploaded in the admin come from this site.
const imageHosts = (process.env.IMAGE_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

// Pictures stored on Cloudinary are shown from this account's folder only.
const cloudinaryName = process.env.CLOUDINARY_CLOUD_NAME?.trim();

// Safe-everywhere security headers. A full Content-Security-Policy is not set: Next.js inline scripts need a
// per-request nonce setup first. `frame-ancestors` and X-Frame-Options stop other sites from framing the shop.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      ...imageHosts.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
      ...(cloudinaryName
        ? [
            {
              protocol: "https" as const,
              hostname: "res.cloudinary.com",
              pathname: `/${cloudinaryName}/**`,
            },
          ]
        : []),
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // A stray lockfile exists in the home directory; pin the project root.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
