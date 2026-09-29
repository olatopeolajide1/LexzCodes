/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // snarkjs needs a fully-fledged Node-ish environment in the browser
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
      os: false,
    };
    config.experiments = { ...(config.experiments || {}), asyncWebAssembly: true, topLevelAwait: true };
    // Known-benign: snarkjs dep `web-worker` resolves its worker implementation dynamically.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /web-worker[\\/]cjs[\\/]node\.js/ },
    ];
    return config;
  },
};

export default nextConfig;
