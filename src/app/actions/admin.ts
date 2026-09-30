"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

const ROLES: Role[] = ["ADMIN", "STAFF", "USER"];

// ADMIN เท่านั้น: เปลี่ยน role ของผู้ใช้
export async function changeRole(userId: string, formData: FormData) {
  const session = await requireUser("ADMIN");
  const role = String(formData.get("role")) as Role;

  if (!ROLES.includes(role)) return;
  if (userId === session.userId) return; // กันไม่ให้ Admin ลดสิทธิ์ตัวเอง

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/dashboard/admin");
}