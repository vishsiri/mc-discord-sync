import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { REDIS_PUBLISHER } from './redis.constants';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: REDIS_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { Redis } = require('ioredis') as typeof import('ioredis');
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        });
      },
    },
  ],
  exports: [RedisService, REDIS_PUBLISHER],
})
export class RedisModule {}
