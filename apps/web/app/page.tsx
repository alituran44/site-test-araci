'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, Zap, Globe, Search, Accessibility, BarChart, ArrowRight, Check, Play, UserCheck, Code
} from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setIsLoading(true);
    // Redirect to test account dashboard audit flow
    window.location.href = `/dashboard?url=${encodeURIComponent(url)}&competitor=${encodeURIComponent(competitorUrl)}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-500" />
            <span className="font-heading font-extrabold text-xl tracking-tight text-white">WebAudit <span className="text-emerald-500">AI</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-500 transition-colors">Özellikler</a>
            <a href="#pricing" className="hover:text-emerald-500 transition-colors">Fiyatlandırma</a>
            <a href="#faq" className="hover:text-emerald-500 transition-colors">SSS</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold hover:text-emerald-500 transition-colors">Giriş Yap</Link>
            <Link href="/register" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-lg shadow-emerald-500/20">Ücretsiz Başla</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center flex flex-col items-center gap-8">
        <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">
          Yapay Zekâ Destekli Yeni Nesil Web Denetimi
        </div>

        <h1 className="text-4xl md:text-6xl font-heading font-extrabold text-white leading-tight max-w-4xl tracking-tight">
          5 Denetim Modülü. 10 Kullanıcı Gözü.<br />
          <span className="text-emerald-500">Tek White-Label Rapor.</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          SEO, Performans, Güvenlik, Erişilebilirlik ve GEO/AI tarayıcı uyumluluğunu tek tıkla analiz edin. 10 farklı kullanıcı tipini simüle ederek sitenizi test edin, kendi markanızla PDF olarak indirin.
        </p>

        {/* Hero Form */}
        <form onSubmit={handleStartAudit} className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-2xl shadow-slate-950/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="url"
                placeholder="Denetlenecek web sitesi URL'si"
                required
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 text-sm transition-all"
              />
            </div>
            <div className="relative">
              <BarChart className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="url"
                placeholder="Rakip URL (Opsiyonel)"
                value={competitorUrl}
                onChange={e => setCompetitorUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 text-sm transition-all"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-base"
          >
            {isLoading ? 'Analiz Başlatılıyor...' : 'Sitenizi Ücretsiz Denetleyin'}
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="text-xs text-slate-500">
            Kredi kartı gerekmez • Hesap açmadan deneyin • Sınırsız ücretsiz temel denetim
          </div>
        </form>
      </section>

      {/* Feature Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900 w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Tek Dashboard'da Tüm Web Denetim Modülleri</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Parça parça araçlar kullanmayı bırakın. WebAudit AI, sitenizi 5 ana katmanda tarar ve raporlar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Tam Kapsamlı SEO</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Başlık, meta açıklamaları, canonicals, H1-H6 hiyerarşisi, broken link tespiti dahil 100'den fazla SEO parametresini denetleyin.</p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">10x AI Persona Simülasyonu</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Farklı yaş, bağlantı hızı ve cihaz tiplerinde 10 farklı yapay zekâ personası ile sayfa deneyimi testi gerçekleştirin.</p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">White-Label PDF Raporları</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Raporları ajansınızın logosu, renkleri ve başlık şemasıyla PDF formatında dışa aktarın. Doğrudan müşteriye sunuma hazır.</p>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">GEO &amp; AI Tarayıcı Uyumluluğu</h3>
            <p className="text-slate-400 text-sm leading-relaxed">llms.txt, JSON-LD şemaları ve E-E-A-T sinyallerini tarayarak ChatGPT, Gemini ve Perplexity'nin sitenizi doğru okumasını sağlayın.</p>
          </div>

          {/* Card 5 */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Siber Güvenlik Denetimi</h3>
            <p className="text-slate-400 text-sm leading-relaxed">SSL/TLS geçerliliği, mixed content ve HSTS, CSP, X-Frame-Options gibi kritik güvenlik başlıklarını test edin.</p>
          </div>

          {/* Card 6 */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Accessibility className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Erişilebilirlik (WCAG 2.1)</h3>
            <p className="text-slate-400 text-sm leading-relaxed">axe-core entegrasyonuyla kontrast oranları, klavye navigasyonu ve ekran okuyucu uyumluluğunu otomatik test edin.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© 2026 WebAudit AI. Tüm hakları saklıdır.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Kullanım Şartları</a>
            <a href="#" className="hover:text-white transition-colors">Gizlilik Politikası</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
