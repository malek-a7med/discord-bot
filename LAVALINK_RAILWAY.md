# 🎵 إعداد Lavalink على Railway — دليل تنفيذي

---

## الخطوة 1 — ارفع ملفات `lavalink/` على GitHub

الـ `railway.json` موجود جوّا مجلد `lavalink/`، فـ Railway محتاج يوصل للملفات دي عبر GitHub.

افتح terminal في Replit وشغّل:

```
git add lavalink/
git commit -m "add lavalink service files"
git push
```

---

## الخطوة 2 — أنشئ Service جديد على Railway

1. افتح [railway.app](https://railway.app) واختر مشروع البوت الموجود (أو أنشئ **New Project**)
2. اضغط **+ New Service**
3. اختر **GitHub Repo**
4. اختر نفس الـ repo بتاع البوت
5. Railway هيسألك **Root Directory** — اكتب:
   ```
   lavalink
   ```
6. هيكتشف الـ `Dockerfile` تلقائياً ويبني منه

---

## الخطوة 3 — ضبط Variables على Lavalink Service

بعد ما تنشئ الـ Service، افتح تبويب **Variables** وأضف:

| Key                 | Value                          |
|---------------------|--------------------------------|
| `LAVALINK_PASSWORD` | اختار كلمة سر قوية مثلاً `zangi_lavalink_2026` |

> **بس كده.** `application.yml` هيقرأها تلقائياً من `${LAVALINK_PASSWORD}`.

اضغط **Deploy** وانتظر — البناء هياخد 3-5 دقايق (بيحمّل `Lavalink.jar` من GitHub).

---

## الخطوة 4 — الحصول على الـ Host الداخلي

بعد ما الـ Service يشتغل:

1. افتح الـ Lavalink Service على Railway
2. اضغط تبويب **Settings**
3. نزّل لـ قسم **Networking**
4. هتلاقي **Private Networking** — اضغط **Enable** لو مش مفعّل
5. هيظهرلك عنوان بالشكل ده:
   ```
   lavalink.railway.internal
   ```
   *(الاسم بيكون اسم الـ Service بالضبط اللي اخترته)*

> ⚠️ **العنوان الداخلي (`railway.internal`) يشتغل فقط لو البوت كمان على Railway.**
> لو البوت على Replit — استخدم الـ **Public Domain** بدله (من نفس قسم Networking → اضغط **Generate Domain**).

---

## الخطوة 5 — أضف Variables على البوت (Replit)

افتح مشروع البوت على Replit ← **Secrets** وأضف:

| Key                 | Value                                        |
|---------------------|----------------------------------------------|
| `LAVALINK_HOST`     | العنوان اللي جبته (internal أو public)       |
| `LAVALINK_PORT`     | `2333`                                       |
| `LAVALINK_PASSWORD` | نفس الكلمة اللي حطّيتها على Railway         |
| `LAVALINK_SECURE`   | `false` (لو public domain غيّره لـ `true`)  |

**مثال لو Public Domain (البوت على Replit):**
```
LAVALINK_HOST=lavalink-production-xxxx.up.railway.app
LAVALINK_PORT=443
LAVALINK_PASSWORD=zangi_lavalink_2026
LAVALINK_SECURE=true
```

**مثال لو Private Network (البوت على Railway):**
```
LAVALINK_HOST=lavalink.railway.internal
LAVALINK_PORT=2333
LAVALINK_PASSWORD=zangi_lavalink_2026
LAVALINK_SECURE=false
```

---

## الخطوة 6 — تحقق إن كل شيء شغّال

شغّل البوت وشوف اللوج — المفروض تشوف:

```
✅ [Lavalink] Node "MainNode" جاهز!
```

لو ما ظهرتش، شوف لوجات Lavalink Service على Railway — أي سطر `ERROR` هيقولك المشكلة.

---

## جدول المشاكل الشائعة

| اللوج                        | السبب                         | الحل                                        |
|------------------------------|-------------------------------|---------------------------------------------|
| `مفيش Lavalink node متاح`   | السيرفر مش شغّال             | تحقق من Deploy على Railway                  |
| `Connection refused`         | Host أو Port غلط             | راجع الـ Variables                          |
| `Unauthorized`               | Password مختلفة              | تأكد إن الكلمة واحدة في الجانبين            |
| البناء فشل على Railway       | مشكلة في تحميل `Lavalink.jar` | شوف Build Logs على Railway                  |

---

## معلومات الملفات المستخدمة

```
lavalink/
├── Dockerfile        → Java 17 Alpine، بيحمّل Lavalink.jar v4.0.8 تلقائياً
├── application.yml   → إعداد السيرفر + YouTube Plugin v1.13.2
└── railway.json      → Railway build config (DOCKERFILE builder)
```

**الـ Dockerfile** بيشغّل Lavalink بـ:
- `-Xmx512m -Xms256m` (RAM)
- YouTube Plugin v1.13.2 (من `application.yml`)
- Port: `2333`

**الـ application.yml** بيستخدم:
- `${LAVALINK_PASSWORD}` من environment variable
- YouTube clients: MUSIC, ANDROID_TESTSUITE, TV_EMBEDDED, WEB, ANDROID
- SoundCloud: **معطّل**
- HTTP sources: مفعّل

---

## ملاحظة على YouTube Plugin

الـ `application.yml` بيحمّل YouTube Plugin تلقائياً عند أول تشغيل:

```yaml
lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.13.2"
```

أول تشغيل هياخد وقت أطول (بيحمّل الـ plugin). انتظر لحد ما اللوج يقول:
```
Lavalink is ready to accept connections.
```
