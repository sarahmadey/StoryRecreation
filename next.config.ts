import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Book photos are uploaded through route handlers; keep the server free to
  // accept a few megabytes of images per request.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  poweredByHeader: false,
  // The service worker (listening without signal) is always checked for a newer version.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
