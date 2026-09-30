"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string; success?: string } | undefined;

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 6) {
    return { error: "กรอกข้อมูลให้ครบ และรหัสผ่านอย่างน้อย 6 ตัวอักษร" };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "อีเมลนี้ถูกใช้แล้ว" };

  // สมัครใหม่ได้ role USER เสมอ (เปลี่ยน role ได้โดย Admin เท่านั้น)
  const user = await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 10) },
  });

  await createSession({ userId: user.id, name: user.name, role: user.role });
  redirect("/dashboard");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  await createSession({ userId: user.id, name: user.name, role: user.role });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}