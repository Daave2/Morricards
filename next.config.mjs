
/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3-eu-west-1.amazonaws.com',
      },
    ],
  },
  experimental: {
    // This is required for the cloud-based development environment.
    allowedDevOrigins: [
      'https://*.cloudworkstations.dev',
    ]
  }
};

const withPWAConfig = withPWA({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
});

export default withPWAConfig(nextConfig);
