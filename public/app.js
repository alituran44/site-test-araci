document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const analyzeForm = document.getElementById('analyze-form');
    const targetUrlInput = document.getElementById('target-url');
    const competitorUrlInput = document.getElementById('competitor-url');
    const submitBtn = document.getElementById('submit-btn');
    const loader = document.getElementById('loader');
    const dashboard = document.getElementById('dashboard');

    // Settings Modal DOM Elements
    const settingsModal = document.getElementById('settings-modal');
    const btnSettingsTrigger = document.getElementById('btn-settings-trigger');
    const btnCloseSettings = document.getElementById('close-settings');
    const btnSaveSettings = document.getElementById('save-settings');
    const userGeminiKeyInput = document.getElementById('user-gemini-key');
    const userPageSpeedKeyInput = document.getElementById('user-pagespeed-key');
    const userLocalApiUrlInput = document.getElementById('user-local-api-url');
    const userOpenRouterKeyInput = document.getElementById('user-openrouter-key');
    const userOpenRouterModelInput = document.getElementById('user-openrouter-model');

    // Load saved API Keys from localStorage
    if (userGeminiKeyInput) userGeminiKeyInput.value = localStorage.getItem('user_gemini_key') || '';
    if (userPageSpeedKeyInput) userPageSpeedKeyInput.value = localStorage.getItem('user_pagespeed_key') || '';
    if (userLocalApiUrlInput) userLocalApiUrlInput.value = localStorage.getItem('user_local_api_url') || 'http://localhost:11434/v1';
    if (userOpenRouterKeyInput) userOpenRouterKeyInput.value = localStorage.getItem('user_openrouter_key') || '';
    if (userOpenRouterModelInput) userOpenRouterModelInput.value = localStorage.getItem('user_openrouter_model') || 'deepseek/deepseek-chat';

    // Settings Modal Event Listeners
    if (btnSettingsTrigger && settingsModal) {
        btnSettingsTrigger.addEventListener('click', () => {
            settingsModal.classList.add('open');
        });
    }
    if (btnCloseSettings && settingsModal) {
        btnCloseSettings.addEventListener('click', () => {
            settingsModal.classList.remove('open');
        });
    }
    if (btnSaveSettings && settingsModal) {
        btnSaveSettings.addEventListener('click', () => {
            localStorage.setItem('user_gemini_key', userGeminiKeyInput.value.trim());
            localStorage.setItem('user_pagespeed_key', userPageSpeedKeyInput.value.trim());
            if (userLocalApiUrlInput) {
                localStorage.setItem('user_local_api_url', userLocalApiUrlInput.value.trim());
            }
            if (userOpenRouterKeyInput) {
                localStorage.setItem('user_openrouter_key', userOpenRouterKeyInput.value.trim());
            }
            if (userOpenRouterModelInput) {
                localStorage.setItem('user_openrouter_model', userOpenRouterModelInput.value.trim());
            }
            settingsModal.classList.remove('open');
            alert('Ayarlar başarıyla kaydedildi!');
        });
    }
    
    // Tab Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Sidebar Settings Trigger
    const btnSidebarSettingsTrigger = document.getElementById('sidebar-settings-trigger');
    if (btnSidebarSettingsTrigger && settingsModal) {
        btnSidebarSettingsTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            settingsModal.classList.add('open');
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const tabId = item.getAttribute('data-tab');
            if (!tabId) return; // settings gibi tab olmayanlar için iptal et
            
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            item.classList.add('active');
            const targetPanel = document.getElementById(`tab-${tabId}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // Helper function for triggers
    async function startAnalysis(url, competitorUrl, selectedModel, selectedTool, formSubmitBtn) {
        if (!url) return;

        // Reset UI States
        loader.classList.remove('hidden');
        if (formSubmitBtn) {
            formSubmitBtn.disabled = true;
            const btnText = formSubmitBtn.querySelector('span');
            if (btnText) btnText.textContent = 'Analiz Ediliyor...';
        }
        document.getElementById('pdf-export-container').classList.add('hidden');

        try {
            let apiPath = `/api/analyze?url=${encodeURIComponent(url)}&model=${selectedModel}&tools=${selectedTool}`;
            if (competitorUrl) {
                apiPath += `&competitorUrl=${encodeURIComponent(competitorUrl)}`;
            }

            const response = await fetch(apiPath, {
                headers: {
                    'X-Gemini-Key': localStorage.getItem('user_gemini_key') || '',
                    'X-PageSpeed-Key': localStorage.getItem('user_pagespeed_key') || '',
                    'X-Local-Api-Url': localStorage.getItem('user_local_api_url') || '',
                    'X-OpenRouter-Key': localStorage.getItem('user_openrouter_key') || '',
                    'X-OpenRouter-Model': localStorage.getItem('user_openrouter_model') || ''
                }
            });
            const data = await response.json();

            if (!data.success) {
                alert(`Hata: ${data.error || 'Analiz başarısız oldu.'}`);
                // Re-enable trigger
                if (formSubmitBtn) {
                    formSubmitBtn.disabled = false;
                    const btnText = formSubmitBtn.querySelector('span');
                    if (btnText) btnText.textContent = 'Analiz Et';
                }
                loader.classList.add('hidden');
                return;
            }

            // Exit funnel mode, activate dashboard layout
            document.body.className = 'dashboard-mode';
            const overviewTab = document.querySelector('[data-tab="overview"]');
            if (overviewTab) overviewTab.click();

            // Populate Report data
            populateDashboard(data.main);
            
            // Set up simulator
            setupSimulator(url);

            // Set up competitor comparison
            setupCompetitor(data.main, data.competitor);

            // Show dashboard and metrics
            document.querySelector('.scores-container').classList.remove('hidden');
            document.getElementById('critical-warnings-card').classList.remove('hidden');
            document.getElementById('pdf-export-container').classList.remove('hidden');

        } catch (error) {
            console.error(error);
            alert(`Hata: ${error.message || 'Analiz sırasında beklenmeyen bir hata oluştu.'}`);
        } finally {
            loader.classList.add('hidden');
            if (formSubmitBtn) {
                formSubmitBtn.disabled = false;
                const btnText = formSubmitBtn.querySelector('span');
                if (btnText) btnText.textContent = 'Analiz Et';
            }
        }
    }

    // Form Submit 1: Sticky Header Form
    if (analyzeForm) {
        analyzeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = targetUrlInput.value.trim();
            const competitorUrl = competitorUrlInput.value.trim();
            const modelSelect = document.getElementById('model-select');
            const selectedModel = modelSelect ? modelSelect.value : 'gemini-flash-latest';
            const toolSelect = document.getElementById('tool-select');
            const selectedTool = toolSelect ? toolSelect.value : 'both';
            await startAnalysis(url, competitorUrl, selectedModel, selectedTool, submitBtn);
        });
    }

    // Form Submit 2: Hero Page Form
    const analyzeFormHero = document.getElementById('analyze-form-hero');
    if (analyzeFormHero) {
        analyzeFormHero.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('target-url-hero').value.trim();
            const competitorUrl = document.getElementById('competitor-url-hero').value.trim();
            const selectedModel = document.getElementById('model-select-hero').value;
            const selectedTool = document.getElementById('tool-select-hero').value;
            const submitBtnHero = document.getElementById('submit-btn-hero');
            await startAnalysis(url, competitorUrl, selectedModel, selectedTool, submitBtnHero);
        });
    }

    // Populate Dashboard Data
    function populateDashboard(data) {
        if (!data.success) {
            alert(`Sitenin ana sayfası yüklenemedi: ${data.error}`);
            return;
        }

        // Show/hide fallback banner
        const fallbackBanner = document.getElementById('fallback-warning-banner');
        if (fallbackBanner) {
            if (data.aiAnalysis && data.aiAnalysis.isMock) {
                fallbackBanner.classList.remove('hidden');
            } else {
                fallbackBanner.classList.add('hidden');
            }
        }

        const metrics = data.metrics;

        // 1. Genel Puan Hesaplama
        const overallScore = Math.round(
            (metrics.seo.score + 
             metrics.performance.score + 
             metrics.security.score + 
             metrics.accessibility.score + 
             metrics.geo.score) / 5
        );

        // Update Overall Puan (Gauge)
        const scoreValEl = document.getElementById('overall-score-val');
        const gaugeFill = document.getElementById('overall-gauge-fill');
        
        scoreValEl.textContent = overallScore;
        gaugeFill.setAttribute('stroke-dasharray', `${overallScore}, 100`);
        
        // Gauge rengini puana göre değiştir
        if (overallScore >= 80) {
            gaugeFill.style.stroke = 'var(--color-emerald)';
        } else if (overallScore >= 50) {
            gaugeFill.style.stroke = 'var(--color-amber)';
        } else {
            gaugeFill.style.stroke = 'var(--color-rose)';
        }

        // Update Mini Bars & Badges
        const scoreCategories = ['seo', 'performance', 'security', 'accessibility', 'geo'];
        scoreCategories.forEach(cat => {
            const score = metrics[cat].score;
            // Bar width
            const bar = document.getElementById(`bar-${cat}`);
            if (bar) {
                bar.style.width = `${score}%`;
                if (score >= 80) bar.style.backgroundColor = 'var(--color-emerald)';
                else if (score >= 50) bar.style.backgroundColor = 'var(--color-amber)';
                else bar.style.backgroundColor = 'var(--color-rose)';
            }
            // Text values
            const valEl = document.getElementById(`val-${cat}`);
            if (valEl) valEl.textContent = `${score}/100`;
            // Badges
            const badge = document.getElementById(`badge-${cat}`);
            if (badge) {
                badge.textContent = `${score}/100`;
                if (score >= 80) badge.style.borderColor = 'var(--color-emerald)';
                else if (score >= 50) badge.style.borderColor = 'var(--color-amber)';
                else badge.style.borderColor = 'var(--color-rose)';
            }
        });

        // 2. Kritik Hatalar
        const criticalList = document.getElementById('critical-warnings-list');
        criticalList.innerHTML = '';
        let errorCount = 0;

        scoreCategories.forEach(cat => {
            metrics[cat].items.forEach(item => {
                if (item.status === 'error' && errorCount < 6) {
                    const li = document.createElement('li');
                    li.className = 'error-item';
                    li.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>[${cat.toUpperCase()}] ${item.text}</span>
                    `;
                    criticalList.appendChild(li);
                    errorCount++;
                }
            });
        });

        if (errorCount === 0) {
            criticalList.innerHTML = `
                <li class="success-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Kritik bir hata tespit edilmedi! Siteniz temel standartlara uygundur.</span>
                </li>
            `;
        }

        // 3. SEO Detayları Doldurma
        const seoDet = metrics.seo.details;
        document.getElementById('preview-title').textContent = seoDet.title || 'Başlık Tanımlanmamış!';
        document.getElementById('preview-url').textContent = data.url;
        document.getElementById('preview-desc').textContent = seoDet.description || 'Arama motoru açıklaması eksik. Bu sitenizin tıklanma oranını düşürebilir.';
        document.getElementById('seo-canonical').textContent = seoDet.canonical || 'Eksik';
        document.getElementById('seo-wordcount').textContent = seoDet.wordCount || 0;

        // Headings Hierarchy list
        const headingsList = document.getElementById('seo-headings-list');
        headingsList.innerHTML = '';
        let hasHeadings = false;
        
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            if (seoDet.headings && seoDet.headings[tag]) {
                seoDet.headings[tag].forEach(text => {
                    hasHeadings = true;
                    const div = document.createElement('div');
                    div.className = 'headings-row';
                    div.innerHTML = `
                        <span class="tag-badge tag-${tag}">${tag.toUpperCase()}</span>
                        <span>${escapeHtml(text)}</span>
                    `;
                    headingsList.appendChild(div);
                });
            }
        });

        if (!hasHeadings) {
            headingsList.innerHTML = '<p class="text-error">Sayfa içerisinde H1-H6 başlık yapısı bulunamadı.</p>';
        }

        // Keywords table
        const keywordsBody = document.getElementById('seo-keywords-table');
        keywordsBody.innerHTML = '';
        if (seoDet.topKeywords && seoDet.topKeywords.length > 0) {
            seoDet.topKeywords.forEach(kw => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(kw.word)}</strong></td>
                    <td>${kw.count}</td>
                    <td>${kw.density}</td>
                `;
                keywordsBody.appendChild(tr);
            });
        } else {
            keywordsBody.innerHTML = '<tr><td colspan="3" class="text-muted">Anahtar kelime verisi toplanamadı.</td></tr>';
        }

        // SEO Checklist
        renderChecklist('seo-checklist', metrics.seo.items);

        // 4. Performans Detayları
        const perfDet = metrics.performance.details;
        document.getElementById('perf-loadtime').textContent = `${perfDet.loadTimeMs} ms`;
        document.getElementById('perf-cdn').textContent = perfDet.cdn;
        document.getElementById('perf-compression').textContent = perfDet.compression;
        document.getElementById('perf-css-count').textContent = perfDet.cssCount;
        document.getElementById('perf-js-count').textContent = perfDet.jsCount;
        document.getElementById('perf-blocking-count').textContent = perfDet.renderBlocking;
        document.getElementById('perf-lazy-images').textContent = `${perfDet.lazyImages} / ${seoDet.totalImages || 0}`;

        renderChecklist('performance-checklist', metrics.performance.items);

        // Google PageSpeed & Core Web Vitals Render
        const ps = data.pageSpeed;
        if (ps && ps.success) {
            document.getElementById('vitals-lcp').textContent = ps.vitals.lcp;
            document.getElementById('vitals-cls').textContent = ps.vitals.cls;
            document.getElementById('vitals-tbt').textContent = ps.vitals.tbt;
            document.getElementById('vitals-speedindex').textContent = ps.vitals.speedIndex;
            
            // Puan göstergelerinin renklerini PageSpeed sonuçlarına göre dinamik ayarlayalım
            const lcpSec = parseFloat(ps.vitals.lcp);
            const lcpEl = document.getElementById('vitals-lcp');
            if (lcpEl && !isNaN(lcpSec)) {
                if (lcpSec <= 2.5) lcpEl.style.color = 'var(--color-emerald)';
                else if (lcpSec <= 4.0) lcpEl.style.color = 'var(--color-amber)';
                else lcpEl.style.color = 'var(--color-rose)';
            }
        } else {
            const reason = (ps && ps.error) ? 'Ölçülemedi (CrUX verisi mevcut değil / düşük trafik)' : 'Seçilmedi';
            document.getElementById('vitals-lcp').textContent = reason;
            document.getElementById('vitals-cls').textContent = reason;
            document.getElementById('vitals-tbt').textContent = reason;
            document.getElementById('vitals-speedindex').textContent = reason;
        }

        // 5. Güvenlik Detayları
        const secDet = metrics.security.details;
        const sslBox = document.getElementById('sec-ssl-status');
        if (secDet.https) {
            sslBox.className = 'alert-box success';
            sslBox.innerHTML = `<strong>Güvenli Bağlantı (HTTPS):</strong> Bağlantınız şifrelidir (HTTPS aktif).`;
        } else {
            sslBox.className = 'alert-box danger';
            sslBox.innerHTML = `<strong>Güvenlik Riski (HTTP):</strong> SSL sertifikası bulunamadı. Güvenlik için acilen SSL kurulumu gereklidir.`;
        }
        document.getElementById('sec-cors').textContent = secDet.cors;
        document.getElementById('sec-cookies').textContent = secDet.cookiesCount;

        // Security headers badges
        const headersGrid = document.getElementById('sec-headers-grid');
        headersGrid.innerHTML = '';
        const allHeaders = ['CSP', 'HSTS', 'X-Frame', 'X-Content', 'Referrer', 'Permissions'];
        allHeaders.forEach(h => {
            const div = document.createElement('div');
            const isActive = secDet.activeHeaders.includes(h);
            div.className = `badge-item ${isActive ? 'active' : 'inactive'}`;
            div.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height:14px;">
                    ${isActive ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
                </svg>
                <span>${h}</span>
            `;
            headersGrid.appendChild(div);
        });

        renderChecklist('security-checklist', metrics.security.items);

        // 6. Erişilebilirlik
        const accDet = metrics.accessibility.details;
        document.getElementById('acc-lang').textContent = accDet.lang;
        document.getElementById('acc-inputs').textContent = accDet.totalInputs;
        document.getElementById('acc-undoc-inputs').textContent = accDet.undocumentedInputs;
        document.getElementById('acc-aria').textContent = accDet.ariaElements;

        renderChecklist('accessibility-checklist', metrics.accessibility.items);

        // 7. GEO & AI Dostu Yapı
        const geoDet = metrics.geo.details;
        document.getElementById('geo-semantics').textContent = geoDet.usedSemantics.join(', ') || 'Yok';
        document.getElementById('geo-eeat').textContent = geoDet.foundEeatKeywords.join(', ') || 'Yok';
        document.getElementById('geo-paragraphs').textContent = geoDet.totalParagraphs;
        document.getElementById('geo-long-paragraphs').textContent = geoDet.longParagraphs;

        // Schema Badges
        const schemaGrid = document.getElementById('geo-schemas-list');
        schemaGrid.innerHTML = '';
        if (geoDet.schemasTypes && geoDet.schemasTypes.length > 0) {
            // Tekilleştirelim
            const uniqueSchemas = [...new Set(geoDet.schemasTypes)];
            uniqueSchemas.forEach(s => {
                const div = document.createElement('div');
                div.className = 'badge-item active';
                div.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height:14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>${escapeHtml(s)}</span>
                `;
                schemaGrid.appendChild(div);
            });
        } else {
            schemaGrid.innerHTML = '<span class="text-error">Schema (JSON-LD) bulunamadı.</span>';
        }

        renderChecklist('geo-checklist', metrics.geo.items);

        // 8. Yapay Zeka (AI) Analiz Verileri
        const ai = data.aiAnalysis;
        const aiStatusBox = document.getElementById('ai-status-box');
        
        if (ai) {
            if (ai.error) {
                aiStatusBox.className = 'alert-box danger';
                aiStatusBox.innerHTML = `<strong>AI Motor Hatası:</strong> Gemini API çağrısı sırasında bir sorun oluştu. Detay: ${ai.error}`;
            } else if (ai.isMock) {
                aiStatusBox.className = 'alert-box warning';
                aiStatusBox.innerHTML = `<strong>Heuristic Analiz Aktif:</strong> Sunucuda <code>GEMINI_API_KEY</code> tanımlı olmadığı için yerel akıllı kural motoru (Heuristics Engine) çalıştırıldı. Gemini API'nin tam analizi için ortam değişkenini ekleyin.`;
            } else {
                aiStatusBox.className = 'alert-box success';
                aiStatusBox.innerHTML = `<strong>Gemini AI Aktif:</strong> Sitenin kod kalitesi ve kullanıcı deneyimi Google Gemini 1.5 Flash yapay zekası tarafından başarıyla incelendi.`;
            }

            // Skorlar ve Yorumlar
            document.getElementById('ai-code-score').textContent = `${ai.codeAnalysis.score}/100`;
            document.getElementById('ai-code-review').textContent = ai.codeAnalysis.review;
            
            document.getElementById('ai-ux-score').textContent = `${ai.uxAnalysis.score}/100`;
            document.getElementById('ai-ux-review').textContent = ai.uxAnalysis.review;

            // Kod Önerileri
            const codeSugList = document.getElementById('ai-code-suggestions');
            codeSugList.innerHTML = '';
            ai.codeAnalysis.suggestions.forEach(sug => {
                const li = document.createElement('li');
                li.className = 'warning-item';
                li.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon"><path d="M9.663 17h4.673M12 3v1m6.364.636l-.707.707M21 12h-1M4 12H3M5.636 5.636l.707.707M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"/></svg>
                    <span>${escapeHtml(sug)}</span>
                `;
                codeSugList.appendChild(li);
            });

            // UX Önerileri
            const uxSugList = document.getElementById('ai-ux-suggestions');
            uxSugList.innerHTML = '';
            ai.uxAnalysis.suggestions.forEach(sug => {
                const li = document.createElement('li');
                li.className = 'warning-item';
                li.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>
                    <span>${escapeHtml(sug)}</span>
                `;
                uxSugList.appendChild(li);
            });

            // Kritik Eksiklikler
            const critList = document.getElementById('ai-critical-missing');
            critList.innerHTML = '';
            ai.missingItems.critical.forEach(item => {
                const li = document.createElement('li');
                li.className = 'error-item';
                li.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>${escapeHtml(item)}</span>
                `;
                critList.appendChild(li);
            });

            // GEO ve AI Arama İyileştirmeleri
            const geoList = document.getElementById('ai-geo-missing');
            geoList.innerHTML = '';
            ai.missingItems.seo_geo.forEach(item => {
                const li = document.createElement('li');
                li.className = 'warning-item';
                li.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
                    <span>${escapeHtml(item)}</span>
                `;
                geoList.appendChild(li);
            });
        } else {
            aiStatusBox.className = 'alert-box warning';
            aiStatusBox.innerHTML = `<strong>AI Analizi Yapılmadı:</strong> Bu test çalıştırmasında sadece teknik metrikler seçildi. Yapay Zeka (AI) yorumlarını ve analizlerini görmek için üst formdan 'Tüm Analizler' veya 'Sadece Gemini AI Raporu' seçeneğini işaretleyip testi yeniden başlatın.`;

            document.getElementById('ai-code-score').textContent = `-`;
            document.getElementById('ai-code-review').textContent = 'Bu analiz yöntemi seçilmedi.';
            
            document.getElementById('ai-ux-score').textContent = `-`;
            document.getElementById('ai-ux-review').textContent = 'Bu analiz yöntemi seçilmedi.';

            document.getElementById('ai-code-suggestions').innerHTML = '<li class="warning-item"><span>Seçilmedi.</span></li>';
            document.getElementById('ai-ux-suggestions').innerHTML = '<li class="warning-item"><span>Seçilmedi.</span></li>';
            document.getElementById('ai-critical-missing').innerHTML = '<li class="error-item"><span>Seçilmedi.</span></li>';
            document.getElementById('ai-geo-missing').innerHTML = '<li class="warning-item"><span>Seçilmedi.</span></li>';
        }

        // 9. popjam.io tarzı 10x AI Persona Kullanıcı Testi Sonuçları
        const personaGrid = document.getElementById('persona-grid');
        if (personaGrid) {
            personaGrid.innerHTML = '';
            if (ai && ai.personaAnalysis && ai.personaAnalysis.length > 0) {
                ai.personaAnalysis.forEach((pers, idx) => {
                    // Cihaza göre uygun simge
                    const deviceIcon = pers.device.toLowerCase().includes('mobile') 
                        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: var(--text-muted);"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
                        : pers.device.toLowerCase().includes('tablet')
                        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: var(--text-muted);"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
                        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: var(--text-muted);"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

                    const card = document.createElement('div');
                    card.className = 'report-card';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                    card.style.gap = '12px';
                    card.style.padding = '16px';
                    card.style.boxShadow = '0 4px 15px rgba(15, 23, 42, 0.02)';

                    card.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background-color: var(--bg-primary); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--color-emerald); font-size: 13px;">
                                    ${pers.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                    <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${escapeHtml(pers.name)} (${pers.age})</div>
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${escapeHtml(pers.role)}</div>
                                </div>
                            </div>
                            <div style="padding: 4px 8px; border-radius: 6px; font-size: 13px; font-weight: bold; border: 1px solid ${pers.score >= 8 ? 'var(--color-emerald)' : pers.score >= 5 ? 'var(--color-amber)' : 'var(--color-rose)'}; color: ${pers.score >= 8 ? 'var(--color-emerald)' : pers.score >= 5 ? 'var(--color-amber)' : 'var(--color-rose)'};">
                                ${pers.score}/10
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); padding: 6px 0;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                ${deviceIcon}
                                <span>${escapeHtml(pers.device)}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: var(--text-muted);"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                                <span>${escapeHtml(pers.speed)}</span>
                            </div>
                        </div>
                        <div style="font-size: 13px; line-height: 1.5; color: var(--text-secondary); background-color: var(--bg-primary); padding: 10px; border-radius: 8px; font-style: italic;">
                            "${escapeHtml(pers.comment)}"
                        </div>
                    `;
                    personaGrid.appendChild(card);
                });
            } else {
                personaGrid.innerHTML = `
                    <div class="welcome-card" style="grid-column: 1 / -1; width: 100%;">
                        <p>Bu test metodunu incelemek için lütfen geçerli bir yapay zeka analizini tetikleyin.</p>
                    </div>
                `;
            }
        }
    }

    // Render Checklist (Shared helper)
    function renderChecklist(elementId, items) {
        const list = document.getElementById(elementId);
        list.innerHTML = '';

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = `${item.status}-item`;
            
            let iconPath = '';
            if (item.status === 'success') {
                iconPath = '<polyline points="20 6 9 17 4 12"/>';
            } else if (item.status === 'warning') {
                iconPath = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
            } else {
                iconPath = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
            }

            li.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon">${iconPath}</svg>
                <span>${escapeHtml(item.text)}</span>
            `;
            list.appendChild(li);
        });
    }

    // 8. Cihaz Simülatörü Mantığı
    let isLandscape = false;
    let activeWidth = 375;
    let activeHeight = 667;

    function setupSimulator(url) {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const iframe = document.getElementById('simulator-iframe');
        iframe.src = proxyUrl;
    }

    const simButtons = document.querySelectorAll('.sim-btn');
    const viewportContainer = document.getElementById('viewport-container');
    const simActiveName = document.getElementById('sim-active-name');
    const simActiveOrientation = document.getElementById('sim-active-orientation');
    const rotateBtn = document.getElementById('sim-rotate-btn');

    simButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            simButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            activeWidth = parseInt(btn.getAttribute('data-width'), 10);
            activeHeight = parseInt(btn.getAttribute('data-height'), 10);
            simActiveName.textContent = btn.getAttribute('data-name');
            
            updateSimulatorDimensions();
        });
    });

    rotateBtn.addEventListener('click', () => {
        isLandscape = !isLandscape;
        simActiveOrientation.textContent = isLandscape ? 'Yatay (Landscape)' : 'Dikey (Portrait)';
        updateSimulatorDimensions();
    });

    function updateSimulatorDimensions() {
        let w = activeWidth;
        let h = activeHeight;
        
        if (isLandscape) {
            w = activeHeight;
            h = activeWidth;
        }

        viewportContainer.style.width = `${w}px`;
        viewportContainer.style.height = `${h}px`;
    }

    // 9. Rakip Karşılaştırma Analizi
    function setupCompetitor(main, competitor) {
        const emptyState = document.getElementById('competitor-empty-state');
        const comparisonCard = document.getElementById('competitor-comparison-card');
        const tableBody = document.getElementById('competitor-table-body');
        
        if (!competitor) {
            emptyState.classList.remove('hidden');
            comparisonCard.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        comparisonCard.classList.remove('hidden');

        document.getElementById('comp-label-main').textContent = getHostname(main.url);
        document.getElementById('comp-label-competitor').textContent = getHostname(competitor.url);

        const mainOverall = calculateOverall(main.metrics);
        const compOverall = calculateOverall(competitor.metrics);

        const compRows = [
            { label: 'Genel Puan', mVal: `${mainOverall}/100`, cVal: `${compOverall}/100`, comp: mainOverall - compOverall },
            { label: 'SEO Puanı', mVal: `${main.metrics.seo.score}/100`, cVal: `${competitor.metrics.seo.score}/100`, comp: main.metrics.seo.score - competitor.metrics.seo.score },
            { label: 'Performans Puanı', mVal: `${main.metrics.performance.score}/100`, cVal: `${competitor.metrics.performance.score}/100`, comp: main.metrics.performance.score - competitor.metrics.performance.score },
            { label: 'Güvenlik Puanı', mVal: `${main.metrics.security.score}/100`, cVal: `${competitor.metrics.security.score}/100`, comp: main.metrics.security.score - competitor.metrics.security.score },
            { label: 'Erişilebilirlik Puanı', mVal: `${main.metrics.accessibility.score}/100`, cVal: `${competitor.metrics.accessibility.score}/100`, comp: main.metrics.accessibility.score - competitor.metrics.accessibility.score },
            { label: 'GEO / AI Dostu Puanı', mVal: `${main.metrics.geo.score}/100`, cVal: `${competitor.metrics.geo.score}/100`, comp: main.metrics.geo.score - competitor.metrics.geo.score },
            { label: 'Yapay Zeka (AI) Kod Kalite Puanı', mVal: main.aiAnalysis ? `${main.aiAnalysis.codeAnalysis.score}/100` : '-', cVal: competitor.aiAnalysis ? `${competitor.aiAnalysis.codeAnalysis.score}/100` : '-', comp: (main.aiAnalysis && competitor.aiAnalysis) ? main.aiAnalysis.codeAnalysis.score - competitor.aiAnalysis.codeAnalysis.score : undefined },
            { label: 'Yapay Zeka (AI) UX Puanı', mVal: main.aiAnalysis ? `${main.aiAnalysis.uxAnalysis.score}/100` : '-', cVal: competitor.aiAnalysis ? `${competitor.aiAnalysis.uxAnalysis.score}/100` : '-', comp: (main.aiAnalysis && competitor.aiAnalysis) ? main.aiAnalysis.uxAnalysis.score - competitor.aiAnalysis.uxAnalysis.score : undefined },
            { label: 'Sunucu Yanıt Süresi', mVal: `${main.metrics.performance.details.loadTimeMs} ms`, cVal: `${competitor.metrics.performance.details.loadTimeMs} ms`, comp: competitor.metrics.performance.details.loadTimeMs - main.metrics.performance.details.loadTimeMs }, // Düşük zaman daha iyi
            { label: 'Google LCP (Yükleme Hızı)', mVal: (main.pageSpeed && main.pageSpeed.success) ? main.pageSpeed.vitals.lcp : '-', cVal: (competitor.pageSpeed && competitor.pageSpeed.success) ? competitor.pageSpeed.vitals.lcp : '-', isBool: true },
            { label: 'Google CLS (Düzen Kayması)', mVal: (main.pageSpeed && main.pageSpeed.success) ? main.pageSpeed.vitals.cls : '-', cVal: (competitor.pageSpeed && competitor.pageSpeed.success) ? competitor.pageSpeed.vitals.cls : '-', isBool: true },
            { label: 'Google TBT (Engelleme)', mVal: (main.pageSpeed && main.pageSpeed.success) ? main.pageSpeed.vitals.tbt : '-', cVal: (competitor.pageSpeed && competitor.pageSpeed.success) ? competitor.pageSpeed.vitals.tbt : '-', isBool: true },
            { label: 'Sayfa Kelime Sayısı', mVal: main.metrics.seo.details.wordCount || 0, cVal: competitor.metrics.seo.details.wordCount || 0, comp: (main.metrics.seo.details.wordCount || 0) - (competitor.metrics.seo.details.wordCount || 0) },
            { label: 'Schema.org Nesne Sayısı', mVal: main.metrics.seo.details.schemasCount || 0, cVal: competitor.metrics.seo.details.schemasCount || 0, comp: (main.metrics.seo.details.schemasCount || 0) - (competitor.metrics.seo.details.schemasCount || 0) },
            { label: 'SSL Durumu', mVal: main.metrics.security.details.https ? 'Aktif (Güvenli)' : 'Eksik', cVal: competitor.metrics.security.details.https ? 'Aktif (Güvenli)' : 'Eksik', isBool: true }
        ];

        tableBody.innerHTML = '';
        compRows.forEach(row => {
            const tr = document.createElement('tr');
            
            let badgeClass = '';
            let compareSymbol = '';
            
            if (!row.isBool && row.comp !== undefined) {
                if (row.comp > 0) {
                    badgeClass = 'text-success';
                    compareSymbol = ` (+${row.comp})`;
                } else if (row.comp < 0) {
                    badgeClass = 'text-error';
                    compareSymbol = ` (${row.comp})`;
                }
            }

            tr.innerHTML = `
                <td><strong>${row.label}</strong></td>
                <td>${row.mVal} <span class="${badgeClass}">${compareSymbol}</span></td>
                <td>${row.cVal}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Helper functions
    function calculateOverall(metrics) {
        return Math.round(
            (metrics.seo.score + 
             metrics.performance.score + 
             metrics.security.score + 
             metrics.accessibility.score + 
             metrics.geo.score) / 5
        );
    }

    function getHostname(urlStr) {
        try {
            const url = new URL(urlStr);
            return url.hostname;
        } catch (e) {
            return urlStr;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // PDF Rapor Export Event Listener
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        window.print();
    });

    // FAQ Accordion Toggle Logic
    const accordionTriggers = document.querySelectorAll('.accordion-trigger');
    accordionTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const item = trigger.parentElement;
            const content = item.querySelector('.accordion-content');
            const isActive = item.classList.contains('active');
            
            // Close all items
            document.querySelectorAll('.accordion-item').forEach(accItem => {
                accItem.classList.remove('active');
                accItem.querySelector('.accordion-content').style.maxHeight = null;
            });
            
            if (!isActive) {
                item.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });
});
