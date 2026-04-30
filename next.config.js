/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdf-parse', 'mammoth', 'tesseract.js', 'pdf2pic', 'jszip'],
  },
};

module.exports = nextConfig;
