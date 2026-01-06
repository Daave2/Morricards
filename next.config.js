
/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
});

// GitHub Pages configuration
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoName = 'Morricards'; // Your repository name

const nextConfig = {
    // Enable static export for GitHub Pages
    output: 'export',
    
    // Set basePath and assetPrefix for GitHub Pages
    basePath: isGitHubPages ? `/${repoName}` : '',
    assetPrefix: isGitHubPages ? `/${repoName}/` : '',
    
    // Disable image optimization (requires server)
    images: {
        unoptimized: true,
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
                hostname: 'images.morrisons.com',
            },
            {
                protocol: 'https',
                hostname: 's3-eu-west-1.amazonaws.com',
            },
        ],
    },
    
    // Trailing slash for static hosting compatibility
    trailingSlash: true,
};

module.exports = withPWA(nextConfig);
