
/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 's3-eu-west-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'images.morrisons.com',
      },
    ],
  },
};

export default pwaConfig(nextConfig);
