import type { NextConfig } from "next";

const API_URL = process.env.API_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Legacy standalone validation route → unified Regulation Packs
        source: "/dashboard/validation",
        destination: "/dashboard/packs",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
