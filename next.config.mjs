/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [45, 52, 58, 62, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "polymarket-upload.s3.us-east-2.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
