import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuditProcessor } from '../workers/audit.processor';
import { CrawlerModule } from '../crawler/crawler.module';
import { AnalyzersModule } from '../analyzers/analyzers.module';
import { ReportsModule } from '../reports/reports.module';
import { AuditsModule } from '../audits/audits.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'crawl' }),
    CrawlerModule,
    AnalyzersModule,
    ReportsModule,
    AuditsModule,
  ],
  providers: [AuditProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
