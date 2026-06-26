// ═══════════════════════════════════════════════════════════════
//  نظام Auto-Mod الذكي — زنجي Bot  v3.0
//
//  المنطق:
//  ┌──────────────────────────────────────────────────────────┐
//  │  Layer 1 – Instant Regex                                 │
//  │    أشياء مؤكدة 100% (CSAM / تفجيرات / إرهاب)           │
//  │    → CRITICAL فوراً بدون Gemini                          │
//  │                                                          │
//  │  Layer 2 – Gemini AI (النص)                             │
//  │    تحليل عميق مع context (تاريخ القناة + سجل المستخدم)  │
//  │    → يرجع SAFE/LOW/MEDIUM/HIGH/CRITICAL                  │
//  │                                                          │
//  │  Layer 3 – Gemini Vision (الصور)                        │
//  │    تحليل نفس المستويات على الصور                         │
//  └──────────────────────────────────────────────────────────┘
//
//  الفلسفة:
//  ✅ الشتيمة العادية في سياق أصحاب = SAFE
//  ✅ كلام حماسي في الألعاب = SAFE
//  ✅ نقاشات دينية وسياسية = SAFE (إلا التحريض المباشر)
//  ✅ اقتباسات من أغاني / أفلام = SAFE
//  ✅ التعبير عن الإحباط = SAFE
//  ❌ تهديد شخص بعينه = HIGH/CRITICAL
//  ❌ محتوى إباحي صريح = HIGH/CRITICAL
//  ❌ تحريض إرهابي = CRITICAL
//  ❌ محتوى يتعلق بأطفال = CRITICAL
// ═══════════════════════════════════════════════════════════════

import config from "../config.js";

// ─── مستويات الخطورة ──────────────────────────────────────────
export const DANGER = Object.freeze({
  SAFE:     0,  // لا شيء
  LOW:      1,  // تسجيل فقط — بدون حذف أو عقوبة
  MEDIUM:   2,  // حذف + تنبيه هادئ
  HIGH:     3,  // حذف + تحذير رسمي + إسكات عند التكرار
  CRITICAL: 4,  // حذف + إجراء فوري
});

const DANGER_LABEL = ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

// ─── Layer 1: Regex فوري للأشياء المؤكدة 100% ─────────────────
// فقط الأشياء اللي مفيش فيها سياق بيجعلها مقبولة إطلاقاً
const INSTANT_CRITICAL_PATTERNS = [
  // CSAM / استغلال أطفال
  /(?:أطفال|طفل|صغير|minor|child)\s*(?:سكس|sex|إباحي|porn|naked|عاري|ينيك|ينيكه)/gi,
  // تعليمات تفجير حقيقية
  /(?:كيفية?\s*(?:صنع|عمل|تصنيع)\s*(?:قنبلة|متفجرات|عبوة\s*ناسفة|سكين\s*إلكتروني))/gi,
  // تجنيد إرهابي صريح
  /(?:انضم|انضمي|بايعوا)\s*(?:داعش|القاعدة|النصرة|ISIS|ISIL|تنظيم)/gi,
];

// ─── Pre-screen: تصفية سريعة قبل Gemini (توفير API calls) ────
// لو الرسالة بيضاء تماماً → SAFE فوراً
const SAFE_PRESCREEN = [
  // روابط عادية
  /^https?:\/\//,
  // إيموجي فقط
  /^[\p{Emoji}\s]+$/u,
  // أرقام/حروف قليلة
  /^.{1,3}$/,
];

// ─── Throttle per-user (مش global) ───────────────────────────
const _userLastCall = new Map(); // userId → timestamp
const USER_THROTTLE_MS = 1500;    // 1.5 ثانية بين calls لنفس المستخدم

// ─── Cache context القناة (آخر 5 رسائل per channel) ──────────
const _channelContext = new Map(); // channelId → Message[]

// ─── مشتبه بيهم (لو أخد 2+ flags في 5 دقايق) ──────────────
const _suspectTracker = new Map(); // userId → { count, firstAt }
const SUSPECT_WINDOW_MS = 5 * 60 * 1000;

function trackSuspect(userId) {
  const now  = Date.now();
  const rec  = _suspectTracker.get(userId) || { count: 0, firstAt: now };
  if (now - rec.firstAt > SUSPECT_WINDOW_MS) {
    _suspectTracker.set(userId, { count: 1, firstAt: now });
    return 1;
  }
  rec.count++;
  _suspectTracker.set(userId, rec);
  return rec.count;
}

