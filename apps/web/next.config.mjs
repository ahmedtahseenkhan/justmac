/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @sellme/shared ships as a workspace package; transpile it from source.
  transpilePackages: ["@sellme/shared"],
};

export default nextConfig;
