import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node binding: keep it out of Turbopack's ESM chunks.
  serverExternalPackages: ["@napi-rs/canvas"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" }],
  },
};

export default nextConfig;
