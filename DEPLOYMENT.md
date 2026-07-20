# WebAudit AI – Dağıtım ve Canlandırma Kılavuzu (Deployment Guide)

Bu kılavuz, WebAudit AI monorepo projesinin Git'e yüklenmesi, ön yüzünün (frontend) **Vercel**'de yayınlanması ve arka yüzünün (backend) barındırılması süreçlerini adım adım açıklamaktadır.

---

## 1. Git & GitHub Bağlantısı

Yerel Git deposu başlatılmış ve ilk commit gerçekleştirilmiştir. Kodları kendi GitHub/GitLab deponuza yüklemek için aşağıdaki adımları sırayla izleyin:

```bash
# 1. Kendi GitHub hesabınızda yeni bir boş depo (repository) oluşturun.
# 2. Yerel terminalinizde aşağıdaki komutları çalıştırarak deponuzu bağlayın ve yükleyin:

git remote add origin https://github.com/KULLANICI_ADINIZ/DEPONUZUN_ADI.git
git branch -M main
git push -u origin main
```

---

## 2. Ön Yüz Dağıtımı: Vercel (Next.js)

Vercel, Next.js uygulamaları için mükemmel bir barındırma platformudur. Monorepo yapısı nedeniyle Vercel projenizi yapılandırırken şu adımlara dikkat edin:

1. **Vercel Dashboard**'una gidin ve **"Add New Project"** butonuna tıklayarak GitHub deponuzu seçin.
2. Proje Yapılandırmasında:
   - **Root Directory**: `apps/web` olarak ayarlayın. (Vercel monorepo bağımlılıklarını otomatik olarak pnpm workspaces ile çözecektir).
   - **Framework Preset**: `Next.js` (Otomatik algılanır).
   - **Build Command**: `next build` (Vercel monorepo bağlamında bunu kendisi çözer, ek ayarlamaya gerek yoktur).
3. **Çevre Değişkenleri (Environment Variables)**:
   - `NEXT_PUBLIC_API_URL`: Canlıdaki NestJS API sunucunuzun adresi (Örn: `https://webaudit-api.up.railway.app` veya kendi sunucu adresiniz).
4. **Deploy** butonuna basın.

---

## 3. Arka Yüz Dağıtımı: NestJS API (Railway, Render veya VPS)

NestJS arka yüzünüz; veri tarama (crawler), Lighthouse performans ölçümleri ve Playwright testleri gerçekleştirdiğinden **kesintisiz çalışan (persistent) bir sunucuya** ihtiyaç duyar. Tarayıcı motorlarının kurulabilmesi için arka yüzün Vercel yerine **Railway**, **Render** veya **kendi VPS (Docker)** sunucunuzda barındırılması gerekir.

### Seçenek A: Railway veya Render Üzerinde Yayınlama
1. Railway/Render panelinden yeni bir servis oluşturup deponuzu bağlayın.
2. **Root Directory**: `apps/api` olarak seçin.
3. Çevre Değişkenlerini ekleyin:
   - `DATABASE_URL`: PostgreSQL veri tabanı bağlantı adresi (Prisma için).
   - `REDIS_URL`: BullMQ kuyruğu için Redis bağlantı adresi.
   - `JWT_SECRET`: Güvenli bir JWT anahtarı.
   - `GEMINI_API_KEY`: Google Gemini API anahtarınız.
4. **Build Command**: `pnpm build`
5. **Start Command**: `pnpm start`

### Seçenek B: Docker Compose ile Kendi Sunucunuzda (VPS) Çalıştırma
Proje kök dizininde hazır bulunan `docker-compose.yml` dosyasını kullanarak tüm sistemi tek komutla ayağa kaldırabilirsiniz:

```bash
# Sunucunuza kodları klonladıktan sonra:
docker-compose up -d --build
```
Bu komut; PostgreSQL, Redis, NestJS API ve Next.js Frontend servislerini otomatik olarak derler ve sunucunuzda yayına alır.

---

## 4. Gerekli Çevre Değişkenleri (Cheat Sheet)

### apps/web/.env.local (Frontend)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### apps/api/.env (Backend)
```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/webaudit?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="webaudit-super-secret-key-change-in-prod"
GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
```
