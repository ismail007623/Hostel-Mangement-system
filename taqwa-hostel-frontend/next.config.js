/** @type {import('next').NextConfig} */
const nextConfig = {
  // All /api and /uploads calls are proxied to the FastAPI backend on
  // the same origin, so the browser never hits a cross-origin request
  // (the backend has no CORS middleware in the POC).
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
      { source: "/uploads/:path*", destination: "http://127.0.0.1:8000/uploads/:path*" },
    ];
  },
};

module.exports = nextConfig;
