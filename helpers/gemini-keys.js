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
const keyStates = new Map(); // key → { exhaustedAt: Date|null }

function isExhausted(key) {
  const state = keyStates.get(key);
  if (!state || !state.exhaustedAt) return false;
  // بعد ساعة بنجرب تاني (الكوتا بترجع في أي وقت بعد reset)
  return (Date.now() - state.exhaustedAt) < 60 * 60 * 1000;
}

function markExhausted(key) {
  keyStates.set(key, { exhaustedAt: Date.now() });
  console.warn(`⚠️ [GeminiKeys] المفتاح ${key.slice(-6)} وصل للحد — بيتحول للتالي`);
}

function markAvailable(key) {
  keyStates.set(key, { exhaustedAt: null });
}

// ── اختار أول مفتاح شغال ─────────────────────────────────────
function pickKey(keys) {
  const available = keys.filter(k => !isExhausted(k));
  if (available.length > 0) return available[0];
  // لو كلهم خلصوا — خد الأقدم في الـ exhaustion عشان يكون الأقرب للريست
  const sorted = [...keys].sort((a, b) => {
    const at = keyStates.get(a)?.exhaustedAt || 0;
    const bt = keyStates.get(b)?.exhaustedAt || 0;
    return at - bt;
  });
  return sorted[0];
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

  _chatModel  = new RotatingGeminiModel(_keys, "gemini-2.5-flash", systemInstruction);
  _imageModel = new RotatingGeminiModel(_keys, "gemini-2.5-flash");

  console.log(`✅ [GeminiKeys] ${_keys.length} مفتاح جاهز (${_keys.length * 20} طلب/يوم)`);
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
