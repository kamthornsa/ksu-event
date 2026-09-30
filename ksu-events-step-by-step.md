# KSU Events — สร้างแอปทีละขั้นตอน
### Next.js 16 + Prisma 7 + PostgreSQL + MinIO + Docker Compose

คู่มือนี้พาสร้างแอป **KSU Events** (ระบบจัดการกิจกรรม 3 role) ตั้งแต่ศูนย์ ทุกไฟล์ copy ไปวางได้ทันที และผ่านการทดสอบ build, seed, login และการป้องกันหน้าตาม role แล้ว

> **เวอร์ชันที่ทดสอบ (ก.ย. 2026):** Node.js 22 · Next.js 16.3 · React 19.2 · Prisma 7.10 · Tailwind CSS 4 · PostgreSQL 17 · jose 6 · bcryptjs 3

---

## สารบัญ

0. ภาพรวมแอป
1. เตรียมเครื่อง (Windows + WSL2 + Docker Desktop)
2. สร้างโปรเจกต์ Next.js
3. ติดตั้ง packages
4. โครงสร้างไฟล์ทั้งหมด
5. ไฟล์ Environment
6. Docker Compose: PostgreSQL + MinIO
7. Prisma: config, schema, migration
8. Library (`src/lib`)
9. Proxy — ป้องกันหน้าตาม role
10. Server Actions
11. หน้าเว็บและ Components
12. Seed ข้อมูลตัวอย่าง
13. `next.config.ts` และ scripts
14. รันโหมด Dev และทดสอบ
15. รันทั้งระบบใน Docker (โหมด Production)
16. Push ขึ้น GitHub
17. แก้ปัญหาที่พบบ่อย
18. สรุปคำสั่งทั้งหมด

---

## 0. ภาพรวมแอป

**3 Roles และสิทธิ์**

| Role | ทำอะไรได้ |
|------|-----------|
| `USER` | ดูกิจกรรมที่เผยแพร่, ลงทะเบียน/ยกเลิก, อัปโหลดรูปโปรไฟล์ |
| `STAFF` | ทุกอย่างของ USER + สร้างกิจกรรม, เผยแพร่/ปิดรับสมัคร (เฉพาะของตัวเอง) |
| `ADMIN` | ทุกอย่างของ STAFF + จัดการกิจกรรมทุกอัน + เปลี่ยน role ผู้ใช้ |

**Workflow ของกิจกรรม**

```
STAFF สร้าง → [DRAFT] → เผยแพร่ → [PUBLISHED] → ปิดรับสมัคร → [CLOSED]
                                      ↑
                              USER เห็นและลงทะเบียนได้เฉพาะสถานะนี้
```

**สถาปัตยกรรม**

```
Browser ──► Next.js (Server Components + Server Actions)
                │                         │
                ▼                         ▼
        PostgreSQL (Prisma)        MinIO (รูปโปรไฟล์, S3 API)
```

**ทำไมเลือกเทคโนโลยีเหล่านี้**

- **Server Actions** แทน API routes — โค้ดน้อยลง ฟอร์มส่งข้อมูลไปฟังก์ชันฝั่ง server โดยตรง
- **jose (JWT ใน cookie)** แทน Auth.js — Auth.js v5 ยังเป็น beta; เขียนเองประมาณ 60 บรรทัดทำให้นักศึกษาเห็นกลไก session ชัดเจน
- **Prisma 7 + `@prisma/adapter-pg`** — ไม่ต้องใช้ binary query engine ทำให้ Docker image บน Alpine ไม่มีปัญหาเรื่อง platform
- **AWS SDK (S3 API)** — โค้ดเดียวกันใช้ได้กับ MinIO, Cloudflare R2, AWS S3 เปลี่ยนแค่ env

---

## 1. เตรียมเครื่อง

### 1.1 โปรแกรมที่ต้องมี

| โปรแกรม | ตรวจสอบด้วยคำสั่ง |
|---------|------------------|
| Node.js 20.9+ (แนะนำ 22 LTS) | `node -v` |
| Docker Desktop | `docker --version` และ `docker compose version` |
| Git | `git --version` |
| VS Code (+ extension Prisma, Tailwind CSS) | — |

### 1.2 ใช้ WSL2 (แนะนำสำหรับ Windows)

1. เปิด PowerShell (Run as Administrator) แล้วติดตั้ง WSL:

   ```powershell
   wsl --install -d Ubuntu
   ```

2. Docker Desktop → **Settings → Resources → WSL Integration** → เปิด Ubuntu
3. เปิด Ubuntu terminal แล้วติดตั้ง Node.js ผ่าน nvm:

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   source ~/.bashrc
   nvm install 22
   node -v
   ```

> **ข้อแนะนำเรื่องตำแหน่งโปรเจกต์:** ถ้าใช้ WSL ให้เก็บโปรเจกต์ใน `~/projects` (filesystem ของ Linux) แทน `/mnt/d/...` เพราะเร็วกว่าหลายเท่า และ hot-reload ทำงานได้ถูกต้อง เปิดด้วย VS Code ได้โดยพิมพ์ `code .` ใน WSL

```bash
mkdir -p ~/projects && cd ~/projects
```

---

## 2. สร้างโปรเจกต์ Next.js

```bash
npx create-next-app@16 ksu-events \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --turbopack \
  --no-react-compiler --yes

cd ksu-events
```

| Flag | ความหมาย |
|------|----------|
| `--ts` | ใช้ TypeScript |
| `--tailwind` | ติดตั้ง Tailwind CSS v4 |
| `--app` | ใช้ App Router |
| `--src-dir` | เก็บโค้ดใน `src/` |
| `--import-alias "@/*"` | import แบบ `@/lib/prisma` แทน `../../lib/prisma` |
| `--yes` | ไม่ถามคำถามเพิ่ม |

ทดสอบว่าสร้างสำเร็จ:

```bash
npm run dev
# เปิด http://localhost:3000 → เห็นหน้า Next.js → กด Ctrl+C เพื่อหยุด
```

> create-next-app จะสร้างไฟล์ `AGENTS.md` และ `CLAUDE.md` มาด้วย (คำแนะนำสำหรับ AI coding agent) เก็บไว้หรือลบก็ได้ ไม่มีผลกับแอป

---

## 3. ติดตั้ง packages

```bash
# dependencies ที่แอปใช้ตอนรัน
npm install @prisma/client@7 @prisma/adapter-pg@7 pg @aws-sdk/client-s3 jose bcryptjs

