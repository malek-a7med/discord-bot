// ═══════════════════════════════════════════════════════════════
//  Gemini Key Rotator — بيدور على المفاتيح أوتوماتيك لو 429
// ═══════════════════════════════════════════════════════════════
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── جمع كل المفاتيح الموجودة في الـ env ──────────────────────
function collectKeys() {
  const keys = [];
  if (process.env.GOOGLE_API_KEY)   keys.push(process.env.GOOGLE_API_KEY);
  let i = 2;
  while (process.env[`GOOGLE_API_KEY_${i}`]) {
    keys.push(process.env[`GOOGLE_API_KEY_${i}`]);
    i++;
  }
  return keys;
}

// ── حالة كل مفتاح ────────────────────────────────────────────
const exhaustedKeys = new Set(); // المفاتيح اللي خلصت دلوقتي
let _currentIndex = 0;           // فهرس الدوران الحالي

function isExhausted(key) {
  return exhaustedKeys.has(key);
}

function markExhausted(key) {
  exhaustedKeys.add(key);
  console.warn(`⚠️ [GeminiKeys] المفتاح ${key.slice(-6)} وصل للحد — بيتحول للتالي`);
}

function markAvailable(key) {
  exhaustedKeys.delete(key);
}

// ── اختار المفتاح التالي في الدايرة ──────────────────────────
function pickKey(keys) {
  const total = keys.length;

  // دور على أقرب مفتاح شغال من الفهرس الحالي
  for (let i = 0; i < total; i++) {
    const idx = (_currentIndex + i) % total;
    if (!isExhausted(keys[idx])) {
      _currentIndex = idx;
      return keys[idx];
    }
  }

  // كل المفاتيح خلصت — صحّيهم كلهم وابدأ من الأول (دايرة كاملة)
  console.warn(`🔄 [GeminiKeys] كل المفاتيح اتاستخدمت — بيرجع للمفتاح الأول`);
  exhaustedKeys.clear();
  _currentIndex = 0;
  return keys[0];
}

// ── Proxy Model — بيشتغل زي model عادي بس بيدور المفاتيح ──────
class RotatingGeminiModel {
  constructor(keys, modelName, systemInstruction = null) {
    this.keys       = keys;
    this.modelName  = modelName;
    this.systemInstruction = systemInstruction;
  }

  _buildModel(key) {
    const genAI = new GoogleGenerativeAI(key);
    const opts  = { model: this.modelName };
    if (this.systemInstruction) opts.systemInstruction = this.systemInstruction;
    return genAI.getGenerativeModel(opts);
  }

  async generateContent(prompt) {
    let lastErr;
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const key   = pickKey(this.keys);
      const model = this._buildModel(key);
      try {
        const result = await model.generateContent(prompt);
        markAvailable(key);
        return result;
      } catch (err) {
        if (err.message?.includes("429") || err.message?.includes("quota")) {
          markExhausted(key);
          lastErr = err;
        } else {
          throw err;
        }
      }
    }
    throw lastErr;
  }
}

// ── الـ instance الرئيسي للـ rotator ─────────────────────────
let _keys = [];
let _chatModel = null;
let _imageModel = null;

export function initGeminiKeys(systemInstruction) {
  _keys = collectKeys();
  if (_keys.length === 0) return false;

  _chatModel  = new RotatingGeminiModel(_keys, "gemini-1.5-flash", systemInstruction);
  _imageModel = new RotatingGeminiModel(_keys, "gemini-1.5-flash");

  console.log(`✅ [GeminiKeys] ${_keys.length} مفتاح جاهز (${_keys.length * 1500} طلب/يوم)`);
  return true;
}

export function getChatModel()  { return _chatModel; }
export function getImageModel() { return _imageModel; }
export function getKeyCount()   { return _keys.length; }
export function getKeyStats() {
  return _keys.map((k, i) => ({
    index: i + 1,
    suffix: k.slice(-6),
    exhausted: isExhausted(k),
  }));
}

// ── إضافة مفاتيح جديدة وهو شغال ─────────────────────────────
export function addKeys(newKeys) {
  const added = [];
  for (const k of newKeys) {
    const trimmed = k.trim();
    if (trimmed && !_keys.includes(trimmed)) {
      _keys.push(trimmed);
      added.push(trimmed);
    }
  }
  if (added.length > 0) {
    // حدّث الموديلات عشان يشوفوا المفاتيح الجديدة (هما بيستخدموا نفس الـ _keys reference)
    console.log(`✅ [GeminiKeys] اتضافوا ${added.length} مفتاح جديد — إجمالي: ${_keys.length} (${_keys.length * 20} طلب/يوم)`);
  }
  return { added: added.length, total: _keys.length };
}
