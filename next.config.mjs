/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

const sentryWebpackPluginOptions = {
  silent: true,
}

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions)
