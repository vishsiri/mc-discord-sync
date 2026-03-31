import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { GenerateSyncDto } from './dto/generate-sync.dto';
import { SyncService } from './sync.service';

@Controller('api/sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
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
    return {
      isSynced: record?.isSynced ?? false,
      minecraftName: record?.minecraftName ?? null,
      discordId: record?.discordId ?? null,
    };
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
}
