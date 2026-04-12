import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GuildMember } from 'discord.js';
import {
  RankSyncConfigService,
  type ResolvedRankSeries,
} from '../sync/rank-sync-config.service';

@Injectable()
export class DiscordRankSyncService {
  private readonly logger = new Logger(DiscordRankSyncService.name);

  constructor(
    private readonly client: Client,
    private readonly configService: ConfigService,
    private readonly rankSyncConfigService: RankSyncConfigService,
  ) {}

  async syncMemberRoles(
    discordId: string,
    resolvedSeries: ResolvedRankSeries[],
  ): Promise<boolean> {
    if (this.configService.get<string>('ENABLE_ROLE_SYNC', 'true') !== 'true') {
      this.logger.log(
        'Skipping Discord role sync because ENABLE_ROLE_SYNC=false',
      );
      return false;
    }

    const guildId = this.configService.get<string>('GUILD_ID');
    if (!guildId) {
      this.logger.warn('Skipping rank sync because GUILD_ID is not configured');
      return false;
    }

    const guild = await this.client.guilds.fetch(guildId).catch((error) => {
      this.logger.warn(
        `Cannot fetch guild ${guildId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    });

    if (!guild) {
      return false;
    }

    const member = await guild.members.fetch(discordId).catch((error) => {
      this.logger.warn(
        `Cannot fetch member ${discordId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    });

    if (!member) {
      return false;
    }

    await this.applyRankRoles(member, resolvedSeries);
    return true;
  }

  private async applyRankRoles(
    member: GuildMember,
    resolvedSeries: ResolvedRankSeries[],
  ) {
    const allSeries = new Map<string, string[]>();

    for (const mapping of this.rankSyncConfigService.getMappings()) {
      const items = allSeries.get(mapping.series) ?? [];
      if (mapping.discordRoleId) {
        items.push(mapping.discordRoleId);
      }
      allSeries.set(mapping.series, items);
    }

    for (const item of resolvedSeries) {
      const roleIdsToRemove = (allSeries.get(item.series) ?? []).filter(
        (roleId) => roleId !== item.selected?.discordRoleId,
      );

      for (const roleId of roleIdsToRemove) {
        if (!member.roles.cache.has(roleId)) {
          continue;
        }

        await member.roles
          .remove(roleId)
          .catch((error) =>
            this.logger.warn(
              `Cannot remove role ${roleId}: ${this.getErrorMessage(error)}`,
            ),
          );
      }

      const selectedRoleId = item.selected?.discordRoleId;
      if (!selectedRoleId) {
        continue;
      }

      if (member.roles.cache.has(selectedRoleId)) {
        continue;
      }

      await member.roles
        .add(selectedRoleId)
        .catch((error) =>
          this.logger.warn(
            `Cannot add role ${selectedRoleId}: ${this.getErrorMessage(error)}`,
          ),
        );
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
