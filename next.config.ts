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
  webpack: (config, { isServer, webpack }) => {
    // pptxgenjs (used by the "Slide Deck" .pptx export) statically references
    // Node built-ins via the `node:` scheme (e.g. `node:fs`) for its Node
    // file-writing path. In the BROWSER those code paths are never taken (we
    // download the .pptx via a Blob), but webpack still tries to bundle them and
    // fails with UnhandledSchemeError. On the client: rewrite `node:foo` → `foo`
    // and stub those built-ins to empty, so the browser bundle builds clean.
    if (!isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        https: false,
        http: false,
        os: false,
        path: false,
        url: false,
        zlib: false,
        stream: false,
        crypto: false,
      };
    }
    return config;
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
