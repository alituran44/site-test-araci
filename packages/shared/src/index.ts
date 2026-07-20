// ──────────────────────────────────────────────
//  WebAudit AI – Shared Types
//  Used by both frontend (Next.js) and backend (NestJS)
// ──────────────────────────────────────────────

export type AuditStatus =
  | 'PENDING'
  | 'CRAWLING'
  | 'SEO_ANALYSIS'
  | 'GEO_ANALYSIS'
  | 'PERFORMANCE_ANALYSIS'
  | 'SECURITY_ANALYSIS'
  | 'ACCESSIBILITY_ANALYSIS'
  | 'AI_ANALYSIS'
  | 'REPORT_GENERATION'
  | 'COMPLETED'
  | 'FAILED';

export type Module =
  | 'SEO'
  | 'GEO'
  | 'PERFORMANCE'
  | 'SECURITY'
  | 'ACCESSIBILITY'
  | 'CODE_QUALITY'
  | 'UIUX';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Plan = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY' | 'ENTERPRISE';

// ── Scores ──────────────────────────────────────
export interface AuditScores {
  overall: number;   // 0-100
  seo: number;
  geo: number;
  performance: number;
  security: number;
  accessibility: number;
  codeQuality: number;
  uiux: number;
}

// ── Issue ──────────────────────────────────────
export interface Issue {
  id: string;
  auditId: string;
  module: Module;
  checkId: string;          // e.g. "meta-description-missing"
  title: string;
  description: string;
  severity: Severity;
  impact?: string;          // "This affects 94% of mobile users..."
  solution?: string;        // human-readable fix
  codeExample?: string;     // code snippet showing fix
  standard?: string;        // "WCAG 2.1 AA", "Google Search Central"
  resources?: string[];     // external URLs
  improvement?: number;     // estimated % improvement
  pageUrl?: string;         // specific page where found
  metadata?: Record<string, unknown>; // module-specific extras
}

// ── Pages ──────────────────────────────────────
export interface AuditPage {
  id: string;
  auditId: string;
  url: string;
  title?: string;
  statusCode?: number;
  data: Record<string, unknown>;
}

// ── Report ──────────────────────────────────────
export interface Report {
  id: string;
  auditId: string;
  pdfUrl?: string;
  htmlUrl?: string;
  jsonUrl?: string;
  csvUrl?: string;
  createdAt: string;
}

// ── Audit ──────────────────────────────────────
export interface Audit {
  id: string;
  userId: string;
  url: string;
  status: AuditStatus;
  progress: number;         // 0-100
  scores?: AuditScores;
  crawlData?: CrawlData;
  pages?: AuditPage[];
  issues?: Issue[];
  report?: Report;
  aiSummary?: string;
  createdAt: string;
  completedAt?: string;
}

// ── Crawl Data ──────────────────────────────────
export interface CrawlData {
  totalPages: number;
  crawledPages: number;
  failedPages: number;
  totalLinks: number;
  brokenLinks: number;
  redirectChains: RedirectChain[];
  robotsTxt?: RobotsTxt;
  sitemap?: SitemapData;
}

export interface RedirectChain {
  from: string;
  to: string;
  statusCode: number;
  chain: string[];
}

export interface RobotsTxt {
  exists: boolean;
  url?: string;
  content?: string;
  allowsAll: boolean;
  disallowedPaths: string[];
  sitemapUrls: string[];
}

export interface SitemapData {
  exists: boolean;
  url?: string;
  totalUrls: number;
  validUrls: number;
  invalidUrls: string[];
}

// ── SEO Analysis ──────────────────────────────────
export interface SeoAnalysis {
  score: number;
  checks: SeoCheck[];
}

export interface SeoCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: Severity;
  value?: string | number | boolean;
  recommendation?: string;
}

// ── GEO Analysis ──────────────────────────────────
export interface GeoAnalysis {
  score: number;
  checks: GeoCheck[];
  schemaTypes: string[];
  eeatScore: number;
  aiReadabilityScore: number;
}

export interface GeoCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: Severity;
  details?: string;
}

// ── Performance ──────────────────────────────────
export interface PerformanceAnalysis {
  score: number;
  lcp: MetricResult;   // Largest Contentful Paint
  fcp: MetricResult;   // First Contentful Paint
  cls: MetricResult;   // Cumulative Layout Shift
  inp: MetricResult;   // Interaction to Next Paint
  ttfb: MetricResult;  // Time to First Byte
  speedIndex: MetricResult;
  tbt: MetricResult;   // Total Blocking Time
  opportunities: PerformanceOpportunity[];
}

export interface MetricResult {
  value: number;
  unit: 'ms' | 's' | 'none';
  score: number;        // 0-1 Lighthouse-style
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface PerformanceOpportunity {
  id: string;
  title: string;
  description: string;
  savingsMs?: number;
  savingsBytes?: number;
}

// ── Security ──────────────────────────────────
export interface SecurityAnalysis {
  score: number;
  https: boolean;
  sslValid: boolean;
  sslExpiry?: string;
  tlsVersion?: string;
  headers: SecurityHeader[];
  mixedContent: boolean;
  cookieIssues: CookieIssue[];
}

export interface SecurityHeader {
  name: string;
  present: boolean;
  value?: string;
  recommendation?: string;
  severity: Severity;
}

export interface CookieIssue {
  name: string;
  missingSameSite: boolean;
  missingSecure: boolean;
  missingHttpOnly: boolean;
}

// ── Accessibility ──────────────────────────────────
export interface AccessibilityAnalysis {
  score: number;
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  pagesAudited: number;
}

export interface AxeViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  helpUrl: string;
  nodes: AxeNode[];
}

export interface AxeNode {
  html: string;
  target: string[];
  failureSummary: string;
  pageUrl?: string;
}

// ── AI Summary ──────────────────────────────────
export interface AiInsight {
  executiveSummary: string;
  topPriorities: AiPriority[];
  estimatedImprovements: EstimatedImprovement[];
  technicalDebt: string;
}

export interface AiPriority {
  rank: number;
  module: Module;
  title: string;
  why: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  codeExample?: string;
}

export interface EstimatedImprovement {
  module: Module;
  currentScore: number;
  projectedScore: number;
  improvements: string[];
}

// ── WebSocket Events ──────────────────────────────
export interface AuditProgressEvent {
  auditId: string;
  status: AuditStatus;
  progress: number;       // 0-100
  message: string;
  timestamp: string;
}

// ── API Response wrappers ──────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
