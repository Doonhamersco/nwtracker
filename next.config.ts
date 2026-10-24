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
    ];
  },
};

export default nextConfig;
