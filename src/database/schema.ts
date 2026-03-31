import {
  boolean,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const discordSyncUsers = mysqlTable('discord_sync_users', {
  id: int('id').autoincrement().primaryKey(),
  minecraftUuid: varchar('minecraft_uuid', { length: 36 }).notNull().unique(),
  minecraftName: varchar('minecraft_name', { length: 16 }).notNull(),
  discordId: varchar('discord_id', { length: 20 }).unique(),
  syncCode: varchar('sync_code', { length: 10 }),
  isSynced: boolean('is_synced').default(false).notNull(),
  syncDate: timestamp('sync_date'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow()
    .notNull(),
});

export type DiscordSyncUser = typeof discordSyncUsers.$inferSelect;
export type NewDiscordSyncUser = typeof discordSyncUsers.$inferInsert;
