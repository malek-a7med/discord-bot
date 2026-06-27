// ═══════════════════════════════════════════════════════════════
//  نظام Auto-Mod الذكي — زنجي Bot  v4.0
//
//  Layer 0 – Anti-Hacker/Spammer (جديد)
//    كشف السبام متعدد الرومات + صور التداول + منشن الكل
//    → إجراء فوري بدون Gemini
//
//  Layer 1 – Instant Regex
//    أشياء مؤكدة 100% (CSAM / تفجيرات / إرهاب)
//    → CRITICAL فوراً بدون Gemini
//
//  Layer 2 – Gemini AI (النص)
//    تحليل عميق مع context (تاريخ القناة + سجل المستخدم)
//    → يرجع SAFE/LOW/MEDIUM/HIGH/CRITICAL
//
//  Layer 3 – Gemini Vision (الصور)
//    تحليل نفس المستويات على الصور
//
//  نظام التوجيل:
//    كل ميزة ممكن تفعيلها / إيقافها بأمر `/اوتومود`
// ═══════════════════════════════════════════════════════════════

import config from "../config.js";

// ─── مستويات الخطورة ──────────────────────────────────────────
export const DANGER = Object.freeze({
  SAFE:     0,
  LOW:      1,
  MEDIUM:   2,
  HIGH:     3,
  CRITICAL: 4,
});

const DANGER_LABEL = ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

// ═══════════════════════════════════════════════════════════════
//  نظام الإعدادات — تفعيل/إيقاف كل ميزة
// ═══════════════════════════════════════════════════════════════
const DEFAULT_SETTINGS = {
  enabled:          true,   // الأوتو مود كله
  antiHacker:       true,   // كاشف السبام والهاكر
  antiSpam:         true,   // سبام رسائل متكرر
  aiText:           true,   // تحليل Gemini النصي
  aiImage:          true,   // تحليل Gemini للصور
  instantPatterns:  true,   // الـ regex الفوري
};

// settings per-guild (guildId → settings object)
const _guildSettings = new Map();

export function getSettings(guildId) {
  if (!_guildSettings.has(guildId)) {
    _guildSettings.set(guildId, { ...DEFAULT_SETTINGS });
  }
  return _guildSettings.get(guildId);
}

export function setFeature(guildId, feature, value) {
  const s = getSettings(guildId);
  if (!(feature in DEFAULT_SETTINGS)) return false;
  s[feature] = Boolean(value);
  _guildSettings.set(guildId, s);
  return true;
}

export function getAllFeatures() {
  return {
    enabled:         "الأوتو مود كله",
    antiHacker:      "كاشف الهاكر والسبام متعدد الرومات",
    antiSpam:        "سبام الرسائل المتكرر",
    aiText:          "تحليل الذكاء الاصطناعي للنصوص",
    aiImage:         "تحليل الذكاء الاصطناعي للصور",
    instantPatterns: "الفلتر الفوري (إرهاب / CSAM)",
  };
}

// ─── Layer 1: Regex فوري ───────────────────────────────────────
const INSTANT_CRITICAL_PATTERNS = [
  /(?:أطفال|طفل|صغير|minor|child)\s*(?:سكس|sex|إباحي|porn|naked|عاري|ينيك|ينيكه)/gi,
  /(?:كيفية?\s*(?:صنع|عمل|تصنيع)\s*(?:قنبلة|متفجرات|عبوة\s*ناسفة))/gi,
  /(?:انضم|انضمي|بايعوا)\s*(?:داعش|القاعدة|النصرة|ISIS|ISIL|تنظيم)/gi,
];

// ─── Pre-screen ────────────────────────────────────────────────
const SAFE_PRESCREEN = [
  /^[\p{Emoji}\s]+$/u,
  /^.{1,3}$/,
];

// ═══════════════════════════════════════════════════════════════
//  Layer 0 — Anti-Hacker / Anti-Spam ذكي
// ═══════════════════════════════════════════════════════════════

// تتبع سرعة الرسائل per-user
const _msgRateTracker = new Map(); // userId → { msgs: [{channelId, ts}] }
const RATE_WINDOW_MS  = 15_000;    // 15 ثانية
const RATE_MAX_MSGS   = 6;         // أكثر من 6 رسائل في 15 ثانية = سبام
const RATE_MAX_CHANNELS = 3;       // نفس الشخص يبعت في أكثر من 3 رومات = سبام

