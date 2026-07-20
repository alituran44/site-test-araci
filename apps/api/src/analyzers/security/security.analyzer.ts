import { Injectable, Logger } from '@nestjs/common';
import * as sslChecker from 'ssl-checker';
import { CrawlResult } from '../../crawler/crawler.service';
import { Issue, Severity } from '@webaudit/shared';

interface SecurityCheckResult {
  checkId: string;
  title: string;
  passed: boolean;
  severity: Severity;
  description: string;
  solution?: string;
  standard?: string;
  value?: string | boolean;
}

@Injectable()
export class SecurityAnalyzer {
  private readonly logger = new Logger(SecurityAnalyzer.name);

  async analyze(rootPage: CrawlResult): Promise<{
    score: number;
    issues: Omit<Issue, 'id' | 'auditId'>[];
    checks: SecurityCheckResult[];
  }> {
    const checks: SecurityCheckResult[] = [];
    const url = rootPage.url;

    // 1. Check HTTPS usage
    const isHttps = url.startsWith('https://');
    checks.push({
      checkId: 'sec-https',
      title: 'HTTPS Enabled',
      passed: isHttps,
      severity: 'CRITICAL',
      description: isHttps ? 'The site loads securely over HTTPS.' : 'The site uses unencrypted HTTP protocol.',
      solution: 'Acquire and configure an SSL/TLS certificate to enforce secure traffic.',
      standard: 'HTTPS-Only web standards',
    });

    // 2. Check SSL Validity
    if (isHttps) {
      try {
        const domain = new URL(url).hostname;
        const sslInfo = await sslChecker.default(domain);
        const daysRemaining = sslInfo.daysRemaining;

        checks.push({
          checkId: 'sec-ssl-valid',
          title: 'SSL Certificate Validity',
          passed: sslInfo.valid,
          severity: 'CRITICAL',
          description: sslInfo.valid 
            ? `SSL Certificate is valid. Days remaining: ${daysRemaining}.`
            : 'SSL certificate is expired or invalid.',
          solution: 'Renew or reissue your SSL/TLS certificate.',
          value: String(daysRemaining),
        });

        checks.push({
          checkId: 'sec-ssl-expiry',
          title: 'SSL Expiry Buffer (>30 days)',
          passed: daysRemaining > 30,
          severity: 'HIGH',
          description: `SSL certificate expires in ${daysRemaining} days.`,
          solution: 'Ensure automatic renewals are configured to prevent downtime.',
        });
      } catch (err) {
        checks.push({
          checkId: 'sec-ssl-valid',
          title: 'SSL Certificate Check Status',
          passed: false,
          severity: 'HIGH',
          description: `Unable to fully inspect SSL certificate handshake: ${err.message}`,
          solution: 'Confirm target domain resolves and accepts external SSL requests.',
        });
      }
    } else {
      checks.push({
        checkId: 'sec-ssl-valid',
        title: 'SSL Certificate Validity',
        passed: false,
        severity: 'CRITICAL',
        description: 'Unable to check SSL validity since HTTPS is disabled.',
      });
    }

    // 3. Inspect Response Headers for Security Protocols
    const headers = rootPage.headers || {};
    const securityHeaders = [
      {
        name: 'Strict-Transport-Security',
        key: 'strict-transport-security',
        title: 'Strict-Transport-Security (HSTS)',
        severity: 'HIGH' as Severity,
        description: 'HSTS header forces connections over HTTPS and blocks eavesdropping.',
        solution: 'Add header: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
      },
      {
        name: 'Content-Security-Policy',
        key: 'content-security-policy',
        title: 'Content-Security-Policy (CSP)',
        severity: 'HIGH' as Severity,
        description: 'CSP mitigates XSS risks by defining trusted scripts, frames, and styles.',
        solution: 'Implement robust CSP directive sets tailored to your client assets.',
      },
      {
        name: 'X-Frame-Options',
        key: 'x-frame-options',
        title: 'X-Frame-Options (Clickjacking defense)',
        severity: 'MEDIUM' as Severity,
        description: 'X-Frame-Options prevents attackers from placing your page in an iframe (clickjacking).',
        solution: 'Add header: X-Frame-Options: SAMEORIGIN',
      },
      {
        name: 'X-Content-Type-Options',
        key: 'x-content-type-options',
        title: 'X-Content-Type-Options',
        severity: 'LOW' as Severity,
        description: 'Blocks browsers from MIME-sniffing away from declared content-type headers.',
        solution: 'Add header: X-Content-Type-Options: nosniff',
      },
      {
        name: 'Referrer-Policy',
        key: 'referrer-policy',
        title: 'Referrer-Policy',
        severity: 'LOW' as Severity,
        description: 'Controls how much referrer information is shared when navigating outer links.',
        solution: 'Add header: Referrer-Policy: strict-origin-when-cross-origin',
      },
    ];

    for (const h of securityHeaders) {
      const val = headers[h.key] || headers[h.name.toLowerCase()];
      checks.push({
        checkId: `sec-header-${h.key}`,
        title: h.title,
        passed: Boolean(val),
        severity: h.severity,
        description: val 
          ? `Header present. Value: ${val}` 
          : `${h.name} header is missing from server response.`,
        solution: h.solution,
        value: val ? String(val) : undefined,
      });
    }

    // 4. Mixed Content Check inside Page DOM
    const html = rootPage.html || '';
    const matches = html.match(/src=["']http:\/\/([^"']+)["']/g) || [];
    const uniqueMixedSources = [...new Set(matches)];

    checks.push({
      checkId: 'sec-mixed-content',
      title: 'No Mixed Content (HTTP links on HTTPS page)',
      passed: uniqueMixedSources.length === 0,
      severity: 'HIGH',
      description: uniqueMixedSources.length === 0
        ? 'No mixed content resources found.'
        : `Found ${uniqueMixedSources.length} resource(s) loaded over HTTP on this HTTPS page.`,
      solution: 'Ensure all images, scripts, and stylesheets load exclusively over https protocol.',
      value: String(uniqueMixedSources.length),
    });

    const issues: Omit<Issue, 'id' | 'auditId'>[] = checks
      .filter(c => !c.passed)
      .map(c => ({
        module: 'SECURITY',
        checkId: c.checkId,
        title: c.title,
        description: c.description,
        severity: c.severity,
        solution: c.solution,
        pageUrl: url,
      }));

    return {
      score: this.calculateScore(checks),
      issues,
      checks,
    };
  }

  private calculateScore(checks: SecurityCheckResult[]): number {
    if (checks.length === 0) return 0;
    const weights: Record<Severity, number> = {
      CRITICAL: 6,
      HIGH: 4,
      MEDIUM: 2,
      LOW: 1,
      INFO: 0.5,
    };
    let total = 0, passed = 0;
    for (const c of checks) {
      const w = weights[c.severity] || 1;
      total += w;
      if (c.passed) passed += w;
    }
    return Math.round((passed / total) * 100);
  }
}
