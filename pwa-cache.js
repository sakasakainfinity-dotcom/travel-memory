// pwa-cache.js
const WEEK = 7 * 24 * 60 * 60, MONTH = 30 * 24 * 60 * 60, YEAR = 365 * 24 * 60 * 60;

module.exports = [
  { // Nextのビルド静的
    urlPattern: ({url}) => url.pathname.startsWith('/_next/static/'),
    handler: 'CacheFirst',
    options: { cacheName: 'next-static', expiration: { maxEntries: 512, maxAgeSeconds: YEAR } }
  },
  { // 画像
    urlPattern: ({request}) => request.destination === 'image',
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: MONTH } }
  },
  { // ページ遷移
    urlPattern: ({request}) => request.mode === 'navigate',
    handler: 'NetworkFirst',
    options: { cacheName: 'pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 100, maxAgeSeconds: WEEK } }
  },
  { // APIはキャッシュしない
    urlPattern: ({url}) => url.pathname.startsWith('/api'),
    handler: 'NetworkOnly'
  },
  { // SupabaseはNetworkFirst（必要なら）
    urlPattern: /^https:\/\/([a-z0-9-]+\.)?supabase\.co\/.*/i,
    handler: 'NetworkFirst',
    options: { cacheName: 'supabase', networkTimeoutSeconds: 3, expiration: { maxEntries: 200, maxAgeSeconds: WEEK } }
  }
  // ※地図タイルはまず除外（規約＆破裂対策）
];
