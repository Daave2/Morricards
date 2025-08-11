/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

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
    // NOTE: appDir is enabled by default in Next.js 13.4+
  },
  // This is the correct location for allowedDevOrigins
  allowedDevOrigins: [
    'https://6000-firebase-studio-1754152994600.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev',
  ],
};

export default pwaConfig(nextConfig);
