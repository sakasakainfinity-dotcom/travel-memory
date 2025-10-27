// next.config.mjs
import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  images: {
    // 署名付き: /storage/v1/object/sign/** も来るので public だけ縛るのはNG
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' }, // ← これ一発で網羅
      // もし他のCDNや外部画像があるなら、ここに追記
      // { protocol: 'https', hostname: 'example-cdn.com' },
    ],
    // （任意）最新版ブラウザ向け
    // formats: ['image/avif', 'image/webp'],
  },
};

export default withPWA({
  dest: 'public',
  sw: 'sw.js',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  fallbacks: { document: '/offline.html' },
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
})(nextConfig);


