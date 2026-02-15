/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "export",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Use web as the project root so Next.js doesn't get confused by the lockfile in the repo root
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
