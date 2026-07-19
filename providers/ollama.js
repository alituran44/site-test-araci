const axios = require('axios');
const cheerio = require('cheerio');

class OllamaProvider {
  constructor(endpointUrl = 'http://localhost:11434/v1', modelName = 'llama3') {
    this.endpointUrl = endpointUrl;
    this.modelName = modelName;
  }

  isConfigured() {
    return !!this.endpointUrl;
  }

  async testConnection() {
    // Attempt health-check against /api/tags (standard Ollama status endpoint)
    let baseUrl = this.endpointUrl;
    // Strip /v1 or /v1/ if present to reach base api endpoint
    baseUrl = baseUrl.replace(/\/v1\/?$/, '');
    
    try {
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 4000 });
      return response.status === 200;
    } catch (e) {
      return false;
    }
  }

  async generateReport(metrics, url, htmlBody) {
    const isOnline = await this.testConnection();
    if (!isOnline) {
      throw new Error(`Your local Ollama model server is unreachable. Please verify if Ollama is running at http://localhost:11434.`);
    }

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

    let targetEndpoint = this.endpointUrl;
    if (!targetEndpoint.endsWith('/chat/completions')) {
      if (targetEndpoint.endsWith('/v1') || targetEndpoint.endsWith('/v1/')) {
        targetEndpoint = targetEndpoint.replace(/\/$/, '') + '/chat/completions';
      } else {
        targetEndpoint = targetEndpoint.replace(/\/$/, '') + '/v1/chat/completions';
      }
    }

    const response = await axios.post(
      targetEndpoint,
      {
        model: this.modelName,
        messages: [
          { role: 'system', content: 'You are a senior web auditor assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 35000 // 35 second timeout for slower local setups
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      let text = response.data.choices[0].message.content.trim();
      if (text.startsWith('```json')) text = text.substring(7);
      if (text.endsWith('```')) text = text.substring(0, text.length - 3);
      text = text.trim();

      const parsed = JSON.parse(text);
      parsed.isMock = false;
      parsed.isLocalModel = true;
      return parsed;
    } else {
      throw new Error('Local model returned an empty or invalid completions output.');
    }
  }
}

module.exports = OllamaProvider;
