
/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'placehold.co',
            },
            {
                protocol: 'https',
                hostname: 'groceries.morrisons.com',
            },
            {
                protocol: 'https',
                hostname: 's3-eu-west-1.amazonaws.com',
            },
        ],
    },
    experimental: {
      serverActions: {
        // Allow returning closures or functions from server actions
        // This is needed for the cookie clearing action in settings
        allowedForwardedHosts: ['localhost'],
        allowedOrigins: ['localhost:3000'],
      },
    },
};

module.exports = nextConfig;
