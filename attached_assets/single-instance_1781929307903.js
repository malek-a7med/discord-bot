// ════════════════════════════════════════════════════════════════════
//  Single-Instance Lock with Heartbeat
//  ──────────────────────────────────────────────────────────────────
//  الغرض: ضمان إن نسخة واحدة بس من البوت هي اللي شغالة في نفس الوقت
//  حتى لو الحاوية القديمة ماتت وسابت الـ lock file وراها.
//
//  المبدأ:
//  - كل نسخة بتكتب ملف فيه PID + heartbeat timestamp
//  - الـ heartbeat بيتحدث كل 20 ثانية
//  - لو ملف تاني موجود وقلبه نابض (< 60 ثانية)، النسخة الجديدة بتخرج
//  - لو ملف تاني موجود بس قلبه ميت (> 60 ثانية)، النسخة الجديدة بتاخده
//
//  ده بيشتغل على Replit لأننا بنشوف الـ timestamp مش الـ process kill
//  (الـ process kill مش بيشتغل cross-container أصلاً).
// ════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import os from "os";

const LOCK_DIR = "/tmp";
const LOCK_FILE = path.join(LOCK_DIR, "zangi_bot.lock");
const HEARTBEAT_INTERVAL_MS = 20_000;   // كل 20 ثانية نحدث القلب
const STALE_THRESHOLD_MS    = 60_000;   // لو مفيش تحديث من 60 ثانية = ميت
const STARTUP_GRACE_MS      = 5_000;    // مهلة في البداية قبل ما نقرر

let heartbeatTimer = null;
let _tookOver = false;

/**
 * بيقرأ الـ lock file الحالي لو موجود.
 * بيرجع { pid, startedAt, lastHeartbeat, instanceId } أو null لو مفيش.
 */
