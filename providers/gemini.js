const axios = require('axios');
const cheerio = require('cheerio');

class GeminiProvider {
  constructor(apiKey, modelName = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
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

    // Map internal models to actual Gemini endpoints
    let actualGeminiModel = 'gemini-1.5-flash';
    if (this.modelName === 'gemini-1.5-pro') {
      actualGeminiModel = 'gemini-1.5-pro';
    } else if (this.modelName === 'gemini-2.0-flash') {
      actualGeminiModel = 'gemini-2.0-flash-exp';
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualGeminiModel}:generateContent?key=${this.apiKey}`;
    
    const response = await axios.post(
      geminiUrl,
      {
        contents: [
          { parts: [{ text: prompt }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      }
    );

    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates[0] &&
      response.data.candidates[0].content &&
      response.data.candidates[0].content.parts &&
      response.data.candidates[0].content.parts[0]
    ) {
      let text = response.data.candidates[0].content.parts[0].text.trim();
      if (text.startsWith('```json')) text = text.substring(7);
      if (text.endsWith('```')) text = text.substring(0, text.length - 3);
      text = text.trim();

      const parsed = JSON.parse(text);
      parsed.isMock = false;
      parsed.isLocalModel = false;
      return parsed;
    } else {
      throw new Error('Gemini API returned an invalid response structure.');
    }
  }
}

module.exports = GeminiProvider;
