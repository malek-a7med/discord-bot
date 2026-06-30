// ═══════════════════════════════════════════════════════════════
//  نظام RPG — زنجي Bot  v1.0
//
//  مبني فوق نظام XP/Level الموجود أصلاً — مش بديل له
//  بيضيف: Classes / Stats / Skills / Titles / Achievements / Equipment
// ═══════════════════════════════════════════════════════════════

// ─── الكلاسات المتاحة ──────────────────────────────────────────
export const CLASSES = Object.freeze({
  warrior: {
    id: "warrior", name: "⚔️ محارب", emoji: "⚔️",
    desc: "قوة وصلابة — يكسب XP أسرع من التفاعل في القتالات والمسابقات",
    baseStats: { strength: 8, intelligence: 3, charisma: 4, luck: 5 },
    bonus: "xp_boost_games", // XP أكتر من الألعاب
  },
  mage: {
    id: "mage", name: "🔮 ساحر", emoji: "🔮",
    desc: "ذكاء وحكمة — يكسب XP أسرع من الأسئلة والمسابقات الفكرية",
    baseStats: { strength: 3, intelligence: 9, charisma: 4, luck: 4 },
    bonus: "xp_boost_quiz",
  },
  rogue: {
    id: "rogue", name: "🗡️ ساحب", emoji: "🗡️",
    desc: "حظ وسرعة — فرصة أعلى لجوائز عشوائية ومكافآت يومية مضاعفة",
    baseStats: { strength: 5, intelligence: 5, charisma: 3, luck: 7 },
    bonus: "luck_boost",
  },
  bard: {
    id: "bard", name: "🎵 مُطرب", emoji: "🎵",
    desc: "كاريزما وحضور — يكسب XP أسرع من الكلام في الفويس والموسيقى",
    baseStats: { strength: 4, intelligence: 4, charisma: 8, luck: 4 },
    bonus: "xp_boost_social",
  },
});

// ─── الألقاب (Titles) — تتفتح بشروط معينة ─────────────────────
export const TITLES = Object.freeze([
  { id: "newcomer",      name: "🌱 قادم جديد",        condition: u => u.level >= 0 },
  { id: "regular",       name: "💬 عضو نشيط",          condition: u => u.level >= 10 },
  { id: "veteran",       name: "🛡️ مخضرم",             condition: u => u.level >= 25 },
  { id: "elite",         name: "⭐ نخبة",              condition: u => u.level >= 50 },
  { id: "legend",        name: "👑 أسطورة",            condition: u => u.level >= 100 },
  { id: "gamer",         name: "🎮 لاعب محترف",        condition: u => (u.rpg?.gamesWon || 0) >= 20 },
  { id: "quiz_master",   name: "🧠 عبقري المسابقات",   condition: u => (u.rpg?.quizWon || 0) >= 15 },
  { id: "music_lover",   name: "🎵 عاشق الموسيقى",     condition: u => (u.rpg?.songsPlayed || 0) >= 100 },
  { id: "rich",          name: "💰 الثري",             condition: u => (u.coins || 0) >= 50000 },
  { id: "lucky",         name: "🍀 محظوظ",             condition: u => (u.rpg?.luckyWins || 0) >= 10 },
  { id: "chatterbox",    name: "📢 ثرثار",             condition: u => (u.rpg?.messagesCount || 0) >= 5000 },
]);

// ─── الإنجازات (Achievements) — one-time unlocks ──────────────
export const ACHIEVEMENTS = Object.freeze([
  { id: "first_level",   name: "🎉 أول خطوة",        desc: "وصلت للمستوى 1",          xpReward: 50,  check: u => u.level >= 1 },
  { id: "level_10",      name: "📈 في الطريق",       desc: "وصلت للمستوى 10",         xpReward: 100, check: u => u.level >= 10 },
  { id: "level_50",      name: "🏔️ نص الطريق",       desc: "وصلت للمستوى 50",         xpReward: 500, check: u => u.level >= 50 },
  { id: "level_100",     name: "🏆 الأسطورة",        desc: "وصلت للمستوى 100",        xpReward: 1000, check: u => u.level >= 100 },
  { id: "first_game",    name: "🎮 أول لعبة",        desc: "لعبت أول لعبة",           xpReward: 30,  check: u => (u.rpg?.gamesPlayed || 0) >= 1 },
  { id: "game_master",   name: "🕹️ سيد الألعاب",     desc: "فزت بـ 20 لعبة",          xpReward: 300, check: u => (u.rpg?.gamesWon || 0) >= 20 },
  { id: "first_song",    name: "🎵 أول أغنية",       desc: "شغّلت أول أغنية",         xpReward: 20,  check: u => (u.rpg?.songsPlayed || 0) >= 1 },
  { id: "dj_status",     name: "🎧 الدي جي",         desc: "شغّلت 50 أغنية",          xpReward: 200, check: u => (u.rpg?.songsPlayed || 0) >= 50 },
  { id: "rich_1k",       name: "💵 ألفي الأول",      desc: "جمعت 1000 كوينز",         xpReward: 50,  check: u => (u.coins || 0) >= 1000 },
  { id: "rich_10k",      name: "💰 عشرة آلاف",       desc: "جمعت 10000 كوينز",        xpReward: 200, check: u => (u.coins || 0) >= 10000 },
  { id: "clean_record",  name: "😇 سجل نظيف",        desc: "30 يوم بدون تحذيرات",     xpReward: 150, check: u => (u.warnings?.length || 0) === 0 && u.level >= 5 },
]);

