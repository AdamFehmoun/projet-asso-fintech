import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "canvas"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jwogrpkuzmjmabkpsyrd.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

export default nextConfig;