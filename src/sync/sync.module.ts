import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { RankSyncConfigService } from './rank-sync-config.service';
import { SyncService } from './sync.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, RankSyncConfigService],
  exports: [SyncService, RankSyncConfigService],
})
export class SyncModule {}
