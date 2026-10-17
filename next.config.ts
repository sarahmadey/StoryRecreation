import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Book photos are uploaded through route handlers; keep the server free to
  // accept a few megabytes of images per request.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  poweredByHeader: false,
};

export default nextConfig;
