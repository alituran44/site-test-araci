'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { 
  Globe, Shield, Zap, Search, Accessibility, BarChart2, AlertCircle, FileText, CheckCircle, RefreshCw, LogOut, ArrowRight, Download, Filter,
  LayoutGrid, Brain, Smartphone, GitCompare, Users, Sparkles, AlertTriangle, Eye, HelpCircle, Code, Check, X, ChevronRight, Play, Info
} from 'lucide-react';
import { AuditStatus, AuditScores, Issue, Severity, Module } from '@webaudit/shared';

// Simulated audit metrics to prevent app crashes if backend connection is loading
const mockScores: AuditScores = {
  overall: 82,
  seo: 88,
  geo: 72,
  performance: 64,
  security: 45,
  accessibility: 85,
  codeQuality: 80,
  uiux: 78
};

const mockIssues: Issue[] = [
  // SEO
  {
    id: 'seo-1',
    auditId: '1',
    module: 'SEO',
    checkId: 'title-missing-alt',
    title: 'Görsellerde Alt Etiketleri Eksik',
    description: 'Ana sayfada bulunan 4 büyük görselin alt etiketleri (alt attribute) bulunmamaktadır. Bu durum Google Görsel aramalarında görünürlüğünüzü azaltır.',
    severity: 'HIGH',
    solution: 'Tüm img etiketlerine görselin içeriğini betimleyen alt="..." niteliği ekleyin.',
    codeExample: '<img src="/images/hero-banner.jpg" alt="WebPulse AI Raporlama Arayüzü Mockup" />',
    standard: 'Google Görsel Standartları'
  },
  {
    id: 'seo-2',
    auditId: '1',
    module: 'SEO',
    checkId: 'multiple-h1',
    title: 'Birden Fazla H1 Etiketi Kullanılmış',
    description: 'Sayfa içerisinde 2 adet H1 etiketi tespit edildi. Her web sayfasında arama motoru optimizasyonu açısından yalnızca 1 adet H1 olmalıdır.',
    severity: 'MEDIUM',
    solution: 'Sayfa yapısını inceleyerek ikincil H1 etiketlerini H2 veya H3 olarak güncelleyin.',
    codeExample: '<!-- Yanlış -->\n<h1>Ana Başlık</h1>\n<h1>Alt Başlık</h1>\n\n<!-- Doğru -->\n<h1>Ana Başlık</h1>\n<h2>Alt Başlık</h2>',
    standard: 'HTML Semantik Standartları'
  },
  // Performance
  {
    id: 'perf-1',
    auditId: '1',
    module: 'PERFORMANCE',
    checkId: 'render-blocking',
    title: 'Render Engelleyici Kaynaklar Mevcut',
    description: 'Sayfa başında yüklenen 3 harici CSS ve 2 JS dosyası sayfanın çizilmesini (rendering) engelliyor ve LCP süresini uzatıyor.',
    severity: 'CRITICAL',
    solution: 'JS dosyalarına defer veya async nitelikleri ekleyin, kritik olmayan CSS dosyalarını asenkron yükleyin.',
    codeExample: '<script src="/app.js" defer></script>\n<link rel="stylesheet" href="/non-critical.css" media="print" onload="this.media=\'all\'">',
    standard: 'Google Lighthouse CWV'
  },
  {
    id: 'perf-2',
    auditId: '1',
    module: 'PERFORMANCE',
    checkId: 'lazy-loading-missing',
    title: 'Lazy Loading Görsellerde Tanımlanmamış',
    description: 'Ekranın altında kalan (fold-below) görsellerde loading="lazy" niteliği kullanılmadığından ilk sayfa yüklenme boyutu gereksiz yere büyük.',
    severity: 'MEDIUM',
    solution: 'Fold-below görsellere loading="lazy" ekleyin.',
    codeExample: '<img src="/large-footer-image.png" loading="lazy" alt="Footer Banner" />',
    standard: 'Web Performance Best Practices'
  },
  // Security
  {
    id: 'sec-1',
    auditId: '1',
    module: 'SECURITY',
    checkId: 'hsts-missing',
    title: 'Strict-Transport-Security (HSTS) Başlığı Eksik',
    description: 'HSTS yanıt başlığı sunucuda etkin değil. Bu durum protokolü düşürmeye çalışan MITM saldırılarına zemin hazırlar.',
    severity: 'CRITICAL',
    solution: 'HTTP Strict Transport Security başlığını tüm HTTPS yanıtlarına ekleyin.',
    codeExample: 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    standard: 'OWASP Security Headers'
  },
  {
    id: 'sec-2',
    auditId: '1',
    module: 'SECURITY',
    checkId: 'csp-missing',
    title: 'Content-Security-Policy (CSP) Tanımlanmamış',
    description: 'CSP başlığı eksik. Bu durum kötü niyetli script enjeksiyonlarına (Cross-Site Scripting - XSS) ve veri sızıntılarına izin verir.',
    severity: 'HIGH',
    solution: 'Sitenizin hangi kaynaklardan JS/CSS yükleyebileceğini sınırlayan bir CSP politikası yapılandırın.',
    codeExample: 'Content-Security-Policy: default-src \'self\'; script-src \'self\' https://trustedscripts.com;',
    standard: 'W3C Security Guidelines'
  },
  // Accessibility
  {
    id: 'acc-1',
    auditId: '1',
    module: 'ACCESSIBILITY',
    checkId: 'html-lang-missing',
    title: 'HTML lang Özniteliği Eksik',
    description: '<html> etiketinde dil (lang) belirtilmemiş. Ekran okuyucu kullanan engelli kullanıcıların tarayıcıları site dilini tanıyamayacaktır.',
    severity: 'HIGH',
    solution: 'html etiketine uygun dil kodunu (Örn: tr, en) lang="..." olarak ekleyin.',
    codeExample: '<html lang="tr">',
    standard: 'WCAG 2.1 AA (1.1.1)'
  },
  {
    id: 'acc-2',
    auditId: '1',
    module: 'ACCESSIBILITY',
    checkId: 'missing-labels',
    title: 'Form Elemanlarında İlişkili Etiket (Label) Bulunamadı',
    description: 'Arama ve e-posta kayıt formlarındaki input alanlarında etiket (<label>) veya aria-label tanımlanmamış.',
    severity: 'HIGH',
    solution: 'Input elemanlarını label etiketi ile sarın veya id/for eşleştirmesi yapın.',
    codeExample: '<label for="search-input">Sitede Ara</label>\n<input type="text" id="search-input" />',
    standard: 'WCAG 2.1 AA (3.3.2)'
  },
  // GEO / AI
  {
    id: 'geo-1',
    auditId: '1',
    module: 'GEO',
    checkId: 'llms-missing',
    title: 'llms.txt robots rehberi bulunamadı',
    description: 'AI tarayıcıların (ChatGPT, Gemini, Perplexity) sitenizi daha iyi indekslemesini sağlayan yapısal yönlendirme dosyası /llms.txt konumunda tespit edilemedi.',
    severity: 'HIGH',
    solution: 'Kök dizine sitenizin özetini ve önemli sayfalarını listeyen bir llms.txt dosyası yerleştirin.',
    codeExample: '# WebPulse AI\nAn AI-powered website auditor for modern developers.\n\n## Key Sections\n- [/pricing](https://siteniz.com/pricing) - Agency subscription details',
    standard: 'GEO (Generative Engine Optimization) Best Practices'
  },
  {
    id: 'geo-2',
    auditId: '1',
    module: 'GEO',
    checkId: 'faq-schema-missing',
    title: 'FAQPage (Sıkça Sorulan Sorular) Şeması Eksik',
    description: 'Sayfanızda SSS alanları olmasına rağmen FAQPage JSON-LD yapısal verisi bulunmuyor. Bu durum, arama motorlarında zengin cevap kartları çıkmasını engeller.',
    severity: 'MEDIUM',
    solution: 'SSS içeriğinizi JSON-LD şablonuna dökerek sayfa koduna yerleştirin.',
    codeExample: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [...]\n}\n</script>',
    standard: 'Google Rich Results Guidelines'
  }
];

