/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Set to false to enforce lint checks during builds
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Set to false to catch type errors before deployment
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pg', '@prisma/adapter-pg'],

  // Retired surfaces: old links must not dead-end customers.
  // /send (Coming Soon), /yield (not deployed), /acquiring (mock data),
  // /reconciliation (demo data). /swap stays — backed by the live Rango API.
  async redirects() {
    return [
      { source: '/send', destination: '/pay', permanent: false },
      { source: '/yield', destination: '/products', permanent: false },
      { source: '/acquiring/:path*', destination: '/products', permanent: false },
      { source: '/reconciliation', destination: '/history', permanent: false },
    ]
  },

  // Include proto files in all serverless function bundles
  // This ensures gRPC proto definitions are available at runtime on Vercel
  outputFileTracingIncludes: {
    '/api/**': ['./services/proto/**'],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
      };
    }
    return config;
  },
}

export default nextConfig
