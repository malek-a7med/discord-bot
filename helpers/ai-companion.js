// ════════════════════════════════════════════════════════════════
//  AI Companion — زنجي Bot  v1.0
//
//  كل عضو عنده "ملف شخصي" بيتذكره زنجي:
//  - اهتماماته، ألقابه، طريقة كلامه
//  - آخر موضوع اتكلمنا فيه
//  - مزاجه المعتاد
//  - إنجازاته في السيرفر
//
//  البيانات دي بتتضاف للـ prompt تلقائياً وبتتحدث مع كل محادثة
// ════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DIR   = path.join(__dir, "../data");
const FILE  = path.join(DIR, "ai-companions.json");

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

// ─── هيكل البيانات الافتراضي لكل يوزر ──────────────────────────
function defaultProfile() {
  return {
    nickname: null,          // الاسم اللي زنجي بيناديه بيه
    interests: [],           // اهتمامات اتكشفت من الكلام ["ألعاب","مانجا"]
    lastTopics: [],          // آخر 5 مواضيع اتكلمنا فيها
    personality: null,       // "جاد"|"مرح"|"حساس"|"عدواني"
    insideFacts: [],         // حاجات خاصة يعرفها زنجي عنه ["بيحب برشلونة"]
    preferredStyle: "مصري", // "مصري"|"رسمي"
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    messageCount: 0,
  };
}

// ─── تحميل وحفظ ─────────────────────────────────────────────────
function load() {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch { return {}; }
}

function save(data) {
  try { writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8"); }
  catch (e) { console.error("[AICompanion] خطأ حفظ:", e.message); }
}

let _data = load();

export function getProfile(userId) {
  if (!_data[userId]) _data[userId] = defaultProfile();
  return _data[userId];
}

export function saveProfile(userId, profile) {
  profile.lastUpdated = Date.now();
  _data[userId] = profile;
  if (Math.random() < 0.1) save(_data); // نحفظ كل 10 محادثات تقريباً
}

export function forceSave() { save(_data); }

// ─── بناء الـ context الشخصي للـ prompt ──────────────────────────
export function buildPersonalContext(userId, username) {
  const p = getProfile(userId);
  if (p.messageCount < 3) return ""; // أول 3 رسائل — مش عندنا info كفاية

  const lines = [];

  if (p.nickname && p.nickname !== username) {
    lines.push(`اسمه اللي بتناديه بيه: "${p.nickname}"`);
  }
  if (p.interests.length > 0) {
    lines.push(`اهتماماته: ${p.interests.slice(0, 5).join("، ")}`);
  }
  if (p.personality) {
    lines.push(`شخصيته المعتادة: ${p.personality}`);
  }
  if (p.insideFacts.length > 0) {
    lines.push(`حاجات بتعرفها عنه: ${p.insideFacts.slice(0, 3).join("، ")}`);
  }
  if (p.lastTopics.length > 0) {
    lines.push(`آخر مواضيع اتكلمتوا فيها: ${p.lastTopics.slice(-3).join("، ")}`);
  }

  if (lines.length === 0) return "";

  return `\n[معلوماتك الشخصية عن ${p.nickname || username}]\n${lines.join("\n")}\nاستخدم المعلومات دي بشكل طبيعي في كلامك بدون ما تذكر إنك بتستخدمها — خليها جزء من شخصيتك.`;
}

// ─── استخراج معلومات جديدة من المحادثة بـ Gemini ─────────────────
export async function extractAndUpdateProfile(userId, username, userMessage, botReply, geminiModel) {
  const p = getProfile(userId);
  p.messageCount++;

  // تحديث بسيط بدون Gemini لأول 5 رسائل
  if (p.messageCount < 5) {
    saveProfile(userId, p);
    return;
  }

  // كل 10 رسائل نستخرج insights جديدة
  if (p.messageCount % 10 !== 0 || !geminiModel) {
    saveProfile(userId, p);
    return;
  }

  try {
    const prompt = `أنت نظام استخراج معلومات. اقرأ الرسالة دي وارجع JSON بس.

اسم المستخدم: ${username}
رسالته: "${userMessage.slice(0, 400)}"
ردك عليها: "${botReply.slice(0, 300)}"

معلوماته الحالية:
${JSON.stringify({ nickname: p.nickname, interests: p.interests, personality: p.personality, insideFacts: p.insideFacts }, null, 1)}

استخرج أي معلومات جديدة عن الشخص من رسالته فقط.

أجب بـ JSON فقط (لا تغير الحقول الموجودة إلا لو في معلومة أفضل):
{
  "nickname": "الاسم اللي بيفضل يتنادى بيه أو null",
  "newInterests": ["اهتمامات جديدة اكتشفتها من الرسالة دي فقط"],
  "personality": "جاد|مرح|حساس|عدواني|null",
  "newFacts": ["حاجات جديدة بتخص الشخص دا تحديداً"],
  "topicOfMessage": "موضوع الرسالة في كلمة أو اتنين"
}`;

    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const extracted = JSON.parse(jsonMatch[0]);

    // دمج المعلومات الجديدة
    if (extracted.nickname && !p.nickname) p.nickname = extracted.nickname;
    if (extracted.personality) p.personality = extracted.personality;
    if (extracted.newInterests?.length) {
      p.interests = [...new Set([...p.interests, ...extracted.newInterests])].slice(0, 15);
    }
    if (extracted.newFacts?.length) {
      p.insideFacts = [...new Set([...p.insideFacts, ...extracted.newFacts])].slice(0, 10);
    }
    if (extracted.topicOfMessage) {
      p.lastTopics.push(extracted.topicOfMessage);
      if (p.lastTopics.length > 10) p.lastTopics.shift();
    }

    saveProfile(userId, p);
    save(_data); // نحفظ فوراً بعد Gemini extraction
  } catch (e) {
    console.warn("⚠️ [AICompanion] Gemini extraction فشل:", e.message);
    saveProfile(userId, p);
  }
}

// ─── أمر /رفيقي — اعرض ملفك الشخصي ──────────────────────────────
export function formatCompanionProfile(userId, username) {
  const p = getProfile(userId);
  const lines = [];

  lines.push(`👤 **اسمك:** ${p.nickname || username}`);
  if (p.personality) lines.push(`🧠 **شخصيتك عندي:** ${p.personality}`);
  if (p.interests.length > 0) lines.push(`🎯 **اهتماماتك:** ${p.interests.join("، ")}`);
  if (p.insideFacts.length > 0) lines.push(`📌 **حاجات أعرفها عنك:** ${p.insideFacts.join("، ")}`);
  if (p.lastTopics.length > 0) lines.push(`💬 **آخر مواضيعنا:** ${p.lastTopics.slice(-5).join("، ")}`);
  lines.push(`📊 **عدد رسائلنا:** ${p.messageCount}`);

  const age = Math.floor((Date.now() - p.createdAt) / (24 * 60 * 60 * 1000));
  lines.push(`📅 **بنتكلم منذ:** ${age} يوم`);

  return lines.join("\n");
}

// ─── حذف الملف الشخصي (طلب المستخدم) ────────────────────────────
export function deleteProfile(userId) {
  delete _data[userId];
  save(_data);
}
