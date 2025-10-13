import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qszesvxgkowjxxhfprkr.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default withPWA({
  dest: 'public',
  sw: 'sw.js',
  register: true,               // ← 手動登録で統一（後で変えたくなったら true にして SWRegister を外す）
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  fallbacks: { document: '/_offline' },     // ← これ超大事（precacheFallbackエラー潰し）
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
})(nextConfig);


