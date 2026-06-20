# 🔧 إصلاح مشكلة تكرار الرسائل — بوت زنجي

> **التاريخ:** يونيو 2026
> **المشكلة:** البوت أحياناً بيبعت 2-3 رسايل في نفس الوقت
> **الحالة:** ✅ تم الإصلاح بالكامل

---

## 🔍 السبب الجذري للمشكلة

البوت كان عنده 3 مشاكل متشابكة:

### 1. نظام Single Instance مكسور على Replit
الكود القديم كان بيعمل `process.kill(oldPid, "SIGTERM")` لكن ده **مش بيشتغل cross-container** على ريبلت. يعني لما بيحصل restart، الحاوية القديمة والحديثة بيشتغلوا مع بعض لفترة.

### 2. Race Condition في `claimAiMessage`
الـ read-modify-write على ملف JSON بدون atomic operations. لو نسختين بيقرأوا في نفس اللحظة، كل واحدة بتشوف إن مفيش claim وبتسجل واحد وبترد على الرسالة.

### 3. Dedup مش شامل
الـ `processedMessages` set كان موجود بس للـ `messageCreate`. باقي الأحداث (ترحيب، لوجات، سلام، إلخ) كانت ممكن تتكرر.

---

## ✅ الحل اللي اتعمل

### ملفات جديدة:

| الملف | الوظيفة |
|-------|---------|
| `helpers/single-instance.js` | نظام heartbeat-based lock بيشتغل صح على Replit |
| `helpers/claim-store.js` | نظام claim بـ atomic file writes (temp + rename) |

### ملفات معدلة:

| الملف | التعديلات |
|-------|----------|
| `index.js` | استبدال lock القديم + إضافة claims على كل المسارات |
| `database.js` | (لم يتعدل — لسه شغال للـ backward compat) |

---

## 📋 خطوات النشر على Replit

### 1. رفع الملفات الجديدة
ارفع الملفين الجداد على ريبلت:
- `helpers/single-instance.js`
- `helpers/claim-store.js`

### 2. استبدل `index.js`
استبدل الملف القديم بالنسخة المعدّلة (اللي فيها التعديلات كلها).

### 3. خطوات إضافية مهمة على Replit

#### أ) اعمل "Always On" صح
روح على Replit → Shell → واكتب:
```bash
# امسح أي instance قديم
rm -f /tmp/zangi_bot.lock
```

#### ب) تأكد إن مفيش instances تانية شغالة
- لو عندك البوت شغال على جهازك المحلي + ريبلت = هيحصل تكرار
- **استخدم إما المحلي أو ريبلت، مش الاتنين**

#### ج) تأكد من الـ Replit Deployment Type
روح على **Deployments** → تأكد إن عندك **"Reserved VM"** أو **"Autoscale"** (مش الـ Web Server العادي).
- الـ Reserved VM بيديك instance واحدة ثابتة = أحسن حاجة
- الـ Autoscale بيعمل instances كتير وقت الذروة = ممكن يسبب مشاكل

#### د) الـ Secrets (Environment Variables)
تأكد إن دول موجودين في الـ Secrets:
```
DISCORD_TOKEN=...
GOOGLE_API_KEY=...
```

### 4. شغّل البوت
```bash
node index.js
```

### 5. اختبر
- شوف الـ Console logs. المفروض تشوف:
```
🔒 [Lock] احنا النسخة الشرعية (instanceId=...)
🗂️  [ClaimStore] مهيأ — مسار الملف: ...
```
- شوف الـ `/status` endpoint:
```
GET https://your-repl.your-username.repl.co/status
```
لازم يبان:
```json
{
  "instance": {
    "isPrimary": true,
    "existingLock": { "alive": true, ... }
  }
}
```

---

## 🛡️ الحماية اللي بقت موجودة

### Lock على مستوى العملية الواحدة
- ملف `/tmp/zangi_bot.lock` بيكتب الـ PID + instanceId + heartbeat كل 20 ثانية
- لو لقى ملف lock بقلبه نابض من غيره، بيخرج فوراً
- لو لقى ملف ميت (heartbeat > 60 ثانية)، بياخده

### Claim على مستوى الرسالة الواحدة
- ملف `data/claims-store.json` بيتسجل فيه كل claim
- Atomic write بـ temp + rename (مفيش race condition)
- Coverage لكل مسارات الإرسال:
  - ✅ `messageCreate` (ردود AI)
  - ✅ `interactionCreate` (slash commands + buttons)
  - ✅ `guildMemberAdd` (رسائل الترحيب)
  - ✅ `guildMemberRemove` (رسائل الوداع)
  - ✅ Auto-Mod log channel
  - ✅ رد السلام

### المراقبة
- `/status` endpoint بيعرض حالة الـ lock والـ claims
- Logs واضحة تبين لو حصلت محاولة takeover

---

## 🧪 التحقق من الإصلاح

### 1. اختبار سريع محلياً
```bash
# في terminal 1
node index.js

# في terminal 2 (بعد 5 ثواني)
node index.js

# المفروض الـ terminal 2 يقول: "❌ [Lock] نسخة تانية شغالة... بخلي النسخة دي تخرج"
```

### 2. اختبار race condition
ابعت رسالة في الديسكورد أثناء restart البوت. لازم تشوف رد واحد بس، مش 2-3.

### 3. اختبار الترحيب
لو حد دخل السيرفر وقت restart البوت، لازم يشوف رسالة ترحيب واحدة بس.

---

## ⚠️ ملاحظات مهمة

### لو المشكلة لسه موجودة:
1. **شوف الـ logs** — لو شفت "نسخة تانية شغالة" يبقى الـ lock بيشتغل
2. **شوف الـ `/status`** — لو `isPrimary: false` يبقى في instance تانية شغالة لازم تقفلها
3. **تأكد من Secrets** — لو التوكن اتغير أو اتسرّب ممكن حد تاني شغال بيه

### متى يحدث التكرار بردو؟ (نظرياً)
- لو النسخة القديمة ماتت قبل ما الجديدة تعمل claim على رسالة معينة، والمستخدم بعت الرسالة في تلك اللحظة بالظبط (احتمال ضعيف جداً)
- لو في bug في كود تاني بيستدعي `send()` مرتين في نفس الكود path (ده bug في الكود نفسه، مش في الـ lock)

### البوت ممكن يحصله reconnection
- الـ `client.destroy()` + `client.login()` بيعمل reconnect لو الـ ping وقف
- ده **عادي ومش بيسبب تكرار** بفضل الـ ClaimStore

---

## 📞 لو حصلت مشكلة

1. شوف الـ console logs على ريبلت
2. شوف الـ `/status` endpoint
3. لو محتاج مساعدة،ابعتلي الـ log + الـ status JSON

---

*آخر تحديث: يونيو 2026*