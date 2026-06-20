# 🤖 دليل بوت زنجي — توثيق شامل لـ Minimax Agent

---

## 📌 نظرة عامة

**اسم البوت:** زنجي  
**المنصة:** Discord  
**المكتبة:** discord.js v14/v15 (ESM)  
**اللغة:** Node.js (ES Modules — `import/export`)  
**ملف الدخول الرئيسي:** `index.js` (~4460 سطر)  
**قاعدة البيانات:** JSON ملفات محلية (لا توجد SQL)  
**الذكاء الاصطناعي:** Google Gemini API (multi-key rotation)

---

## 🗂️ هيكل الملفات

```
/
├── index.js                     ← نقطة الدخول الرئيسية، كل شيء يمر منها
├── config.js                    ← متغيرات البيئة، الـ owner ID، الـ thresholds
├── database.js                  ← class Database — wrapper على server_database.json
├── logger.js                    ← نظام اللوج الملوّن (info/success/error/warn)
├── errors.js                    ← ModerationError class
│
├── helpers/
│   ├── gemini-keys.js           ← إدارة مفاتيح Gemini AI (rotation + fallback)
│   ├── auto-mod.js              ← نظام الإشراف التلقائي (EXTREME/SUSPICIOUS regex + AI)
│   ├── moderation-listener.js   ← Anti-spam + Anti-link + Anti-raid
│   ├── owner-ai.js              ← AI خاص بالأونر (إدارة رول، تحليل السيرفر)
│   ├── rank-roles.js            ← نظام الرتب التلقائية حسب الـ XP
│   └── (ملفات مساعدة أخرى)
│
├── commands/
│   ├── games.js                 ← روليت، مافيا، XO، روك-بيبر-سيزرز
│   ├── party-games.js           ← الهاتف المكسور، صنع الميم
│   ├── codenames.js             ← لعبة كود نيمز الكاملة
│   ├── bank-life.js             ← بنك الحياة (لعبة أسئلة + مراهنة)
│   ├── bank-luck.js             ← بنك الحظ (عجلة حظ + رهان)
│   ├── games-hub.js             ← لوحة الألعاب الرئيسية + /احدث-المميزات
│   ├── polls.js                 ← نظام الاستفتاءات
│   ├── quiz.js                  ← لعبة الأسئلة السريعة
│   ├── game-shop.js             ← متجر القدرات (تُشترى بالكوينز)
│   ├── battle.js                ← لعبة المعارك
│   ├── music.js                 ← أوامر الموسيقى (slash)
│   ├── image-cleaner.js         ← clean_chapter (تنظيف فصول المانجا)
│   ├── translator.js            ← translate_chapter (ترجمة الصور)
│   ├── quick-clean.js           ← تنظيف صورة / تنظيف رابط / استخراج نص
│   └── daily-challenge.js       ← التحدي الأسبوعي
│
├── data/
│   ├── bot-memory.json          ← ذاكرة AI قصيرة المدى (سياق المحادثات)
│   ├── gemini-keys-extra.json   ← مفاتيح Gemini الإضافية (غير .env)
│   └── welcome-dedupe.json      ← منع تكرار رسائل الترحيب عبر الـ restarts
│
├── server_database.json         ← قاعدة البيانات الرئيسية (JSON)
├── welcome.png                  ← صورة الترحيب المرفقة في رسالة الانضمام
└── package.json
```

---

## 🗄️ قاعدة البيانات (`server_database.json`)

هيكل JSON محلي، يُدار عبر `class Database` في `database.js`:

```json
{
  "users": {
    "<userId>": {
      "coins": 0,
      "xp": 0,
      "lastDaily": null,
      "warnings": [],
      "mutedUntil": null,
      "gameAbilities": {}
    }
  },
  "welcome": {
    "<guildId>": "<channelId>"
  },
  "manhwa": {
    "<dictName>": { "<term>": "<translation>" }
  },
  "suggestions": {
    "<messageId>": { "authorId": "", "text": "", "status": "pending" }
  },
  "settings": {
    "ownerLogsChannelId": ""
  }
}
```

