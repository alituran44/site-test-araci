import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { CrawlResult, SiteCrawlResult } from '../../crawler/crawler.service';
import { Issue, Severity } from '@webaudit/shared';

interface GeoCheck {
  checkId: string;
  title: string;
  passed: boolean;
  severity: Severity;
  description: string;
  solution?: string;
  codeExample?: string;
  improvement?: number;
  value?: string | number | boolean;
}

@Injectable()
export class GeoAnalyzer {
  private readonly logger = new Logger(GeoAnalyzer.name);

  async analyze(crawlResult: SiteCrawlResult): Promise<{
    score: number;
    issues: Omit<Issue, 'id' | 'auditId'>[];
    schemaTypes: string[];
    eeatScore: number;
    aiReadabilityScore: number;
  }> {
    const rootPage = crawlResult.pages[0];
    if (!rootPage) return { score: 0, issues: [], schemaTypes: [], eeatScore: 0, aiReadabilityScore: 0 };

    const checks: GeoCheck[] = [];
    const $ = cheerio.load(rootPage.html || '');

    // Run all GEO checks
    checks.push(...this.checkLlmsTxt(crawlResult));
    checks.push(...this.checkStructuredData($));
    checks.push(...this.checkEEAT($, rootPage));
    checks.push(...this.checkAiReadability($, rootPage));
    checks.push(...this.checkSemanticHtml($));
    checks.push(...this.checkChunkStructure($));
    checks.push(...this.checkEntitySignals($, rootPage));

    const schemaTypes = this.extractSchemaTypes($);
    const eeatScore = this.calculateEeatScore($, rootPage);
    const aiReadabilityScore = this.calculateAiReadabilityScore($);

    const issues: Omit<Issue, 'id' | 'auditId'>[] = checks
      .filter(c => !c.passed)
      .map(c => ({
        module: 'GEO' as const,
        checkId: c.checkId,
        title: c.title,
        description: c.description,
        severity: c.severity,
        solution: c.solution,
        codeExample: c.codeExample,
        improvement: c.improvement,
      }));

    const score = this.calculateScore(checks);
    return { score, issues, schemaTypes, eeatScore, aiReadabilityScore };
  }

  // ── llms.txt ──────────────────────────────────────
  private checkLlmsTxt(crawl: SiteCrawlResult): GeoCheck[] {
    // This would check if /llms.txt is accessible — simulated here
    return [
      {
        checkId: 'llms-txt-present',
        title: 'llms.txt File Present',
        passed: false, // Will be set by crawler worker
        severity: 'HIGH',
        description: 'llms.txt is an emerging standard that tells AI systems how to interact with your site content. Missing = AI crawlers get no guidance.',
        solution: 'Create a /llms.txt file at your domain root.',
        codeExample: `# llms.txt — AI Crawler Guide
## Site Overview
Company: Example Corp
Description: We sell eco-friendly running shoes.

## Pages
- /: Homepage
- /products: Product catalog
- /about: Company info`,
        improvement: 10,
      },
      {
        checkId: 'robots-txt-ai-crawlers',
        title: 'robots.txt Allows AI Crawlers',
        passed: true, // Set by crawler worker
        severity: 'MEDIUM',
        description: 'Ensure GPTBot, Claude-Web, PerplexityBot are not blocked in robots.txt.',
        codeExample: `# Allow major AI crawlers
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /`,
        improvement: 8,
      },
    ];
  }

