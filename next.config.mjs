// next.config.mjs
import withPWA from 'next-pwa';

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

// ★ fallbacks を必ず入れる（/_offline は作成済みorこれから作るやつ）
export default withPWA({
  dest: 'public',
  sw: 'sw.js',
  register: false,                // 手動登録なら false（<SWRegister /> を layout に入れてる前提）
  // 自動登録にしたいなら true にして、<SWRegister /> は削除してね
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  fallbacks: { document: '/_offline' },
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
})(nextConfig);