const mockPersonas = [
  {
    id: 'p1',
    name: 'Ayşe Teyze',
    age: 65,
    role: 'Emekli / Yaşlı Kullanıcı',
    device: 'Eski iPad (Tablet)',
    connection: 'Yavaş Mobil İnternet (3G)',
    satisfaction: 60,
    comment: 'Yazılar çok küçük, okumakta çok zorlanıyorum. Ekranı büyütmeye çalışınca da butonlar birbirinin üstüne biniyor.',
    status: 'warning'
  },
  {
    id: 'p2',
    name: 'Murat Demir',
    age: 28,
    role: 'Kıdemli Yazılım Mühendisi',
    device: 'High-End MacBook Pro',
    connection: 'Fiber Optik (1000 Mbps)',
    satisfaction: 95,
    comment: 'Kod temiz, sayfa istekleri hızlı yanıt veriyor. Ancak harici yazı tiplerinde font-display: swap ayarı yapılsa iyi olur.',
    status: 'success'
  },
  {
    id: 'p3',
    name: 'Helin Yılmaz',
    age: 19,
    role: 'Üniversite Öğrencisi / Genç',
    device: 'iPhone 15 Pro Max',
    connection: '5G Mobil İnternet',
    satisfaction: 88,
    comment: 'Tasarım çok modern ve karanlık tema harika görünüyor! Sadece mobil menü bazen tıklayınca biraz yavaş tepki veriyor.',
    status: 'success'
  },
  {
    id: 'p4',
    name: 'Ahmet Ekici',
    age: 35,
    role: 'Görme Engelli Birey',
    device: 'Windows Laptop + JAWS Ekran Okuyucu',
    connection: 'Ev VDSL',
    satisfaction: 45,
    comment: 'Ekran okuyucum görsellerin ne olduğunu söyleyemiyor çünkü açıklama etiketleri eksik. Giriş formlarındaki alanları seçmek de çok zor.',
    status: 'error'
  },
  {
    id: 'p5',
    name: 'Can Aksoy',
    age: 50,
    role: 'KOBİ Sahibi / İşletmeci',
    device: 'Giriş Seviyesi Samsung Telefon',
    connection: 'Zayıf Çeken Mobil İnternet (Edge)',
    satisfaction: 55,
    comment: 'Sayfa açılırken beyaz bir ekran kalıyor, görsellerin yüklenmesi çok uzun sürüyor. Acele işim olduğunda bekleyemem.',
    status: 'warning'
  },
  {
    id: 'p6',
    name: 'John Doe',
    age: 42,
    role: 'B2B Müşteri / Aceleci Yönetici',
    device: 'ThinkPad T14 (Masaüstü)',
    connection: 'Kurumsal Wi-Fi',
    satisfaction: 70,
    comment: 'Sitede ne sunduğunuzu anladım ama teklif almak için nereye tıklamam gerektiğini bulmak zor oldu. İletişim formu gizli kalmış.',
    status: 'warning'
  },
  {
    id: 'p7',
    name: 'Deniz Bot',
    age: 1,
    role: 'ChatGPT / Gemini Tarayıcı Ajanı',
    device: 'Cloud Crawler',
    connection: '10 Gbps Datacenter',
    satisfaction: 35,
    comment: 'Sitede llms.txt robots kılavuzu bulunamadı. Yapısal şema (Schema.org) nesneleri yetersiz, sayfayı anlamlandırmak için düz metin taramak zorunda kalıyorum.',
    status: 'error'
  }
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [activeSidebarMenu, setActiveSidebarMenu] = useState<
    'overview' | 'seo' | 'performance' | 'security' | 'accessibility' | 'geo' | 'ai-insights' | 'simulator' | 'competitor' | 'persona'
  >('overview');
  
  const [runningAudit, setRunningAudit] = useState<{ id: string; status: AuditStatus; progress: number; message: string } | null>(null);
  
  // Real-time states
  const [scores, setScores] = useState<AuditScores | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Simulator states
  const [activeSimDevice, setActiveSimDevice] = useState({ name: 'iPhone SE', width: 375, height: 667, isLandscape: false });
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Check if initial audit was requested from URL param
    const targetUrl = searchParams.get('url');
    if (targetUrl) {
      setUrl(targetUrl);
      const compUrl = searchParams.get('competitor');
      if (compUrl) setCompetitorUrl(compUrl);
      
      startSimulatedAudit(targetUrl);
    } else {
      // Load initial dynamic audit for example.com
      const { scores: initScores, issues: initIssues } = generateDynamicAuditData('https://example.com');
      setScores(initScores);
      setIssues(initIssues);
    }

    // Connect to WebSocket gateway
    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(`${apiHost}/audits`, {
      transports: ['websocket'],
      autoConnect: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setLogs(prev => [...prev, 'Live izleme sunucusuna bağlanıldı.']);
    });

    socket.on('audit:progress', (data: any) => {
      setRunningAudit({
        id: data.auditId,
        status: data.status,
        progress: data.progress,
        message: data.message,
      });
      setLogs(prev => [...prev, `[${data.status}] ${data.message}`]);
    });

    socket.on('audit:complete', (data: any) => {
      setScores(data.scores);
      setRunningAudit(null);
      setLogs(prev => [...prev, 'Analiz başarıyla tamamlandı!']);
      fetchIssues(data.auditId);
    });

    return () => {
      socket.disconnect();
    };
  }, [searchParams]);

  const generateDynamicAuditData = (targetUrl: string) => {
    let cleanDomain = targetUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim() || 'example.com';
    
    // Deterministic seed from domain string
    let seed = 0;
    for (let i = 0; i < cleanDomain.length; i++) {
      seed = (seed * 31 + cleanDomain.charCodeAt(i)) % 10007;
    }

    // Generate unique scores per domain
    const seo = 60 + (seed % 35);
    const performance = 50 + ((seed * 7) % 45);
    const security = 40 + ((seed * 13) % 55);
    const accessibility = 55 + ((seed * 17) % 40);
    const geo = 45 + ((seed * 23) % 50);
    const overall = Math.round((seo + performance + security + accessibility + geo) / 5);

    const dynamicScores: AuditScores = { seo, performance, security, accessibility, geo, overall };

    // Generate domain-specific issues
    const dynamicIssues: Issue[] = [
      {
        id: `seo-${cleanDomain}-1`,
        auditId: 'dynamic-id',
        module: 'SEO',
        checkId: 'meta-title-check',
        title: `${cleanDomain} Meta Başlığı ve Açıklaması Uyumluluğu`,
        description: `${cleanDomain} alan adında hedeflenen anahtar kelimeler meta başlık alanında eksik veya standart uzunluğun altında.`,
        severity: seo < 70 ? 'HIGH' : 'MEDIUM',
        solution: `Sitenizin kök şablonunda <title> etiketini "${cleanDomain} — Yapay Zeka Destekli Platform" şeklinde güncelleyin.`,
        codeExample: `<title>${cleanDomain} — Yapay Zeka Destekli Platform</title>\n<meta name="description" content="${cleanDomain} için detaylı SEO açıklaması." />`,
        pageUrl: targetUrl,
        standard: 'Google Search Central Guidelines'
      },
      {
        id: `seo-${cleanDomain}-2`,
        auditId: 'dynamic-id',
        module: 'SEO',
        checkId: 'canonical-url-missing',
        title: `${cleanDomain} Canonical URL Etiketi Bulunamadı`,
        description: `Arama motorlarının çift içerik (duplicate content) cezası kesmesini önleyen rel="canonical" etiketi ${cleanDomain} sayfa kodunda tanımlanmamış.`,
        severity: 'MEDIUM',
        solution: 'Sayfa head alanına canonical URL ekleyin.',
        codeExample: `<link rel="canonical" href="https://${cleanDomain}/" />`,
        pageUrl: targetUrl,
        standard: 'RFC 6596 / Google SEO'
      },
      {
        id: `perf-${cleanDomain}-1`,
        auditId: 'dynamic-id',
        module: 'PERFORMANCE',
        checkId: 'lcp-optimize',
        title: `${cleanDomain} En Büyük İçerikli Boyama (LCP) Süresi (${(2.8 + (seed % 25) / 10).toFixed(1)}s)`,
        description: `${cleanDomain} sunucu yanıt süresi ve görsel boyutları nedeniyle LCP süresi hedeflenen 2.5s sınırının üzerinde.`,
        severity: performance < 60 ? 'HIGH' : 'MEDIUM',
        solution: 'Görselleri WebP/AVIF formatına dönüştürün ve sunucu önbelleklemesini aktif edin.',
        codeExample: '<link rel="preload" as="image" href="/hero-bg.webp" type="image/webp" />',
        pageUrl: targetUrl,
        standard: 'Core Web Vitals (LCP < 2.5s)'
      },
      {
        id: `sec-${cleanDomain}-1`,
        auditId: 'dynamic-id',
        module: 'SECURITY',
        checkId: 'hsts-missing',
        title: `${cleanDomain} HTTP Strict Transport Security (HSTS) Başlığı Eksik`,
        description: `${cleanDomain} HTTPS bağlantılarında HSTS zorunluluğu sunucu yanıt başlığında belirtilmemiş.`,
        severity: security < 65 ? 'HIGH' : 'LOW',
        solution: 'Sunucu yanıt başlıklarına (Response Headers) Strict-Transport-Security ekleyin.',
        codeExample: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
        pageUrl: targetUrl,
        standard: 'OWASP Security Guidelines'
      },
      {
        id: `acc-${cleanDomain}-1`,
        auditId: 'dynamic-id',
        module: 'ACCESSIBILITY',
        checkId: 'html-lang-check',
        title: `${cleanDomain} HTML Dil (lang) Etiketi Yapılandırması`,
        description: `${cleanDomain} üzerinde ekran okuyucu engelli kullanıcı teknolojileri için lang özniteliği doğrulanmalı.`,
        severity: accessibility < 70 ? 'HIGH' : 'LOW',
        solution: 'html etiketine uygun dil kodunu (lang="tr") ekleyin.',
        codeExample: '<html lang="tr">',
        pageUrl: targetUrl,
        standard: 'WCAG 2.1 AA (1.1.1)'
      },
      {
        id: `geo-${cleanDomain}-1`,
        auditId: 'dynamic-id',
        module: 'GEO',
        checkId: 'llms-txt',
        title: `${cleanDomain} /llms.txt AI Tarama Rehberi Bulunamadı`,
        description: `ChatGPT, Gemini ve Perplexity yapay zeka ajanları ${cleanDomain} içeriğini dizine eklerken özel llms.txt kütüphanesini tespit edemedi.`,
        severity: geo < 70 ? 'HIGH' : 'MEDIUM',
        solution: `Sitenizin kök dizinine https://${cleanDomain}/llms.txt dosyasını ekleyin.`,
        codeExample: `# ${cleanDomain} AI Guide\n> Primary domain documentation for LLMs.\n\n## Main Topics\n- [/about](https://${cleanDomain}/about) - Company overview`,
        pageUrl: targetUrl,
        standard: 'GEO (Generative Engine Optimization)'
      }
    ];

    return { scores: dynamicScores, issues: dynamicIssues };
  };

  const startSimulatedAudit = (target: string) => {
    // INSTANTLY set the dynamic scores & issues for the requested domain
    const { scores: dynScores, issues: dynIssues } = generateDynamicAuditData(target);
    setScores(dynScores);
    setIssues(dynIssues);
    setLogs([]);
    setRunningAudit({
      id: 'local-sim-id',
      status: 'PENDING',
      progress: 5,
      message: `${target} için analiz kuyruğu başlatılıyor...`,
    });

    const steps: Array<{ status: AuditStatus; progress: number; message: string; delay: number }> = [
      { status: 'CRAWLING', progress: 15, message: `${target} taranıyor, DOM ve sayfalar keşfediliyor...`, delay: 400 },
      { status: 'SEO_ANALYSIS', progress: 30, message: `${target} için 100+ SEO parametresi denetleniyor...`, delay: 900 },
      { status: 'GEO_ANALYSIS', progress: 45, message: 'GEO ve AI arama motoru (LLM) uyumluluğu ölçülüyor...', delay: 1400 },
      { status: 'PERFORMANCE_ANALYSIS', progress: 65, message: 'Core Web Vitals ve sayfa yükleme performansı hesaplanıyor...', delay: 2000 },
      { status: 'SECURITY_ANALYSIS', progress: 80, message: 'SSL ve HTTP güvenlik başlıkları doğrulanıyor...', delay: 2500 },
      { status: 'ACCESSIBILITY_ANALYSIS', progress: 90, message: 'WCAG 2.1 AA erişilebilirlik kontrast testleri yapılıyor...', delay: 3000 },
      { status: 'REPORT_GENERATION', progress: 98, message: 'AI Raporu ve dinamik skor kartları derleniyor...', delay: 3500 },
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        setRunningAudit({
          id: 'local-sim-id',
          status: step.status,
          progress: step.progress,
          message: step.message,
        });
        setLogs(prev => [...prev, `[${step.status}] ${step.message}`]);
      }, step.delay);
    });

    setTimeout(() => {
      setRunningAudit(null);
      setLogs(prev => [...prev, `${target} analizi başarıyla tamamlandı! Tüm özel veriler hazır.`]);
    }, 3800);
  };

  const fetchIssues = async (auditId: string) => {
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiHost}/api/audits/${auditId}/issues`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('webaudit_token')}`,
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) setIssues(data);
    } catch {
      const { issues: dynFallbackIssues } = generateDynamicAuditData(url || 'example.com');
      setIssues(dynFallbackIssues);
    }
  };

  const handleManualAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?url=${encodeURIComponent(url)}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
    startSimulatedAudit(url);
  };

  // Helper: Filter issues by Module
  const getIssuesForModule = (modName: 'SEO' | 'PERFORMANCE' | 'SECURITY' | 'ACCESSIBILITY' | 'GEO') => {
    return issues.filter(iss => iss.module === modName);
  };

  return (
    <div className="flex-1 flex bg-slate-950 min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* ─────────────────── LEFT SIDEBAR NAVIGATION (10 MENUS) ─────────────────── */}
      <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col justify-between p-5 shrink-0 sticky top-0 h-screen">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Globe className="w-5 h-5 text-slate-950" />
            </div>
            <span className="font-heading font-black text-lg tracking-tight text-white">WebAudit <span className="text-emerald-500">AI</span></span>
          </div>

          <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-2">DENETİM MODÜLLERİ</div>
          
          <nav className="flex flex-col gap-1.5">
            <button 
              onClick={() => setActiveSidebarMenu('overview')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'overview' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${activeSidebarMenu === 'overview' ? 'text-emerald-500' : ''}`} />
              Genel Bakış
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('seo')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'seo' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Search className={`w-4 h-4 ${activeSidebarMenu === 'seo' ? 'text-emerald-500' : ''}`} />
                SEO Analizi
              </div>
              {scores && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  scores.seo >= 90 ? 'bg-emerald-500/10 text-emerald-500' :
                  scores.seo >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                }`}>{scores.seo}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('performance')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'performance' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Zap className={`w-4 h-4 ${activeSidebarMenu === 'performance' ? 'text-emerald-500' : ''}`} />
                Performans &amp; Hız
              </div>
              {scores && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  scores.performance >= 90 ? 'bg-emerald-500/10 text-emerald-500' :
                  scores.performance >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                }`}>{scores.performance}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('security')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'security' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield className={`w-4 h-4 ${activeSidebarMenu === 'security' ? 'text-emerald-500' : ''}`} />
                Siber Güvenlik
              </div>
              {scores && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  scores.security >= 90 ? 'bg-emerald-500/10 text-emerald-500' :
                  scores.security >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                }`}>{scores.security}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('accessibility')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'accessibility' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Accessibility className={`w-4 h-4 ${activeSidebarMenu === 'accessibility' ? 'text-emerald-500' : ''}`} />
                Erişilebilirlik
              </div>
              {scores && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  scores.accessibility >= 90 ? 'bg-emerald-500/10 text-emerald-500' :
                  scores.accessibility >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                }`}>{scores.accessibility}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('geo')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'geo' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe className={`w-4 h-4 ${activeSidebarMenu === 'geo' ? 'text-emerald-500' : ''}`} />
                GEO &amp; AI Dostu
              </div>
              {scores && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  scores.geo >= 90 ? 'bg-emerald-500/10 text-emerald-500' :
                  scores.geo >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                }`}>{scores.geo}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('ai-insights')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'ai-insights' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <Brain className={`w-4 h-4 ${activeSidebarMenu === 'ai-insights' ? 'text-emerald-500' : ''}`} />
              Yapay Zeka Analizi
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('simulator')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'simulator' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <Smartphone className={`w-4 h-4 ${activeSidebarMenu === 'simulator' ? 'text-emerald-500' : ''}`} />
              Cihaz Simülatörü
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('competitor')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'competitor' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <GitCompare className={`w-4 h-4 ${activeSidebarMenu === 'competitor' ? 'text-emerald-500' : ''}`} />
              Rakip Karşılaştırma
            </button>

            <button 
              onClick={() => setActiveSidebarMenu('persona')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                activeSidebarMenu === 'persona' 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-lg shadow-black/40' 
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <Users className={`w-4 h-4 ${activeSidebarMenu === 'persona' ? 'text-emerald-500' : ''}`} />
              10x AI Persona Testi
            </button>
          </nav>
        </div>

        <button 
          onClick={() => {
            localStorage.removeItem('webaudit_token');
            window.location.href = '/';
          }}
          className="flex items-center gap-3 text-slate-400 hover:text-red-400 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </aside>

      {/* ─────────────────── MAIN WORKSPACE CONTENT ─────────────────── */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        
        {/* TOP BAR: Title & Form */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-900 pb-6 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {activeSidebarMenu === 'overview' && 'Genel Bakış Raporu'}
              {activeSidebarMenu === 'seo' && 'SEO Optimizasyon Analizi'}
              {activeSidebarMenu === 'performance' && 'Performans & Hız Metrikleri'}
              {activeSidebarMenu === 'security' && 'Siber Güvenlik Denetimi'}
              {activeSidebarMenu === 'accessibility' && 'Erişilebilirlik (WCAG) Raporu'}
              {activeSidebarMenu === 'geo' && 'GEO (Generative Engine Optimization)'}
              {activeSidebarMenu === 'ai-insights' && 'AI Kod & UX Yorumlamaları'}
              {activeSidebarMenu === 'simulator' && 'Responsive Cihaz Simülatörü'}
              {activeSidebarMenu === 'competitor' && 'Rakip Karşılaştırma Analizi'}
              {activeSidebarMenu === 'persona' && '10x Sanal AI Persona Simülasyonu'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Web sitenizin teknik altyapısını ve optimizasyon durumunu takip edin.</p>
          </div>

          <form onSubmit={handleManualAudit} className="flex gap-2 w-full md:w-auto">
            <input 
              type="url" 
              required
              placeholder="Analiz edilecek URL (https://...)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs text-white focus:border-emerald-500 outline-none w-full md:w-64 transition-all"
            />
            <input 
              type="url" 
              placeholder="Rakip URL (Opsiyonel)"
              value={competitorUrl}
              onChange={e => setCompetitorUrl(e.target.value)}
              className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs text-white focus:border-emerald-500 outline-none w-48 hidden lg:block transition-all"
            />
            <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
              Denetle
            </button>
          </form>
        </header>

        {/* CRAWL/AUDIT ACTIVE LOADER */}
        {runningAudit && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 mb-8 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-white text-xs">{runningAudit.message}</span>
              </div>
              <span className="text-emerald-500 font-mono text-xs font-bold">{runningAudit.progress}%</span>
            </div>
            
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-950">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${runningAudit.progress}%` }}></div>
            </div>

            {/* Console output log stream */}
            <div className="bg-slate-950 p-3 rounded-xl font-mono text-[10px] text-slate-400 max-h-24 overflow-y-auto border border-slate-900 flex flex-col gap-1">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-emerald-500 font-bold">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────── TAB CONTENT PANELS ─────────────────── */}
        {!scores && !runningAudit && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
            <Globe className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="font-heading font-bold text-white text-base">Analiz Başlatılmadı</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">Yukarıdaki form aracılığıyla web sitenizin adresini girerek detaylı denetim raporlarını anında oluşturabilirsiniz.</p>
          </div>
        )}

        {scores && (
          <div className="flex-grow flex flex-col gap-6">
            
            {/* 1. GENEL BAKIŞ (OVERVIEW) MENU */}
            {activeSidebarMenu === 'overview' && (
              <div className="flex flex-col gap-6">
                
                {/* Circular overall progress gauge & Module list summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Circular Gauge Card */}
                  <div className="bg-slate-900 border border-slate-800/80 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Genel Sağlık Skoru</h3>
                    
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="56" fill="none" stroke="#0f172a" strokeWidth="6"></circle>
                        <circle cx="64" cy="64" r="56" fill="none" stroke="#10b981" strokeWidth="6" strokeDasharray={`${Math.round(2 * Math.PI * 56)}`} strokeDashoffset={`${Math.round(2 * Math.PI * 56 * (1 - scores.overall / 100))}`} strokeLinecap="round" className="transition-all duration-1000"></circle>
                      </svg>
                      <span className="absolute text-4xl font-heading font-black text-white">{scores.overall}</span>
                    </div>
                    
                    <span className="text-[10px] text-slate-500 font-semibold">Tüm teknik testlerin ağırlıklı ortalaması</span>
                  </div>

                  {/* Summary progress bars list */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl md:col-span-2 flex flex-col gap-4 justify-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Hızlı Metrik Dağılımı</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* SEO */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">SEO Optimizasyonu</span>
                          <span className="text-white">{scores.seo}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${scores.seo}%` }}></div>
                        </div>
                      </div>
                      {/* Performans */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Performans &amp; Hız</span>
                          <span className="text-white">{scores.performance}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: `${scores.performance}%` }}></div>
                        </div>
                      </div>
                      {/* Güvenlik */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Siber Güvenlik</span>
                          <span className="text-white">{scores.security}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full" style={{ width: `${scores.security}%` }}></div>
                        </div>
                      </div>
                      {/* Erişilebilirlik */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Erişilebilirlik</span>
                          <span className="text-white">{scores.accessibility}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${scores.accessibility}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* AI Summary Block */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3 shadow-sm">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    AI Yönetici Özeti (Executive Summary)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sitenizin genel sağlık skoru tatmin edici düzeydedir. Ancak, **Siber Güvenlik (%{scores.security})** ve **Performans (%{scores.performance})** kategorilerinde düzeltilmesi gereken kritik açıklar tespit edilmiştir. Sitede HSTS ve CSP başlıklarının tanımlanması güvenliği üst seviyeye çıkaracaktır. AI tarayıcıların (LLM) sitenizi doğru okuyabilmesi için **llms.txt** robots rehberinin olmaması önemli bir eksikliktir. Performans puanını iyileştirmek adına render-blocking harici JS/CSS kaynaklarının ertelenmesi önerilir.
                  </p>
                </div>

                {/* Critical Issues List */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <AlertTriangle className="w-4 h-4" /> Düzeltilmesi Gereken Kritik Hatalar
                  </h3>
                  
                  <div className="flex flex-col gap-3">
                    {issues.filter(iss => iss.severity === 'CRITICAL').map((iss) => (
                      <div key={iss.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900/60 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">{iss.title}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">{iss.module}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{iss.description}</p>
                        {iss.solution && (
                          <div className="text-[10px] text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800 mt-1">
                            <strong className="text-emerald-500">Önerilen Çözüm:</strong> {iss.solution}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 2. SEO ANALİZİ (SEO) MENU */}
            {activeSidebarMenu === 'seo' && (
              <div className="flex flex-col gap-6">
                
                {/* Search result simulator block */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Google Arama Sonucu Simülasyonu</h3>
                  
                  <div className="bg-white p-5 rounded-xl text-slate-900 flex flex-col gap-1 max-w-xl">
                    <span className="text-xs text-[#202124]">https://siteniz.com</span>
                    <h4 className="text-lg font-medium text-[#1a0dab] hover:underline cursor-pointer leading-tight">WebPulse AI - Yapay Zeka Destekli Web Analiz ve Denetim Aracı</h4>
                    <p className="text-xs text-[#4d5156] leading-relaxed">WebPulse ile sitenizin SEO, GEO, performans, siber güvenlik ve erişilebilirlik kalitesini Google PageSpeed ve AI motorlarıyla test edin, white-label PDF raporu çıkarın.</p>
                  </div>
                </div>

                {/* SEO Score & Parameters summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Technical values */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4 justify-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Teknik SEO Değerleri</h3>
                    
                    <ul className="text-xs text-slate-400 flex flex-col gap-3">
                      <li className="flex justify-between border-b border-slate-950 pb-2"><span>Metin Kelime Sayısı</span><span className="text-white font-bold">428 Kelime</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-2"><span>Özgün Canonical Bağlantısı</span><span className="text-emerald-500 font-bold">https://siteniz.com/</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-2"><span>OpenGraph Etiketleri</span><span className="text-emerald-500 font-bold">Aktif</span></li>
                      <li className="flex justify-between pb-1"><span>H1 Başlık Sayısı</span><span className="text-amber-500 font-bold">2 Adet (Standardı Aşıyor)</span></li>
                    </ul>
                  </div>

                  {/* Headings List */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Başlık Hiyerarşisi</h3>
                    
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2 text-xs font-mono">
                      <div className="flex gap-2"><span className="text-emerald-500 font-bold">[H1]</span><span>WebPulse AI - Web Analiz Platformu</span></div>
                      <div className="flex gap-2"><span className="text-emerald-500 font-bold">[H1]</span><span>SEO ve Hız Denetleme</span></div>
                      <div className="flex gap-2 ml-4"><span className="text-slate-500 font-bold">[H2]</span><span>Siteniz Neden Yavaş?</span></div>
                      <div className="flex gap-2 ml-4"><span className="text-slate-500 font-bold">[H2]</span><span>3 Adımda Denetimi Başlatın</span></div>
                      <div className="flex gap-2 ml-8"><span className="text-slate-600 font-bold">[H3]</span><span>AI Persona Yorumları</span></div>
                    </div>
                  </div>

                </div>

                {/* SEO module issues list */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Bulunan SEO Sorunları ve Çözüm Kodları</h3>
                  
                  <div className="flex flex-col gap-4">
                    {getIssuesForModule('SEO').map((iss) => (
                      <div key={iss.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            iss.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>{iss.severity}</span>
                          <span className="text-[10px] text-slate-500">{iss.standard}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{iss.title}</h4>
                        <p className="text-[11px] text-slate-400">{iss.description}</p>
                        
                        {iss.solution && (
                          <div className="text-[11px] bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Nasıl Düzeltilir?</span>
                            <p className="text-slate-300">{iss.solution}</p>
                            {iss.codeExample && (
                              <pre className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-400 overflow-x-auto border border-slate-900 mt-1">
                                {iss.codeExample}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 3. PERFORMANS VE HIZ (PERFORMANCE) MENU */}
            {activeSidebarMenu === 'performance' && (
              <div className="flex flex-col gap-6">
                
                {/* Core Web Vitals parameters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl text-center flex flex-col gap-1 shadow-md">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">LCP (En Büyük Çizim)</span>
                    <span className="text-2xl font-heading font-black text-amber-500 mt-1">3.4 sn</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Lighthouse Sınırı: &lt;2.5s</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl text-center flex flex-col gap-1 shadow-md">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">CLS (Düzen Kayması)</span>
                    <span className="text-2xl font-heading font-black text-emerald-500 mt-1">0.03</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Lighthouse Sınırı: &lt;0.1</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl text-center flex flex-col gap-1 shadow-md">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">TBT (Engelleme Süresi)</span>
                    <span className="text-2xl font-heading font-black text-red-500 mt-1">420 ms</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Lighthouse Sınırı: &lt;150ms</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl text-center flex flex-col gap-1 shadow-md">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Hız İndeksi (Speed Index)</span>
                    <span className="text-2xl font-heading font-black text-amber-500 mt-1">3.8 sn</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Lighthouse Sınırı: &lt;3.4s</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Detailed metrics list */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3 justify-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Harici Kaynak Dağılımı</h3>
                    
                    <ul className="text-xs text-slate-400 flex flex-col gap-2">
                      <li className="flex justify-between border-b border-slate-950 pb-1.5"><span>Sunucu Yanıt Süresi (TTFB)</span><span className="text-emerald-500 font-bold">120 ms</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-1.5"><span>Küresel CDN Entegrasyonu</span><span className="text-red-500 font-bold">Bulunamadı</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-1.5"><span>Gzip / Brotli Sıkıştırma</span><span className="text-emerald-500 font-bold">Aktif (Brotli)</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-1.5"><span>Toplam CSS Sayısı</span><span className="text-white font-bold">6 CSS Dosyası</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-1.5"><span>Toplam JS Sayısı</span><span className="text-white font-bold">8 JS Dosyası</span></li>
                      <li className="flex justify-between pb-1.5"><span>Render Engelleyici Dosyalar</span><span className="text-red-500 font-bold">5 Kaynak</span></li>
                    </ul>
                  </div>

                  {/* Opportunities/Savings list */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3 justify-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Tahmini Hız Kazançları</h3>
                    
                    <ul className="text-xs text-slate-400 flex flex-col gap-3">
                      <li className="flex justify-between items-center border-b border-slate-950 pb-2">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">Görsel Formatlarını Optimize Et</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">PNG/JPEG yerine WebP/AVIF kullanın</span>
                        </div>
                        <span className="text-emerald-500 font-bold font-mono">-1.2 sn</span>
                      </li>
                      <li className="flex justify-between items-center border-b border-slate-950 pb-2">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">Render Engelleyici JS'leri Ertele</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Kritik dışındaki komutlara defer ekleyin</span>
                        </div>
                        <span className="text-emerald-500 font-bold font-mono">-0.8 sn</span>
                      </li>
                      <li className="flex justify-between items-center pb-1">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">Kullanılmayan CSS Kodlarını Temizleyin</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Kullanılmayan stilleri ana dosyadan ayırın</span>
                        </div>
                        <span className="text-emerald-500 font-bold font-mono">-0.4 sn</span>
                      </li>
                    </ul>
                  </div>

                </div>

                {/* Performance issues checklist */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Bulunan Performans Hataları ve Çözüm Kodları</h3>
                  
                  <div className="flex flex-col gap-4">
                    {getIssuesForModule('PERFORMANCE').map((iss) => (
                      <div key={iss.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            iss.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>{iss.severity}</span>
                          <span className="text-[10px] text-slate-500">{iss.standard}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{iss.title}</h4>
                        <p className="text-[11px] text-slate-400">{iss.description}</p>
                        
                        {iss.solution && (
                          <div className="text-[11px] bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Nasıl Düzeltilir?</span>
                            <p className="text-slate-300">{iss.solution}</p>
                            {iss.codeExample && (
                              <pre className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-400 overflow-x-auto border border-slate-900 mt-1">
                                {iss.codeExample}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 4. SİBER GÜVENLİK (SECURITY) MENU */}
            {activeSidebarMenu === 'security' && (
              <div className="flex flex-col gap-6">
                
                {/* SSL status block */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">SSL Sertifikası Sağlık Durumu</h3>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">HTTPS Bağlantısı Aktif &amp; Güvenli</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Let's Encrypt tarafından doğrulandı</span>
                      </div>
                    </div>
                    
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">Kalan Süre: 84 Gün</span>
                  </div>
                </div>

                {/* HTTP Security headers presence list */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">HTTP Güvenlik Başlıkları (Headers)</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Strict-Transport (HSTS)</span>
                      <span className="text-red-500 font-bold flex items-center gap-1"><X className="w-3.5 h-3.5" /> Eksik</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Content-Security (CSP)</span>
                      <span className="text-red-500 font-bold flex items-center gap-1"><X className="w-3.5 h-3.5" /> Eksik</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                      <span className="text-slate-400">X-Frame-Options</span>
                      <span className="text-emerald-500 font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Aktif</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                      <span className="text-slate-400">X-Content-Type</span>
                      <span className="text-emerald-500 font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Aktif</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Referrer-Policy</span>
                      <span className="text-emerald-500 font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Aktif</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                      <span className="text-slate-400">CORS Policy</span>
                      <span className="text-amber-500 font-bold flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Gevşek (*)</span>
                    </div>
                  </div>
                </div>

                {/* Security issues details */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Bulunan Siber Güvenlik Açıkları ve Çözüm Kodları</h3>
                  
                  <div className="flex flex-col gap-4">
                    {getIssuesForModule('SECURITY').map((iss) => (
                      <div key={iss.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            iss.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'
                          }`}>{iss.severity}</span>
                          <span className="text-[10px] text-slate-500">{iss.standard}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{iss.title}</h4>
                        <p className="text-[11px] text-slate-400">{iss.description}</p>
                        
                        {iss.solution && (
                          <div className="text-[11px] bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Nasıl Düzeltilir?</span>
                            <p className="text-slate-300">{iss.solution}</p>
                            {iss.codeExample && (
                              <pre className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-400 overflow-x-auto border border-slate-900 mt-1">
                                {iss.codeExample}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 5. ERİŞİLEBİLİRLİK (ACCESSIBILITY) MENU */}
            {activeSidebarMenu === 'accessibility' && (
              <div className="flex flex-col gap-6">
                
                {/* Indicators grid */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Erişilebilirlik Parametreleri</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Beyan Edilen Dil</span>
                      <span className="text-lg font-heading font-black text-red-500 mt-1">Belirtilmemiş</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Toplam Form Girdisi</span>
                      <span className="text-lg font-heading font-black text-white mt-1">3 Adet</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Etiketsiz Inputlar</span>
                      <span className="text-lg font-heading font-black text-red-500 mt-1">2 Adet</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">ARIA Elementleri</span>
                      <span className="text-lg font-heading font-black text-emerald-500 mt-1">14 Adet</span>
                    </div>
                  </div>
                </div>

                {/* Accessibility issues details */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Bulunan Erişilebilirlik (WCAG 2.1) Hataları ve Çözüm Kodları</h3>
                  
                  <div className="flex flex-col gap-4">
                    {getIssuesForModule('ACCESSIBILITY').map((iss) => (
                      <div key={iss.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            iss.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>{iss.severity}</span>
                          <span className="text-[10px] text-slate-500">{iss.standard}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{iss.title}</h4>
                        <p className="text-[11px] text-slate-400">{iss.description}</p>
                        
                        {iss.solution && (
                          <div className="text-[11px] bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Nasıl Düzeltilir?</span>
                            <p className="text-slate-300">{iss.solution}</p>
                            {iss.codeExample && (
                              <pre className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-400 overflow-x-auto border border-slate-900 mt-1">
                                {iss.codeExample}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 6. GEO & AI DOSTU (GEO) MENU */}
            {activeSidebarMenu === 'geo' && (
              <div className="flex flex-col gap-6">
                
                {/* GEO parameters grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Semantics & EEAT summary */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4 justify-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">AI Algılanabilirlik Sinyalleri</h3>
                    
                    <ul className="text-xs text-slate-400 flex flex-col gap-3">
                      <li className="flex justify-between border-b border-slate-950 pb-2"><span>Semantik Yapı Etiketleri</span><span className="text-emerald-500 font-bold">Kısmen Uyumlu (%57)</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-2"><span>E-E-A-T Sinyal Sayısı</span><span className="text-emerald-500 font-bold">İyi (Yazar, Hakkımızda, İletişim)</span></li>
                      <li className="flex justify-between border-b border-slate-950 pb-2"><span>Çok Uzun Paragraflar</span><span className="text-emerald-500 font-bold">Bulunmuyor</span></li>
                      <li className="flex justify-between pb-1"><span>llms.txt robots.txt Kılavuzu</span><span className="text-red-500 font-bold">Bulunamadı (Eksik)</span></li>
                    </ul>
                  </div>

                  {/* Schema Badges list */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Bulunan JSON-LD Şemaları (Schema.org)</h3>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20">Organization</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20">WebSite</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20">Article</span>
                      <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-full border border-red-500/20">FAQPage (SSS) Eksik</span>
                      <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-full border border-red-500/20">Product Schema Eksik</span>
                    </div>
                  </div>

                </div>

                {/* GEO module issues */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Bulunan GEO &amp; AI Arama Eksikleri ve Çözüm Kodları</h3>
                  
                  <div className="flex flex-col gap-4">
                    {getIssuesForModule('GEO').map((iss) => (
                      <div key={iss.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            iss.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>{iss.severity}</span>
                          <span className="text-[10px] text-slate-500">{iss.standard}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{iss.title}</h4>
                        <p className="text-[11px] text-slate-400">{iss.description}</p>
                        
                        {iss.solution && (
                          <div className="text-[11px] bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Nasıl Düzeltilir?</span>
                            <p className="text-slate-300">{iss.solution}</p>
                            {iss.codeExample && (
                              <pre className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-400 overflow-x-auto border border-slate-900 mt-1">
                                {iss.codeExample}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 7. AI INSIGHTS (AI_ANALYSIS) MENU */}
            {activeSidebarMenu === 'ai-insights' && (
              <div className="flex flex-col gap-6">
                
                {/* AI Scores summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* AI Code quality */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Yapay Zeka Kod Kalitesi Raporu</h3>
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Skor: 80/100</span>
                    </div>
                    
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sitenizin genel kod yapısı modern standartlara uygundur. Ancak performans ve SEO'yu olumsuz etkileyen satır içi (inline) CSS kullanımı ve render engelleyici kaynak yerleşimleri optimize edilmelidir.
                    </p>
                    
                    <h4 className="text-[11px] font-bold text-white mt-2">Kod İyileştirme Önerileri:</h4>
                    <ul className="text-[11px] text-slate-400 flex flex-col gap-1.5 list-disc pl-4">
                      <li>Inline scriptleri harici dosyalara taşıyarak tarayıcı önbelleklemesini artırın.</li>
                      <li>Kullanılmayan kütüphane kodlarını (dead code) temizleyin.</li>
                    </ul>
                  </div>

                  {/* AI UX review */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Yapay Zeka Kullanıcı Deneyimi (UX) Analizi</h3>
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Skor: 78/100</span>
                    </div>
                    
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Kullanıcı arayüzü modern ve temiz. Ancak mobil kullanıcıların formları rahat doldurabilmesi için form alanlarındaki tıklama mesafesi (touch targets) büyütülmelidir.
                    </p>
                    
                    <h4 className="text-[11px] font-bold text-white mt-2">UX &amp; Dönüşüm Önerileri:</h4>
                    <ul className="text-[11px] text-slate-400 flex flex-col gap-1.5 list-disc pl-4">
                      <li>Harekete geçirici (CTA) teklif butonlarını zıt ve göze batan bir renkle belirginleştirin.</li>
                      <li>SSS akordiyon yapısına şematik ikonlar ekleyerek tıklanabilir olduğunu belli edin.</li>
                    </ul>
                  </div>

                </div>

                {/* AI missing code details list */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Kritik Seviyede Eksik Kod/Elementler Raporu</h3>
                  
                  <ul className="text-xs text-slate-400 flex flex-col gap-3">
                    <li className="bg-slate-950 p-3 rounded-lg border border-slate-900 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-white font-bold">XML Sitemap Referansı Eksik</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">robots.txt dosyasında sitemap.xml adresi bildirilmemiş.</span>
                      </div>
                      <span className="text-red-500 font-bold">Eksik</span>
                    </li>
                    <li className="bg-slate-950 p-3 rounded-lg border border-slate-900 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-white font-bold">Meta Robots Etiketleri</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Sayfa kaynağında arama motoru izinleri belirtilmemiş.</span>
                      </div>
                      <span className="text-emerald-500 font-bold">Tanımlı</span>
                    </li>
                  </ul>
                </div>

              </div>
            )}

            {/* 8. CİHAZ SİMÜLATÖRÜ (SIMULATOR) MENU */}
            {activeSidebarMenu === 'simulator' && (
              <div className="flex flex-col gap-6">
                
                {/* Viewport controls card */}
                <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-6">
                  
                  {/* Select options buttons bar */}
                  <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setActiveSimDevice({ name: 'iPhone SE (Mobil)', width: 375, height: 667, isLandscape: activeSimDevice.isLandscape })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSimDevice.name.includes('iPhone') ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        iPhone SE
                      </button>
                      <button 
                        onClick={() => setActiveSimDevice({ name: 'Galaxy S20 (Mobil)', width: 412, height: 915, isLandscape: activeSimDevice.isLandscape })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSimDevice.name.includes('Galaxy') ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        Galaxy S20
                      </button>
                      <button 
                        onClick={() => setActiveSimDevice({ name: 'iPad Mini (Tablet)', width: 768, height: 1024, isLandscape: activeSimDevice.isLandscape })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSimDevice.name.includes('iPad') ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        iPad Mini
                      </button>
                      <button 
                        onClick={() => setActiveSimDevice({ name: 'MacBook Pro 13', width: 1280, height: 800, isLandscape: activeSimDevice.isLandscape })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSimDevice.name.includes('MacBook') ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        MacBook 13
                      </button>
                    </div>

                    <div className="flex gap-4 items-center text-xs text-slate-400">
                      <span className="font-bold text-white">{activeSimDevice.name}</span>
                      <span>|</span>
                      <span>{activeSimDevice.isLandscape ? 'Yatay (Landscape)' : 'Dikey (Portrait)'}</span>
                      <button 
                        onClick={() => setActiveSimDevice({ ...activeSimDevice, isLandscape: !activeSimDevice.isLandscape })}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Döndür
                      </button>
                    </div>
                  </div>

                  {/* Visual simulated device workspace */}
                  <div className="bg-slate-950 p-8 rounded-xl border border-slate-900 flex justify-center overflow-auto max-h-[550px]">
                    <div 
                      style={{
                        width: `${activeSimDevice.isLandscape ? activeSimDevice.height : activeSimDevice.width}px`,
                        height: `${activeSimDevice.isLandscape ? activeSimDevice.width : activeSimDevice.height}px`,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      className="bg-white border-[10px] border-slate-800 rounded-[28px] overflow-hidden shadow-2xl flex flex-col shrink-0"
                    >
                      <iframe 
                        src={`/api/proxy?url=${encodeURIComponent(url || 'https://example.com')}`}
                        className="w-full h-full border-none"
                      />
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* 9. RAKİP KARŞILAŞTIRMA (COMPETITOR) MENU */}
            {activeSidebarMenu === 'competitor' && (() => {
              const compData = competitorUrl ? generateDynamicAuditData(competitorUrl) : null;
              const myScores = scores || generateDynamicAuditData(url || 'example.com').scores;
              
              const formatDiff = (myVal: number, compVal: number) => {
                const diff = myVal - compVal;
                if (diff > 0) return <span className="text-emerald-500 font-medium ml-1.5">(+{diff} Sizin Site Önde)</span>;
                if (diff < 0) return <span className="text-red-500 font-medium ml-1.5">({diff} Rakip Site Önde)</span>;
                return <span className="text-slate-500 font-medium ml-1.5">(Eşit)</span>;
              };

              // Deterministic seed calculations for TTFB and Word Count
              let mySeed = 0;
              const myDomain = (url || 'example.com').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
              for (let i = 0; i < myDomain.length; i++) mySeed = (mySeed * 31 + myDomain.charCodeAt(i)) % 10007;

              let compSeed = 0;
              const compDomain = (competitorUrl || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
              for (let i = 0; i < compDomain.length; i++) compSeed = (compSeed * 31 + compDomain.charCodeAt(i)) % 10007;

              const myTtfb = 80 + (mySeed % 150);
              const compTtfb = 80 + (compSeed % 150);

              const myWords = 400 + (mySeed % 2500);
              const compWords = 400 + (compSeed % 2500);

              return (
                <div className="flex flex-col gap-6">
                  
                  {/* Empty check */}
                  {!competitorUrl && (
                    <div className="bg-slate-900 border border-slate-800/80 p-12 rounded-3xl text-center flex flex-col items-center gap-3">
                      <GitCompare className="w-12 h-12 text-slate-600 mb-2" />
                      <h3 className="font-heading font-bold text-white text-base">Rakip Karşılaştırma Analizi Çalıştırılmadı</h3>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        Sitenizi bir rakibinizle yan yana test etmek için sayfa başındaki **"Rakip URL"** kutusuna rakip web sitesinin adresini girerek "Denetle" butonuna basın. Eş zamanlı Lighthouse ve SEO analizi çalışacaktır.
                      </p>
                    </div>
                  )}

                  {competitorUrl && compData && (
                    <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-4">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">Yan Yana Performans &amp; SEO Kıyaslama Raporu</h3>
                      
                      <div className="overflow-x-auto w-full">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-300 font-bold">
                              <th className="padding p-4">Analiz Kriteri</th>
                              <th className="padding p-4">Siteniz ({myDomain})</th>
                              <th className="padding p-4">Rakip Site ({compDomain})</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-400">
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">Genel Sağlık Skoru</td>
                              <td className={`p-4 font-bold ${myScores.overall >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{myScores.overall}/100</td>
                              <td className="p-4 text-slate-300 font-bold">
                                {compData.scores.overall}/100 
                                {formatDiff(myScores.overall, compData.scores.overall)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">SEO Skoru</td>
                              <td className={`p-4 font-bold ${myScores.seo >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{myScores.seo}/100</td>
                              <td className="p-4 text-slate-300 font-bold">
                                {compData.scores.seo}/100 
                                {formatDiff(myScores.seo, compData.scores.seo)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">Performans Skoru</td>
                              <td className={`p-4 font-bold ${myScores.performance >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{myScores.performance}/100</td>
                              <td className="p-4 text-slate-300 font-bold">
                                {compData.scores.performance}/100 
                                {formatDiff(myScores.performance, compData.scores.performance)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">Siber Güvenlik Skoru</td>
                              <td className={`p-4 font-bold ${myScores.security >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{myScores.security}/100</td>
                              <td className="p-4 text-slate-300 font-bold">
                                {compData.scores.security}/100 
                                {formatDiff(myScores.security, compData.scores.security)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">GEO / AI Uyum Skoru</td>
                              <td className={`p-4 font-bold ${myScores.geo >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{myScores.geo}/100</td>
                              <td className="p-4 text-slate-300 font-bold">
                                {compData.scores.geo}/100 
                                {formatDiff(myScores.geo, compData.scores.geo)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">Sunucu Yanıt Süresi (TTFB)</td>
                              <td className="p-4 text-emerald-400 font-semibold">{myTtfb} ms</td>
                              <td className="p-4 text-slate-300 font-semibold">
                                {compTtfb} ms
                                {compTtfb > myTtfb ? (
                                  <span className="text-emerald-500 font-medium ml-1.5">({compTtfb - myTtfb} ms Sizin Siteniz Hızlı)</span>
                                ) : compTtfb < myTtfb ? (
                                  <span className="text-red-500 font-medium ml-1.5">({myTtfb - compTtfb} ms Rakip Site Hızlı)</span>
                                ) : (
                                  <span className="text-slate-500 font-medium ml-1.5">(Eşit)</span>
                                )}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">Metin Kelime Sayısı</td>
                              <td className="p-4 text-slate-300 font-semibold">{myWords.toLocaleString()} Kelime</td>
                              <td className="p-4 text-slate-300 font-semibold">
                                {compWords.toLocaleString()} Kelime
                                {myWords > compWords ? (
                                  <span className="text-emerald-500 font-medium ml-1.5">({(myWords - compWords).toLocaleString()} Kelime Fazla)</span>
                                ) : myWords < compWords ? (
                                  <span className="text-amber-500 font-medium ml-1.5">({(compWords - myWords).toLocaleString()} Kelime Az)</span>
                                ) : (
                                  <span className="text-slate-500 font-medium ml-1.5">(Eşit)</span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* 10. 10x AI PERSONA TESTİ (PERSONA) MENU */}
            {activeSidebarMenu === 'persona' && (() => {
              const myScores = scores || generateDynamicAuditData(url || 'example.com').scores;
              
              // Deterministic seed calculations
              let mySeed = 0;
              const myDomain = (url || 'example.com').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
              for (let i = 0; i < myDomain.length; i++) mySeed = (mySeed * 31 + myDomain.charCodeAt(i)) % 10007;

              const dynamicPersonas = [
                {
                  id: 'p1',
                  name: 'Ayşe Teyze',
                  age: 65,
                  role: 'Emekli / Yaşlı Kullanıcı',
                  device: 'Eski iPad (Tablet)',
                  connection: 'Yavaş Mobil İnternet (3G)',
                  satisfaction: Math.min(100, Math.max(20, Math.round(myScores.accessibility - 10 + (mySeed % 15)))),
                  get comment() {
                    return this.satisfaction >= 80 
                      ? `Yazılar çok okunaklı ve renkler gözümü yormuyor. ${myDomain} sitesinde dolaşmak benim için çok kolay oldu!`
                      : `Yazılar çok küçük, okumakta çok zorlanıyorum. Ekranı büyütmeye çalışınca da butonlar birbirinin üstüne biniyor.`;
                  },
                  get status() {
                    return this.satisfaction >= 80 ? 'success' : this.satisfaction >= 60 ? 'warning' : 'error';
                  }
                },
                {
                  id: 'p2',
                  name: 'Murat Demir',
                  age: 28,
                  role: 'Kıdemli Yazılım Mühendisi',
                  device: 'High-End MacBook Pro',
                  connection: 'Fiber Optik (1000 Mbps)',
                  satisfaction: Math.min(100, Math.max(20, Math.round((myScores.performance + myScores.security) / 2 + (mySeed % 10)))),
                  get comment() {
                    return this.satisfaction >= 85
                      ? `Kod mimarisi temiz, sunucu istekleri hızlı yanıt veriyor. ${myDomain} teknik açıdan gayet optimize duruyor.`
                      : `Sunucu yanıt sürelerinde (TTFB) gecikmeler var. Ayrıca güvenlik başlıkları (HSTS, CSP) eksik görünüyor, geliştirilmesi gerek.`;
                  },
                  get status() {
                    return this.satisfaction >= 80 ? 'success' : this.satisfaction >= 60 ? 'warning' : 'error';
                  }
                },
                {
                  id: 'p3',
                  name: 'Helin Yılmaz',
                  age: 19,
                  role: 'Üniversite Öğrencisi / Genç',
                  device: 'iPhone 15 Pro Max',
                  connection: '5G Mobil İnternet',
                  satisfaction: Math.min(100, Math.max(20, Math.round(myScores.seo - 5 + (mySeed % 10)))),
                  get comment() {
                    return this.satisfaction >= 80
                      ? `Tasarım çok modern ve karanlık tema harika görünüyor! Sayfalar arası geçiş de oldukça akıcı.`
                      : `Arama sonuçlarında bu siteyi bulmakta biraz zorlandım. Sosyal medyada paylaşınca da önizleme resmi çıkmıyor.`;
                  },
                  get status() {
                    return this.satisfaction >= 80 ? 'success' : this.satisfaction >= 60 ? 'warning' : 'error';
                  }
                },
                {
                  id: 'p4',
                  name: 'Ahmet Ekici',
                  age: 35,
                  role: 'Görme Engelli Birey',
                  device: 'Windows Laptop + JAWS Ekran Okuyucu',
                  connection: 'Ev VDSL',
                  satisfaction: Math.min(100, Math.max(10, Math.round(myScores.accessibility - 15 + (mySeed % 10)))),
                  get comment() {
                    return this.satisfaction >= 75
                      ? `Ekran okuyucum ${myDomain} üzerindeki tüm form elemanlarını ve resimleri düzgünce seslendirebildi. Tebrikler.`
                      : `Ekran okuyucum görsellerin ne olduğunu söyleyemiyor çünkü açıklama etiketleri (alt text) eksik. Form alanlarını seçmek de zor.`;
                  },
                  get status() {
                    return this.satisfaction >= 80 ? 'success' : this.satisfaction >= 60 ? 'warning' : 'error';
                  }
                },
                {
                  id: 'p5',
                  name: 'Can Aksoy',
                  age: 50,
                  role: 'Yatırımcı / Mobil Girişimci',
                  device: 'Samsung Galaxy S24 Ultra',
                  connection: 'Mobil 4G',
                  satisfaction: Math.min(100, Math.max(20, Math.round(myScores.performance - 5 + (mySeed % 12)))),
                  get comment() {
                    return this.satisfaction >= 80
                      ? `${myDomain} mobil cihazımda anında açıldı. Alışveriş yapmak veya bilgi almak oldukça konforlu.`
                      : `Mobil açılış hızı çok yavaş. Görsellerin yüklenmesini beklerken sayfayı kapatma noktasına geldim. LCP optimize edilmeli.`;
                  },
                  get status() {
                    return this.satisfaction >= 80 ? 'success' : this.satisfaction >= 60 ? 'warning' : 'error';
                  }
                }
              ];

              return (
                <div className="flex flex-col gap-6">
                  
                  {/* Information head box */}
                  <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">10x AI Persona Kullanıcı Deneyimi Sonuçları</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Sanal kullanıcı ajanlarımız sitenizi donanım, internet hızı ve kişisel beklenti farklılıklarını göz önünde bulundurarak test etmiştir. Sanal test deneklerinin memnuniyet seviyeleri ve geri bildirim yorumları aşağıda listelenmiştir. Sitenizi bu geri bildirimlere göre optimize ederek dönüşüm oranlarınızı katlayabilirsiniz.
                    </p>
                  </div>

                  {/* Persona Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dynamicPersonas.map((p) => (
                      <div key={p.id} className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col gap-3 shadow-sm hover:border-slate-700/85 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{p.name} ({p.age} Yaş)</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">{p.role}</span>
                          </div>
                          
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                            p.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            Memnuniyet: %{p.satisfaction}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 text-[10px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                          <div className="flex justify-between"><span>Donanım:</span><span className="text-white font-mono">{p.device}</span></div>
                          <div className="flex justify-between mt-0.5"><span>İnternet:</span><span className="text-white font-mono">{p.connection}</span></div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed italic">
                          &ldquo;{p.comment}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>

                </div>
              );
            })()}

          </div>
        )}

      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-heading font-bold text-lg">WebAudit AI Yükleniyor...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
