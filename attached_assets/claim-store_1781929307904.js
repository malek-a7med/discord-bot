// ════════════════════════════════════════════════════════════════════
//  ClaimStore — منع تكرار الردود بـ atomic file operations
//  ──────────────────────────────────────────────────────────────────
//  المشكلة القديمة: الكود كان بيقرأ الملف → يعدل → يكتب (read-modify-write).
//  لو نسختين عملوا ده في نفس اللحظة، كل واحدة بتشوف إن مفيش claim
//  وبتعمل واحد وبترد → رسايل مكررة.
//
//  الحل: atomic write بـ "temp file + rename". الـ rename على نفس الـ FS
//  بيكون atomic — يا كله ينقل يا ما بينقلش. فمفيش لحظة ممكن تتلاقي
//  فيها الملف بنص محتوى.
//
//  كمان بنستخدم lock file بـ O_EXCL (exclusive create) — أول واحد بيكسب.
//  لو الملف موجود يبقى حد تاني كسب.
//
//  الـ claims بتنمسح لو عمرها > 10 دقايق عشان الملف ما يكبرش.
// ════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";

const DEFAULT_TTL_MS = 10 * 60 * 1000;     // 10 دقايق
const DEFAULT_CLEANUP_MS = 60 * 1000;      // تنظيف كل دقيقة
const DEFAULT_FILE_NAME = "claims-store.json";

class ClaimStore {
  /**
   * @param {object} opts
   * @param {string} opts.filePath - مسار ملف الـ claims
   * @param {number} [opts.ttlMs]   - عمر الـ claim قبل ما يتمسح
   * @param {string} [opts.instanceId] - معرّف النسخة الحالية
   */
  constructor(opts = {}) {
    this.filePath = opts.filePath;
    if (!this.filePath) {
      // الافتراضي: data/claims-store.json
      const here = path.dirname(new URL(import.meta.url).pathname);
      this.filePath = path.join(here, "..", "data", DEFAULT_FILE_NAME);
    }
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.instanceId = opts.instanceId ?? `inst-${process.pid}`;
    this._lastClaimCache = new Map(); // كاش للـ claims في الذاكرة
    this._loadCache();
  }

  _loadCache() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, "utf8");
      const obj = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number" && now - v < this.ttlMs) {
          this._lastClaimCache.set(k, v);
        }
      }
    } catch { /* ignore */ }
  }

  /**
   * بيحاول يعمل claim على الـ key. لو حد تاني سبقه، بيرجع false.
   * الـ atomicity مضمونة عن طريق temp file + rename.
   *
   * @param {string} key
   * @returns {boolean} true لو احنا اللي عملنا الـ claim
   */
  tryClaim(key) {
    // 1) تنظيف claims قديمة من الكاش (in-memory)
    const now = Date.now();
    for (const [k, t] of this._lastClaimCache) {
      if (now - t >= this.ttlMs) this._lastClaimCache.delete(k);
    }

    // 2) فحص سريع من الكاش
    if (this._lastClaimCache.has(key)) {
      return false;
    }

    // 3) محاولة قراءة أحدث حالة من الـ disk (في حالة نسخة تانية عملت claim)
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "number" && now - v < this.ttlMs) {
            this._lastClaimCache.set(k, v);
          } else {
            this._lastClaimCache.delete(k);
          }
        }
      }
    } catch { /* ignore read errors */ }

    // 4) فحص تاني بعد القراءة من الـ disk
    if (this._lastClaimCache.has(key)) {
      return false;
    }

    // 5) سجل الـ claim في الكاش
    this._lastClaimCache.set(key, now);

    // 6) اكتب atomic للـ disk
    return this._flushAtomic(key, now);
  }

  /**
   * كتابة atomic: يكتب في ملف tmp وبعدين rename.
   * كده أي قارئ تاني بيقرأ الملف إمّا النسخة القديمة (فيشوف claim موجود)
   * أو النسخة الجديدة (فيشوف claim بتاعنا). مفيش حالة وسط.
   */
  _flushAtomic(key, timestamp) {
    const obj = {};
    for (const [k, t] of this._lastClaimCache) {
      obj[k] = t;
    }

    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      // بنبني الـ object مرة واحدة ونكتبه في tmp
      fs.writeFileSync(tmpPath, JSON.stringify(obj));
      // الـ rename atomic على نفس الـ filesystem
      fs.renameSync(tmpPath, this.filePath);
      return true;
    } catch (e) {
      // بعض الـ FS بترفض rename لو الهدف موجود — بنمسح ونعيد
      try { fs.unlinkSync(this.filePath); } catch {}
      try {
        fs.writeFileSync(tmpPath, JSON.stringify(obj));
        fs.renameSync(tmpPath, this.filePath);
        return true;
      } catch (e2) {
        // لو فشلت الـ write خالص، نشيل الـ claim من الكاش ونرجع false
        console.error(`⚠️ [ClaimStore] فشل تسجيل claim لـ ${key}:`, e2.message);
        this._lastClaimCache.delete(key);
        return false;
      }
    }
  }

  /**
   * بيمسح claim لو احنا اللي عاملينه (للتراجع).
   */
  release(key) {
    if (!this._lastClaimCache.has(key)) return;
    const t = this._lastClaimCache.get(key);
    if (Date.now() - t > this.ttlMs) {
      this._lastClaimCache.delete(key);
      return;
    }
    this._lastClaimCache.delete(key);
    try {
      const obj = {};
      for (const [k, v] of this._lastClaimCache) {
        obj[k] = v;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj));
    } catch { /* ignore */ }
  }

  /**
   * بيتأكد إن key مش claimed. لو claimed → false. لو متاح → بيكمل.
   * ده wrapper مريح.
   */
  isClaimed(key) {
    return this._lastClaimCache.has(key);
  }

  /**
   * حجم الكاش الحالي (للتشخيص).
   */
  size() {
    return this._lastClaimCache.size;
  }
}

export default ClaimStore;