// ─── جدول معدلات XP حسب نوع النشاط ────────────────────────────
export const XP_RATES = {
  message: 5,
  game_win: 25,
  game_play: 8,
  quiz_correct: 15,
  song_played: 3,
  voice_minute: 2,
};

// ═══════════════════════════════════════════════════════════════
//  دوال الحساب
// ═══════════════════════════════════════════════════════════════

// ─── احسب الإحصائيات الكاملة للاعب (base + class bonus) ──────
export function calculateStats(userData) {
  const cls = CLASSES[userData.rpg?.class] || null;
  const level = userData.level || 0;
  const base = cls?.baseStats || { strength: 5, intelligence: 5, charisma: 5, luck: 5 };

  // كل لفل بيضيف نقطة لكل ستات + bonus حسب الكلاس
  const growth = Math.floor(level / 5);

  return {
    strength:     base.strength + growth,
    intelligence: base.intelligence + growth,
    charisma:     base.charisma + growth,
    luck:         base.luck + growth,
  };
}

// ─── جيب اللقب الحالي للاعب (أعلى لقب بيستحقه) ────────────────
export function getCurrentTitle(userData) {
  const eligible = TITLES.filter(t => t.condition(userData));
  return eligible[eligible.length - 1] || TITLES[0];
}

// ─── جيب كل الألقاب اللي اتفتحت ───────────────────────────────
export function getUnlockedTitles(userData) {
  return TITLES.filter(t => t.condition(userData));
}

// ─── احسب XP بونس حسب الكلاس ──────────────────────────────────
export function getXpMultiplier(userData, activityType) {
  const cls = CLASSES[userData.rpg?.class];
  if (!cls) return 1;

  const boostMap = {
    xp_boost_games: ["game_win", "game_play"],
    xp_boost_quiz:  ["quiz_correct"],
    xp_boost_social: ["message", "voice_minute"],
    luck_boost: [],
  };

  if (boostMap[cls.bonus]?.includes(activityType)) return 1.25; // +25%
  return 1;
}

// ─── فحص وفتح إنجازات جديدة — يرجع array من الإنجازات الجديدة ─
export function checkNewAchievements(userData) {
  if (!userData.rpg) userData.rpg = createDefaultRpgData();
  if (!userData.rpg.achievements) userData.rpg.achievements = [];

  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (userData.rpg.achievements.includes(ach.id)) continue;
    if (ach.check(userData)) {
      userData.rpg.achievements.push(ach.id);
      userData.xp = (userData.xp || 0) + ach.xpReward;
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}

// ─── بيانات RPG الافتراضية ─────────────────────────────────────
export function createDefaultRpgData() {
  return {
    class: null,
    achievements: [],
    gamesPlayed: 0,
    gamesWon: 0,
    quizWon: 0,
    songsPlayed: 0,
    luckyWins: 0,
    messagesCount: 0,
    selectedTitle: null, // null = يستخدم أعلى لقب تلقائي
  };
}

// ─── تأكد إن اليوزر عنده rpg data ──────────────────────────────
export function ensureRpgData(userData) {
  if (!userData.rpg) userData.rpg = createDefaultRpgData();
  // backward compat لو فيه fields ناقصة
  const defaults = createDefaultRpgData();
  for (const key in defaults) {
    if (userData.rpg[key] === undefined) userData.rpg[key] = defaults[key];
  }
  return userData.rpg;
}

// ─── سجل نشاط وارجع XP المكتسب + إنجازات جديدة ────────────────
export function recordActivity(userData, activityType, customAmount = null) {
  ensureRpgData(userData);

  const baseXp = customAmount ?? XP_RATES[activityType] ?? 0;
  const multiplier = getXpMultiplier(userData, activityType);
  const earnedXp = Math.round(baseXp * multiplier);

  userData.xp = (userData.xp || 0) + earnedXp;

  // تحديث العدادات حسب النشاط
  const counterMap = {
    game_play: "gamesPlayed",
    game_win: "gamesWon",
    quiz_correct: "quizWon",
    song_played: "songsPlayed",
    message: "messagesCount",
  };
  if (counterMap[activityType]) {
    userData.rpg[counterMap[activityType]] = (userData.rpg[counterMap[activityType]] || 0) + 1;
  }

  const newAchievements = checkNewAchievements(userData);

  return { earnedXp, multiplier, newAchievements };
}

// ─── بطاقة بروفايل نصية (يُستخدم في embed) ─────────────────────
export function formatProfileSummary(userData, username) {
  ensureRpgData(userData);
  const cls = CLASSES[userData.rpg.class];
  const stats = calculateStats(userData);
  const title = userData.rpg.selectedTitle
    ? TITLES.find(t => t.id === userData.rpg.selectedTitle) || getCurrentTitle(userData)
    : getCurrentTitle(userData);
  const unlockedCount = userData.rpg.achievements.length;
  const totalCount = ACHIEVEMENTS.length;

  return {
    title: title.name,
    class: cls ? `${cls.emoji} ${cls.name}` : "❓ لسه مالوش كلاس",
    stats,
    achievementsProgress: `${unlockedCount}/${totalCount}`,
    level: userData.level || 0,
    xp: userData.xp || 0,
  };
}