# dev dependencies (ใช้ตอนพัฒนา/build)
npm install -D prisma@7 tsx dotenv @types/pg
```

| Package | หน้าที่ |
|---------|---------|
| `@prisma/client` | Prisma Client สำหรับ query database |
| `@prisma/adapter-pg` + `pg` | Driver adapter เชื่อม Prisma กับ PostgreSQL (บังคับใน Prisma 7) |
| `@aws-sdk/client-s3` | คุยกับ MinIO / R2 / S3 ผ่าน S3 API |
| `jose` | สร้างและตรวจสอบ JWT (ทำงานได้ทั้ง Node และ Edge) |
| `bcryptjs` | hash รหัสผ่าน |
| `prisma` | CLI: migrate, generate, studio, seed |
| `tsx` | รันไฟล์ TypeScript โดยตรง (ใช้รัน seed) |
| `dotenv` | โหลด `.env` ให้ Prisma CLI |

> **สำคัญ:** ต้องระบุ `@7` เสมอ เพราะ tag `latest` ของ Prisma บน npm ตอนนี้ชี้ไปที่ 8.0.0-rc (ยังไม่ stable)

---

## 4. โครงสร้างไฟล์ทั้งหมด

```
ksu-events/
├── compose.yaml              ← Docker: PostgreSQL + MinIO + App
├── Dockerfile                ← สร้าง image ของแอป (multi-stage)
├── .dockerignore
├── .env                      ← ค่าจริง (ห้าม commit)
├── .env.example              ← template ให้เพื่อน copy
├── .gitignore
├── next.config.ts
├── prisma.config.ts          ← ตั้งค่า Prisma CLI (ใหม่ใน Prisma 7)
├── package.json
├── prisma/
│   ├── schema.prisma         ← โครงสร้างฐานข้อมูล
│   ├── seed.ts               ← ข้อมูลตัวอย่าง
│   └── migrations/           ← สร้างอัตโนมัติจาก migrate dev
└── src/
    ├── proxy.ts              ← ด่านตรวจ login/role ก่อนเข้าหน้า (Next.js 16)
    ├── generated/prisma/     ← Prisma Client (สร้างจาก generate, ห้าม commit)
    ├── lib/
    │   ├── prisma.ts         ← เชื่อมต่อ database
    │   ├── jwt.ts            ← สร้าง/ตรวจ JWT
    │   ├── session.ts        ← จัดการ cookie + requireUser()
    │   └── storage.ts        ← อัปโหลด/ลบไฟล์ใน MinIO
    ├── components/
    │   ├── AuthForm.tsx      ← ฟอร์ม login/register (client)
    │   ├── Avatar.tsx        ← แสดงรูปโปรไฟล์
    │   └── AvatarForm.tsx    ← ฟอร์มอัปโหลดรูป (client)
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── page.tsx          ← หน้าแรก
        ├── login/page.tsx
        ├── register/page.tsx
        ├── actions/          ← Server Actions ("use server")
        │   ├── auth.ts       ← register, login, logout
        │   ├── profile.ts    ← อัปโหลดรูปโปรไฟล์
        │   ├── events.ts     ← สร้าง/เผยแพร่/ลงทะเบียนกิจกรรม
        │   └── admin.ts      ← เปลี่ยน role
        └── dashboard/
            ├── layout.tsx    ← เมนูด้านบน (แสดงตาม role)
            ├── page.tsx      ← รายการกิจกรรม (ทุก role)
            ├── profile/page.tsx
            ├── staff/page.tsx  ← STAFF + ADMIN
            └── admin/page.tsx  ← ADMIN เท่านั้น
```

**สร้างโฟลเดอร์ทั้งหมดในครั้งเดียว** (รันใน bash / WSL / Git Bash):

```bash
mkdir -p prisma src/lib src/components src/app/actions \
  src/app/login src/app/register \
  src/app/dashboard/profile src/app/dashboard/staff src/app/dashboard/admin
```

> **ระวัง:** อย่าใช้รูปแบบ `mkdir -p src/{lib,components}` ถ้า shell ไม่ใช่ bash (เช่น `sh` หรือ PowerShell) เพราะจะได้โฟลเดอร์ชื่อ `{lib,components}` แทน — ใช้คำสั่งข้างบนที่เขียน path เต็มปลอดภัยกว่า

**PowerShell (ถ้าไม่ใช้ WSL):**

```powershell
"prisma","src/lib","src/components","src/app/actions","src/app/login","src/app/register","src/app/dashboard/profile","src/app/dashboard/staff","src/app/dashboard/admin" | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ }
```

---

## 5. ไฟล์ Environment

### 5.1 `.env.example` (commit ขึ้น Git ได้)

```bash
# ─── Database ───
DATABASE_URL="postgresql://ksu:ksu1234@localhost:5432/ksuevents"

# ─── Auth (JWT) ─── สร้างใหม่ด้วย: openssl rand -base64 32
AUTH_SECRET="dev-secret-change-me-at-least-32-characters"
COOKIE_SECURE="false"

# ─── Storage (MinIO / S3-compatible) ───
S3_ENDPOINT="http://localhost:9000"
S3_PUBLIC_URL="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="avatars"
```

### 5.2 สร้าง `.env` สำหรับใช้งานจริง

```bash
cp .env.example .env
```

**ตัวแปรสำคัญ**

| ตัวแปร | ความหมาย |
|--------|----------|
| `DATABASE_URL` | connection string ของ PostgreSQL รูปแบบ `postgresql://user:pass@host:port/db` |
| `AUTH_SECRET` | กุญแจเซ็น JWT ต้องยาว ≥ 32 ตัวอักษรและเป็นความลับ |
| `COOKIE_SECURE` | `true` เมื่อเว็บใช้ HTTPS (Vercel, Render, Cloudflare Tunnel) |
| `S3_ENDPOINT` | URL ที่ **server** ใช้เชื่อม MinIO |
| `S3_PUBLIC_URL` | URL ที่ **browser** ใช้โหลดรูป |

