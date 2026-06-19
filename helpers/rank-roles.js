// ═══════════════════════════════════════════════════════════════
//  Rank Roles — إدارة ديناميكية لرتب المستويات
// ═══════════════════════════════════════════════════════════════
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname2   = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH  = path.join(__dirname2, "../data/rank-roles.json");

// الإعدادات الافتراضية
const DEFAULT_RANKS = [
  { level: 50, roleId: "1511588699513557134", name: "Golden🥇" },
  { level: 20, roleId: "1516027382123855922", name: "Silver🥈" },
];

// ── تحميل / حفظ ──────────────────────────────────────────────
function loadRanks() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_RANKS.map(r => ({ ...r }));
}

function saveRanks() {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(_ranks, null, 2), "utf8");
  } catch (e) {
    console.error("❌ [RankRoles] فشل حفظ الإعدادات:", e.message);
  }
}

// ── الحالة الداخلية ───────────────────────────────────────────
let _ranks = loadRanks();
_ranks.sort((a, b) => b.level - a.level); // مرتبين من الأعلى للأدنى

// ── API المُصدَّر ─────────────────────────────────────────────

/** كل الـ ranks مرتبة من الأعلى للأدنى */
export function getRanks() { return _ranks; }

/**
 * إضافة أو تحديث rank
 * @param {number} level  - رقم المستوى
 * @param {string} roleId - الـ ID بتاع الرول
 * @param {string} name   - اسم الرتبة (اختياري)
 * @returns {{ added: boolean, total: number }}
 */
export function addRank(level, roleId, name) {
  const existing = _ranks.find(r => r.level === level);
  let added = false;
  if (existing) {
    existing.roleId = roleId;
    if (name) existing.name = name;
  } else {
    _ranks.push({ level, roleId, name: name || `Level ${level}` });
    added = true;
  }
  _ranks.sort((a, b) => b.level - a.level);
  saveRanks();
  return { added, total: _ranks.length };
}

/**
 * حذف rank بـ level معين
 * @returns {boolean} نجح الحذف أو لأ
 */
export function removeRank(level) {
  const before = _ranks.length;
  _ranks = _ranks.filter(r => r.level !== level);
  if (_ranks.length < before) { saveRanks(); return true; }
  return false;
}

/** رجوع للإعدادات الافتراضية */
export function resetRanks() {
  _ranks = DEFAULT_RANKS.map(r => ({ ...r }));
  _ranks.sort((a, b) => b.level - a.level);
  saveRanks();
  return _ranks;
}
