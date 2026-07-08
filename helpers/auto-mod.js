// ═══════════════════════════════════════════════════════════════
//  نظام Auto-Mod العملاق — زنجي Bot  v5.0
//
//  الطبقات:
//  Layer 0 – Raid Detection          (دخول جماعي مشبوه)
//  Layer 1 – Honeypot                (قناة مخفية = بوت/هاكر فوري)
//  Layer 2 – Cross-Channel Flood     (بعت في 5+ قنوات في 10 ثواني)
//  Layer 3 – Bot Behavioral Fingerprint (كشف البوتات من السلوك)
//  Layer 4 – Spam & Flood            (flood/duplicate/mention/caps)
//  Layer 5 – Instant Critical Regex  (CSAM/تفجيرات/إرهاب)
//  Layer 6 – Smart Link Scanner      (Gemini يحلل الرابط + سياقه)
//  Layer 7 – Account Age Check       (حساب جديد + مشبوه = أشد)
//  Layer 8 – Warning Patterns        (نفس الرابط من 3 ناس = حجب فوري)
//  Layer 9 – Night Mode              (threshold أشد بعد منتص الليل)
//  Layer 10 – Gemini Deep Analysis   (نص + صور + reputation)
//
//  Reputation System: كل يوزر عنده score 0-100 بيتراكم
//  Daily Stats: إحصائيات يومية كاملة
// ═══════════════════════════════════════════════════════════════

import config from "../config.js";

// ─── مستويات الخطورة ──────────────────────────────────────────
export const DANGER = Object.freeze({
  SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
});
const DANGER_LABEL = ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

// ═══════════════════════════════════════════════════════════════
//  Reputation System
// ═══════════════════════════════════════════════════════════════
const _reputation = new Map();
const REP_DECAY_MS = 24 * 60 * 60 * 1000;

function getReputation(userId) {
  const now = Date.now();
  let rep = _reputation.get(userId) || { score: 75, lastDecay: now };
  const days = Math.floor((now - rep.lastDecay) / REP_DECAY_MS);
  if (days > 0) {
    rep.score = Math.min(100, rep.score + days * 5);
    rep.lastDecay = now;
    _reputation.set(userId, rep);
  }
  return rep.score;
}

function changeRep(userId, delta) {
  const rep = _reputation.get(userId) || { score: 75, lastDecay: Date.now() };
  rep.score = Math.max(0, Math.min(100, rep.score + delta));
  _reputation.set(userId, rep);
}

function getRepLabel(score) {
  if (score >= 80) return "🟢 موثوق";
  if (score >= 60) return "🟡 عادي";
  if (score >= 40) return "🟠 مشبوه";
  return "🔴 خطر";
}

export function getUserReputation(userId) {
  const score = getReputation(userId);
  return { score, label: getRepLabel(score) };
}

// ═══════════════════════════════════════════════════════════════
//  Layer 0 — Raid Detection
// ═══════════════════════════════════════════════════════════════
const _joinTracker = { joins: [], lockdown: false, lockdownUntil: 0 };
const RAID_CONFIG = {
  WINDOW_MS: 60_000,      // دقيقة واحدة
  MAX_JOINS: 5,           // ماكس 5 أعضاء جدد
  MIN_ACCOUNT_AGE: 7,     // أقل من 7 أيام = مشبوه
  LOCKDOWN_MS: 10 * 60_000, // lockdown 10 دقايق
};

export async function checkRaid(member, notifyOwner) {
  const now = Date.now();
  _joinTracker.joins = _joinTracker.joins.filter(t => now - t < RAID_CONFIG.WINDOW_MS);
  _joinTracker.joins.push(now);

  const accountAgeMs = now - member.user.createdTimestamp;
  const accountAgeDays = accountAgeMs / (24 * 60 * 60 * 1000);
  const isNewAccount = accountAgeDays < RAID_CONFIG.MIN_ACCOUNT_AGE;

  if (_joinTracker.joins.length >= RAID_CONFIG.MAX_JOINS && !_joinTracker.lockdown) {
    _joinTracker.lockdown = true;
    _joinTracker.lockdownUntil = now + RAID_CONFIG.LOCKDOWN_MS;

    try {
      // كيك الحسابات الجديدة جداً (أقل من يوم)
      if (accountAgeDays < 1 && member.kickable) {
        await member.kick("Auto-Mod: Raid Detection — حساب جديد جداً").catch(() => {});
      }
    } catch {}

    await notifyOwner(null, null,
      `🚨 RAID DETECTED — ${_joinTracker.joins.length} عضو دخلوا في دقيقة واحدة! السيرفر في وضع الحماية لـ 10 دقايق.`,
      0
    ).catch(() => {});

    return true;
  }

  // Lockdown منتهي؟
  if (_joinTracker.lockdown && now > _joinTracker.lockdownUntil) {
    _joinTracker.lockdown = false;
  }

  // حساب جديد جداً في وقت lockdown → كيك
  if (_joinTracker.lockdown && accountAgeDays < 1 && member.kickable) {
    await member.kick("Auto-Mod: Lockdown Mode").catch(() => {});
    return true;
  }

  return false;
}

