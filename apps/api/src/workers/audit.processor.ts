import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { SeoAnalyzer } from '../analyzers/seo/seo.analyzer';
import { GeoAnalyzer } from '../analyzers/geo/geo.analyzer';
import { PerformanceAnalyzer } from '../analyzers/performance/lighthouse.analyzer';
import { SecurityAnalyzer } from '../analyzers/security/security.analyzer';
import { AccessibilityAnalyzer } from '../analyzers/accessibility/axe.analyzer';
import { AiAnalyzer } from '../analyzers/ai/ai.analyzer';
import { ReportsService } from '../reports/reports.service';
import { AuditsGateway } from '../audits/audits.gateway';
import { AuditStatus, Module } from '@webaudit/shared';

@Processor('crawl')
export class AuditProcessor {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    private prisma: PrismaService,
    private crawlerService: CrawlerService,
    private seoAnalyzer: SeoAnalyzer,
    private geoAnalyzer: GeoAnalyzer,
    private performanceAnalyzer: PerformanceAnalyzer,
    private securityAnalyzer: SecurityAnalyzer,
    private accessibilityAnalyzer: AccessibilityAnalyzer,
    private aiAnalyzer: AiAnalyzer,
    private reportsService: ReportsService,
    private auditsGateway: AuditsGateway,
  ) {}

  @Process('start-crawl')
  async handleAudit(job: Job<any>) {
    const { auditId, url, aiProvider } = job.data;
    this.logger.log(`[Job ${job.id}] Started processing audit: ${auditId} for URL: ${url}`);

    try {
      // 1. CRAWLING
      await this.updateStep(auditId, 'CRAWLING', 10, 'Web site taranıyor, sayfalar çıkartılıyor...');
      const crawlResult = await this.crawlerService.crawlSite(url, { maxPages: 25 });
      
      // Save pages in DB
      for (const page of crawlResult.pages) {
        await this.prisma.auditPage.create({
          data: {
            auditId,
            url: page.url,
            title: page.title,
            statusCode: page.statusCode,
            data: page.headers as any,
          },
        });
      }

      // 2. SEO ANALYSIS
      await this.updateStep(auditId, 'SEO_ANALYSIS', 25, 'SEO denetimleri çalıştırılıyor...');
      const seoResult = await this.seoAnalyzer.analyze(crawlResult);
      await this.saveIssues(auditId, 'SEO', seoResult.issues);

      // 3. GEO ANALYSIS
      await this.updateStep(auditId, 'GEO_ANALYSIS', 40, 'GEO ve AI arama motoru uyumluluğu kontrol ediliyor...');
      const geoResult = await this.geoAnalyzer.analyze(crawlResult);
      await this.saveIssues(auditId, 'GEO', geoResult.issues);

      // 4. PERFORMANCE ANALYSIS
      await this.updateStep(auditId, 'PERFORMANCE_ANALYSIS', 55, 'Performans ve Core Web Vitals ölçülüyor...');
      const perfResult = await this.performanceAnalyzer.analyze(url);
      await this.saveIssues(auditId, 'PERFORMANCE', perfResult.issues);

      // 5. SECURITY ANALYSIS
      await this.updateStep(auditId, 'SECURITY_ANALYSIS', 70, 'SSL sertifikası ve HTTP güvenlik başlıkları kontrol ediliyor...');
      const secResult = await this.securityAnalyzer.analyze(crawlResult.pages[0]);
      await this.saveIssues(auditId, 'SECURITY', secResult.issues);

      // 6. ACCESSIBILITY ANALYSIS
      await this.updateStep(auditId, 'ACCESSIBILITY_ANALYSIS', 80, 'WCAG erişilebilirlik testleri yapılıyor...');
      const rootPageResult = await this.crawlerService.crawlSinglePage(url);
      let a11yResult = { score: 100, issues: [] as any[] };
      // Fallback runs automatically inside analyzer if Playwright page instantiation fails
      if (rootPageResult) {
        // Run simulated or direct axe
        a11yResult = await this.accessibilityAnalyzer.runResilientFallback(url);
      }
      await this.saveIssues(auditId, 'ACCESSIBILITY', a11yResult.issues);

      // Aggregated Scores calculation
      const scores = {
        overall: Math.round(
          (seoResult.score + geoResult.score + perfResult.score + secResult.score + a11yResult.score) / 5
        ),
        seo: seoResult.score,
        geo: geoResult.score,
        performance: perfResult.score,
        security: secResult.score,
        accessibility: a11yResult.score,
        codeQuality: 85, // Mock baseline
        uiux: 80,        // Mock baseline
      };

      // 7. AI ANALYSIS SUMMARY
      await this.updateStep(auditId, 'AI_ANALYSIS', 90, 'Yapay zekâ bulguları yorumluyor...');
      const aiInsights = await this.aiAnalyzer.generateSummary(url, scores, [
        ...seoResult.issues,
        ...geoResult.issues,
        ...perfResult.issues,
        ...secResult.issues,
      ], aiProvider);

      // Save intermediate data
      await this.prisma.audit.update({
        where: { id: auditId },
        data: {
          scores: scores as any,
          crawlData: {
            totalPages: crawlResult.pages.length + crawlResult.brokenLinks.length,
            crawledPages: crawlResult.pages.length,
            failedPages: crawlResult.brokenLinks.length,
            totalLinks: crawlResult.pages.reduce((acc, p) => acc + p.links.length, 0),
            brokenLinks: crawlResult.brokenLinks.length,
          } as any,
          seoAnalysis: seoResult.checks as any,
          geoAnalysis: geoResult as any,
          perfAnalysis: perfResult.metrics as any,
          secAnalysis: secResult.checks as any,
          a11yAnalysis: a11yResult as any,
          aiSummary: aiInsights.executiveSummary,
          aiInsights: aiInsights as any,
        },
      });

      // 8. REPORT GENERATION
      await this.updateStep(auditId, 'REPORT_GENERATION', 95, 'PDF ve CSV raporları hazırlanıyor...');
      await this.reportsService.generateReports(auditId);

      // 9. COMPLETED
      await this.prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
        },
      });

      this.auditsGateway.emitComplete(auditId, scores);
      this.logger.log(`[Job ${job.id}] Audit ${auditId} successfully completed`);
    } catch (err) {
      this.logger.error(`[Job ${job.id}] Audit ${auditId} failed: ${err.message}`, err.stack);
      
      await this.prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'FAILED',
          progress: 100,
          completedAt: new Date(),
        },
      });

      this.auditsGateway.emitError(auditId, err.message);
    }
  }

  private async updateStep(auditId: string, status: AuditStatus, progress: number, message: string) {
    await this.prisma.audit.update({
      where: { id: auditId },
      data: { status, progress },
    });
    this.auditsGateway.emitProgress({
      auditId,
      status,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private async saveIssues(auditId: string, module: Module, issues: any[]) {
    for (const iss of issues) {
      await this.prisma.issue.create({
        data: {
          auditId,
          module,
          checkId: iss.checkId,
          title: iss.title,
          description: iss.description,
          severity: iss.severity,
          solution: iss.solution,
          codeExample: iss.codeExample,
          standard: iss.standard,
          improvement: iss.improvement,
          pageUrl: iss.pageUrl,
        },
      });
    }
  }
}
