# IGSaveGo — Instagram & Bluesky Media Downloader

A full-stack React + Express site for downloading public Instagram media (videos,
reels, photos, stories, highlights) in HD, plus public Bluesky (AT Protocol) videos
and images as their original uploads — with programmatic SEO pages, a blog, and an
admin dashboard.

---

## المتطلبات

- Node.js **24.x** (مطلوب بواسطة `engines` في `package.json`)
- npm 10+

## التشغيل المحلي (المعاينة)

```powershell
npm install
npm run dev
```

ثم افتح: **http://localhost:3000**

| الصفحة | الرابط |
| --- | --- |
| الصفحة الرئيسية | http://localhost:3000/ |
| صفحة الأدوات (مثال) | http://localhost:3000/en/video-downloader |
| أداة Bluesky | http://localhost:3000/bluesky-downloader |
| أداة LinkedIn | http://localhost:3000/linkedin-downloader |
| أداة Pinterest | http://localhost:3000/pinterest-downloader |
| أداة Lemon8 | http://localhost:3000/lemon8-downloader |
| أداة Loom | http://localhost:3000/loom-downloader |
| أداة X (Twitter) | http://localhost:3000/twitter-downloader |
| صفحة كلمة مفتاحية | http://localhost:3000/instagram-video-downloader |
| المدونة | http://localhost:3000/blog |
| لوحة التحكم | http://localhost:3000/admin |
| خريطة الموقع | http://localhost:3000/sitemap.xml |

كلمة مرور لوحة التحكم في وضع التطوير: **`admin123`** (يمكن تغييرها عبر
`ADMIN_PASSWORD` في `.env`).

إذا كان المنفذ 3000 مشغولًا:

```powershell
$env:PORT=3001; npm run dev
```

## أوامر أخرى

```bash
npm run lint      # فحص TypeScript (tsc --noEmit)
npm run build     # بناء الواجهة (vite) + الخادم (esbuild) إلى dist/
npm start         # تشغيل نسخة الإنتاج من dist/server.cjs
```

## كيف يعمل محليًا

- `npm run dev` يشغّل `server.ts` عبر `tsx`.
- الخادم يضع **Vite في وضع middleware** داخل Express: نفس المنفذ يخدم الواجهة
  (مع HMR) وواجهات `/api/*` — لا حاجة لتشغيل خادمين.
- في الإنتاج (`NODE_ENV=production`) يخدم Express ملفات `dist/` الثابتة.

## متغيرات البيئة (اختيارية)

يتم تحميل `.env` تلقائيًا. راجع `.env.example` للقائمة الكاملة.

| المتغير | الوظيفة |
| --- | --- |
| `PORT` | منفذ الخادم (افتراضي 3000) |
| `ADMIN_PASSWORD` | كلمة مرور لوحة التحكم (**إلزامية في الإنتاج**) |
| `SESSION_SECRET` | توقيع جلسات الإدارة HMAC (**إلزامي في الإنتاج**) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | صفحات الكلمات المفتاحية، المدونة، وإعدادات اللوحة المشتركة |
| `GEMINI_API_KEY` | زر «توليد بالذكاء الاصطناعي» في اللوحة |
| `RAPIDAPI_KEY` / `COBALT_API_URL` / `IG_SESSIONID` | بدائل اختيارية لاستخراج وسائط إنستقرام |
| `VITE_API_BASE_URL` | فصل الواجهة عن الخادم (Vercel + خادم منفصل) |

أداة Bluesky لا تحتاج أي مفتاح أو حساب: تستخدم نقاط النهاية العامة لـ AT Protocol
(`public.api.bsky.app` ثم `com.atproto.sync.getBlob` على خادم بيانات المؤلف).

بدون Supabase سيعمل الموقع بالبيانات الافتراضية المدمجة، وستظهر في الطرفية
استجابات `503` متوقعة من `/api/site-settings` و`/api/keyword-pages`
و`/api/guides` — هذا سلوك طبيعي وليس خطأً.

## بنية المشروع

```
server.ts              خادم Express: استخراج، بروكسي وسائط، إدارة، SEO، Vite middleware
src/                   واجهة React (المكونات، الخدمات، بيانات i18n وSEO)
lib/                   Supabase admin + مولّد sitemap + استخراج Bluesky المشترك
api/                   دوال Vercel (نسخة من نفس نقاط النهاية)
functions/             دوال Netlify/Cloudflare (middleware + API)
supabase/*.sql         مخطط قاعدة البيانات
public/                robots.txt, _headers, _redirects, أيقونة الموقع
```

## ملاحظات الأمان

- في الإنتاج يرفض الخادم الإقلاع بدون `ADMIN_PASSWORD` و`SESSION_SECRET`.
- بروكسي الوسائط يمنع SSRF (قائمة نطاقات CDN مسموحة فقط + إعادة تحقق من كل redirect).
- جلسات الإدارة موقّعة بـ HMAC-SHA256 وصلاحيتها 24 ساعة.
- حدود معدل الطلبات لكل IP على نقاط الاستخراج/البروكسي/تسجيل الدخول/الذكاء الاصطناعي.
