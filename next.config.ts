import type {NextConfig} from 'next';
import {withSentryConfig} from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      // Voice transcription posts base64-encoded audio via a Server Action.
      // Default is 1MB which can clip longer recordings — raise to 10MB so
      // a normal voice command (a few seconds of webm/opus) always fits.
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

// Sentry wraps the config so source maps upload + tunneling can work later.
// All Sentry features are gated by the SENTRY_DSN env var at runtime; the
// wrapper itself is safe to apply unconditionally and is a no-op without a DSN.
export default withSentryConfig(nextConfig, {
  // Silence Sentry build logs unless explicitly enabled.
  silent: true,
  // Don't fail the build if no Sentry auth token is configured yet —
  // source maps simply won't be uploaded until SENTRY_AUTH_TOKEN is set.
});
