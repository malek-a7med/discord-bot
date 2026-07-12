import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'server_database.json');

// ✅ FIX: مدة بقاء الـ claim في الذاكرة قبل ما يتنضف (نفس القديمة: دقيقتين)
const AI_CLAIM_TTL_MS = 120_000;
// تنظيف دوري كل دقيقة عشان الـ Map ما تكبرش بلا حدود
const AI_CLAIM_CLEANUP_INTERVAL_MS = 60_000;

class Database {
  constructor() {
    this.data = this.load();

    // ✅ FIX: aiMessageClaims بقت Map في الذاكرة بدل read/write كامل لملف
    //   الداتابيس في كل رسالة AI (كانت بتعمل fs.readFileSync + fs.writeFileSync sync
    //   على الملف كله — ده blocking على الـ event loop ومش آمن لو رسالتين جم
    //   في نفس اللحظة بالظبط). دلوقتي كل العملية في الذاكرة، وبتتحفظ تلقائيًا
    //   مع باقي البيانات في save() العادية بدل عمليات I/O منفصلة.
    this.aiMessageClaims = new Map();

    // ✅ backward-compat: لو فيه claims قديمة محفوظة في الملف من نسخة سابقة
    //   (سواء aiClaims القديمة أو aiMessageClaims الجديدة)، نحمّلها للـ Map
    //   مع تجاهل أي حاجة أقدم من TTL
    const now = Date.now();
    const legacyClaims = this.data.aiMessageClaims || this.data.aiClaims || {};
    for (const [msgId, ts] of Object.entries(legacyClaims)) {
      if (typeof ts === "number" && now - ts < AI_CLAIM_TTL_MS) {
        this.aiMessageClaims.set(msgId, ts);
      }
    }
    // شيل المفتاح القديم aiClaims نهائيًا — بقى aiMessageClaims بس
    delete this.data.aiClaims;

    // ✅ تنظيف دوري للـ entries الأقدم من AI_CLAIM_TTL_MS (زي ما كان موجود في القديم)
    this._aiClaimsCleanupInterval = setInterval(() => {
      this._cleanupAiMessageClaims();
    }, AI_CLAIM_CLEANUP_INTERVAL_MS);
    this._aiClaimsCleanupInterval.unref?.(); // ما يمنعش الـ process من القفل

    // أول تنظيف فوري عشان نبدأ نضيفين من القديم لو فيه حاجة منتهية
    this._cleanupAiMessageClaims();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('⚠️ ما تقدرتش أقراي الداتابيس، بنبدأ من الصفر');
    }

