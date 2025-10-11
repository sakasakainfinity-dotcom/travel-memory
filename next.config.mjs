// next.config.mjs （ESM）
import withPWA from 'next-pwa';
import runtimeCaching from './pwa-cache.js'; // 下のファイルをESMで用意

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

// PWAラッパーで包んでexport
export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production', // devでは無効でOK
  runtimeCaching,
  fallbacks: { document: '/offline' }, // 任意
})(nextConfig);


