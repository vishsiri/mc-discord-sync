import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { DiscordModule } from './discord/discord.module';
import { RedisModule } from './redis/redis.module';
import { SyncModule } from './sync/sync.module';

const discordEnabled = process.env.DISCORD_ENABLED !== 'false';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    SyncModule,
    ...(discordEnabled ? [DiscordModule] : []),
  ],
})
export class AppModule {}
