import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node binding: keep it out of Turbopack's ESM chunks.
  serverExternalPackages: ["@napi-rs/canvas"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/profile-avatars/**" },
    ],
  },
};

export default nextConfig;
