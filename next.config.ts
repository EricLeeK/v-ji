import { createRequire } from "node:module";
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// workflow/next 含 top-level await，Next 加载配置时不能直接 ESM import。
const { withWorkflow } = createRequire(import.meta.url)("workflow/next") as {
  withWorkflow: (config: NextConfig) => NextConfig;
};

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["192.168.0.110"],
  devIndicators: false,
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.0.110:3000"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withWorkflow(withSerwist(nextConfig));
