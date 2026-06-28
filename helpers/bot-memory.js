import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir  = dirname(fileURLToPath(import.meta.url));
const DIR    = join(__dir, "../data");
const FILE   = join(DIR, "bot-memory.json");
const MAX_ENTRIES = 200;

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

function getSection(data, userId) {
  if (!data[userId]) data[userId] = {};
  return data[userId];
}

export function memoryRemember(key, value, userId = "global") {
  const data = load();
  const sec  = getSection(data, userId);
  sec[key.trim()] = { value, date: new Date().toISOString() };
  const keys = Object.keys(sec);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => new Date(sec[a].date) - new Date(sec[b].date));
    sorted.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete sec[k]);
  }
  save(data);
  return `تم حفظ: "${key}" = "${value}"`;
}

export function memoryForget(key, userId = "global") {
  const data = load();
  const sec  = getSection(data, userId);
  if (!sec[key.trim()]) return `مش لاقي "${key}" في الذاكرة`;
  delete sec[key.trim()];
  save(data);
  return `تم مسح: "${key}" من الذاكرة`;
}

export function memoryClear(userId = "global") {
  const data = load();
  data[userId] = {};
  save(data);
  return "تم مسح كل الذاكرة";
}

export function memoryGetAll(userId = "global") {
  const data = load();
  return getSection(data, userId);
}

export function memoryToPromptText(userId = "global") {
  const sec     = memoryGetAll(userId);
  const entries = Object.entries(sec);
  if (!entries.length) return "";
  const lines = entries.map(([k, v]) => `• ${k}: ${v.value}`).join("\n");
  return `\nمعلومات مهمة حفظتها من قبل:\n${lines}\n`;
}

export function memorySearch(query, userId = "global") {
  const sec = memoryGetAll(userId);
  const q   = query.toLowerCase();
  return Object.entries(sec).filter(
    ([k, v]) => k.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
  );
}
