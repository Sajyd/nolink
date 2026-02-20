/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      "oaidalleapiprodscus.blob.core.windows.net",
      "fal.media",
      "v3.fal.media",
      "placehold.co",
    ],
  },
};

module.exports = nextConfig;