> **ทำไมต้องมีทั้ง `S3_ENDPOINT` และ `S3_PUBLIC_URL`?** ตอนแอปรันใน Docker, server เรียก MinIO ผ่านชื่อ service `http://minio:9000` แต่ browser ของผู้ใช้ไม่รู้จักชื่อ `minio` ต้องใช้ `http://localhost:9000` แทน นี่คือแนวคิด "internal vs public URL" ที่เจอบ่อยตอน deploy จริง

### 5.3 แก้ `.gitignore`

create-next-app ใส่ `.env*` ไว้ ซึ่งจะ ignore `.env.example` ไปด้วย เพิ่มบรรทัดเหล่านี้ท้ายไฟล์ `.gitignore`:

```gitignore
# allow env template
!.env.example

# prisma generated client
/src/generated
```

---

## 6. Docker Compose: PostgreSQL + MinIO

### 6.1 `compose.yaml`

```yaml
services:
  # ─────────── PostgreSQL ───────────
  db:
    image: postgres:17-alpine
    container_name: ksu_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ksu
      POSTGRES_PASSWORD: ksu1234
      POSTGRES_DB: ksuevents
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ksu -d ksuevents"]
      interval: 5s
      timeout: 5s
      retries: 10

  # ─────────── MinIO (S3-compatible storage) ───────────
  minio:
    image: minio/minio:latest
    container_name: ksu_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000" # S3 API (แอปและ browser ใช้โหลดรูป)
      - "9001:9001" # Web Console
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 10

  # ─────────── สร้าง bucket อัตโนมัติ (รันครั้งเดียวแล้วจบ) ───────────
  minio-init:
    image: minio/mc:latest
    container_name: ksu_minio_init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      mc mb --ignore-existing local/avatars &&
      mc anonymous set download local/avatars &&
      echo 'bucket avatars ready'
      "

  # ─────────── Next.js App ───────────
  app:
    build: .
    container_name: ksu_app
    restart: unless-stopped
    profiles: ["app"] # รันเฉพาะเมื่อสั่ง --profile app
    depends_on:
      db:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully
    environment:
      DATABASE_URL: postgresql://ksu:ksu1234@db:5432/ksuevents # host = ชื่อ service "db"
      AUTH_SECRET: docker-secret-change-me-at-least-32-characters
      COOKIE_SECURE: "false"
      S3_ENDPOINT: http://minio:9000 # server → MinIO (ภายใน Docker network)
      S3_PUBLIC_URL: http://localhost:9000 # browser → MinIO (ผ่าน port ที่ map ออกมา)
      S3_REGION: us-east-1
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET: avatars
    ports:
      - "3000:3000"

volumes:
  pg_data:
  minio_data:
```

**อธิบายแต่ละ service**

| Service | หน้าที่ | จุดที่ควรสังเกต |
|---------|---------|----------------|
| `db` | PostgreSQL 17 | `healthcheck` ใช้ `pg_isready` ให้ service อื่นรอจน DB พร้อมจริง |
| `minio` | Object storage แบบ S3 | port 9000 = API, 9001 = Web Console |
| `minio-init` | สร้าง bucket `avatars` และตั้งให้อ่านได้สาธารณะ | รันเสร็จแล้วหยุด (one-shot) — สถานะ `Exited (0)` คือปกติ |
| `app` | Next.js | มี `profiles: ["app"]` จึง **ไม่รัน** จนกว่าจะสั่ง `--profile app` (ใช้ในขั้นตอน 15) |

> ไฟล์ชื่อ `compose.yaml` คือชื่อมาตรฐานปัจจุบันของ Docker Compose (ยังรองรับ `docker-compose.yml` เดิม) และไม่ต้องใส่ `version:` แล้ว

> **หมายเหตุ MinIO:** ตั้งแต่ปลายปี 2025 MinIO เปลี่ยนนโยบายการแจก Docker image ของ community edition และ Web Console ในเวอร์ชันใหม่เหลือแค่ฟังก์ชันดู/จัดการไฟล์ (bucket สร้างผ่าน `minio-init` แทน) ถ้า `docker compose pull` ไม่พบ image ให้ตรวจสอบ tag ที่มีบน Docker Hub หรือเอกสารของ MinIO อีกครั้ง — โค้ดแอปไม่ต้องแก้เพราะใช้ S3 API มาตรฐาน

### 6.2 เปิด Database และ MinIO

```bash
docker compose up -d
docker compose ps -a
```

ผลที่ควรเห็น:

```
NAME             STATUS
ksu_db           Up (healthy)
ksu_minio        Up (healthy)
ksu_minio_init   Exited (0)      ← ปกติ งานเสร็จแล้ว
```

ตรวจว่าสร้าง bucket แล้ว:

```bash
docker compose logs minio-init
# ...bucket avatars ready
```

เปิด MinIO Console: http://localhost:9001 (login `minioadmin` / `minioadmin`) จะเห็น bucket `avatars`

---

## 7. Prisma: config, schema, migration

### 7.1 `prisma.config.ts` (ที่ root ของโปรเจกต์)

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

Prisma 7 ย้ายการตั้งค่า CLI (ตำแหน่ง schema, connection URL, คำสั่ง seed) มาไว้ในไฟล์นี้ ไฟล์นี้ใช้กับคำสั่ง `prisma ...` เท่านั้น ตัวแอปเชื่อมต่อ database ผ่าน adapter ใน `src/lib/prisma.ts`

### 7.2 `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  ADMIN
  STAFF
  USER
}

enum EventStatus {
  DRAFT
  PUBLISHED
  CLOSED
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(USER)
  avatarKey String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  events        Event[]        @relation("EventCreator")
  registrations Registration[]
}

model Event {
  id          String      @id @default(cuid())
  title       String
  description String      @default("")
  location    String      @default("")
  eventDate   DateTime
  capacity    Int         @default(50)
  status      EventStatus @default(DRAFT)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  createdById String
  createdBy   User   @relation("EventCreator", fields: [createdById], references: [id])

  registrations Registration[]

  @@index([status, eventDate])
}