  // ── Structured Data ──────────────────────────────
  private checkStructuredData($: cheerio.CheerioAPI): GeoCheck[] {
    const checks: GeoCheck[] = [];
    const scripts = $('script[type="application/ld+json"]');
    const rawSchemas: any[] = [];

    scripts.each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        rawSchemas.push(data);
      } catch {}
    });

    const schemaTypes = rawSchemas.flatMap(s =>
      Array.isArray(s['@graph']) ? s['@graph'].map((g: any) => g['@type']) : [s['@type']],
    ).filter(Boolean);

    // FAQ Schema
    checks.push({
      checkId: 'faq-schema',
      title: 'FAQPage Schema Present',
      passed: schemaTypes.some(t => t === 'FAQPage'),
      severity: 'HIGH',
      description: 'FAQPage schema helps AI systems extract Q&A pairs to answer user queries directly.',
      codeExample: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "How fast is shipping?",
    "acceptedAnswer": { "@type": "Answer", "text": "We ship within 24 hours." }
  }]
}
</script>`,
      improvement: 12,
    });

    // Organization Schema
    checks.push({
      checkId: 'organization-schema',
      title: 'Organization Schema Present',
      passed: schemaTypes.some(t => ['Organization', 'LocalBusiness', 'Corporation'].includes(t)),
      severity: 'HIGH',
      description: 'Organization schema establishes entity identity in knowledge graphs.',
      codeExample: `{ "@type": "Organization", "name": "Company", "url": "https://example.com", "logo": "..." }`,
      improvement: 10,
    });

    // Article Schema
    checks.push({
      checkId: 'article-schema',
      title: 'Article/BlogPosting Schema',
      passed: schemaTypes.some(t => ['Article', 'BlogPosting', 'NewsArticle'].includes(t)),
      severity: 'MEDIUM',
      description: 'Article schema enables AI to extract author, publish date, and content for citations.',
      improvement: 8,
    });

    // BreadcrumbList
    checks.push({
      checkId: 'breadcrumb-schema',
      title: 'BreadcrumbList Schema',
      passed: schemaTypes.some(t => t === 'BreadcrumbList'),
      severity: 'MEDIUM',
      description: 'Breadcrumb schema helps AI understand site hierarchy and page context.',
      improvement: 6,
    });

    // Speakable Schema
    checks.push({
      checkId: 'speakable-schema',
      title: 'Speakable Schema (Voice Search)',
      passed: schemaTypes.some(t => t === 'Speakable'),
      severity: 'LOW',
      description: 'Speakable schema marks content suitable for audio playback in voice assistants.',
      improvement: 5,
    });

    // JSON-LD validity
    checks.push({
      checkId: 'json-ld-valid',
      title: 'JSON-LD Blocks Are Valid',
      passed: rawSchemas.length > 0 && rawSchemas.every(s => s['@context'] && s['@type']),
      severity: 'HIGH',
      description: 'All JSON-LD blocks must have @context and @type for AI systems to process them.',
      improvement: 8,
    });

    return checks;
  }

  // ── E-E-A-T Signals ──────────────────────────────
  private checkEEAT($: cheerio.CheerioAPI, page: CrawlResult): GeoCheck[] {
    const checks: GeoCheck[] = [];
    const text = $('body').text().toLowerCase();

    // Author information
    const hasAuthor = Boolean(
      $('[rel="author"], [class*="author"], [itemprop="author"]').length ||
      text.includes('written by') || text.includes('yazar')
    );
    checks.push({
      checkId: 'eeat-author',
      title: 'Author Information Present (E-E-A-T)',
      passed: hasAuthor,
      severity: 'HIGH',
      description: 'Explicit authorship is critical for AI systems evaluating content credibility.',
      solution: 'Add author bylines with schema markup.',
      codeExample: `<span itemprop="author" itemscope itemtype="https://schema.org/Person">
  <a href="/about/jane-doe"><span itemprop="name">Jane Doe</span></a>