// كلمات التداول والاحتيال (trading scam keywords)
const TRADING_SCAM_KEYWORDS = [
  // عربي
  /(?:ربح|أرباح|profit)\s*(?:\d+%|\d+\s*في\s*المية)/gi,
  /(?:استثمار|invest)\s*(?:مضمون|guarantee|آمن|safe)/gi,
  /(?:تداول|trading|forex|فوركس|crypto|كريبتو|bitcoin|بيتكوين)/gi,
  /(?:وصفة|إشارة|signal)\s*(?:ربح|profit|win)/gi,
  /(?:ضاعف|double|مضاعفة)\s*(?:أموالك|money|رأس\s*مالك)/gi,
  /(?:اشترك|انضم|join)\s*(?:قناة|channel|group|جروب)/gi,
  /(?:منصة|platform)\s*(?:تداول|trading|استثمار)/gi,
  /(?:روبوت|bot|بوت)\s*(?:تداول|trading|ربح)/gi,
  // إنجليزي
  /\b(?:get\s*rich|make\s*money\s*fast|passive\s*income|guaranteed\s*profit)\b/gi,
  /\b(?:DM\s*me|inbox\s*me|contact\s*me)\s*(?:for|to)\s*(?:profit|earn|invest)/gi,
];

function isLikelyTradingScam(content, hasImage) {
  if (!content && !hasImage) return false;
  const text = content || "";
  const matchCount = TRADING_SCAM_KEYWORDS.reduce((acc, rx) => {
    rx.lastIndex = 0;
    return acc + (rx.test(text) ? 1 : 0);
  }, 0);
  // نص تداول + صورة = خطر عالي
  if (hasImage && matchCount >= 1) return true;
  // نص تداول كتير بدون صورة
  if (matchCount >= 2) return true;
  return false;
}

function hasMassmention(msg) {
  return msg.mentions?.everyone === true ||
    (msg.content || "").includes("@everyone") ||
    (msg.content || "").includes("@here");
}

function trackMsgRate(userId, channelId) {
  const now = Date.now();
  const rec = _msgRateTracker.get(userId) || { msgs: [] };

  // تنظيف القديم
  rec.msgs = rec.msgs.filter(m => now - m.ts < RATE_WINDOW_MS);
  rec.msgs.push({ channelId, ts: now });
  _msgRateTracker.set(userId, rec);

  const totalMsgs    = rec.msgs.length;
  const uniqueChannels = new Set(rec.msgs.map(m => m.channelId)).size;

  return { totalMsgs, uniqueChannels };
}

// تنظيف الذاكرة كل 5 دقايق
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [uid, rec] of _msgRateTracker) {
    rec.msgs = rec.msgs.filter(m => m.ts > cutoff);
    if (rec.msgs.length === 0) _msgRateTracker.delete(uid);
  }
}, 5 * 60 * 1000);

