import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { AuditsModule } from './audits/audits.module';
import { ReportsModule } from './reports/reports.module';
import { CrawlerModule } from './crawler/crawler.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    // Config — loads .env
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    // Rate limiting — 100 req per 60s per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Redis queue connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    PrismaModule,
    AuthModule,
    AuditsModule,
    ReportsModule,
    CrawlerModule,
    QueuesModule,
  ],
})
export class AppModule {}
