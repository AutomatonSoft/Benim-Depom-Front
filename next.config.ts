import type { NextConfig } from "next";

const movedManagerRoutes = [
  "/login",
  "/products",
  "/sellers",
  "/messages",
  "/eans",
  "/marketplaces",
  "/settings",
  "/managers",
];

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return movedManagerRoutes.flatMap((route) => [
      { source: route, destination: `/manager${route}`, permanent: false },
      { source: `${route}/:path*`, destination: `/manager${route}/:path*`, permanent: false },
    ]);
  },
};

export default nextConfig;