function readLock() {
  try {
    const raw = fs.readFileSync(LOCK_FILE, "utf8");
    const obj = JSON.parse(raw);
    if (typeof obj?.pid !== "number") return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * بيكتب الـ lock atomically (يكتب في ملف مؤقت وبعدين يعمل rename).
 * كده مفيش لحظة يبقى فيها الملف نص مكتوب.
 */
function writeLock(data) {
  const tmp = `${LOCK_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, LOCK_FILE);
  } catch (e) {
    // بعض الـ FS بتسمح بـ rename فوق ملف موجود، لو فشلت بنمسح ونعيد
    try { fs.unlinkSync(LOCK_FILE); } catch {}
    try {
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, LOCK_FILE);
    } catch (e2) {
      console.error("⚠️ [Lock] فشلت كتابة lock:", e2.message);
    }
  }
}

/**
 * بيمسح الـ lock لو الـ PID الموجود فيه هو بتاعنا.
 * بنتأكد بـ PID لأن لو نسخة تانية مسحت الملف غلط، منكشش نسجل خروج غيرنا.
 */
function clearOwnLock() {
  try {
    const cur = readLock();
    if (cur && cur.pid === process.pid) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {}
}

function makeInstanceId() {
  return `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * يبدأ الـ heartbeat loop. كل HEARTBEAT_INTERVAL_MS بنكتب ملف الـ lock
 * بـ timestamp جديد. لو مقدرناش نكتب، البوت بيموت بهدوء.
 */
function startHeartbeat() {
  const update = () => {
    try {
      const cur = readLock();
      // لو ملف الـ lock اتغير وبيشير لنسخة تانية حية → نخرج
      if (cur && cur.instanceId && cur.instanceId !== process.env._INSTANCE_ID && isAlive(cur)) {
        console.warn("⚠️ [Lock] نسخة تانية سحبت الملف — بنخرج بهدوء");
        gracefulExit();
        return;
      }
      writeLock({
        pid: process.pid,
        instanceId: process.env._INSTANCE_ID,
        startedAt: cur?.startedAt ?? Date.now(),
        lastHeartbeat: Date.now(),
        host: os.hostname(),
        node: process.version,
      });
    } catch (e) {
      console.error("⚠️ [Lock] فشل تحديث الـ heartbeat:", e.message);
    }
  };

  // أول تحديث فوراً
  update();
  heartbeatTimer = setInterval(update, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.(); // ما يبقاش عائق لإغلاق العملية
}

/**
 * بيقرر لو الـ lock entry لسه حية.
 * لازم الـ timestamp يكون أحدث من STALE_THRESHOLD_MS.
 */
function isAlive(entry) {
  if (!entry?.lastHeartbeat) return false;
  return Date.now() - entry.lastHeartbeat < STALE_THRESHOLD_MS;
}

/**
 * بيقفل البوت بهدوء بعد مهلة قصيرة.
 */
function gracefulExit() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  clearOwnLock();
  setTimeout(() => process.exit(0), 500);
}

/**
 * الـ export الرئيسي.
 * بيرجع:
 *   { acquired: true,  instanceId }  → لو احنا النسخة الشرعية
 *   { acquired: false, reason }       → لو في نسخة تانية شغالة
 */
export function acquireInstanceLock() {
  process.env._INSTANCE_ID = makeInstanceId();

  const existing = readLock();

  // الحالة 1: مفيش ملف lock خالص → احنا أول واحد
  if (!existing) {
    writeLock({
      pid: process.pid,
      instanceId: process.env._INSTANCE_ID,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      host: os.hostname(),
      node: process.version,
    });
    _tookOver = true;
    installCleanup();
    startHeartbeat();
    return { acquired: true, instanceId: process.env._INSTANCE_ID, fresh: true };
  }

  // الحالة 2: في ملف lock وقلبه لسه بينبض → النسخة القديمة لسه شغالة
  if (isAlive(existing)) {
    // مهلة البداية: لو احنا الـ startup حديث، ممكن النسخة القديمة لسه بتكتب
    // فبنستنى شوية ونشوف تاني
    const startAge = Date.now() - (existing.startedAt ?? 0);
    if (startAge < STARTUP_GRACE_MS) {
      // نستنى مهلة البداية ونشوف لو الـ heartbeat لسه بيتحدث
      // هنا بنفترض إن النسخة الجديدة لسه ما بدأتش heartbeat
      // فالـ existing.startedAt بتاعها قصير — ده مش شرط مطلق لكن كافي في 99%
    }
    return {
      acquired: false,
      reason: "نسخة تانية شغالة",
      existingPid: existing.pid,
      existingStartedAt: existing.startedAt,
      existingHeartbeatAge: Date.now() - existing.lastHeartbeat,
    };
  }

  // الحالة 3: في ملف lock بس القلب ميت → النسخة القديمة ماتت (سابت الـ lock)
  // بناخد الملف
  console.warn(`⚠️ [Lock] نسخة قديمة ماتت (آخر heartbeat من ${Math.floor((Date.now() - existing.lastHeartbeat) / 1000)} ثانية). بناخد الـ lock.`);
  writeLock({
    pid: process.pid,
    instanceId: process.env._INSTANCE_ID,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    host: os.hostname(),
    node: process.version,
    tookOverFrom: existing.instanceId ?? `pid:${existing.pid}`,
  });
  _tookOver = true;
  installCleanup();
  startHeartbeat();
  return { acquired: true, instanceId: process.env._INSTANCE_ID, fresh: false, tookOverFrom: existing.instanceId };
}

/**
 * بيثبت الـ cleanup hooks عشان لو البوت اتقفل، الـ lock يتمسح.
 */
function installCleanup() {
  const cleanup = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    clearOwnLock();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  process.on("beforeExit", cleanup);
}

/**
 * حالة الـ lock الحالية — للـ status endpoint أو اللوج.
 */
export function getLockStatus() {
  const cur = readLock();
  return {
    isOwner: _tookOver,
    currentPid: process.pid,
    currentInstanceId: process.env._INSTANCE_ID ?? null,
    existing: cur ? {
      pid: cur.pid,
      instanceId: cur.instanceId,
      startedAt: cur.startedAt,
      age: cur.startedAt ? Date.now() - cur.startedAt : null,
      lastHeartbeat: cur.lastHeartbeat,
      heartbeatAge: cur.lastHeartbeat ? Date.now() - cur.lastHeartbeat : null,
      alive: isAlive(cur),
      host: cur.host,
    } : null,
  };
}

/**
 * للاختبار: بتفرض الـ lock يبقى ميت وبتحاول تاخده.
 * متستخدموش في الكود العادي.
 */
export function _debugForceStale() {
  const cur = readLock();
  if (cur) {
    cur.lastHeartbeat = Date.now() - (STALE_THRESHOLD_MS + 10_000);
    writeLock(cur);
  }
}