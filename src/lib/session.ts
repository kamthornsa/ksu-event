import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encrypt, decrypt, type Role, type SessionPayload } from "./jwt";

const COOKIE_NAME = "session";

export async function createSession(payload: SessionPayload) {
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript ฝั่ง browser อ่านไม่ได้
    secure: process.env.COOKIE_SECURE === "true", // true เมื่อใช้ HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(COOKIE_NAME)?.value);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ใช้ในหน้า/Server Action: ต้อง login และ (ถ้าระบุ) ต้องมี role ที่กำหนด
export async function requireUser(...roles: Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles.length > 0 && !roles.includes(session.role)) redirect("/dashboard");
  return session;
}