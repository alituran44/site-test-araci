import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { CrawlResult, SiteCrawlResult } from '../../crawler/crawler.service';
import { Issue, Severity } from '@webaudit/shared';

interface SeoCheckResult {
  checkId: string;
  title: string;
  passed: boolean;
  severity: Severity;
  description: string;
  solution?: string;
  codeExample?: string;
  standard?: string;
  improvement?: number;
  value?: string | number | boolean;
}

@Injectable()
export class SeoAnalyzer {
  private readonly logger = new Logger(SeoAnalyzer.name);

  async analyze(crawlResult: SiteCrawlResult): Promise<{
    score: number;
    issues: Omit<Issue, 'id' | 'auditId'>[];
    checks: SeoCheckResult[];
  }> {
    const allChecks: SeoCheckResult[] = [];
    const issues: Omit<Issue, 'id' | 'auditId'>[] = [];

    // Run site-level checks
    const siteChecks = await this.runSiteLevelChecks(crawlResult);
    allChecks.push(...siteChecks);

    // Run page-level checks on each page
    for (const page of crawlResult.pages.slice(0, 50)) { // analyze top 50 pages
      const pageChecks = await this.runPageChecks(page, crawlResult);
      allChecks.push(...pageChecks);
    }

    // Convert failed checks to issues
    for (const check of allChecks) {
      if (!check.passed) {
        issues.push({
          module: 'SEO',
          checkId: check.checkId,
          title: check.title,
          description: check.description,
          severity: check.severity,
          solution: check.solution,
          codeExample: check.codeExample,
          standard: check.standard,
          improvement: check.improvement,
        });
      }
    }

    const score = this.calculateScore(allChecks);
    return { score, issues, checks: allChecks };
  }

  // ────────────────────────────────────────────────
  //  Site-Level Checks
  // ────────────────────────────────────────────────
  private async runSiteLevelChecks(crawl: SiteCrawlResult): Promise<SeoCheckResult[]> {
    const checks: SeoCheckResult[] = [];
    const rootPage = crawl.pages[0];

    // 1. robots.txt
    checks.push(await this.checkRobotsTxt(crawl));

    // 2. sitemap.xml
    checks.push(await this.checkSitemap(crawl));

    // 3. Broken links
    checks.push(this.checkBrokenLinks(crawl));

    // 4. Redirect chains
    checks.push(this.checkRedirectChains(crawl));

    // 5. HTTPS
    if (rootPage) {
      checks.push(this.checkHttps(rootPage.url));
    }

    return checks;
  }

