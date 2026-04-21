import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Logger,
  Post,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Client, User } from 'discord.js';
import { DiscordRankSyncService } from '../discord/discord-rank-sync.service';
import { RedisService } from '../redis/redis.service';
import { BulkUpdateRankSyncDto } from './dto/bulk-update-rank-sync.dto';
import { GenerateSyncDto } from './dto/generate-sync.dto';
import { UpdateRankSyncDto } from './dto/update-rank-sync.dto';
import { RankSyncConfigService } from './rank-sync-config.service';
import { SyncService } from './sync.service';

@Controller('api/sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
    private readonly rankSyncConfigService: RankSyncConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Post('generate')
  async generate(
    @Headers('x-secret-key') secretKey: string,
    @Body() dto: GenerateSyncDto,
  ) {
    this.validateSecretKey(secretKey);
    return this.syncService.generateCode(dto);
  }

  @Get('status/:uuid')
  async status(
    @Headers('x-secret-key') secretKey: string,
    @Param('uuid') uuid: string,
  ) {
    this.validateSecretKey(secretKey);
    const record = await this.syncService.findByMinecraftUuid(uuid);
    const discordProfile =
      record?.isSynced && record.discordId
        ? await this.resolveDiscordProfile(record.discordId)
        : this.emptyDiscordProfile(null);

    return {
      isSynced: record?.isSynced ?? false,
      minecraftName: record?.minecraftName ?? null,
      discordId: record?.discordId ?? null,
      ...discordProfile,
    };
  }

  @Post('rank')
  async syncRank(
    @Headers('x-secret-key') secretKey: string,
    @Body() dto: UpdateRankSyncDto,
  ) {
    this.validateSecretKey(secretKey);
    return this.processRankSync(dto);
  }

  @Post('rank/bulk')
  async syncRankBulk(
    @Headers('x-secret-key') secretKey: string,
    @Body() dto: BulkUpdateRankSyncDto,
  ) {
    this.validateSecretKey(secretKey);

    const items = Array.isArray(dto.items) ? dto.items : [];
    const results: Awaited<ReturnType<SyncController['processRankSync']>>[] =
      [];
    for (const item of items) {
      results.push(await this.processRankSync(item));
    }

    return { items: results };
  }

  @Delete('unlink/:uuid')
  async unlink(
    @Headers('x-secret-key') secretKey: string,
    @Param('uuid') uuid: string,
  ) {
    this.validateSecretKey(secretKey);
    const result = await this.syncService.unsyncByMinecraftUuid(uuid);
    await this.redisService.publishUnsync(result);
    return { success: true };
  }

  private validateSecretKey(key: string) {
    const expected = this.config.getOrThrow<string>('API_SECRET_KEY');
    if (key !== expected) {
      throw new UnauthorizedException('Invalid secret key');
    }
  }

  private getDiscordRankSyncService(): DiscordRankSyncService | null {
    try {
      return this.moduleRef.get(DiscordRankSyncService, { strict: false });
    } catch {
      this.logger.warn('Discord rank sync service is not available');
      return null;
    }
  }

  private getDiscordClient(): Client | null {
    try {
      return this.moduleRef.get(Client, { strict: false });
    } catch {
      return null;
    }
  }

  private async resolveDiscordProfile(discordId: string) {
    const client = this.getDiscordClient();
    if (!client) {
      return this.emptyDiscordProfile(discordId);
    }

    const user = await client.users.fetch(discordId).catch((error) => {
      this.logger.warn(
        `Cannot fetch Discord profile ${discordId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    });

    if (!user) {
      return this.emptyDiscordProfile(discordId);
    }

    return this.createDiscordProfile(user);
  }

  private createDiscordProfile(user: User) {
    const discordDisplayName = user.globalName ?? user.username;

    return {
      discordName: discordDisplayName,
      discordUsername: user.username,
      discordDisplayName,
      discordAvatarUrl: user.displayAvatarURL({ size: 256 }),
      discordProfileUrl: `https://discord.com/users/${user.id}`,
    };
  }

  private emptyDiscordProfile(discordId: string | null) {
    return {
      discordName: null,
      discordUsername: null,
      discordDisplayName: null,
      discordAvatarUrl: null,
      discordProfileUrl: discordId
        ? `https://discord.com/users/${discordId}`
        : null,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async processRankSync(dto: UpdateRankSyncDto) {
    const record = await this.syncService.findByMinecraftUuid(
      dto.minecraftUuid,
    );
    const resolution = this.rankSyncConfigService.resolve(dto.groups ?? []);
    const discordRankSyncService = this.getDiscordRankSyncService();

    let discordApplied = false;

    if (record?.isSynced && record.discordId && discordRankSyncService) {
      discordApplied = await discordRankSyncService.syncMemberRoles(
        record.discordId,
        resolution.series,
      );
    }

    await this.redisService.publishRankSync({
      minecraftUuid: dto.minecraftUuid,
      minecraftName: record?.minecraftName ?? dto.minecraftName ?? null,
      discordId: record?.discordId ?? null,
      selectedRanks: resolution.selectedRanks.map((rank) => ({
        key: rank.key,
        series: rank.series,
        weight: rank.weight,
        minecraftGroup: rank.minecraftGroup,
        discordRoleId: rank.discordRoleId,
      })),
      selectedRank: resolution.selected
        ? {
            key: resolution.selected.key,
            series: resolution.selected.series,
            weight: resolution.selected.weight,
            minecraftGroup: resolution.selected.minecraftGroup,
            discordRoleId: resolution.selected.discordRoleId,
          }
        : null,
      minecraftGroupToAdd: resolution.minecraftGroupToAdd,
      minecraftGroupsToAdd: resolution.minecraftGroupsToAdd,
      minecraftGroupsToRemove: resolution.minecraftGroupsToRemove,
      sourceGroups: dto.groups ?? [],
    });

    return {
      minecraftUuid: dto.minecraftUuid,
      isSynced: record?.isSynced ?? false,
      discordApplied,
      effectiveRank: resolution.selected
        ? {
            key: resolution.selected.key,
            series: resolution.selected.series,
            weight: resolution.selected.weight,
            minecraftGroup: resolution.selected.minecraftGroup,
            discordRoleId: resolution.selected.discordRoleId,
          }
        : null,
      effectiveRanks: resolution.selectedRanks.map((rank) => ({
        key: rank.key,
        series: rank.series,
        weight: rank.weight,
        minecraftGroup: rank.minecraftGroup,
        discordRoleId: rank.discordRoleId,
      })),
      minecraftGroupToAdd: resolution.minecraftGroupToAdd,
      minecraftGroupsToAdd: resolution.minecraftGroupsToAdd,
      minecraftGroupsToRemove: resolution.minecraftGroupsToRemove,
    };
  }
}