**أهم Methods في Database class:**
| Method | وظيفته |
|--------|---------|
| `getUser(id)` | جيب بيانات مستخدم (ينشئه لو مش موجود) |
| `addCoins(id, amount)` | أضف كوينز |
| `addXP(id, amount)` | أضف XP |
| `addWarning(id, reason)` | سجّل تحذير |
| `getWelcomeChannel(guildId)` | جيب قناة الترحيب من الـ DB |
| `setWelcomeChannel(guildId, channelId)` | احفظ قناة الترحيب |
| `useGameAbility(userId, abilityId)` | استخدم قدرة لعبة (تُحذف لو وصلت 0) |
| `save()` | احفظ الـ JSON على الـ disk فوراً |

---

## ⚙️ config.js

| متغير | نوعه | وظيفته |
|-------|-------|---------|
| `DISCORD_TOKEN` | secret | توكن البوت |
| `GOOGLE_API_KEY` | secret | مفتاح Gemini الأساسي |
| `OWNER_ID` | string hardcoded | ID الأونر (صاحب البوت) |
| `ADMIN_CHANNEL_ID` | string | روم لوجز الإدارة |
| `ANTI_SPAM_THRESHOLD` | number | عدد رسايل في نافذة الـ spam |
| `ANTI_SPAM_WINDOW` | ms | نافذة وقت حساب الـ spam |
| `ANTI_RAID_THRESHOLD` | number | عدد انضمامات متتالية تُعتبر raid |
| `ANTI_RAID_WINDOW` | ms | نافذة وقت الـ raid |
| `isOwner(id)` | function | بيتحقق لو الـ id هو الأونر |

---

## 🧠 نظام Gemini AI (`helpers/gemini-keys.js`)

**الفكرة:** rotation تلقائي على عدة مفاتيح عشان يتجاوز حد الـ 1500 طلب/يوم لكل مفتاح.

- **مفاتيح البيئة:** `GOOGLE_API_KEY` (+ أرقام `GOOGLE_API_KEY_2`, `_3`...)
- **مفاتيح إضافية:** محفوظة في `data/gemini-keys-extra.json`
- **عند الامتلاء:** يتنقل للمفتاح التالي تلقائياً
- **نوعان من الموديلز:**
  - `geminiModel()` → نص فقط (gemini-1.5-flash)
  - `geminiVisionModel()` → نص + صور (multimodal)

**Functions المصدّرة:**
```js
geminiModel()           // جيب موديل النص الحالي
geminiVisionModel()     // جيب موديل الرؤية الحالي
collectKeys()           // حمّل كل المفاتيح عند الـ startup
removeKey(index)        // احذف مفتاح
setActiveKeyIndex(i)    // اضبط المفتاح النشط يدوياً
```

---

## 🛡️ نظام الإشراف التلقائي (`helpers/auto-mod.js`)

**طريقة عمل تلقائي ذكي (two-pass scan):**

```
كل رسالة جديدة
    ↓
Pass 1: EXTREME_REGEX → تطابق فوري = حذف + إجراء فوري
    ↓ (لو مش extreme)
Pass 2: SUSPICIOUS_REGEX → مشبوه
    ↓
Gemini AI (throttle 5 ثواني) → يأكد لو المحتوى سيء فعلاً
    ↓
حذف + إرسال تقرير للإدارة
```

**في index.js:**
```js
// يُستدعى في كل messageCreate:
await autoModScan(msg, db, guild, client, geminiModel());
```

---

## 🔇 `helpers/moderation-listener.js` (ModerationListener class)

| Method | وظيفته |
|--------|---------|
| `scanMessage(message)` | فحص كل رسالة (spam + links) |
| `checkSpam(message)` | يعدّ الرسايل في نافذة زمنية، لو تجاوز الـ threshold → mute |
| `checkLinks(message)` | يشيل الروابط غير المسموح بيها (بيسمح بـ whitelist domains) |
| `scanGuildJoin(member)` | يفحص معدل الانضمامات → لو raid → يقفل كل الروم |
| `triggerRaidProtection(guild, count)` | يقفل كل الروم + يبلغ الإدارة |

