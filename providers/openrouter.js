const axios = require('axios');
const cheerio = require('cheerio');

class OpenRouterProvider {
  constructor(apiKey, modelName = 'deepseek/deepseek-chat') {
    this.apiKey = apiKey;
    // Strip "openrouter/" prefix if present
    this.modelName = modelName.startsWith('openrouter/') ? modelName.substring(11) : modelName;
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.trim() !== '');
  }

  async generateReport(metrics, url, htmlBody) {
    const $ = cheerio.load(htmlBody);
    $('script, style, noscript, iframe, svg, path, img').remove();
    
    const cleanHtmlSkeleton = $('body').html() 
      ? $('body').html().replace(/\s+/g, ' ').substring(0, 4500) 
      : 'No readable body content.';

    const prompt = `
      You are a senior UI/UX Designer and Code Quality Auditor.
      Analyze the technical metrics and the HTML code structure of the following website:

      URL: ${url}
      
      Technical Metrics:
      - Load Time: ${metrics.performance.details.loadTimeMs} ms
      - Internal/External Links: ${metrics.seo.details.internalLinks}/${metrics.seo.details.externalLinks}
      - Word Count: ${metrics.seo.details.wordCount}
      - Images / Missing Alt Attributes: ${metrics.seo.details.totalImages} / ${metrics.seo.details.missingAltImages}
      - Headings (H1-H6): ${JSON.stringify(metrics.seo.details.headings)}
      - Semantic HTML Tags: ${JSON.stringify(metrics.geo.details.usedSemantics)}
      - Schema.org JSON-LD Types: ${JSON.stringify(metrics.geo.details.schemasTypes)}
      - Active Security Headers: ${JSON.stringify(metrics.security.details.activeHeaders)}
      - HTTPS SSL: ${metrics.security.details.https ? 'Yes' : 'No'}
      - Form Count: ${metrics.uiux.details.formsCount}
      
      Cleaned HTML Skeleton (First 4500 characters):
      """
      ${cleanHtmlSkeleton}
      """

      Tasks:
      1. Critique the codebase quality (cleanliness, semantic tags, standards). Score it 0-100.
      2. Critique the user experience (UI/UX, conversion paths, accessibility, interaction quality). Score it 0-100.
      3. Identify the most critical deficiencies in the code and UX, and GEO (Generative Engine Optimization) schemas.
      4. Simulate 10 realistic visitor profiles visiting the site (varying age, role, device, connection speed, satisfaction score 1-10, and a candid comment about speed/UI layout).

      Please provide the response ONLY in the following JSON format. Do not prepend or append "json" or markdown backticks, return a valid JSON object directly:
      {
        "codeAnalysis": {
          "score": [number],
          "review": "[Professional critique on codebase quality and structural patterns]",
          "suggestions": ["[Recommendation 1]", "[Recommendation 2]", "[Recommendation 3]"]
        },
        "uxAnalysis": {
          "score": [number],
          "review": "[Professional critique on UI/UX optimization and navigation usability]",
          "suggestions": ["[Recommendation 1]", "[Recommendation 2]", "[Recommendation 3]"]
        },
        "missingItems": {
          "critical": ["[Critical deficiency 1]", "[Critical deficiency 2]"],
          "seo_geo": ["[2-3 action points to optimize for LLM crawlers and GEO schemas]"]
        },
        "personaAnalysis": [
          {
            "name": "[User name, e.g. John Doe]",
            "age": [number],
            "role": "[Profession, e.g. Software Engineer]",
            "device": "[Device, e.g. Mobile (iPhone 14)]",
            "speed": "[Connection speed, e.g. 3G, 4G, Fiber]",
            "score": [Satisfaction score from 1-10],
            "comment": "[Candid, natural, realistic English user review about speed, UI layout, and clear flow]"
          }
        ]
      }
    `;

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: this.modelName,
          messages: [
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://site-test-araci.vercel.app',
            'X-Title': 'WebPulse Audit Tool'
          },
          timeout: 28000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        let text = response.data.choices[0].message.content.trim();
        if (text.startsWith('```json')) text = text.substring(7);
        if (text.endsWith('```')) text = text.substring(0, text.length - 3);
        text = text.trim();

        const parsed = JSON.parse(text);
        parsed.isMock = false;
        parsed.isLocalModel = false;
        return parsed;
      } else {
        throw new Error('OpenRouter API returned an empty or invalid completion choice.');
      }
    } catch (error) {
      // Map API limit / unauthorized statuses to understandable English messages
      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          throw new Error('OpenRouter API authorization failed. Please check your API key in Settings.');
        } else if (status === 429) {
          throw new Error('OpenRouter rate limit or quota exceeded. Please try again later.');
        }
      }
      throw error;
    }
  }
}

module.exports = OpenRouterProvider;
