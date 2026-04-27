import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack to this app so a stray lockfile elsewhere on the system
  // doesn't get auto-detected as the workspace root.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
