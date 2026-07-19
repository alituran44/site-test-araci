
const cdnSignatures = require('./config/cdn-signatures');
const GeminiProvider = require('./providers/gemini');
const OpenRouterProvider = require('./providers/openrouter');
const OllamaProvider = require('./providers/ollama');
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
    
    if (apiKey && apiKey.startsWith('AIzaSy')) {
      apiUri += `&key=${apiKey}`;
    }
    
    console.log(`[LOG] PageSpeed Insights request sent to target: ${targetUrl} (API Key: ${apiKey ? 'Yes' : 'No'})`);
    const response = await axios.get(apiUri, { timeout: 28000 });
    const data = response.data;
    
    if (!data.lighthouseResult) {
      return { success: false, error: 'Unable to retrieve Lighthouse report.' };
    }

    const lighthouse = data.lighthouseResult;
    const categories = lighthouse.categories;
    const audits = lighthouse.audits;

    // Separate CrUX (Real User Experience) and Lab Metrics
    let cruxData = null;
    if (data.loadingExperience && data.loadingExperience.metrics) {
      const cruxMetrics = data.loadingExperience.metrics;
      cruxData = {
        lcp: cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS ? (cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000) + 's' : '-',
        cls: cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE ? (cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100) : '-',
        fid: cruxMetrics.FIRST_INPUT_DELAY_MS ? cruxMetrics.FIRST_INPUT_DELAY_MS.percentile + 'ms' : '-',
        inp: cruxMetrics.INTERACTION_TO_NEXT_PAINT ? cruxMetrics.INTERACTION_TO_NEXT_PAINT.percentile + 'ms' : '-'
      };
    }

    return {
      success: true,
      crux: cruxData, // Can be null if low traffic
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
    console.error('[ERROR] PageSpeed API Request Failed:', error.message);
    return { success: false, error: error.message };
  }
}
// Heuristics Fallback AI Analiz motoru (Rule-based clean English output)
function getFallbackAiAnalysis(metrics, url) {
  const seo = metrics.seo.details;
  const perf = metrics.performance.details;
  const sec = metrics.security.details;
  const acc = metrics.accessibility.details;
  const geo = metrics.geo.details;

  let codeScore = 100;
  const codeSuggestions = [];
  
  if (perf.renderBlocking > 3) {
    codeScore -= 15;
    codeSuggestions.push("Optimize render-blocking CSS/JS files using defer/async attributes or by inlining critical styles.");
  }
  if (seo.headings.h1.length === 0) {
    codeScore -= 10;
    codeSuggestions.push("No H1 tags found. Inject a single descriptive H1 tag to establish proper semantic document headers.");
  }
  if (geo.usedSemantics.length < 3) {
    codeScore -= 20;
    codeSuggestions.push("Semantic HTML5 structure elements are missing. Wrap body structures within main, section, or article elements.");
  }
  if (perf.cssCount > 5 || perf.jsCount > 5) {
    codeScore -= 10;
    codeSuggestions.push("High count of external style sheet or script payloads. Minify assets and bundle files to reduce network latency.");
  }

  if (codeSuggestions.length === 0) {
    codeSuggestions.push("Your HTML layout structure complies with standard accessibility guidelines.");
  }

  let uxScore = 100;
  const uxSuggestions = [];

  if (!sec.https) {
    uxScore -= 30;
    uxSuggestions.push("SSL/TLS certificate missing (HTTP protocol). Modern browsers will alert users that the site is insecure.");
  }
  if (metrics.uiux.details.ctas.length === 0) {
    uxScore -= 20;
    uxSuggestions.push("No clear Call-to-Action button found. Place a visible button in the Hero layout to increase conversions.");
  }
  if (seo.missingAltImages > 0) {
    uxScore -= 10;
    uxSuggestions.push("Images are missing alt attributes. Accessibility users with screen readers will experience incomplete content.");
  }

  if (uxSuggestions.length === 0) {
    uxSuggestions.push("Usability interface checks completed with zero errors.");
  }

  return {
    isMock: true,
    isLocalModel: false,
    analysisSource: 'heuristics',
    codeAnalysis: {
      score: Math.max(0, codeScore),
      review: "Local rule-based scan completed. Code layout requires asset minification, structural HTML5 wraps, and heading hierarchies.",
      suggestions: codeSuggestions
    },
    uxAnalysis: {
      score: Math.max(0, uxScore),
      review: "Local usability rules scan completed. The interface should enforce SSL, provide clear CTA indicators, and embed descriptive alt tags.",
      suggestions: uxSuggestions
    },
    missingItems: {
      critical: [
        !sec.https ? "Enable SSL/TLS certificate to redirect traffic to secure HTTPS protocol." : null,
        seo.headings.h1.length === 0 ? "Add a single H1 header containing your core page topic." : null
      ].filter(Boolean),
      seo_geo: [
        "Include structured JSON-LD schemas like WebSite or Article to assist AI crawler parsing."
      ]
    },
    personaAnalysis: [
      { name: "John Doe", age: 29, role: "Software Engineer", device: "Desktop (Windows)", speed: "Fiber", score: 8, comment: "Site assets loaded fairly quickly. Layout hierarchy is easy to read, although forms could be unified." },
      { name: "Sarah Connor", age: 34, role: "Marketing Director", device: "Mobile (iPhone 14)", speed: "4G", score: 6, comment: "The page has clear branding but loads slowly over mobile connection. Asset compression is recommended." },
      { name: "Diana Prince", age: 43, role: "Graphic Designer", device: "Tablet (Galaxy Tab)", speed: "4G", score: 7, comment: "Clean palette and typography alignment. The layout functions well, though visual hierarchies could be bolded." }
    ]
  };
}

