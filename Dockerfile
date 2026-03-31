FROM node:20-alpine

# ลงเครื่องมือพื้นฐานและ pnpm
RUN apk add --no-cache python3 make g++ curl
RUN npm install -g pnpm@9

WORKDIR /app

# 1. ก๊อปปี้ไฟล์ package มาก่อนเพื่อทำ Caching
COPY package.json pnpm-lock.yaml ./

# 2. ลง Dependencies ทั้งหมด
RUN pnpm install --frozen-lockfile

# 3. ก๊อปปี้โค้ดทั้งหมด (src, tsconfig, etc.)
COPY . .

# 4. บิลด์โปรเจกต์ (pnpm build) -> จะได้โฟลเดอร์ dist ออกมาอยู่ใน /app/dist
RUN pnpm run build

EXPOSE 3001

# 5. รันเซิร์ฟเวอร์ด้วยคำสั่งที่คุณต้องการเลย
CMD ["sh", "-c", "echo '=== FILES IN DIST ===' && find dist -type f && echo '=====================' && pnpm run start:prod"]