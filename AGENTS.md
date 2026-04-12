# Project Context: minedream Discord Sync System



## 🎯 Project Overview

ระบบเชื่อมต่อบัญชีระหว่างเซิร์ฟเวอร์ Minecraft (Multi-Server) และ Discord โดยมี NestJS เป็น Central API สำหรับจัดการข้อมูลและรัน Discord Bot และใช้ Redis Pub/Sub ในการสื่อสารแบบ Real-time ไปยัง Minecraft Plugins ต่างๆ ในเครือข่าย



## 🧰 Tech Stack

### 1. Central API & Discord Bot

- **Framework:** NestJS

- **Discord Library:** `necord` (Discord.js wrapper for NestJS)

- **Database ORM:** DrizzleORM

- **Database:** MariaDB

- **Message Broker:** Redis (`ioredis`)



### 2. Minecraft Plugin (Spigot/Paper)

- **Language:** Java / Kotlin

- **Build Tool:** Gradle

- **HTTP Client:** `OkHttp3` (สำหรับยิง API ขอ Sync Code)

- **Message Broker:** `Jedis` (สำหรับ Subscribe Redis Channel)

- **Dependencies:** PlaceholderAPI



---



## 🏗️ Architecture & Flow

1. **Request Sync:** ผู้เล่นพิมพ์ `/sync` ในเกม Plugin ยิง HTTP POST ไปที่ NestJS เพื่อสร้าง Code ชั่วคราว (เช่น `A7X9Q`)

2. **Verify on Discord:** ผู้เล่นกดปุ่มบน Discord (สร้างจาก `/setupsync`) -> กรอก Code ใน Modal Form

3. **Database Update:** NestJS ตรวจสอบ Code ผ่าน DrizzleORM หากถูกต้องให้อัปเดต `discord_id` และ `is_synced = true`

4. **Discord Actions (Role & Name):** NestJS อัปเดตยศ (Role) และเปลี่ยนชื่อ (Nickname) ของผู้เล่นใน Discord ตาม Config

5. **Real-time Trigger:** NestJS Publish message ไปที่ Redis Channel (เช่น `minedream:sync:success`)

6. **Action Execution:** Minecraft Plugin ที่ Subscribe อยู่จะรับ Message ตรวจสอบว่าผู้เล่นออนไลน์ในเซิร์ฟเวอร์ตัวเองหรือไม่ หากใช่ให้รัน Commands (เช่น แจกยศในเกม)

7. **Data Caching:** Plugin ดึงสถานะ Sync ของผู้เล่นตอน Login เก็บไว้ใน Memory เพื่อให้ PlaceholderAPI ใช้งานได้โดยไม่ต้อง Query ใหม่ตลอดเวลา



---



## 🗄️ Database Schema (DrizzleORM - MariaDB)

Table: `discord_sync_users`

- `id` (INT, Primary Key, Auto Increment)

- `minecraft_uuid` (VARCHAR(36), Unique, Not Null)

- `minecraft_name` (VARCHAR(16), Not Null)

- `discord_id` (VARCHAR(20), Nullable, Unique)

- `sync_code` (VARCHAR(10), Nullable)

- `is_synced` (BOOLEAN, Default: false)

- `sync_date` (TIMESTAMP, Nullable)

- `created_at` (TIMESTAMP, Default: current_timestamp)

- `updated_at` (TIMESTAMP, Default: current_timestamp on update)



---



## ⚙️ Configuration & Environment



### 1. NestJS (Central API & Bot) - `.env`

ใช้ `@nestjs/config` สำหรับจัดการค่าผ่านไฟล์ `.env`:

- `DISCORD_BOT_TOKEN`: Token ของบอท

- `GUILD_ID`: ID ของเซิร์ฟเวอร์ Discord สำหรับ Register Slash Commands

- `DISCORD_SYNCED_ROLE_ID`: ID ของ Role ที่จะมอบให้เมื่อ Sync สำเร็จ

- `DISCORD_REMOVE_ROLE_ID`: ID ของ Role ที่จะดึงออกเมื่อ Sync สำเร็จ (Optional)

- `ENABLE_NICKNAME_SYNC`: (Boolean) เปิด-ปิด การให้บอทเปลี่ยนชื่อผู้เล่น

- `NICKNAME_FORMAT`: รูปแบบชื่อที่ต้องการ (เช่น `[minedream] {ign}` หรือ `{ign}`)

- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: ตั้งค่า Redis

- `DATABASE_URL`: Connection string สำหรับ MariaDB



### 2. Minecraft Plugin - `config.yml`

```yaml

redis:

  host: "127.0.0.1"

  port: 6379

  password: ""

  channel: "minedream:sync"



api:

  url: "http://your-nestjs-api:3000/api/sync/generate"

  secret_key: "your-secret-key" # สำหรับ Auth กันคนนอกยิง API



messages:

  prefix: "&8[&bminedream&8] "

  already_synced: "&cคุณได้ทำการเชื่อมต่อบัญชีไปแล้ว!"

  sync_instructions: "&7รหัสยืนยันของคุณคือ: &a{code}\n&7กรุณานำไปกรอกที่ห้อง #sync ใน Discord"



actions:

  on_sync_success:

    - "[console] lp user {player} parent add synced"

    - "[console] give {player} diamond 5"

    - "[message] &aเชื่อมต่อบัญชี Discord สำเร็จ! ได้รับยศและของรางวัลเรียบร้อย"