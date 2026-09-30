import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb", // ค่าเริ่มต้น 1MB — ขยายให้พออัปโหลดรูปโปรไฟล์ 2MB
    },
  },
};

export default nextConfig;