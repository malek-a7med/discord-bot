// ═══════════════════════════════════════════════════════════════
//  Gemini Key Rotator — بيدور على المفاتيح أوتوماتيك لو 429
// ═══════════════════════════════════════════════════════════════
import { GoogleGenerativeAI } from "@google/generative-ai";

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname2    = path.dirname(fileURLToPath(import.meta.url));
const EXTRA_KEYS_PATH = path.join(__dirname2, "../data/gemini-keys-extra.json");

function loadExtraKeys() {
  try {
    if (fs.existsSync(EXTRA_KEYS_PATH)) {
      const raw = fs.readFileSync(EXTRA_KEYS_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveExtraKeys(keys) {
  try {
    fs.writeFileSync(EXTRA_KEYS_PATH, JSON.stringify(keys, null, 2), "utf8");
  } catch (e) {
    console.error("❌ [GeminiKeys] فشل حفظ المفاتيح:", e.message);
  }
}

// ── جمع كل المفاتيح الموجودة في الـ env + الملف المحفوظ ───────
// بيدعم أشكال تسمية متعددة:
//   GOOGLE_API_KEY, GOOGLE_API_KEY_2, GOOGLE_API_KEY_3, ...
//   GEMINI_API_KEY, GEMINI_API_KEY_2, ...
//   "Gemini API Key 2", "Gemini API Key 3", ... (Railway naming)
function collectKeys() {
  const keys = new Set();

  // الشكل الأساسي
  if (process.env.GOOGLE_API_KEY)  keys.add(process.env.GOOGLE_API_KEY);
  if (process.env.GEMINI_API_KEY)  keys.add(process.env.GEMINI_API_KEY);

  // GOOGLE_API_KEY_N و GEMINI_API_KEY_N
  for (let i = 2; i <= 30; i++) {
    const g = process.env[`GOOGLE_API_KEY_${i}`];
    const m = process.env[`GEMINI_API_KEY_${i}`];
    if (g) keys.add(g);
    if (m) keys.add(m);
    // توقف لو أكتر من 5 فراغات متتالية
    if (!g && !m && i > 10) break;
  }

  // "Gemini API Key N" — نمط Railway
  for (let i = 1; i <= 20; i++) {
    const label = i === 1 ? "Gemini API Key" : `Gemini API Key ${i}`;
    const v = process.env[label];
    if (v) keys.add(v);
  }

  // المفاتيح المحفوظة في الملف (تبقى حتى بعد الريستارت)
  for (const k of loadExtraKeys()) {
    if (k) keys.add(k);
  }

  return [...keys];
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

// ── كولداون عالمي لما كل المفاتيح تبقى محروقة ─────────────────
let _quotaCooldownUntil = 0;
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 دقايق

export function isQuotaCooldown() {
  return Date.now() < _quotaCooldownUntil;
}

export function getQuotaCooldownRemaining() {
  return Math.max(0, Math.ceil((_quotaCooldownUntil - Date.now()) / 1000));
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

  // كل المفاتيح خلصت — ارمي error فوراً بدل ما تحاول تاني
  _quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
  console.warn(`🚫 [GeminiKeys] كل المفاتيح محروقة — كولداون ${QUOTA_COOLDOWN_MS/60000} دقيقة`);
  const err = new Error("ALL_KEYS_EXHAUSTED");
  err.isQuotaError = true;
  throw err;
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
    // ── تعطيل الـ thinking mode عشان الرد يكون فوري (gemini-2.5-flash بيفكر كتير بالديفولت) ──
    if (this.modelName === "gemini-2.5-flash") {
      opts.generationConfig = { thinkingConfig: { thinkingBudget: 0 } };
    }
    return genAI.getGenerativeModel(opts);
  }

  async generateContent(prompt) {
    // إذا كل المفاتيح محروقة وفي كولداون — ارفض فوراً
    if (isQuotaCooldown()) {
      const secs = getQuotaCooldownRemaining();
      const err = new Error(`ALL_KEYS_EXHAUSTED (cooldown ${secs}s)`);
      err.isQuotaError = true;
      throw err;
    }

    let lastErr;
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      let key;
      try { key = pickKey(this.keys); }
      catch (pickErr) { throw pickErr; } // ALL_KEYS_EXHAUSTED — ارمي فوراً

      const model = this._buildModel(key);

      // AbortSignal بـ 12 ثانية — يمنع SDK من الانتظار الطويل عشان retry
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 12000);

      try {
        const result = await model.generateContent(prompt, { signal: controller.signal });
        clearTimeout(abortTimer);
        markAvailable(key);
        return result;
      } catch (err) {
        clearTimeout(abortTimer);
        lastErr = err;

        const is429    = err.message?.includes("429") || err.message?.includes("quota") || err.message?.includes("EXHAUSTED");
        const isAbort  = err.name === "AbortError" || err.message?.includes("aborted") || err.message?.includes("abort");
        const is503    = err.message?.includes("503") || err.message?.includes("Service Unavailable") || err.message?.includes("high demand") || err.message?.includes("overloaded");

        if (is429) {
          markExhausted(key);
          // لو في مفتاح تاني — جرّبه فوراً بدون استنى
          const hasAnotherKey = this.keys.some(k => k !== key && !isExhausted(k));
          if (!hasAnotherKey) {
            // ارمي error فوراً — pickKey هيتعامل مع الكولداون في الـ attempt الجاية
            continue;
          }
        } else if (isAbort) {
          // timeout من AbortSignal
          console.warn(`⏱️ [GeminiKeys] ${this.modelName} استغرق أكتر من 12 ثانية — abort`);
          const timeoutErr = new Error("timeout");
          throw timeoutErr;
        } else if (is503 && this.modelName !== "gemini-2.0-flash-lite") {
          // الموديل مزحوم — جرّب الـ fallback فوراً بنفس المفتاح
          console.warn(`⚠️ [GeminiKeys] ${this.modelName} مزحوم (503) — بيتحول لـ gemini-2.0-flash-lite`);
          const controller2 = new AbortController();
          const abortTimer2 = setTimeout(() => controller2.abort(), 12000);
          try {
            const genAI = new GoogleGenerativeAI(key);
            const opts  = { model: "gemini-2.0-flash-lite" };
            if (this.systemInstruction) opts.systemInstruction = this.systemInstruction;
            const fallback = genAI.getGenerativeModel(opts);
            const result   = await fallback.generateContent(prompt, { signal: controller2.signal });
            clearTimeout(abortTimer2);
            markAvailable(key);
            return result;
          } catch (fallbackErr) {
            clearTimeout(abortTimer2);
            lastErr = fallbackErr;

            const fallbackIs429 =
              fallbackErr.message?.includes("429") ||
              fallbackErr.message?.toLowerCase().includes("quota") ||
              fallbackErr.message?.includes("EXHAUSTED");

            if (fallbackIs429) {
              // Fallback quota counts against this key too; rotate instead of
              // stopping while other configured keys may still have quota.
              markExhausted(key);
              continue;
            }

            throw fallbackErr;
          }
        } else {
          throw err;
        }
      }
    }
    // كل المفاتيح جربناها وكلها 429
    _quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
    const exhaustedErr = new Error("ALL_KEYS_EXHAUSTED");
    exhaustedErr.isQuotaError = true;
    throw exhaustedErr;
  }
}

// ── إعادة تشغيل المفاتيح المحروقة تلقائياً كل ساعة ──────────────
setInterval(() => {
  if (exhaustedKeys.size > 0) {
    console.log(`🔄 [GeminiKeys] إعادة تشغيل ${exhaustedKeys.size} مفتاح محروق`);
    exhaustedKeys.clear();
  }
}, 60 * 60 * 1000); // كل ساعة

// ── OpenAI-compatible text providers — Gemini-style generateContent interface ──
class OpenAICompatibleChatModel {
  constructor({ apiKey, baseUrl, modelName, provider, systemInstruction = null }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.modelName = modelName;
    this.provider = provider;
    this.systemInstruction = systemInstruction;
  }

  async generateContent(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const promptText = Array.isArray(prompt)
        ? prompt.map(part => typeof part === "string" ? part : part?.text || "").filter(Boolean).join("\n")
        : String(prompt ?? "");
      const messages = [];
      if (this.systemInstruction) messages.push({ role: "system", content: this.systemInstruction });
      messages.push({ role: "user", content: promptText });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          ...(this.apiKey ? { "Authorization": `Bearer ${this.apiKey}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.modelName, messages, temperature: 0.7 }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload.error?.message || payload.message || `${this.provider} API returned HTTP ${response.status}`;
        const error = new Error(detail);
        error.isQuotaError = response.status === 429 ||
          ((response.status === 402 || response.status === 403) && /quota|rate.?limit|limit.?exceeded|credit|exhaust/i.test(String(detail)));
        throw error;
      }
      const text = payload.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new Error(`${this.provider} returned an empty response`);
      return { response: { text: () => text } };
    } finally {
      clearTimeout(timer);
    }
  }
}

class QuotaFallbackChatModel {
  constructor(models) {
    this.models = models;
  }

  async generateContent(prompt) {
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      try {
        return await model.generateContent(prompt);
      } catch (error) {
        if (!error.isQuotaError || i === this.models.length - 1) throw error;
        console.warn(`⚠️ [AI] ${model.provider || "Gemini"} quota exhausted — switching to next provider`);
      }
    }
    throw new Error("No AI providers are configured");
  }
}

// ── الـ instance الرئيسي للـ rotator ─────────────────────────
let _keys = [];
let _chatModel = null;
let _imageModel = null;
let _configuredProviderNames = [];

export function initGeminiKeys(systemInstruction) {
  _keys = collectKeys();
  _imageModel = _keys.length > 0 ? new RotatingGeminiModel(_keys, "gemini-2.0-flash-lite") : null;

  const configuredModels = [];
  const geminiChat = _keys.length > 0
    ? new RotatingGeminiModel(_keys, "gemini-2.5-flash", systemInstruction)
    : null;
  if (geminiChat) configuredModels.push(geminiChat);

  const addProvider = ({ provider, keyEnv, baseUrl, defaultModel, modelEnv }) => {
    const apiKey = process.env[keyEnv]?.trim();
    if (!apiKey) return;
    configuredModels.push(new OpenAICompatibleChatModel({
      apiKey,
      baseUrl,
      modelName: process.env[modelEnv] || defaultModel,
      provider,
      systemInstruction,
    }));
  };

  // Credentialed providers from mnfst/awesome-free-llm-apis.
  // Anonymous-only Kilo Code and OVH endpoints are deliberately not enabled.
  addProvider({ provider: "Groq", keyEnv: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "openai/gpt-oss-120b", modelEnv: "GROQ_MODEL" });
  addProvider({ provider: "Aion Labs", keyEnv: "AION_API_KEY", baseUrl: "https://api.aionlabs.ai/v1", defaultModel: "aion-labs/aion-3.0-mini", modelEnv: "AION_MODEL" });
  addProvider({ provider: "Cohere", keyEnv: "COHERE_API_KEY", baseUrl: "https://api.cohere.ai/compatibility/v1", defaultModel: "command-r7b-12-2024", modelEnv: "COHERE_MODEL" });
  addProvider({ provider: "Mistral AI", keyEnv: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", modelEnv: "MISTRAL_MODEL" });
  addProvider({ provider: "Z AI", keyEnv: "ZAI_API_KEY", baseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4.7-flash", modelEnv: "ZAI_MODEL" });

  const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (cloudflareAccountId && cloudflareApiToken) {
    configuredModels.push(new OpenAICompatibleChatModel({
      apiKey: cloudflareApiToken,
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`,
      modelName: process.env.CLOUDFLARE_MODEL || "@cf/openai/gpt-oss-120b",
      provider: "Cloudflare Workers AI",
      systemInstruction,
    }));
  }

  addProvider({ provider: "Gonka Broker", keyEnv: "GONKA_API_KEY", baseUrl: "https://proxy.gonkabroker.com/v1", defaultModel: "MiniMaxAI/MiniMax-M2.7", modelEnv: "GONKA_MODEL" });
  addProvider({ provider: "LLM7.io", keyEnv: "LLM7_API_KEY", baseUrl: "https://api.llm7.io/v1", defaultModel: "gpt-oss:20b", modelEnv: "LLM7_MODEL" });
  addProvider({ provider: "ModelScope", keyEnv: "MODELSCOPE_API_KEY", baseUrl: "https://api-inference.modelscope.cn/v1", defaultModel: "Qwen/Qwen3.5-35B-A3B", modelEnv: "MODELSCOPE_MODEL" });
  addProvider({ provider: "NVIDIA NIM", keyEnv: "NVIDIA_API_KEY", baseUrl: "https://integrate.api.nvidia.com/v1", defaultModel: "nvidia/nemotron-3-ultra-550b-a55b", modelEnv: "NVIDIA_MODEL" });
  addProvider({ provider: "OpenRouter", keyEnv: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "nvidia/nemotron-3.5-lightning:free", modelEnv: "OPENROUTER_MODEL" });
  addProvider({ provider: "SiliconFlow", keyEnv: "SILICONFLOW_API_KEY", baseUrl: "https://api.siliconflow.cn/v1", defaultModel: "XingChenAGI/Xing4.0-29B", modelEnv: "SILICONFLOW_MODEL" });

  _configuredProviderNames = configuredModels.map(model => model.provider || "Gemini");
  _chatModel = configuredModels.length > 1
    ? new QuotaFallbackChatModel(configuredModels)
    : configuredModels[0] || null;

  if (_keys.length > 0) {
    console.log(`✅ [GeminiKeys] ${_keys.length} مفتاح جاهز (~${_keys.length * 1500} طلب/يوم)`);
  }
  for (const model of configuredModels) {
    if (model.provider) console.log(`✅ [AI] ${model.provider} text provider ready (${model.modelName})`);
  }
  if (!_chatModel) return false;
  return true;
}
export function getAIProviderNames() { return [..._configuredProviderNames]; }
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

// ── إعادة تشغيل المفاتيح يدوياً (من أمر الأونر) ─────────────────
export function resetExhaustedKeys() {
  const count = exhaustedKeys.size;
  exhaustedKeys.clear();
  _currentIndex = 0;
  return count;
}
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
    // احفظ كل المفاتيح المضافة يدوياً في الملف عشان تبقى بعد الريستارت
    const existing = loadExtraKeys();
    const merged   = [...new Set([...existing, ...added])];
    saveExtraKeys(merged);
    console.log(`✅ [GeminiKeys] اتضافوا ${added.length} مفتاح جديد — إجمالي: ${_keys.length} (~${_keys.length * 1500} طلب/يوم)`);
    console.log(`💾 [GeminiKeys] تم حفظ ${merged.length} مفتاح في الملف`);
  }
  return { added: added.length, total: _keys.length };
}

// ── حذف مفتاح معين (من الذاكرة والملف) ───────────────────────
export function removeKey(index) {
  if (index < 0 || index >= _keys.length) return false;
  const removed = _keys.splice(index, 1)[0];
  // أزله من الملف لو موجود فيه
  const existing = loadExtraKeys();
  const updated  = existing.filter(k => k !== removed);
  saveExtraKeys(updated);
  console.log(`🗑️ [GeminiKeys] تم حذف المفتاح رقم ${index + 1}`);
  return true;
}

// ── تحديد مفتاح معين للاستخدام ─────────────────────────────
export function setActiveKeyIndex(index) {
  if (index < 0 || index >= _keys.length) return false;
  _currentIndex = index;
  exhaustedKeys.clear();
  console.log(`🎯 [GeminiKeys] تم تحديد المفتاح رقم ${index + 1} للاستخدام`);
  return true;
}
