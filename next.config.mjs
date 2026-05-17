/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.anitabi.cn' },
      { protocol: 'https', hostname: 'image.anitabi.cn' },
      { protocol: 'https', hostname: 'lain.bgm.tv' }
    ]
  }
};

export default nextConfig;
