import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { MySql2Database } from 'drizzle-orm/mysql2';
import { DRIZZLE } from '../database/database.module';
import * as schema from '../database/schema';
import { GenerateSyncDto } from './dto/generate-sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: MySql2Database<typeof schema>,
  ) {}

  async generateCode(dto: GenerateSyncDto): Promise<{ code: string }> {
    const code = this.createCode();

    const existing = await this.db.query.discordSyncUsers.findFirst({
      where: eq(schema.discordSyncUsers.minecraftUuid, dto.minecraftUuid),
    });

    if (existing?.isSynced) {
      throw new UnauthorizedException('Player is already synced');
    }

    if (existing) {
      await this.db
        .update(schema.discordSyncUsers)
        .set({ syncCode: code, minecraftName: dto.minecraftName })
        .where(eq(schema.discordSyncUsers.minecraftUuid, dto.minecraftUuid));
    } else {
      await this.db.insert(schema.discordSyncUsers).values({
        minecraftUuid: dto.minecraftUuid,
        minecraftName: dto.minecraftName,
        syncCode: code,
      });
    }

    this.logger.log(`Generated sync code for ${dto.minecraftName}: ${code}`);
    return { code };
  }

  async verifyCode(discordId: string, code: string) {
    const record = await this.db.query.discordSyncUsers.findFirst({
      where: eq(schema.discordSyncUsers.syncCode, code),
    });

    if (!record) {
      throw new NotFoundException('Invalid or expired sync code');
    }

    if (record.isSynced) {
      throw new UnauthorizedException('This account is already synced');
    }

    await this.db
      .update(schema.discordSyncUsers)
      .set({
        discordId,
        isSynced: true,
        syncCode: null,
        syncDate: new Date(),
      })
      .where(eq(schema.discordSyncUsers.id, record.id));

    return {
      minecraftUuid: record.minecraftUuid,
      minecraftName: record.minecraftName,
      discordId,
    };
  }

  async findByMinecraftUuid(uuid: string) {
    return this.db.query.discordSyncUsers.findFirst({
      where: eq(schema.discordSyncUsers.minecraftUuid, uuid),
    });
  }

  async findByDiscordId(discordId: string) {
    return this.db.query.discordSyncUsers.findFirst({
      where: eq(schema.discordSyncUsers.discordId, discordId),
    });
  }

  async findByMinecraftName(name: string) {
    return this.db.query.discordSyncUsers.findFirst({
      where: eq(schema.discordSyncUsers.minecraftName, name),
    });
  }

  async unsyncPlayer(discordId: string) {
    await this.db
      .update(schema.discordSyncUsers)
      .set({ discordId: null, isSynced: false, syncDate: null })
      .where(eq(schema.discordSyncUsers.discordId, discordId));
  }

  async unsyncByMinecraftUuid(uuid: string) {
    const record = await this.db.query.discordSyncUsers.findFirst({
      where: eq(schema.discordSyncUsers.minecraftUuid, uuid),
    });

    if (!record?.isSynced) {
      throw new NotFoundException('Player is not synced');
    }

    await this.db
      .update(schema.discordSyncUsers)
      .set({ discordId: null, isSynced: false, syncDate: null })
      .where(eq(schema.discordSyncUsers.minecraftUuid, uuid));

    return {
      minecraftUuid: uuid,
      minecraftName: record.minecraftName,
    };
  }

  private createCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }
}