---

## 💬 نظام المحادثة مع الـ AI (بوت زنجي يرد على الـ mentions)

**في `index.js` → event `messageCreate`:**

- لو البوت اتمنشن أو الرسالة في DM → يرد بـ Gemini
- **وضع الكلام (speech mode):** 3 أوضاع:
  - `normal` → يرد بدون ألفاظ
  - `free` → يرد بنفس مستوى الرسالة
  - `toxic` → يرد بشكل حر جداً
- يُغيَّر بـ `/تغيير-طريقة-الكلام` (للأونر بس)
- **الذاكرة:** محدودة بـ `data/bot-memory.json`
- **Context:** بيشيل الـ conversation history ويبعته لـ Gemini

---

## 🎮 نظام الألعاب

### كيف تتتبع الألعاب في الميموري:

```js
// كل لعبة عندها:
const channelGames  = new Map(); // channelId → gameId (منع لعبتين في روم واحد)
const rouletteGames = new Map(); // gameId → state
const mafiaGames    = new Map(); // gameId → state
const tttGames      = new Map(); // gameId → state
// ... إلخ لكل لعبة
```

### عمل الـ gameId:
```js
const gameId = `${Date.now()}${Math.random().toString(36).slice(2,6)}`;
// مهم: بدون underscore عشان الـ customId splitting شغال بـ split("_")
```

### الألعاب المتاحة:

| اللعبة | الملف | الأمر | وضع اللعب |
|--------|-------|-------|-----------|
| روليت | `commands/games.js` | `/روليت` | أزرار Discord |
| مافيا | `commands/games.js` | `/مافيا` | DM للأدوار + أزرار |
| XO | `commands/games.js` | `/xo` | أزرار 3×3 |
| روك-بيبر | `commands/games.js` | `/ورقة-قلم-مقص` | أزرار |
| الهاتف المكسور | `commands/party-games.js` | `/الهاتف-المكسور` | رابط خارجي (garticphone.com) |
| صنع الميم | `commands/party-games.js` | `/صنع-الميم` | رابط خارجي (makeitmeme.com) |
| كود نيمز | `commands/codenames.js` | `/كود-نيمز` | رابط خارجي (codenames.game) |
| بنك الحياة | `commands/bank-life.js` | `/بنك-الحياة` | أزرار + أسئلة |
| بنك الحظ | `commands/bank-luck.js` | `/بنك-الحظ` | عجلة حظ |
| مسابقة | `commands/quiz.js` | `/مسابقة` | رسايل في الروم |
| استفتاء | `commands/polls.js` | `/استفتاء` | أزرار تصويت |

### زرار تجديد اللعبة (Replay):
كل لعبة لما تخلص بتبعت زرار `replay_<game>_<channelId>` — البوت في index.js بيروت ده لـ handler اللعبة التاني.

---

## 💰 نظام الاقتصاد

| الأمر | وظيفته |
|-------|---------|
| `/محفظة` | شوف رصيدك من الكوينز والـ XP والمستوى |
| `/يومي` | اجمع مكافأة يومية (cooldown 24 ساعة) |
| `/ليدربورد` | أفضل 10 أعضاء (كوينز أو XP) |
| `/متجر-قدرات` | اشتري قدرات للألعاب |
| `/قدراتي` | شوف قدراتك المتاحة |

**نظام XP:**
```
XP per message = 5
Level = floor(sqrt(xp / 50))
```

**نظام الرتب التلقائية (`helpers/rank-roles.js`):**
- بيتحقق من الـ level بعد كل message
- لو وصل level معين → يعطيه الرتبة المناسبة تلقائياً

---

## 🛠️ أوامر الإشراف (Moderation)

### كيف يشتغل نظام التأكيد:

```
مشرف يكتب /طرد @عضو
    ↓
البوت يبعت embed تأكيد + زرارين (تطبيق / إلغاء) — ephemeral
    ↓
pendingModActions.set(actionId, { type, targetId, reason, modId, guildId })
    ↓
timeout 90 ثانية → يُمسح تلقائياً لو ما اتأكدش
    ↓
المشرف يضغط "تطبيق" → modyes_<actionId>
    ↓
البوت يتحقق: نفس المشرف اللي بعت الأمر؟ + هو عنده صلاحية؟
    ↓
ينفذ الإجراء + يبعت لوج في قناة الإدارة
```

| الأمر | الصلاحية المطلوبة | الإجراء |
|-------|-------------------|---------|
| `/تحذير @عضو <سبب>` | ModerateMembers | يضيف warning في الـ DB |
| `/اسكات @عضو <مدة>` | ModerateMembers | Discord Timeout (مش mute role) |
| `/طرد @عضو` | KickMembers | kick من السيرفر |
| `/تبنيد @عضو` | BanMembers | ban نهائي |
| `/مسح <عدد>` | ManageMessages | يحذف رسايل bulk |

**ملاحظة مهمة:** كل الأوامر دي دلوقتي بتستخدم `addUserOption` — يعني Discord نفسه بيكمل اسم العضو تلقائياً، مش محتاج تكتب ID يدوياً.

---

## 🎵 نظام الموسيقى (`commands/music.js` + `music-handler.js`)

- يستخدم `@discordjs/voice` + `play-dl`
- يدعم YouTube links وبحث نصي
- Queue system (queue لكل guild)
- Auto-disconnect لو المستخدمين طلعوا من الروم
- أوامر: `play`, `skip`, `stop`, `queue`, `volume`, `pause`, `resume`

---

## 🖼️ أدوات المانجا والصور

| الأمر | وظيفته |
|-------|---------|
| `clean_chapter` | تنظيف فصل مانجا كامل (رفع ملف → ينظف تلقائياً) |
| `translate_chapter` | ترجمة فصل مانجا (OCR + Gemini) |
| `/تنظيف-صورة` | تبييض خلفية صورة |
| `/تنظيف-رابط` | تنظيف صورة من رابط |
| `/استخراج-نص` | OCR من صورة |

---

## 🎉 نظام الترحيب والوداع

**قناة الترحيب:** hardcoded `"1486100560494203183"` في `index.js`

**منع التكرار (deduplication):**
- محفوظ في `data/welcome-dedupe.json` (يتحمل الـ restart)
- TTL = 5 دقايق لكل عضو
- الـ key = `"<guildId>-<userId>"`

**رسالة الترحيب:** embed بصورة `welcome.png` + بيانات العضو

---

## 📣 نظام الاقتراحات

**في روم الاقتراحات:**
- لوحة ثابتة (Suggestions Panel) بـ 3 أزرار:
  - 💡 اقتراح (`suggest_idea`)
  - 🐛 مشكلة (`suggest_bug`)
  - 💬 تعليق (`suggest_comment`)
- لما يضغط أي زرار → Modal يظهر → يملّا الاقتراح
- البوت يبعت الاقتراح embed في نفس الروم مع أزرار إدارية
- الإدارة تقدر: موافقة / رفض / مراجعة / تصميم / رد مخصص / إشعار صاحب الاقتراح

**customId pattern للاقتراحات:**
```
suggest_idea / suggest_bug / suggest_comment  ← أزرار الفتح
admin_approve / admin_reject / admin_review   ← أزرار الإدارة
admin_reply_<msgId>                           ← رد مخصص
```

---

## 🔘 نظام الـ Custom IDs (كيف الأزرار بتشتغل)

كل زرار في Discord عنده `customId` — ده الـ ID اللي البوت بيعرف منه يعمل إيه.

### Pattern عام:
```
<prefix>_<action>_<gameId_or_channelId>
```

