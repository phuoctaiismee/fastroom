import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing Next.js dev server resources from local LAN IPs
  allowedDevOrigins: [
    "192.168.15.107",
    "172.16.0.2",
    "localhost:3000",
    "192.168.15.107:3000",
  ],
};

export default nextConfig;
