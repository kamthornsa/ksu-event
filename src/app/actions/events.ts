"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { EventStatus } from "@/generated/prisma/enums";

// STAFF / ADMIN: สร้างกิจกรรม (เริ่มเป็น DRAFT)
export async function createEvent(formData: FormData) {
  const session = await requireUser("STAFF", "ADMIN");

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "");
  if (!title || !eventDate) return;

  await prisma.event.create({
    data: {
      title,
      description: String(formData.get("description") ?? ""),
      location: String(formData.get("location") ?? ""),
      eventDate: new Date(eventDate),
      capacity: Number(formData.get("capacity") ?? 50) || 50,
      createdById: session.userId,
    },
  });
  revalidatePath("/dashboard/staff");
}

// STAFF / ADMIN: เปลี่ยนสถานะ DRAFT → PUBLISHED → CLOSED
export async function setEventStatus(eventId: string, status: EventStatus) {
  const session = await requireUser("STAFF", "ADMIN");

  // STAFF แก้ได้เฉพาะกิจกรรมของตัวเอง, ADMIN แก้ได้ทุกกิจกรรม
  await prisma.event.updateMany({
    where: session.role === "ADMIN" ? { id: eventId } : { id: eventId, createdById: session.userId },
    data: { status },
  });
  revalidatePath("/dashboard", "layout");
}

// ทุก role: ลงทะเบียนเข้าร่วมกิจกรรม
export async function joinEvent(eventId: string) {
  const session = await requireUser();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!event || event.status !== "PUBLISHED") return;
  if (event._count.registrations >= event.capacity) return;

  await prisma.registration.upsert({
    where: { userId_eventId: { userId: session.userId, eventId } },
    update: {},
    create: { userId: session.userId, eventId },
  });
  revalidatePath("/dashboard");
}

export async function leaveEvent(eventId: string) {
  const session = await requireUser();
  await prisma.registration.deleteMany({ where: { userId: session.userId, eventId } });
  revalidatePath("/dashboard");
}