async function antiHackerScan(msg, settings) {
  if (!settings.antiHacker) return null;

  const content  = msg.content?.trim() || "";
  const hasImage = msg.attachments.size > 0 &&
    [...msg.attachments.values()].some(a => a.contentType?.startsWith("image/"));
  const mention  = hasMassmention(msg);

  // ── 1. صورة + منشن الكل → سبام هاكر فوري ──────────────────
  if (hasImage && mention) {
    return {
      level:        DANGER.CRITICAL,
      category:     "HACKER_SPAM",
      reason:       "صورة + منشن الكل — سبام هاكر",
      shouldDelete: true,
      confidence:   99,
      action:       "ban_hacker",
    };
  }

  // ── 2. رصد سرعة الرسائل ─────────────────────────────────────
  if (!settings.antiSpam) return null;
  const { totalMsgs, uniqueChannels } = trackMsgRate(msg.author.id, msg.channel.id);

  // بعت في 3+ رومات في 15 ثانية = سبام متعدد الرومات
  if (uniqueChannels >= RATE_MAX_CHANNELS) {
    return {
      level:        DANGER.CRITICAL,
      category:     "HACKER_SPAM",
      reason:       `سبام في ${uniqueChannels} رومات في وقت قصير`,
      shouldDelete: true,
      confidence:   97,
      action:       "ban_hacker",
    };
  }

  // أكثر من 6 رسائل في 15 ثانية = سبام
  if (totalMsgs > RATE_MAX_MSGS) {
    return {
      level:        DANGER.HIGH,
      category:     "SPAM",
      reason:       `سبام: ${totalMsgs} رسائل في 15 ثانية`,
      shouldDelete: true,
      confidence:   95,
      action:       "timeout_spam",
    };
  }

  // ── 3. صور تداول احتيالية ────────────────────────────────────
  if (isLikelyTradingScam(content, hasImage)) {
    return {
      level:        DANGER.HIGH,
      category:     "TRADING_SCAM",
      reason:       "محتوى تداول/استثمار مشبوه",
      shouldDelete: true,
      confidence:   85,
      action:       "warn_scam",
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  تنفيذ إجراء الهاكر/السبامر
// ═══════════════════════════════════════════════════════════════
async function executeHackerAction(msg, db, notifyOwner, assessment) {
  const { reason, category, action } = assessment;
  const member = msg.member;
  const user   = msg.author;

  // حذف الرسالة دايماً
  await msg.delete().catch(() => {});

  // حذف كل رسائله الأخيرة في الروم (آخر 10)
  try {
    const recent = await msg.channel.messages.fetch({ limit: 20 });
    const userMsgs = recent.filter(m => m.author.id === user.id && m.id !== msg.id);
    for (const m of userMsgs.values()) {
      await m.delete().catch(() => {});
    }
  } catch {}

  let finalAction = "ban";

  if (action === "ban_hacker") {
    // حذف فوري — باند مع حذف 24 ساعة من رسائله
    if (member?.bannable) {
      try {
        await member.ban({ reason: `🔨 Auto-Mod Hacker: ${reason}`, deleteMessageSeconds: 86400 });
        db.addBan?.(user.id, `Auto-Mod Hacker: ${reason}`, "ANTI_HACKER");
      } catch { finalAction = "timeout_24h"; }
    }
    // إشعار الأونر فوري
    await notifyOwner(user.id, member, `🚨 هاكر/سبامر تم كشفه!\nالسبب: ${reason}`, 0).catch(() => {});

    // تحذير في الروم
    const alert = await msg.channel.send(
      `🚨 **تم كشف هاكر!** — تم حظر ${user} تلقائياً\n> **السبب:** ${reason}`
    ).catch(() => null);
    if (alert) setTimeout(() => alert.delete().catch(() => {}), 15_000);

  } else if (action === "timeout_spam") {
    // إسكات ساعتين
    if (member?.manageable) {
      try { await member.timeout(2 * 60 * 60 * 1000, `Auto-Mod Spam: ${reason}`); }
      catch {}
    }
    finalAction = "timeout";
    const alert = await msg.channel.send(
      `🔇 **سبام مكتشف** — تم إسكات ${user} لساعتين\n> ${reason}`
    ).catch(() => null);
    if (alert) setTimeout(() => alert.delete().catch(() => {}), 10_000);

  } else if (action === "warn_scam") {
    // تحذير رسمي للاحتيال
    db.addWarning(user.id, reason, "ANTI_SCAM");
    const warnCount = db.getWarnings(user.id).length;
    finalAction = "warn";
    const alert = await msg.channel.send(
      `⚠️ ${user} | **تحذير ${warnCount}** — ${reason}\n> محتوى تداول/احتيال ممنوع في السيرفر`
    ).catch(() => null);
    if (alert) setTimeout(() => alert.delete().catch(() => {}), 10_000);

    // لو تراكمت التحذيرات → إسكات
    if (warnCount >= 3 && member?.manageable) {
      await member.timeout(2 * 60 * 60 * 1000, `Auto-Mod Scam Repeat`).catch(() => {});
      finalAction = "timeout";
    }
  }

  return {
    triggered: true,
    action:    finalAction,
    category,
    logData: {
      userId:      user.id,
      username:    user.username,
      userAvatar:  user.displayAvatarURL(),
      channelId:   msg.channel.id,
      channelName: msg.channel.name || "unknown",
      guildName:   msg.guild?.name  || "unknown",
      reason,
      category,
      aiLevel:    "CRITICAL",
      warnCount:  0,
      timestamp:  Date.now(),
    },
  };
}

// ─── Throttle per-user ────────────────────────────────────────
const _userLastCall = new Map();
const USER_THROTTLE_MS = 1500;

// ─── Cache context القناة ─────────────────────────────────────
const _channelContext = new Map();

// ─── مشتبه بيهم ──────────────────────────────────────────────
const _suspectTracker = new Map();
const SUSPECT_WINDOW_MS = 5 * 60 * 1000;

function trackSuspect(userId) {
  const now = Date.now();
  const rec = _suspectTracker.get(userId) || { count: 0, firstAt: now };
  if (now - rec.firstAt > SUSPECT_WINDOW_MS) {
    _suspectTracker.set(userId, { count: 1, firstAt: now });
    return 1;
  }
  rec.count++;
  _suspectTracker.set(userId, rec);
  return rec.count;
}

async function getChannelContext(msg) {
  try {
    const cached = _channelContext.get(msg.channel.id);
    if (cached && Date.now() - cached._ts < 10_000) return cached.messages;
    const fetched = await msg.channel.messages.fetch({ limit: 6, before: msg.id });
    const messages = [...fetched.values()]
      .filter(m => !m.author.bot && m.id !== msg.id)
      .slice(0, 5).reverse()
      .map(m => `${m.author.username}: ${m.content.slice(0, 120)}`);
    _channelContext.set(msg.channel.id, { messages, _ts: Date.now() });
    return messages;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
//  Gemini Text Analysis
// ═══════════════════════════════════════════════════════════════
async function analyzeWithGemini(msg, db, geminiTextModel) {
  if (!geminiTextModel) return { level: DANGER.SAFE, reason: "لا يوجد نموذج AI" };

  const now  = Date.now();
  const last = _userLastCall.get(msg.author.id) || 0;
  if (now - last < USER_THROTTLE_MS) return { level: DANGER.SAFE, reason: "throttle" };
  _userLastCall.set(msg.author.id, now);

  const contextMessages = await getChannelContext(msg);
  const warnings        = db.getWarnings(msg.author.id).length;
  const suspectCount    = _suspectTracker.get(msg.author.id)?.count || 0;

  const contextBlock = contextMessages.length > 0
    ? `\nالسياق (آخر رسائل في القناة):\n${contextMessages.map(m => `  • ${m}`).join("\n")}`
    : "";

  const prompt = `أنت نظام مراقبة ذكي لسيرفر Discord عربي. مهمتك تحليل الرسائل بدقة عالية.

═══ الرسالة المراد تحليلها ═══
المرسل: ${msg.member?.displayName || msg.author.username}
المحتوى: "${msg.content.slice(0, 600)}"${contextBlock}

═══ معلومات المرسل ═══
عدد التحذيرات السابقة: ${warnings}
مرات الإشارة المشبوهة اليوم: ${suspectCount}

═══ تعليمات التحليل ═══

⚠️ قاعدة ذهبية: الغالبية العظمى من الرسائل = SAFE. التدخل بس لما في خطر حقيقي واضح.

🟢 SAFE — تجاهل تماماً (90%+ من الرسائل):
• أي شتيمة أو كلام وحش بين أصحاب أو في نقاش عادي — حتى لو موجهة
• "اخرس"، "أنت غبي"، "مسخرة"، "يلعن"، "كسمك"، "ابن نيك" — كلها عادية في السيرفرات العربية
• أي تلاسن أو مجادلة حتى لو فيها سب
• كلام حماسي / تنافسي في الألعاب
• اقتباسات من أغاني أو أفلام أو ميمز
• نقاش ديني أو سياسي مهما اشتد
• تعبير عن إحباط أو غضب عام
• أي حاجة مش فيها خطر فعلي على شخص أو ضرر حقيقي

🟡 LOW — حالات نادرة جداً، تسجيل بس بدون أي إجراء:
• معلومات مضللة خطيرة فعلاً (مش مجرد رأي غلط)

🟠 MEDIUM — مخالفة صريحة تستحق الحذف:
• محتوى جنسي وصفي صريح جداً (مش مجرد تلميح)
• دوكسينج: نشر عنوان / رقم تليفون / بيانات شخصية حقيقية لشخص

🔴 HIGH — خطر حقيقي واضح:
• تهديد صريح بالأذى الجسدي لشخص بعينه مع تفاصيل (مش مجرد "هقتلك" في سياق ألعاب)
• خطاب كراهية منظم وعدائي موجه لفئة بسبب دين/عرق/جنس بنية إيذاء
• حملة مضايقة ممنهجة موثقة

⛔ CRITICAL — تصرف فوري (نادر جداً):
• أي محتوى يتعلق باستغلال أطفال
• تعليمات تصنيع أسلحة / مواد متفجرة فعلية
• تحريض إرهابي أو تجنيد لجماعات متطرفة
• تهديد قتل مع تفاصيل حقيقية وقابلة للتنفيذ

═══ الإجابة المطلوبة ═══
أجب بـ JSON فقط بدون أي نص إضافي:
{
  "level": "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "category": "NONE" | "HARASSMENT" | "THREAT" | "HATE_SPEECH" | "EXPLICIT" | "DANGEROUS_INFO" | "EXTREMISM",
  "reason": "سبب قصير بالعربي (جملة واحدة)",
  "delete": true | false,
  "confidence": 0-100
}`;

  try {
    const result    = await geminiTextModel.generateContent(prompt);
    const raw       = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لا يوجد JSON في الرد");

    const parsed   = JSON.parse(jsonMatch[0]);
    const levelMap = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const level    = levelMap[parsed.level?.toUpperCase()] ?? DANGER.SAFE;

    return {
      level,
      category:     parsed.category || "NONE",
      reason:       parsed.reason   || "محتوى مخالف",
      shouldDelete: parsed.delete !== false,
      confidence:   parsed.confidence || 80,
    };
  } catch (e) {
    return { level: DANGER.SAFE, reason: "خطأ في التحليل" };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Gemini Vision Analysis
// ═══════════════════════════════════════════════════════════════
async function analyzeImageWithGemini(imageUrl, geminiVisionModel) {
  if (!geminiVisionModel) return { level: DANGER.SAFE };
  try {
    const res    = await fetch(imageUrl);
    if (!res.ok) return { level: DANGER.SAFE };
    const buf    = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mime   = res.headers.get("content-type") || "image/jpeg";

    const result = await geminiVisionModel.generateContent([
      { inlineData: { data: base64, mimeType: mime } },
      `أنت نظام مراقبة صور لسيرفر Discord. حلل هذه الصورة وقيّم خطورتها.

أجب بـ JSON فقط:
{
  "level": "SAFE" | "MEDIUM" | "HIGH" | "CRITICAL",
  "reason": "وصف قصير بالعربي",
  "confidence": 0-100
}

معايير التقييم:
SAFE: صور عادية، مضحكة، ألعاب، أنيمي، طبيعة، أشخاص عاديين، ميمز، شاشات عادية
MEDIUM: محتوى جنسي ضمني أو عنف معتدل
HIGH: محتوى جنسي صريح أو عنف شديد أو صور احتيال/تداول واضحة مع أرقام ربح
CRITICAL: استغلال أطفال أو إرهاب أو دماء مفرطة جداً`,
    ]);

    const raw       = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { level: DANGER.SAFE };

    const parsed   = JSON.parse(jsonMatch[0]);
    const levelMap = { SAFE: 0, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

    return {
      level:      levelMap[parsed.level?.toUpperCase()] ?? DANGER.SAFE,
      reason:     parsed.reason || "محتوى بصري مخالف",
      confidence: parsed.confidence || 80,
    };
  } catch {
    return { level: DANGER.SAFE };
  }
}

// ═══════════════════════════════════════════════════════════════
//  محرك القرار — المستوى العادي (non-hacker)
// ═══════════════════════════════════════════════════════════════
const TIMEOUT_2H  = 2  * 60 * 60 * 1000;
const TIMEOUT_24H = 24 * 60 * 60 * 1000;

async function executeAction(msg, db, notifyOwner, assessment) {
  const { level, reason, shouldDelete, category } = assessment;
  const member      = msg.member;
  const user        = msg.author;
  const warnings    = db.getWarnings(user.id).length;
  const suspectHits = trackSuspect(user.id);

  if (level === DANGER.LOW) {
    return {
      triggered: true,
      action:    "log_only",
      warnCount: warnings,
      logData:   buildLogData(msg, reason, category, level, 0),
    };
  }

  const savedContent     = msg.content || "";
  const savedAttachments = [...msg.attachments.values()].map(a => a.url);

  if (shouldDelete !== false) await msg.delete().catch(() => {});

  if (level === DANGER.MEDIUM) {
    const notice = await msg.channel.send(
      `> 💬 ${user} رسالتك اتحذفت — **${reason}**\n> حافظ على جو السيرفر 🙏`
    ).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 8_000);
    user.send([
      `⚠️ **تنبيه من زنجي Bot** — ${msg.guild.name}`,
      `السبب: **${reason}**`,
      `دي مش تحذير رسمي، بس خلي بالك من طريقة كلامك. 🙏`,
    ].join("\n")).catch(() => {});
    return {
      triggered: true,
      action:    "soft_warn",
      warnCount: warnings,
      logData:   buildLogData(msg, reason, category, level, warnings, savedContent, savedAttachments),
    };
  }

  db.addWarning(user.id, reason, "AUTO_MOD");
  const newWarnCount    = db.getWarnings(user.id).length;
  let action = "warn";
  const isRepeatOffender = newWarnCount >= 3 || suspectHits >= 3;
  const isCritical       = level === DANGER.CRITICAL;

  if (isCritical && newWarnCount >= 3) {
    if (member?.bannable) {
      try {
        await member.ban({ reason: `Auto-Mod: ${reason}`, deleteMessageSeconds: 86400 });
        db.addBan?.(user.id, `Auto-Mod: ${reason}`, "AUTO_MOD");
        action = "ban";
      } catch { action = "owner_report"; }
    } else { action = "owner_report"; }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (isCritical && newWarnCount >= 2) {
    if (member?.kickable) {
      try { await member.kick(`Auto-Mod: ${reason}`); action = "kick"; }
      catch { action = "owner_report"; }
    } else { action = "owner_report"; }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (isCritical) {
    if (member?.manageable) {
      try { await member.timeout(TIMEOUT_24H, `Auto-Mod: ${reason}`); action = "timeout_24h"; }
      catch { action = "warn"; }
    }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (newWarnCount >= 5) {
    if (member?.bannable) {
      try {
        await member.ban({ reason: `Auto-Mod: ${reason}`, deleteMessageSeconds: 86400 });
        db.addBan?.(user.id, `Auto-Mod: ${reason}`, "AUTO_MOD");
        action = "ban";
      } catch { action = "owner_report"; }
    } else { action = "owner_report"; }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (newWarnCount >= 4) {
    if (member?.kickable) {
      try { await member.kick(`Auto-Mod: ${reason}`); action = "kick"; }
      catch { action = "owner_report"; }
    } else { action = "owner_report"; }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (newWarnCount >= 3 || isRepeatOffender) {
    if (member?.manageable) {
      try { await member.timeout(TIMEOUT_2H, `Auto-Mod: ${reason}`); action = "timeout"; }
      catch { action = "warn"; }
    }
  }

  const actionEmoji = {
    ban:          "🔨 **باند تلقائي!**",
    kick:         "👢 **طرد تلقائي!**",
    timeout_24h:  "🔇 **إسكات 24 ساعة!**",
    timeout:      "🔇 **إسكات ساعتين!**",
    owner_report: "🚨 **بُلّغت الإدارة!**",
    warn:         "⚠️ استمرار التصرف هيجيب عقوبة!",
  }[action] || "";

  const warnMsg = await msg.channel.send(
    `🛡️ ${user} | **تحذير ${newWarnCount}** — ${reason}\n${actionEmoji}`
  ).catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 10_000);

  if (action !== "ban") {
    user.send([
      `🛡️ **تحذير رسمي — زنجي Bot**`,
      `السيرفر: **${msg.guild.name}**`,
      `السبب: **${reason}**`,
      `تحذيراتك: **${newWarnCount}**`,
      action === "kick"        ? "\n👢 اتطردت من السيرفر." :
      action === "timeout_24h" ? "\n🔇 تم إسكاتك 24 ساعة." :
      action === "timeout"     ? "\n🔇 تم إسكاتك ساعتين." :
                                 "\n📌 تراكم التحذيرات بيأدي لإسكات ثم طرد ثم حظر.",
    ].join("\n")).catch(() => {});
  }

  return {
    triggered:  true,
    action,
    warnCount:  newWarnCount,
    aiLevel:    DANGER_LABEL[level],
    aiCategory: category,
    logData:    buildLogData(msg, reason, category, level, newWarnCount, savedContent, savedAttachments),
  };
}

function buildLogData(msg, reason, category, level, warnCount, savedContent = "", savedAttachments = []) {
  return {
    savedContent,
    savedAttachments,
    userId:      msg.author.id,
    username:    msg.author.username,
    userAvatar:  msg.author.displayAvatarURL(),
    channelId:   msg.channel.id,
    channelName: msg.channel.name || "unknown",
    guildName:   msg.guild?.name  || "unknown",
    reason,
    category,
    aiLevel:    DANGER_LABEL[level] || "UNKNOWN",
    warnCount,
    timestamp:  Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
//  scanMessage — الواجهة الرئيسية
// ═══════════════════════════════════════════════════════════════
export async function scanMessage(msg, db, geminiVisionModel, notifyOwner, geminiTextModel = null) {
  if (msg.author.bot)               return { triggered: false };
  if (config.isOwner(msg.author.id)) return { triggered: false };
  if (!msg.guild)                   return { triggered: false };

  const guildId  = msg.guild.id;
  const settings = getSettings(guildId);

  // الأوتو مود مطفي كله
  if (!settings.enabled) return { triggered: false };

  const content  = msg.content?.trim() || "";
  const hasImage = msg.attachments.size > 0 &&
    [...msg.attachments.values()].some(a => a.contentType?.startsWith("image/"));
  const hasText  = content.length > 3;

  // ── Layer 0: Anti-Hacker / Anti-Spam ────────────────────────
  const hackerResult = await antiHackerScan(msg, settings).catch(() => null);
  if (hackerResult) {
    return executeHackerAction(msg, db, notifyOwner, hackerResult);
  }

  // Pre-screen بسيط
  const isObviouslySafe = SAFE_PRESCREEN.some(rx => rx.test(content));
  if (isObviouslySafe && !hasImage) return { triggered: false };

  // ── Layer 1: Instant Critical Regex ─────────────────────────
  if (hasText && settings.instantPatterns) {
    for (const pattern of INSTANT_CRITICAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        return executeAction(msg, db, notifyOwner, {
          level:    DANGER.CRITICAL,
          category: "DANGEROUS_INFO",
          reason:   "محتوى خطير جداً (تشغيل فوري)",
          shouldDelete: true,
          confidence: 100,
        });
      }
    }
  }

  // ── Layer 2: Gemini Text ─────────────────────────────────────
  let textAssessment = { level: DANGER.SAFE };
  if (hasText && settings.aiText && geminiTextModel) {
    textAssessment = await analyzeWithGemini(msg, db, geminiTextModel).catch(() => ({ level: DANGER.SAFE }));
  }

  // ── Layer 3: Gemini Image ────────────────────────────────────
  let imageAssessment = { level: DANGER.SAFE };
  if (hasImage && settings.aiImage && geminiVisionModel) {
    const imageUrls = [...msg.attachments.values()]
      .filter(a => a.contentType?.startsWith("image/"))
      .map(a => a.url);

    const imageResults = await Promise.all(
      imageUrls.map(url => analyzeImageWithGemini(url, geminiVisionModel).catch(() => ({ level: DANGER.SAFE })))
    );

    const maxImageResult = imageResults.reduce(
      (best, cur) => cur.level > best.level ? cur : best,
      { level: DANGER.SAFE }
    );

    if (maxImageResult.level > DANGER.SAFE) {
      imageAssessment = { ...maxImageResult, category: "EXPLICIT", shouldDelete: true };
    }
  }

  const finalAssessment = textAssessment.level >= imageAssessment.level
    ? textAssessment
    : imageAssessment;

  if (finalAssessment.level === DANGER.SAFE) return { triggered: false };

  return executeAction(msg, db, notifyOwner, finalAssessment);
}
