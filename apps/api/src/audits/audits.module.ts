import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';
import { AuditsGateway } from './audits.gateway';

@Module({
  imports: [BullModule.registerQueue({ name: 'crawl' })],
  controllers: [AuditsController],
  providers: [AuditsService, AuditsGateway],
  exports: [AuditsService, AuditsGateway],
})
export class AuditsModule {}
