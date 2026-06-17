// ═══════════════════════════════════════════════════════════════
//  نظام Auto-Mod الذكي — زنجي Bot
//  بيشتغل بس على الألفاظ السافلة جداً والصور الإباحية الصريحة
// ═══════════════════════════════════════════════════════════════

import config from "../config.js";

// ── الألفاظ السافلة جداً فقط (ماكس level) ──────────────────────
// مش هنحط كلام خفيف زي: احا / هوه / زفت / وسخ / حيوان / يخرب
// بس الألفاظ الجنسية الصريحة والشتايم القاسية جداً
const EXTREME_BAD_WORDS = [
  // جنسي صريح — عربي
  "كس امك", "كس اختك", "كس ام",
  "ابن الشرموطة", "ابن المتناكة", "ابن الوسخة",
  "شرموطة", "متناكة", "قحبة", "زانية",
  "انيكك", "هنيكك", "بنيك", "اتناك", "نيك امك", "نيك اختك",
  "زب في", "زبي في", "زبك في",
  "طيزك", "طيز امك",
  "عرص ابوك", "خول ابوك",
  // إنجليزي صريح فقط
  "fuck your", "motherfucker", "son of a bitch",
  "nigger", "cunt",
];

// ── بنبني pattern واحد من كل الكلمات ──────────────────────────
// بنستخدم كل كلمة كجملة كاملة مش حرف في النص
const EXTREME_REGEX = new RegExp(
  EXTREME_BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

// مدة الـ timeout بعد التحذير 3: ساعتين
const TIMEOUT_DURATION_MS = 2 * 60 * 60 * 1000;

// ── Gemini image scan — صريح جداً فقط ─────────────────────────
async function isImageExtreme(imageUrl, geminiVisionModel) {
  if (!geminiVisionModel) return false;
  try {
    const res = await fetch(imageUrl);
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
    const txt = result.response.text().trim().toUpperCase();
    return txt.startsWith("YES");
  } catch {
    return false;
  }
}

// ── الفانكشن الرئيسية ───────────────────────────────────────────
/**
 * scanMessage — يفحص الرسالة ويتصرف حسب عدد التحذيرات
 * @param {Message}  msg
 * @param {Database} db
 * @param {Model}    geminiVisionModel
 * @param {Function} notifyOwner   — async fn(userId, member, reason, warnCount)
 * @returns {{ triggered: boolean, action: string }}
 */
export async function scanMessage(msg, db, geminiVisionModel, notifyOwner) {
  if (msg.author.bot) return { triggered: false };
  if (config.isOwner(msg.author.id)) return { triggered: false };
  if (!msg.guild) return { triggered: false };

  let reason = null;

  // 1. فحص النص — سافل جداً فقط
  EXTREME_REGEX.lastIndex = 0;
  if (EXTREME_REGEX.test(msg.content)) {
    reason = "لفظ سافل جداً";
    EXTREME_REGEX.lastIndex = 0;
  }

  // 2. فحص الصور — إباحي صريح فقط
  if (!reason && msg.attachments.size > 0 && geminiVisionModel) {
    for (const att of msg.attachments.values()) {
      if (att.contentType?.startsWith("image/")) {
        const bad = await isImageExtreme(att.url, geminiVisionModel).catch(() => false);
        if (bad) {
          reason = "صورة إباحية أو عنيفة جداً";
          break;
        }
      }
    }
  }

  if (!reason) return { triggered: false };

  // ── مسح الرسالة ─────────────────────────────────────────────
  await msg.delete().catch(() => {});

  // ── إضافة التحذير ────────────────────────────────────────────
  db.addWarning(msg.author.id, reason, "AUTO_MOD");
  const warnings  = db.getWarnings(msg.author.id);
  const warnCount = warnings.length;

  const member = msg.member;
  const user   = msg.author;

  // ── تصعيد العقوبة ────────────────────────────────────────────
  let action = "warn";

  if (warnCount >= 3) {
    if (member && member.manageable) {
      try {
        await member.timeout(TIMEOUT_DURATION_MS, `Auto-Mod: تحذير ${warnCount} — ${reason}`);
        action = "timeout";
      } catch {
        action = "warn";
      }
    }
    if (warnCount > 3) {
      action = "owner_report";
      await notifyOwner(user.id, member, reason, warnCount).catch(() => {});
    }
  }

  // ── تحذير في القناة (يتحذف بعد 8 ثواني) ─────────────────────
  const actionText =
    action === "timeout"      ? "⏰ وأتأسكت لمدة **ساعتين**!" :
    action === "owner_report" ? "⏰ أتأسكت وبلغت الإدارة!" :
                                "لو كررت هتتعاقب أكتر!";

  const warnMsg = await msg.channel
    .send(`⚠️ ${user} | **تحذير ${warnCount}/3** — السبب: ${reason}\n${actionText}`)
    .catch(() => null);

  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 8000);

  // ── DM للعضو ────────────────────────────────────────────────
  const dmLines = [
    `⚠️ **تحذير تلقائي — زنجي Bot**`,
    `السيرفر: **${msg.guild.name}**`,
    `السبب: **${reason}**`,
    `تحذيراتك: **${warnCount}/3**`,
    action === "timeout"
      ? "\n🔇 تم إسكاتك **ساعتين**. لو عدت تاني الإدارة هتقرر مصيرك."
      : action === "owner_report"
      ? "\n🚨 تجاوزت الحد! الإدارة هتقرر مصيرك."
      : "\n📌 الرسالة اتحذفت. تحذير تاني → إسكات ساعتين، وتالت → قرار الإدارة.",
  ];

  user.send(dmLines.join("\n")).catch(() => {});

  return { triggered: true, action, warnCount };
}
