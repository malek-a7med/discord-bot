import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'server_database.json');

class Database {
  constructor() {
    this.data = this.load();
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

  save() {
    try {
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
        timeouts: []
      };
      this.save();
    }
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

  setWelcomeChannel(guildId, channelId) {
    this.data.welcome[guildId] = channelId;
    this.save();
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

  getAllData() {
    return this.data;
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
