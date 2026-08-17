import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // mysql2 usa APIs de Node que no deben pasar por el bundler del servidor.
  serverExternalPackages: ['mysql2'],
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
