require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;
const { URL } = require('url');
const { GoogleGenerativeAI } = require('@google/generative-ai');
let puppeteer;
if (!process.env.VERCEL) {
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    console.warn("Puppeteer local yükleme hatası:", err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSRF Koruması: Local/Private IP'leri engelle
async function isSafeUrl(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    const hostname = parsedUrl.hostname;

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]'
    ) {
      return false;
    }

    const addresses = await dns.resolve(hostname).catch(() => []);
    
    for (const ip of addresses) {
      if (
        ip.startsWith('127.') ||
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('169.254.') ||
        (ip.startsWith('172.') && parseInt(ip.split('.')[1], 10) >= 16 && parseInt(ip.split('.')[1], 10) <= 31)
      ) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

// Google PageSpeed Insights API Çağrısı (Core Web Vitals ve Google Lighthouse Puanları için)
async function getPageSpeedMetrics(targetUrl, userKey = null) {
  try {
    const apiKey = (userKey && userKey.trim() !== '') ? userKey : (process.env.PAGESPEED_API_KEY || process.env.GEMINI_API_KEY || '');
    let apiUri = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&category=performance&category=accessibility&category=seo`;
    
    // Geçerli bir Google API anahtarı varsa ekle (Limitsiz / yüksek limitli istekler için)
    if (apiKey && apiKey.startsWith('AIzaSy')) {
      apiUri += `&key=${apiKey}`;
    }
    
    const response = await axios.get(apiUri, { timeout: 28000 });
    const data = response.data;
    
    if (!data.lighthouseResult) {
      return { success: false, error: 'Unable to retrieve Lighthouse report.' };
    }

    const lighthouse = data.lighthouseResult;
    const categories = lighthouse.categories;
    const audits = lighthouse.audits;

    return {
      success: true,
      scores: {
        performance: Math.round(categories.performance.score * 100),
        accessibility: Math.round(categories.accessibility.score * 100),
        seo: Math.round(categories.seo.score * 100)
      },
      vitals: {
        lcp: audits['largest-contentful-paint'] ? audits['largest-contentful-paint'].displayValue : '-',
        cls: audits['cumulative-layout-shift'] ? audits['cumulative-layout-shift'].displayValue : '-',
        tbt: audits['total-blocking-time'] ? audits['total-blocking-time'].displayValue : '-',
        speedIndex: audits['speed-index'] ? audits['speed-index'].displayValue : '-',
        fid: audits['max-potential-fid'] ? audits['max-potential-fid'].displayValue : '-'
      }
    };
  } catch (error) {
    console.error('PageSpeed API Hatası:', error.message);
    return { success: false, error: error.message };
  }
}

// Heuristics Fallback AI Analiz motoru (Gemini key yoksa veya hata verirse)
function getFallbackAiAnalysis(metrics, url) {
  const parsedUrl = new URL(url);
  const seo = metrics.seo.details;
  const perf = metrics.performance.details;
  const sec = metrics.security.details;
  const acc = metrics.accessibility.details;
  const geo = metrics.geo.details;

  let codeScore = 100;
  const codeSuggestions = [];
  
  if (perf.renderBlocking > 3) {
    codeScore -= 15;
    codeSuggestions.push("De-prioritize render-blocking CSS/JS files using defer/async or inline critical assets.");
  }
  if (seo.headings.h1.length === 0) {
    codeScore -= 10;
    codeSuggestions.push("No H1 tags found. Inject a single descriptive H1 tag for semantic search engine crawler indexing.");
  }
  if (geo.usedSemantics.length < 3) {
    codeScore -= 20;
    codeSuggestions.push("Semantic HTML5 structure elements are missing. Wrap your content inside main, section, and article elements.");
  }
  if (perf.cssCount > 5 || perf.jsCount > 5) {
    codeScore -= 10;
    codeSuggestions.push("Too many external stylesheet/script payloads. Minify assets and bundle files to reduce network latency.");
  }

  if (codeSuggestions.length === 0) {
    codeSuggestions.push("Your HTML layout structure complies with standard guidelines.");
  }

  let uxScore = 100;
  const uxSuggestions = [];

  if (!sec.https) {
    uxScore -= 30;
    uxSuggestions.push("SSL/TLS certificate missing (HTTP protocol). Modern browsers will alert users that the site is insecure.");
  }
  if (metrics.uiux.details.ctas.length === 0) {
    uxScore -= 20;
    uxSuggestions.push("A primary Call-To-Action (CTA) link could not be detected. Design a prominent button above the fold.");
  }
  if (acc.undocumentedInputs > 0) {
    uxScore -= 15;
    uxSuggestions.push("Accessibility issue: Form elements lack descriptive aria-labels or associated HTML labels.");
  }
  if (perf.loadTimeMs > 1500) {
    uxScore -= 15;
    uxSuggestions.push(`Overall load time is quite high (${perf.loadTimeMs} ms). Slow responses significantly increase bounce rates.`);
  }

  if (uxSuggestions.length === 0) {
    uxSuggestions.push("UX parameters are highly functional. Introduce micro-interactions to optimize conversion paths.");
  }

  const criticalMissing = [];
  const geoMissing = [];

  if (!sec.https) criticalMissing.push("SSL Certificate (HTTPS)");
  if (!metrics.technicalSeo.details.hasRobots) criticalMissing.push("Robots.txt Configuration File");
  if (!metrics.technicalSeo.details.hasSitemap) criticalMissing.push("XML Sitemap Configuration (sitemap.xml)");
  if (seo.missingAltImages > 0) criticalMissing.push(`${seo.missingAltImages} adet görselde 'alt' açıklaması eksik.`);

  if (geo.schemasTypes.length === 0) {
    geoMissing.push("Schema.org Metadata Integration (JSON-LD markup for search indexing)");
  }
  if (!geo.schemasTypes.includes('FAQPage')) {
    geoMissing.push("FAQPage Schema Markup (for instant chatbot/answer box extraction)");
  }
  if (geo.foundEeatKeywords.length < 2) {
    geoMissing.push("E-E-A-T signals (Missing author bio links, referencing sources, or about pages)");
  }

  return {
    isMock: true,
    codeAnalysis: {
      score: Math.max(20, codeScore),
      review: `Analyzing HTML quality parameters of ${parsedUrl.hostname} shows that ${seo.headings.h1.length === 0 ? 'header hierarchies lack a primary H1 node' : 'heading nodes conform correctly to outline guidelines'}. Structuring semantic layouts is ${geo.usedSemantics.length < 3 ? 'inadequate, lacking modern structure keywords' : 'well-designed utilizing semantic tags'}. Additionally, static stylesheet and script payloads are ${perf.cssCount + perf.jsCount > 10 ? 'somewhat bloated' : 'efficiently limited'}.`,
      suggestions: codeSuggestions
    },
    uxAnalysis: {
      score: Math.max(20, uxScore),
      review: `Examining the user interface shows that ${sec.https ? 'SSL certificate setup ensures secure navigation' : 'lack of SSL credentials exposes vulnerabilities to visitors'}. CTA links are ${metrics.uiux.details.ctas.length === 0 ? 'underrepresented, limiting potential conversion rates' : 'properly embedded above the fold'}. Page responsiveness speeds will ${perf.loadTimeMs > 1500 ? 'likely slow down visitor pathways' : 'actively improve browse speed retention'}.`,
      suggestions: uxSuggestions
    },
    missingItems: {
      critical: criticalMissing.length > 0 ? criticalMissing : ["No critical deficiencies detected."],
      seo_geo: geoMissing.length > 0 ? geoMissing : ["Core semantic elements for AI assistant indexing have been satisfied."]
    },
    personaAnalysis: [
      { name: "Arthur Dent", age: 28, role: "Software Developer", device: "Desktop (MacBook Pro)", speed: "Fiber", score: 8, comment: "Page loads extremely fast and features a clean layout. However, font sizes in code blocks feel a bit small on mobile screens." },
      { name: "Sarah Jenkins", age: 67, role: "Retired Teacher", device: "Tablet (iPad)", speed: "4G", score: 6, comment: "The text hierarchy is easy to read, but low color contrast on several action buttons made it tricky to navigate." },
      { name: "Leo Carter", age: 21, role: "College Student", device: "Mobile (iPhone 14)", speed: "3G (Limited)", score: 5, comment: "Images took a while to resolve on the mobile layout. The UI is modern, but could benefit from image optimization." },
      { name: "Chloe Vance", age: 34, role: "Digital Marketer", device: "Desktop (Windows)", speed: "Fiber", score: 7, comment: "Title tags and metadata are structured well, but the homepage lacks a prominent primary Call-To-Action (CTA)." },
      { name: "Marcus Aurelius", age: 45, role: "Financial Advisor", device: "Desktop (iMac)", speed: "Fiber", score: 9, comment: "SSL (HTTPS) implementation provides great trust. Clean layout allowed me to find information effortlessly." },
      { name: "Sophia Martinez", age: 19, role: "High School Student", device: "Mobile (Xiaomi Redmi)", speed: "4G", score: 8, comment: "A vibrant, modern UI layout. Interactive elements are smooth, but the footer links are clustered too closely." },
      { name: "Ryan Gosling", age: 39, role: "Project Manager", device: "Mobile (Samsung S23)", speed: "4G", score: 7, comment: "Overall UI looks highly professional. Speed is decent, but form input errors should be rendered more clearly." },
      { name: "Linda Smith", age: 52, role: "Homemaker", device: "Mobile (Samsung A54)", speed: "3G", score: 6, comment: "Had trouble locating the navigation drawer links on my screen. The spacing is clean, but hamburger menu icon should stand out." },
      { name: "Ethan Hunt", age: 31, role: "E-Commerce Consultant", device: "Desktop (Windows)", speed: "Fiber", score: 8, comment: "Solid load-time. Schema metadata markup is well-integrated, which will optimize search engine visibility." },
      { name: "Diana Prince", age: 43, role: "Graphic Designer", device: "Tablet (Galaxy Tab)", speed: "4G", score: 7, comment: "Clean palette and typography alignment. The asymmetrical grid functions well, though visual hierarchies could be bolded." }
    ]
  };
}

// Gemini API AI Analiz motoru
async function getGeminiAiAnalysis(metrics, url, htmlBody, requestedModel = 'gemini-flash-latest', userKey = null, userLocalApiUrl = null, userOpenRouterKey = null, userOpenRouterModel = null) {
  // Eğer OpenRouter seçildiyse OpenRouter API üzerinden analiz gerçekleştir
  if (requestedModel === 'openrouter-custom') {
    try {
      const $ = cheerio.load(htmlBody);
      $('script, style, noscript, iframe, svg, path, img').remove();
      
      const cleanHtmlSkeleton = $('body').html() 
        ? $('body').html().replace(/\s+/g, ' ').substring(0, 4500) 
        : 'Gövde içeriği okunamadı.';

      const prompt = `
        You are a senior UI/UX Designer and Code Quality Auditor ve Kıdemli Kod Kalitesi/Güvenlik Denetçisisin.
        Aşağıda belirtilen web sitesinin teknik metriklerini ve temizlenmiş HTML kod iskeletini incele:

        URL: ${url}
        
        Teknik Metrikler:
        - Yükleme Süresi: ${metrics.performance.details.loadTimeMs} ms
        - Dahili/Harici Linkler: ${metrics.seo.details.internalLinks}/${metrics.seo.details.externalLinks}
        - Kelime Sayısı: ${metrics.seo.details.wordCount}
        - Görseller / Eksik Alt etiketli: ${metrics.seo.details.totalImages} / ${metrics.seo.details.missingAltImages}
        - Başlıklar (H1-H6): ${JSON.stringify(metrics.seo.details.headings)}
        - Semantik HTML Etiketleri: ${JSON.stringify(metrics.geo.details.usedSemantics)}
        - Schema.org JSON-LD Tipleri: ${JSON.stringify(metrics.geo.details.schemasTypes)}
        - Aktif Güvenlik Başlıkları: ${JSON.stringify(metrics.security.details.activeHeaders)}
        - HTTPS SSL: ${metrics.security.details.https ? 'Evet' : 'Hayır'}
        - Form Sayısı: ${metrics.uiux.details.formsCount}
        
        Temizlenmiş HTML İskeleti (İlk 4500 karakter):
        """
        ${cleanHtmlSkeleton}
        """

        Görevlerin:
        1. Sitenin kod kalitesini (temizlik, semantik yapı, standartlar) incele. 0-100 arası bir skor ver.
        2. Kullanıcı deneyimini (UI/UX, dönüşüm yolları, erişilebilirlik, etkileşim kalitesi) incele. 0-100 arası bir skor ver.
        3. Sitenin kod ve UX alanındaki en kritik eksikliklerini ve GEO (Generative Engine Optimization) eksiklerini belirle.
        4. popjam.io tarzı, siteyi ziyaret eden 10 farklı simüle yapay zeka kullanıcısının (farklı yaş, meslek, cihaz, internet hızı ve hedeflere sahip) site hakkındaki gerçekçi yorumlarını ve memnuniyet skorlarını oluştur.

        Please provide the response ONLY in the following JSON format. Yanıtın başında veya sonunda "json" veya backtick gibi hiçbir açıklama metni olmasın, doğrudan geçerli bir JSON objesi döndür:
        {
          "codeAnalysis": {
            "score": [sayı],
            "review": "[Professional critique on codebase quality and structural patterns]",
            "suggestions": ["[Recommendation 1]", "[Recommendation 2]", "[Recommendation 3]"]
          },
          "uxAnalysis": {
            "score": [sayı],
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
              "age": [yaş],
              "role": "[Profession, e.g. Software Engineer or Graphic Designer]",
              "device": "[Device, e.g. Mobile (iPhone 14) or Desktop (Windows)]",
              "speed": "[Connection speed, e.g. 3G, 4G, Fiber]",
              "score": [Satisfaction score from 1-10],
              "comment": "[Candid, natural, realistic English user review about speed, UI layout, and clear flow]"
            }
          ]
        }
      `;

      const apiKey = (userOpenRouterKey && userOpenRouterKey.trim() !== '') ? userOpenRouterKey.trim() : process.env.OPENROUTER_API_KEY;
      const modelName = (userOpenRouterModel && userOpenRouterModel.trim() !== '') ? userOpenRouterModel.trim() : 'deepseek/deepseek-chat';
      
      if (!apiKey || apiKey.trim() === '') {
        throw new Error("OpenRouter API anahtarı tanımlanmamış. Sağ üstten Ayarlar kısmına ekleyin.");
      }

      const openRouterResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelName,
          messages: [
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://site-test-araci.vercel.app',
            'X-Title': 'WebPulse Audit Tool'
          },
          timeout: 25000
        }
      );

      let text = '';
      if (openRouterResponse.data && openRouterResponse.data.choices && openRouterResponse.data.choices[0]) {
        text = openRouterResponse.data.choices[0].message.content.trim();
      } else {
        throw new Error("OpenRouter'dan boş veya geçersiz yanıt döndü.");
      }

      if (text.startsWith('```json')) text = text.substring(7);
      if (text.endsWith('```')) text = text.substring(0, text.length - 3);
      text = text.trim();

      const parsedResponse = JSON.parse(text);
      parsedResponse.isMock = false;
      parsedResponse.isLocalModel = false;
      return parsedResponse;

    } catch (orError) {
      console.error('OpenRouter API Hatası:', orError.message);
      const fallback = getFallbackAiAnalysis(metrics, url);
      fallback.error = `OpenRouter Hatası (${orError.message}). Yerel simülasyon çalıştırıldı.`;
      return fallback;
    }
  }

  // Eğer lokal model seçildiyse yerel API üzerinden analiz gerçekleştir
  if (requestedModel === 'odysseus-local') {
    try {
      const $ = cheerio.load(htmlBody);
      $('script, style, noscript, iframe, svg, path, img').remove();
      
      const cleanHtmlSkeleton = $('body').html() 
        ? $('body').html().replace(/\s+/g, ' ').substring(0, 4500) 
        : 'Gövde içeriği okunamadı.';

      const prompt = `
        You are a senior UI/UX Designer and Code Quality Auditor ve Kıdemli Kod Kalitesi/Güvenlik Denetçisisin.
        Aşağıda belirtilen web sitesinin teknik metriklerini ve temizlenmiş HTML kod iskeletini incele:

        URL: ${url}
        
        Teknik Metrikler:
        - Yükleme Süresi: ${metrics.performance.details.loadTimeMs} ms
        - Dahili/Harici Linkler: ${metrics.seo.details.internalLinks}/${metrics.seo.details.externalLinks}
        - Kelime Sayısı: ${metrics.seo.details.wordCount}
        - Görseller / Eksik Alt etiketli: ${metrics.seo.details.totalImages} / ${metrics.seo.details.missingAltImages}
        - Başlıklar (H1-H6): ${JSON.stringify(metrics.seo.details.headings)}
        - Semantik HTML Etiketleri: ${JSON.stringify(metrics.geo.details.usedSemantics)}
        - Schema.org JSON-LD Tipleri: ${JSON.stringify(metrics.geo.details.schemasTypes)}
        - Aktif Güvenlik Başlıkları: ${JSON.stringify(metrics.security.details.activeHeaders)}
        - HTTPS SSL: ${metrics.security.details.https ? 'Evet' : 'Hayır'}
        - Form Sayısı: ${metrics.uiux.details.formsCount}
        
        Temizlenmiş HTML İskeleti (İlk 4500 karakter):
        """
        ${cleanHtmlSkeleton}
        """

        Görevlerin:
        1. Sitenin kod kalitesini (temizlik, semantik yapı, standartlar) incele. 0-100 arası bir skor ver.
        2. Kullanıcı deneyimini (UI/UX, dönüşüm yolları, erişilebilirlik, etkileşim kalitesi) incele. 0-100 arası bir skor ver.
        3. Sitenin kod ve UX alanındaki en kritik eksikliklerini ve GEO (Generative Engine Optimization) eksiklerini belirle.

        Please provide the response ONLY in the following JSON format. Yanıtın başında veya sonunda "json" veya backtick gibi hiçbir açıklama metni olmasın, doğrudan geçerli bir JSON objesi döndür:
        {
          "codeAnalysis": {
            "score": [sayı],
            "review": "[Professional critique on codebase quality and structural patterns]",
            "suggestions": ["[Recommendation 1]", "[Recommendation 2]", "[Recommendation 3]"]
          },
          "uxAnalysis": {
            "score": [sayı],
            "review": "[Professional critique on UI/UX optimization and navigation usability]",
            "suggestions": ["[Recommendation 1]", "[Recommendation 2]", "[Recommendation 3]"]
          },
          "missingItems": {
            "critical": ["[Critical deficiency 1]", "[Critical deficiency 2]"],
            "seo_geo": ["[2-3 action points to optimize for LLM crawlers and GEO schemas]"]
          }
        }
      `;

      let endpoint = userLocalApiUrl && userLocalApiUrl.trim() !== '' ? userLocalApiUrl.trim() : 'http://localhost:11434/v1';
      if (!endpoint.endsWith('/chat/completions')) {
        if (endpoint.endsWith('/v1') || endpoint.endsWith('/v1/')) {
          endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
        } else {
          endpoint = endpoint.replace(/\/$/, '') + '/v1/chat/completions';
        }
      }

      const localResponse = await axios.post(
        endpoint,
        {
          model: 'llama3', // Ollama / Odysseus default model
          messages: [
            { role: 'system', content: 'You are a senior web auditor assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000
        }
      );

      let text = '';
      if (localResponse.data && localResponse.data.choices && localResponse.data.choices[0]) {
        text = localResponse.data.choices[0].message.content.trim();
      } else {
        throw new Error("Yerel modelden boş veya geçersiz yanıt döndü.");
      }

      if (text.startsWith('```json')) text = text.substring(7);
      if (text.endsWith('```')) text = text.substring(0, text.length - 3);
      text = text.trim();

      const parsedResponse = JSON.parse(text);
      parsedResponse.isMock = false;
      parsedResponse.isLocalModel = true;
      return parsedResponse;

    } catch (localError) {
      console.error('Lokal Model API Hatası:', localError.message);
      const fallback = getFallbackAiAnalysis(metrics, url);
      fallback.error = `Lokal AI Modeli Hatası (${localError.message}). Yerel simülasyon çalıştırıldı.`;
      return fallback;
    }
  }

  const apiKey = (userKey && userKey.trim() !== '') ? userKey : process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return getFallbackAiAnalysis(metrics, url);
  }

  try {
    const $ = cheerio.load(htmlBody);
    $('script, style, noscript, iframe, svg, path, img').remove();
    
    const cleanHtmlSkeleton = $('body').html() 
      ? $('body').html().replace(/\s+/g, ' ').substring(0, 4500) 
      : 'Gövde içeriği okunamadı.';

    const prompt = `
      You are a senior UI/UX Designer and Code Quality Auditor ve Kıdemli Kod Kalitesi/Güvenlik Denetçisisin.
      Aşağıda belirtilen web sitesinin teknik metriklerini ve temizlenmiş HTML kod iskeletini incele:

      URL: ${url}
      
      Teknik Metrikler:
      - Yükleme Süresi: ${metrics.performance.details.loadTimeMs} ms
      - Dahili/Harici Linkler: ${metrics.seo.details.internalLinks}/${metrics.seo.details.externalLinks}
      - Kelime Sayısı: ${metrics.seo.details.wordCount}
      - Görseller / Eksik Alt etiketli: ${metrics.seo.details.totalImages} / ${metrics.seo.details.missingAltImages}
      - Başlıklar (H1-H6): ${JSON.stringify(metrics.seo.details.headings)}
      - Semantik HTML Etiketleri: ${JSON.stringify(metrics.geo.details.usedSemantics)}
      - Schema.org JSON-LD Tipleri: ${JSON.stringify(metrics.geo.details.schemasTypes)}
      - Aktif Güvenlik Başlıkları: ${JSON.stringify(metrics.security.details.activeHeaders)}
      - HTTPS SSL: ${metrics.security.details.https ? 'Evet' : 'Hayır'}
      - Form Sayısı: ${metrics.uiux.details.formsCount}
      
      Temizlenmiş HTML İskeleti (İlk 4500 karakter):
      """
      ${cleanHtmlSkeleton}
      """

      Görevlerin:
      1. Sitenin kod kalitesini (temizlik, semantik yapı, standartlar) incele. 0-100 arası bir skor ver.
      2. Kullanıcı deneyimini (UI/UX, dönüşüm yolları, erişilebilirlik, etkileşim kalitesi) incele. 0-100 arası bir skor ver.
      3. Sitenin kod ve UX alanındaki en kritik eksikliklerini ve GEO (Generative Engine Optimization - LLM'lerin siteyi doğru anlaması) eksiklerini belirle.
      4. popjam.io tarzı, siteyi ziyaret eden 10 farklı simüle yapay zeka kullanıcısının (farklı yaş, meslek, cihaz, internet hızı ve hedeflere sahip) site hakkındaki gerçekçi yorumlarını ve memnuniyet skorlarını oluştur.

      Please provide the response ONLY in the following JSON format. Yanıtın başında veya sonunda "json" veya backtick gibi hiçbir açıklama metni olmasın, doğrudan geçerli bir JSON objesi döndür:
      {
        "codeAnalysis": {
          "score": [sayı],
          "review": "[Professional critique on codebase quality and structural patterns]",
          "suggestions": ["[Recommendation 1]", "[Recommendation 2]", "[Recommendation 3]"]
        },
        "uxAnalysis": {
          "score": [sayı],
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
            "age": [yaş],
            "role": "[Profession, e.g. Software Engineer or Graphic Designer]",
            "device": "[Device, e.g. Mobile (iPhone 14) or Desktop (Windows)]",
            "speed": "[Connection speed, e.g. 3G, 4G, Fiber]",
            "score": [Satisfaction score from 1-10],
            "comment": "[Candid, natural, realistic English user review about speed, UI layout, and clear flow]"
          }
        ]
      }
    `;

    const apiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (!apiResponse.data || !apiResponse.data.candidates || !apiResponse.data.candidates[0]) {
      throw new Error("Gemini API'den geçersiz yanıt döndü.");
    }

    let text = apiResponse.data.candidates[0].content.parts[0].text.trim();
    
    if (text.startsWith('```json')) {
      text = text.substring(7);
    }
    if (text.endsWith('```')) {
      text = text.substring(0, text.length - 3);
    }
    text = text.trim();

    const parsedResponse = JSON.parse(text);
    parsedResponse.isMock = false;
    return parsedResponse;

  } catch (error) {
    console.error('Gemini API Hatası:', error);
    const fallback = getFallbackAiAnalysis(metrics, url);
    fallback.error = error.message;
    return fallback;
  }
}

// Detaylı analiz fonksiyonu
async function runAnalysis(targetUrl, requestedModel = 'gemini-flash-latest', selectedTools = 'both', userGeminiKey = null, userPageSpeedKey = null, userLocalApiUrl = null, userOpenRouterKey = null, userOpenRouterModel = null) {
  const result = {
    url: targetUrl,
    success: false,
    error: null,
    metrics: {
      seo: { score: 0, items: [], details: {} },
      performance: { score: 0, items: [], details: {} },
      security: { score: 0, items: [], details: {} },
      accessibility: { score: 0, items: [], details: {} },
      codeQuality: { score: 0, items: [], details: {} },
      geo: { score: 0, items: [], details: {} },
      technicalSeo: { score: 0, items: [], details: {} },
      uiux: { score: 0, items: [], details: {} }
    },
    aiAnalysis: null,
    pageSpeed: null
  };

  let browser;
  try {
    const startTime = Date.now();
    
    // PageSpeed API isteğini koşullu asenkron olarak başlat
    let pageSpeedPromise = Promise.resolve({ success: false, error: 'Analiz yöntemi seçilmedi.' });
    if (selectedTools === 'both' || selectedTools === 'pagespeed') {
      pageSpeedPromise = getPageSpeedMetrics(targetUrl, userPageSpeedKey);
    }

    let html;
    let status = 200;
    let headers = {};

    if (process.env.VERCEL) {
      // Vercel Serverless ortamında Puppeteer yerine Axios fallback çalıştır
      const pageRes = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebAuditBot/1.0'
        },
        timeout: 12000,
        validateStatus: () => true
      });
      html = pageRes.data;
      status = pageRes.status;
      headers = pageRes.headers;
    } else {
      // Yerel geliştirme ortamında Puppeteer ile tam sayfa simülasyonu yap
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebAuditBot/1.0');
      
      const pageResponse = await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 18000
      });

      status = pageResponse.status();
      headers = pageResponse.headers();
      html = await page.content();
      
      await browser.close();
      browser = null; // garbage collect
    }

    const loadTime = Date.now() - startTime;
    result.success = true;
    result.statusCode = status;
    result.headers = headers;

    if (status >= 400) {
      result.success = false;
      result.error = `Sunucu hata kodu döndürdü: ${status}`;
      return result;
    }

    if (typeof html !== 'string') {
      result.success = false;
      result.error = 'Sayfa içeriği HTML formatında değil.';
      return result;
    }

    const $ = cheerio.load(html);
    const parsedUrl = new URL(targetUrl);

    // --- ANALİZLER BAŞLASIN ---

    // 1. SEO ANALİZİ
    const seo = result.metrics.seo;
    const title = $('title').first().text().trim();
    const description = $('meta[name="description"]').first().attr('content') || '';
    const canonical = $('link[rel="canonical"]').first().attr('href') || '';
    
    const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
    for (let i = 1; i <= 6; i++) {
      $(`h${i}`).each((_, el) => {
        headings[`h${i}`].push($(el).text().trim());
      });
    }

    const og = {
      title: $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || ''
    };
    const twitter = {
      card: $('meta[name="twitter:card"]').attr('content') || '',
      title: $('meta[name="twitter:title"]').attr('content') || '',
      description: $('meta[name="twitter:description"]').attr('content') || ''
    };

    const schemas = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html());
        schemas.push(parsed);
      } catch (e) {}
    });

    let totalImages = 0;
    let missingAltImages = 0;
    $('img').each((_, el) => {
      totalImages++;
      const alt = $(el).attr('alt');
      if (alt === undefined || alt.trim() === '') {
        missingAltImages++;
      }
    });

    let internalLinks = 0;
    let externalLinks = 0;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href').trim();
      if (href.startsWith('#') || href.startsWith('javascript:')) return;
      try {
        const linkUrl = new URL(href, targetUrl);
        if (linkUrl.hostname === parsedUrl.hostname) {
          internalLinks++;
        } else {
          externalLinks++;
        }
      } catch (e) {
        internalLinks++;
      }
    });

    // Kelime analizi için script ve stilleri kaldırıp temiz metin al
    const cleanTextContainer = cheerio.load(html);
    cleanTextContainer('script, style, noscript, iframe, svg, path, link').remove();
    // Kırılmaz boşlukları ve gizli karakterleri normal boşlukla değiştir
    let pageText = cleanTextContainer('body').text();
    pageText = pageText.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Türkçe Stop-Words (Durdurma Kelimeleri) Kümesi
    const turkishStopWords = new Set([
      'bir', 'veya', 've', 'için', 'ile', 'gibi', 'daha', 'çok', 'olan', 'göre', 'bu', 'şu', 'o',
      'kadar', 'hem', 'her', 'ise', 'ama', 'fakat', 'ancak', 'lakin', 'yani', 'de', 'da', 'mi', 'mı',
      'mu', 'mü', 'ki', 'böyle', 'şöyle', 'bunu', 'buna', 'bunda', 'bunlar', 'şunu', 'şuna', 'şunda',
      'onu', 'ona', 'onda', 'olarak', 'tarafından', 'birkaç', 'biri', 'hepsi', 'herkes', 'kimse',
      'neden', 'nasıl', 'niçin', 'nedenle', 'böylece', 'yalnız', 'çünkü', 'yer', 'alan', 'derece', 'kendi'
    ]);

    const words = pageText
      .toLowerCase()
      .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !turkishStopWords.has(w));
      
    const wordCount = words.length;
    
    const wordFreq = {};
    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count, density: wordCount > 0 ? ((count / wordCount) * 100).toFixed(2) + '%' : '0%' }));

    let seoScore = 100;
    if (!title) { seoScore -= 20; seo.items.push({ status: 'error', text: 'Başlık (Title) etiketi eksik.' }); }
    else if (title.length < 30 || title.length > 60) {
      seoScore -= 10;
      seo.items.push({ status: 'warning', text: `Başlık uzunluğu standart dışı (${title.length} karakter). İdeal: 30-60 karakter.` });
    } else {
      seo.items.push({ status: 'success', text: `Başlık optimize edilmiş (${title.length} karakter).` });
    }

    if (!description) { seoScore -= 20; seo.items.push({ status: 'error', text: 'Meta Açıklaması (Description) eksik.' }); }
    else if (description.length < 110 || description.length > 160) {
      seoScore -= 10;
      seo.items.push({ status: 'warning', text: `Meta açıklaması uzunluğu standart dışı (${description.length} karakter). İdeal: 110-160 karakter.` });
    } else {
      seo.items.push({ status: 'success', text: 'Meta açıklaması optimize edilmiş.' });
    }

    if (!canonical) {
      seoScore -= 15;
      seo.items.push({ status: 'error', text: 'Canonical (özgün URL) etiketi eksik.' });
    } else {
      seo.items.push({ status: 'success', text: `Canonical etiketi tanımlı: ${canonical}` });
    }

    if (headings.h1.length === 0) {
      seoScore -= 15;
      seo.items.push({ status: 'error', text: 'H1 başlığı bulunamadı.' });
    } else if (headings.h1.length > 1) {
      seoScore -= 10;
      seo.items.push({ status: 'warning', text: `Birden fazla H1 başlığı bulundu (${headings.h1.length} adet). Her sayfada tek bir H1 olmalıdır.` });
    } else {
      seo.items.push({ status: 'success', text: 'Tek bir H1 başlığı başarıyla yapılandırılmış.' });
    }

    if (missingAltImages > 0 && totalImages > 0) {
      const missingAltPercent = ((missingAltImages / totalImages) * 100).toFixed(0);
      seoScore -= Math.min(15, missingAltImages * 3);
      seo.items.push({ status: 'warning', text: `Görsellerin %${missingAltPercent}'inde (${missingAltImages}/${totalImages}) alt etiketi eksik.` });
    } else if (totalImages > 0) {
      seo.items.push({ status: 'success', text: 'Tüm görsellerde alt etiketleri tanımlanmış.' });
    }

    if (og.title || twitter.title) {
      seo.items.push({ status: 'success', text: 'Sosyal medya etiketleri (Open Graph/Twitter Cards) tanımlı.' });
    } else {
      seoScore -= 5;
      seo.items.push({ status: 'warning', text: 'Sosyal medya entegrasyon etiketleri eksik.' });
    }

    seo.score = Math.max(0, seoScore);
    seo.details = { title, description, canonical, headings, og, twitter, schemasCount: schemas.length, totalImages, missingAltImages, internalLinks, externalLinks, topKeywords, wordCount };


    // 2. PERFORMANS ANALİZİ
    const perf = result.metrics.performance;
    let perfScore = 100;

    const encoding = headers['content-encoding'] || '';
    const hasCompression = encoding.includes('gzip') || encoding.includes('br') || encoding.includes('deflate');
    if (hasCompression) {
      perf.items.push({ status: 'success', text: `Veri sıkıştırma aktif (${encoding.toUpperCase()}).` });
    } else {
      perfScore -= 20;
      perf.items.push({ status: 'error', text: 'Sunucu düzeyinde veri sıkıştırma (Gzip/Brotli) aktif değil veya tespit edilemedi.' });
    }

    const externalCSS = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) externalCSS.push(href);
    });

    const externalJS = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) externalJS.push(src);
    });

    let renderBlocking = 0;
    $('link[rel="stylesheet"]').each((_, el) => {
      const media = $(el).attr('media');
      if (media !== 'print') renderBlocking++;
    });
    $('script[src]').each((_, el) => {
      const asyncAttr = $(el).attr('async');
      const deferAttr = $(el).attr('defer');
      if (asyncAttr === undefined && deferAttr === undefined) renderBlocking++;
    });

    if (renderBlocking > 3) {
      perfScore -= 15;
      perf.items.push({ status: 'warning', text: `${renderBlocking} adet render engelleyici (render-blocking) kaynak tespit edildi. async/defer kullanımı önerilir.` });
    } else {
      perf.items.push({ status: 'success', text: 'Render engelleyici kaynak sayısı optimize edilmiş düzeyde.' });
    }

    let lazyImages = 0;
    $('img').each((_, el) => {
      if ($(el).attr('loading') === 'lazy') lazyImages++;
    });
    if (totalImages > 3 && lazyImages === 0) {
      perfScore -= 10;
      perf.items.push({ status: 'warning', text: 'Sayfadaki görsellerde lazy loading (yavaş yükleme) kullanılmıyor.' });
    } else if (totalImages > 0) {
      perf.items.push({ status: 'success', text: `Görsellerde lazy loading kullanımı: ${lazyImages}/${totalImages}` });
    }

    const hasFontOptimization = html.includes('font-display:');
    if (!hasFontOptimization && html.includes('fonts.googleapis.com')) {
      perfScore -= 5;
      perf.items.push({ status: 'warning', text: 'Harici yazı tiplerinde font-display: swap ayarı eksik olabilir.' });
    }

    const serverHeader = headers['server'] || '';
    const cacheHeader = headers['x-cache'] || '';
    const viaHeader = headers['via'] || '';
    
    // Genişletilmiş Edge/CDN Tanımlama Başlıkları
    const xVercelId = headers['x-vercel-id'] || '';
    const xVercelCache = headers['x-vercel-cache'] || '';
    const xNfRequestId = headers['x-nf-request-id'] || '';
    const cfRay = headers['cf-ray'] || '';
    const xFastlyRequestId = headers['x-fastly-request-id'] || headers['x-served-by'] || '';
    const xAmzCfId = headers['x-amz-cf-id'] || '';
    const xAkamai = headers['x-akamai-transformed'] || '';
    
    let cdnName = '';
    
    if (serverHeader.toLowerCase().includes('cloudflare') || cfRay) {
      cdnName = 'Cloudflare';
    } else if (xVercelId || xVercelCache) {
      cdnName = 'Vercel Edge Network';
    } else if (xNfRequestId) {
      cdnName = 'Netlify Edge';
    } else if (viaHeader.toLowerCase().includes('cloudfront') || xAmzCfId || serverHeader.toLowerCase().includes('cloudfront')) {
      cdnName = 'Amazon CloudFront';
    } else if (cacheHeader.toLowerCase().includes('fastly') || xFastlyRequestId) {
      cdnName = 'Fastly';
    } else if (xAkamai || cacheHeader.toLowerCase().includes('akamai')) {
      cdnName = 'Akamai';
    } else if (serverHeader.toLowerCase().includes('litespeed')) {
      cdnName = 'LiteSpeed Web Server';
    } else if (viaHeader.toLowerCase().includes('varnish')) {
      cdnName = 'Varnish Cache';
    }

    if (cdnName) {
      perf.items.push({ status: 'success', text: `CDN / Gelişmiş Sunucu Altyapısı tespit edildi: ${cdnName}` });
    } else {
      perfScore -= 5;
      perf.items.push({ status: 'warning', text: 'Küresel bir CDN kullanımı tespit edilemedi.' });
    }

    perf.score = Math.max(0, perfScore);
    perf.details = { loadTimeMs: loadTime, compression: encoding || 'Yok', cssCount: externalCSS.length, jsCount: externalJS.length, renderBlocking, lazyImages, cdn: cdnName || 'Yok' };


    // 3. GÜVENLİK ANALİZİ
    const sec = result.metrics.security;
    let secScore = 100;

    const isHttps = parsedUrl.protocol === 'https:';
    if (isHttps) {
      sec.items.push({ status: 'success', text: 'Bağlantı güvenli (HTTPS aktif).' });
    } else {
      secScore -= 40;
      sec.items.push({ status: 'error', text: 'Bağlantı güvenli değil (HTTP kullanılıyor!). Güvenlik için acilen SSL kurulumu gereklidir.' });
    }

    const securityHeadersList = [
      { name: 'Content-Security-Policy', short: 'CSP', score: 15 },
      { name: 'Strict-Transport-Security', short: 'HSTS', score: 15 },
      { name: 'X-Frame-Options', short: 'X-Frame', score: 10 },
      { name: 'X-Content-Type-Options', short: 'X-Content', score: 10 },
      { name: 'Referrer-Policy', short: 'Referrer', score: 5 },
      { name: 'Permissions-Policy', short: 'Permissions', score: 5 }
    ];

    const missingHeaders = [];
    const activeHeaders = [];
    securityHeadersList.forEach(header => {
      const val = headers[header.name.toLowerCase()];
      if (val) {
        activeHeaders.push(header.short);
      } else {
        missingHeaders.push(header.name);
        secScore -= header.score;
      }
    });

    if (missingHeaders.length > 0) {
      sec.items.push({ status: 'warning', text: `Eksik güvenlik başlıkları (Headers): ${missingHeaders.join(', ')}` });
    } else {
      sec.items.push({ status: 'success', text: 'Tüm kritik HTTP güvenlik başlıkları tanımlanmış.' });
    }

    const setCookie = headers['set-cookie'];
    if (setCookie) {
      let insecureCookies = 0;
      const cookiesArray = Array.isArray(setCookie) ? setCookie : [setCookie];
      cookiesArray.forEach(cookie => {
        const lower = cookie.toLowerCase();
        if (!lower.includes('httponly') || !lower.includes('secure')) {
          insecureCookies++;
        }
      });
      if (insecureCookies > 0) {
        secScore -= 10;
        sec.items.push({ status: 'warning', text: `${insecureCookies} adet çerezde (cookie) Secure veya HttpOnly bayrağı eksik.` });
      } else {
        sec.items.push({ status: 'success', text: 'Sunucu çerezleri güvenli olarak yapılandırılmış.' });
      }
    }

    const corsHeader = headers['access-control-allow-origin'];
    if (corsHeader === '*') {
      sec.items.push({ status: 'warning', text: 'CORS politikası çok gevşek (Access-Control-Allow-Origin: *). Hassas API endpoints için risklidir.' });
    }

    sec.score = Math.max(0, secScore);
    sec.details = { https: isHttps, activeHeaders, missingHeaders, cookiesCount: setCookie ? (Array.isArray(setCookie) ? setCookie.length : 1) : 0, cors: corsHeader || 'Tanımlı Değil' };


    // 4. ERİŞİLEBİLİRLİK
    const acc = result.metrics.accessibility;
    let accScore = 100;

    const htmlLang = $('html').attr('lang');
    if (htmlLang) {
      acc.items.push({ status: 'success', text: `Sayfa dili tanımlanmış: "${htmlLang}"` });
    } else {
      accScore -= 15;
      acc.items.push({ status: 'error', text: 'HTML etiketinde "lang" özniteliği eksik.' });
    }

    let totalInputs = 0;
    let undocumentedInputs = 0;
    $('input, select, textarea').each((_, el) => {
      const type = $(el).attr('type');
      if (type === 'hidden' || type === 'submit' || type === 'button') return;
      totalInputs++;

      const id = $(el).attr('id');
      const ariaLabel = $(el).attr('aria-label');
      const ariaLabelledby = $(el).attr('aria-labelledby');

      let hasLabel = false;
      if (id) {
        if ($(`label[for="${id}"]`).length > 0) hasLabel = true;
      }
      if (ariaLabel || ariaLabelledby) hasLabel = true;

      if (!hasLabel) {
        undocumentedInputs++;
      }
    });

    if (undocumentedInputs > 0) {
      accScore -= Math.min(25, undocumentedInputs * 5);
      acc.items.push({ status: 'error', text: `Form elemanlarının ${undocumentedInputs}/${totalInputs} adedinde açıklayıcı etiket (label veya aria-label) bulunamadı.` });
    } else if (totalInputs > 0) {
      acc.items.push({ status: 'success', text: 'Tüm form elemanları erişilebilir etiketlere sahip.' });
    }

    let ariaElements = 0;
    $('[role], [aria-hidden], [aria-live], [aria-expanded]').each(() => {
      ariaElements++;
    });
    if (ariaElements > 0) {
      acc.items.push({ status: 'success', text: `Sayfada modern ARIA etiketleri kullanılmış (${ariaElements} adet).` });
    }

    acc.score = Math.max(0, accScore);
    acc.details = { lang: htmlLang || 'Eksik', totalInputs, undocumentedInputs, ariaElements };


    // 5. KOD KALİTESİ
    const code = result.metrics.codeQuality;
    let codeScore = 100;

    let inlineStylesCount = 0;
    $('[style]').each(() => { inlineStylesCount++; });
    if (inlineStylesCount > 10) {
      codeScore -= 10;
      code.items.push({ status: 'warning', text: `Aşırı miktarda satır içi (inline) CSS kullanımı mevcut (${inlineStylesCount} adet).` });
    } else {
      code.items.push({ status: 'success', text: 'Satır içi CSS kullanımı minimum düzeyde.' });
    }

    let inlineJsEvents = 0;
    $('*').each((_, el) => {
      const attribs = el.attribs || {};
      for (const attr in attribs) {
        if (attr.startsWith('on')) {
          inlineJsEvents++;
        }
      }
    });

    if (inlineJsEvents > 0) {
      codeScore -= 15;
      code.items.push({ status: 'warning', text: `${inlineJsEvents} adet satır içi (inline) JS olay yöneticisi (onclick, onmouseover vb.) tespit edildi.` });
    } else {
      code.items.push({ status: 'success', text: 'Modern event listener yapısı kullanılıyor, inline JS yok.' });
    }

    let headerSkip = false;
    let prevLevel = 0;
    for (let i = 1; i <= 6; i++) {
      if (headings[`h${i}`].length > 0) {
        if (prevLevel > 0 && i - prevLevel > 1) {
          headerSkip = true;
        }
        prevLevel = i;
      }
    }
    if (headerSkip) {
      codeScore -= 10;
      code.items.push({ status: 'warning', text: 'Başlık yapısında hiyerarşi atlaması tespit edildi (Örn: H1\'den doğrudan H3\'e geçiş).' });
    }

    code.score = Math.max(0, codeScore);
    code.details = { inlineStylesCount, inlineJsEvents, headerSkip };


    // 6. GEO
    const geo = result.metrics.geo;
    let geoScore = 100;

    const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
    const usedSemantics = [];
    semanticTags.forEach(tag => {
      if ($(tag).length > 0) {
        usedSemantics.push(tag);
      }
    });

    const semanticRatio = (usedSemantics.length / semanticTags.length) * 100;
    if (semanticRatio >= 70) {
      geo.items.push({ status: 'success', text: `Semantik HTML etiket kullanımı çok güçlü (%${semanticRatio.toFixed(0)}: ${usedSemantics.join(', ')}).` });
    } else if (semanticRatio >= 40) {
      geo.items.push({ status: 'warning', text: `Semantik HTML etiketleri kısmen kullanılmış (%${semanticRatio.toFixed(0)}). AI okumaları için artırılmalıdır.` });
      geoScore -= 10;
    } else {
      geo.items.push({ status: 'error', text: 'Semantik HTML etiketleri neredeyse hiç kullanılmamış. LLM taramaları zorlaşabilir.' });
      geoScore -= 20;
    }

    const hasSchema = schemas.length > 0;
    const hasFAQSchema = schemas.some(s => {
      const type = s['@type'] || '';
      return type === 'FAQPage' || (Array.isArray(type) && type.includes('FAQPage'));
    });

    if (hasSchema) {
      geo.items.push({ status: 'success', text: `Yapısal veri (Schema.org) bulundu (${schemas.length} adet). AI motorları için kritiktir.` });
    } else {
      geoScore -= 20;
      geo.items.push({ status: 'error', text: 'Schema.org yapısal verisi bulunamadı. AI Overviews (SGE) için dezavantajdır.' });
    }

    if (hasFAQSchema) {
      geo.items.push({ status: 'success', text: 'FAQ (SSS) yapısal verisi tanımlanmış. Doğrudan soru-cevap blokları için mükemmel.' });
    } else {
      geo.items.push({ status: 'warning', text: 'FAQ (Sıkça Sorulan Sorular) Schema bulunamadı.' });
    }

    const eeatKeywords = ['yazar', 'author', 'editör', 'editor', 'hakkımızda', 'about us', 'kaynak', 'source', 'referans', 'reference', 'künye', 'iletişim', 'contact'];
    const foundEeat = [];
    const textLower = pageText.toLowerCase();
    eeatKeywords.forEach(kw => {
      if (textLower.includes(kw)) {
        foundEeat.push(kw);
      }
    });

    if (foundEeat.length >= 3) {
      geo.items.push({ status: 'success', text: `E-E-A-T (Güvenilirlik ve Yetkinlik) sinyalleri algılandı: ${foundEeat.slice(0, 4).join(', ')}` });
    } else {
      geoScore -= 15;
      geo.items.push({ status: 'warning', text: 'Yazar profili veya kaynakça gibi E-E-A-T sinyalleri yetersiz görünüyor.' });
    }

    let totalParagraphs = 0;
    let longParagraphs = 0;
    $('p').each((_, el) => {
      totalParagraphs++;
      const text = $(el).text().trim();
      const pWordCount = text.split(' ').length;
      if (pWordCount > 60) {
        longParagraphs++;
      }
    });

    if (longParagraphs > 0 && totalParagraphs > 0) {
      const longRatio = ((longParagraphs / totalParagraphs) * 100).toFixed(0);
      if (longRatio > 30) {
        geoScore -= 10;
        geo.items.push({ status: 'warning', text: `Paragrafların %${longRatio}'u çok uzun (60+ kelime). LLM'ler ve kullanıcılar için daha kısa paragraflar önerilir.` });
      }
    }

    geo.score = Math.max(0, geoScore);
    geo.details = { usedSemantics, schemasTypes: schemas.map(s => s['@type'] || 'Bilinmeyen'), foundEeatKeywords: foundEeat, totalParagraphs, longParagraphs };


    // 7. TEKNİK SEO
    const tech = result.metrics.technicalSeo;
    let techScore = 100;

    let robotsContent = '';
    let hasRobots = false;
    let sitemapInRobots = '';
    try {
      const robotsRes = await axios.get(`${parsedUrl.origin}/robots.txt`, { timeout: 6000 });
      if (robotsRes.status === 200) {
        hasRobots = true;
        robotsContent = robotsRes.data;
        const match = robotsContent.match(/sitemap:\s*(https?:\/\/[^\s]+)/i);
        if (match) {
          sitemapInRobots = match[1];
        }
      }
    } catch (e) {}

    if (hasRobots) {
      tech.items.push({ status: 'success', text: 'robots.txt dosyası başarıyla doğrulandı.' });
    } else {
      techScore -= 20;
      tech.items.push({ status: 'error', text: 'robots.txt dosyası bulunamadı veya sunucu hata verdi.' });
    }

    let hasSitemap = false;
    const sitemapUrl = sitemapInRobots || `${parsedUrl.origin}/sitemap.xml`;
    try {
      const sitemapRes = await axios.get(sitemapUrl, { timeout: 6000 });
      if (sitemapRes.status === 200) {
        hasSitemap = true;
      }
    } catch (e) {}

    if (hasSitemap) {
      tech.items.push({ status: 'success', text: `XML Sitemap başarıyla bulundu: ${sitemapUrl}` });
    } else {
      techScore -= 20;
      tech.items.push({ status: 'error', text: 'Site haritası (sitemap.xml) tespit edilemedi.' });
    }

    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    const isNoIndex = robotsMeta.toLowerCase().includes('noindex') || (headers['x-robots-tag'] || '').toLowerCase().includes('noindex');
    
    if (isNoIndex) {
      techScore -= 30;
      tech.items.push({ status: 'warning', text: 'Sayfa arama motoru indekslemesine kapalı (noindex aktif!).' });
    } else {
      tech.items.push({ status: 'success', text: 'Sayfa arama motorları tarafından indekslenebilir durumda.' });
    }

    tech.score = Math.max(0, techScore);
    tech.details = { hasRobots, hasSitemap, sitemapUrl, isNoIndex, robotsMeta };


    // 8. UI/UX
    const uiux = result.metrics.uiux;
    let uiuxScore = 100;

    const ctaKeywords = ['satın al', 'üye ol', 'kaydol', 'başla', 'dene', 'indir', 'giriş', 'register', 'signup', 'buy', 'download', 'start', 'try', 'login', 'hemen', 'tıkla'];
    const foundCtas = [];
    $('a, button, input[type="submit"], input[type="button"]').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const value = $(el).attr('value') || '';
      const combined = (text + ' ' + value).trim();
      
      ctaKeywords.forEach(kw => {
        if (combined.includes(kw) && !foundCtas.includes(combined)) {
          foundCtas.push(combined);
        }
      });
    });

    if (foundCtas.length > 0) {
      uiux.items.push({ status: 'success', text: `Harekete geçirici mesaj (CTA) elemanları tespit edildi: ${foundCtas.slice(0, 3).join(', ')}` });
    } else {
      uiuxScore -= 20;
      uiux.items.push({ status: 'warning', text: 'Sayfada net ve görünür bir CTA (Harekete geçirici mesaj) butonu tespit edilemedi.' });
    }

    const navLinks = $('nav a, #menu a, .menu a').length;
    if (navLinks > 3) {
      uiux.items.push({ status: 'success', text: `Sayfada yapılandırılmış bir navigasyon menüsü mevcut (${navLinks} bağlantı).` });
    } else {
      uiuxScore -= 10;
      uiux.items.push({ status: 'warning', text: 'Navigasyon menüsü veya bağlantı sayısı yetersiz görünüyor.' });
    }

    const formsCount = $('form').length;
    if (formsCount > 0) {
      uiux.items.push({ status: 'success', text: `Kullanıcı etkileşimi için form yapıları mevcut (${formsCount} adet).` });
    }

    uiux.score = Math.max(0, uiuxScore);
    uiux.details = { ctas: foundCtas, navLinksCount: navLinks, formsCount };

    // --- GOOGLE PAGESPEED API ENTEGRASYONU (ASENKRON VERİ BİRLEŞTİRME) ---
    const pageSpeedResult = await pageSpeedPromise;
    if (pageSpeedResult.success) {
      result.pageSpeed = pageSpeedResult;
      
      // Google verilerini kendi metriklerimize entegre edelim
      result.metrics.performance.score = pageSpeedResult.scores.performance;
      result.metrics.accessibility.score = pageSpeedResult.scores.accessibility;
      result.metrics.seo.score = pageSpeedResult.scores.seo;

      // Google denetimlerini checklist'e ekleyelim
      result.metrics.performance.items.push({ status: 'success', text: `Google LCP: ${pageSpeedResult.vitals.lcp}` });
      result.metrics.performance.items.push({ status: 'success', text: `Google CLS: ${pageSpeedResult.vitals.cls}` });
      result.metrics.performance.items.push({ status: 'success', text: `Google TBT (Engelleme Süresi): ${pageSpeedResult.vitals.tbt}` });
    } else {
      // API hatası durumunda yerel analiz verilerinden türetilen Laboratuvar (Lab-based) fallback ölçümlerini ekle
      const localLcpVal = (result.metrics.performance.score > 80) ? '1.5 sn' : `${(result.metrics.performance.details.loadTimeMs / 1000).toFixed(1)} sn`;
      result.pageSpeed = {
        success: true,
        isFallback: true,
        error: pageSpeedResult.error || 'CrUX veritabanında bulunamadı',
        scores: {
          performance: result.metrics.performance.score || 60,
          accessibility: result.metrics.accessibility.score || 60,
          seo: result.metrics.seo.score || 60
        },
        vitals: {
          lcp: `${localLcpVal} (Yerel Laboratuvar Ölçümü)`,
          cls: '0.05 (Düşük Risk - Yerel Tahmin)',
          tbt: `${Math.round(result.metrics.performance.details.loadTimeMs * 0.15 || 150)} ms (Yerel Tahmin)`,
          speedIndex: `${(result.metrics.performance.details.loadTimeMs / 1000 || 1.8).toFixed(1)} sn`,
          fid: '45 ms (Makul)'
        }
      };
      result.metrics.performance.items.push({ status: 'warning', text: `Google CrUX verisi alınamadı (Düşük trafik nedeniyle olabilir). Yerel laboratuvar simülasyonu çalıştırıldı.` });
    }

    // --- AI DESTEKLİ ANALİZ TETİKLENSİN ---
    if (selectedTools === 'both' || selectedTools === 'gemini') {
      result.aiAnalysis = await getGeminiAiAnalysis(result.metrics, targetUrl, html, requestedModel, userGeminiKey, userLocalApiUrl, userOpenRouterKey, userOpenRouterModel);
    } else {
      result.aiAnalysis = null;
    }

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    result.success = false;
    result.error = `Tarayıcı analiz hatası veya zaman aşımı: ${error.message}`;
  }

  return result;
}

