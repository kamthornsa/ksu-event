import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const password = await bcrypt.hash("password123", 10);

  // upsert = ถ้ามีแล้วไม่สร้างซ้ำ → รัน seed กี่รอบก็ได้
  const admin = await prisma.user.upsert({
    where: { email: "admin@ksu.ac.th" },
    update: {},
    create: { name: "Admin KSU", email: "admin@ksu.ac.th", password, role: "ADMIN" },
  });
  const staff = await prisma.user.upsert({
    where: { email: "staff@ksu.ac.th" },
    update: {},
    create: { name: "Staff CPE", email: "staff@ksu.ac.th", password, role: "STAFF" },
  });
  await prisma.user.upsert({
    where: { email: "student@ksu.ac.th" },
    update: {},
    create: { name: "Student One", email: "student@ksu.ac.th", password, role: "USER" },
  });

  if ((await prisma.event.count()) === 0) {
    await prisma.event.createMany({
      data: [
        {
          title: "Workshop: Docker & Deploy",
          description: "ฝึก deploy Next.js บน Docker, Vercel, Render และ Cloudflare Tunnel",
          location: "ห้อง Lab 201",
          eventDate: new Date("2026-11-20T09:00:00+07:00"),
          capacity: 30,
          status: "PUBLISHED",
          createdById: staff.id,
        },
        {
          title: "สัมมนางานวิจัย Applied AI",
          description: "นำเสนองานวิจัยของนักศึกษา",
          location: "ห้องประชุม 301",
          eventDate: new Date("2026-12-05T13:00:00+07:00"),
          capacity: 80,
          status: "PUBLISHED",
          createdById: admin.id,
        },
        {
          title: "กิจกรรมร่าง (ยังไม่เผยแพร่)",
          location: "TBA",
          eventDate: new Date("2027-01-10T09:00:00+07:00"),
          createdById: staff.id,
        },
      ],
    });
  }

  console.log("✅ Seed เสร็จแล้ว — รหัสผ่านทุกบัญชี: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());