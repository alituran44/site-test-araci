const translations = {
    tr: {
        "nav_hero": "WebPulse Pro",
        "nav_login": "Giriş Yap",
        "nav_register": "Kayıt Ol",
        "nav_logout": "Çıkış Yap",
        "nav_admin": "Admin Paneli",
        "nav_dashboard": "Kontrol Paneli",
        "nav_security": "Güvenlik & Hız",
        "nav_strix": "AI Sızma Testi",
        "hero_title": "Web Sitenizi Saniyeler İçinde Analiz Edin",
        "hero_subtitle": "AI destekli otonom pentest ve SEO denetimi ile rakiplerinizi geride bırakın.",
        "btn_start_audit": "Analizi Başlat",
        "placeholder_url": "https://siteniz.com",
        "strix_title": "AI Destekli Sızma Testi (Pentest)",
        "strix_subtitle": "Strix otonom yapay zeka ajanları ile sitenizin derinliklerine inerek kritik zafiyetleri tespit eder.",
        "btn_strix_start": "Sızma Testini Başlat",
        "modal_login_title": "Hesabınıza Giriş Yapın",
        "modal_reg_title": "Yeni Hesap Oluşturun",
        "modal_email": "E-posta Adresi",
        "modal_pass": "Şifre",
        "modal_btn_login": "Giriş Yap",
        "modal_btn_reg": "Kayıt Ol",
        "modal_btn_google": "Google ile Giriş Yap",
        "modal_no_account": "Hesabınız yok mu? Kayıt Olun",
        "modal_has_account": "Zaten hesabınız var mı? Giriş Yapın",
        "admin_title": "WebPulse Yönetim Paneli"
    },
    en: {
        "nav_hero": "WebPulse Pro",
        "nav_login": "Login",
        "nav_register": "Sign Up",
        "nav_logout": "Logout",
        "nav_admin": "Admin Panel",
        "nav_dashboard": "Dashboard",
        "nav_security": "Security & Speed",
        "nav_strix": "AI Pentest",
        "hero_title": "Analyze Your Website in Seconds",
        "hero_subtitle": "Outperform competitors with AI-powered autonomous pentesting and SEO audits.",
        "btn_start_audit": "Start Audit",
        "placeholder_url": "https://yoursite.com",
        "strix_title": "AI-Powered Penetration Testing",
        "strix_subtitle": "Strix autonomous AI agents dive deep into your site to detect critical vulnerabilities.",
        "btn_strix_start": "Start Penetration Test",
        "modal_login_title": "Sign in to Your Account",
        "modal_reg_title": "Create a New Account",
        "modal_email": "Email Address",
        "modal_pass": "Password",
        "modal_btn_login": "Sign In",
        "modal_btn_reg": "Sign Up",
        "modal_btn_google": "Sign in with Google",
        "modal_no_account": "Don't have an account? Sign Up",
        "modal_has_account": "Already have an account? Sign In",
        "admin_title": "WebPulse Admin Dashboard"
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = translations[currentLang][key];
            } else {
                el.innerText = translations[currentLang][key];
            }
        }
    });
    
    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
        langBtn.innerText = currentLang === 'en' ? '🇹🇷 TR' : '🇬🇧 EN';
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'tr' : 'en';
    localStorage.setItem('lang', currentLang);
    applyTranslations();
}

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    
    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
        langBtn.addEventListener('click', toggleLanguage);
    }
});
