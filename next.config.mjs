/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'xlsx', 'pg'],
  },
};

export default nextConfig;