model Registration {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  userId  String
  eventId String
  user    User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  event   Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([userId, eventId])
}
```

**อธิบาย schema**

| ส่วน | ความหมาย |
|------|----------|
| `provider = "prisma-client"` + `output` | Generator ใหม่ของ Prisma 7 สร้าง client เป็นไฟล์ TypeScript ไว้ใน `src/generated/prisma` |
| `datasource db` | ไม่มี `url` แล้ว (ย้ายไปอยู่ใน `prisma.config.ts`) |
| `enum Role` | จำกัดค่า role ให้มีแค่ 3 แบบ ระดับ database |
| `avatarKey String?` | เก็บ **key** ของไฟล์ใน MinIO (เช่น `users/abc/123.jpg`) ไม่เก็บ URL เต็ม เพื่อให้ย้าย storage ได้โดยไม่ต้องแก้ข้อมูล |
| `@relation("EventCreator")` | ความสัมพันธ์ 1:N ระหว่าง User (ผู้สร้าง) กับ Event |
| `Registration` | ตารางกลางแบบ N:M ระหว่าง User กับ Event |
| `@@unique([userId, eventId])` | ป้องกันการลงทะเบียนกิจกรรมเดียวซ้ำ |
| `onDelete: Cascade` | ลบ user/event แล้วลบ registration ที่เกี่ยวข้องอัตโนมัติ |
| `@@index([status, eventDate])` | เร่ง query "กิจกรรมที่ PUBLISHED เรียงตามวันที่" |

**ER Diagram**

```
User 1 ──────< Event            (User สร้าง Event ได้หลายอัน)
User 1 ──────< Registration >────── 1 Event
```

### 7.3 สร้างตารางในฐานข้อมูล (migration)

ต้องเปิด `db` ไว้ก่อน (ขั้นตอน 6.2) แล้วรัน:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

- `migrate dev` → สร้างไฟล์ SQL ใน `prisma/migrations/` และสร้างตารางใน database
- `generate` → สร้าง Prisma Client ใน `src/generated/prisma/`

> **Prisma 7:** `migrate dev` ไม่รัน `generate` และ `seed` ให้อัตโนมัติเหมือนเวอร์ชันก่อน ต้องสั่งเองทุกครั้ง
>
> **ทุกครั้งที่แก้ `schema.prisma`:** รัน `npx prisma migrate dev --name <ชื่อการเปลี่ยนแปลง>` แล้วตามด้วย `npx prisma generate`

---

## 8. Library (`src/lib`)

### 8.1 `src/lib/prisma.ts` — เชื่อมต่อ database

```ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// เก็บ instance ไว้ใน globalThis กันการสร้าง connection ซ้ำตอน hot-reload (dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- สร้าง `PrismaPg` adapter จาก `DATABASE_URL` แล้วส่งให้ `PrismaClient`
- ตอน `npm run dev` Next.js จะ reload โมดูลบ่อย ถ้าไม่เก็บไว้ใน `globalThis` จะเปิด connection ใหม่ทุกครั้งจนเต็ม (pattern มาตรฐานที่ Prisma แนะนำ)

### 8.2 `src/lib/jwt.ts` — สร้าง/ตรวจ JWT

```ts
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
```

แยกไฟล์นี้ออกมาเพราะ `proxy.ts` ต้องใช้ `decrypt` แต่ไม่ควร import สิ่งที่ผูกกับ `next/headers`

**JWT ทำงานอย่างไร:** server เซ็นข้อมูล `{ userId, name, role }` ด้วย `AUTH_SECRET` แล้วเก็บใน cookie ทุก request server ตรวจลายเซ็น ถ้ามีคนแก้ role ใน cookie เอง ลายเซ็นจะไม่ตรงและถูกปฏิเสธ

### 8.3 `src/lib/session.ts` — cookie และ `requireUser()`

```ts
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
```

| Cookie option | ความหมาย |
|---------------|----------|
| `httpOnly` | JavaScript ในหน้าเว็บอ่าน cookie ไม่ได้ (ป้องกัน XSS ขโมย token) |
| `secure` | ส่ง cookie เฉพาะ HTTPS — ควบคุมด้วย `COOKIE_SECURE` |
| `sameSite: "lax"` | ลดความเสี่ยง CSRF |

`requireUser("STAFF", "ADMIN")` ใช้ในทุกหน้าและทุก Server Action ที่ต้องการสิทธิ์ ถ้าไม่ผ่านจะ redirect ทันที

### 8.4 `src/lib/storage.ts` — MinIO / S3

```ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "avatars";

// S3-compatible client: ใช้ได้ทั้ง MinIO, Cloudflare R2, AWS S3 (เปลี่ยนแค่ env)
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT, // URL ที่ "server" ใช้คุยกับ storage
  forcePathStyle: true, // MinIO ต้องใช้ http://host/bucket/key
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadAvatar(userId: string, file: File) {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const key = `users/${userId}/${Date.now()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );
  return key;
}

export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// URL ที่ "browser" ใช้แสดงรูป (อาจต่างจาก S3_ENDPOINT เมื่อรันใน Docker)
export function publicUrl(key: string | null | undefined) {
  if (!key) return null;
  return `${process.env.S3_PUBLIC_URL}/${BUCKET}/${key}`;
}
```

- `forcePathStyle: true` → ใช้ URL แบบ `http://host/bucket/key` (MinIO ต้องใช้แบบนี้)
- `key` มี timestamp เพื่อให้ browser ไม่ใช้รูปเก่าจาก cache เมื่ออัปโหลดใหม่
- เปลี่ยนไปใช้ Cloudflare R2 หรือ AWS S3 ได้โดยแก้แค่ค่า `S3_*` ใน env

---

## 9. Proxy — ป้องกันหน้าตาม role

### `src/proxy.ts`

```ts
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
```

> **Next.js 16:** `middleware.ts` เปลี่ยนชื่อเป็น `proxy.ts` และฟังก์ชันชื่อ `proxy` ไฟล์ต้องอยู่ใน `src/` (ระดับเดียวกับ `app/`)

