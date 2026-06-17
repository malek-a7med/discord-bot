// ═══════════════════════════════════════════════════════════════
//  نظام Auto-Mod الذكي — زنجي Bot
//  كشف الألفاظ الوحشة والصور الغلط + تصعيد التحذيرات تلقائياً
// ═══════════════════════════════════════════════════════════════

import config from "../config.js";

// ── قائمة الكلمات الممنوعة ─────────────────────────────────────
const BAD_WORDS = [
  // شتايم عربي شائعة
  "كس", "كوس", "طيز", "زب", "زبي", "نيك", "نيكك", "انيك",
  "متناك", "ابن الشرموطة", "ابن المتناكة", "شرموطة", "عرص",
  "خول", "اتناك", "شغالة", "زانية", "قحبة", "بتاعة",
  "يلعن دينك", "يلعن امك", "يلعن ابوك", "العن دينك",
  "مص", "بهيمة", "حيوان", "وسخ",
  // إنجليزي
  "fuck", "shit", "bitch", "asshole", "nigga", "nigger",
  "cunt", "whore", "slut", "faggot", "bastard",
];

// ── regex مجمّع للأداء ──────────────────────────────────────────
const BAD_WORDS_REGEX = new RegExp(
  BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

// مدة الـ timeout بعد التحذير 3: ساعتين
const TIMEOUT_DURATION_MS = 2 * 60 * 60 * 1000;

// ── Gemini image scan helper ────────────────────────────────────
async function isImageInappropriate(imageUrl, geminiVisionModel) {
  if (!geminiVisionModel) return false;
  try {
    const res = await fetch(imageUrl);
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mime   = res.headers.get("content-type") || "image/jpeg";

    const result = await geminiVisionModel.generateContent([
      {
        inlineData: { data: base64, mimeType: mime },
      },
      "هل هذه الصورة تحتوي على محتوى إباحي أو عاري أو عنيف جداً أو مسيء؟ أجب فقط بـ YES أو NO.",
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
 * @param {Model}    geminiVisionModel   — Gemini vision model (nullable)
 * @param {Function} notifyOwner         — async fn(userId, member, reason, warnCount)
 * @returns {{ triggered: boolean, action: string }}
 */
export async function scanMessage(msg, db, geminiVisionModel, notifyOwner) {
  if (msg.author.bot) return { triggered: false };
  if (config.isOwner(msg.author.id)) return { triggered: false };
  if (!msg.guild) return { triggered: false };

  let reason = null;

  // 1. فحص النص
  if (BAD_WORDS_REGEX.test(msg.content)) {
    reason = `كلام وحش في الرسالة`;
    BAD_WORDS_REGEX.lastIndex = 0;
  }

  // 2. فحص الصور (لو مفيش سبب لسه)
  if (!reason && msg.attachments.size > 0 && geminiVisionModel) {
    for (const att of msg.attachments.values()) {
      if (att.contentType?.startsWith("image/")) {
        const bad = await isImageInappropriate(att.url, geminiVisionModel).catch(() => false);
        if (bad) {
          reason = "صورة غير لائقة";
          break;
        }
      }
    }
  }

  if (!reason) return { triggered: false };

  // ── مسح الرسالة ─────────────────────────────────────────────
  await msg.delete().catch(() => {});

  // ── إضافة التحذير في الداتابيس ──────────────────────────────
  db.addWarning(msg.author.id, reason, "AUTO_MOD");
  const warnings = db.getWarnings(msg.author.id);
  const warnCount = warnings.length;

  const member = msg.member;
  const user   = msg.author;

  // ── اختيار الإجراء حسب عدد التحذيرات ───────────────────────
  let action = "warn";

  if (warnCount >= 3) {
    // تحذير 3: timeout ساعتين
    if (member && member.manageable) {
      try {
        await member.timeout(TIMEOUT_DURATION_MS, `Auto-Mod: تحذير رقم ${warnCount} — ${reason}`);
        action = "timeout";
      } catch {
        action = "warn";
      }
    }
    // لو عنده 4+ تحذيرات بعد الـ timeout → بلغ الأونر
    if (warnCount > 3) {
      action = "owner_report";
      await notifyOwner(user.id, member, reason, warnCount).catch(() => {});
    }
  }

  // ── رسالة تحذير في القناة (تُحذف بعد 8 ثواني) ───────────────
  const actionText =
    action === "timeout"
      ? "⏰ وأتأسكت لمدة **ساعتين**!"
      : action === "owner_report"
      ? "⏰ أتأسكت وبلغت الإدارة لاتخاذ إجراء!"
      : "لو كررت هتتعاقب أكتر!";

  const warnMsg = await msg.channel
    .send(
      `⚠️ ${user} | **تحذير رقم ${warnCount}/3** — السبب: ${reason}\n${actionText}`
    )
    .catch(() => null);

  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 8000);

  // ── DM للعضو ────────────────────────────────────────────────
  const dmLines = [
    `⚠️ **تحذير تلقائي من بوت زنجي**`,
    `السيرفر: **${msg.guild.name}**`,
    `السبب: **${reason}**`,
    `تحذيراتك: **${warnCount}/3**`,
    action === "timeout"
      ? "\n🔇 تم إسكاتك لمدة **ساعتين**. لو عدت تاني هيتم إبلاغ الإدارة!"
      : action === "owner_report"
      ? "\n🚨 تجاوزت الحد! تم إبلاغ الإدارة وهيقرروا مصيرك."
      : "\n📌 الرسالة اتحذفت. تحذير تاني → إسكات ساعتين، وتالت → إبلاغ الإدارة.",
  ];

  user.send(dmLines.join("\n")).catch(() => {});

  return { triggered: true, action, warnCount };
}