### أهم الـ prefixes:
| Prefix | الوظيفة |
|--------|---------|
| `rlt_` | أزرار الروليت |
| `maf_` | أزرار المافيا |
| `ttt_` | أزرار الـ XO |
| `rps_` | أزرار روك-بيبر |
| `rpb_` | أزرار روك-بيبر-أساسي |
| `cdn_` | أزرار كود نيمز |
| `gar_` | أزرار الهاتف المكسور |
| `meme_` | أزرار صنع الميم |
| `blf_` | أزرار بنك الحياة |
| `blk_` | أزرار بنك الحظ |
| `replay_` | أزرار تجديد اللعبة |
| `ghub_` | أزرار لوحة الألعاب |
| `ftr_` | أزرار أحدث المميزات |
| `modyes_` / `modno_` | تأكيد/رفض إجراء إشراف |
| `automod_kick_` | قرار طرد Auto-Mod |
| `aml_` | أزرار لوج Auto-Mod |
| `poll_vote_` | أزرار التصويت |
| `suggest_` | أزرار الاقتراحات |
| `admin_` | أزرار الإدارة |
| `dmp_` | أزرار لوحة التحكم الإدارية |
| `modyes_` + actionId | تأكيد إجراء مود (طرد/تبنيد/إسكات/تحذير) |

---

## 📊 Flow تسجيل الأوامر عند الـ Startup

```
node index.js
    ↓
1. Single instance lock check (/tmp/zangi_bot.lock)
    ↓
2. Database.load() ← server_database.json
    ↓
3. collectKeys() ← Gemini keys من env + data/gemini-keys-extra.json
    ↓
4. client.login(DISCORD_TOKEN)
    ↓
5. event: ready
    ↓
6. deployCommands() ← يرفع كل الـ slash commands على Discord API
    ↓
7. ensureSuggestionsPanel() ← يتأكد لوحة الاقتراحات موجودة
    ↓
8. Keep-Alive Express server (port 3000)
    ↓
9. WeeklyChallenge scheduler
    ↓
✅ البوت شغال
```

---

## 📋 كل الـ Slash Commands (71 أمر)

### عامة
| الأمر | الوظيفة |
|-------|---------|
| `/ping` | تأخير البوت |
| `/serverinfo` | معلومات السيرفر |
| `/userinfo [@عضو]` | معلومات عضو |
| `/زنجي <نص>` | محادثة مع الـ AI |
| `/بروفايل` | بروفايل المستخدم |
| `/محفظة` | الكوينز والـ XP |
| `/يومي` | مكافأة يومية |
| `/ليدربورد` | أفضل 10 أعضاء |
| `/حالة-البوت` | إحصائيات البوت |
| `/مساعدة` | قائمة الأوامر |

### إشراف (مشرفين)
| الأمر | الوظيفة |
|-------|---------|
| `/تحذير @عضو <سبب>` | تحذير رسمي |
| `/اسكات @عضو <مدة>` | إسكات مؤقت (دقائق) |
| `/طرد @عضو [سبب]` | طرد من السيرفر |
| `/تبنيد @عضو [سبب]` | حظر نهائي |
| `/مسح <عدد>` | حذف رسايل |
| `/تحذيرات [@عضو]` | سجل التحذيرات |
| `/ترحيب-قناة <#قناة>` | تعيين قناة الترحيب |
| `/قناة-اللوجز <#قناة>` | تعيين قناة اللوجز |
| `/auto-mod` | إعدادات Auto-Mod |
| `/تشغيل-اختبار <نوع>` | اختبار رسالة ترحيب/وداع |

### إدارة (أونر فقط)
| الأمر | الوظيفة |
|-------|---------|
| `/لوحة-إدارة` | لوحة تحكم إدارية |
| `/لوحة-اقتراحات` | إعادة إرسال لوحة الاقتراحات |
| `/مفاتيح-جيميني` | إدارة مفاتيح Gemini |
| `/تغيير-طريقة-الكلام` | وضع كلام البوت |
| `/انشاء-رول` | إنشاء رتبة جديدة |
| `/إعطاء <@عضو> <رتبة>` | إعطاء رتبة لعضو |
| `/مسح-الكل` | حذف كل رسايل روم |