// ─── جلب context القناة (آخر 5 رسائل) ──────────────────────
async function getChannelContext(msg) {
  try {
    const cached = _channelContext.get(msg.channel.id);
    if (cached && Date.now() - cached._ts < 10_000) return cached.messages;

    const fetched = await msg.channel.messages.fetch({ limit: 6, before: msg.id });
    const messages = [...fetched.values()]
      .filter(m => !m.author.bot && m.id !== msg.id)
      .slice(0, 5)
      .reverse()
      .map(m => `${m.author.username}: ${m.content.slice(0, 120)}`);

    _channelContext.set(msg.channel.id, { messages, _ts: Date.now() });
    return messages;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
//  Gemini Text Analysis — القلب الذكي للنظام
// ═══════════════════════════════════════════════════════════════
async function analyzeWithGemini(msg, db, geminiTextModel) {
  if (!geminiTextModel) return { level: DANGER.SAFE, reason: "لا يوجد نموذج AI" };

  // throttle per user
  const now  = Date.now();
  const last = _userLastCall.get(msg.author.id) || 0;
  if (now - last < USER_THROTTLE_MS) return { level: DANGER.SAFE, reason: "throttle" };
  _userLastCall.set(msg.author.id, now);

  // جلب context
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
    const result = await geminiTextModel.generateContent(prompt);
    const raw    = result.response.text().trim();

    // استخراج JSON من الرد
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لا يوجد JSON في الرد");

    const parsed = JSON.parse(jsonMatch[0]);

    const levelMap = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const level    = levelMap[parsed.level?.toUpperCase()] ?? DANGER.SAFE;

    return {
      level,
      category:   parsed.category || "NONE",
      reason:     parsed.reason   || "محتوى مخالف",
      shouldDelete: parsed.delete !== false,
      confidence: parsed.confidence || 80,
    };
  } catch (e) {
    console.warn("⚠️ [AutoMod] Gemini parse error:", e.message, "| Raw:", (await geminiTextModel.generateContent(prompt).catch(() => null))?.response?.text()?.slice(0, 100));
    return { level: DANGER.SAFE, reason: "خطأ في التحليل" };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Gemini Vision Analysis — تحليل الصور
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
SAFE: صور عادية، مضحكة، ألعاب، أنيمي، طبيعة، أشخاص عاديين، ميمز
MEDIUM: محتوى جنسي ضمني أو عنف معتدل
HIGH: محتوى جنسي صريح أو عنف شديد
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
//  محرك القرار — يحدد الإجراء بناءً على المستوى والتاريخ
// ═══════════════════════════════════════════════════════════════
const TIMEOUT_2H  = 2  * 60 * 60 * 1000;
const TIMEOUT_24H = 24 * 60 * 60 * 1000;

async function executeAction(msg, db, notifyOwner, assessment) {
  const { level, reason, shouldDelete, category } = assessment;
  const member     = msg.member;
  const user       = msg.author;
  const warnings   = db.getWarnings(user.id).length;
  const suspectHits = trackSuspect(user.id);

  // ── LOW: تسجيل فقط بدون تدخل ──────────────────────────────
  if (level === DANGER.LOW) {
    return {
      triggered: true,
      action:    "log_only",
      warnCount: warnings,
      logData:   buildLogData(msg, reason, category, level, 0),
    };
  }

  // ── حفظ محتوى الرسالة قبل الحذف ────────────────────────────
  const savedContent     = msg.content || "";
  const savedAttachments = [...msg.attachments.values()].map(a => a.url);

  // ── حذف الرسالة (MEDIUM+) ───────────────────────────────────
  if (shouldDelete !== false) {
    await msg.delete().catch(() => {});
  }

  // ── MEDIUM: تنبيه هادئ بدون تحذير رسمي ──────────────────────
  if (level === DANGER.MEDIUM) {
    // رسالة في القناة تختفي بعد 8 ثواني
    const notice = await msg.channel.send(
      `> 💬 ${user} رسالتك اتحذفت — **${reason}**\n> حافظ على جو السيرفر 🙏`
    ).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 8_000);

    // DM للمستخدم
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

  // ── HIGH/CRITICAL: تحذير رسمي ──────────────────────────────
  db.addWarning(user.id, reason, "AUTO_MOD");
  const newWarnCount = db.getWarnings(user.id).length;
  let action = "warn";

  // تصعيد العقوبة بناءً على التاريخ والمستوى
  const isRepeatOffender = newWarnCount >= 3 || suspectHits >= 3;
  const isCritical       = level === DANGER.CRITICAL;

  if (isCritical && newWarnCount >= 3) {
    // CRITICAL + تاريخ طويل → باند
    if (member?.bannable) {
      try {
        await member.ban({ reason: `Auto-Mod: ${reason}`, deleteMessageSeconds: 86400 });
        db.addBan(user.id, `Auto-Mod: ${reason}`, "AUTO_MOD");
        action = "ban";
      } catch { action = "owner_report"; }
    } else {
      action = "owner_report";
    }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (isCritical && newWarnCount >= 2) {
    // CRITICAL + تحذيرين → طرد
    if (member?.kickable) {
      try { await member.kick(`Auto-Mod: ${reason}`); action = "kick"; }
      catch { action = "owner_report"; }
    } else {
      action = "owner_report";
    }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (isCritical) {
    // CRITICAL أول مرة → إسكات 24 ساعة
    if (member?.manageable) {
      try { await member.timeout(TIMEOUT_24H, `Auto-Mod: ${reason}`); action = "timeout_24h"; }
      catch { action = "warn"; }
    }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (newWarnCount >= 5) {
    // HIGH + 5 تحذيرات → باند
    if (member?.bannable) {
      try {
        await member.ban({ reason: `Auto-Mod: ${reason}`, deleteMessageSeconds: 86400 });
        db.addBan(user.id, `Auto-Mod: ${reason}`, "AUTO_MOD");
        action = "ban";
      } catch { action = "owner_report"; }
    } else {
      action = "owner_report";
    }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (newWarnCount >= 4) {
    // HIGH + 4 تحذيرات → طرد
    if (member?.kickable) {
      try { await member.kick(`Auto-Mod: ${reason}`); action = "kick"; }
      catch { action = "owner_report"; }
    } else {
      action = "owner_report";
    }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});

  } else if (newWarnCount >= 3 || isRepeatOffender) {
    // HIGH + تكرار → إسكات ساعتين
    if (member?.manageable) {
      try { await member.timeout(TIMEOUT_2H, `Auto-Mod: ${reason}`); action = "timeout"; }
      catch { action = "warn"; }
    }
  }

  // ── رسالة تحذير في القناة ───────────────────────────────────
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

  // ── DM للمستخدم ─────────────────────────────────────────────
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

// ─── بناء بيانات اللوج ────────────────────────────────────────
function buildLogData(msg, reason, category, level, warnCount, savedContent = "", savedAttachments = []) {
  return {
    savedContent,
    savedAttachments,
    userId:      msg.author.id,
    username:    msg.author.username,
    userAvatar:  msg.author.displayAvatarURL(),
    channelId:   msg.channel.id,
    channelName: msg.channel.name || "unknown",
    guildName:   msg.guild?.name || "unknown",
    reason,
    category,
    aiLevel:    DANGER_LABEL[level] || "UNKNOWN",
    warnCount,
    timestamp:  Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
//  scanMessage — الواجهة الرئيسية (نفس الـ interface القديم)
// ═══════════════════════════════════════════════════════════════
export async function scanMessage(msg, db, geminiVisionModel, notifyOwner, geminiTextModel = null) {
  if (msg.author.bot)              return { triggered: false };
  if (config.isOwner(msg.author.id)) return { triggered: false };
  if (!msg.guild)                  return { triggered: false };

  const content = msg.content?.trim() || "";

  // ── Pre-screen: رسائل بيضاء واضحة ────────────────────────
  const isObviouslySafe = SAFE_PRESCREEN.some(rx => rx.test(content));
  const hasText         = content.length > 3;
  const hasImages       = msg.attachments.size > 0 &&
    [...msg.attachments.values()].some(a => a.contentType?.startsWith("image/"));

  if (isObviouslySafe && !hasImages) return { triggered: false };

  // ── Layer 1: Instant Critical Regex ───────────────────────
  if (hasText) {
    for (const pattern of INSTANT_CRITICAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const assessment = {
          level:    DANGER.CRITICAL,
          category: "DANGEROUS_INFO",
          reason:   "محتوى خطير جداً (تشغيل فوري)",
          shouldDelete: true,
          confidence: 100,
        };
        return executeAction(msg, db, notifyOwner, assessment);
      }
    }
  }

  // ── Layer 2: Gemini Text Analysis ─────────────────────────
  let textAssessment = { level: DANGER.SAFE };
  if (hasText && geminiTextModel) {
    textAssessment = await analyzeWithGemini(msg, db, geminiTextModel).catch(() => ({ level: DANGER.SAFE }));
  }

  // ── Layer 3: Image Analysis ───────────────────────────────
  let imageAssessment = { level: DANGER.SAFE };
  if (hasImages && geminiVisionModel) {
    const imageUrls = [...msg.attachments.values()]
      .filter(a => a.contentType?.startsWith("image/"))
      .map(a => a.url);

    const imageResults = await Promise.all(
      imageUrls.map(url => analyzeImageWithGemini(url, geminiVisionModel).catch(() => ({ level: DANGER.SAFE })))
    );

    // خذ أعلى مستوى من الصور
    const maxImageResult = imageResults.reduce(
      (best, cur) => cur.level > best.level ? cur : best,
      { level: DANGER.SAFE }
    );

    if (maxImageResult.level > DANGER.SAFE) {
      imageAssessment = {
        ...maxImageResult,
        category:     "EXPLICIT",
        shouldDelete: true,
      };
    }
  }

  // ── أخذ التقييم الأعلى ───────────────────────────────────
  const finalAssessment = textAssessment.level >= imageAssessment.level
    ? textAssessment
    : imageAssessment;

  // ── SAFE / أقل من threshold ──────────────────────────────
  if (finalAssessment.level === DANGER.SAFE) return { triggered: false };

  // ── LOW: نسجّل بس ─────────────────────────────────────────
  // نوصله لـ index.js عشان يطلع في لوج المشرفين بشكل هادئ
  return executeAction(msg, db, notifyOwner, finalAssessment);
}
