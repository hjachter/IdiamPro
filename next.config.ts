import type {NextConfig} from 'next';
import {withSentryConfig} from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
  // Build output directory. Defaults to `.next` (what `npm run dev` on port
  // 9002 and the Electron shell serve live). A test-time or CI build can set
  // NEXT_DIST_DIR to a SEPARATE folder (e.g. `.next-isolated`) so it can NEVER
  // overwrite the running dev server's `.next` and serve it broken/404 assets.
  // See scripts/guard-build.js + the `build:isolated` npm script.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    serverActions: {
      // Voice transcription posts base64-encoded audio via a Server Action.
      // Default is 1MB which can clip longer recordings — raise to 10MB so
      // a normal voice command (a few seconds of webm/opus) always fits.
      bodySizeLimit: '10mb',
    },
  },
  async redirects() {
    return [
      // The standalone /marketing landing page was retired and consolidated
      // into the homepage. Keep old bookmarks / search hits landing on /.
      { source: '/marketing', destination: '/', permanent: true },
    ];
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
