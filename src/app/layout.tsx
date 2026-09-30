import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KSU Events",
  description: "ระบบจัดการกิจกรรม — Workshop Deploy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}