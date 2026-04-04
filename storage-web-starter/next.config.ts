/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: process.env.NODE_ENV === 'development',
  webpack: (config: any, { webpack }: any) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    config.externals['node:fs'] = 'commonjs node:fs';
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
    );

    return config;
  },
};

export default nextConfig;
