import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { chromium } from 'playwright';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private reportDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    // Determine target local storage fallback directory
    this.reportDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async generateReports(auditId: string) {
    const audit = await this.prisma.audit.findUniqueOrThrow({
      where: { id: auditId },
      include: { pages: true, issues: true },
    });

    const scores = (audit.scores as any) || { overall: 0, seo: 0, geo: 0, performance: 0, security: 0, accessibility: 0 };
    const htmlReport = this.renderHtmlReport(audit, scores);

    // 1. Write HTML Report
    const htmlFilename = `${auditId}.html`;
    const htmlPath = path.join(this.reportDir, htmlFilename);
    fs.writeFileSync(htmlPath, htmlReport);

    // 2. Generate PDF Report via Headless Playwright Chrome
    let pdfUrl: string | null = null;
    const pdfFilename = `${auditId}.pdf`;
    const pdfPath = path.join(this.reportDir, pdfFilename);
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(htmlReport, { waitUntil: 'domcontentloaded' });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });
      await browser.close();
      pdfUrl = `/reports/${pdfFilename}`;
    } catch (err) {
      this.logger.error(`Failed to print PDF report: ${err.message}`);
    }

    // 3. Generate CSV Report
    const csvFilename = `${auditId}.csv`;
    const csvPath = path.join(this.reportDir, csvFilename);
    const csvContent = this.generateCsv(audit.issues);
    fs.writeFileSync(csvPath, csvContent);

    // 4. Generate JSON Report
    const jsonFilename = `${auditId}.json`;
    const jsonPath = path.join(this.reportDir, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify({ audit, scores }, null, 2));

    // Update Report entry in DB
    return this.prisma.report.upsert({
      where: { auditId },
      create: {
        auditId,
        pdfUrl: pdfUrl || `/reports/${pdfFilename}`,
        htmlUrl: `/reports/${htmlFilename}`,
        jsonUrl: `/reports/${jsonFilename}`,
        csvUrl: `/reports/${csvFilename}`,
      },
      update: {
        pdfUrl: pdfUrl || `/reports/${pdfFilename}`,
        htmlUrl: `/reports/${htmlFilename}`,
        jsonUrl: `/reports/${jsonFilename}`,
        csvUrl: `/reports/${csvFilename}`,
      },
    });
  }

  private renderHtmlReport(audit: any, scores: any): string {
    const issues = audit.issues || [];
    const brandName = audit.brandName || 'WebAudit AI';
    const brandColor = audit.brandColor || '#10b981';

    const issueRows = issues.map((iss: any) => `
      <tr class="severity-${iss.severity.toLowerCase()}">
        <td><strong>${iss.module}</strong></td>
        <td><span class="badge">${iss.severity}</span></td>
        <td>${iss.title}</td>
        <td>${iss.description}</td>
        <td><code>${iss.solution || 'N/A'}</code></td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>${brandName} Audit Raporu — ${audit.url}</title>
    <style>
        body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; padding: 40px; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${brandColor}; padding-bottom: 20px; margin-bottom: 40px; }
        .brand { font-size: 24px; font-weight: 800; color: ${brandColor}; }
        .url { font-size: 18px; color: #64748b; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .score-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
        .score-val { font-size: 32px; font-weight: 800; color: ${brandColor}; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 700; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .severity-critical { border-left: 4px solid #ef4444; }
        .severity-critical .badge { background: #fef2f2; color: #ef4444; }
        .severity-high { border-left: 4px solid #f97316; }
        .severity-high .badge { background: #fff7ed; color: #f97316; }
        .severity-medium { border-left: 4px solid #eab308; }
        .severity-medium .badge { background: #fef9c3; color: #eab308; }
        .severity-low { border-left: 4px solid #3b82f6; }
        .severity-low .badge { background: #eff6ff; color: #3b82f6; }
        .ai-summary { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 40px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">${brandName}</div>
        <div class="url">${audit.url}</div>
    </div>
    
    <div class="ai-summary">
        <h2>🤖 Yapay Zekâ Özeti</h2>
        <p>${audit.aiSummary || 'Rapor analizi tamamlandı. Ayrıntılı sorunlar aşağıda listelenmiştir.'}</p>
    </div>

    <div class="grid">
        <div class="score-card"><div>Genel</div><div class="score-val">${scores.overall}</div></div>
        <div class="score-card"><div>SEO</div><div class="score-val">${scores.seo}</div></div>
        <div class="score-card"><div>GEO</div><div class="score-val">${scores.geo}</div></div>
        <div class="score-card"><div>Hız</div><div class="score-val">${scores.performance}</div></div>
        <div class="score-card"><div>Güvenlik</div><div class="score-val">${scores.security}</div></div>
        <div class="score-card"><div>Erişim</div><div class="score-val">${scores.accessibility}</div></div>
    </div>

    <h2>Bulunan Sorunlar (${issues.length})</h2>
    <table>
        <thead>
            <tr>
                <th>Modül</th>
                <th>Önem</th>
                <th>Başlık</th>
                <th>Açıklama</th>
                <th>Önerilen Çözüm</th>
            </tr>
        </thead>
        <tbody>
            ${issueRows}
        </tbody>
    </table>
</body>
</html>
    `;
  }

  private generateCsv(issues: any[]): string {
    const headers = ['Module', 'CheckId', 'Title', 'Severity', 'PageUrl', 'Description', 'Solution'];
    const rows = (issues || []).map((iss) => [
      iss.module,
      iss.checkId,
      `"${iss.title.replace(/"/g, '""')}"`,
      iss.severity,
      iss.pageUrl || '',
      `"${iss.description.replace(/"/g, '""')}"`,
      `"${(iss.solution || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
