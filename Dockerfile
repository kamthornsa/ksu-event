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
ENV DATABASE_URL="postgresql://build:build@localhost:5434/build"
RUN npm run build

# ── Stage 3: runner ────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
# รัน migration ก่อน แล้วค่อยเปิดแอป
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]