// pwa-cache.js (ESM)
const WEEK = 7 * 24 * 60 * 60;
const MONTH = 30 * 24 * 60 * 60;
const YEAR = 365 * 24 * 60 * 60;

export default [
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/_next/static/'),
    handler: 'CacheFirst',
    options: { cacheName: 'next-static', expiration: { maxEntries: 512, maxAgeSeconds: YEAR } },
  },
  {
    urlPattern: ({ request }) => request.destination === 'image',
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: MONTH } },
  },
  {
    urlPattern: ({ request }) => request.mode === 'navigate',
    handler: 'NetworkFirst',
    options: { cacheName: 'pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 100, maxAgeSeconds: WEEK } },
  },
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api'),
    handler: 'NetworkOnly',
    options: {}, // ★これが無いと next-pwa 内部で undefined 参照して死ぬ
  },
  {
    urlPattern: /^https:\/\/([a-z0-9-]+\.)?supabase\.co\/.*/i,
    handler: 'NetworkFirst',
    options: { cacheName: 'supabase', networkTimeoutSeconds: 3, expiration: { maxEntries: 200, maxAgeSeconds: WEEK } },
  },
  // 地図タイルはまず除外（規約＆キャッシュ破裂対策）
];