**Defense in depth (ป้องกัน 2 ชั้น)**

```
Request ──► [ชั้น 1: proxy.ts]  ตรวจ JWT + role จาก URL (เร็ว, ก่อน render)
                  │
                  ▼
            [ชั้น 2: requireUser()]  ในทุกหน้าและทุก Server Action
```

ต้องตรวจซ้ำใน Server Action เพราะ action ถูกเรียกผ่าน HTTP POST ได้โดยตรง ไม่จำเป็นต้องผ่าน URL ที่ proxy ดักไว้

---

## 10. Server Actions

ไฟล์ที่ขึ้นต้นด้วย `"use server"` คือฟังก์ชันที่รันบน server เสมอ เรียกจาก `<form action={...}>` ได้โดยตรง

### 10.1 `src/app/actions/auth.ts`

```ts
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
```

- สมัครใหม่ได้ role `USER` เสมอ (ป้องกันการสมัครเป็น ADMIN เอง)
- ข้อความ error ของ login ไม่บอกว่าผิดที่อีเมลหรือรหัสผ่าน (ป้องกันการเดาว่าอีเมลนี้มีในระบบ)

### 10.2 `src/app/actions/profile.ts`

```ts
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
```

ขั้นตอน: ตรวจชนิด/ขนาดไฟล์ → อัปโหลดขึ้น MinIO → บันทึก key ลง database → ลบรูปเก่า → `revalidatePath` ให้หน้าแสดงรูปใหม่

### 10.3 `src/app/actions/events.ts`

```ts
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
```

- `updateMany` พร้อมเงื่อนไข `createdById` ทำให้ STAFF แก้ได้เฉพาะกิจกรรมของตัวเอง
- `upsert` กันการลงทะเบียนซ้ำ

### 10.4 `src/app/actions/admin.ts`

```ts
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
```

> **ข้อจำกัดของ JWT:** role เก็บอยู่ใน token เมื่อ Admin เปลี่ยน role ผู้ใช้คนนั้นต้อง **logout แล้ว login ใหม่** จึงจะเห็นเมนูใหม่ (เป็นจุดดีสำหรับอภิปรายเรื่อง stateless vs database session)

---

## 11. หน้าเว็บและ Components

### 11.1 `src/app/globals.css` (แทนที่ของเดิมทั้งหมด)

```css
@import "tailwindcss";

body {
  font-family: system-ui, "Segoe UI", "Noto Sans Thai", sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

.input {
  @apply w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500;
}
.btn {
  @apply rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50;
}
.btn-outline {
  @apply rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100;
}
.card {
  @apply rounded-lg border border-slate-200 bg-white p-5 shadow-sm;
}
```

### 11.2 `src/app/layout.tsx` (แทนที่ของเดิม)

```tsx
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
```

> ตัด `next/font/google` ออกจากไฟล์ต้นแบบ เพราะต้องดาวน์โหลดฟอนต์ตอน build ซึ่งอาจล้มเหลวในเครือข่ายที่มี proxy/firewall หรือตอน `docker build`

### 11.3 `src/app/page.tsx` — หน้าแรก (แทนที่ของเดิม)

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">KSU Events</h1>
      <p className="text-slate-600">ระบบจัดการกิจกรรม — Admin / Staff / User</p>
      <div className="flex gap-3">
        <Link href="/login" className="btn">เข้าสู่ระบบ</Link>
        <Link href="/register" className="btn-outline">สมัครสมาชิก</Link>
      </div>
    </main>
  );
}
```

### 11.4 `src/components/AuthForm.tsx` — ฟอร์ม login/register

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";

  return (
    <form action={action} className="card w-full max-w-sm space-y-4">
      <h1 className="text-xl font-bold">{isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>

      {!isLogin && <input name="name" placeholder="ชื่อ-นามสกุล" className="input" required />}
      <input name="email" type="email" placeholder="อีเมล" className="input" required />
      <input name="password" type="password" placeholder="รหัสผ่าน" className="input" required />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button className="btn w-full" disabled={pending}>
        {pending ? "กำลังดำเนินการ..." : isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isLogin ? (
          <>ยังไม่มีบัญชี? <Link href="/register" className="text-indigo-600">สมัครสมาชิก</Link></>
        ) : (
          <>มีบัญชีแล้ว? <Link href="/login" className="text-indigo-600">เข้าสู่ระบบ</Link></>
        )}
      </p>
    </form>
  );
}
```

- `"use client"` เพราะใช้ hook `useActionState` เพื่อแสดง error และสถานะ pending
- ใช้ component เดียวทั้ง login และ register ด้วย prop `mode`

### 11.5 `src/app/login/page.tsx`

```tsx
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="login" />
    </main>
  );
}
```

### 11.6 `src/app/register/page.tsx`

```tsx
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="register" />
    </main>
  );
}
```

### 11.7 `src/components/Avatar.tsx`

```tsx
/* eslint-disable @next/next/no-img-element */
export default function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img src={url} alt={name} width={size} height={size}
        className="rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  // ไม่มีรูป → แสดงตัวอักษรแรกของชื่อ
  return (
    <div className="flex items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700"
      style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
```

ใช้ `<img>` ธรรมดาแทน `next/image` เพื่อไม่ต้องตั้งค่า `remotePatterns` ทุกครั้งที่เปลี่ยน storage (MinIO → R2 → S3)

### 11.8 `src/components/AvatarForm.tsx`

```tsx
"use client";

import { useActionState } from "react";
import { updateAvatar } from "@/app/actions/profile";

export default function AvatarForm() {
  const [state, action, pending] = useActionState(updateAvatar, undefined);

  return (
    <form action={action} className="space-y-3">
      <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" className="input" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">{state.success}</p>}
      <button className="btn" disabled={pending}>{pending ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}</button>
    </form>
  );
}
```