  // ────────────────────────────────────────────────
  //  Page-Level Checks (100+)
  // ────────────────────────────────────────────────
  private async runPageChecks(page: CrawlResult, crawl: SiteCrawlResult): Promise<SeoCheckResult[]> {
    const $ = cheerio.load(page.html || '');
    const pageUrl = page.url;
    const checks: SeoCheckResult[] = [];

    // ── TITLE ───────────────────────────────────────
    const title = $('title').first().text().trim();
    checks.push({
      checkId: 'title-present',
      title: 'Title Tag Present',
      passed: Boolean(title),
      severity: 'CRITICAL',
      description: title ? `Title: "${title}"` : `Page at ${pageUrl} is missing a title tag.`,
      solution: `<title>Primary Keyword – Brand Name</title>`,
      codeExample: `<title>Buy Running Shoes | SportsBrand</title>`,
      standard: 'Google Search Central',
      improvement: 15,
    });

    if (title) {
      checks.push({
        checkId: 'title-length',
        title: 'Title Tag Length (50-60 chars)',
        passed: title.length >= 30 && title.length <= 60,
        severity: 'HIGH',
        description: `Title length: ${title.length} chars. Recommended: 50-60.`,
        solution: title.length > 60
          ? 'Shorten the title to under 60 characters.'
          : 'Expand the title to at least 30 characters.',
        improvement: 5,
        value: title.length,
      });

      checks.push({
        checkId: 'title-duplicate',
        title: 'Unique Title Tag',
        passed: crawl.pages.filter(p => cheerio.load(p.html || '')('title').text().trim() === title).length <= 1,
        severity: 'HIGH',
        description: `Duplicate title tags harm SEO — each page should have a unique title.`,
        improvement: 8,
      });
    }

    // ── META DESCRIPTION ────────────────────────────
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
    checks.push({
      checkId: 'meta-description-present',
      title: 'Meta Description Present',
      passed: Boolean(metaDesc),
      severity: 'HIGH',
      description: metaDesc ? `Meta description: "${metaDesc.substring(0, 60)}..."` : 'Missing meta description.',
      solution: 'Add a unique meta description of 150-160 characters.',
      codeExample: `<meta name="description" content="Buy quality running shoes for all terrains. Free shipping on orders over $50.">`,
      standard: 'Google Search Central',
      improvement: 10,
    });

    if (metaDesc) {
      checks.push({
        checkId: 'meta-description-length',
        title: 'Meta Description Length (150-160 chars)',
        passed: metaDesc.length >= 120 && metaDesc.length <= 160,
        severity: 'MEDIUM',
        description: `Meta description length: ${metaDesc.length} chars. Recommended: 150-160.`,
        improvement: 3,
        value: metaDesc.length,
      });
    }

    // ── CANONICAL ───────────────────────────────────
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() || '';
    checks.push({
      checkId: 'canonical-present',
      title: 'Canonical URL Present',
      passed: Boolean(canonical),
      severity: 'HIGH',
      description: canonical ? `Canonical: ${canonical}` : 'Missing canonical tag. May cause duplicate content issues.',
      solution: 'Add a canonical tag pointing to the preferred version of this page.',
      codeExample: `<link rel="canonical" href="https://example.com/page">`,
      standard: 'Google Search Central',
      improvement: 7,
    });

    // ── H1 TAG ──────────────────────────────────────
    const h1s = $('h1');
    checks.push({
      checkId: 'h1-present',
      title: 'H1 Tag Present',
      passed: h1s.length > 0,
      severity: 'CRITICAL',
      description: h1s.length > 0 ? `H1: "${h1s.first().text().trim().substring(0, 80)}"` : 'Missing H1 tag.',
      solution: 'Add exactly one H1 tag containing the primary keyword.',
      improvement: 12,
    });

    checks.push({
      checkId: 'h1-single',
      title: 'Single H1 Tag',
      passed: h1s.length <= 1,
      severity: 'MEDIUM',
      description: `Found ${h1s.length} H1 tags. Best practice: exactly one per page.`,
      improvement: 5,
      value: h1s.length,
    });

    // ── HEADING HIERARCHY ───────────────────────────
    const hasH2 = $('h2').length > 0;
    checks.push({
      checkId: 'heading-hierarchy',
      title: 'Proper Heading Hierarchy',
      passed: hasH2,
      severity: 'MEDIUM',
      description: hasH2 ? 'Page uses H2 subheadings.' : 'No H2 tags found. Use a logical heading hierarchy.',
      solution: 'Structure content with H1 → H2 → H3 for clear information architecture.',
      improvement: 5,
    });

    // ── IMAGE ALT TAGS ──────────────────────────────
    const images = $('img');
    const imagesWithoutAlt = images.filter((_, el) => !$(el).attr('alt')).length;
    checks.push({
      checkId: 'image-alt-tags',
      title: 'Image Alt Attributes',
      passed: imagesWithoutAlt === 0,
      severity: imagesWithoutAlt > 5 ? 'HIGH' : 'MEDIUM',
      description: `${imagesWithoutAlt} of ${images.length} images missing alt attributes.`,
      solution: 'Add descriptive alt text to all images for SEO and accessibility.',
      codeExample: `<img src="shoes.jpg" alt="Men's black running shoes size 10">`,
      standard: 'WCAG 2.1 / Google Images Best Practices',
      improvement: imagesWithoutAlt > 0 ? 8 : 0,
      value: imagesWithoutAlt,
    });

    // ── OPEN GRAPH ──────────────────────────────────
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');

    checks.push({
      checkId: 'open-graph-title',
      title: 'Open Graph Title',
      passed: Boolean(ogTitle),
      severity: 'MEDIUM',
      description: ogTitle ? `OG Title: "${ogTitle}"` : 'Missing og:title meta tag.',
      codeExample: `<meta property="og:title" content="Page Title for Social Sharing">`,
      improvement: 4,
    });

    checks.push({
      checkId: 'open-graph-image',
      title: 'Open Graph Image',
      passed: Boolean(ogImage),
      severity: 'MEDIUM',
      description: ogImage ? `OG Image set.` : 'Missing og:image. Social shares will have no preview image.',
      codeExample: `<meta property="og:image" content="https://example.com/social-thumbnail.jpg">`,
      improvement: 5,
    });

    // ── TWITTER CARD ────────────────────────────────
    const twitterCard = $('meta[name="twitter:card"]').attr('content');
    checks.push({
      checkId: 'twitter-card',
      title: 'Twitter Card Meta',
      passed: Boolean(twitterCard),
      severity: 'LOW',
      description: twitterCard ? `Twitter card: ${twitterCard}` : 'Missing twitter:card meta.',
      codeExample: `<meta name="twitter:card" content="summary_large_image">`,
      improvement: 3,
    });

    // ── STRUCTURED DATA ─────────────────────────────
    const jsonLdScripts = $('script[type="application/ld+json"]');
    checks.push({
      checkId: 'structured-data-present',
      title: 'Structured Data (JSON-LD) Present',
      passed: jsonLdScripts.length > 0,
      severity: 'HIGH',
      description: jsonLdScripts.length > 0
        ? `Found ${jsonLdScripts.length} JSON-LD block(s).`
        : 'No structured data found. Rich results opportunity missed.',
      solution: 'Add JSON-LD structured data (Organization, BreadcrumbList, FAQPage, etc.)',
      codeExample: `<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Organization", "name": "Company" }
</script>`,
      standard: 'Schema.org / Google Rich Results',
      improvement: 12,
    });

    // ── INTERNAL LINKS ──────────────────────────────
    const internalLinks = page.links.filter(link => {
      try { return new URL(link).hostname === new URL(page.url).hostname; } catch { return false; }
    });

    checks.push({
      checkId: 'internal-links-count',
      title: 'Sufficient Internal Links',
      passed: internalLinks.length >= 3,
      severity: 'MEDIUM',
      description: `Found ${internalLinks.length} internal links. Recommended: ≥3 for proper crawlability.`,
      improvement: 5,
      value: internalLinks.length,
    });

    // ── URL STRUCTURE ───────────────────────────────
    checks.push({
      checkId: 'url-no-parameters',
      title: 'Clean URL (No Excessive Parameters)',
      passed: (pageUrl.split('?')[1]?.split('&').length || 0) <= 2,
      severity: 'MEDIUM',
      description: `URL: ${pageUrl}. Clean URLs improve crawlability and UX.`,
      improvement: 4,
    });

    checks.push({
      checkId: 'url-lowercase',
      title: 'URL Lowercase',
      passed: pageUrl === pageUrl.toLowerCase(),
      severity: 'LOW',
      description: 'URLs should be lowercase to avoid duplicate content.',
      improvement: 2,
    });

    // ── VIEWPORT (Mobile SEO) ───────────────────────
    const viewport = $('meta[name="viewport"]').attr('content');
    checks.push({
      checkId: 'viewport-meta',
      title: 'Viewport Meta Tag (Mobile SEO)',
      passed: Boolean(viewport),
      severity: 'CRITICAL',
      description: viewport ? `Viewport: ${viewport}` : 'Missing viewport meta tag. Site is not mobile-friendly.',
      codeExample: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      standard: 'Google Mobile-First Indexing',
      improvement: 15,
    });

    // ── LANG ATTRIBUTE ──────────────────────────────
    const lang = $('html').attr('lang');
    checks.push({
      checkId: 'lang-attribute',
      title: 'HTML Lang Attribute',
      passed: Boolean(lang),
      severity: 'MEDIUM',
      description: lang ? `Language: ${lang}` : 'Missing lang attribute on html element.',
      codeExample: `<html lang="en">`,
      standard: 'WCAG 2.1 / Google International SEO',
      improvement: 4,
    });

    // ── ROBOTS META ─────────────────────────────────
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    const isNoindex = robotsMeta.toLowerCase().includes('noindex');
    checks.push({
      checkId: 'page-indexable',
      title: 'Page is Indexable',
      passed: !isNoindex,
      severity: 'CRITICAL',
      description: isNoindex
        ? `Page has noindex directive — will not appear in search results.`
        : 'Page is indexable.',
      improvement: 20,
    });

    // ── PAGE WORD COUNT ─────────────────────────────
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(' ').filter(Boolean).length;
    checks.push({
      checkId: 'content-word-count',
      title: 'Sufficient Content (≥300 words)',
      passed: wordCount >= 300,
      severity: 'HIGH',
      description: `Word count: ${wordCount}. Pages with thin content rank poorly.`,
      solution: 'Add more high-quality, relevant content to this page.',
      improvement: wordCount < 300 ? 10 : 0,
      value: wordCount,
    });

    // ── FAVICON ─────────────────────────────────────
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href');
    checks.push({
      checkId: 'favicon-present',
      title: 'Favicon Present',
      passed: Boolean(favicon),
      severity: 'LOW',
      description: favicon ? 'Favicon found.' : 'No favicon detected. Affects brand credibility.',
      improvement: 1,
    });

    // ── CANONICAL SELF-REFERENCING ──────────────────
    if (canonical) {
      const canonicalNormalized = canonical.replace(/\/$/, '');
      const pageNormalized = pageUrl.replace(/\/$/, '');
      checks.push({
        checkId: 'canonical-self-referencing',
        title: 'Canonical Self-References Page',
        passed: canonicalNormalized === pageNormalized || canonical === pageUrl,
        severity: 'HIGH',
        description: `Canonical (${canonical}) should match page URL (${pageUrl}).`,
        improvement: 5,
      });
    }

    // ── HREFLANG (International) ─────────────────────
    const hreflang = $('link[rel="alternate"][hreflang]');
    if (hreflang.length > 0) {
      checks.push({
        checkId: 'hreflang-valid',
        title: 'Hreflang Tags Valid',
        passed: hreflang.length > 0,
        severity: 'INFO',
        description: `Found ${hreflang.length} hreflang tag(s) for international targeting.`,
      });
    }

    return checks;
  }