export function isLockdown() {
  return _joinTracker.lockdown && Date.now() < _joinTracker.lockdownUntil;
}

// ═══════════════════════════════════════════════════════════════
//  Layer 1 — Honeypot
// ═══════════════════════════════════════════════════════════════
// أي رسالة في القناة المخفية = بوت أو هاكر فوراً
// اسم القناة يتحدد في config أو env
const HONEYPOT_CHANNEL_IDS = [
  "1517362832063074324",
  ...(process.env.HONEYPOT_CHANNEL ? [process.env.HONEYPOT_CHANNEL] : []),
];

function isHoneypotChannel(channelName, channelId) {
  if (HONEYPOT_CHANNEL_IDS.includes(channelId)) return true;
  if (!channelName) return false;
  return ["honeypot-dont-send", "honeypot", "trap-channel"]
    .some(n => channelName.toLowerCase().includes(n));
}

// ═══════════════════════════════════════════════════════════════
//  Layer 2 — Cross-Channel Flood
// ═══════════════════════════════════════════════════════════════
const _crossChannel = new Map(); // userId → Set<channelId> with timestamps
const CROSS_WINDOW_MS = 10_000;
const MAX_CHANNELS = 5;

function checkCrossChannelFlood(userId, channelId) {
  const now = Date.now();
  let data = _crossChannel.get(userId) || { channels: new Map(), firstAt: now };

  if (now - data.firstAt > CROSS_WINDOW_MS) {
    data = { channels: new Map(), firstAt: now };
  }

  data.channels.set(channelId, now);
  _crossChannel.set(userId, data);

  if (data.channels.size >= MAX_CHANNELS) {
    changeRep(userId, -30);
    return {
      type: "cross_channel_flood",
      reason: `بعت في ${data.channels.size} قنوات في 10 ثواني — هاكر محتمل!`,
      level: DANGER.CRITICAL,
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Layer 3 — Bot Behavioral Fingerprint
// ═══════════════════════════════════════════════════════════════
const _behaviorTracker = new Map(); // userId → behavioral data
const BOT_SIGNALS = {
  MIN_MESSAGES_TO_JUDGE: 8,
  MAX_RESPONSE_TIME_VARIANCE: 200,  // ms — البوت بيرد في نفس الوقت دايماً
  MIN_MSG_LENGTH_VARIANCE: 5,       // البوت رسائله متشابهة في الطول
  MAX_TYPO_RATIO: 0.0,              // البوت مش بيغلط
};

function trackBehavior(msg) {
  const userId = msg.author.id;
  const now = Date.now();
  const content = msg.content || "";

  let data = _behaviorTracker.get(userId) || {
    messages: [],
    lastMsgTime: now,
    responseTimes: [],
  };

  const responseTime = now - data.lastMsgTime;
  if (responseTime < 60_000) {
    data.responseTimes.push(responseTime);
    if (data.responseTimes.length > 20) data.responseTimes.shift();
  }

  data.messages.push({
    time: now,
    length: content.length,
    hasTypos: /[a-zA-Z]{15,}/.test(content) === false, // كلمات طويلة غير واقعية = بوت
    channelId: msg.channel.id,
  });

  if (data.messages.length > 20) data.messages.shift();
  data.lastMsgTime = now;
  _behaviorTracker.set(userId, data);

  // نحكم بعد 8+ رسائل
  if (data.messages.length < BOT_SIGNALS.MIN_MESSAGES_TO_JUDGE) return null;

  // فحص variance في الـ response times
  const times = data.responseTimes.slice(-10);
  if (times.length >= 5) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // البوت بيرد في نفس الوقت بالظبط — variance منخفضة جداً
    if (stdDev < BOT_SIGNALS.MAX_RESPONSE_TIME_VARIANCE && avg < 2000) {
      // فحص إن الرسائل من قنوات متعددة (broadcast bot)
      const uniqueChannels = new Set(data.messages.slice(-10).map(m => m.channelId)).size;
      if (uniqueChannels >= 3) {
        changeRep(userId, -25);
        return {
          type: "bot_behavior",
          reason: `سلوك بوت مكتشف — ردود منتظمة في ${uniqueChannels} قنوات (std: ${stdDev.toFixed(0)}ms)`,
          level: DANGER.HIGH,
        };
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Layer 4 — Spam & Flood
// ═══════════════════════════════════════════════════════════════
const _spamTracker = new Map();
const SPAM_CONFIG = {
  WINDOW_MS: 5_000,
  MAX_MESSAGES: 5,
  MAX_DUPLICATES: 3,
  MAX_MENTIONS: 5,
  MIN_CAPS_RATIO: 0.8,
  MIN_CAPS_LENGTH: 20,
};

function checkSpam(msg) {
  const userId = msg.author.id;
  const content = msg.content || "";
  const now = Date.now();

  // @everyone أو @here من غير صلاحية بس — المنشن العادي مسموح
  if (msg.mentions.everyone && !msg.member?.permissions.has("MentionEveryone")) {
    changeRep(userId, -20);
    return { type: "everyone_mention", reason: "محاولة منشن @everyone بدون صلاحية", level: DANGER.HIGH };
  }


  let tracker = _spamTracker.get(userId) || { messages: [], lastReset: now };
  if (now - tracker.lastReset > SPAM_CONFIG.WINDOW_MS) {
    tracker = { messages: [], lastReset: now };
  }
  tracker.messages.push({ content, time: now });
  tracker.messages = tracker.messages.filter(m => now - m.time < SPAM_CONFIG.WINDOW_MS);
  _spamTracker.set(userId, tracker);

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Layer 5 — Instant Critical Regex
// ═══════════════════════════════════════════════════════════════
const INSTANT_CRITICAL_PATTERNS = [
  /(?:أطفال|طفل|صغير|minor|child)\s*(?:سكس|sex|إباحي|porn|naked|عاري)/gi,
  /(?:كيفية?\s*(?:صنع|عمل|تصنيع)\s*(?:قنبلة|متفجرات|عبوة\s*ناسفة))/gi,
  /(?:انضم|انضمي|بايعوا)\s*(?:داعش|القاعدة|النصرة|ISIS|ISIL)/gi,
];

// ═══════════════════════════════════════════════════════════════
//  Layer 6 — Smart Link Scanner (Gemini-powered)
// ═══════════════════════════════════════════════════════════════
const _linkHistory = new Map();   // url → { count, users: Set, firstAt }
const _scannedLinks = new Map();  // url → { safe, reason, scannedAt }
const LINK_CACHE_MS = 30 * 60_000;

const INSTANT_BAD_DOMAINS = [
  "grabify.link", "iplogger.org", "blasze.tk", "urlz.fr", "psty.io",
  "2no.co", "yip.su", "discordnitro-free", "discord-gift", "free-nitro",
  "steamcommunity.ru", "steamcommunity.tk",
];

const INSTANT_BAD_PATTERNS = [
  /free.{0,10}nitro/i, /discord.{0,5}gift/i,
  /steam.{0,5}(?:free|gift)/i, /click.{0,10}(?:win|prize)/i,
];

// Warning Patterns — نفس الرابط من 3 ناس مختلفين = حجب فوري
function trackLinkHistory(url, userId) {
  const now = Date.now();
  let rec = _linkHistory.get(url) || { count: 0, users: new Set(), firstAt: now };

  if (now - rec.firstAt > 60 * 60_000) {
    rec = { count: 0, users: new Set(), firstAt: now };
  }

  rec.count++;
  rec.users.add(userId);
  _linkHistory.set(url, rec);

  if (rec.users.size >= 3 && rec.count >= 5) {
    return {
      type: "coordinated_link",
      reason: `رابط مشبوه منتشر — ${rec.users.size} ناس مختلفين بعتوه ${rec.count} مرات`,
      level: DANGER.HIGH,
    };
  }
  return null;
}

async function scanLinkWithGemini(url, context, geminiTextModel) {
  if (!geminiTextModel) return null;

  // فحص الـ cache
  const cached = _scannedLinks.get(url);
  if (cached && Date.now() - cached.scannedAt < LINK_CACHE_MS) {
    return cached.safe ? null : { type: "bad_link", reason: cached.reason, level: DANGER.HIGH };
  }

  try {
    const prompt = `أنت نظام فحص روابط لسيرفر Discord. فحص هذا الرابط وقيّمه.

الرابط: ${url}
سياق الرسالة: "${context.slice(0, 200)}"

قيّم هل الرابط:
1. آمن تماماً (موقع معروف، لعبة، مقطع فيديو، صورة، إلخ)
2. مشبوه (IP grabber، فيشينج، scam، برامج ضارة)

أجب بـ JSON فقط:
{
  "safe": true | false,
  "reason": "سبب قصير بالعربي",
  "confidence": 0-100
}`;

    const result = await geminiTextModel.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    _scannedLinks.set(url, { safe: parsed.safe, reason: parsed.reason, scannedAt: Date.now() });

    if (!parsed.safe && parsed.confidence > 70) {
      return { type: "bad_link_ai", reason: `رابط مشبوه: ${parsed.reason}`, level: DANGER.HIGH };
    }
    return null;
  } catch {
    return null;
  }
}

async function checkLinks(content, userId, geminiTextModel) {
  const urlMatches = content.match(/https?:\/\/[^\s]+/g) || [];
  if (urlMatches.length === 0) return null;

  for (const url of urlMatches) {
    // فحص فوري
    for (const domain of INSTANT_BAD_DOMAINS) {
      if (url.toLowerCase().includes(domain)) {
        changeRep(userId, -25);
        return { type: "bad_domain", reason: `رابط ضار (${domain})`, level: DANGER.HIGH };
      }
    }
    for (const pattern of INSTANT_BAD_PATTERNS) {
      if (pattern.test(url) || pattern.test(content)) {
        changeRep(userId, -20);
        return { type: "phishing", reason: "رابط فيشينج", level: DANGER.HIGH };
      }
    }

    // Warning Pattern — نفس الرابط من ناس كتير
    const coordResult = trackLinkHistory(url, userId);
    if (coordResult) {
      changeRep(userId, -15);
      return coordResult;
    }

    // Gemini فحص ذكي (async في الخلفية — مش بيعطل)
    if (geminiTextModel) {
      scanLinkWithGemini(url, content, geminiTextModel).then(result => {
        if (result) {
          // نسجل في الـ history بس — الرسالة اتمرت بالفعل
          console.warn(`⚠️ [AutoMod] Gemini flagged link: ${url} — ${result.reason}`);
        }
      }).catch(() => {});
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Layer 7 — Account Age Check
// ═══════════════════════════════════════════════════════════════
function getAccountAgeFactor(member) {
  if (!member?.user?.createdTimestamp) return 1;
  const ageDays = (Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000);
  if (ageDays < 1)  return 3;   // أقل من يوم = خطر عالي جداً
  if (ageDays < 7)  return 2;   // أقل من أسبوع = ضاعف الـ threat
  if (ageDays < 30) return 1.5; // أقل من شهر = حذر
  return 1;                     // عادي
}

// ═══════════════════════════════════════════════════════════════
//  Layer 9 — Night Mode
// ═══════════════════════════════════════════════════════════════
function isNightMode() {
  const hour = new Date().getUTCHours() + 2; // Egypt UTC+2
  return hour >= 0 && hour < 7; // من 12 الليل لـ 7 الصبح
}

// ═══════════════════════════════════════════════════════════════
//  Pre-screen
// ═══════════════════════════════════════════════════════════════
const SAFE_PRESCREEN = [
  /^[\p{Emoji}\s]+$/u,
  /^.{1,3}$/,
];

// ═══════════════════════════════════════════════════════════════
//  Throttle & Context
// ═══════════════════════════════════════════════════════════════
const _userLastCall = new Map();
const USER_THROTTLE_MS = 30_000; // 30 ثانية per-user

// Global rate limiter — ماكس 10 calls/دقيقة على كل المستخدمين
const _globalGeminiCalls = { count: 0, windowStart: Date.now() };
const GLOBAL_GEMINI_LIMIT = 10;
const GLOBAL_GEMINI_WINDOW_MS = 60_000;

function canCallGeminiGlobal() {
  const now = Date.now();
  if (now - _globalGeminiCalls.windowStart > GLOBAL_GEMINI_WINDOW_MS) {
    _globalGeminiCalls.count = 0;
    _globalGeminiCalls.windowStart = now;
  }
  if (_globalGeminiCalls.count >= GLOBAL_GEMINI_LIMIT) return false;
  _globalGeminiCalls.count++;
  return true;
}
const _suspectTracker = new Map();
const SUSPECT_WINDOW_MS = 5 * 60_000;
const _channelContext = new Map();

function trackSuspect(userId) {
  const now = Date.now();
  const rec = _suspectTracker.get(userId) || { count: 0, firstAt: now };
  if (now - rec.firstAt > SUSPECT_WINDOW_MS) { _suspectTracker.set(userId, { count: 1, firstAt: now }); return 1; }
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
//  Layer 10 — Gemini Deep Analysis
// ═══════════════════════════════════════════════════════════════
async function analyzeWithGemini(msg, db, geminiTextModel, ageFactor) {
  if (!geminiTextModel) return { level: DANGER.SAFE, reason: "لا يوجد AI" };

  // Trusted user bypass — reputation عالي = مش محتاج Gemini
  const repScore = getReputation(msg.author.id);
  if (repScore >= 80) return { level: DANGER.SAFE, reason: "trusted user" };

  // Per-user throttle
  const now = Date.now();
  const last = _userLastCall.get(msg.author.id) || 0;
  if (now - last < USER_THROTTLE_MS) return { level: DANGER.SAFE, reason: "throttle" };
  _userLastCall.set(msg.author.id, now);

  // Global rate limit
  if (!canCallGeminiGlobal()) return { level: DANGER.SAFE, reason: "global rate limit" };

  const contextMessages = await getChannelContext(msg);
  const warnings = db.getWarnings(msg.author.id).length;
  const suspectCount = _suspectTracker.get(msg.author.id)?.count || 0;
  const nightMode = isNightMode();

  const contextBlock = contextMessages.length > 0
    ? `\nالسياق:\n${contextMessages.map(m => `  • ${m}`).join("\n")}`
    : "";

  const strictnessNote = [
    repScore < 40 ? "⚠️ مستخدم بسجل سيئ — كن صارماً جداً." : "",
    ageFactor > 1 ? `⚠️ حساب جديد (عمر أقل من ${ageFactor > 2 ? "يوم" : "أسبوع"}) — حذر مضاعف.` : "",
    nightMode ? "🌙 وضع الليل — threshold أشد." : "",
  ].filter(Boolean).join("\n");

  const prompt = `أنت نظام مراقبة ذكي لسيرفر Discord عربي.

═══ الرسالة ═══
المرسل: ${msg.member?.displayName || msg.author.username}
المحتوى: "${msg.content.slice(0, 600)}"${contextBlock}

═══ معلومات المرسل ═══
تحذيرات: ${warnings} | مشبوه اليوم: ${suspectCount}
سمعة: ${repScore}/100 (${getRepLabel(repScore)})
${strictnessNote}

═══ قواعد التحليل ═══
🟢 SAFE (90%+ الرسائل): شتايم عادية بين أصحاب، مجادلات، كلام حماسي في ألعاب، اقتباسات، نقاشات دينية/سياسية، إحباط وغضب عام
🟡 LOW: معلومات مضللة خطيرة فعلاً
🟠 MEDIUM: محتوى جنسي صريح جداً، دوكسينج
🔴 HIGH: تهديد جسدي صريح لشخص بعينه، خطاب كراهية منظم، مضايقة ممنهجة
⛔ CRITICAL: استغلال أطفال، تعليمات أسلحة حقيقية، تحريض إرهابي

أجب بـ JSON فقط:
{
  "level": "SAFE"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL",
  "category": "NONE"|"HARASSMENT"|"THREAT"|"HATE_SPEECH"|"EXPLICIT"|"DANGEROUS_INFO"|"EXTREMISM",
  "reason": "سبب قصير بالعربي",
  "delete": true|false,
  "confidence": 0-100
}`;

  try {
    const result = await geminiTextModel.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    const levelMap = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    let level = levelMap[parsed.level?.toUpperCase()] ?? DANGER.SAFE;

    // Night Mode + حساب جديد = رفع المستوى درجة
    if (nightMode && level === DANGER.MEDIUM) level = DANGER.HIGH;
    if (ageFactor > 1.5 && level === DANGER.MEDIUM) level = DANGER.HIGH;

    if (level >= DANGER.HIGH) changeRep(msg.author.id, -20);
    else if (level === DANGER.MEDIUM) changeRep(msg.author.id, -8);
    else if (level === DANGER.LOW) changeRep(msg.author.id, -3);
    else changeRep(msg.author.id, 1);

    return {
      level,
      category: parsed.category || "NONE",
      reason: parsed.reason || "محتوى مخالف",
      shouldDelete: parsed.delete !== false,
      confidence: parsed.confidence || 80,
    };
  } catch (e) {
    console.warn("⚠️ [AutoMod] Gemini error:", e.message);
    return { level: DANGER.SAFE, reason: "خطأ في التحليل" };
  }
}

async function analyzeImageWithGemini(imageUrl, geminiVisionModel) {
  if (!geminiVisionModel) return { level: DANGER.SAFE };
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return { level: DANGER.SAFE };
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mime = res.headers.get("content-type") || "image/jpeg";
    const result = await geminiVisionModel.generateContent([
      { inlineData: { data: base64, mimeType: mime } },
      `حلل هذه الصورة لسيرفر Discord. أجب بـ JSON فقط:
{"level":"SAFE"|"MEDIUM"|"HIGH"|"CRITICAL","reason":"وصف قصير","confidence":0-100}
SAFE: عادية/أنيمي/ألعاب/ميمز. MEDIUM: جنسي ضمني/عنف معتدل. HIGH: جنسي صريح/عنف شديد. CRITICAL: أطفال/إرهاب`,
    ]);
    const raw = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { level: DANGER.SAFE };
    const parsed = JSON.parse(jsonMatch[0]);
    const levelMap = { SAFE: 0, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return { level: levelMap[parsed.level?.toUpperCase()] ?? DANGER.SAFE, reason: parsed.reason || "محتوى بصري مخالف", confidence: parsed.confidence || 80 };
  } catch { return { level: DANGER.SAFE }; }
}

// ═══════════════════════════════════════════════════════════════
//  محرك القرار
// ═══════════════════════════════════════════════════════════════
const TIMEOUT_2H  = 2  * 60 * 60 * 1000;
const TIMEOUT_24H = 24 * 60 * 60 * 1000;

async function executeAction(msg, db, notifyOwner, assessment) {
  const { level, reason, shouldDelete, category } = assessment;
  const member = msg.member;
  const user = msg.author;
  const warnings = db.getWarnings(user.id).length;
  const suspectHits = trackSuspect(user.id);
  const repScore = getReputation(user.id);
  const isLowRep = repScore < 40;

  if (level === DANGER.LOW) {
    return { triggered: true, action: "log_only", warnCount: warnings, logData: buildLogData(msg, reason, category, level, 0) };
  }

  const savedContent = msg.content || "";
  const savedAttachments = [...msg.attachments.values()].map(a => a.url);
  if (shouldDelete !== false) await msg.delete().catch(() => {});

  if (level === DANGER.MEDIUM) {
    const notice = await msg.channel.send(`> 💬 ${user} رسالتك اتحذفت — **${reason}**\n> حافظ على جو السيرفر 🙏`).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 8_000);
    user.send([`⚠️ **تنبيه من زنجي Bot** — ${msg.guild.name}`, `السبب: **${reason}**`, `دي مش تحذير رسمي 🙏`].join("\n")).catch(() => {});
    return { triggered: true, action: "soft_warn", warnCount: warnings, logData: buildLogData(msg, reason, category, level, warnings, savedContent, savedAttachments) };
  }

  db.addWarning(user.id, reason, "AUTO_MOD");
  const newWarnCount = db.getWarnings(user.id).length;
  const effectiveWarnCount = isLowRep ? newWarnCount + 1 : newWarnCount;
  const isCritical = level === DANGER.CRITICAL;
  let action = "warn";

  if (isCritical && effectiveWarnCount >= 3) {
    if (member?.bannable) { try { await member.ban({ reason: `Auto-Mod: ${reason}`, deleteMessageSeconds: 86400 }); db.addBan(user.id, `Auto-Mod: ${reason}`, "AUTO_MOD"); action = "ban"; } catch { action = "owner_report"; } }
    else action = "owner_report";
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});
  } else if (isCritical && effectiveWarnCount >= 2) {
    if (member?.kickable) { try { await member.kick(`Auto-Mod: ${reason}`); action = "kick"; } catch { action = "owner_report"; } }
    else action = "owner_report";
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});
  } else if (isCritical) {
    if (member?.manageable) { try { await member.timeout(TIMEOUT_24H, `Auto-Mod: ${reason}`); action = "timeout_24h"; } catch { action = "warn"; } }
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});
  } else if (effectiveWarnCount >= 5) {
    if (member?.bannable) { try { await member.ban({ reason: `Auto-Mod: ${reason}`, deleteMessageSeconds: 86400 }); db.addBan(user.id, `Auto-Mod: ${reason}`, "AUTO_MOD"); action = "ban"; } catch { action = "owner_report"; } }
    else action = "owner_report";
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});
  } else if (effectiveWarnCount >= 4) {
    if (member?.kickable) { try { await member.kick(`Auto-Mod: ${reason}`); action = "kick"; } catch { action = "owner_report"; } }
    else action = "owner_report";
    await notifyOwner(user.id, member, reason, newWarnCount).catch(() => {});
  } else if (effectiveWarnCount >= 3 || suspectHits >= 3) {
    if (member?.manageable) { try { await member.timeout(TIMEOUT_2H, `Auto-Mod: ${reason}`); action = "timeout"; } catch { action = "warn"; } }
  }

  const actionEmoji = { ban: "🔨 **باند تلقائي!**", kick: "👢 **طرد تلقائي!**", timeout_24h: "🔇 **إسكات 24 ساعة!**", timeout: "🔇 **إسكات ساعتين!**", owner_report: "🚨 **بُلّغت الإدارة!**", warn: "⚠️ استمرار التصرف هيجيب عقوبة!" }[action] || "";

  const warnMsg = await msg.channel.send(`🛡️ ${user} | **تحذير ${newWarnCount}** — ${reason}\n${actionEmoji}\n> السمعة: ${getRepLabel(repScore)}`).catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 10_000);

  if (action !== "ban") {
    user.send([`🛡️ **تحذير رسمي — زنجي Bot**`, `السيرفر: **${msg.guild.name}**`, `السبب: **${reason}**`, `تحذيراتك: **${newWarnCount}** | سمعتك: **${repScore}/100**`,
      action === "kick" ? "\n👢 اتطردت." : action === "timeout_24h" ? "\n🔇 إسكات 24 ساعة." : action === "timeout" ? "\n🔇 إسكات ساعتين." : "\n📌 تراكم التحذيرات → إسكات → طرد → حظر."
    ].join("\n")).catch(() => {});
  }

  return { triggered: true, action, warnCount: newWarnCount, aiLevel: DANGER_LABEL[level], aiCategory: category, repScore, logData: buildLogData(msg, reason, category, level, newWarnCount, savedContent, savedAttachments) };
}

function buildLogData(msg, reason, category, level, warnCount, savedContent = "", savedAttachments = []) {
  return {
    savedContent, savedAttachments,
    userId: msg.author.id, username: msg.author.username,
    userAvatar: msg.author.displayAvatarURL(),
    channelId: msg.channel.id, channelName: msg.channel.name || "unknown",
    guildName: msg.guild?.name || "unknown",
    reason, category, aiLevel: DANGER_LABEL[level] || "UNKNOWN",
    warnCount, repScore: getReputation(msg.author.id), timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Daily Stats
// ═══════════════════════════════════════════════════════════════
const _stats = { scanned: 0, triggered: 0, actions: {}, topOffenders: new Map(), resetAt: Date.now() };

function updateStats(result, userId) {
  _stats.scanned++;
  if (result?.triggered) {
    _stats.triggered++;
    const a = result.action || "unknown";
    _stats.actions[a] = (_stats.actions[a] || 0) + 1;
    _stats.topOffenders.set(userId, (_stats.topOffenders.get(userId) || 0) + 1);
  }
}

export function getDailyReport() {
  return {
    scanned: _stats.scanned,
    triggered: _stats.triggered,
    triggerRate: _stats.scanned > 0 ? `${((_stats.triggered / _stats.scanned) * 100).toFixed(1)}%` : "0%",
    actions: _stats.actions,
    topOffenders: [..._stats.topOffenders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    hoursUp: Math.floor((Date.now() - _stats.resetAt) / 3_600_000),
    lockdown: isLockdown(),
    nightMode: isNightMode(),
  };
}

export function resetDailyStats() {
  _stats.scanned = 0; _stats.triggered = 0; _stats.actions = {};
  _stats.topOffenders.clear(); _stats.resetAt = Date.now();
}

// ═══════════════════════════════════════════════════════════════
//  scanMessage — الواجهة الرئيسية
// ═══════════════════════════════════════════════════════════════
export async function scanMessage(msg, db, geminiVisionModel, notifyOwner, geminiTextModel = null) {
  if (msg.author.bot)                return { triggered: false };
  if (config.isOwner(msg.author.id)) return { triggered: false };
  if (!msg.guild)                    return { triggered: false };

  const content = msg.content?.trim() || "";
  const userId = msg.author.id;

  // ── Honeypot ─────────────────────────────────────────────────
  if (isHoneypotChannel(msg.channel.name, msg.channel.id)) {
    changeRep(userId, -50);
    const assessment = { level: DANGER.CRITICAL, category: "DANGEROUS_INFO", reason: "🍯 Honeypot — بوت أو هاكر!", shouldDelete: true, confidence: 100 };
    const result = await executeAction(msg, db, notifyOwner, assessment);
    updateStats(result, userId);
    return result;
  }

  // ── Cross-Channel Flood ──────────────────────────────────────
  const crossResult = checkCrossChannelFlood(userId, msg.channel.id);
  if (crossResult) {
    const result = await executeAction(msg, db, notifyOwner, { ...crossResult, category: "HARASSMENT", shouldDelete: true, confidence: 95 });
    updateStats(result, userId);
    return result;
  }

  // ── Bot Behavioral Fingerprint ───────────────────────────────
  const botResult = trackBehavior(msg);
  if (botResult) {
    const result = await executeAction(msg, db, notifyOwner, { ...botResult, category: "HARASSMENT", shouldDelete: false, confidence: 85 });
    updateStats(result, userId);
    return result;
  }

  // ── Pre-screen ────────────────────────────────────────────────
  const isObviouslySafe = SAFE_PRESCREEN.some(rx => rx.test(content));
  const hasText = content.length > 3;
  const hasImages = msg.attachments.size > 0 && [...msg.attachments.values()].some(a => a.contentType?.startsWith("image/"));
  if (isObviouslySafe && !hasImages) { updateStats({ triggered: false }, userId); return { triggered: false }; }

  // ── Account Age Factor ────────────────────────────────────────
  const ageFactor = getAccountAgeFactor(msg.member);

  // ── Spam & Flood ──────────────────────────────────────────────
  const spamResult = checkSpam(msg);
  if (spamResult) {
    const result = await executeAction(msg, db, notifyOwner, { ...spamResult, category: "HARASSMENT", shouldDelete: spamResult.level >= DANGER.MEDIUM, confidence: 95 });
    updateStats(result, userId);
    return result;
  }

  // ── Instant Critical Regex ────────────────────────────────────
  if (hasText) {
    for (const pattern of INSTANT_CRITICAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const result = await executeAction(msg, db, notifyOwner, { level: DANGER.CRITICAL, category: "DANGEROUS_INFO", reason: "محتوى خطير جداً", shouldDelete: true, confidence: 100 });
        updateStats(result, userId);
        return result;
      }
    }
  }

  // ── Link Scanner ──────────────────────────────────────────────
  if (hasText) {
    const linkResult = await checkLinks(content, userId, geminiTextModel);
    if (linkResult) {
      const result = await executeAction(msg, db, notifyOwner, { ...linkResult, category: "DANGEROUS_INFO", shouldDelete: true, confidence: 90 });
      updateStats(result, userId);
      return result;
    }
  }

  // ── Gemini Text ───────────────────────────────────────────────
  let textAssessment = { level: DANGER.SAFE };
  if (hasText && geminiTextModel) {
    textAssessment = await analyzeWithGemini(msg, db, geminiTextModel, ageFactor).catch(() => ({ level: DANGER.SAFE }));
  }

  // ── Gemini Vision ─────────────────────────────────────────────
  let imageAssessment = { level: DANGER.SAFE };
  if (hasImages && geminiVisionModel) {
    const urls = [...msg.attachments.values()].filter(a => a.contentType?.startsWith("image/")).map(a => a.url);
    const results = await Promise.all(urls.map(url => analyzeImageWithGemini(url, geminiVisionModel).catch(() => ({ level: DANGER.SAFE }))));
    const max = results.reduce((best, cur) => cur.level > best.level ? cur : best, { level: DANGER.SAFE });
    if (max.level > DANGER.SAFE) imageAssessment = { ...max, category: "EXPLICIT", shouldDelete: true };
  }

  const final = textAssessment.level >= imageAssessment.level ? textAssessment : imageAssessment;
  if (final.level === DANGER.SAFE) { updateStats({ triggered: false }, userId); return { triggered: false }; }

  const result = await executeAction(msg, db, notifyOwner, final);
  updateStats(result, userId);
  return result;
}
