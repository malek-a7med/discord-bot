// ⚜️ نظام الثيم المركزي — زنجي بوت
// Black & Gold Luxury Theme — موحّد لكل الملفات

import { EmbedBuilder } from "discord.js";

// ── لوحة الألوان ─────────────────────────────────────────────────
export const COLORS = {
  GOLD:      0xFFD700,  // الذهبي الرئيسي
  DARK_GOLD: 0xC9A227,  // ذهبي داكن — للثانويات
  PALE_GOLD: 0xF5C518,  // ذهبي فاتح — للـ info
  SUCCESS:   0x2ecc71,  // أخضر — نجاح
  ERROR:     0xe74c3c,  // أحمر — خطأ
  WARNING:   0xf39c12,  // برتقالي — تحذير
  DANGER:    0xc0392b,  // أحمر داكن — باند/حذف
  INFO:      0x3498db,  // أزرق — معلومات
  DARK:      0x1C1C1E,  // أسود داكن — نيوترال
  MARRIAGE:  0xFF1493,  // وردي داكن — الزواج
  HEIST:     0xE67E22,  // برتقالي داكن — النهب
};

export const BOT_NAME = "زنجي بوت";
export const BOT_ICON = "⚜️";

// ── بانيات الفوتر ─────────────────────────────────────────────────
export function footer(extra) {
  return { text: extra ? `${BOT_ICON} ${extra}` : `${BOT_ICON} ${BOT_NAME}` };
}

// ── إيمبد ذهبي رئيسي ──────────────────────────────────────────────
export function goldEmbed(title, description) {
  const e = new EmbedBuilder().setColor(COLORS.GOLD).setFooter(footer()).setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

// ── إيمبد نجاح ────────────────────────────────────────────────────
export function successEmbed(title, description) {
  const e = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`✅ ${title}`)
    .setFooter(footer())
    .setTimestamp();
  if (description) e.setDescription(description);
  return e;
}

// ── إيمبد خطأ ─────────────────────────────────────────────────────
export function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle("❌ حدث خطأ")
    .setDescription(description)
    .setFooter(footer());
}

// ── إيمبد معلومات ──────────────────────────────────────────────────
export function infoEmbed(title, description) {
  const e = new EmbedBuilder()
    .setColor(COLORS.PALE_GOLD)
    .setFooter(footer())
    .setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

// ── شريط التقدم (XP bar) ──────────────────────────────────────────
export function buildXpBar(current, total, length = 12) {
  if (total <= 0) return "▰".repeat(length);
  const pct = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(pct * length);
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

// ── تنسيق الأرقام ────────────────────────────────────────────────
export function fmtNum(n) {
  return Math.floor(n || 0).toLocaleString("en-US");
}
