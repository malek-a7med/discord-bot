# 🎵 إعداد Lavalink على Railway

## ما هو Lavalink؟
Lavalink هو سيرفر صوتي مستقل (Java) يتعامل مع تحميل وبث الصوت.  
بدلاً من استخدام yt-dlp في البوت مباشرةً (يتعرّض لـ "Sign in to confirm you're not a bot")،  
يتولى Lavalink ذلك بأساليب أكثر موثوقية.

---

## 🚀 خطوات الإعداد على Railway

### 1️⃣ إنشاء مشروع Lavalink منفصل على Railway

1. اذهب إلى [Railway.app](https://railway.app) وأنشئ **New Project**
2. اختر **Deploy from GitHub Repo** أو **Empty Project**
3. أضف **New Service → Docker**
4. استخدم الملفات الموجودة في مجلد `lavalink/`:
   - `lavalink/Dockerfile`
   - `lavalink/application.yml`

### 2️⃣ ضبط المتغيرات البيئية على Railway (Lavalink Service)

```
LAVALINK_PASSWORD=كلمة_السر_اللي_تختارها
```

### 3️⃣ الحصول على عنوان Lavalink من Railway

بعد Deploy، راجع **Settings → Networking** في Railway للحصول على:
- **Host**: مثل `lavalink.railway.internal` أو عنوان public
- **Port**: `2333` (أو الـ port اللي Railway حدده)

### 4️⃣ ضبط متغيرات البيئة على بوت Discord

في Replit أو Railway (حيث البوت شغّال):

```
LAVALINK_HOST=your-lavalink-service.railway.internal
LAVALINK_PORT=2333
LAVALINK_PASSWORD=كلمة_السر_اللي_اخترتها
LAVALINK_SECURE=false
```

> **ملاحظة:** لو Railway استخدم HTTPS، اضبط `LAVALINK_SECURE=true` والـ port على `443`

---

## 🔧 اختبار الاتصال

بعد الإعداد، شغّل البوت وابحث عن:
```
✅ [Lavalink] Node "MainNode" جاهز!
```

في الـ console. لو ظهرت رسالة خطأ، تحقق من:
- المتغيرات البيئية صح
- Lavalink service شغّال على Railway
- لا يوجد firewall يمنع الاتصال بين الـ services

---

## 📦 متطلبات Lavalink Server

- Java 17+
- RAM: 256MB minimum (512MB recommended)
- الملف: `Lavalink.jar` (يتم تحميله تلقائياً في الـ Dockerfile)

---

## 🌐 Lavalink Plugin للـ YouTube

ملف `application.yml` مُعدَّ لاستخدام **YouTube Plugin** الرسمي من Lavalink.  
هذا يوفّر استخراج صوت YouTube بشكل موثوق بدون bot detection.

Plugin version: `1.13.2` (يمكن تحديثها في `application.yml`)

---

## ❓ مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| `مفيش Lavalink node متاح` | تحقق إن Lavalink service شغّال على Railway |
| `Connection refused` | تحقق من LAVALINK_HOST و LAVALINK_PORT |
| `Unauthorized` | تحقق إن LAVALINK_PASSWORD صح في الجانبين |
| أغنية مش بتشغّل | تحقق من logs Lavalink على Railway |
