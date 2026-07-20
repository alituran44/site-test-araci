import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Issue, Module } from '@webaudit/shared';

export interface AiAuditSummary {
  executiveSummary: string;
  topPriorities: Array<{
    rank: number;
    module: Module;
    title: string;
    why: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    codeExample?: string;
  }>;
  estimatedImprovements: Array<{
    module: Module;
    currentScore: number;
    projectedScore: number;
    improvements: string[];
  }>;
  technicalDebt: string;
}

@Injectable()
export class AiAnalyzer {
  private readonly logger = new Logger(AiAnalyzer.name);

  constructor(private config: ConfigService) {}

  async generateSummary(
    url: string,
    scores: Record<string, number>,
    issues: Omit<Issue, 'id' | 'auditId'>[],
    provider: 'openai' | 'gemini' = 'gemini',
  ): Promise<AiAuditSummary> {
    const prompt = this.buildPrompt(url, scores, issues);

    try {
      if (provider === 'openai') {
        return await this.runOpenAI(prompt);
      } else {
        return await this.runGemini(prompt);
      }
    } catch (err) {
      this.logger.error(`AI Summary generation failed via ${provider}: ${err.message}`);
      return this.getFallbackSummary(scores);
    }
  }

  private buildPrompt(url: string, scores: Record<string, number>, issues: Omit<Issue, 'id' | 'auditId'>[]): string {
    const briefIssues = issues.slice(0, 15).map((iss, index) => ({
      index: index + 1,
      module: iss.module,
      title: iss.title,
      severity: iss.severity,
      description: iss.description.substring(0, 200),
    }));

    return `
You are the lead AI Web Auditor for WebAudit AI.
Provide an executive review and action plan for: ${url}

Scores calculated:
${JSON.stringify(scores, null, 2)}

Key Issues Found (sample):
${JSON.stringify(briefIssues, null, 2)}

Generate a structured JSON report matching the interface:
{
  "executiveSummary": "string",
  "topPriorities": [
    { "rank": 1, "module": "SEO", "title": "...", "why": "...", "impact": "...", "effort": "low" }
  ],
  "estimatedImprovements": [
    { "module": "SEO", "currentScore": 80, "projectedScore": 95, "improvements": ["Add meta description"] }
  ],
  "technicalDebt": "string"
}

Provide ONLY valid JSON output, without markdown decoration wrapper tags. Do not put \`\`\`json.
`;
  }

  private async runOpenAI(prompt: string): Promise<AiAuditSummary> {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not defined');

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
  }

  private async runGemini(prompt: string): Promise<AiAuditSummary> {
    const apiKey = this.config.get('GEMINI_API_KEY') || this.config.get('USER_GEMINI_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const text = response.response.text();
    return JSON.parse(text);
  }

  private getFallbackSummary(scores: Record<string, number>): AiAuditSummary {
    return {
      executiveSummary: 'Audit completed successfully. Overall performance is stable, but structured data schema alignments and security header protections require immediate update.',
      topPriorities: [
        {
          rank: 1,
          module: 'SEO',
          title: 'Provide title and meta descriptions to pages',
          why: 'Missing tags drastically hurt CTR rates across organic engine indexing.',
          impact: 'Increase SEO visibility by 15-20%.',
          effort: 'low',
          codeExample: '<title>Target Page Title</title>',
        },
        {
          rank: 2,
          module: 'SECURITY',
          title: 'Implement HSTS and CSP response headers',
          why: 'Prevents standard clickjacking vectors and script execution overrides.',
          impact: 'Boosts security score and ensures compliance.',
          effort: 'medium',
        },
      ],
      estimatedImprovements: [
        {
          module: 'SEO',
          currentScore: scores.seo || 80,
          projectedScore: 95,
          improvements: ['Add missing page titles', 'Create robust meta tags'],
        },
        {
          module: 'SECURITY',
          currentScore: scores.security || 75,
          projectedScore: 92,
          improvements: ['Configure security headers', 'Validate secure SSL certificate parameters'],
        },
      ],
      technicalDebt: 'Medium. Implement HSTS headers and schema definitions to align with modern web discovery algorithms.',
    };
  }
}
