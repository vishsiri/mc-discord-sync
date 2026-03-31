import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GuildMember, PartialGuildMember } from 'discord.js';
import { Context, On } from 'necord';
import { RedisService } from '../../redis/redis.service';
import { SyncService } from '../../sync/sync.service';

@Injectable()
export class MemberBoostEvent {
  private readonly logger = new Logger(MemberBoostEvent.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {}

  @On('guildMemberUpdate')
  async onMemberUpdate(
    @Context() [oldMember, newMember]: [
      GuildMember | PartialGuildMember,
      GuildMember,
    ],
  ) {
    if (!this.isBoostRewardEnabled()) {
      return;
    }

    const hadBoost = Boolean(oldMember.premiumSinceTimestamp);
    const hasBoost = Boolean(newMember.premiumSinceTimestamp);

    if (hadBoost === hasBoost) {
      return;
    }

    const record = await this.syncService.findByDiscordId(newMember.id);
    if (!record?.isSynced) {
      return;
    }

    await this.applyBoostRewardRole(newMember, hasBoost);

    await this.redisService.publishBoostReward({
      minecraftUuid: record.minecraftUuid,
      minecraftName: record.minecraftName,
      discordId: newMember.id,
      boosted: hasBoost,
    });

    this.logger.log(
      `${record.minecraftName} (${newMember.id}) ${hasBoost ? 'started' : 'stopped'} server boosting`,
    );
  }

  private isBoostRewardEnabled(): boolean {
    return this.config.get<string>('ENABLE_BOOST_REWARDS', 'false') === 'true';
  }

  private async applyBoostRewardRole(member: GuildMember, boosted: boolean) {
    const boostRewardRoleId = this.config.get<string>('DISCORD_BOOST_REWARD_ROLE_ID');
    if (!boostRewardRoleId) {
      return;
    }

    try {
      if (boosted) {
        await member.roles.add(boostRewardRoleId);
      } else {
        await member.roles.remove(boostRewardRoleId).catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`Failed to update boost reward role: ${err.message}`);
    }
  }
}
