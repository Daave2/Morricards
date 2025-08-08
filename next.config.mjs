// next.config.mjs
import withPWA from 'next-pwa';

const isProd = process.env.NODE_ENV === 'production';

// IMPORTANT: Only RegExp or string URL patterns here — no functions.
const runtimeCaching = [
  // Next static assets
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'next-static' },
  },
  // Any other JS/CSS served from your app
  {
    urlPattern: /\/(.*)\.(?:js|css)$/i,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'assets' },
  },
  // Same-origin images from /public and dynamic routes
  {
    urlPattern: /\/(.*)\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'images',
      expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
    },
  },
   // Google Fonts
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
    handler: 'CacheFirst',
    options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } }
  },
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'google-fonts-stylesheets' }
  },
  // Remote images (S3 / Brandbank, tweak as needed)
  {
    urlPattern: /^https?:\/\/(?:images\.morrisons\.com|s3-eu-west-1\.amazonaws\.com)\/.*/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'remote-images',
      expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
    },
  },
  // API routes (NetworkFirst + BackgroundSync for resilience)
  {
    urlPattern: /\/api\/captures\/batch\/.*/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-captures',
      networkTimeoutSeconds: 3,
      backgroundSync: {
        name: 'capture-queue',
        options: { maxRetentionTime: 24 * 60 }, // minutes
      },
    },
  },
];

const withPWANext = withPWA({
  dest: 'public',
  disable: !isProd,
  register: true,
  skipWaiting: true,
  runtimeCaching,
  // Avoid packing ephemeral manifests that can confuse workbox
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig = {
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
        hostname: 's3-eu-west-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.morrisons.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default withPWANext(nextConfig);