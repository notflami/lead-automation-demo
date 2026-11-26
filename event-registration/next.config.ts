import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // The share-preview image reads the display font from disk at runtime.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./node_modules/@fontsource/yeseva-one/files/*.woff"],
  },
  async headers() {
    const security = (camera: string) => [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: `camera=${camera}, microphone=(), geolocation=(), interest-cohort=()` },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      // Every page except the door scanner: no camera.
      { source: "/:path((?!door$).*)", headers: security("()") },
      // The door scanner reads QR codes with the phone camera.
      { source: "/door", headers: [...security("(self)"), { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/ticket/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
