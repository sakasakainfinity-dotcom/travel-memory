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
  register: true,           // さっき0でtrueにしたやつのままでOK
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  fallbacks: { document: '/offline.html' },  // ← ここを差し替え
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
})(nextConfig);



