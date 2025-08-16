/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3-eu-west-1.amazonaws.com',
        pathname: '/mprod.xxwmm.retail.brandbank.zzzzzzzzzz/images/brandbank/**',
      },
      {
        protocol: 'https' ,
        hostname: 'placehold.co',
        pathname: '/**',
      }
    ],
  },
   webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('handlebars');
    }
    return config
  }
};

module.exports = nextConfig;