### 11.9 `src/app/dashboard/layout.tsx` — เมนูตาม role

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { logout } from "@/app/actions/auth";
import Avatar from "@/components/Avatar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3 text-sm">
          <Link href="/dashboard" className="font-bold">KSU Events</Link>
          <Link href="/dashboard">กิจกรรม</Link>
          {session.role !== "USER" && <Link href="/dashboard/staff">จัดการกิจกรรม</Link>}
          {session.role === "ADMIN" && <Link href="/dashboard/admin">จัดการผู้ใช้</Link>}

          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard/profile" className="flex items-center gap-2">
              <Avatar url={publicUrl(user?.avatarKey)} name={session.name} size={32} />
              <span>{session.name}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{session.role}</span>
            </Link>
            <form action={logout}>
              <button className="btn-outline">ออกจากระบบ</button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
```

### 11.10 `src/app/dashboard/page.tsx` — รายการกิจกรรม

```tsx
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { joinEvent, leaveEvent } from "@/app/actions/events";

export default async function EventsPage() {
  const session = await requireUser();

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { eventDate: "asc" },
    include: {
      _count: { select: { registrations: true } },
      registrations: { where: { userId: session.userId } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">กิจกรรมที่เปิดรับสมัคร</h1>
      {events.length === 0 && <p className="text-slate-500">ยังไม่มีกิจกรรม</p>}

      {events.map((event) => {
        const joined = event.registrations.length > 0;
        const full = event._count.registrations >= event.capacity;
        return (
          <div key={event.id} className="card flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{event.title}</h2>
              <p className="text-sm text-slate-600">{event.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                📅 {event.eventDate.toLocaleString("th-TH")} · 📍 {event.location} · 👥{" "}
                {event._count.registrations}/{event.capacity}
              </p>
            </div>
            {joined ? (
              <form action={leaveEvent.bind(null, event.id)}>
                <button className="btn-outline">ยกเลิก</button>
              </form>
            ) : (
              <form action={joinEvent.bind(null, event.id)}>
                <button className="btn" disabled={full}>{full ? "เต็มแล้ว" : "ลงทะเบียน"}</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

`joinEvent.bind(null, event.id)` คือการ "ผูก" `eventId` เข้ากับ Server Action ล่วงหน้า เมื่อกดปุ่ม ฟอร์มจะเรียก `joinEvent(event.id)`

### 11.11 `src/app/dashboard/profile/page.tsx`

```tsx
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import Avatar from "@/components/Avatar";
import AvatarForm from "@/components/AvatarForm";

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });

  return (
    <div className="card max-w-md space-y-4">
      <h1 className="text-xl font-bold">โปรไฟล์</h1>
      <div className="flex items-center gap-4">
        <Avatar url={publicUrl(user.avatarKey)} name={user.name} size={80} />
        <div>
          <p className="font-semibold">{user.name}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
          <p className="text-xs text-slate-500">Role: {user.role}</p>
        </div>
      </div>
      <AvatarForm />
    </div>
  );
}
```

### 11.12 `src/app/dashboard/staff/page.tsx` — STAFF + ADMIN

```tsx
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createEvent, setEventStatus } from "@/app/actions/events";

export default async function StaffPage() {
  const session = await requireUser("STAFF", "ADMIN");

  // ADMIN เห็นทุกกิจกรรม, STAFF เห็นเฉพาะของตัวเอง
  const events = await prisma.event.findMany({
    where: session.role === "ADMIN" ? {} : { createdById: session.userId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true, _count: { select: { registrations: true } } },
  });

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <form action={createEvent} className="card h-fit space-y-3">
        <h2 className="font-bold">สร้างกิจกรรมใหม่</h2>
        <input name="title" placeholder="ชื่อกิจกรรม" className="input" required />
        <textarea name="description" placeholder="รายละเอียด" className="input" rows={3} />
        <input name="location" placeholder="สถานที่" className="input" />
        <input name="eventDate" type="datetime-local" className="input" required />
        <input name="capacity" type="number" min={1} defaultValue={50} className="input" />
        <button className="btn w-full">บันทึก (Draft)</button>
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">กิจกรรม ({events.length})</h2>
        {events.map((e) => (
          <div key={e.id} className="card flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{e.title}</p>
              <p className="text-xs text-slate-500">
                โดย {e.createdBy.name} · ผู้สมัคร {e._count.registrations}/{e.capacity}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{e.status}</span>
              {e.status === "DRAFT" && (
                <form action={setEventStatus.bind(null, e.id, "PUBLISHED")}>
                  <button className="btn-outline">เผยแพร่</button>
                </form>
              )}
              {e.status === "PUBLISHED" && (
                <form action={setEventStatus.bind(null, e.id, "CLOSED")}>
                  <button className="btn-outline">ปิดรับสมัคร</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 11.13 `src/app/dashboard/admin/page.tsx` — ADMIN เท่านั้น

```tsx
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { changeRole } from "@/app/actions/admin";
import Avatar from "@/components/Avatar";

export default async function AdminPage() {
  const session = await requireUser("ADMIN");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="card overflow-x-auto">
      <h1 className="mb-4 text-xl font-bold">จัดการผู้ใช้ ({users.length})</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2">ผู้ใช้</th>
            <th>อีเมล</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="flex items-center gap-2 py-2">
                <Avatar url={publicUrl(u.avatarKey)} name={u.name} size={28} /> {u.name}
              </td>
              <td>{u.email}</td>
              <td>
                {u.id === session.userId ? (
                  <span className="text-xs text-slate-500">{u.role} (คุณ)</span>
                ) : (
                  <form action={changeRole.bind(null, u.id)} className="flex gap-2">
                    <select name="role" defaultValue={u.role} className="rounded border px-2 py-1">
                      <option>ADMIN</option>
                      <option>STAFF</option>
                      <option>USER</option>
                    </select>
                    <button className="btn-outline">บันทึก</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 12. Seed ข้อมูลตัวอย่าง

### `prisma/seed.ts`

```ts
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
```

- ใช้ `upsert` ทำให้รัน seed ซ้ำกี่ครั้งก็ได้โดยไม่เกิด error
- สร้างกิจกรรมเฉพาะตอนตารางยังว่าง
- seed ไม่ได้ผ่าน `src/lib/prisma.ts` จึงใช้ relative import `../src/generated/prisma/client`

**บัญชีทดสอบ** (รหัสผ่านทุกบัญชี `password123`)

| Role | Email |
|------|-------|
| ADMIN | `admin@ksu.ac.th` |
| STAFF | `staff@ksu.ac.th` |
| USER | `student@ksu.ac.th` |

---

## 13. `next.config.ts` และ scripts

### 13.1 `next.config.ts` (แทนที่ของเดิม)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb", // ค่าเริ่มต้น 1MB — ขยายให้พออัปโหลดรูปโปรไฟล์ 2MB
    },
  },
};

export default nextConfig;
```

### 13.2 เพิ่ม scripts ใน `package.json`

รันคำสั่งนี้ (แก้ `package.json` ให้อัตโนมัติ):

```bash
npm pkg set \
  scripts.build="prisma generate && next build" \
  scripts.db:generate="prisma generate" \
  scripts.db:migrate="prisma migrate dev" \
  scripts.db:seed="prisma db seed" \
  scripts.db:studio="prisma studio"
```

ผลลัพธ์ในส่วน `scripts`:

```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:seed": "prisma db seed",
  "db:studio": "prisma studio"
}
```

`build` รัน `prisma generate` ก่อนเสมอ เพราะ `src/generated` ไม่ได้อยู่ใน Git — platform อย่าง Vercel/Render และ `docker build` จะสร้าง client ใหม่ทุกครั้ง

---

## 14. รันโหมด Dev และทดสอบ

**โหมด Dev:** database + MinIO อยู่ใน Docker, Next.js รันบนเครื่อง (hot-reload เร็ว)

```bash
docker compose up -d        # 1. เปิด db + minio (ถ้ายังไม่เปิด)
npx prisma migrate dev --name init   # 2. สร้างตาราง (ครั้งแรกครั้งเดียว)
npx prisma generate         # 3. สร้าง Prisma Client
npm run db:seed             # 4. ใส่ข้อมูลตัวอย่าง
npm run dev                 # 5. เปิดแอป
```

เปิด http://localhost:3000

### Checklist ทดสอบ

| # | ทดสอบ | ผลที่ควรได้ |
|---|-------|------------|
| 1 | เปิด `/dashboard` โดยไม่ login | ถูกพาไป `/login` |
| 2 | Login `student@ksu.ac.th` | เห็นกิจกรรม 2 อัน (ไม่เห็นอัน DRAFT) ไม่มีเมนู "จัดการกิจกรรม" |
| 3 | Student พิมพ์ URL `/dashboard/admin` เอง | ถูกพากลับ `/dashboard` |
| 4 | Student กด "ลงทะเบียน" | ตัวเลขผู้สมัครเพิ่มขึ้น ปุ่มเปลี่ยนเป็น "ยกเลิก" |
| 5 | ไปหน้าโปรไฟล์ อัปโหลดรูป JPG/PNG | รูปแสดงที่หน้าโปรไฟล์และเมนูด้านบน |
| 6 | เปิด MinIO Console → bucket `avatars` | เห็นไฟล์ใน `users/<id>/` |
| 7 | Login `staff@ksu.ac.th` → จัดการกิจกรรม | สร้างกิจกรรมใหม่ → สถานะ DRAFT → กด "เผยแพร่" |
| 8 | Login student อีกครั้ง | เห็นกิจกรรมใหม่ที่ staff เผยแพร่ |
| 9 | Login `admin@ksu.ac.th` → จัดการผู้ใช้ | เปลี่ยน student เป็น STAFF (student ต้อง login ใหม่จึงเห็นเมนู) |
| 10 | สมัครสมาชิกใหม่ที่ `/register` | ได้ role USER และเข้า dashboard ทันที |

### เครื่องมือช่วยดูข้อมูล

```bash
npm run db:studio     # เปิด Prisma Studio ดู/แก้ข้อมูลผ่านเว็บ
```

---

## 15. รันทั้งระบบใน Docker (โหมด Production)

ขั้นนี้จำลองการ deploy จริง: แอปถูก build เป็น image และรันใน container เคียงข้าง database

### 15.1 `Dockerfile`

```dockerfile
# ── Stage 0: base ─────────────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ── Stage 1: ติดตั้ง dependencies ─────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ─────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts ต้องการ DATABASE_URL ตอน build (ค่า dummy ไม่ได้เชื่อมต่อจริง)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# ── Stage 3: runner ────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
# รัน migration ก่อน แล้วค่อยเปิดแอป
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
```

**อธิบาย multi-stage build**

| Stage | ทำอะไร | ทำไมแยก |
|-------|--------|---------|
| `base` | Node 22 Alpine + openssl | ใช้ร่วมกันทุก stage |
| `deps` | `npm ci` | copy แค่ `package*.json` ก่อน → Docker cache layer นี้ไว้ ถ้า dependencies ไม่เปลี่ยน build ครั้งต่อไปเร็วมาก |
| `builder` | `prisma generate` + `next build` | ใช้ `DATABASE_URL` dummy เพราะ build ไม่ได้ต่อ database จริง |
| `runner` | `migrate deploy` แล้ว `next start` | สร้างตารางอัตโนมัติทุกครั้งที่ container เริ่ม (ถ้าตารางมีแล้วจะข้าม) |

> image นี้เน้นความเข้าใจง่ายสำหรับการสอน ขนาดจึงใหญ่ (มี devDependencies ครบ เพื่อใช้ `prisma` และ `tsx` ใน container ได้) หัวข้อต่อยอด: `output: "standalone"` เพื่อลดขนาด image

### 15.2 `.dockerignore`

```text
node_modules
.next
.git
.env
src/generated
npm-debug.log
Dockerfile
compose.yaml
```

ไม่ส่ง `node_modules`, `.next`, `.env` เข้า build context — ทำให้ build เร็วขึ้นและไม่หลุด secret เข้า image

### 15.3 Build และรัน

**ต้องมีโฟลเดอร์ `prisma/migrations/` ก่อน** (สร้างจากขั้นตอน 7.3) เพราะ container ใช้ `migrate deploy` ซึ่งอ่านจากไฟล์ migration

```bash
# หยุด npm run dev ก่อน (port 3000 จะชนกัน)

docker compose --profile app up -d --build
docker compose --profile app ps
docker compose logs -f app       # ดู log (Ctrl+C เพื่อออก)
```

log ที่ควรเห็น:

```
ksu_app  | All migrations have been successfully applied.
ksu_app  | ▲ Next.js 16.x
ksu_app  | ✓ Ready in ...
```

Seed ข้อมูล (ถ้าเป็น database ใหม่):

```bash
docker compose exec app npm run db:seed
```

เปิด http://localhost:3000 แล้วทดสอบตาม checklist ในขั้นตอน 14

### 15.4 เปรียบเทียบ 2 โหมด

| | โหมด Dev (ขั้นตอน 14) | โหมด Docker (ขั้นตอน 15) |
|--|------|---------|
| คำสั่ง | `docker compose up -d` + `npm run dev` | `docker compose --profile app up -d --build` |
| Next.js รันที่ | เครื่องเรา | container `ksu_app` |
| `DATABASE_URL` host | `localhost` | `db` (ชื่อ service) |
| `S3_ENDPOINT` | `http://localhost:9000` | `http://minio:9000` |
| Hot-reload | ✅ | ❌ ต้อง build ใหม่ |
| ใช้เมื่อ | เขียนโค้ด | ทดสอบก่อน deploy จริง |

### 15.5 หยุด / ล้างข้อมูล

```bash
docker compose --profile app down        # หยุดทุก container (ข้อมูลยังอยู่)
docker compose --profile app down -v     # หยุด + ลบ volume (database และไฟล์หายหมด!)
```

---

## 16. Push ขึ้น GitHub

```bash
git add .
git status        # ตรวจ: ต้องไม่มี .env และ src/generated
git commit -m "KSU Events: Next.js 16 + Prisma 7 + MinIO + Docker"
git branch -M main
git remote add origin https://github.com/<username>/ksu-events.git
git push -u origin main
```

**ไฟล์ที่ต้องอยู่ใน Git:** `prisma/migrations/`, `.env.example`, `compose.yaml`, `Dockerfile`, `.dockerignore`, `prisma.config.ts`

**ไฟล์ที่ห้ามอยู่ใน Git:** `.env`, `node_modules/`, `.next/`, `src/generated/`

เพื่อนที่ clone ไปใช้:

```bash
git clone https://github.com/<username>/ksu-events.git
cd ksu-events
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

> สังเกตว่าคนที่ clone ใช้ `migrate deploy` (apply migration ที่มีอยู่แล้ว) ไม่ใช่ `migrate dev` (สร้าง migration ใหม่)

---

## 17. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| `Cannot find module '@/generated/prisma/client'` | ยังไม่ได้ generate | `npx prisma generate` |
| `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | ไม่มีไฟล์ `.env` | `cp .env.example .env` |
| `Can't reach database server at localhost:5432` | container `db` ไม่ได้รัน | `docker compose up -d` แล้ว `docker compose ps` |
| `port is already allocated` (5432 / 3000 / 9000) | มีโปรแกรมอื่นใช้ port อยู่ (เช่น PostgreSQL ที่ติดตั้งบน Windows หรือ `npm run dev` ที่ยังเปิดอยู่) | ปิดโปรแกรมนั้น หรือเปลี่ยน port ฝั่งซ้ายใน `compose.yaml` เช่น `"5433:5432"` แล้วแก้ `DATABASE_URL` |
| รูปโปรไฟล์ไม่แสดง (404/403) | bucket ยังไม่ถูกสร้างหรือไม่ได้ตั้ง public | `docker compose logs minio-init` หรือรัน `docker compose up -d minio-init` ใหม่ |
| อัปโหลดรูปแล้ว error `Body exceeded 1 MB limit` | ไม่ได้ตั้ง `bodySizeLimit` | ตรวจ `next.config.ts` แล้ว restart `npm run dev` |
| Login แล้วเด้งกลับหน้า login | `COOKIE_SECURE="true"` บน HTTP | ตั้ง `COOKIE_SECURE="false"` เมื่อไม่ได้ใช้ HTTPS |
| เปลี่ยน role แล้วเมนูไม่เปลี่ยน | role เก็บใน JWT | ผู้ใช้คนนั้น logout แล้ว login ใหม่ |
| `migrate deploy` ใน container บอก `No migration found` | ยังไม่มีโฟลเดอร์ `prisma/migrations` | รัน `npx prisma migrate dev --name init` บนเครื่องก่อน แล้ว build ใหม่ |
| แก้โค้ดแล้ว container ไม่เปลี่ยน | image เก่า | `docker compose --profile app up -d --build` |
| `npm run dev` บน WSL ช้า / ไม่ hot-reload | โปรเจกต์อยู่ใน `/mnt/c` หรือ `/mnt/d` | ย้ายไป `~/projects` |
| อยากเริ่มใหม่ทั้งหมด | — | `docker compose --profile app down -v` แล้วทำขั้นตอน 14 ใหม่ |

---

## 18. สรุปคำสั่งทั้งหมด

```bash
# ── สร้างโปรเจกต์ (ครั้งเดียว) ──
npx create-next-app@16 ksu-events --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --turbopack --no-react-compiler --yes
cd ksu-events
npm install @prisma/client@7 @prisma/adapter-pg@7 pg @aws-sdk/client-s3 jose bcryptjs
npm install -D prisma@7 tsx dotenv @types/pg
# (สร้างไฟล์ตามขั้นตอน 4–13)

# ── Dev mode ──
cp .env.example .env
docker compose up -d
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
npm run dev

# ── Docker mode ──
docker compose --profile app up -d --build
docker compose exec app npm run db:seed
docker compose logs -f app

# ── เครื่องมือ ──
npm run db:studio                        # ดูข้อมูลใน database
docker compose ps -a                     # สถานะ container
docker exec -it ksu_db psql -U ksu -d ksuevents   # เข้า PostgreSQL shell
docker compose --profile app down        # หยุด
docker compose --profile app down -v     # หยุด + ลบข้อมูล
```

---

**ขั้นต่อไป:** นำ repository นี้ไป deploy บน Vercel (Neon + R2), Render และเปิดให้ภายนอกเข้าผ่าน Cloudflare Tunnel — โค้ดไม่ต้องแก้ เปลี่ยนเฉพาะค่า environment variables
