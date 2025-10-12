// next.config.mjs (ESM)
import withPWA from 'next-pwa';
import runtimeCaching from './pwa-cache.js'; // あるなら。無ければ後述の最小版を使ってOK

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qszesvxgkowjxxhfprkr.supabase.co', pathname: '/storage/v1/object/public/**' }
    ]
  }
};

// ★ ここがポイント：fallbacks を必ず入れる（/_offline はページ作ったやつ）
export default withPWA({
  dest: 'public',
  sw: 'sw.js',
  register: false,                // 手動登録するなら false（自動にしたいなら true にして <SWRegister/> は削除）
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production', // Preview/本番で有効
  fallbacks: { document: '/_offline' },          // ← これが無いと precacheFallback が undefined になることがある
  runtimeCaching,                                  // 無い場合は一旦消してもOK
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/]
})(nextConfig);



