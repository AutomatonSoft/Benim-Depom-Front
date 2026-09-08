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

const localBackend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const useLocalApiProxy = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev API proxy needs the Django trailing slash kept. Without this, Next
  // 308-redirects /api/.../login/ → /api/.../login and the login POST never hits Django.
  // Stage/prod: /api is served by nginx, not Next, so this only affects page URLs lightly.
  skipTrailingSlashRedirect: useLocalApiProxy,
  async redirects() {
    return movedManagerRoutes.flatMap((route) => [
      { source: route, destination: `/manager${route}`, permanent: false },
      { source: `${route}/:path*`, destination: `/manager${route}/:path*`, permanent: false },
    ]);
  },
  async rewrites() {
    // Dev only: browser calls /api/v1 on :3000, Next forwards to local Django.
    // Stage/prod builds use NODE_ENV=production, so this block stays empty and nginx keeps owning /api.
    // Two rules: Next strips trailing slashes from :path* unless the source/destination
    // explicitly keep them — Django APPEND_SLASH then 500s POSTs like /auth/login/.
    if (!useLocalApiProxy) return [];
    const base = localBackend.replace(/\/$/, "");
    return [
      {
        source: "/api/:path*/",
        destination: `${base}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
