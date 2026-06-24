import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, path: false, crypto: false };
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Adjust the path for server/client side
    config.output.webassemblyModuleFilename = isServer
      ? '../static/wasm/[modulehash].wasm'
      : 'static/wasm/[modulehash].wasm';

    return config;
  },
};

export default nextConfig;