// REST API Endpoint: Analiz Başlat
app.get('/api/analyze', async (req, res) => {
  const { url, competitorUrl, model, tools } = req.query;
  const userGeminiKey = req.headers['x-gemini-key'];
  const userPageSpeedKey = req.headers['x-pagespeed-key'];
  const userLocalApiUrl = req.headers['x-local-api-url'];
  const userOpenRouterKey = req.headers['x-openrouter-key'];
  const userOpenRouterModel = req.headers['x-openrouter-model'];

  if (!url) {
    return res.status(400).json({ success: false, error: 'Lütfen analiz edilecek URL adresini belirtin.' });
  }

  const mainSafe = await isSafeUrl(url);
  if (!mainSafe) {
    return res.status(400).json({ success: false, error: 'Belirtilen ana URL güvenli değil veya geçersiz.' });
  }

  let competitorSafe = true;
  if (competitorUrl) {
    competitorSafe = await isSafeUrl(competitorUrl);
    if (!competitorSafe) {
      return res.status(400).json({ success: false, error: 'Belirtilen rakip URL güvenli değil veya geçersiz.' });
    }
  }

  try {
    const mainAnalysis = await runAnalysis(url, model, tools, userGeminiKey, userPageSpeedKey, userLocalApiUrl, userOpenRouterKey, userOpenRouterModel);
    
    let competitorAnalysis = null;
    if (competitorUrl && competitorSafe) {
      competitorAnalysis = await runAnalysis(competitorUrl, model, tools, userGeminiKey, userPageSpeedKey, userLocalApiUrl, userOpenRouterKey, userOpenRouterModel);
    }

    res.json({
      success: true,
      main: mainAnalysis,
      competitor: competitorAnalysis
    });
  } catch (error) {
    res.status(500).json({ success: false, error: `Analiz sırasında beklenmeyen bir hata oluştu: ${error.message}` });
  }
});

// REST API Endpoint: Responsive Proxy
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('URL parametresi eksik.');
  }

  const safe = await isSafeUrl(url);
  if (!safe) {
    return res.status(400).send('Güvenlik ihlali: Belirtilen URL proxy üzerinden yüklenemez.');
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1 WebAuditBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000,
      maxRedirects: 3
    });

    let html = response.data;
    if (typeof html !== 'string') {
      return res.status(400).send('Proxy sadece HTML içeriklerini destekler.');
    }

    const $ = cheerio.load(html);
    const baseHref = `<base href="${url}">`;
    $('head').prepend(baseHref);

    $('a').each((_, el) => {
      const target = $(el).attr('target');
      if (target === '_blank') {
        $(el).attr('target', '_self');
      }
    });

    res.send($.html());
  } catch (error) {
    res.status(500).send(`Proxy Hatası: ${error.message}`);
  }
});

// Sunucuyu Başlat
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`WebAudit Pro Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
  });
}

module.exports = app;
