import withPWA from 'next-pwa';

const isProd = process.env.NODE_ENV === 'production';

const runtimeCaching = [
  // App shell & static assets
  {
    urlPattern: ({ request }) => request.destination === 'document',
    handler: 'NetworkFirst',
    options: { cacheName: 'html', networkTimeoutSeconds: 3, fallbacks: { documents: '/offline' } }
  },
  {
    urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'assets' }
  },
  {
    urlPattern: ({ request }) => request.destination === 'image',
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 } }
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
  // Morrisons APIs
  {
    urlPattern: /^https:\/\/api\.morrisons\.com\/.*/,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'morrisons-api',
      networkTimeoutSeconds: 3,
      backgroundSync: {
        name: 'morrisons-api-queue',
        options: { maxRetentionTime: 24 * 60 } // minutes
      }
    }
  },
   // External images (placeholders, etc.)
  {
    urlPattern: /^https?:/i,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'remote-images', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 } }
  }
];

const withPWANext = withPWA({
  dest: 'public',
  disable: !isProd,
  register: true,
  skipWaiting: true,
  runtimeCaching,
  buildExcludes: [/middleware-manifest\.json$/]
});

/** @type {import('next').NextConfig} */
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
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
      ]
    }];
  }
};

export default withPWANext(nextConfig);
