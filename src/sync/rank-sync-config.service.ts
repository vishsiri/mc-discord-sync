import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

export interface RankSyncMapping {
  key: string;
  series: string;
  weight: number;
  minecraftGroup: string;
  aliases: string[];
  discordRoleId: string | null;
}

export interface ResolvedRankSeries {
  series: string;
  selected: RankSyncMapping | null;
  matched: RankSyncMapping[];
  minecraftGroupToAdd: string | null;
  minecraftGroupsToRemove: string[];
  configuredDiscordRoleIds: string[];
}

export interface ResolvedRankSync {
  selected: RankSyncMapping | null;
  matched: RankSyncMapping[];
  minecraftGroupToAdd: string | null;
  minecraftGroupsToRemove: string[];
  configuredDiscordRoleIds: string[];
  selectedRanks: RankSyncMapping[];
  series: ResolvedRankSeries[];
  minecraftGroupsToAdd: string[];
  configuredDiscordRoleIdsBySeries: string[];
}

interface RawRankSyncMapping {
  key?: unknown;
  series?: unknown;
  weight?: unknown;
  minecraftGroup?: unknown;
  minecraftGroups?: unknown;
  discordRoleId?: unknown;
}

@Injectable()
export class RankSyncConfigService {
  private readonly logger = new Logger(RankSyncConfigService.name);
  private cachedMappings: RankSyncMapping[] | null = null;

  constructor(private readonly configService: ConfigService) {}

  resolve(groups: string[]): ResolvedRankSync {
    const mappings = this.getMappings();
    const normalizedGroups = new Set(
      groups
        .map((group) => this.normalize(group))
        .filter((group): group is string => group.length > 0),
    );

    const matched = mappings
      .filter((mapping) =>
        [mapping.minecraftGroup, ...mapping.aliases].some((group) =>
          normalizedGroups.has(group),
        ),
      )
      .sort((left, right) => right.weight - left.weight);

    const seriesMap = new Map<string, RankSyncMapping[]>();
    for (const mapping of matched) {
      const items = seriesMap.get(mapping.series) ?? [];
      items.push(mapping);
      seriesMap.set(mapping.series, items);
    }

    const resolvedSeries = Array.from(seriesMap.entries())
      .map(([series, seriesMatched]) => {
        const selected = seriesMatched[0] ?? null;
        const configuredDiscordRoleIds = mappings
          .filter((mapping) => mapping.series === series)
          .map((mapping) => mapping.discordRoleId)
          .filter((roleId): roleId is string => Boolean(roleId));

        return {
          series,
          selected,
          matched: seriesMatched,
          minecraftGroupToAdd: selected?.minecraftGroup ?? null,
          minecraftGroupsToRemove: seriesMatched
            .slice(1)
            .map((mapping) => mapping.minecraftGroup),
          configuredDiscordRoleIds,
        };
      })
      .sort((left, right) => left.series.localeCompare(right.series));

    const selectedRanks = resolvedSeries
      .map((item) => item.selected)
      .filter((item): item is RankSyncMapping => item !== null);

    const selected =
      resolvedSeries.find((item) => item.series === 'default')?.selected ??
      selectedRanks[0] ??
      null;

    return {
      selected,
      matched,
      minecraftGroupToAdd: selected?.minecraftGroup ?? null,
      minecraftGroupsToRemove: resolvedSeries.flatMap(
        (item) => item.minecraftGroupsToRemove,
      ),
      configuredDiscordRoleIds: mappings
        .map((mapping) => mapping.discordRoleId)
        .filter((roleId): roleId is string => Boolean(roleId)),
      selectedRanks,
      series: resolvedSeries,
      minecraftGroupsToAdd: resolvedSeries
        .map((item) => item.minecraftGroupToAdd)
        .filter((item): item is string => Boolean(item)),
      configuredDiscordRoleIdsBySeries: resolvedSeries.flatMap(
        (item) => item.configuredDiscordRoleIds,
      ),
    };
  }

  getMappings(): RankSyncMapping[] {
    if (this.cachedMappings) {
      return this.cachedMappings;
    }

    const fileMappings = this.readMappingsFromFile();
    if (fileMappings.length > 0) {
      this.cachedMappings = fileMappings;
      return fileMappings;
    }

    const rawValue = this.configService.get<string>('SYNC_ROLE_MAPPINGS', '[]');

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsed)) {
        this.logger.warn('SYNC_ROLE_MAPPINGS must be a JSON array');
        return [];
      }

      const mappings = parsed
        .map((item) => this.toMapping(item as RawRankSyncMapping))
        .filter((item): item is RankSyncMapping => item !== null)
        .sort((left, right) => right.weight - left.weight);

      this.cachedMappings = mappings;
      return mappings;
    } catch (error) {
      this.logger.warn(
        `Failed to parse SYNC_ROLE_MAPPINGS: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return [];
    }
  }

  private toMapping(input: RawRankSyncMapping): RankSyncMapping | null {
    const key = this.toStringValue(input.key);
    const series = this.normalize(
      this.toStringValue(input.series) || 'default',
    );
    const minecraftGroup = this.normalize(
      this.toStringValue(input.minecraftGroup),
    );
    const weight = this.toNumberValue(input.weight);

    if (!key || !minecraftGroup || weight === null) {
      return null;
    }

    const aliases = Array.isArray(input.minecraftGroups)
      ? input.minecraftGroups
          .map((value) => this.normalize(this.toStringValue(value)))
          .filter((value): value is string => value.length > 0)
          .filter((value) => value !== minecraftGroup)
      : [];

    const discordRoleId = this.toStringValue(input.discordRoleId);

    return {
      key,
      series,
      weight,
      minecraftGroup,
      aliases,
      discordRoleId: discordRoleId || null,
    };
  }

  private toStringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNumberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private readMappingsFromFile(): RankSyncMapping[] {
    const configuredPath = this.configService.get<string>(
      'SYNC_ROLE_MAPPINGS_FILE',
      'rolemaps.yml',
    );
    const filePath = resolve(process.cwd(), configuredPath);

    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const parsed = YAML.parse(readFileSync(filePath, 'utf8')) as
        | { roles?: unknown }
        | unknown[];

      const rawMappings = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.roles)
          ? parsed.roles
          : [];

      if (!Array.isArray(rawMappings)) {
        this.logger.warn(
          `Role mapping file ${configuredPath} must contain a top-level array or roles array`,
        );
        return [];
      }

      const mappings = rawMappings
        .map((item) => this.toMapping(item as RawRankSyncMapping))
        .filter((item): item is RankSyncMapping => item !== null)
        .sort((left, right) => right.weight - left.weight);

      this.logger.log(
        `Loaded ${mappings.length} role mappings from ${configuredPath}`,
      );
      return mappings;
    } catch (error) {
      this.logger.warn(
        `Failed to parse ${configuredPath}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return [];
    }
  }
}
