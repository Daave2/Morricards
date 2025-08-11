/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
  experimental: {
    allowedDevOrigins: [
      "https://*.cloudworkstations.dev",
    ],
  },
  images: {
    remotePatterns: [
        {
            protocol: 'https',
            hostname: 's3-eu-west-1.amazonaws.com',
        },
        {
            protocol: 'https',
            hostname: 'placehold.co',
        }
    ]
  }
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

export default pwaConfig(nextConfig);
