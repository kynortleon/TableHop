/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '2e.aonprd.com'
      }
    ]
  }
};

module.exports = nextConfig;
