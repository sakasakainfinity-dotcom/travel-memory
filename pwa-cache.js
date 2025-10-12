// pwa-cache.js (CJSでもESMでも可。mjsなら export default を使う)
const ONE_DAY = 24 * 60 * 60;

const runtimeCaching = [
  // ページ・リソース（Nextの静的/SSR）
  {
    urlPattern: ({ request }) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'next-doc-static',
      expiration: { maxEntries: 100, maxAgeSeconds: 7 * ONE_DAY }
    }
  },
  // 画像
  {
    urlPattern: ({ request }) => request.destination === 'image',
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'images',
      expiration: { maxEntries: 200, maxAgeSeconds: 30 * ONE_DAY }
    }
  },
  // Supabase public storage
  {
    urlPattern: /^https:\/\/qszesvxgkowjxxhfprkr\.supabase\.co\/storage\/v1\/object\/public\//,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'supabase-public',
      expiration: { maxEntries: 300, maxAgeSeconds: 30 * ONE_DAY }
    }
  },
  // APIは都度取りに行く
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api'),
    handler: 'NetworkOnly',
    options: {} // ← 空でも options を必ず置く（これ無いとコケることがある）
  }
];

module.exports = runtimeCaching;
// ESMなら: export default runtimeCaching;
