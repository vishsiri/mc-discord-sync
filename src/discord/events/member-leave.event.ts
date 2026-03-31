import { Injectable, Logger } from '@nestjs/common';
import { GuildMember, PartialGuildMember } from 'discord.js';
import { Context, On } from 'necord';
import { RedisService } from '../../redis/redis.service';
import { SyncService } from '../../sync/sync.service';

@Injectable()
export class MemberLeaveEvent {
  private readonly logger = new Logger(MemberLeaveEvent.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly redisService: RedisService,
  ) {}

  @On('guildMemberRemove')
  async onMemberLeave(
    @Context() [member]: [GuildMember | PartialGuildMember],
  ) {
    const record = await this.syncService.findByDiscordId(member.id);
    if (!record?.isSynced) return;

    await this.syncService.unsyncPlayer(member.id);
    await this.redisService.publishUnsync({
      minecraftUuid: record.minecraftUuid,
      minecraftName: record.minecraftName,
    });
    this.logger.log(
      `Unsynced ${record.minecraftName} (${member.id}) - left Discord`,
    );
  }
}
