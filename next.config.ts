import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Citizen avatars are served from media.warera.io; allow any warera.io
    // subdomain so a sibling CDN host doesn't break optimization.
    remotePatterns: [{ protocol: "https", hostname: "**.warera.io" }],
  },
};

export default nextConfig;
