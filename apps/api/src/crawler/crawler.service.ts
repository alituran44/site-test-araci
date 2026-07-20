import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Browser, BrowserContext, chromium, Page } from 'playwright';

export interface CrawlResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  title: string;
  html: string;
  headers: Record<string, string>;
  links: string[];
  redirectChain: string[];
}

export interface SiteCrawlResult {
  rootUrl: string;
  pages: CrawlResult[];
  brokenLinks: string[];
  redirectChains: Array<{ from: string; to: string; chain: string[] }>;
  totalTime: number;
}

@Injectable()
export class CrawlerService implements OnModuleDestroy {
  private readonly logger = new Logger(CrawlerService.name);
  private browser: Browser | null = null;

  // Get or create singleton browser instance
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });
      this.logger.log('Browser instance launched');
    }
    return this.browser;
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Browser instance closed');
    }
  }

  /**
   * Crawl an entire site using BFS link discovery.
   * Uses BrowserContext per crawl job (isolation), NOT per page (performance).
   */
  async crawlSite(
    rootUrl: string,
    options: { maxPages?: number; respectRobots?: boolean } = {},
  ): Promise<SiteCrawlResult> {
    const { maxPages = 100, respectRobots = true } = options;
    const startTime = Date.now();

    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'WebAuditBot/1.0 (+https://webaudit.ai/bot)',
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    // Block unnecessary resources (images, fonts, media) — reduces bandwidth 60-70%
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media', 'websocket'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    const visited = new Set<string>();
    const queue: string[] = [this.normalizeUrl(rootUrl)];
    const pages: CrawlResult[] = [];
    const brokenLinks: string[] = [];
    const redirectChains: Array<{ from: string; to: string; chain: string[] }> = [];

    const rootDomain = new URL(rootUrl).hostname;

    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const result = await this.crawlPage(context, url);

        if (result.statusCode >= 400) {
          brokenLinks.push(url);
        } else {
          pages.push(result);
        }

        // Track redirects
        if (result.redirectChain.length > 0) {
          redirectChains.push({
            from: url,
            to: result.finalUrl,
            chain: result.redirectChain,
          });
        }

        // Discover new internal links
        for (const link of result.links) {
          try {
            const linkUrl = new URL(link, rootUrl);
            const isInternal = linkUrl.hostname === rootDomain ||
              linkUrl.hostname.endsWith(`.${rootDomain}`);
            const normalized = this.normalizeUrl(linkUrl.href);

            if (isInternal && !visited.has(normalized) && !queue.includes(normalized)) {
              queue.push(normalized);
            }
          } catch {
            // Invalid URL — skip
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to crawl ${url}: ${err.message}`);
        brokenLinks.push(url);
      }
    }

    await context.close();

    return {
      rootUrl,
      pages,
      brokenLinks,
      redirectChains,
      totalTime: Date.now() - startTime,
    };
  }

  private async crawlPage(context: BrowserContext, url: string): Promise<CrawlResult> {
    const page = await context.newPage();
    const redirectChain: string[] = [];

    page.on('response', (response) => {
      if ([301, 302, 303, 307, 308].includes(response.status())) {
        redirectChain.push(response.url());
      }
    });

    let statusCode = 200;
    let responseHeaders: Record<string, string> = {};

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      statusCode = response?.status() ?? 0;
      response?.headers() && (responseHeaders = response.headers() as Record<string, string>);
    } catch (err) {
      await page.close();
      throw err;
    }

    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    const html = await page.content().catch(() => '');

    // Extract all links
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      return Array.from(anchors)
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean);
    }).catch(() => []);

    await page.close();

    return {
      url,
      finalUrl,
      statusCode,
      title,
      html,
      headers: responseHeaders,
      links,
      redirectChain,
    };
  }

  /**
   * Crawl a single page — used by analyzers that need page data
   */
  async crawlSinglePage(url: string): Promise<CrawlResult & { page?: Page }> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const result = await this.crawlPage(context, url);
    await context.close();
    return result;
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = ''; // Remove hash fragments
      return u.href.replace(/\/$/, ''); // Remove trailing slash
    } catch {
      return url;
    }
  }
}
