import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NecordModule } from 'necord';
import { IntentsBitField } from 'discord.js';
import { SyncModule } from '../sync/sync.module';
import { SetupSyncCommand } from './commands/setup-sync.command';
import { WhoisCommand } from './commands/whois.command';
import { MemberBoostEvent } from './events/member-boost.event';
import { MemberLeaveEvent } from './events/member-leave.event';

@Module({
  imports: [
    NecordModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>('DISCORD_BOT_TOKEN'),
        intents: [
          IntentsBitField.Flags.Guilds,
          IntentsBitField.Flags.GuildMembers,
        ],
        development: config.get<string>('GUILD_ID')
          ? [config.get<string>('GUILD_ID')!]
          : false,
      }),
    }),
    SyncModule,
  ],
  providers: [SetupSyncCommand, WhoisCommand, MemberLeaveEvent, MemberBoostEvent],
})
export class DiscordModule {}
