"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { uploadAvatar, deleteFile, ALLOWED_IMAGE_TYPES } from "@/lib/storage";
import type { FormState } from "./auth";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function updateAvatar(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireUser();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์รูป" };
  if (!ALLOWED_IMAGE_TYPES[file.type]) return { error: "รองรับเฉพาะ JPG, PNG, WEBP" };
  if (file.size > MAX_SIZE) return { error: "ไฟล์ต้องไม่เกิน 2 MB" };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const newKey = await uploadAvatar(session.userId, file);

  await prisma.user.update({ where: { id: session.userId }, data: { avatarKey: newKey } });

  // ลบรูปเก่าออกจาก MinIO (ถ้ามี)
  if (user?.avatarKey) await deleteFile(user.avatarKey).catch(() => {});

  revalidatePath("/dashboard", "layout");
  return { success: "อัปโหลดรูปโปรไฟล์สำเร็จ" };
}