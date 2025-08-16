
/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 's3-eu-west-1.amazonaws.com',
                port: '',
                pathname: '/mprod.xxwmm.retail.brandbank.zzzzzzzzzz/**',
            },
            {
                protocol: 'https',
                hostname: 'placehold.co',
            }
        ],
    },
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push('handlebars');
        }
        return config;
    },
    experimental: {
        allowedDevOrigins: ["https://6000-firebase-studio-1754152994600.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev"]
    }
};

export default nextConfig;
