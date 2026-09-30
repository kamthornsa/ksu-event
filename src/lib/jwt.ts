import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "STAFF" | "USER";

export type SessionPayload = {
  userId: string;
  name: string;
  role: Role;
};

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

// สร้าง JWT อายุ 7 วัน
export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// ตรวจ JWT — ถ้าไม่ถูกต้องหรือหมดอายุ คืน null
export async function decrypt(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}