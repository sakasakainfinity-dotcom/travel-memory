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
  register: false,                 // 自動登録にするなら true にして、layout から <SWRegister /> を削除
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  fallbacks: { document: '/_offline' }, // ← これが無いと preCacheFallback で落ちることがある
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
})(nextConfig);