</span>`,
      improvement: 10,
    });

    // Publication date
    const hasDate = Boolean(
      $('[datetime], [itemprop="datePublished"], time').length
    );
    checks.push({
      checkId: 'eeat-date',
      title: 'Publication/Update Date Present (E-E-A-T)',
      passed: hasDate,
      severity: 'MEDIUM',
      description: 'AI systems prefer fresh, dated content. Missing dates reduce citation probability.',
      codeExample: `<time datetime="2025-01-20" itemprop="datePublished">January 20, 2025</time>`,
      improvement: 7,
    });

    // About page
    checks.push({
      checkId: 'eeat-about-page',
      title: 'About Page Link Present (E-E-A-T)',
      passed: $('a[href*="/about"]').length > 0,
      severity: 'MEDIUM',
      description: 'An about page signals transparency, which AI systems use to assess trustworthiness.',
      improvement: 5,
    });

    // Privacy Policy / Terms
    const hasLegal = $('a[href*="privacy"], a[href*="terms"]').length > 0;
    checks.push({
      checkId: 'eeat-legal-pages',
      title: 'Privacy Policy / Terms Pages Present (Trust)',
      passed: hasLegal,
      severity: 'MEDIUM',
      description: 'Legal pages establish site trustworthiness for AI content evaluation.',
      improvement: 4,
    });

    // External citations/links
    const externalLinks = $('a[href^="http"]').filter((_, el) => {
      try {
        return new URL($(el).attr('href')!).hostname !== new URL(page.url).hostname;
      } catch { return false; }
    });
    checks.push({
      checkId: 'eeat-external-citations',
      title: 'Cites External Sources (Authority Building)',
      passed: externalLinks.length >= 2,
      severity: 'LOW',
      description: `Found ${externalLinks.length} external links. Citing authoritative sources improves E-E-A-T.`,
      improvement: 5,
      value: externalLinks.length,
    });

    return checks;
  }

  // ── AI Readability ───────────────────────────────
  private checkAiReadability($: cheerio.CheerioAPI, page: CrawlResult): GeoCheck[] {
    const checks: GeoCheck[] = [];

    // Semantic HTML elements
    const semanticElements = ['main', 'article', 'section', 'header', 'footer', 'nav', 'aside'];
    const semanticCount = semanticElements.reduce((acc, el) => acc + $(el).length, 0);

    checks.push({
      checkId: 'ai-readability-semantic-html',
      title: 'Semantic HTML Elements Used',
      passed: semanticCount >= 3,
      severity: 'HIGH',
      description: `Found ${semanticCount} semantic HTML elements. AI systems extract content structure from semantic tags.`,
      solution: 'Use <main>, <article>, <section>, <header>, <footer> instead of generic <div>.',
      improvement: 8,
    });

    // Short paragraphs (chunking)
    const paragraphs = $('p');
    const avgWordCount = paragraphs.toArray().reduce((acc, p) => {
      return acc + $(p).text().split(' ').filter(Boolean).length;
    }, 0) / Math.max(paragraphs.length, 1);

    checks.push({
      checkId: 'ai-chunk-structure',
      title: 'Chunked Content (Short Paragraphs for AI)',
      passed: avgWordCount <= 80,
      severity: 'MEDIUM',
      description: `Average paragraph length: ${Math.round(avgWordCount)} words. AI systems prefer chunks of ≤80 words.`,
      solution: 'Break long paragraphs into shorter, focused chunks with clear topic sentences.',
      improvement: 6,
    });

    // Heading use (content navigation)
    const headingCount = $('h2, h3, h4').length;
    checks.push({
      checkId: 'ai-heading-density',
      title: 'Adequate Heading Density for AI Navigation',
      passed: headingCount >= 3,
      severity: 'MEDIUM',
      description: `${headingCount} H2-H4 headings found. AI systems use headings to segment and index content.`,
      improvement: 5,
    });

    // Tables for structured data
    const tables = $('table').length;
    if (tables > 0) {
      checks.push({
        checkId: 'ai-table-headers',
        title: 'Tables Have Proper Headers',
        passed: $('table th').length > 0,
        severity: 'MEDIUM',
        description: 'Tables without headers are hard for AI systems to interpret.',
        codeExample: `<table><thead><tr><th>Product</th><th>Price</th></tr></thead>...</table>`,
        improvement: 4,
      });
    }

    // Language clarity (no excessive jargon)
    checks.push({
      checkId: 'ai-language-declaration',
      title: 'Language Declared for AI Parsing',
      passed: Boolean($('html').attr('lang')),
      severity: 'HIGH',
      description: 'Without a lang attribute, AI systems cannot apply correct language parsing rules.',
      improvement: 6,
    });

    return checks;
  }

  // ── Semantic HTML ─────────────────────────────────
  private checkSemanticHtml($: cheerio.CheerioAPI): GeoCheck[] {
    return [
      {
        checkId: 'semantic-main-element',
        title: '<main> Element Present',
        passed: $('main').length === 1,
        severity: 'MEDIUM',
        description: 'A single <main> element helps AI identify primary content.',
        improvement: 4,
      },
      {
        checkId: 'semantic-nav-element',
        title: '<nav> Element for Navigation',
        passed: $('nav').length >= 1,
        severity: 'LOW',
        description: '<nav> elements help AI distinguish navigation from main content.',
        improvement: 2,
      },
    ];
  }

  // ── Chunk Structure ───────────────────────────────
  private checkChunkStructure($: cheerio.CheerioAPI): GeoCheck[] {
    const listsCount = $('ul, ol').length;
    return [
      {
        checkId: 'chunk-lists-present',
        title: 'Lists Used for Structured Content',
        passed: listsCount >= 1,
        severity: 'LOW',
        description: `${listsCount} lists found. Lists are easily parseable by AI systems for extracting enumerations.`,
        improvement: 3,
      },
    ];
  }

  // ── Entity Signals ─────────────────────────────────
  private checkEntitySignals($: cheerio.CheerioAPI, page: CrawlResult): GeoCheck[] {
    const hostname = new URL(page.url).hostname;
    const hasSchemaContext = $('script[type="application/ld+json"]').length > 0;

    return [
      {
        checkId: 'entity-schema-context',
        title: 'Entity Defined via Schema.org',
        passed: hasSchemaContext,
        severity: 'HIGH',
        description: 'Schema.org markup establishes your site as a recognizable entity in AI knowledge graphs.',
        improvement: 10,
      },
      {
        checkId: 'entity-social-profiles',
        title: 'Social Profile Links (Entity Building)',
        passed: $('a[href*="linkedin"], a[href*="twitter"], a[href*="facebook"]').length > 0,
        severity: 'MEDIUM',
        description: 'Linking to social profiles helps AI systems verify your entity across the web.',
        improvement: 4,
      },
    ];
  }

  // ── Helpers ──────────────────────────────────────
  private extractSchemaTypes($: cheerio.CheerioAPI): string[] {
    const types: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data['@graph']) {
          data['@graph'].forEach((item: any) => item['@type'] && types.push(item['@type']));
        } else if (data['@type']) {
          types.push(data['@type']);
        }
      } catch {}
    });
    return [...new Set(types)];
  }

  private calculateEeatScore($: cheerio.CheerioAPI, page: CrawlResult): number {
    let score = 0;
    const text = $('body').text().toLowerCase();

    if ($('[itemprop="author"], [rel="author"]').length > 0) score += 25;
    if ($('time[datetime]').length > 0) score += 20;
    if ($('a[href*="/about"]').length > 0) score += 15;
    if ($('a[href*="privacy"]').length > 0) score += 15;
    if ($('script[type="application/ld+json"]').length > 0) score += 25;

    return Math.min(score, 100);
  }

  private calculateAiReadabilityScore($: cheerio.CheerioAPI): number {
    let score = 0;

    const semanticElements = ['main', 'article', 'section', 'header', 'footer', 'nav'];
    const semanticCount = semanticElements.reduce((acc, el) => acc + $(el).length, 0);
    score += Math.min(semanticCount * 5, 25);

    if ($('html').attr('lang')) score += 20;
    if ($('h2, h3').length >= 3) score += 20;
    if ($('script[type="application/ld+json"]').length > 0) score += 20;
    if ($('p').length >= 5) score += 15;

    return Math.min(score, 100);
  }

  private calculateScore(checks: GeoCheck[]): number {
    if (checks.length === 0) return 0;
    const weights: Record<Severity, number> = { CRITICAL: 5, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0.5 };
    let total = 0, passed = 0;
    for (const c of checks) {
      const w = weights[c.severity] || 1;
      total += w;
      if (c.passed) passed += w;
    }
    return Math.round((passed / total) * 100);
  }
}