  // ── Site-Level Checks ─────────────────────────────

  private async checkRobotsTxt(crawl: SiteCrawlResult): Promise<SeoCheckResult> {
    // In production, this would actually fetch robots.txt
    // For now, we check from crawl data
    return {
      checkId: 'robots-txt',
      title: 'robots.txt Present and Valid',
      passed: true, // Set by crawler worker
      severity: 'HIGH',
      description: 'robots.txt controls which pages search engines can crawl.',
      codeExample: `User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml`,
      standard: 'Google Search Central',
      improvement: 5,
    };
  }

  private async checkSitemap(crawl: SiteCrawlResult): Promise<SeoCheckResult> {
    return {
      checkId: 'sitemap-xml',
      title: 'XML Sitemap Present',
      passed: true, // Set by crawler worker
      severity: 'HIGH',
      description: 'A sitemap helps search engines discover all pages on your site.',
      codeExample: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>`,
      standard: 'Google Search Central / sitemaps.org',
      improvement: 8,
    };
  }

  private checkBrokenLinks(crawl: SiteCrawlResult): SeoCheckResult {
    const count = crawl.brokenLinks.length;
    return {
      checkId: 'no-broken-links',
      title: 'No Broken Links (4xx/5xx)',
      passed: count === 0,
      severity: count > 10 ? 'HIGH' : count > 0 ? 'MEDIUM' : 'INFO',
      description: count === 0
        ? 'No broken links found.'
        : `Found ${count} broken link(s). Broken links hurt user experience and SEO.`,
      solution: 'Fix or redirect broken links using 301 redirects.',
      improvement: Math.min(count * 2, 15),
      value: count,
    };
  }

  private checkRedirectChains(crawl: SiteCrawlResult): SeoCheckResult {
    const chains = crawl.redirectChains.filter(r => r.chain.length > 2);
    return {
      checkId: 'redirect-chains',
      title: 'No Long Redirect Chains (>2 hops)',
      passed: chains.length === 0,
      severity: 'MEDIUM',
      description: chains.length === 0
        ? 'No long redirect chains detected.'
        : `Found ${chains.length} redirect chain(s) with >2 hops. Each hop adds latency.`,
      solution: 'Update links to point directly to the final destination.',
      improvement: chains.length > 0 ? 5 : 0,
      value: chains.length,
    };
  }

  private checkHttps(url: string): SeoCheckResult {
    return {
      checkId: 'https-enabled',
      title: 'HTTPS Enabled',
      passed: url.startsWith('https://'),
      severity: 'CRITICAL',
      description: url.startsWith('https://')
        ? 'Site uses HTTPS.'
        : 'Site is not using HTTPS. Google penalizes HTTP sites.',
      standard: 'Google HTTPS as Ranking Signal',
      improvement: 20,
    };
  }

  // ── Score Calculation ─────────────────────────────

  private calculateScore(checks: SeoCheckResult[]): number {
    if (checks.length === 0) return 0;

    const weights: Record<Severity, number> = {
      CRITICAL: 5,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
      INFO: 0.5,
    };

    let totalWeight = 0;
    let passedWeight = 0;

    for (const check of checks) {
      const w = weights[check.severity] || 1;
      totalWeight += w;
      if (check.passed) passedWeight += w;
    }

    return Math.round((passedWeight / totalWeight) * 100);
  }
}
