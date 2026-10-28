/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] },
      // The QR attendance scanner needs the camera; every other page keeps it blocked.
      {
        source: "/attendance/scan",
        headers: [...securityHeaders, { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }],
      },
    ];
  },
};

export default nextConfig;
