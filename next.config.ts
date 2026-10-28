import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  async redirects() {
    return [
      {
        source: "/metrics",
        destination: "/fitness",
        permanent: false,
      },
      {
        source: "/subscriptions",
        destination: "/expenses",
        permanent: false,
      },
      {
        source: "/subscriptions/:path*",
        destination: "/expenses/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
