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
  }

  async publishSyncSuccess(payload: {
    minecraftUuid: string;
    minecraftName: string;
    discordId: string;
  }) {
    const channel = this.config.get<string>(
      'REDIS_CHANNEL',
      'minedream:sync:success',
    );
    await this.publisher.publish(channel, JSON.stringify(payload));
    this.logger.log(
      `Published sync success for ${payload.minecraftName} to ${channel}`,
    );
  }

  async publishUnsync(payload: {
    minecraftUuid: string;
    minecraftName: string;
  }) {
    const channel = this.config.get<string>(
      'REDIS_CHANNEL',
      'minedream:sync:success',
    );
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
    const channel = this.config.get<string>(
      'REDIS_BOOST_CHANNEL',
      'minedream:sync:boost',
    );

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
    const channel = this.config.get<string>(
      'REDIS_RANK_SYNC_CHANNEL',
      'minedream:sync:rank',
    );

    await this.publisher.publish(
      channel,
      JSON.stringify({ type: 'rank_sync', ...payload }),
    );

    this.logger.log(
      `Published rank sync for ${payload.minecraftName ?? payload.minecraftUuid} to ${channel}`,
    );
  }
}
