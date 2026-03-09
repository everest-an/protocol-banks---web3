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
