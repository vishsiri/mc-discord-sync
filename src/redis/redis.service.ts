import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly publisher: Redis,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.publisher.on('connect', () =>
      this.logger.log('Redis publisher connected'),
    );
    this.publisher.on('error', (err) =>
      this.logger.error('Redis publisher error', err),
    );
    this.logger.log(
      `Redis channels: sync=${this.getSyncSuccessChannel()}, unsync=${this.getUnsyncChannel()}, boost=${this.getBoostChannel()}, rank=${this.getRankSyncChannel()}`,
    );
  }

  async publishSyncSuccess(payload: {
    minecraftUuid: string;
    minecraftName: string;
    discordId: string;
    discordName?: string | null;
    discordUsername?: string | null;
    discordDisplayName?: string | null;
    discordAvatarUrl?: string | null;
    discordProfileUrl?: string | null;
  }) {
    const channel = this.getSyncSuccessChannel();
    await this.publisher.publish(channel, JSON.stringify(payload));
    this.logger.log(
      `Published sync success for ${payload.minecraftName} to ${channel}`,
    );
  }

  async publishUnsync(payload: {
    minecraftUuid: string;
    minecraftName: string;
  }) {
    const channel = this.getUnsyncChannel();
    await this.publisher.publish(
      channel,
      JSON.stringify({ type: 'unsync', ...payload }),
    );
    this.logger.log(
      `Published unsync for ${payload.minecraftName} to ${channel}`,
    );
  }

  async publishBoostReward(payload: {
    minecraftUuid: string;
    minecraftName: string;
    discordId: string;
    boosted: boolean;
  }) {
    const channel = this.getBoostChannel();

    await this.publisher.publish(
      channel,
      JSON.stringify({
        type: payload.boosted ? 'boost_start' : 'boost_end',
        ...payload,
      }),
    );

    this.logger.log(
      `Published ${payload.boosted ? 'boost_start' : 'boost_end'} for ${payload.minecraftName} to ${channel}`,
    );
  }

  async publishRankSync(payload: {
    minecraftUuid: string;
    minecraftName: string | null;
    discordId: string | null;
    selectedRanks: {
      key: string;
      series: string;
      weight: number;
      minecraftGroup: string;
      discordRoleId: string | null;
    }[];
    selectedRank: {
      key: string;
      series: string;
      weight: number;
      minecraftGroup: string;
      discordRoleId: string | null;
    } | null;
    minecraftGroupToAdd: string | null;
    minecraftGroupsToAdd: string[];
    minecraftGroupsToRemove: string[];
    sourceGroups: string[];
  }) {
    const channel = this.getRankSyncChannel();

    await this.publisher.publish(
      channel,
      JSON.stringify({ type: 'rank_sync', ...payload }),
    );

    this.logger.log(
      `Published rank sync for ${payload.minecraftName ?? payload.minecraftUuid} to ${channel}`,
    );
  }

  private getSyncSuccessChannel(): string {
    return this.firstConfigValue(
      ['REDIS_SYNC_SUCCESS_CHANNEL', 'REDIS_CHANNEL'],
      'minedream:sync:success',
    );
  }

  private getUnsyncChannel(): string {
    return this.firstConfigValue(
      ['REDIS_UNSYNC_CHANNEL', 'REDIS_SYNC_SUCCESS_CHANNEL', 'REDIS_CHANNEL'],
      'minedream:sync:success',
    );
  }

  private getBoostChannel(): string {
    return this.firstConfigValue(
      ['REDIS_BOOST_CHANNEL'],
      'minedream:sync:boost',
    );
  }

  private getRankSyncChannel(): string {
    return this.firstConfigValue(
      ['REDIS_RANK_SYNC_CHANNEL'],
      'minedream:sync:rank',
    );
  }

  private firstConfigValue(keys: string[], fallback: string): string {
    for (const key of keys) {
      const value = this.config.get<string>(key);
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return fallback;
  }
}
