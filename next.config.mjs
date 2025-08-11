
import withPWA from 'next-pwa';

const isDevelopment = process.env.NODE_ENV === 'development';

const pwaConfig = withPWA({
  dest: 'public',
  disable: isDevelopment,
  // Add an empty `swSrc` in dev to avoid "InjectManifest" errors if it tries to run
  swSrc: isDevelopment ? '/dev/null' : undefined, 
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3-eu-west-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'placehold.co',
      }
    ],
  },
  experimental: {
    allowedDevOrigins: ["https://6000-firebase-studio-1754152994600.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev"],
  },
  webpack: (config, { isServer }) => {
    // Disable PWA workbox generation in development
    if (isDevelopment && !isServer) {
      config.plugins = config.plugins.filter(
        (plugin) => plugin.constructor.name !== 'InjectManifest'
      );
    }
    return config;
  },
};

export default pwaConfig(nextConfig);
