// ═══════════════════════════════════════════════════════════════
//  نظام Auto-Mod الذكي — زنجي Bot
//  مرحلتان: regex فوري + Gemini AI للمحتوى المشبوه
// ═══════════════════════════════════════════════════════════════
import config from "../config.js";

// ── الألفاظ السافلة جداً (ماكس level) — regex فوري ────────────
const EXTREME_BAD_WORDS = [
  "كس امك", "كس اختك", "كس ام",
  "ابن الشرموطة", "ابن المتناكة", "ابن الوسخة",
  "شرموطة", "متناكة", "قحبة", "زانية",
  "انيكك", "هنيكك", "بنيك", "اتناك", "نيك امك", "نيك اختك",
  "زب في", "زبي في", "زبك في",
  "طيزك", "طيز امك",
  "عرص ابوك", "خول ابوك",
  "fuck your", "motherfucker", "son of a bitch",
  "nigger", "cunt",
];

const EXTREME_REGEX = new RegExp(
  EXTREME_BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

// ── ألفاظ مشبوهة — تحتاج تأكيد Gemini ─────────────────────────
// (أقل حدة من EXTREME، قد تكون مقبولة في سياق معين)
const SUSPICIOUS_REGEX = /(?:(?:يلعن|ألعن)\s*(?:دين|ربك|نبيك))|(?:هقتلك|هدبحك|هفتكك)|(?:تحرش\s*جنسي)/gi;

const TIMEOUT_DURATION_MS = 2 * 60 * 60 * 1000;

// throttle — max مكالمة Gemini text كل 5 ثواني
let _lastTextCall = 0;

// ── Gemini: فحص الصور ─────────────────────────────────────────
async function isImageExtreme(imageUrl, geminiVisionModel) {
  if (!geminiVisionModel) return false;
  try {
    const res    = await fetch(imageUrl);
    if (!res.ok) return false;
    const buf    = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mime   = res.headers.get("content-type") || "image/jpeg";
    const result = await geminiVisionModel.generateContent([
      { inlineData: { data: base64, mimeType: mime } },
      [
        "أجب فقط بـ YES أو NO بدون أي شرح.",
        "هل هذه الصورة تحتوي على واحد أو أكثر من الآتي:",
        "- محتوى إباحي صريح (عري كامل / أعضاء تناسلية ظاهرة / أفعال جنسية)",
        "- عنف دموي شديد جداً (أشلاء / ذبح / دماء مفرطة)",
        "الصور العادية والمضحكة والكرتون والألعاب والأنيمي العادي = NO.",
      ].join("\n"),
    ]);
    return result.response.text().trim().toUpperCase().startsWith("YES");
  } catch { return false; }
}

// ── Gemini: فحص النصوص المشبوهة ───────────────────────────────
async function isTextHateful(content, geminiTextModel) {
  if (!geminiTextModel) return false;
  const now = Date.now();
  if (now - _lastTextCall < 5000) return false; // throttle
  _lastTextCall = now;
  try {
    const result = await geminiTextModel.generateContent(
      `أجب فقط بـ YES أو NO — بدون أي شرح.\n` +
      `هل هذه الرسالة تحتوي على تهديد جسدي صريح أو مضايقة شخصية شديدة أو تحرش موجه ضد شخص بعينه؟\n` +
      `(الشتيمة العادية، النقد، الكوميديا، التلاسن الاعتيادي، الألفاظ العامة = NO)\n\n` +
      `الرسالة: "${content.slice(0, 400)}"`
    );
    return result.response.text().trim().toUpperCase().startsWith("YES");
  } catch { return false; }
}

/**
 * scanMessage — يفحص الرسالة ويتصرف حسب عدد التحذيرات
 * @param {Message}  msg
 * @param {Database} db
 * @param {Model}    geminiVisionModel
 * @param {Function} notifyOwner
 * @param {Model}    geminiTextModel   — اختياري، لفحص النصوص المشبوهة
 */
export async function scanMessage(msg, db, geminiVisionModel, notifyOwner, geminiTextModel = null) {
  if (msg.author.bot) return { triggered: false };
  if (config.isOwner(msg.author.id)) return { triggered: false };
  if (!msg.guild) return { triggered: false };

  let reason = null;

  // ── 1. regex فوري للألفاظ الشديدة ─────────────────────────
  EXTREME_REGEX.lastIndex = 0;
  if (EXTREME_REGEX.test(msg.content)) {
    reason = "لفظ سافل جداً";
    EXTREME_REGEX.lastIndex = 0;
  }

  // ── 2. فحص الصور (Gemini Vision) ──────────────────────────
  if (!reason && msg.attachments.size > 0 && geminiVisionModel) {
    for (const att of msg.attachments.values()) {
      if (att.contentType?.startsWith("image/")) {
        const bad = await isImageExtreme(att.url, geminiVisionModel).catch(() => false);
        if (bad) { reason = "صورة إباحية أو عنيفة جداً"; break; }
      }
    }
  }

  // ── 3. Gemini Text للمحتوى المشبوه (فقط لو regex اشتبه) ──
  if (!reason && geminiTextModel && msg.content.length > 5) {
    SUSPICIOUS_REGEX.lastIndex = 0;
    const suspicious = SUSPICIOUS_REGEX.test(msg.content);
    SUSPICIOUS_REGEX.lastIndex = 0;
    if (suspicious) {
      const hateful = await isTextHateful(msg.content, geminiTextModel).catch(() => false);
      if (hateful) reason = "محتوى مسيء موجه";
    }
  }

  if (!reason) return { triggered: false };

  // ── حفظ محتوى الرسالة قبل الحذف ───────────────────────────
  const savedContent     = msg.content || "";
  const savedAttachments = [...msg.attachments.values()].map(a => a.url);

  // ── مسح الرسالة ────────────────────────────────────────────
  await msg.delete().catch(() => {});

  // ── إضافة التحذير ──────────────────────────────────────────
  db.addWarning(msg.author.id, reason, "AUTO_MOD");
  const warnings  = db.getWarnings(msg.author.id);
  const warnCount = warnings.length;
  const member = msg.member;
  const user   = msg.author;

  // ── تصعيد العقوبة ──────────────────────────────────────────
  let action = "warn";
  if (warnCount >= 3) {
    if (member && member.manageable) {
      try {
        await member.timeout(TIMEOUT_DURATION_MS, `Auto-Mod: تحذير ${warnCount} — ${reason}`);
        action = "timeout";
      } catch { action = "warn"; }
    }
    if (warnCount > 3) {
      action = "owner_report";
      await notifyOwner(user.id, member, reason, warnCount).catch(() => {});
    }
  }

  const actionText =
    action === "timeout"      ? "⏰ وأتأسكت لمدة **ساعتين**!" :
    action === "owner_report" ? "⏰ أتأسكت وبلغت الإدارة!" :
                                "لو كررت هتتعاقب أكتر!";

  const warnMsg = await msg.channel
    .send(`⚠️ ${user} | **تحذير ${warnCount}/3** — السبب: ${reason}\n${actionText}`)
    .catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 8000);

  user.send([
    `⚠️ **تحذير تلقائي — زنجي Bot**`,
    `السيرفر: **${msg.guild.name}**`,
    `السبب: **${reason}**`,
    `تحذيراتك: **${warnCount}/3**`,
    action === "timeout"
      ? "\n🔇 تم إسكاتك **ساعتين**. لو عدت تاني الإدارة هتقرر مصيرك."
      : action === "owner_report"
      ? "\n🚨 تجاوزت الحد! الإدارة هتقرر مصيرك."
      : "\n📌 الرسالة اتحذفت. تحذير تاني → إسكات ساعتين، وتالت → قرار الإدارة.",
  ].join("\n")).catch(() => {});

  return {
    triggered: true,
    action,
    warnCount,
    logData: {
      savedContent,
      savedAttachments,
      userId:      user.id,
      username:    user.username,
      userAvatar:  user.displayAvatarURL(),
      channelId:   msg.channel.id,
      channelName: msg.channel.name || "unknown",
      guildName:   msg.guild.name,
      reason,
      timestamp:   Date.now(),
    }
  };
}
