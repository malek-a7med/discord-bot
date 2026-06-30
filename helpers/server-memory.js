// ════════════════════════════════════════════════════════════════
//  ذاكرة السيرفر الذكية — بوت زنجي  v1.0
//
//  بيجمع أحداث السيرفر طول اليوم (in-memory) وبيعمل ملخص
//  أسبوعي/يومي تلقائي بـ Gemini — مين فاز، أكتر حد كلام، الميمز، إلخ
// ════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DIR   = path.join(__dir, "../data");
const FILE  = path.join(DIR, "server-memory.json");

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

// ─── هيكل البيانات ──────────────────────────────────────────────
function defaultData() {
  return {
    events: [],          // [{type, data, timestamp}]
    messageCounts: {},   // userId → count (لليوم الحالي)
    gameWins: {},        // userId → count
    lastWeeklySummary: null,
    lastDailyReset: Date.now(),
  };
}

function load() {
  try {
    if (!existsSync(FILE)) return defaultData();
    return { ...defaultData(), ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch { return defaultData(); }
}

function save(data) {
  try { writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8"); }
  catch (e) { console.error("[ServerMemory] خطأ حفظ:", e.message); }
}

let _data = load();
const MAX_EVENTS = 500; // عشان الملف ما يكبرش بلا حدود

// ─── تسجيل حدث مهم ──────────────────────────────────────────────
export function recordEvent(type, data) {
  _data.events.push({ type, data, timestamp: Date.now() });
  if (_data.events.length > MAX_EVENTS) {
    _data.events = _data.events.slice(-MAX_EVENTS);
  }
  save(_data);
}

// ─── تسجيل رسالة (للعداد اليومي بس — مش كل رسالة بتتسجل كـ event) ─
export function recordMessage(userId) {
  _data.messageCounts[userId] = (_data.messageCounts[userId] || 0) + 1;
  // نحفظ كل 20 رسالة بس عشان مانكتبش الملف في كل رسالة
  if (Math.random() < 0.05) save(_data);
}

// ─── تسجيل فوز في لعبة ──────────────────────────────────────────
export function recordGameWin(userId, gameType) {
  _data.gameWins[userId] = (_data.gameWins[userId] || 0) + 1;
  recordEvent("game_win", { userId, gameType });
}

// ─── أكتر الناس كلاماً اليوم ────────────────────────────────────
export function getTopChatters(limit = 5) {
  return Object.entries(_data.messageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// ─── أكتر الناس فوزاً ────────────────────────────────────────────
export function getTopWinners(limit = 5) {
  return Object.entries(_data.gameWins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// ─── ريسيت العداد اليومي (يتنادى من cron job) ──────────────────
export function resetDailyCounts() {
  _data.messageCounts = {};
  _data.gameWins = {};
  _data.lastDailyReset = Date.now();
  save(_data);
}

// ─── جيب الأحداث في فترة زمنية معينة ────────────────────────────
export function getEventsInRange(sinceMs) {
  const cutoff = Date.now() - sinceMs;
  return _data.events.filter(e => e.timestamp >= cutoff);
}

// ═══════════════════════════════════════════════════════════════
//  توليد الملخص بـ Gemini
// ═══════════════════════════════════════════════════════════════
export async function generateSummary(geminiTextModel, periodLabel, periodMs, client, guildId) {
  const events = getEventsInRange(periodMs);
  const topChatters = getTopChatters(5);
  const topWinners = getTopWinners(5);

  if (events.length === 0 && topChatters.length === 0) {
    return null; // مفيش حاجة تتلخص
  }

  // حول الـ user IDs لأسماء
  const guild = client.guilds.cache.get(guildId);
  const resolveUsername = async (userId) => {
    try {
      const member = await guild?.members.fetch(userId).catch(() => null);
      return member?.displayName || `يوزر-${userId.slice(-4)}`;
    } catch { return `يوزر-${userId.slice(-4)}`; }
  };

  const topChattersNamed = await Promise.all(
    topChatters.map(async ([id, count]) => `${await resolveUsername(id)}: ${count} رسالة`)
  );
  const topWinnersNamed = await Promise.all(
    topWinners.map(async ([id, count]) => `${await resolveUsername(id)}: ${count} فوز`)
  );

  const eventSummaryLines = events.slice(-50).map(e => {
    switch (e.type) {
      case "game_win":   return `فاز شخص في لعبة ${e.data.gameType}`;
      case "level_up":   return `وصل عضو للمستوى ${e.data.level}`;
      case "new_member": return `عضو جديد انضم`;
      case "ban":        return `تم حظر عضو — السبب: ${e.data.reason || "غير محدد"}`;
      case "achievement":return `فتح عضو إنجاز: ${e.data.achievementName}`;
      default:           return null;
    }
  }).filter(Boolean);

  if (!geminiTextModel) {
    // fallback بدون Gemini — ملخص بسيط
    return buildFallbackSummary(periodLabel, topChattersNamed, topWinnersNamed, eventSummaryLines);
  }

  const prompt = `أنت بوت ديسكورد اسمه زنجي. اكتب ملخص ${periodLabel} ودود وممتع لسيرفر Discord عربي بأسلوب مصري خفيف الظل.

البيانات المتاحة:
أكتر الناس كلاماً: ${topChattersNamed.join(", ") || "مفيش بيانات"}
أكتر الناس فوزاً: ${topWinnersNamed.join(", ") || "مفيش بيانات"}
أحداث مهمة: ${eventSummaryLines.join(" | ") || "مفيش أحداث كبيرة"}

اكتب ملخص قصير (4-6 أسطر) بأسلوب حماسي وودود، استخدم إيموجي مناسبة، خاطب الأعضاء بشكل مباشر. لا تخترع معلومات غير موجودة في البيانات.`;

  try {
    const result = await geminiTextModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.warn("⚠️ [ServerMemory] Gemini فشل:", e.message);
    return buildFallbackSummary(periodLabel, topChattersNamed, topWinnersNamed, eventSummaryLines);
  }
}

function buildFallbackSummary(periodLabel, topChatters, topWinners, events) {
  const lines = [`📊 **ملخص ${periodLabel}**`, ""];
  if (topChatters.length) lines.push(`💬 **أكتر الناس كلاماً:**`, ...topChatters.map(c => `• ${c}`), "");
  if (topWinners.length) lines.push(`🏆 **أكتر الناس فوزاً:**`, ...topWinners.map(w => `• ${w}`), "");
  if (events.length) lines.push(`📌 **أحداث:**`, ...events.slice(0, 10).map(e => `• ${e}`));
  return lines.join("\n");
}
