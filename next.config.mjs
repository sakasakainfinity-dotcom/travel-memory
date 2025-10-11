// next.config.mjs
import withPWA from 'next-pwa';
import runtimeCaching from './pwa-cache.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qszesvxgkowjxxhfprkr.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  runtimeCaching, // ← ここだけ渡せば十分
})(nextConfig);