### ألعاب
| الأمر | الوظيفة |
|-------|---------|
| `/الألعاب` | لوحة الألعاب الرئيسية |
| `/روليت` | لعبة الروليت |
| `/مافيا` | لعبة المافيا |
| `/xo` | لعبة XO |
| `/ورقة-قلم-مقص` | روك-بيبر-سيزرز |
| `/الهاتف-المكسور` | Gartic Phone |
| `/صنع-الميم` | Make-a-Meme |
| `/كود-نيمز` | Codenames |
| `/بنك-الحياة` | بنك الحياة |
| `/بنك-الحظ` | بنك الحظ |
| `/مسابقة` | مسابقة أسئلة |
| `/استفتاء` | استفتاء تصويت |
| `/متجر-قدرات` | متجر قدرات الألعاب |
| `/قدراتي` | قدراتي الحالية |
| `/احدث-المميزات` | آخر المضاف للبوت |

### أدوات مانجا/صور
| الأمر | الوظيفة |
|-------|---------|
| `clean_chapter` | تنظيف فصل مانجا |
| `translate_chapter` | ترجمة فصل مانجا |
| `/تنظيف-صورة` | تبييض خلفية |
| `/تنظيف-رابط` | تنظيف من URL |
| `/استخراج-نص` | OCR |

---

## 🔑 Secrets المطلوبة

| Secret | مطلوب؟ | الوظيفة |
|--------|--------|---------|
| `DISCORD_TOKEN` | ✅ ضروري | توكن البوت |
| `GOOGLE_API_KEY` | ✅ ضروري | Gemini AI |
| `GOOGLE_CLIENT_ID` | ⚠️ اختياري | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ⚠️ اختياري | Google OAuth |
| `GOOGLE_REFRESH_TOKEN` | ⚠️ اختياري | Google OAuth |
| `YOUTUBE_API_KEY` | ⚠️ اختياري | يوتيوب |

---

## 🔄 إضافة ميزة جديدة — Checklist

1. **أمر جديد:**
   - ضيف `SlashCommandBuilder` في `LEGACY_COMMANDS` أو `getAdvancedCommands()` في index.js
   - ضيف الـ handler في `interactionCreate` → switch على `cmd`
   - ضيف اسمه في `LATEST_FEATURES` في `commands/games-hub.js` (أهم!)

2. **زرار جديد:**
   - اختار prefix فريد لـ customId
   - ضيف `if (customId.startsWith("prefix_"))` في حدث `interactionCreate`
   - اتأكد الـ prefix مش موجود بالفعل

3. **لعبة جديدة:**
   - ضيف Map جديدة: `const newGames = new Map()`
   - اضبط `channelGames.set(channelId, gameId)` عند البداية
   - امسح `channelGames.delete(channelId)` عند النهاية
   - ضيف replay button بـ `replay_<prefix>_<channelId>`
   - ضيف routing في معالج `replay_` في index.js

---

## ⚡ أهم القرارات التقنية

| القرار | السبب |
|--------|-------|
| ESM (import/export) بدل CommonJS | discord.js v14+ يفضّل ESM |
| JSON database بدل SQL | بساطة ومش محتاج setup |
| Multi-key Gemini rotation | تجاوز حد الـ 1500 طلب/يوم |
| Persistent welcome deduplication | منع تكرار رسائل الترحيب عند الـ restart |
| addUserOption للأوامر الإشرافية | Discord يتكفل بالـ autocomplete والـ validation |
| pendingModActions Map (90s TTL) | تأكيد الإجراءات الخطيرة قبل التنفيذ |
| channelGames Map | منع لعبتين في نفس الروم في نفس الوقت |
| Single instance lock | منع تشغيل نسختين من البوت في نفس الوقت |

---

## 🐛 مشاكل معروفة وحلولها

| المشكلة | السبب | الحل |
|---------|-------|-------|
| أمر الطرد بيجيب null | كان يستخدم getString لبيانات المستخدم | تحويل لـ addUserOption |
| تكرار رسائل الترحيب | deduplication in-memory بتتمسح عند restart | حفظ في welcome-dedupe.json |
| رسائل مود مكررة | استدعاء scanMessage مرتين | حذف الاستدعاء الزيادة |

---

*آخر تحديث: يونيو 2026*
