/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply these headers to every route in the app
        source: '/(.*)',
        headers: [
          // CSP frame-ancestors replaces X-Frame-Options (avoids duplicate header conflict with Next.js default)
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          // Stop browsers from guessing file types (MIME sniffing attacks)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Only send the origin (not full URL) as referrer to external sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser APIs that this app doesn't need
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