    return {
      users: {},
      warnings: {},
      manhwa: {},
      welcome: {},
      suggestions: {},
      modLogs: {},
      spamTracking: {},
      raidTracking: {}
    };
  }

  // ✅ FIX: بنحط الـ Map في this.data قبل الحفظ عشان تتحفظ مع باقي البيانات
  //   في نفس عملية الكتابة العادية، بدون أي fs call إضافي منفصل
  save() {
    try {
      if (this.aiMessageClaims) {
        this.data.aiMessageClaims = Object.fromEntries(this.aiMessageClaims);
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ ما تقدرتش أحفظ الداتابيس:', err.message);
    }
  }

  ensureUser(userId) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = {
        xp: 0,
        level: 0,
        coins: 0,
        lastDaily: null,
        warnings: [],
        timeouts: [],
        bankCoins: 0,
        lastBankInterest: 0,
      };
      this.save();
    }
    if (typeof this.data.users[userId].bankCoins !== "number") this.data.users[userId].bankCoins = 0;
    if (typeof this.data.users[userId].lastBankInterest !== "number") this.data.users[userId].lastBankInterest = 0;
    return this.data.users[userId];
  }

  getUser(userId) {
    return this.ensureUser(userId);
  }

  updateUser(userId, updates) {
    const user = this.ensureUser(userId);
    Object.assign(user, updates);
    this.save();
    return user;
  }

  addWarning(userId, reason, moderator = 'SYSTEM') {
    this.ensureUser(userId);
    if (!this.data.users[userId].warnings) {
      this.data.users[userId].warnings = [];
    }

    this.data.users[userId].warnings.push({
      reason,
      moderator,
      timestamp: Date.now()
    });
    this.save();
  }

  getWarnings(userId) {
    this.ensureUser(userId);
    return this.data.users[userId].warnings || [];
  }

  removeLastWarning(userId) {
    this.ensureUser(userId);
    const warnings = this.data.users[userId].warnings;
    if (warnings && warnings.length > 0) {
      warnings.pop();
      this.save();
    }
  }

  removeWarningByIndex(userId, index) {
    this.ensureUser(userId);
    const warnings = this.data.users[userId].warnings;
    if (!warnings || index < 0 || index >= warnings.length) return false;
    warnings.splice(index, 1);
    this.save();
    return true;
  }

  clearAllWarnings(userId) {
    this.ensureUser(userId);
    this.data.users[userId].warnings = [];
    this.save();
  }

  addTimeout(userId, duration, reason) {
    this.ensureUser(userId);
    if (!this.data.users[userId].timeouts) {
      this.data.users[userId].timeouts = [];
    }

    this.data.users[userId].timeouts.push({
      duration,
      reason,
      timestamp: Date.now()
    });
    this.save();
  }

  getGuildConfig(guildId) {
    if (!this.data.welcome) {
      this.data.welcome = {};
    }
    return this.data.welcome[guildId] || null;
  }

  // ═══════════════════════════════════════════════════════════
  //  إعدادات الأوتو مود لكل سيرفر
  // ═══════════════════════════════════════════════════════════
  getAutoModSettings(guildId) {
    if (!this.data.autoModSettings) this.data.autoModSettings = {};
    if (!this.data.autoModSettings[guildId]) {
      this.data.autoModSettings[guildId] = {
        warnTimeoutThreshold: 4,   // عدد التحذيرات قبل الإسكات
        warnKickThreshold: 6,      // عدد التحذيرات قبل الطرد
        warnBanThreshold: 8,       // عدد التحذيرات قبل الباند
        logChannelId: null,        // قناة سجلات الأمان
        extraModRoles: [],         // رتب إشراف إضافية (زي أمر mod في البوتات المرجعية)
        antiNuke: {
          enabled: false,
          limit: 3,                // عدد الأفعال الخطيرة المسموحة في النافذة الزمنية
          windowMs: 60_000,        // نافذة الفحص (دقيقة)
          punishment: "kick",      // kick | ban | timeout
        },
      };
      this.save();
    }
    // توافق مع سجلات قديمة ناقصة حقول
    const s = this.data.autoModSettings[guildId];
    if (!s.antiNuke) s.antiNuke = { enabled: false, limit: 3, windowMs: 60_000, punishment: "kick" };
    if (!Array.isArray(s.extraModRoles)) s.extraModRoles = [];
    return s;
  }

  updateAutoModSettings(guildId, updates) {
    const settings = this.getAutoModSettings(guildId);
    Object.assign(settings, updates);
    this.save();
    return settings;
  }

  updateAntiNukeSettings(guildId, updates) {
    const settings = this.getAutoModSettings(guildId);
    Object.assign(settings.antiNuke, updates);
    this.save();
    return settings.antiNuke;
  }

  addExtraModRole(guildId, roleId) {
    const settings = this.getAutoModSettings(guildId);
    if (!settings.extraModRoles.includes(roleId)) settings.extraModRoles.push(roleId);
    this.save();
    return settings.extraModRoles;
  }

  removeExtraModRole(guildId, roleId) {
    const settings = this.getAutoModSettings(guildId);
    settings.extraModRoles = settings.extraModRoles.filter(r => r !== roleId);
    this.save();
    return settings.extraModRoles;
  }

  setWelcomeChannel(guildId, channelId) {
    this.data.welcome[guildId] = channelId;
    this.save();
  }

  getWelcomeChannel(guildId) {
    return this.data.welcome[guildId] || null;
  }

  addManhwaTerm(dictName, term, translation) {
    if (!this.data.manhwa[dictName]) {
      this.data.manhwa[dictName] = {};
    }
    this.data.manhwa[dictName][term] = translation;
    this.save();
  }

  getManhwaDict(dictName) {
    return this.data.manhwa[dictName] || {};
  }

  getAllManhwaDicts() {
    return this.data.manhwa;
  }

  trackSpam(guildId, userId) {
    const key = `${guildId}-${userId}`;
    if (!this.data.spamTracking[key]) {
      this.data.spamTracking[key] = {
        count: 0,
        firstMessageTime: Date.now()
      };
    }
    this.data.spamTracking[key].count++;
    return this.data.spamTracking[key];
  }

  resetSpamTracker(guildId, userId) {
    const key = `${guildId}-${userId}`;
    if (this.data.spamTracking[key]) {
      delete this.data.spamTracking[key];
    }
  }

  trackRaid(guildId, userId) {
    const key = `${guildId}-raid`;
    if (!this.data.raidTracking[key]) {
      this.data.raidTracking[key] = {
        joinTimes: []
      };
    }
    this.data.raidTracking[key].joinTimes.push(Date.now());

    // Keep only recent joins (within last 60 seconds)
    const now = Date.now();
    this.data.raidTracking[key].joinTimes = this.data.raidTracking[key].joinTimes.filter(
      (t) => now - t < 60000
    );

    return this.data.raidTracking[key];
  }

  getRaidJoinCount(guildId, windowMs) {
    const key = `${guildId}-raid`;
    if (!this.data.raidTracking[key]) {
      return 0;
    }

    const now = Date.now();
    return this.data.raidTracking[key].joinTimes.filter((t) => now - t < windowMs).length;
  }

  // ─── حماية من الرد المكرر بين نسختين للبوت ──────────────────
  // ✅ FIX: بقت كلها في الذاكرة (Map) بدل readFileSync/writeFileSync على
  //   ملف الداتابيس كله في كل رسالة AI. ده بيشيل الـ blocking I/O والـ
  //   race condition اللي كان ممكن يحصل لو رسالتين جم في نفس اللحظة بالظبط.
  //   ⚠️ ملحوظة: ده حل لمشكلة الأداء/الـ race داخل نفس العملية (single instance).
  //   لو شغال نسختين من البوت في نفس الوقت (multi-instance على Replit مثلاً)،
  //   النظام ده مش هيحمي من تكرار الردود بين النسختين لأنه في الذاكرة بس —
  //   محتاج نظام تنسيق عبر الـ disk (زي ClaimStore) للحالة دي.
  claimAiMessage(msgId) {
    const now = Date.now();

    const existing = this.aiMessageClaims.get(msgId);
    if (existing !== undefined && now - existing < AI_CLAIM_TTL_MS) {
      return false; // اتكلّم عليه قبل كده ولسه ضمن الـ TTL
    }

    this.aiMessageClaims.set(msgId, now);
    return true;
  }

  // ✅ FIX: تنظيف دوري للـ claims الأقدم من AI_CLAIM_TTL_MS (دقيقتين)
  //   عشان الـ Map ما تكبرش بلا حدود مع الوقت
  _cleanupAiMessageClaims() {
    const now = Date.now();
    for (const [msgId, ts] of this.aiMessageClaims) {
      if (now - ts >= AI_CLAIM_TTL_MS) {
        this.aiMessageClaims.delete(msgId);
      }
    }
  }

  // ─── قدرات الألعاب ───────────────────────────────────────────
  getGameAbilities(userId) {
    const user = this.ensureUser(userId);
    if (!user.gameAbilities) { user.gameAbilities = {}; this.save(); }
    return user.gameAbilities;
  }

  hasGameAbility(userId, type) {
    return (this.getGameAbilities(userId)[type] || 0) > 0;
  }

  addGameAbility(userId, type, count = 1) {
    const a = this.getGameAbilities(userId);
    a[type] = (a[type] || 0) + count;
    this.save();
  }

  useGameAbility(userId, type) {
    const a = this.getGameAbilities(userId);
    if (!a[type] || a[type] <= 0) return false;
    a[type]--;
    if (a[type] === 0) delete a[type];
    this.save();
    return true;
  }

  getAllData() {
    return this.data;
  }

  // ─── 🌍 لعبة الحياة (نظام اقتصادي شخصي مستمر، per-guild) ──────
  // ✅ مستقل بالكامل عن users[userId].coins — بروفايل اللعبة الجديدة
  //   بيبدأ من الصفر لما اليوزر يلعب لأول مرة، ومحلي لكل سيرفر لوحده
  //   (نفس اليوزر في سيرفرين مختلفين = بروفايلين مختلفين تمامًا)
  ensureLifeProfile(guildId, userId) {
    if (!this.data.lifeProfiles) this.data.lifeProfiles = {};
    if (!this.data.lifeProfiles[guildId]) this.data.lifeProfiles[guildId] = {};

    if (!this.data.lifeProfiles[guildId][userId]) {
      this.data.lifeProfiles[guildId][userId] = {
        coins: 0,
        jobLevel: 0,        // 0 = بدون وظيفة
        jobSince: null,     // وقت بداية الوظيفة الحالية (لحساب الخبرة)
        assets: { house: false, car: false, company: false },
        debt: 0,            // قيمة موجبة = مديون
        debtSince: null,    // وقت أول ما الدين بدأ
        debtWarned: false,  // اتبعتله إنذار قبل كده؟
        health: 100,
        lastTick: Date.now(),
        createdAt: Date.now(),
      };
      this.save();
    }

    const p = this.data.lifeProfiles[guildId][userId];
    // backward-safety: لو فيه بروفايل قديم من نسخة تجريبية وناقصه حقل
    if (typeof p.coins !== "number") p.coins = 0;
    if (typeof p.jobLevel !== "number") p.jobLevel = 0;
    if (!p.assets) p.assets = { house: false, car: false, company: false };
    if (typeof p.debt !== "number") p.debt = 0;
    if (typeof p.health !== "number") p.health = 100;
    if (typeof p.lastTick !== "number") p.lastTick = Date.now();
    // ✅ migration: لو فيه بروفايل قديم من نسخة تجريبية كانت بمنطق "محفظة
    //   سالبة = دين" (قبل ما نفصل المحفظة عن الدين)، نحوّل أي رصيد سالب
    //   لدين فعلي ونصفّر المحفظة، عشان النظام الجديد يفضل متّسق دايمًا
    if (p.coins < 0) {
      p.debt += -p.coins;
      p.coins = 0;
      if (!p.debtSince) p.debtSince = Date.now();
    }

    return p;
  }

  getLifeProfile(guildId, userId) {
    return this.ensureLifeProfile(guildId, userId);
  }

  getGuildLifeProfiles(guildId) {
    if (!this.data.lifeProfiles || !this.data.lifeProfiles[guildId]) return {};
    return this.data.lifeProfiles[guildId];
  }

  // ─── 🏦 البنك المركزي — نظام اقتصادي مستقل خاص بروم واحدة، per-guild ──
  ensureCentralBankProfile(guildId, userId) {
    if (!this.data.centralBank) this.data.centralBank = {};
    if (!this.data.centralBank[guildId]) this.data.centralBank[guildId] = { profiles: {}, channelId: null };
    const guild = this.data.centralBank[guildId];
    if (!guild.profiles) guild.profiles = {};

    if (!guild.profiles[userId]) {
      guild.profiles[userId] = {
        balance: 0,
        security: 1,
        lastClaim: 0,
        lastSalary: 0,
        lastHeist: 0,
        jailedUntil: 0,
        heistWins: 0,
        heistLosses: 0,
        totalEarned: 0,
        marriedTo: null,
        marriedAt: 0,
        job: null,
        createdAt: Date.now(),
      };
      this.save();
    }
    const p = guild.profiles[userId];
    if (typeof p.balance !== "number") p.balance = 0;
    if (typeof p.security !== "number") p.security = 1;
    if (typeof p.lastClaim !== "number") p.lastClaim = 0;
    if (typeof p.lastSalary !== "number") p.lastSalary = 0;
    if (typeof p.lastHeist !== "number") p.lastHeist = 0;
    if (typeof p.jailedUntil !== "number") p.jailedUntil = 0;
    if (typeof p.heistWins !== "number") p.heistWins = 0;
    if (typeof p.heistLosses !== "number") p.heistLosses = 0;
    if (typeof p.totalEarned !== "number") p.totalEarned = 0;
    if (p.marriedTo === undefined) p.marriedTo = null;
    if (typeof p.marriedAt !== "number") p.marriedAt = 0;
    if (p.job === undefined) p.job = null;
    return p;
  }

  getCentralBankProfile(guildId, userId) {
    return this.ensureCentralBankProfile(guildId, userId);
  }

  saveCentralBankProfile(guildId, userId, updates) {
    const p = this.ensureCentralBankProfile(guildId, userId);
    Object.assign(p, updates);
    this.save();
    return p;
  }

  getCentralBankLeaderboard(guildId, limit = 10) {
    if (!this.data.centralBank || !this.data.centralBank[guildId]) return [];
    const profiles = this.data.centralBank[guildId].profiles || {};
    return Object.entries(profiles)
      .map(([userId, p]) => ({ userId, ...p }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);
  }

  getCentralBankChannel(guildId) {
    if (!this.data.centralBank || !this.data.centralBank[guildId]) return null;
    return this.data.centralBank[guildId].channelId || null;
  }

  setCentralBankChannel(guildId, channelId) {
    if (!this.data.centralBank) this.data.centralBank = {};
    if (!this.data.centralBank[guildId]) this.data.centralBank[guildId] = { profiles: {}, channelId: null, channelIds: [] };
    this.data.centralBank[guildId].channelId = channelId;
    this.save();
    return channelId;
  }

  getCentralBankChannels(guildId) {
    if (!this.data.centralBank || !this.data.centralBank[guildId]) return [];
    const g = this.data.centralBank[guildId];
    if (Array.isArray(g.channelIds) && g.channelIds.length) return g.channelIds;
    return g.channelId ? [g.channelId] : [];
  }

  addCentralBankChannel(guildId, channelId) {
    if (!this.data.centralBank) this.data.centralBank = {};
    if (!this.data.centralBank[guildId]) this.data.centralBank[guildId] = { profiles: {}, channelId: null, channelIds: [] };
    const g = this.data.centralBank[guildId];
    if (!Array.isArray(g.channelIds)) g.channelIds = g.channelId ? [g.channelId] : [];
    if (!g.channelIds.includes(channelId)) g.channelIds.push(channelId);
    if (!g.channelId) g.channelId = channelId;
    this.save();
    return g.channelIds;
  }

  removeCentralBankChannel(guildId, channelId) {
    if (!this.data.centralBank || !this.data.centralBank[guildId]) return [];
    const g = this.data.centralBank[guildId];
    if (!Array.isArray(g.channelIds)) g.channelIds = g.channelId ? [g.channelId] : [];
    g.channelIds = g.channelIds.filter(id => id !== channelId);
    if (g.channelId === channelId) g.channelId = g.channelIds[0] || null;
    this.save();
    return g.channelIds;
  }

  // ═══════════════════════════════════════════════════════════════
  //  🎌 نظام الأنمي — Anime Profile
  // ═══════════════════════════════════════════════════════════════
  _ensureAnime(userId) {
    this.ensureUser(userId);
    if (!this.data.users[userId].anime) {
      this.data.users[userId].anime = {
        watching:   [],
        completed:  [],
        planToWatch:[],
        dropped:    [],
        ratings:    {},
      };
    }
    return this.data.users[userId].anime;
  }

  getAnimeProfile(userId) {
    return this._ensureAnime(userId);
  }

  getAnimeStatus(userId, malId) {
    const p = this._ensureAnime(userId);
    const id = parseInt(malId);
    if (p.watching.find(a => a.malId === id))    return "watching";
    if (p.completed.find(a => a.malId === id))   return "completed";
    if (p.planToWatch.find(a => a.malId === id)) return "plan";
    if (p.dropped.find(a => a.malId === id))     return "dropped";
    return null;
  }

  setAnimeStatus(userId, malId, title, status, totalEps = 0, image = null) {
    const p  = this._ensureAnime(userId);
    const id = parseInt(malId);
    const entry = { malId: id, title, totalEps, image, addedAt: Date.now(), progress: 0 };

    // شيل من كل القوايم الأول
    for (const key of ["watching", "completed", "planToWatch", "dropped"]) {
      p[key] = p[key].filter(a => a.malId !== id);
    }

    const listMap = { watching: "watching", completed: "completed", plan: "planToWatch", dropped: "dropped" };
    const list = listMap[status];
    if (list) {
      if (status === "completed") entry.progress = totalEps || entry.progress;
      p[list].push(entry);
    }
    this.save();
  }

  updateAnimeProgress(userId, malId, episode, totalEps = 0) {
    const p  = this._ensureAnime(userId);
    const id = parseInt(malId);
    let found = false;
    for (const key of ["watching", "completed", "planToWatch", "dropped"]) {
      const idx = p[key].findIndex(a => a.malId === id);
      if (idx >= 0) {
        p[key][idx].progress = episode;
        if (totalEps > 0) p[key][idx].totalEps = totalEps;
        found = true;
        break;
      }
    }
    // لو مش في أي قايمة، أضفه لـ watching تلقائياً
    if (!found) {
      p.watching.push({ malId: id, title: "", totalEps, image: null, addedAt: Date.now(), progress: episode });
    }
    this.save();
  }

  rateAnime(userId, malId, score, title = "") {
    const p  = this._ensureAnime(userId);
    const id = parseInt(malId);
    p.ratings[id] = score;
    // نضيف لـ completed لو مش موجود
    if (!this.getAnimeStatus(userId, id)) {
      p.completed.push({ malId: id, title, totalEps: 0, image: null, addedAt: Date.now(), progress: 0 });
    }
    this.save();
  }

  removeFromAnimeList(userId, malId) {
    const p  = this._ensureAnime(userId);
    const id = parseInt(malId);
    for (const key of ["watching", "completed", "planToWatch", "dropped"]) {
      p[key] = p[key].filter(a => a.malId !== id);
    }
    delete p.ratings[id];
    this.save();
  }

  // ─── قائمة الباند ────────────────────────────────────────────
  addBan(userId, reason, moderatorId = 'SYSTEM') {
    if (!this.data.banList) this.data.banList = {};
    this.data.banList[userId] = {
      userId,
      reason,
      moderatorId,
      timestamp: Date.now(),
    };
    this.save();
  }

  removeBan(userId) {
    if (!this.data.banList) return false;
    if (!this.data.banList[userId]) return false;
    delete this.data.banList[userId];
    this.save();
    return true;
  }

  getBanList() {
    if (!this.data.banList) this.data.banList = {};
    return this.data.banList;
  }

  isBanned(userId) {
    return !!(this.data.banList && this.data.banList[userId]);
  }

  getConfig(key, defaultValue = null) {
    if (!this.data.config) this.data.config = {};
    return this.data.config[key] !== undefined ? this.data.config[key] : defaultValue;
  }

  setConfig(key, value) {
    if (!this.data.config) this.data.config = {};
    this.data.config[key] = value;
    this.save();
  }

  clearOldData(maxAge = 86400000) {
    // Clear spam tracking after 24 hours
    const now = Date.now();
    for (const key in this.data.spamTracking) {
      if (now - this.data.spamTracking[key].firstMessageTime > maxAge) {
        delete this.data.spamTracking[key];
      }
    }
    this.save();
  }
}

export default Database;