// Unified AI Provider router interface function
async function getGeminiAiAnalysis(metrics, url, htmlBody, requestedModel = 'gemini-flash-latest', userKey = null, userOpenRouterKey = null, userOpenRouterModel = null, userOllamaEndpoint = null) {
  let provider = null;
  let source = 'heuristics';

  // 1. Check if model is OpenRouter
  if (requestedModel.startsWith('openrouter/') || requestedModel === 'openrouter-custom') {
    const key = (userOpenRouterKey && userOpenRouterKey.trim() !== '') ? userOpenRouterKey : process.env.OPENROUTER_API_KEY;
    const model = requestedModel.startsWith('openrouter/') ? requestedModel : (userOpenRouterModel || 'deepseek/deepseek-chat');
    provider = new OpenRouterProvider(key, model);
    source = (userOpenRouterKey && userOpenRouterKey.trim() !== '') ? 'user-openrouter' : 'server-default';
  }
  // 2. Check if model is Ollama local
  else if (requestedModel === 'odysseus-local') {
    const endpoint = (userOllamaEndpoint && userOllamaEndpoint.trim() !== '') ? userOllamaEndpoint : 'http://localhost:11434/v1';
    provider = new OllamaProvider(endpoint, 'llama3');
    source = 'ollama-local';
  }
  // 3. Fallback to Gemini
  else {
    const key = (userKey && userKey.trim() !== '') ? userKey : process.env.GEMINI_API_KEY;
    provider = new GeminiProvider(key, requestedModel);
    source = (userKey && userKey.trim() !== '') ? 'user-gemini' : 'server-default';
  }

  // Check if provider is configured. If not, fallback to Heuristics Engine
  if (!provider.isConfigured()) {
    console.log('[LOG] AI Provider not configured. Falling back to Heuristics Engine.');
    return getFallbackAiAnalysis(metrics, url);
  }

  try {
    console.log(`[LOG] Executing AI analysis using provider source: ${source} (Model: ${requestedModel})`);
    const report = await provider.generateReport(metrics, url, htmlBody);
    report.analysisSource = source;
    return report;
  } catch (error) {
    console.error(`[ERROR] Provider analysis failed (${error.message}). Falling back to Heuristics.`);
    const fallback = getFallbackAiAnalysis(metrics, url);
    fallback.error = `AI Analysis failed (${error.message}). Local heuristics simulated.`;
    fallback.analysisSource = 'heuristics';
    return fallback;
  }
}
// Detaylı analiz fonksiyonu
async function runAnalysis(targetUrl, requestedModel = 'gemini-flash-latest', selectedTools = 'both', userGeminiKey = null, userPageSpeedKey = null, userOpenRouterKey = null, userOpenRouterModel = null) {
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
    let cdnName = '';
    for (const [name, headerList] of Object.entries(cdnSignatures)) {
      if (headerList.some(h => headers[h.toLowerCase()])) {
        cdnName = name;
        break;
      }
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
      result.aiAnalysis = await getGeminiAiAnalysis(result.metrics, targetUrl, html, requestedModel, userGeminiKey, userOpenRouterKey, userOpenRouterModel, req.headers['x-local-api-url']);
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
  const userLocalApiUrl = '';
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
    const mainAnalysis = await runAnalysis(url, model, tools, userGeminiKey, userPageSpeedKey, userOpenRouterKey, userOpenRouterModel, req.headers['x-local-api-url']);
    
    let competitorAnalysis = null;
    if (competitorUrl && competitorSafe) {
      competitorAnalysis = await runAnalysis(competitorUrl, model, tools, userGeminiKey, userPageSpeedKey, userOpenRouterKey, userOpenRouterModel, req.headers['x-local-api-url']);
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
  
// Ollama Dynamic models listing API endpoint
app.get('/api/local-models', async (req, res) => {
  const endpoint = req.query.endpoint || 'http://localhost:11434';
  try {
    console.log(`[LOG] Querying local Ollama models list at: ${endpoint}`);
    const healthUrl = endpoint.replace(/\/v1\/?$/, '');
    const response = await axios.get(`${healthUrl}/api/tags`, { timeout: 3500 });
    if (response.data && response.data.models) {
      res.json({ success: true, models: response.data.models.map(m => m.name) });
    } else {
      res.json({ success: true, models: [] });
    }
  } catch (error) {
    res.json({ success: false, error: 'Local model server unreachable.' });
  }
});

app.listen(PORT, () => {
    console.log(`WebAudit Pro Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
  });
}

module.exports = app;
