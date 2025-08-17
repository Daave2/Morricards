
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
};

module.exports = nextConfig;
