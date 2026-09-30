import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/jwt";

// Next.js 16: "proxy" (เดิมชื่อ middleware) ทำงานก่อนทุก request ที่ตรง matcher
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await decrypt(req.cookies.get("session")?.value);

  // ยังไม่ login → ไปหน้า login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ป้องกันหน้าตาม role (ด่านแรก — ในหน้า/Action ตรวจซ้ำอีกชั้นด้วย requireUser)
  if (pathname.startsWith("/dashboard/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/dashboard/staff") && session.role === "USER") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};