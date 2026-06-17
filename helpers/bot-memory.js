// ═══════════════════════════════════════════════════════════════
//  Bot Memory — ذاكرة دائمة تتحفظ على ديسك ومش بتتمسح لما البوت يقفل
// ═══════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir  = dirname(fileURLToPath(import.meta.url));
const DIR    = join(__dir, "../data");
const FILE   = join(DIR, "bot-memory.json");
const MAX_ENTRIES = 200;

// تأكد إن المجلد موجود
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

function load() {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch { return {}; }
}

function save(data) {
  try { writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8"); }
  catch (e) { console.error("[BotMemory] خطأ في الحفظ:", e.message); }
}

// ── API ──────────────────────────────────────────────────────────

export function memoryRemember(key, value) {
  const data = load();
  data[key.trim()] = { value, date: new Date().toISOString() };
  // لو وصلنا للحد، احذف الأقدم
  const keys = Object.keys(data);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => new Date(data[a].date) - new Date(data[b].date));
    sorted.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete data[k]);
  }
  save(data);
  return `تم حفظ: "${key}" = "${value}"`;
}

export function memoryForget(key) {
  const data = load();
  if (!data[key.trim()]) return `مش لاقي "${key}" في الذاكرة`;
  delete data[key.trim()];
  save(data);
  return `تم مسح: "${key}" من الذاكرة`;
}

export function memoryClear() {
  save({});
  return "تم مسح كل الذاكرة";
}

export function memoryGetAll() {
  return load();
}

export function memoryToPromptText() {
  const data = load();
  const entries = Object.entries(data);
  if (!entries.length) return "";
  const lines = entries.map(([k, v]) => `• ${k}: ${v.value}`).join("\n");
  return `\nمعلومات مهمة حفظتها من قبل:\n${lines}\n`;
}

export function memorySearch(query) {
  const data = load();
  const q = query.toLowerCase();
  const results = Object.entries(data).filter(
    ([k, v]) => k.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
  );
  return results;
}
