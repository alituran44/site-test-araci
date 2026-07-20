import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditDto, AuditFilterDto } from './dto/audit.dto';

@Injectable()
export class AuditsService {
  private readonly logger = new Logger(AuditsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('crawl') private crawlQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateAuditDto) {
    // Normalize URL
    const url = this.normalizeUrl(dto.url);

    const audit = await this.prisma.audit.create({
      data: {
        userId,
        url,
        status: 'PENDING',
        progress: 0,
      },
    });

    // Queue the crawl job — all other analysis jobs are chained from here
    await this.crawlQueue.add(
      'start-crawl',
      {
        auditId: audit.id,
        url,
        userId,
        aiProvider: dto.aiProvider || 'gemini',
        brandName: dto.brandName,
        brandColor: dto.brandColor,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    this.logger.log(`Audit ${audit.id} queued for URL: ${url}`);
    return audit;
  }

  async findAll(userId: string, filter: AuditFilterDto) {
    const { page = 1, limit = 20, status } = filter;
    const skip = (page - 1) * limit;

    const where = { userId, ...(status ? { status: status as any } : {}) };

    const [audits, total] = await this.prisma.$transaction([
      this.prisma.audit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          url: true,
          status: true,
          progress: true,
          scores: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.audit.count({ where }),
    ]);

    return { data: audits, total, page, limit };
  }

  async findOne(id: string, userId: string) {
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: {
        report: true,
        pages: { select: { id: true, url: true, title: true, statusCode: true } },
      },
    });

    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.userId !== userId) throw new ForbiddenException('Access denied');
    return audit;
  }

  async getIssues(auditId: string, userId: string, module?: string, severity?: string) {
    await this.assertOwner(auditId, userId);

    return this.prisma.issue.findMany({
      where: {
        auditId,
        ...(module ? { module: module as any } : {}),
        ...(severity ? { severity: severity as any } : {}),
      },
      orderBy: [
        { severity: 'asc' }, // CRITICAL first
        { module: 'asc' },
      ],
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    await this.prisma.audit.delete({ where: { id } });
    return { message: 'Audit deleted' };
  }

  // Called by workers to update progress
  async updateStatus(auditId: string, status: string, progress: number, extra?: object) {
    return this.prisma.audit.update({
      where: { id: auditId },
      data: {
        status: status as any,
        progress,
        ...(extra || {}),
        ...(status === 'COMPLETED' || status === 'FAILED'
          ? { completedAt: new Date() }
          : {}),
      },
    });
  }

  private async assertOwner(auditId: string, userId: string) {
    const audit = await this.prisma.audit.findUnique({
      where: { id: auditId },
      select: { userId: true },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.userId !== userId) throw new ForbiddenException('Access denied');
  }

  private normalizeUrl(url: string): string {
    const u = url.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      return `https://${u}`;
    }
    return u;
  }
}
