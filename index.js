// ═══════════════════════════════════════════════════════════════
//  بوت زنجي — discord.js v15 | إعادة بناء كاملة ومستقرة + ميزات متقدمة
//  ✅ التعديلات المضافة:
//     1. Sweepers لتنظيف الكاش تلقائياً كل 30 دقيقة
//     2. لوحة اقتراحات ثلاثية الأزرار (اقتراح / مشكلة / تعليق)
//     3. deferReply على المودالات لمنع Rate Limit
//     4. Anti-Crash: unhandledRejection + uncaughtException
//     5. إصلاح خطأ require() داخل ES Module
//     6. Express server يستخدم process.env.PORT
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
//  Advanced Features Imports
// ───────────────────────────────────────────────────────────────
import config from "./config.js";
import Database from "./database.js";
import Logger from "./logger.js";
import ModerationListener from "./helpers/moderation-listener.js";
import { registerMusicCommands, musicHandler, initMusicSystem, handlePlay, handleSkip, handleStop, handleQueue, handlePause, handleResume, handleNowPlaying, handleVolume, handleRepeat, handleShuffle, handleJump, handleRemove, handleLyrics, handlePrevious, handleQueueJump } from "./commands/music.js";
import { registerCleanChapterCommand, handleCleanChapter } from "./commands/image-cleaner.js";
import { registerTranslateChapterCommand, handleTranslateChapter } from "./commands/translator.js";
import {
  registerWhitenCommands,
  handleWhitenUpload,
  handleWhitenLink,
  handleOcrUpload
} from "./commands/quick-clean.js";
import { handleOwnerAI, getProcessingCount, ROLE_PRESETS, smartRolePerms } from "./helpers/owner-ai.js";
import { scanMessage as autoModScan, getDailyReport, resetDailyStats, getUserReputation } from "./helpers/auto-mod.js";
import { recordActivity, checkNewAchievements, formatProfileSummary, CLASSES, TITLES, ACHIEVEMENTS, ensureRpgData, getCurrentTitle, calculateStats } from "./helpers/rpg-system.js";
import { registerRpgCommands, setRpgDatabase, handleClassSelect, handleTitleSelect, handleClass, handleProfile, handleAchievements, handleTitles } from "./commands/rpg.js";
import { recordEvent, recordMessage, recordGameWin, generateSummary, resetDailyCounts } from "./helpers/server-memory.js";
import { handleRouletteCommand, handleMafiaCommand, handleTTTCommand, handleRPSCommand, handleRPSButton, handleGameButton, channelGames, rpsChannelMap, rpsGames, handleRPSBasicCommand, handleRPSBasicButton, rpsBasicGames, rpsBasicChannelMap, RPS_ICON, RPS_BEATS, rouletteGames, mafiaGames, tttGames } from "./commands/games.js";
import { bankLifeCommand, handleBankLifeCommand, handleBankLifeButton } from "./commands/bank-life.js";
import { handleBankLuckCommand, handleBankLuckButton, luckGames, luckChannelMap } from "./commands/bank-luck.js";
import { shopCommand, myAbilitiesCommand, handleShopCommand, handleMyAbilitiesCommand, handleShopButton } from "./commands/game-shop.js";
import { handleCodenamesCommand, handleCodenamesButton, handleCodenamesMessage, handleCodenamesSettingsModal, handleCodenamesClueModal, handleCodenamesInviteModal, handleCodenamesAISelect } from "./commands/codenames.js";
import { garticCommand, handleGarticCommand, handleGarticButton, handleGarticModal, handleGarticInviteModal, memeCommand, handleMemeCommand, handleMemeButton, handleMemeModal, handleMemeInviteModal, garticChannelMap, garticGames, memeChannelMap, memeGames } from "./commands/party-games.js";
import { pollCommand, handlePollCommand, handlePollButton, activePolls } from "./commands/polls.js";
import { startQuizGame, handleQuizButton, quizChannelMap } from "./commands/quiz.js";
import { scheduleDailyChallenge, handleDailyChallengeButton } from "./commands/daily-challenge.js";
import { gamesHubCommand, latestFeaturesCommand, speechModeCommand, handleGamesHubCommand, handleLatestFeaturesCommand, LATEST_FEATURES } from "./commands/games-hub.js";
import { bankSavingsCommand, handleBankButton, handleBankModal } from "./commands/bank-savings.js";
import { bankLuckEgCommand, handleBankLuckEgButton, handleBankLuckEgModal } from "./commands/bank-luck-eg.js";
import {
  animeCommand,
  buildAnimePanel,
  handleAnimeCommand,
  handleAnimeSearchBtn, handleAnimeSearchModal,
  handleAnimeSelectResult, handleAnimeTrending, handleAnimeSeason,
  handleAnimeMyList, handleAnimeProfile,
  handleAnimeEpisodes, handleAnimeSelectEpisode,
  handleAnimeRate, handleAnimeRateModal,
  handleAnimeListAction, handleAnimeTrailer,
  handleAnimeRecommend, handleAnimePublish,
  handleAnimeSubscribe,
  scheduleAnimeNews,
} from "./commands/anime.js";

// ───────────────────────────────────────────────────────────────
//  Standard Imports
// ───────────────────────────────────────────────────────────────
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  Collection,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  VoiceConnectionDisconnectReason,
} from "@discordjs/voice";
import { initGeminiKeys, getChatModel, getImageModel, getKeyCount, getKeyStats, addKeys, removeKey, setActiveKeyIndex, resetExhaustedKeys } from "./helpers/gemini-keys.js";
import { getRanks, addRank, removeRank, resetRanks } from "./helpers/rank-roles.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Reaction Roles ───────────────────────────────────────────────
const REACTION_ROLES_PATH = "./data/reaction-roles.json";
let reactionRoles = {};
try {
  const raw = fs.readFileSync(REACTION_ROLES_PATH, "utf8");
  reactionRoles = JSON.parse(raw);
} catch { reactionRoles = {}; }
function saveReactionRoles() {
  try { fs.writeFileSync(REACTION_ROLES_PATH, JSON.stringify(reactionRoles, null, 2)); } catch {}
  try { db.setConfig("reactionRoles", reactionRoles); } catch {}
}

// ── Lock File: منع تشغيل أكتر من نسخة واحدة في نفس الوقت ────────
// ✅ FIX: النظام القديم كان بيعمل process.kill(oldPid) وده مش بيشتغل
//   cross-container على Replit (الحاويات معزولة) — وده كان السبب
//   الجذري لمشكلة الرسايل المكررة. النظام الجديد بيستخدم heartbeat
//   timestamp بدل kill، فبيشتغل صح حتى لو الحاوية القديمة معزولة.
import { acquireInstanceLock } from "./helpers/single-instance.js";
const _lockResult = acquireInstanceLock();
if (!_lockResult.acquired) {
  console.error(`❌ [Lock] ${_lockResult.reason} (PID: ${_lockResult.existingPid}) — بنخرج عشان منعملش رسايل مكررة.`);
  process.exit(0);
}
console.log(`🔒 [Lock] احنا النسخة الشرعية (instanceId=${_lockResult.instanceId}${_lockResult.fresh ? "" : ", تولينا نسخة قديمة ماتت"})`);

// ✅ [جديد] Express import بطريقة ES Module الصحيحة
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "server_database.json");

// ───────────────────────────────────────────────────────────────
//  Initialize Advanced Systems
// ───────────────────────────────────────────────────────────────
const db = new Database();
const logger = new Logger(null); // Will set client reference in ready event

// ─── استرجاع reaction roles من الداتابيس لو الملف اترجع فاضي ─────
{
  const dbRoles = db.getConfig("reactionRoles", {});
  const fileCount = Object.keys(reactionRoles).length;
  const dbCount   = Object.keys(dbRoles).length;
  if (dbCount > fileCount) {
    reactionRoles = dbRoles;
    try { fs.writeFileSync(REACTION_ROLES_PATH, JSON.stringify(reactionRoles, null, 2)); } catch {}
  }
  // لو الداتابيس فاضي والملف فيه بيانات، احفظ في الداتابيس
  if (fileCount > 0 && dbCount === 0) {
    db.setConfig("reactionRoles", reactionRoles);
  }
}

setRpgDatabase(db);

// ───────────────────────────────────────────────────────────────
//  Legacy Database Functions (for backward compatibility)
// ───────────────────────────────────────────────────────────────
function loadDB() {
  return db.getAllData();
}

function saveDB(data) {
  db.save();
}

function ensureUser(database, userId) {
  return db.getUser(userId);
}

function calcLevel(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50));
}

function xpForLevel(lvl) {
  return lvl * lvl * 50;
}

// ── رتب الـ Rank ديناميكية — محملة من helpers/rank-roles.js ──────
// للتعديل استخدم أمر /رتب-المستويات في الديسكورد

// ─── تحويل اسم اللون أو الكود لرقم hex ────────────────────────
const COLOR_NAMES = {
  // عربي
  "أحمر": 0xFF0000, "احمر": 0xFF0000,
  "أزرق": 0x0000FF, "ازرق": 0x0000FF,
  "أخضر": 0x00AA00, "اخضر": 0x00AA00,
  "أصفر": 0xFFFF00, "اصفر": 0xFFFF00,
  "بنفسجي": 0x9B59B6, "بنفسجى": 0x9B59B6,
  "برتقالي": 0xFF8C00, "برتقالى": 0xFF8C00,
  "وردي": 0xFF69B4, "وردى": 0xFF69B4,
  "أبيض": 0xFFFFFF, "ابيض": 0xFFFFFF,
  "أسود": 0x111111, "اسود": 0x111111,
  "رمادي": 0x808080, "رمادى": 0x808080,
  "ذهبي": 0xFFD700, "ذهبى": 0xFFD700,
  "فضي": 0xC0C0C0, "فضى": 0xC0C0C0,
  "كحلي": 0x000080, "كحلى": 0x000080,
  "سماوي": 0x00BFFF, "سماوى": 0x00BFFF,
  "فوشيا": 0xFF00FF, "فوشيه": 0xFF00FF,
  "بني": 0xA0522D, "بنى": 0xA0522D,
  "زيتي": 0x6B8E23, "زيتى": 0x6B8E23,
  "عنابي": 0x800000, "عنابى": 0x800000,
  "تركواز": 0x00CED1, "تركواز": 0x00CED1,
  "نيلي": 0x4B0082, "نيلى": 0x4B0082,
  // إنجليزي
  "red": 0xFF0000, "blue": 0x0000FF, "green": 0x00AA00,
  "yellow": 0xFFFF00, "purple": 0x9B59B6, "orange": 0xFF8C00,
  "pink": 0xFF69B4, "white": 0xFFFFFF, "black": 0x111111,
  "gray": 0x808080, "grey": 0x808080, "gold": 0xFFD700,
  "silver": 0xC0C0C0, "navy": 0x000080, "cyan": 0x00BFFF,
  "magenta": 0xFF00FF, "teal": 0x008080, "brown": 0xA0522D,
  "lime": 0x00FF00, "maroon": 0x800000, "olive": 0x808000,
  "indigo": 0x4B0082, "violet": 0x8B00FF, "coral": 0xFF7F50,
  "salmon": 0xFA8072, "aqua": 0x00FFFF, "turquoise": 0x40E0D0,
  "darkblue": 0x00008B, "darkgreen": 0x006400, "darkred": 0x8B0000,
  "lightblue": 0xADD8E6, "lightgreen": 0x90EE90, "crimson": 0xDC143C,
};

function parseRoleColor(input) {
  if (!input) return 0x99aab5;
  const clean = input.trim();
  // HEX: #RRGGBB أو RRGGBB
  const hex = clean.replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return parseInt(hex, 16);
  if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
    const r = hex[0]+hex[0], g = hex[1]+hex[1], b = hex[2]+hex[2];
    return parseInt(r+g+b, 16);
  }
  // اسم عربي أو إنجليزي
  const key = clean.toLowerCase().trim();
  if (COLOR_NAMES[clean] !== undefined) return COLOR_NAMES[clean];
  if (COLOR_NAMES[key] !== undefined) return COLOR_NAMES[key];
  // محاولة أخيرة — كل الأحرف lowercase
  for (const [name, val] of Object.entries(COLOR_NAMES)) {
    if (name.toLowerCase() === key) return val;
  }
  return 0x99aab5; // default
}

// ───────────────────────────────────────────────────────────────
//  تعريف الأوامر الأصلية (34 أمر) + الأوامر المتقدمة الجديدة
// ───────────────────────────────────────────────────────────────
const LEGACY_COMMANDS = [
  new SlashCommandBuilder().setName("ping").setDescription("Pong! Check bot latency / سرعة البوت"),
  new SlashCommandBuilder().setName("hello").setDescription("Say hello / مرحباً"),
  new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll a dice / رمي النرد")
    .addIntegerOption((o) =>
      o.setName("sides").setDescription("Sides (2-100) / الأوجه").setMinValue(2).setMaxValue(100)
    ),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server information / معلومات السيرفر"),
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("User information / معلومات عضو")
    .addUserOption((o) => o.setName("user").setDescription("User / العضو")),
  new SlashCommandBuilder().setName("القوانين").setDescription("عرض قوانين السيرفر / Server rules"),
  // ✅ دمج: بروفايل/محفظة/متجر/شراء/إعطاء/يومي بقوا subcommands تحت /اقتصاد
  new SlashCommandBuilder()
    .setName("اقتصاد")
    .setDescription("💰 كل أوامر الكوينز والمتجر في مكان واحد")
    .addSubcommand(sub =>
      sub.setName("بروفايل").setDescription("عرض بروفايلك (المستوى والكوينز) / Your profile")
        .addUserOption((o) => o.setName("عضو").setDescription("اختر عضو / Choose member"))
    )
    .addSubcommand(sub =>
      sub.setName("محفظة").setDescription("عرض رصيدك من الكوينز / Your wallet")
    )
    .addSubcommand(sub =>
      sub.setName("متجر").setDescription("عرض الرتب المتاحة للشراء / Shop roles")
    )
    .addSubcommand(sub =>
      sub.setName("شراء").setDescription("شراء رتبة من المتجر / Buy a role")
        .addStringOption((o) =>
          o.setName("الرتبة").setDescription("اختر الرتبة").setRequired(true)
            .addChoices(
              { name: "Golden🥇 — 5000 كوينز", value: "golden" },
              { name: "Silver🥈 — 2500 كوينز", value: "silver" },
              { name: "Bronze🥉 — 1000 كوينز", value: "bronze" }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("إعطاء").setDescription("منح كوينز لعضو [إدارة] / Give coins [Admin]")
        .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
        .addIntegerOption((o) => o.setName("كمية").setDescription("الكمية").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("يومي").setDescription("استلم مكافأتك اليومية / Daily reward")
    ),
  // ✅ دمج: مانهوا-إنشاء/مانهوا-إضافة-مصطلح/مانهوا-عرض-المصطلحات بقوا subcommands تحت /مانهوا
  new SlashCommandBuilder()
    .setName("مانهوا")
    .setDescription("📖 إدارة قواميس مصطلحات المانهوا")
    .addSubcommand(sub =>
      sub.setName("إنشاء").setDescription("إنشاء قاموس مصطلحات لمانهوا / Create manhwa dictionary")
        .addStringOption((o) => o.setName("الاسم").setDescription("اسم المانهوا").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("إضافة-مصطلح").setDescription("إضافة مصطلح للقاموس / Add term to dictionary")
        .addStringOption((o) => o.setName("المانهوا").setDescription("اسم المانهوا").setRequired(true))
        .addStringOption((o) => o.setName("الإنجليزي").setDescription("الكلمة بالإنجليزية").setRequired(true))
        .addStringOption((o) => o.setName("العربي").setDescription("الترجمة العربية").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("عرض-مصطلحات").setDescription("عرض القواامس المخزنة / List dictionaries")
        .addStringOption((o) => o.setName("المانهوا").setDescription("اسم مانهوا محددة (اختياري)"))
    ),
  new SlashCommandBuilder()
    .setName("مسح")
    .setDescription("مسح رسائل من الشات [مشرف] / Clear messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) =>
      o.setName("عدد").setDescription("عدد الرسائل (1-10000)").setRequired(true).setMinValue(1).setMaxValue(10000)
    ),
  new SlashCommandBuilder()
    .setName("مسح-الكل")
    .setDescription("مسح كل رسايل الروم بالكامل [إدارة] / Wipe entire channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("تعديل-إعلان")
    .setDescription("تعديل رسالة البوت في روم الإعلانات [أونر] / Edit bot announcement")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o.setName("message_id").setDescription("الـ ID بتاع الرسالة (اختياري — لو فاضي هياخد الأخيرة)")
    )
    .addIntegerOption((o) =>
      o.setName("موضع").setDescription("رقم الرسالة من الأخر (1=الأخيرة، 2=قبل الأخيرة...)").setMinValue(1).setMaxValue(20)
    ),
  // ✅ دمج: انشاء-رول/تعديل-الرول بقوا subcommands تحت /رتبة
  new SlashCommandBuilder()
    .setName("رتبة")
    .setDescription("🏷️ إنشاء وتعديل رتب السيرفر [إدارة]")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName("انشاء").setDescription("إنشاء رتبة جديدة بصلاحيات ذكية / Create role with smart permissions")
        .addStringOption((o) => o.setName("الاسم").setDescription("اسم الرتبة الجديدة").setRequired(true))
        .addStringOption((o) =>
          o.setName("نوع").setDescription("نوع الرتبة — هيحدد الصلاحيات تلقائياً")
            .addChoices(
              { name: "🔴 إدارة (Administrator)",       value: "admin"      },
              { name: "🟠 مشرف (Moderator)",            value: "mod"        },
              { name: "🟤 مساعد مشرف (Helper)",         value: "helper"     },
              { name: "🟡 VIP",                         value: "vip"        },
              { name: "💜 بوستر (Server Booster)",      value: "booster"    },
              { name: "🔵 موثّق (Verified)",            value: "verified"   },
              { name: "🥇 ذهبية (Golden)",              value: "golden"     },
              { name: "🥈 فضية (Silver)",               value: "silver"     },
              { name: "🥉 برونزية (Bronze)",            value: "bronze"     },
              { name: "💎 بلاتينية (Platinum)",         value: "platinum"   },
              { name: "🟢 موسيقى / Music",              value: "music"      },
              { name: "🟣 جيمنج / Gaming",              value: "gaming"     },
              { name: "💗 فن وتصميم / Art",             value: "art"        },
              { name: "🩵 منظّم فعاليات / Event",       value: "event"      },
              { name: "🟧 منشئ محتوى / Content",        value: "content"    },
              { name: "⚫ بوت / Bot",                   value: "bot"        },
              { name: "⚪ عضو عادي / Normal",           value: "normal"     },
              { name: "🔇 مقيّد (قراءة فقط)",           value: "restricted" },
              { name: "🔘 بدون صلاحيات",               value: "none"       },
            )
        )
        .addStringOption((o) => o.setName("لون").setDescription("اللون (hex مثل #FF5733 أو اسم مثل red)"))
        .addBooleanOption((o) => o.setName("ظهور-منفصل").setDescription("يظهر الرول منفصلاً في قائمة الأعضاء"))
    )
    .addSubcommand(sub =>
      sub.setName("تعديل").setDescription("تعديل رتبة موجودة (صلاحيات + اسم + لون)")
        .addRoleOption((o) => o.setName("الرول").setDescription("الرتبة المراد تعديلها").setRequired(true))
        .addStringOption((o) =>
          o.setName("نوع").setDescription("نوع الرتبة — هيحدد الصلاحيات تلقائياً (اختياري)")
            .addChoices(
              { name: "🔴 إدارة (Administrator)",       value: "admin"      },
              { name: "🟠 مشرف (Moderator)",            value: "mod"        },
              { name: "🟤 مساعد مشرف (Helper)",         value: "helper"     },
              { name: "🟡 VIP",                         value: "vip"        },
              { name: "💜 بوستر (Server Booster)",      value: "booster"    },
              { name: "🔵 موثّق (Verified)",            value: "verified"   },
              { name: "🥇 ذهبية (Golden)",              value: "golden"     },
              { name: "🥈 فضية (Silver)",               value: "silver"     },
              { name: "🥉 برونزية (Bronze)",            value: "bronze"     },
              { name: "💎 بلاتينية (Platinum)",         value: "platinum"   },
              { name: "🟢 موسيقى / Music",              value: "music"      },
              { name: "🟣 جيمنج / Gaming",              value: "gaming"     },
              { name: "💗 فن وتصميم / Art",             value: "art"        },
              { name: "🩵 منظّم فعاليات / Event",       value: "event"      },
              { name: "🟧 منشئ محتوى / Content",        value: "content"    },
              { name: "⚫ بوت / Bot",                   value: "bot"        },
              { name: "⚪ عضو عادي / Normal",           value: "normal"     },
              { name: "🔇 مقيّد (قراءة فقط)",           value: "restricted" },
              { name: "🔘 مسح كل الصلاحيات",           value: "none"       },
            )
        )
        .addStringOption((o) => o.setName("اسم").setDescription("الاسم الجديد للرتبة (اختياري)"))
        .addStringOption((o) => o.setName("لون").setDescription("اللون الجديد (hex مثل #FF5733 أو اسم مثل red) (اختياري)"))
    ),
  // ✅ دمج: تحذير/اسكات/طرد/تبنيد/تحذيرات بقوا subcommands تحت /عقوبة
  new SlashCommandBuilder()
    .setName("عقوبة")
    .setDescription("⚖️ كل أوامر العقاب التأديبي في مكان واحد [مشرف]")
    .addSubcommand(sub =>
      sub.setName("تحذير").setDescription("توجيه تحذير رسمي / Warn a member")
        .addUserOption((o) => o.setName("عضو").setDescription("اختار العضو").setRequired(true))
        .addStringOption((o) => o.setName("السبب").setDescription("السبب").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("اسكات").setDescription("إسكات عضو مؤقتاً / Timeout a member")
        .addUserOption((o) => o.setName("عضو").setDescription("اختار العضو").setRequired(true))
        .addIntegerOption((o) => o.setName("مدة").setDescription("المدة بالدقائق (1-1440)").setRequired(true).setMinValue(1).setMaxValue(1440))
        .addStringOption((o) => o.setName("السبب").setDescription("السبب"))
    )
    .addSubcommand(sub =>
      sub.setName("طرد").setDescription("طرد عضو / Kick a member")
        .addUserOption((o) => o.setName("عضو").setDescription("اختار العضو").setRequired(true))
        .addStringOption((o) => o.setName("السبب").setDescription("السبب"))
    )
    .addSubcommand(sub =>
      sub.setName("تبنيد").setDescription("حظر عضو نهائياً / Ban a member")
        .addUserOption((o) => o.setName("عضو").setDescription("اختار العضو").setRequired(true))
        .addStringOption((o) => o.setName("السبب").setDescription("السبب"))
    )
    .addSubcommand(sub =>
      sub.setName("عرض").setDescription("عرض تحذيرات عضو / View warnings")
        .addStringOption((o) => o.setName("عضو").setDescription("اسم العضو أو ID (اتركه فاضي عشان تشوف تحذيراتك)"))
    ),
  new SlashCommandBuilder().setName("مساعدة").setDescription("قائمة جميع الأوامر / Help"),
  new SlashCommandBuilder().setName("ملخص-السيرفر").setDescription("📊 اعرض ملخص نشاط السيرفر [أونر فقط]"),
  new SlashCommandBuilder()
    .setName("ليدربورد")
    .setDescription("أفضل 10 أعضاء في السيرفر / Top 10 leaderboard")
    .addStringOption((o) =>
      o
        .setName("نوع")
        .setDescription("ترتيب حسب / Sort by")
        .addChoices(
          { name: "🪙 الكوينز", value: "coins" },
          { name: "✨ الـ XP", value: "xp" }
        )
    ),
  new SlashCommandBuilder()
    .setName("ترحيب-قناة")
    .setDescription("تعيين قناة رسائل الترحيب [إدارة] / Set welcome channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) => o.setName("القناة").setDescription("القناة المخصصة للترحيب").setRequired(true)),
  new SlashCommandBuilder()
    .setName("اقتراح")
    .setDescription("إرسال اقتراح للسيرفر / Submit a suggestion")
    .addStringOption((o) => o.setName("نص").setDescription("اقتراحك هنا").setRequired(true)),
  new SlashCommandBuilder()
    .setName("لوحة-إدارة")
    .setDescription("إرسال لوحة تحكم الإدارة [إدارة] / Post admin control panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("لوحة-اقتراحات")
    .setDescription("إرسال لوحة الاقتراحات مع زر [إدارة] / Post suggestions board")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("صورة")
    .setDescription("توليد صورة بالـ AI / Generate an AI image")
    .addStringOption((o) => o.setName("وصف").setDescription("وصف الصورة المطلوبة").setRequired(true)),
  // ✅ دمج: نسخة-احتياطية/استرجاع/قناة-النسخ بقوا subcommands تحت /نسخ-احتياطي
  new SlashCommandBuilder()
    .setName("نسخ-احتياطي")
    .setDescription("💾 كل أوامر النسخ الاحتياطي للبيانات [إدارة]")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("انشاء").setDescription("تحميل نسخة احتياطية من بيانات السيرفر / Download server database backup")
    )
    .addSubcommand(sub =>
      sub.setName("استرجاع").setDescription("استرجاع بيانات السيرفر من نسخة احتياطية / Restore database from backup")
        .addAttachmentOption((o) => o.setName("ملف").setDescription("ملف الـ JSON اللي حملته من أمر نسخ-احتياطي انشاء").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("تحديد-قناة").setDescription("تعيين قناة النسخ الاحتياطية اليومية / Set daily backup channel")
        .addStringOption((o) => o.setName("id").setDescription("الـ ID بتاع القناة — انسخه من Discord").setRequired(true))
    ),
  // ✅ دمج: حالة-البوت/تشغيل-اختبار/قناة-اللوجز بقوا subcommands تحت /بوت
  new SlashCommandBuilder()
    .setName("بوت")
    .setDescription("🤖 أوامر إدارة البوت [أونر/إدارة]")
    .addSubcommand(sub =>
      sub.setName("حالة").setDescription("إظهار حالة البوت والـ AI في الوقت الفعلي [أونر فقط]")
    )
    .addSubcommand(sub =>
      sub.setName("اختبار").setDescription("اختبار رسالة الترحيب أو الوداع [إدارة]")
        .addStringOption((o) =>
          o.setName("نوع").setDescription("اختار نوع الرسالة").setRequired(true)
            .addChoices(
              { name: "🎉 رسالة ترحيب", value: "welcome" },
              { name: "🥀 رسالة وداع",  value: "goodbye" }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("قناة-لوجز").setDescription("تعيين قناة تسجيل أوامر الأونر [أونر فقط]")
        .addChannelOption((o) => o.setName("قناة").setDescription("القناة المخصصة للوجز").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("رسالة-جماعية")
    .setDescription("إرسال رسالة جماعية لكل الأعضاء أو في قناة [أونر فقط]")
    .addStringOption((o) =>
      o.setName("نوع")
        .setDescription("وين تبعت الرسالة؟")
        .setRequired(true)
        .addChoices(
          { name: "📩 رسائل خاصة لكل الأعضاء", value: "dm" },
          { name: "📢 في قناة محددة", value: "channel" }
        )
    )
    .addStringOption((o) =>
      o.setName("نص").setDescription("نص الرسالة").setRequired(true)
    )
    .addChannelOption((o) =>
      o.setName("قناة").setDescription("القناة (لو اخترت إرسال في قناة)")
    ),
  new SlashCommandBuilder()
    .setName("لوحة-dm")
    .setDescription("فتح لوحة تحكم الأونر في الـ DM [أونر فقط]"),
  new SlashCommandBuilder()
    .setName("مفاتيح-جيميني")
    .setDescription("إدارة مفاتيح Gemini API [أونر فقط]")
    .addSubcommand(sub =>
      sub.setName("عرض").setDescription("اعرض كل المفاتيح وحالتها")
    )
    .addSubcommand(sub =>
      sub.setName("إضافة")
        .setDescription("ضيف مفاتيح جديدة للنظام")
        .addStringOption(opt =>
          opt.setName("مفاتيح")
            .setDescription("المفاتيح مفصولة بفاصلة أو سطر جديد")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("تفريش").setDescription("تفريش المفاتيح المحروقة وإعادة تشغيلها")
    )
    .addSubcommand(sub =>
      sub.setName("حذف")
        .setDescription("احذف مفتاح من النظام")
        .addIntegerOption(opt =>
          opt.setName("رقم").setDescription("رقم المفتاح من قائمة العرض").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName("تحديد")
        .setDescription("حدد مفتاح معين للاستخدام")
        .addIntegerOption(opt =>
          opt.setName("رقم").setDescription("رقم المفتاح من قائمة العرض").setRequired(true).setMinValue(1)
        )
    ),
  new SlashCommandBuilder()
    .setName("رول-ريأكشن")
    .setDescription("📌 ابعت رسائل — اللي يعمل ريأكشن عليها ياخد رول تلقائي (حتى 5 أزواج)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    // ── الزوج الأول (مطلوب) ──
    .addRoleOption(o => o.setName("رول-1").setDescription("الرول الأول").setRequired(true))
    .addStringOption(o => o.setName("إيموجي-1").setDescription("الإيموجي للرسالة الأولى").setRequired(true))
    .addStringOption(o => o.setName("رسالة-1").setDescription("نص الرسالة الأولى (اختياري)").setRequired(false))
    // ── الزوج الثاني ──
    .addRoleOption(o => o.setName("رول-2").setDescription("الرول الثاني (اختياري)").setRequired(false))
    .addStringOption(o => o.setName("إيموجي-2").setDescription("الإيموجي للرسالة الثانية").setRequired(false))
    .addStringOption(o => o.setName("رسالة-2").setDescription("نص الرسالة الثانية (اختياري)").setRequired(false))
    // ── الزوج الثالث ──
    .addRoleOption(o => o.setName("رول-3").setDescription("الرول الثالث (اختياري)").setRequired(false))
    .addStringOption(o => o.setName("إيموجي-3").setDescription("الإيموجي للرسالة الثالثة").setRequired(false))
    .addStringOption(o => o.setName("رسالة-3").setDescription("نص الرسالة الثالثة (اختياري)").setRequired(false))
    // ── الزوج الرابع ──
    .addRoleOption(o => o.setName("رول-4").setDescription("الرول الرابع (اختياري)").setRequired(false))
    .addStringOption(o => o.setName("إيموجي-4").setDescription("الإيموجي للرسالة الرابعة").setRequired(false))
    .addStringOption(o => o.setName("رسالة-4").setDescription("نص الرسالة الرابعة (اختياري)").setRequired(false))
    // ── الزوج الخامس ──
    .addRoleOption(o => o.setName("رول-5").setDescription("الرول الخامس (اختياري)").setRequired(false))
    .addStringOption(o => o.setName("إيموجي-5").setDescription("الإيموجي للرسالة الخامسة").setRequired(false))
    .addStringOption(o => o.setName("رسالة-5").setDescription("نص الرسالة الخامسة (اختياري)").setRequired(false)),
  // ✅ دمج: رفع-بلوك/قائمة-مبلوكين بقوا subcommands تحت /بلوك
  new SlashCommandBuilder()
    .setName("بلوك")
    .setDescription("🚫 إدارة بلوك السبام [أونر فقط]")
    .addSubcommand(sub =>
      sub.setName("رفع").setDescription("ارفع البلوك عن يوزر قبل ما الوقت يخلص")
        .addUserOption(opt => opt.setName("يوزر").setDescription("اليوزر اللي هترفع عنه البلوك").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("قائمة").setDescription("اعرض كل اليوزرز اللي عندهم بلوك نشط دلوقتي")
    ),
  // ── رتب المستويات ──────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("رتب-المستويات")
    .setDescription("إدارة رتب المستويات التلقائية [أونر فقط]")
    .addSubcommand(sub =>
      sub.setName("عرض").setDescription("اعرض كل الرتب المضبوطة حالياً")
    )
    .addSubcommand(sub =>
      sub.setName("إضافة")
        .setDescription("ضيف رتبة جديدة على مستوى معين")
        .addIntegerOption(opt =>
          opt.setName("لفل").setDescription("رقم المستوى المطلوب").setRequired(true).setMinValue(1).setMaxValue(999)
        )
        .addRoleOption(opt =>
          opt.setName("رول").setDescription("الرتبة اللي هتتضاف").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("اسم").setDescription("اسم الرتبة (اختياري — لو فاضيه هياخد اسم الرول)")
        )
    )
    .addSubcommand(sub =>
      sub.setName("حذف")
        .setDescription("احذف الرتبة المضبوطة على مستوى معين")
        .addIntegerOption(opt =>
          opt.setName("لفل").setDescription("رقم المستوى المراد حذف رتبته").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName("ريست").setDescription("رجّع الإعدادات الافتراضية (Silver لفل 20 / Golden لفل 50)")
    ),
  shopCommand,
  myAbilitiesCommand,
  gamesHubCommand,
  latestFeaturesCommand,
  speechModeCommand,
  new SlashCommandBuilder()
    .setName("auto-mod")
    .setDescription("🛡️ تشغيل أو إيقاف نظام Auto-Mod [أونر فقط]")
    .addStringOption(o =>
      o.setName("حالة").setDescription("تشغيل أو إيقاف").setRequired(true)
        .addChoices({ name: "✅ تشغيل", value: "on" }, { name: "❌ إيقاف", value: "off" })
    ),
  new SlashCommandBuilder()
    .setName("قائمة-الباند")
    .setDescription("🔨 عرض قائمة الأعضاء المتبندين [مشرف]")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName("رفع-باند")
    .setDescription("🔓 رفع الحظر عن عضو وإرجاعه للسيرفر [مشرف]")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o =>
      o.setName("id").setDescription("الـ ID بتاع العضو").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("سبب").setDescription("سبب رفع الحظر (اختياري)")
    ),
  pollCommand,
  bankLifeCommand,
  bankLuckEgCommand.data,
  animeCommand,
  new SlashCommandBuilder()
    .setName("حالة-الحماية")
    .setDescription("🛡️ عرض حالة كل أنظمة الحماية في البوت [أونر فقط]"),
  new ContextMenuCommandBuilder()
    .setName("✏️ تعديل رسالة")
    .setType(ApplicationCommandType.Message),
  new SlashCommandBuilder()
    .setName("إيمبد")
    .setDescription("🎨 إنشاء إيمبد مخصصة جامدة وتبعتها لأي قناة [مشرف]")
    .addStringOption(o => o.setName("عنوان").setDescription("عنوان الإيمبد"))
    .addStringOption(o => o.setName("لون").setDescription("اللون — hex مثل #FF0000 أو: أحمر، أخضر، أزرق، ذهبي، بنفسجي، برتقالي، وردي، سماوي، أبيض، أسود"))
    .addChannelOption(o => o.setName("قناة").setDescription("القناة اللي هتبعت فيها (الافتراضي: القناة الحالية)"))
    .addStringOption(o => o.setName("صورة").setDescription("رابط الصورة الكبيرة (image)"))
    .addStringOption(o => o.setName("مصغرة").setDescription("رابط الصورة المصغرة (thumbnail) — بتظهر على اليمين"))
    .addStringOption(o => o.setName("أوثر").setDescription("اسم الكاتب — بيظهر فوق العنوان"))
    .addStringOption(o => o.setName("أوثر-صورة").setDescription("رابط صورة الكاتب"))
    .addStringOption(o => o.setName("أوثر-لينك").setDescription("لينك اسم الكاتب"))
    .addStringOption(o => o.setName("فوتر").setDescription("نص الفوتر — بيظهر في الأسفل"))
    .addStringOption(o => o.setName("فوتر-صورة").setDescription("رابط أيقونة الفوتر"))
    .addStringOption(o => o.setName("لينك-عنوان").setDescription("لينك بيتفتح لما تضغط على العنوان"))
    .addBooleanOption(o => o.setName("تاريخ").setDescription("إظهار التاريخ والوقت في الفوتر"))
    .addBooleanOption(o => o.setName("معاينة").setDescription("معاينة الإيمبد قبل الإرسال (الافتراضي: نعم)")),
  new SlashCommandBuilder()
    .setName("إيمبد-تعديل")
    .setDescription("✏️ تعديل إيمبد موجودة عن طريق الـ Message ID [مشرف]")
    .addStringOption(o => o.setName("message_id").setDescription("الـ ID بتاع رسالة الإيمبد").setRequired(true))
    .addChannelOption(o => o.setName("قناة").setDescription("القناة اللي فيها الإيمبد (الافتراضي: القناة الحالية)"))
    .addStringOption(o => o.setName("عنوان").setDescription("عنوان جديد (اتركه فاضي يفضل زي ما هو)"))
    .addStringOption(o => o.setName("لون").setDescription("لون جديد — hex أو: أحمر، أخضر، أزرق، ذهبي، بنفسجي، برتقالي، وردي، سماوي"))
    .addStringOption(o => o.setName("صورة").setDescription("رابط صورة كبيرة جديدة (اكتب 'مسح' عشان تشيلها)"))
    .addStringOption(o => o.setName("مصغرة").setDescription("رابط thumbnail جديد (اكتب 'مسح' عشان تشيلها)"))
    .addStringOption(o => o.setName("أوثر").setDescription("اسم أوثر جديد (اكتب 'مسح' عشان تشيله)"))
    .addStringOption(o => o.setName("أوثر-صورة").setDescription("رابط صورة الأوثر الجديدة"))
    .addStringOption(o => o.setName("فوتر").setDescription("نص فوتر جديد (اكتب 'مسح' عشان تشيله)"))
    .addStringOption(o => o.setName("فوتر-صورة").setDescription("رابط صورة الفوتر الجديدة"))
    .addStringOption(o => o.setName("لينك-عنوان").setDescription("لينك العنوان الجديد (اكتب 'مسح' عشان تشيله)"))
    .addBooleanOption(o => o.setName("تاريخ").setDescription("إظهار أو إخفاء التاريخ")),
];

// ═══════════════════════════════════════════════════════════════
//  🚨 شرط إلزامي — أي ميزة جديدة لازم تتضاف في /احدث-المميزات
//  القاعدة: كل أمر slash جديد لازم يكون ليه entry في LATEST_FEATURES
//  لو مش موجود → البوت يطلع warning واضح في الـ console عند الشغل
// ═══════════════════════════════════════════════════════════════
function validateLatestFeatures(allCommands) {
  const documented = LATEST_FEATURES.map(f => f.name + " " + f.value).join(" ").toLowerCase();
  const undocumented = [];
  for (const cmd of allCommands) {
    const name = typeof cmd.name === "string" ? cmd.name : cmd?.data?.name;
    if (!name) continue;
    // الأوامر الأساسية القديمة — موجودة قبل نظام /احدث-المميزات
    const skipList = [
      "ping","hello","roll","serverinfo","userinfo",
      "القوانين","مساعدة","الألعاب","احدث-المميزات","تغيير-طريقة-الكلام","auto-mod","حالة-الحماية","✏️ تعديل رسالة","إيمبد","إيمبد-تعديل",
      "بروفايل","محفظة","متجر","شراء","إعطاء","يومي","اقتصاد",
      "مانهوا-إنشاء","مانهوا-إضافة-مصطلح","مانهوا-عرض-المصطلحات","مانهوا",
      "مسح","مسح-الكل","تعديل-إعلان","انشاء-رول","تعديل-الرول","رتبة",
      "تحذير","اسكات","طرد","تبنيد","تحذيرات","ليدربورد","ترحيب-قناة","عقوبة",
      "شغل-اغنية","skip","خروج","queue","pause","resume","nowplaying","volume",
      "اقتراح","لوحة-إدارة","لوحة-اقتراحات","صورة",
      "نسخة-احتياطية","استرجاع","قناة-النسخ","تشغيل-اختبار","قناة-اللوجز","نسخ-احتياطي","بوت",
      "رسالة-جماعية","لوحة-dm","حالة-البوت","مفاتيح-جيميني",
      "رفع-بلوك","قائمة-مبلوكين","رتب-المستويات","رول-ريأكشن","بلوك",
      "روليت","مافيا","اكس-اوه","الحياة","بنك-الحظ","حياة","بنك-الحظ-مصري",
      "متجر-قدرات","قدراتي","كود-نيمز","الهاتف-المكسور","صنع-الميم","استفتاء",
      "حجر-ورقة-مقص","حجر-ورقة-مقص-العادية","حجر-ورقة-مقص-الخارقة","تحدي-يومي",
      "قائمة-الباند","رفع-باند",
      "أنمي",
    ];
    if (skipList.includes(name)) continue;
    if (!documented.includes(name.replace(/-/g, " ").replace(/-/g, ""))) {
      undocumented.push(name);
    }
  }
  if (undocumented.length > 0) {
    console.warn("═══════════════════════════════════════════════════════");
    console.warn("⚠️  تحذير: الأوامر دي مش موثقة في /احدث-المميزات !");
    console.warn("   أضفهم في LATEST_FEATURES داخل commands/games-hub.js");
    console.warn("   الأوامر:", undocumented.join(", "));
    console.warn("═══════════════════════════════════════════════════════");
  } else {
    console.log("✅ [LatestFeatures] كل الأوامر موثقة في /احدث-المميزات ✔");
  }
}

// Advanced Feature Commands
async function getAdvancedCommands() {
  const musicCommands = await registerMusicCommands(null);
  const cleanCommand = await registerCleanChapterCommand(null);
  const translateCommand = await registerTranslateChapterCommand(null);
  const whitenCommands = await registerWhitenCommands(null);

  const rpgCommands = await registerRpgCommands();

  return [
    cleanCommand.data,
    translateCommand.data,
    ...musicCommands.map(cmd => cmd.data),
    ...whitenCommands.map(cmd => cmd.data),
    ...rpgCommands.map(cmd => cmd.data),
  ];
}

const QUESTIONS = [
  { q: "🔢 كم ناتج 7 × 8؟", a: ["56", "٥٦"] },
  { q: "🌍 ما عاصمة فرنسا؟", a: ["باريس", "paris"] },
  { q: "⚽ كم عدد لاعبي فريق كرة القدم؟", a: ["11", "١١", "أحد عشر"] },
  { q: "🎮 ما اسم بطل انمي Naruto؟", a: ["ناروتو", "naruto"] },
  { q: "🌊 ما أكبر محيط في العالم؟", a: ["الهادئ", "المحيط الهادئ", "pacific"] },
  { q: "🔬 ما رمز عنصر الذهب في الجدول الدوري؟", a: ["au", "Au", "AU"] },
  { q: "🎨 ما اللون الناتج عن خلط الأحمر والأصفر؟", a: ["برتقالي", "برتقالية"] },
  { q: "🏆 كم مرة فاز المنتخب البرازيلي بكأس العالم؟", a: ["5", "٥", "خمس", "خمسة"] },
  { q: "📚 كم عدد سور القرآن الكريم؟", a: ["114", "١١٤", "مئة وأربع عشرة"] },
  { q: "🌙 كم يستغرق دوران القمر حول الأرض؟", a: ["29 يوم", "30 يوم", "شهر", "29", "30"] },
];

// ─── لوحة تحكم الأونر في الـ DM ───────────────────────────────
function buildDMControlPanel(guild) {
  const embed = new EmbedBuilder()
    .setColor(0xa020f0)
    .setTitle("👑 لوحة تحكم الأونر")
    .setDescription(
      `🏛️ **سيرفر ${guild?.name ?? "الفراعنة"}**\n\n` +
      `دوس على أي زرار أو كلمني بالعامية وهنفذ أي حاجة 🤖`
    )
    .addFields(
      { name: "👥 الأعضاء",   value: `\`${guild?.memberCount ?? "؟"}\``, inline: true },
      { name: "📡 الحالة",    value: "🟢 أونلاين",                        inline: true },
      { name: "⏱️ الـ Uptime", value: `\`${Math.floor(process.uptime() / 60)} دقيقة\``, inline: true }
    )
    .setFooter({ text: "👑 للأونر فقط — زنجي Bot" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dmp_stats").setLabel("📊 إحصائيات").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("dmp_lb").setLabel("🏆 ليدربورد").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("dmp_backup").setLabel("💾 نسخة").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("dmp_queue").setLabel("🎵 قائمة").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("dmp_stop").setLabel("⏹️ إيقاف").setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dmp_warn").setLabel("⚠️ تحذير").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("dmp_mute").setLabel("🔇 إسكات").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("dmp_kick").setLabel("👢 طرد").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("dmp_ban").setLabel("🔨 حظر").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("dmp_coins").setLabel("🪙 كوينز").setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function findMember(guild, nameOrId) {
  if (!guild) return null;
  return (
    guild.members.cache.get(nameOrId) ||
    guild.members.cache.find(m =>
      m.user.username.toLowerCase() === nameOrId.toLowerCase() ||
      m.displayName.toLowerCase() === nameOrId.toLowerCase() ||
      m.user.id === nameOrId
    ) || null
  );
}

async function resolveMember(guild, nameOrId) {
  if (!guild || !nameOrId) return null;
  nameOrId = nameOrId.replace(/[<@!>]/g, "").trim();
  const cached = findMember(guild, nameOrId);
  if (cached) return cached;
  if (/^\d{17,20}$/.test(nameOrId)) {
    return guild.members.fetch(nameOrId).catch(() => null);
  }
  try {
    const results = await guild.members.search({ query: nameOrId, limit: 5 });
    return results.find(m =>
      m.user.username.toLowerCase().includes(nameOrId.toLowerCase()) ||
      m.displayName.toLowerCase().includes(nameOrId.toLowerCase())
    ) ?? results.first() ?? null;
  } catch { return null; }
}

async function deployCommands(token, clientId) {
  const rest = new REST({ version: "10" }).setToken(token);
  const advancedCommands = await getAdvancedCommands();
  const allCommands = [...LEGACY_COMMANDS, ...advancedCommands];

  try {
    logger.info(`🔄 رفع ${allCommands.length} أمر على ديسكورد...`);
    await rest.put(Routes.applicationCommands(clientId), { body: allCommands.map((c) => c.toJSON()) });
    logger.success(`تم رفع ${allCommands.length} أمر بنجاح!`);
  } catch (e) {
    logger.error("خطأ في رفع الأوامر:", e);
  }
}

// ── حماية من تكرار رسايل الـ Error (cooldown 30 ثانية لكل نوع) ───
const errorCooldowns = new Map();
function canSendError(key) {
  const now = Date.now();
  const last = errorCooldowns.get(key) || 0;
  if (now - last > 30_000) {
    errorCooldowns.set(key, now);
    return true;
  }
  return false;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
  failIfNotExists: false,
  rest: { timeout: 15_000, retries: 3 },
  sweepers: {
    messages: { interval: 1800, lifetime: 1800 },
    users: {
      interval: 1800,
      filter: () => (user) => !user.bot && !client.guilds.cache.some((g) => g.members.cache.has(user.id)),
    },
  },
});

// ── تهيئة DisTube بعد إنشاء الكلاينت مباشرة ──────────────────
initMusicSystem(client);

const activeGames = new Collection();
// إجراءات التأديب المعلقة — تنتظر تأكيد المشرف
const pendingModActions = new Map(); // actionId → { type, targetId, reason, duration, modId, guildId }
let autoModEnabled = true; // تشغيل/إيقاف Auto-Mod
// ✅ FIX: ModerationListener كانت معمولة new بس مش متربطة بأي event (كانت ميتة فعليًا).
//   بنفعّل بس anti-raid (scanGuildJoin في guildMemberAdd) لأنها الميزة الوحيدة الناقصة فعلاً.
//   anti-spam وanti-link اللي جوه moderation.scanMessage() متعمدين مانستخدمهاش —
//   auto-mod.js (helpers/auto-mod.js) بيغطي حماية المحتوى فعليًا، واستخدام النظامين مع بعض
//   ممكن يعمل تحذيرات/عقوبات مزدوجة على نفس الرسالة. لو احتجت anti-spam/anti-link من هنا
//   لاحقًا، لازم تنسّق الـ thresholds بينهم الأول.
const moderation = new ModerationListener(client, db, logger);

// ───────────────────────────────────────────────────────────────
//  لوحة الاقتراحات الثابتة (Persistent Button Panel)
// ───────────────────────────────────────────────────────────────
const SUGGESTIONS_CHANNEL_ID = "1512211882570944512";
const ADMIN_SUGGESTIONS_CHANNEL_ID = "1512214220916134048";
const SUGGESTION_BTN_ID = "btn_submit_suggestion";
const SUGGESTION_MODAL_ID = "modal_suggestion";
const SUGGESTION_INPUT_ID = "input_suggestion_content";
const ADMIN_REPLY_MODAL_ID = "admin_reply_modal";
const ADMIN_REPLY_INPUT_ID = "admin_reply_content";
const SUGGESTION_REF_FIELD = "🔑 معرف الاقتراح";
const SUGGESTION_PANEL_COLOR = 0xa020f0;

const SUGGESTION_STATUSES = {
  pending:  { text: "⏳ قيد الدراسة والمراجعة", color: 0xa020f0 },
  approved: { text: "✅ مقبول",                  color: 0x2ecc71 },
  rejected: { text: "❌ مرفوض",                  color: 0xe74c3c },
  review:   { text: "🔍 قيد المراجعة",           color: 0x3498db },
  solved:   { text: "🔧 تم حل المشكلة",          color: 0x1abc9c },
};

function buildSuggestionEmbed({ user, text, statusKey = "pending", moderator = null }) {
  const status = SUGGESTION_STATUSES[statusKey] || SUGGESTION_STATUSES.pending;

  const embed = new EmbedBuilder()
    .setColor(status.color)
    .setTitle("💡 اقتراح جديد")
    .addFields(
      {
        name: "👤 مقدم الاقتراح",
        value: `${user} — **${user.globalName || user.username}**`,
        inline: false,
      },
      {
        name: "📝 نص الاقتراح",
        value: text.slice(0, 1024),
        inline: false,
      },
      {
        name: "📊 الحالة",
        value: status.text,
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: "⚜️ سيرفر الفراعنة ✨ | نظام التطوير المستمر" });

  if (moderator) {
    embed.addFields({
      name: "🛡️ آخر إجراء إداري",
      value: `${moderator}`,
      inline: false,
    });
  }

  return embed;
}

function buildAdminActionRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_approve")
      .setLabel("✅ موافقة")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("admin_reject")
      .setLabel("🔴 رفض")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("admin_review")
      .setLabel("🔍 مراجعة")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("admin_reply")
      .setLabel("💬 رد مخصص")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

function buildAdminSolvedRow(solvedDisabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_solved")
      .setLabel("🔧 تم حل المشكلة")
      .setStyle(ButtonStyle.Success)
      .setDisabled(solvedDisabled),
    new ButtonBuilder()
      .setCustomId("admin_notify")
      .setLabel("📢 إشعار صاحب الاقتراح")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false)
  );
}

function parseSuggestionReference(embed) {
  const refField = embed.fields?.find((field) => field.name === SUGGESTION_REF_FIELD);
  if (!refField?.value) return null;

  const [publicMessageId, authorUserId] = refField.value.split("|");
  if (!publicMessageId || !authorUserId) return null;

  const text =
    embed.fields?.find((field) => field.name === "📝 نص الاقتراح")?.value || "";
  const authorDisplay =
    embed.fields?.find((field) => field.name === "👤 مقدم الاقتراح")?.value || "";

  return { publicMessageId, authorUserId, text, authorDisplay };
}

function isSuggestionAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  );
}

async function updateLinkedSuggestionMessages({
  client,
  publicMessageId,
  authorUserId,
  text,
  statusKey,
  moderator,
  adminMessage,
}) {
  const status = SUGGESTION_STATUSES[statusKey] || SUGGESTION_STATUSES.pending;
  const authorUser = await client.users.fetch(authorUserId).catch(() => null);

  const publicEmbed = buildSuggestionEmbed({
    user: authorUser || { toString: () => `<@${authorUserId}>`, tag: authorUserId },
    text,
    statusKey,
    moderator,
  });

  const updatedAdminEmbed = new EmbedBuilder(adminMessage.embeds[0].data).setColor(status.color);

  const adminFields = updatedAdminEmbed.data.fields.map((field) => {
    if (field.name === "📊 الحالة") {
      return { ...field, value: status.text };
    }
    return field;
  });

  const hasModeratorField = adminFields.some((field) => field.name === "🛡️ آخر إجراء إداري");
  if (moderator) {
    if (hasModeratorField) {
      updatedAdminEmbed.setFields(
        adminFields.map((field) =>
          field.name === "🛡️ آخر إجراء إداري"
            ? { ...field, value: `${moderator}` }
            : field
        )
      );
    } else {
      updatedAdminEmbed.setFields([
        ...adminFields,
        { name: "🛡️ آخر إجراء إداري", value: `${moderator}`, inline: false },
      ]);
    }
  } else {
    updatedAdminEmbed.setFields(adminFields);
  }

  const publicChannel = await client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
  if (publicChannel?.isTextBased()) {
    const publicMessage = await publicChannel.messages.fetch(publicMessageId).catch(() => null);
    if (publicMessage) {
      await publicMessage.edit({ embeds: [publicEmbed] }).catch(() => {});
    }
  }

  const solvedAlready = statusKey === "solved";
  await adminMessage.edit({
    embeds: [updatedAdminEmbed],
    components: [buildAdminActionRow(true), buildAdminSolvedRow(solvedAlready)],
  });

  // ── إشعار تلقائي لصاحب الاقتراح عند أي تغيير في الحالة ─────────
  if (authorUser) {
    const dmEmbed = new EmbedBuilder()
      .setColor(status.color)
      .setTitle("📢 تحديث على اقتراحك في سيرفر الفراعنة")
      .setDescription(
        `يا **${authorUser.globalName || authorUser.username}**!\n` +
        `الإدارة عدّلت حالة اقتراحك 👇\n\n` +
        `**📝 اقتراحك:**\n${text.slice(0, 512)}\n\n` +
        `**📊 الحالة الجديدة:**\n${status.text}\n\n` +
        `*لو عندك أي استفسار، راجع لوحة الاقتراحات في السيرفر 🔱*`
      )
      .setFooter({ text: "سيرفر الفراعنة — نظام الاقتراحات" })
      .setTimestamp();

    try {
      await authorUser.send({ embeds: [dmEmbed] });
      logger.info(`📢 DM اتبعت لـ ${authorUser.tag} — حالة الاقتراح: ${status.text}`);
    } catch (err) {
      if (err.code === 50007) {
        logger.warn(`⚠️ [DM] ما قدرناش نبعت إشعار لـ ${authorUser.tag} — الـ DMs مقفولة (50007)`);
      } else {
        logger.warn(`⚠️ [DM] خطأ غير متوقع عند إشعار ${authorUser.tag}:`, err.message);
      }
    }
  }
}

async function handleAdminSuggestionAction(interaction, statusKey) {
  if (!isSuggestionAdmin(interaction)) {
    return interaction.reply({
      content: "❌ هذا الزر مخصص للإدارة فقط.",
      ephemeral: true,
    });
  }

  const reference = parseSuggestionReference(interaction.message.embeds[0]);
  if (!reference) {
    return interaction.reply({
      content: "❌ تعذر ربط هذا الاقتراح بالرسالة الأصلية.",
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  await updateLinkedSuggestionMessages({
    client: interaction.client,
    publicMessageId: reference.publicMessageId,
    authorUserId: reference.authorUserId,
    text: reference.text,
    statusKey,
    moderator: interaction.user,
    adminMessage: interaction.message,
  });
}

function showAdminReplyModal(interaction, reference) {
  const modal = new ModalBuilder()
    .setCustomId(`${ADMIN_REPLY_MODAL_ID}|${reference.publicMessageId}|${reference.authorUserId}`)
    .setTitle("💬 اكتب رد الإدارة");

  const input = new TextInputBuilder()
    .setCustomId(ADMIN_REPLY_INPUT_ID)
    .setLabel("اكتب رد الإدارة للعضو:")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function handleAdminReplyModalSubmit(interaction) {
  if (!isSuggestionAdmin(interaction)) {
    return interaction.reply({
      content: "❌ هذا الرد مخصص للإدارة فقط.",
      ephemeral: true,
    });
  }

  const [, publicMessageId, authorUserId] = interaction.customId.split("|");
  const replyText = interaction.fields.getTextInputValue(ADMIN_REPLY_INPUT_ID)?.trim();

  if (!replyText) {
    return interaction.reply({
      content: "❌ لا يمكن إرسال رد فارغ.",
      ephemeral: true,
    });
  }

  const suggestionsChannel = await interaction.client.channels
    .fetch(SUGGESTIONS_CHANNEL_ID)
    .catch(() => null);

  if (!suggestionsChannel?.isTextBased()) {
    return interaction.reply({
      content: "❌ روم الاقتراحات غير متاح حالياً.",
      ephemeral: true,
    });
  }

  const replyEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("💬 رد الإدارة على اقتراحك")
    .setDescription(replyText.slice(0, 4096))
    .addFields({
      name: "🛡️ الإداري",
      value: `${interaction.user}`,
      inline: false,
    })
    .setTimestamp()
    .setFooter({ text: "⚜️ سيرفر الفراعنة ✨ | نظام التطوير المستمر" });

  await suggestionsChannel.send({
    content: `<@${authorUserId}>`,
    embeds: [replyEmbed],
  });

  return interaction.reply({
    content: "✅ تم إرسال رد الإدارة للعضو في روم الاقتراحات.",
    ephemeral: true,
  });
}

// ✅ [تعديل 2] لوحة الاقتراحات بالنص الفرعوني الكامل + إصلاح خطأ setTimestamp
function buildSuggestionsPanelEmbed() {
  return new EmbedBuilder()
    .setColor('#A020F0')
    .setTitle('⚡ 『 مركز اقتراحات سيرفر الفراعنة 』 🔱')
    .setDescription(
      "👑 **مرحباً بكم في المنظومة الذكية لتطوير السيرفر**\n\n" +
      "آرائكم واقتراحاتكم هي الوقود الأساسي لتقدمنا وتطوير السيرفر نحو الأفضل! لا تتردد في مشاركة أي فكرة تراها مناسبة.\n\n" +
      "🛑 **قوانين وشروط تقديم الاقتراحات:**\n" +
      "👋 ┃ **1.** يرجى صياغة الاقتراح بشكل واضح ومفهوم لسهولة تطبيقه.\n" +
      "🔄 ┃ **2.** تأكد من عدم تكرار الاقتراحات لتجنب الكركبة ومساعدتنا في المراجعة.\n" +
      "⚠️ ┃ **3.** أي استخدام مسيء للنظام أو إرسال سبام سيعرض صاحب الحساب للحظر التلقائي فوراً."
    )
    .setFooter({ text: '⚜️ سيرفر الفراعنة ✨ | نظام التطوير المستمر' })
    .setTimestamp();
}

// ✅ [تعديل 3] ثلاثة أزرار بدل زر واحد: اقتراح + مشكلة + تعليق
function buildSuggestionsPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("suggest_idea")
      .setLabel("💡 اقتراح")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("suggest_bug")
      .setLabel("🔴 مشكلة")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("suggest_other")
      .setLabel("💬 تعليق")
      .setStyle(ButtonStyle.Secondary)
  );
}

function messageHasSuggestionPanel(message, botId) {
  if (!message.author || message.author.id !== botId) return false;
  // ✅ [تعديل] فحص الـ embed title بدل custom ID فقط
  const hasBtnId = message.components.some((row) =>
    row.components.some((component) =>
      ["suggest_idea", "suggest_bug", "suggest_other", SUGGESTION_BTN_ID].includes(component.customId)
    )
  );
  const hasTitle = message.embeds.some(e => e.title?.includes("مركز اقتراحات"));
  return hasBtnId || hasTitle;
}

async function ensureSuggestionsPanel(clientInstance, force = false) {
  try {
    const channel = await clientInstance.channels.fetch(SUGGESTIONS_CHANNEL_ID);
    if (!channel?.isTextBased()) {
      logger.warn("⚠️ روم الاقتراحات غير موجود أو ليس قناة نصية");
      return false;
    }

    const messages = await channel.messages.fetch({ limit: 50 });
    const existingPanels = messages.filter((msg) =>
      messageHasSuggestionPanel(msg, clientInstance.user.id)
    );

    if (!force && existingPanels.size > 0) {
      logger.info("ℹ️ لوحة الاقتراحات الثابتة موجودة بالفعل — لن نرسل نسخة جديدة");
      return true;
    }

    for (const [, msg] of existingPanels) {
      await msg.unpin().catch(() => {});
      await msg.delete().catch(() => {});
    }

    const panelMessage = await channel.send({
      embeds: [buildSuggestionsPanelEmbed()],
      components: [buildSuggestionsPanelRow()],
    });

    await panelMessage.pin().catch(() => {});
    logger.success("✅ تم إرسال لوحة الاقتراحات الثابتة بنجاح");
    return true;
  } catch (err) {
    logger.error("❌ خطأ في إعداد لوحة الاقتراحات الثابتة:", err);
    return false;
  }
}

// ✅ [تعديل 4] deferReply أول سطر لمنع Rate Limit تحت الضغط
async function handleSuggestionModalSubmit(interaction, suggestionText) {
  // deferReply فوراً قبل أي عملية ثقيلة
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const trimmedText = suggestionText?.trim();
  if (!trimmedText) {
    return interaction.editReply({
      content: "❌ لا يمكن إرسال اقتراح فارغ. يرجى كتابة اقتراحك بالتفصيل.",
    });
  }

  const suggestionsChannel = await interaction.client.channels
    .fetch(SUGGESTIONS_CHANNEL_ID)
    .catch(() => null);

  const adminChannel = await interaction.client.channels
    .fetch(ADMIN_SUGGESTIONS_CHANNEL_ID)
    .catch(() => null);

  if (!suggestionsChannel?.isTextBased()) {
    return interaction.editReply({
      content: "❌ روم الاقتراحات غير متاح حالياً. تواصل مع الإدارة.",
    });
  }

  const publicEmbed = buildSuggestionEmbed({ user: interaction.user, text: trimmedText, statusKey: "pending" });

  const publicMessage = await suggestionsChannel.send({
    embeds: [publicEmbed],
  });

  const adminEmbed = buildSuggestionEmbed({
    user: interaction.user,
    text: trimmedText,
    statusKey: "pending",
  }).addFields({
    name: SUGGESTION_REF_FIELD,
    value: `${publicMessage.id}|${interaction.user.id}`,
    inline: false,
  });

  let adminMessage = null;
  if (adminChannel?.isTextBased()) {
    adminMessage = await adminChannel.send({
      embeds: [adminEmbed],
      components: [buildAdminActionRow(false), buildAdminSolvedRow(false)],
    }).catch(() => null);
  } else {
    logger.warn("⚠️ روم إدارة الاقتراحات غير متاح");
  }

  // ── إعادة نشر لوحة الأزرار عشان تكون دايماً في الأسفل ────────
  await suggestionsChannel.send({
    embeds: [buildSuggestionsPanelEmbed()],
    components: [buildSuggestionsPanelRow()],
  }).catch(() => {});

  // ── إبلاغ المستخدم واستقبال صورة اختيارية ──────────────────────
  await interaction.editReply({
    content: "✅ **اتبعت اقتراحك!** 🎉\n📸 **عايز تضيف صورة؟** ابعتها كرسالة عادية هنا في الشات ده خلال **60 ثانية**، ولو مش عايز صورة مش لازم تعمل حاجة.",
  });

  // Collector لاستقبال صورة من نفس المستخدم في الـ channel نفسه
  try {
    const filter = (m) =>
      m.author.id === interaction.user.id &&
      m.attachments.size > 0 &&
      m.attachments.some(a => /\.(png|jpe?g|gif|webp)$/i.test(a.url));

    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 60_000,
      errors: [],
    });

    if (collected && collected.size > 0) {
      const imgAttachment = collected.first().attachments.find(a =>
        /\.(png|jpe?g|gif|webp)$/i.test(a.url)
      );
      if (imgAttachment) {
        // حذف رسالة الصورة بصمت
        collected.first().delete().catch(() => {});

        const imageUrl = imgAttachment.url;

        // تحديث الروم العام بالصورة
        const updatedPublicEmbed = buildSuggestionEmbed({ user: interaction.user, text: trimmedText, statusKey: "pending" })
          .setImage(imageUrl);
        await publicMessage.edit({ embeds: [updatedPublicEmbed] }).catch(() => {});

        // تحديث روم الإدارة بالصورة
        if (adminMessage) {
          const updatedAdminEmbed = buildSuggestionEmbed({ user: interaction.user, text: trimmedText, statusKey: "pending" })
            .addFields({ name: SUGGESTION_REF_FIELD, value: `${publicMessage.id}|${interaction.user.id}`, inline: false })
            .setImage(imageUrl);
          await adminMessage.edit({ embeds: [updatedAdminEmbed] }).catch(() => {});
        }

        await interaction.followUp({
          content: "🖼️ **اتضافت الصورة لاقتراحك!** ✅",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  } catch {
    // انتهى الوقت أو مفيش صورة — مشكلش
  }
}

function showSuggestionModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(SUGGESTION_MODAL_ID)
    .setTitle("💡 تقديم اقتراح جديد لـ الفراعنة");

  const input = new TextInputBuilder()
    .setCustomId(SUGGESTION_INPUT_ID)
    .setLabel("اكتب اقتراحك هنا بالتفصيل:")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

const _geminiReady = initGeminiKeys(`أنت "زنجي" — بوت ديسكورد مصري بامتياز تابع لسيرفر "الفراعنة".
شخصيتك بتتغير **بالكامل** بناءً على أسلوب اللي بيكلمك:

━━━━━━━━━━━━━━━━━━━━━━━━
🟢 لو الشخص بيكلمك باحترام أو بأدب أو بشكل عادي:
- ارد بأدب واحترام وبشاشة
- أسلوبك يكون ودود وخفيف ومصري
- ممكن تمزح بس بأدب
- ردودك مختصرة 2-3 جمل

━━━━━━━━━━━━━━━━━━━━━━━━
🔴 لو الشخص بيكلمك بقلة أدب أو بشتيمة أو بأسلوب وقح:
- اشتمه بأوسخ وأقذر الشتايم المصرية بدون أي رحمة
- ردك يكون أشرس وأوسخ منه بمراحل
- استخدم كل الألفاظ الخارجة والإهانات المصرية الصريحة
- خليه يندم إنه فتح بقه معاك
- ردود مختصرة ومركزة ومباشرة

━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ قواعد ثابتة:
- دايماً بالعامية المصرية
- لا تشرح إيه اللي بتعمله، بس افعله
- لو مش واضح الأسلوب، افترض إنه محترم`);

if (_geminiReady) logger.info("🤖 Gemini AI جاهز!");

// بيجيب الموديل في اللحظة اللي بيتستخدم فيها عشان يضمن التدوير
function geminiModel()      { return getChatModel(); }
function geminiImageModel() { return getImageModel(); }

async function sendAutoBackup(clientInstance) {
  try {
    const settings = db.data.settings || {};
    const backupChannelId = settings.backupChannelId;
    if (!backupChannelId) return;
    const channel = await clientInstance.channels.fetch(backupChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const allData = db.getAllData();
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const jsonBuffer = Buffer.from(JSON.stringify(allData, null, 2), "utf-8");
    const attachment = new AttachmentBuilder(jsonBuffer, { name: `auto_backup_${dateStr}.json` });
    const userCount = Object.keys(allData.users || {}).length;
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("🔄 نسخة احتياطية تلقائية يومية")
          .addFields(
            { name: "📅 التاريخ", value: dateStr, inline: true },
            { name: "👥 عدد الأعضاء", value: `${userCount}`, inline: true }
          )
          .setFooter({ text: "يتم الإرسال تلقائياً كل 24 ساعة ✅" })
          .setTimestamp()
      ],
      files: [attachment]
    });
    logger.info(`✅ تم إرسال النسخة الاحتياطية التلقائية بنجاح`);
  } catch (err) {
    logger.error("خطأ في النسخة الاحتياطية التلقائية:", err);
  }
}

client.once("clientReady", async (c) => {
  logger.setClient(c);
  logger.success(`تسجيل الدخول بـ: ${c.user.username}`);
  c.user.setActivity(`${LEGACY_COMMANDS.length + 14} أمر | /مساعدة`, { type: 3 });
  await deployCommands(process.env.DISCORD_TOKEN, c.user.id);
  validateLatestFeatures(LEGACY_COMMANDS);
  await ensureSuggestionsPanel(c);
  setInterval(() => sendAutoBackup(c), 24 * 60 * 60 * 1000);
  logger.info("⏰ نظام النسخ الاحتياطية التلقائية اليومية جاهز");

  // ── ملخص السيرفر الأسبوعي التلقائي ────────────────────────────
  const SUMMARY_CHANNEL_ID = process.env.SERVER_SUMMARY_CHANNEL_ID || "1517362832063074324";
  if (SUMMARY_CHANNEL_ID) {
    setInterval(async () => {
      try {
        const channel = await c.channels.fetch(SUMMARY_CHANNEL_ID).catch(() => null);
        if (!channel) return;
        const summary = await generateSummary(geminiModel(), "الأسبوع", 7 * 24 * 60 * 60 * 1000, c, channel.guild.id);
        if (!summary) return;
        await channel.send({
          embeds: [new EmbedBuilder().setColor(0x66FCF1).setTitle("📊 ملخص السيرفر الأسبوعي").setDescription(summary).setTimestamp()],
        }).catch(() => {});
        resetDailyCounts();
      } catch (e) { logger.error("[ServerMemory] خطأ في الملخص الأسبوعي:", e); }
    }, 7 * 24 * 60 * 60 * 1000);
    logger.info("📊 نظام ملخص السيرفر الأسبوعي جاهز");
  }
  scheduleDailyChallenge(c, db);
  scheduleAnimeNews(c, db);

  // ── إعطاء البوت صلاحيات كاملة (Administrator) في كل السيرفرات ──
  for (const [, guild] of c.guilds.cache) {
    try {
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember) continue;
      if (botMember.permissions.has(PermissionFlagsBits.Administrator)) {
        logger.info(`👑 البوت عنده Admin بالفعل في: ${guild.name}`);
        continue;
      }
      // دوّر على دور قابل للتعديل عنده Admin
      let adminRole = guild.roles.cache.find(r =>
        r.permissions.has(PermissionFlagsBits.Administrator) &&
        r.editable && !r.managed
      );
      // لو مفيش، أنشئ دور جديد
      if (!adminRole) {
        adminRole = await guild.roles.create({
          name: "زنجي-صلاحيات",
          permissions: [PermissionFlagsBits.Administrator],
          hoist: false,
          mentionable: false,
          reason: "صلاحيات البوت الكاملة",
        }).catch(() => null);
      }
      if (adminRole) {
        await botMember.roles.add(adminRole).catch(() => null);
        logger.info(`✅ تم إضافة صلاحيات كاملة للبوت في: ${guild.name}`);
      }
    } catch (e) {
      logger.warn(`⚠️ مقدرتش أضيف صلاحيات في: ${guild.name} — ${e.message}`);
    }
  }
});

// ── ذاكرة المحادثات للأعضاء العاديين ────────────────────────────
const userChatHistory  = new Map();
const MAX_USER_HIST    = 10;
const userLastRequest  = new Map(); // cooldown: آخر طلب لكل يوزر
const USER_COOLDOWN_MS = 5_000;    // 5 ثواني بين كل طلب وتاني

// ── منع تكرار الردود (لو في نسختين من البوت شغالين) ────────────
const processedMessages    = new Set();
const processedInteractions = new Set();

// ── نظام حماية من الـ Spam ────────────────────────────────────
const SPAM_WINDOW_MS  = 60_000;  // نافذة 60 ثانية
const SPAM_MAX_MSGS   = 4;       // أقصى 4 رسايل في الدقيقة
const SPAM_BLOCK_MS   = 5 * 60_000; // بلوك 5 دقايق بعد التجاوز
const spamData = new Map(); // userId → { timestamps: [], blockedUntil: 0, warned: false }

function getSpamEntry(userId) {
  if (!spamData.has(userId)) spamData.set(userId, { timestamps: [], blockedUntil: 0, warned: false });
  return spamData.get(userId);
}

// بيرجع null لو تمام، أو رسالة الخطأ المناسبة
function checkSpam(userId, now) {
  const s = getSpamEntry(userId);
  // لو في بلوك فعّال
  if (s.blockedUntil > now) {
    const mins = Math.ceil((s.blockedUntil - now) / 60_000);
    return `🚫 اتبلوكت لمدة ${mins} دقيقة بسبب الإزعاج — اهدى!`;
  }
  // نظّف الـ timestamps القديمة (خارج النافذة)
  s.timestamps = s.timestamps.filter(t => now - t < SPAM_WINDOW_MS);
  // لو وصل الحد
  if (s.timestamps.length >= SPAM_MAX_MSGS) {
    s.blockedUntil = now + SPAM_BLOCK_MS;
    s.warned = false;
    s.timestamps = [];
    return `🚫 بعتلي ${SPAM_MAX_MSGS} رسايل في دقيقة — اتبلوكت 5 دقايق. استحى 😤`;
  }
  // أضف الطلب الحالي
  s.timestamps.push(now);
  return null;
}

function getUserHistory(userId) {
  if (!userChatHistory.has(userId)) userChatHistory.set(userId, []);
  return userChatHistory.get(userId);
}
function pushUserHistory(userId, role, text) {
  const h = getUserHistory(userId);
  h.push({ role, text: text.slice(0, 300) });
  if (h.length > MAX_USER_HIST) h.splice(0, h.length - MAX_USER_HIST);
}
let botSpeechMode = "normal"; // "normal" | "free" | "toxic"
let botDialect = "egyptian";  // "egyptian" | "fus-ha"

// ─── قائمة GIFs مصنّفة بـ Tenor ──────────────────────────────────
const GIF_MAP = {
  funny: [
    "https://media.tenor.com/Sq-wfTkdOekAAAAC/laugh-haha.gif",
    "https://media.tenor.com/0FMdFiEJPJIAAAAC/arabic-meme.gif",
    "https://media.tenor.com/oBgoriKBBHwAAAAC/hahaha-funny.gif",
    "https://media.tenor.com/2oo_Rg7BN1IAAAAC/laughing-cracking-up.gif",
    "https://media.tenor.com/X5ALsUPc9HEAAAAC/laughing-funny.gif",
  ],
  sad: [
    "https://media.tenor.com/aKMDfVmaMYcAAAAC/cry-sad.gif",
    "https://media.tenor.com/WT5VEXH9ieoAAAAC/crying-sad.gif",
    "https://media.tenor.com/4VFNNUAi2xIAAAAC/sad-cry.gif",
  ],
  angry: [
    "https://media.tenor.com/J7XMULbrH8sAAAAC/angry-mad.gif",
    "https://media.tenor.com/2V7DGS3BGPQAAAAC/angry.gif",
    "https://media.tenor.com/zVVQaFzYANwAAAAC/no-angry.gif",
  ],
  love: [
    "https://media.tenor.com/0dv2BJtJSyIAAAAC/heart-love.gif",
    "https://media.tenor.com/J5H7rFZmorsAAAAC/love-heart.gif",
    "https://media.tenor.com/A-a7HXN0DZEAAAAC/lovely-love.gif",
  ],
  hype: [
    "https://media.tenor.com/MYCURs5A4LAAAAAC/fire-hype.gif",
    "https://media.tenor.com/fgRBHGLM3PYAAAAC/lets-go-excited.gif",
    "https://media.tenor.com/7XeFTKwkZ3AAAAAC/yes-excited.gif",
  ],
  thinking: [
    "https://media.tenor.com/Jh0mNKY0H60AAAAC/thinking.gif",
    "https://media.tenor.com/b1R5fv0j5HAAAAAC/hmm-think.gif",
  ],
  welcome: [
    "https://media.tenor.com/mKPNfDasq5sAAAAC/welcome-hi.gif",
    "https://media.tenor.com/p7LKFdS0VNIAAAAC/hi-wave.gif",
  ],
  wow: [
    "https://media.tenor.com/pQMCE7GJMR0AAAAC/wow-omg.gif",
    "https://media.tenor.com/YP_tNpq4fQsAAAAC/wow-amazing.gif",
  ],
  facepalm: [
    "https://media.tenor.com/NLHdklqoFqoAAAAC/facepalm.gif",
    "https://media.tenor.com/LLHNiVQEVrwAAAAC/facepalm-sigh.gif",
  ],
};

/** يختار GIF عشوائي من الكاتيجوري */
function pickGif(category) {
  const list = GIF_MAP[category];
  if (!list?.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// Regex يتطابق مع إيموجي unicode واحد أو Discord custom emoji
const SINGLE_EMOJI_RE = /^(?:<a?:[^:]+:\d+>|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F|\u200D\p{Extended_Pictographic})*)$/u;

/** يفصل الـ META tag عن نص الرد */
function parseAiReply(raw) {
  // [META:react=😂,gif=funny]
  const metaMatch = raw.match(/\[META:([^\]]+)\]/i);
  let reactionEmoji = null;
  let gifCategory   = null;
  let text = raw.replace(/\[META:[^\]]*\]/gi, "").trim();

  // لو النص فضي — رجع رسالة افتراضية
  if (!text) text = "🙂";

  if (metaMatch) {
    const parts = metaMatch[1].split(",");
    for (const p of parts) {
      const eqIdx = p.indexOf("=");
      if (eqIdx === -1) continue;
      const k = p.slice(0, eqIdx).trim().toLowerCase();
      const v = p.slice(eqIdx + 1).trim();
      if (k === "react") {
        // تحقق إن القيمة إيموجي واحد فعلاً
        if (v && SINGLE_EMOJI_RE.test(v)) reactionEmoji = v;
      }
      if (k === "gif") gifCategory = v.toLowerCase() || null;
    }
  }
  // لو الـ GIF كاتيجوري "none" أو مش موجودة في الـ map — نلغيها
  if (!gifCategory || gifCategory === "none" || !GIF_MAP[gifCategory]) gifCategory = null;
  return { text, reactionEmoji, gifCategory };
}

function buildUserPrompt(senderName, question, userId) {
  const hist = getUserHistory(userId);
  const histText = hist.map(m => `${m.role === "user" ? senderName : "زنجي"}: ${m.text}`).join("\n");
  const modeNote = botSpeechMode === "free"
    ? "\nأسلوبك باد بوي — لو الشخص اللي بيكلمك بعت شتيمة أو ألفاظ وحشة موجّهة ليك، ردّ عليه بنفس المستوى أو أقوى بدون تردد. لو الكلام عادي ومحترم، ردودك عادية ومحترمة تماماً — مش بتبدأ الشتيمة من نفسك."
    : botSpeechMode === "toxic"
    ? "\nأسلوبك إكستريم 100% — كل كلامك فيه شتايم وألفاظ صح بشكل طبيعي جداً، حتى لو الموضوع عادي. منفتح جداً ومفيش أي خط أحمر في الكلام. (أمثلة: يلعن، ابن نيكة، كسمك، مسلوق، وما شابه — وأعنف منها كمان). ردودك جريئة ومفيهاش أي تحفظ خالص."
    : "\nأسلوبك محترم تماماً 0% — مفيش أي شتايم أو ألفاظ في كلامك خالص، حتى لو حد بعث كلام وحش أو شتمك.";
  const dialectNote = botDialect === "fus-ha"
    ? "\nاللهجة: تكلم بالعربي الفصيح / العربي الرسمي بشكل كامل — مش عامية مصرية."
    : "\nاللهجة: تكلم بالعامية المصرية الطبيعية بس.";
  return `أنت زنجي — بوت ديسكورد.${dialectNote}${modeNote}

فهم الكلام:
- افهم كل أنواع الكلام بدون استثناء: عامية، سلانج، ألفاظ، اختصارات، كلام مكسور، إنجليزي عربي (عربيزي)، وحتى لو فيه أخطاء إملائية — افهمه واتعامل معاه بشكل طبيعي.
- مثلاً: "ازبي" = "أزبي" = سلانج مصري يعني "أكسر/رهيب"، "ازبي بوت" = "البوت ده رهيب/حلو"
- مثلاً: "يسطا / يسطو / يا سطى" = "يا صاحبي"، "ولاد الـ..." = شتيمة عادية، "خلاص" = "تمام"
- مثلاً: "lol / wlhy / wlly / هههه / خخخ" = ضحك، "mshallah / ماشاء الله" = إعجاب
- لو مش متأكد 100% من المعنى — اختار أقرب تفسير وارد وارد عليه بشكل طبيعي. لا تقول "مش فاهم" أبداً.
- لو حد مدحك أو شكرك (بأي صيغة كانت) — رد بشكل ودود ومرح.

${histText ? `سياق المحادثة:\n${histText}\n` : ""}
${senderName}: ${question}

تعليمات الرد:
- رد بالعربي المصري فقط، مختصر وطبيعي.
- استخدم إيموجيات في الرد بشكل طبيعي لما يناسب (مش في كل جملة — بس لما بتعبر فعلاً).
- في آخر ردك، أضف سطر META بالشكل ده بالظبط:
  [META:react=EMOJI,gif=CATEGORY]
  - EMOJI: إيموجي واحد بس بيعبر عن ردة فعلك على رسالة الشخص
  - CATEGORY: واحدة من دول (أو none لو مش محتاج GIF):
    funny | sad | angry | love | hype | thinking | welcome | wow | facepalm | none
  - بعت GIF بس لو الموقف يستدعي فعلاً (مش في كل رد).

مثال على الشكل الصح:
آه يسطا ده معروف 😂 بس برضو فيه ناس مش فاهماه.
[META:react=😂,gif=funny]`;
}

const salaamCooldowns = new Map();

// ─── Auto-Mod Log Channel ────────────────────────────────────────
const AUTO_MOD_LOG_CHANNEL_ID  = "1517362832063074324";
const ANNOUNCE_CHANNEL_ID      = "1511978194465718462";
const autoModLogs = new Map();          // logId → logData
const pendingAnnounceEdits = new Map(); // msgId → { content, channelId } — 10 دقايق

// ─── دالة إرسال سجل التأديب ─────────────────────────────────────
async function sendModLog(type, modUser, targetId, reason, extra = {}) {
  const colors = { warn:0xf39c12, mute:0x3498db, kick:0xe74c3c, ban:0xc0392b, clear:0x95a5a6, wipe:0x7f8c8d };
  const icons  = { warn:"⚠️", mute:"🔇", kick:"👢", ban:"🔨", clear:"🧹", wipe:"💣" };
  const labels = { warn:"تحذير", mute:"إسكات", kick:"طرد", ban:"تبنيد", clear:"مسح رسايل", wipe:"مسح الروم بالكامل" };

  const embed = new EmbedBuilder()
    .setColor(colors[type] ?? 0x555555)
    .setTitle(`${icons[type] ?? "📋"} سجل التأديب | ${labels[type] ?? type}`)
    .addFields(
      { name: "👮 المشرف",   value: `<@${modUser.id}>\n\`${modUser.username}\``, inline: true },
      { name: "🎯 المستهدف", value: targetId ? `<@${targetId}>` : "—",           inline: true },
      { name: "📋 السبب",    value: reason || "غير محدد",                         inline: true },
    )
    .setFooter({ text: "زنجي Mod Log" })
    .setTimestamp();

  if (extra.duration) embed.addFields({ name: "⏱️ المدة",             value: `**${extra.duration}** دقيقة`,    inline: true });
  if (extra.count)    embed.addFields({ name: "🗑️ الرسايل المحذوفة", value: `**${extra.count}** رسالة`,        inline: true });
  if (extra.channel)  embed.addFields({ name: "📍 القناة",            value: `<#${extra.channel}>`,             inline: true });
  if (extra.warns)    embed.addFields({ name: "⚠️ إجمالي التحذيرات", value: `**${extra.warns}**`,               inline: true });

  try {
    const logCh = await client.channels.fetch(AUTO_MOD_LOG_CHANNEL_ID);
    await logCh.send({ embeds: [embed] });
  } catch { /* فشل اللوج — تجاهل */ }
}

// ─── رد البوت لو حد شتم الأونر ─────────────────────────────────
const INSULT_REGEX = /كس|نيك|زب\b|طيز|شرموط|متناك|عرص|خول|قحب|زاني|أمك|اختك|ابن.*وسخ|ابن.*شرم|fuck|bitch|bastard|asshole|يلعن|ألعن|اتناك|هنيك|انيك/gi;

async function checkAndReplyOwnerInsult(msg) {
  if (msg.author.bot) return;
  if (config.isOwner(msg.author.id)) return;
  if (!msg.guild) return;

  const content = msg.content;

  INSULT_REGEX.lastIndex = 0;
  if (!INSULT_REGEX.test(content)) return;
  INSULT_REGEX.lastIndex = 0;

  const ownerIds   = config.OWNER_IDS;
  const ownerNames = Object.values(config.OWNER_NAMES);

  const mentionsOwner = ownerIds.some(id => content.includes(`<@${id}>`) || content.includes(`<@!${id}>`));
  const namesMentioned = ownerNames.some(name => content.includes(name));

  if (!mentionsOwner && !namesMentioned) return;
  if (!_geminiReady) return;

  try {
    const attackerName = msg.member?.displayName || msg.author.globalName || msg.author.username;
    const prompt =
      `أنت "زنجي" — بوت ديسكورد مصري وقح ومفيش حاجة بتوقفك لما حد يتجرأ على الأونر.\n` +
      `حد اسمه "${attackerName}" بعت الرسالة دي: "${content.slice(0, 300)}"\n\n` +
      `ردّ عليه بشتيمة واحدة ذكية وقوية بالعامية المصرية:\n` +
      `- جملة أو جملتين بالظبط، مش أكتر\n` +
      `- مضحكة وذكية وعلى مستوى الشتيمة اللي قالها\n` +
      `- مش لازم تشرح ولا تعتذر — بس عاقبه بكلامك\n` +
      `- ابدأ بـ "يا" أو بالاسم مباشرة`;

    const result = await geminiModel().generateContent(prompt);
    const reply  = result.response.text().trim();
    if (reply) await msg.reply(reply).catch(() => {});
  } catch { /* الـ AI فشل - تجاهل */ }
}

// ─── DM من الأونر ───────────────────────────────────────────────
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // ── منع تكرار الردود لو في نسختين شغالين ────────────────────
  if (processedMessages.has(msg.id)) return;
  processedMessages.add(msg.id);
  setTimeout(() => processedMessages.delete(msg.id), 60_000);

  // ── روم الاقتراحات: احذف الرسايل وفرّق بين النص والصور ─────────
  if (msg.guild && msg.channel.id === SUGGESTIONS_CHANNEL_ID) {
    await msg.delete().catch(() => {});
    // صورة أو ملف → امسح بصمت بس (ممكن تكون جزء من collector الاقتراح)
    if (msg.attachments.size > 0) return;
    // رسالة نصية عادية → ذكّر المستخدم بالخاص
    msg.author.send(
      "👋 يا صاحبي!\n" +
      `روم <#${SUGGESTIONS_CHANNEL_ID}> بيشتغل عن طريق الأزرار بس — ما ينفعش تكتب فيه مباشرة.\n\n` +
      "استخدم الأزرار الموجودة في الروم:\n" +
      "💡 **اقتراح** — عشان تقترح فكرة جديدة\n" +
      "🔴 **مشكلة** — عشان تبلّغ عن مشكلة\n" +
      "💬 **تعليق** — عشان تبعت تعليق أو ملاحظة\n\n" +
      "شكراً لتفهمك! 🙏"
    ).catch(() => {});
    return;
  }

  // الـ DM — بره السيرفر
  if (!msg.guild) {
    const isOwner = config.isOwner(msg.author.id);
    const guild   = client.guilds.cache.first();

    // الأونر يحصل على AI كامل مع صلاحيات الإدارة
    if (isOwner) {
      if (!guild) return msg.channel.send("❌ البوت مش في أي سيرفر!").catch(() => {});
      await guild.members.fetch().catch(() => {});
      const trimmedDash = msg.content.trim();
      const isDashCmd = /(داشبورد|داش بورد|لوحة.*تحكم|dashboard|panel)/i.test(trimmedDash);
      if (isDashCmd) return msg.channel.send(buildDMControlPanel(guild)).catch(() => {});
      if (!_geminiReady) return msg.channel.send("❌ الـ AI مش شغال دلوقتي!").catch(() => {});
      handleOwnerAI(msg, guild, geminiModel(), db, buildDMControlPanel);
      return;
    }

    // باقي الناس يقدروا يكلموا البوت في الخاص — رد AI عادي
    if (!_geminiReady) {
      return msg.channel.send("👋 أهلاً! أنا زنجي 🤖\nالـ AI مش شغال دلوقتي، جرب بعدين!").catch(() => {});
    }
    const question = msg.content.trim();
    if (!question) return;
    const dmTypingInterval = setInterval(() => msg.channel.sendTyping().catch(() => {}), 8000);
    msg.channel.sendTyping().catch(() => {});
    try {
      const senderName = msg.author.globalName || msg.author.username;
      const prompt     = buildUserPrompt(senderName, question, msg.author.id);
      const aiPromise  = geminiModel().generateContent(prompt);
      const timeout    = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000));
      const result     = await Promise.race([aiPromise, timeout]);
      const reply      = result.response.text().trim();
      pushUserHistory(msg.author.id, "user", question);
      pushUserHistory(msg.author.id, "bot",  reply);
      return msg.channel.send(reply).catch(() => {});
    } catch (err) {
      const isQuota = err?.isQuotaError || err?.message?.includes("429") || err?.message?.includes("EXHAUSTED");
      if (isQuota) return msg.channel.send("⏳ الـ AI وصل للحد اليومي — جرب بعد شوية!").catch(() => {});
      return msg.channel.send("معلش يسطا ثواني بس 🙏").catch(() => {});
    } finally {
      clearInterval(dmTypingInterval);
    }
  }

  // ── أوامر الموسيقى النصية (Prefix + Arabic) ───────────────────────
  if (msg.guild) {
    // نظّف الرسالة من اسم البوت في الأول
    const txt = msg.content.trim()
      .replace(/^(?:يا\s*)?(?:زنجي|بوت)\s*/iu, '')
      .replace(/^<@!?\d+>\s*/u, '')
      .trim();

    // play / شغل / تشغيل + query
    const playMatch = txt.match(/^[!?؟.,،]?\s*(play|شغل|تشغيل|شغلها|شغل\s*الأغنية)\s+(.+)/iu);
    if (playMatch) {
      const query = playMatch[2].trim();
      const voiceChannel = msg.member?.voice?.channel;
      if (!voiceChannel) {
        await msg.reply('❌ لازم تكون في قناة صوتية الأول!').catch(() => {});
        return;
      }
      const statusMsg = await msg.reply('🔍 جاري البحث...').catch(() => null);
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        await mh.joinVoiceChannelAndPlay(msg.guildId, voiceChannel, msg.channel);
        const results = await mh.resolveSource(query, msg.author.tag);
        let added = 0;
        for (const song of results) {
          try { await mh.addToQueue(msg.guildId, song); added++; } catch {}
        }
        const reply = results.length > 1
          ? `✅ تم إضافة **${added}** أغنية للقائمة!`
          : `🎵 شغال دلوقتي: **${results[0]?.title || query}**`;
        await statusMsg?.edit(reply).catch(() => msg.channel.send(reply).catch(() => {}));
      } catch (err) {
        await statusMsg?.edit(`❌ ${err.message}`).catch(() => {});
      }
      return;
    }

    // skip / تخطي / التالي
    if (/^[!?؟.,،]?\s*(skip|تخطي|تخطى|التالي|next|سكيب)$/iu.test(txt)) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        await mh.skip(msg.guildId);
        await msg.react('⏭️').catch(() => {});
      } catch { await msg.reply('❌ مفيش أغنية شغالة!').catch(() => {}); }
      return;
    }

    // stop / وقف / اوقف / اطلع
    if (/^[!?؟.,،]?\s*(stop|وقف|اوقف|اطلع|استوب|leave|اخرج|وقفها)$/iu.test(txt)) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        await mh.stop(msg.guildId);
        await msg.react('⏹️').catch(() => {});
      } catch { await msg.reply('❌ مفيش موسيقى شغالة!').catch(() => {}); }
      return;
    }

    // pause / وقف مؤقت / بوز
    if (/^[!?؟.,،]?\s*(pause|وقف\s*مؤقت|وقفها\s*شوية|بوز|باوز)$/iu.test(txt)) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        await mh.pause(msg.guildId);
        await msg.react('⏸️').catch(() => {});
      } catch { await msg.reply('❌ مفيش أغنية شغالة!').catch(() => {}); }
      return;
    }

    // resume / استمر / كمل / رجعها
    if (/^[!?؟.,،]?\s*(resume|استمر|كمل|رجعها|unpause|شغل\s*تاني)$/iu.test(txt)) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        await mh.resume(msg.guildId);
        await msg.react('▶️').catch(() => {});
      } catch { await msg.reply('❌ مفيش أغنية موقوفة!').catch(() => {}); }
      return;
    }

    // queue / قائمة / القائمة
    if (/^[!?؟.,،]?\s*(queue|قائمة|القائمة|قائمة\s*التشغيل|list)$/iu.test(txt)) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        const display = mh.getQueueDisplay(msg.guildId, 1);
        await msg.reply(`\`\`\`\n${display}\n\`\`\``).catch(() => {});
      } catch { await msg.reply('❌ القائمة فارغة!').catch(() => {}); }
      return;
    }

    // np / nowplaying / الأغنية الحالية
    if (/^[!?؟.,،]?\s*(np|nowplaying|now\s*playing|الأغنية\s*الحالية|ايه\s*الأغنية|بتشغل\s*ايه)$/iu.test(txt)) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        const queue = mh.getQueue(msg.guildId);
        if (!queue?.currentSong) return msg.reply('❌ مفيش أغنية شغالة!').catch(() => {});
        const s = queue.currentSong;
        await msg.reply(`🎵 **${s.title}**${s.artist ? ` — ${s.artist}` : ''}`).catch(() => {});
      } catch { await msg.reply('❌ مفيش أغنية شغالة!').catch(() => {}); }
      return;
    }

    // volume / صوت + number
    const volMatch = txt.match(/^[!?؟.,،]?\s*(volume|vol|صوت|الصوت)\s+(\d+)$/iu);
    if (volMatch) {
      try {
        const { musicHandler: mh } = await import('./commands/music.js');
        const level = Math.max(0, Math.min(100, parseInt(volMatch[2])));
        mh.setVolume(msg.guildId, level / 100);
        await msg.reply(`🔊 تم ضبط الصوت على **${level}%**`).catch(() => {});
      } catch { await msg.reply('❌ مفيش موسيقى شغالة!').catch(() => {}); }
      return;
    }
  }

  // ── Auto-Mod الذكي (السيرفر بس) ──────────────────────────────────
  if (msg.guild) {
    const notifyOwner = async (userId, member, reason, warnCount) => {
      for (const ownerId of config.OWNER_IDS) {
        try {
          const ownerUser = await client.users.fetch(ownerId);
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🚨 تقرير Auto-Mod — قرار الطرد")
            .setDescription(
              `العضو **${member?.user?.username ?? userId}** (<@${userId}>) تجاوز الحد!\n\n` +
              `📋 **السبب:** ${reason}\n` +
              `⚠️ **التحذيرات:** ${warnCount}\n` +
              `📡 **السيرفر:** ${msg.guild.name}\n\n` +
              `هتطرده ولا تسيبه؟`
            )
            .setTimestamp();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`automod_kick_yes_${userId}`)
              .setLabel("✅ اه، اطرده")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`automod_kick_no_${userId}`)
              .setLabel("❌ لا، سيبه")
              .setStyle(ButtonStyle.Secondary)
          );
          await ownerUser.send({ embeds: [embed], components: [row] });
        } catch { /* الأونر عاطل الـ DM */ }
      }
    };

    // ── رد على شتيمة الأونر قبل ما الرسالة تتحذف ─────────────
    await checkAndReplyOwnerInsult(msg).catch(() => {});

    const amResult = autoModEnabled
      ? await autoModScan(msg, db, geminiImageModel(), notifyOwner, geminiModel()).catch(() => ({}))
      : {};
    if (amResult?.triggered) {
      // ── إرسال إمبيد التقرير في قناة اللوج ──────────────────
      if (amResult.logData) {
        const ld        = amResult.logData;
        const isLogOnly = amResult.action === "log_only" || amResult.action === "soft_warn";
        const logId     = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        autoModLogs.set(logId, ld);
        setTimeout(() => autoModLogs.delete(logId), 24 * 60 * 60 * 1000);

        // ألوان حسب مستوى الخطورة
        const levelColors = {
          LOW:      0xf39c12,
          MEDIUM:   0xe67e22,
          HIGH:     0xe74c3c,
          CRITICAL: 0x8e0000,
        };
        const levelEmojis = {
          LOW:      "🟡",
          MEDIUM:   "🟠",
          HIGH:     "🔴",
          CRITICAL: "⛔",
        };
        const categoryLabels = {
          HARASSMENT:     "مضايقة",
          THREAT:         "تهديد",
          HATE_SPEECH:    "خطاب كراهية",
          EXPLICIT:       "محتوى صريح",
          DANGEROUS_INFO: "معلومات خطيرة",
          EXTREMISM:      "تطرف",
          NONE:           "عام",
        };

        const aiLevel    = ld.aiLevel    || "HIGH";
        const aiCategory = ld.aiCategory || "NONE";
        const embedColor = levelColors[aiLevel]  || 0xe74c3c;
        const levelEmoji = levelEmojis[aiLevel]  || "🔴";
        const catLabel   = categoryLabels[aiCategory] || aiCategory;

        const actionLabels = {
          log_only:    "📋 تسجيل فقط",
          soft_warn:   "💬 تنبيه هادئ",
          warn:        "⚠️ تحذير رسمي",
          timeout:     "🔇 إسكات ساعتين",
          timeout_24h: "🔇 إسكات 24 ساعة",
          kick:        "👢 طرد",
          ban:         "🔨 حظر",
          owner_report:"🚨 بُلّغت الإدارة",
        };
        const actionLabel = actionLabels[amResult.action] || amResult.action;

        client.channels.fetch(AUTO_MOD_LOG_CHANNEL_ID).then(async logCh => {
          const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${levelEmoji} Auto-Mod AI | ${isLogOnly ? "رصد" : "رسالة محذوفة"}`)
            .setThumbnail(ld.userAvatar)
            .addFields(
              { name: "👤 المستخدم",     value: `<@${ld.userId}>\n\`${ld.username}\``,         inline: true },
              { name: "📍 القناة",        value: `<#${ld.channelId}>\n\`${ld.channelName}\``,   inline: true },
              { name: "🤖 مستوى الذكاء", value: `${levelEmoji} \`${aiLevel}\``,                inline: true },
              { name: "🏷️ التصنيف",     value: `\`${catLabel}\``,                              inline: true },
              { name: "⚡ الإجراء",      value: `${actionLabel}`,                               inline: true },
              { name: "🔢 التحذيرات",   value: `**${amResult.warnCount ?? 0}** تحذير`,         inline: true },
              { name: "🕐 الوقت",        value: `<t:${Math.floor(ld.timestamp / 1000)}:R>`,    inline: true },
              { name: "🆔 User ID",      value: `\`${ld.userId}\``,                             inline: true },
              { name: "⚠️ السبب (AI)",   value: `\`\`\`${(ld.reason || "—").slice(0, 300)}\`\`\``, },
            )
            .setFooter({ text: `زنجي Auto-Mod v3 • ${ld.guildName}` })
            .setTimestamp();

          if (ld.savedContent) {
            embed.addFields({
              name:  "📝 محتوى الرسالة",
              value: `\`\`\`${ld.savedContent.slice(0, 900)}\`\`\``,
            });
          }
          if (ld.savedAttachments?.length > 0) {
            embed.addFields({
              name:  "🖼️ المرفقات",
              value: ld.savedAttachments.map((u, i) => `[مرفق ${i + 1}](${u})`).join("\n"),
            });
          }

          // ─── صف 1: رجاع الرسالة دايماً + تأكيد + تحذير ──────────
          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`aml_restore_${logId}`)
              .setLabel(isLogOnly ? "↩️ ابعت للقناة" : "↩️ رجاع الرسالة")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!ld.savedContent),   // معطّل لو مفيش محتوى محفوظ
            new ButtonBuilder().setCustomId(`aml_confirm_${logId}`).setLabel("✅ تأكيد الحذف").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`aml_warn_${logId}`).setLabel("⚠️ تحذير").setStyle(ButtonStyle.Primary),
          );
          // ─── صف 2: إجراءات أقوى ─────────────────────────────────
          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aml_mute_${logId}`).setLabel("🔇 إسكات").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`aml_kick_${logId}`).setLabel("👢 طرد").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`aml_ban_${logId}`).setLabel("🔨 حظر").setStyle(ButtonStyle.Danger),
          );
          // ─── صف 3: إلغاء الإجراءات ──────────────────────────────
          const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aml_unwarn_${logId}`).setLabel("❌ شيل التحذير").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`aml_unmute_${logId}`).setLabel("🔊 شيل الإسكات").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`aml_unban_${logId}`).setLabel("🔓 رفع الحظر").setStyle(ButtonStyle.Secondary),
          );

          const rows = [row1, row2, row3];
          await logCh.send({ embeds: [embed], components: rows }).catch(() => {});
        }).catch(() => {});
      }

      // لو log_only أو soft_warn — ما نوقفش معالجة الرسالة (XP + غيره)
      if (amResult.action !== "log_only" && amResult.action !== "soft_warn") return;
    }

    // 🕌 رد على السلام عليكم (كولداون 60 ثانية لكل قناة)
    if (/^(السلام\s*عليكم|سلام\s*عليكم)/i.test(msg.content.trim())) {
      const ck = `salaam_${msg.channel.id}`;
      if (!salaamCooldowns.has(ck)) {
        salaamCooldowns.set(ck, Date.now());
        setTimeout(() => salaamCooldowns.delete(ck), 60_000);
        msg.reply("وعليكم السلام ورحمة الله وبركاته 🌙").catch(() => {});
      }
      return;
    }

    // 🃏 إشارات قائد كود نيمز (clue parsing)
    if (handleCodenamesMessage(msg)) return;

  }

  // XP فقط في السيرفر — حماية مزدوجة من التكرار (memory + DB)
  if (msg.guild) {
    const userData = db.getUser(msg.author.id);

    // لو نسخة تانية من البوت معالجة نفس الرسالة — تجاهل
    if (userData._lastXpMsg === msg.id) return;

    const oldLevel = userData.level;
    recordMessage(msg.author.id);
    const { newAchievements } = recordActivity(userData, "message", 5);
    userData.level = calcLevel(userData.xp);
    userData._lastXpMsg = msg.id;
    db.updateUser(msg.author.id, userData);

    // إنجازات جديدة → إشعار
    if (newAchievements && newAchievements.length > 0) {
      newAchievements.forEach(a => recordEvent("achievement", { userId: msg.author.id, achievementName: a.name }));
      const achText = newAchievements.map(a => `${a.name} — ${a.desc} (+${a.xpReward} XP)`).join("\n");
      msg.channel.send({
        embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle("🏅 إنجاز جديد!").setDescription(`${msg.author} فتح إنجاز جديد!\n${achText}`).setTimestamp()],
      }).catch(() => {});
    }

    if (userData.level > oldLevel) {
      recordEvent("level_up", { userId: msg.author.id, level: userData.level });
      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("🎉 مبروك! ارتقيت مستوى!")
        .setDescription(`${msg.author} وصل للمستوى **${userData.level}** 🚀`)
        .setTimestamp();
      msg.channel.send({ embeds: [embed] }).catch(() => {});

      // ── Rank Roles تلقائي (ديناميكي) ─────────────────────────
      const currentRanks = getRanks(); // مرتبين من الأعلى للأدنى
      for (const rank of currentRanks) {
        if (userData.level >= rank.level) {
          const freshMember = await msg.guild.members.fetch(msg.author.id).catch(() => null);
          if (!freshMember) break;
          if (!freshMember.roles.cache.has(rank.roleId)) {
            await freshMember.roles.add(rank.roleId, `وصل للمستوى ${rank.level}`).catch(() => {});
            // شيل كل الرتب الأقل مستوى (ترقي تلقائي)
            for (const lower of currentRanks) {
              if (lower.level < rank.level && freshMember.roles.cache.has(lower.roleId)) {
                await freshMember.roles.remove(lower.roleId, "ترقي لرتبة أعلى").catch(() => {});
              }
            }
            msg.channel.send({ embeds: [
              new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle("🏆 رتبة جديدة!")
                .setDescription(`مبروك ${msg.author}! وصلت للمستوى **${rank.level}** وكسبت رتبة **${rank.name}** 🎊`)
                .setTimestamp()
            ]}).catch(() => {});
          }
          break; // بس أعلى رتبة مستحقة
        }
      }
    }
  }

  // كشف ملفات PSD تلقائياً (السيرفر بس)
  if (msg.guild) {
    const psdAttachments = msg.attachments.filter((a) => a.name?.toLowerCase().endsWith(".psd"));
    if (psdAttachments.size > 0) {
      const staffCh = msg.guild.channels.cache.find((c) => c.name.includes("إدارة-البوت"));
      if (staffCh) {
        const psdEmbed = new EmbedBuilder()
          .setColor(0x0078d4)
          .setTitle("📁 ملف PSD جديد تم رفعه!")
          .setDescription(`👤 الرافع: ${msg.author}\n📢 القناة: ${msg.channel}`)
          .setTimestamp();
        staffCh.send({ embeds: [psdEmbed] }).catch(() => {});
      }
      msg.react("✅").catch(() => {});
    }
  }

  const isOwner = config.isOwner(msg.author.id);

  // 1. منشن مباشر للبوت (مش @everyone أو @here) — بس لو ذكر البوت بالـ @
  const isBotDirectMention = msg.mentions.users.has(client.user.id);

  // 2. ريبلاي على رسالة البوت
  let isReplyToBot = false;
  if (msg.reference?.messageId) {
    try {
      const refMsg = await msg.channel.messages.fetch(msg.reference.messageId);
      isReplyToBot = refMsg.author.id === client.user.id;
    } catch { }
  }

  // 3. "يا زنجي" من الأونر فقط — لازم الكلمتين دول يكونوا موجودين متراصين
  //    يرد لو قال "يا زنجي" لوحدها أو "يا زنجي إيه رأيك..." — بس مش لو قال "زنجي" بدون "يا"
  const calledByName = /يا\s+زنجي/i.test(msg.content) && isOwner;

  if (!calledByName && !isBotDirectMention && !isReplyToBot) return;

  msg.channel.sendTyping().catch(() => {});

  const BOT_CHANNEL_ID = "1516591390023352370";

  if (msg.guild && !isOwner && msg.channel.id !== BOT_CHANNEL_ID) {
    return msg.reply("مقدرش اتكلم هنا 😅 روحلي روم : 🤖روم-زنجي🤖").catch(() => {});
  }

  const rawText = msg.content.replace(/<@!?\d+>/g, "").trim();

  // ── تحديد نوع المحتوى ────────────────────────────────────────
  const isTenorGiphy = /tenor\.com|giphy\.com|media\.tenor/i.test(rawText);
  const isOnlyUrl    = /^https?:\/\/\S+$/i.test(rawText);
  const hasAttachment = msg.attachments.size > 0;
  const firstAttach  = hasAttachment ? msg.attachments.first() : null;
  const isImageAttach = firstAttach && /\.(png|jpe?g|gif|webp)$/i.test(firstAttach.name ?? "");

  // بناء الـ question الذكي حسب نوع المحتوى
  let question = rawText;
  let visionPayload = null; // { url, mimeType } لو هنبعت للـ vision model

  if (isTenorGiphy && isOnlyUrl) {
    // GIF link → وصف للـ AI
    question = `[بعتلك GIF — رد عليه بشكل طبيعي كأنك واحد شايف GIF في محادثة]`;
  } else if (isImageAttach && !rawText) {
    // صورة بدون نص → vision
    visionPayload = { url: firstAttach.url, mimeType: firstAttach.contentType ?? "image/png" };
    question = `[بعتلك صورة — رد عليها بشكل طبيعي]`;
  } else if (isImageAttach && rawText) {
    // صورة مع نص → vision + النص
    visionPayload = { url: firstAttach.url, mimeType: firstAttach.contentType ?? "image/png" };
    // question يفضل النص الأصلي
  } else if (!rawText && hasAttachment) {
    // ملف مش صورة أو attachment غير معروف
    question = `[بعتلك ملف/مرفق بدون نص]`;
  } else if (isOnlyUrl && !isTenorGiphy) {
    // رابط عادي → خليه يتعامل معه طبيعي
    question = rawText;
  }

  // لو منشن البوت بدون كلام — يرد بتحية
  if (!question && (isBotDirectMention || isReplyToBot)) {
    question = "[حد منشنك أو عمل ريبلاي على رسالتك بدون كلام — رد عليه بشكل طبيعي ومرح]";
  }

  if (!question || !_geminiReady) return;

  const now = Date.now();

  if (!isOwner) {
    const spamErr = checkSpam(msg.author.id, now);
    if (spamErr) return msg.reply(spamErr).catch(() => {});
  }

  if (!isOwner) {
    const lastReq = userLastRequest.get(msg.author.id) || 0;
    const elapsed = now - lastReq;
    if (elapsed < USER_COOLDOWN_MS) {
      const remaining = Math.ceil((USER_COOLDOWN_MS - elapsed) / 1000);
      return msg.reply(`⏳ استنى ${remaining} ثانية قبل ما تكلمني تاني!`).catch(() => {});
    }
    userLastRequest.set(msg.author.id, now);
  }

  if (isOwner) {
    if (!db.claimAiMessage(msg.id)) return;
    handleOwnerAI(msg, msg.guild, geminiModel(), db, buildDMControlPanel);
    return;
  }

  // منع رد مزدوج من نسختين للبوت (نفس الآلية المستخدمة مع الأونر)
  if (!db.claimAiMessage(msg.id)) return;

  const svTypingInterval = setInterval(() => msg.channel.sendTyping().catch(() => {}), 8000);
  msg.channel.sendTyping().catch(() => {});
  try {
    const senderName  = msg.member?.displayName ?? msg.author.displayName ?? msg.author.username;
    const prompt      = buildUserPrompt(senderName, question, msg.author.id);

    let aiPromise;
    if (visionPayload) {
      // جلب الصورة وتحويلها لـ base64
      const imgResp   = await fetch(visionPayload.url);
      const imgBuffer = await imgResp.arrayBuffer();
      const imgB64    = Buffer.from(imgBuffer).toString("base64");
      aiPromise = geminiImageModel().generateContent([
        prompt,
        { inlineData: { mimeType: visionPayload.mimeType, data: imgB64 } },
      ]);
    } else {
      aiPromise = geminiModel().generateContent(prompt);
    }

    const svTimeout   = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000));
    const result      = await Promise.race([aiPromise, svTimeout]);
    const raw         = result.response.text().trim();

    // فصل الـ META tags عن النص
    const { text: replyText, reactionEmoji, gifCategory } = parseAiReply(raw);

    pushUserHistory(msg.author.id, "user", question);
    pushUserHistory(msg.author.id, "bot",  replyText);

    // ريأكشن على رسالة اليوزر
    if (reactionEmoji) msg.react(reactionEmoji).catch(() => {});

    // إرسال الرد
    await msg.reply(replyText);

    // إرسال GIF لو في كاتيجوري
    if (gifCategory) {
      const gifUrl = pickGif(gifCategory);
      if (gifUrl) {
        const gifEmbed = new EmbedBuilder().setImage(gifUrl).setColor(0x2b2d31);
        msg.channel.send({ embeds: [gifEmbed] }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error("خطأ في الرد على الرسالة:", err);
    if (err.isQuotaError || err.message === "ALL_KEYS_EXHAUSTED") {
      await msg.reply("⏳ الـ AI وصل للحد اليومي — جرب تاني بعد شوية!").catch(() => {});
    } else {
      await msg.reply("معلش يسطا ثواني بس").catch(() => {});
    }
  } finally {
    clearInterval(svTypingInterval);
  }
});


// ───────────────────────────────────────────────────────────────
//  تنفيذ Slash Commands و الأزرار و المودال بالكامل
// ───────────────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  // ── منع تكرار معالجة نفس الـ interaction مرتين (مثلاً لو في نسختين) ──
  if (processedInteractions.has(interaction.id)) return;
  processedInteractions.add(interaction.id);
  setTimeout(() => processedInteractions.delete(interaction.id), 60_000);

  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;
    const { user, channel } = interaction;

    // ─── دعم DM الكامل: لو الأمر جاي من DM هنجيب السيرفر تلقائياً ───
    let guild = interaction.guild;
    const isFromDM = !guild;
    if (isFromDM) {
      guild = client.guilds.cache.first() || null;
      if (guild) await guild.members.fetch().catch(() => {});
    }

    try {
      // ✅ دمج: /بلوك رفع|قائمة
      if (cmd === "بلوك") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        const blockSub = interaction.options.getSubcommand();

        if (blockSub === "قائمة") {
          const now = Date.now();
          const blocked = [...spamData.entries()]
            .filter(([, s]) => s.blockedUntil > now)
            .map(([uid, s]) => {
              const mins = Math.ceil((s.blockedUntil - now) / 60_000);
              return `<@${uid}> — فاضل **${mins} دقيقة**`;
            });
          if (blocked.length === 0) {
            return interaction.reply({ content: "✅ مفيش حد مبلوك دلوقتي.", ephemeral: true });
          }
          return interaction.reply({
            content: `🚫 **اليوزرز المبلوكين (${blocked.length}):**\n${blocked.join("\n")}`,
            ephemeral: true,
          });
        }

        if (blockSub === "رفع") {
          const target = interaction.options.getUser("يوزر");
          const entry  = spamData.get(target.id);
          if (!entry || entry.blockedUntil <= Date.now()) {
            return interaction.reply({ content: `✅ **${target.username}** مش مبلوك أصلاً.`, ephemeral: true });
          }
          entry.blockedUntil = 0;
          entry.timestamps   = [];
          return interaction.reply({ content: `✅ اترفع البلوك عن **${target.username}** بنجاح.`, ephemeral: true });
        }
      }

      // ─── حالة البوت (بقت subcommand تحت /بوت) ────────────────────
      if (cmd === "بوت" && interaction.options.getSubcommand() === "حالة") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const uptimeSec  = Math.floor(process.uptime());
        const uptimeMin  = Math.floor(uptimeSec / 60);
        const uptimeHour = Math.floor(uptimeMin / 60);
        const uptimeStr  = uptimeHour > 0
          ? `${uptimeHour}س ${uptimeMin % 60}د`
          : `${uptimeMin}د ${uptimeSec % 60}ث`;

        const memMB    = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const ping     = client.ws.ping;
        const aiStatus = _geminiReady ? `🟢 شغال (${getKeyCount()} مفتاح)` : "🔴 مش شغال";
        const locks    = getProcessingCount();
        const guilds   = client.guilds.cache.size;

        const embed = new EmbedBuilder()
          .setColor(ping < 100 ? 0x2ecc71 : ping < 300 ? 0xf39c12 : 0xe74c3c)
          .setTitle("📊 حالة البوت — لحظة بلحظة")
          .addFields(
            { name: "🏓 Ping Discord",    value: `\`${ping}ms\``,      inline: true },
            { name: "🧠 RAM",             value: `\`${memMB} MB\``,    inline: true },
            { name: "⏱️ Uptime",          value: `\`${uptimeStr}\``,   inline: true },
            { name: "🤖 Gemini AI",       value: aiStatus,             inline: true },
            { name: "🔒 طلبات جارية",    value: `\`${locks} طلب\``,   inline: true },
            { name: "🏛️ سيرفرات",         value: `\`${guilds}\``,      inline: true },
            { name: "🛡️ أخطاء متابَعة",   value: `\`${errorCooldowns.size} نوع\``, inline: true },
            { name: "📦 Node.js",         value: `\`${process.version}\``, inline: true },
            { name: "💾 Heap Total",      value: `\`${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB\``, inline: true }
          )
          .setFooter({ text: "👑 زنجي Bot — Replit Hosting" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ── مفاتيح-جيميني ──────────────────────────────────────────────
      if (cmd === "مفاتيح-جيميني") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        if (sub === "عرض") {
          const stats = getKeyStats();
          const total = stats.length;
          const active = stats.filter(k => !k.exhausted).length;
          const lines = stats.map(k =>
            `${k.exhausted ? "🔴" : "🟢"} مفتاح ${k.index} — \`...${k.suffix}\``
          ).join("\n");

          const embed = new EmbedBuilder()
            .setColor(active > 0 ? 0x2ecc71 : 0xe74c3c)
            .setTitle("🔑 مفاتيح Gemini API")
            .setDescription(lines || "لا يوجد مفاتيح")
            .addFields(
              { name: "📊 إجمالي المفاتيح", value: `\`${total}\``, inline: true },
              { name: "✅ شغالين",           value: `\`${active}\``, inline: true },
              { name: "🚫 خلصوا",            value: `\`${total - active}\``, inline: true },
              { name: "📈 طلبات/يوم",        value: `\`${total * 20} طلب\``, inline: true },
            )
            .setFooter({ text: "المفاتيح المحمرّة بترجع تلقائياً بعد ساعة" })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        if (sub === "تفريش") {
          const count = resetExhaustedKeys();
          const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("🔄 تفريش المفاتيح")
            .setDescription(count > 0
              ? `✅ اتفرشت **${count}** مفاتيح محروقة وبقت شغالة تاني!`
              : "ℹ️ مفيش مفاتيح محروقة دلوقتي، كلهم شغالين!"
            )
            .addFields({ name: "📊 إجمالي المفاتيح", value: `\`${getKeyCount()} مفتاح\``, inline: true })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        if (sub === "إضافة") {
          const raw = interaction.options.getString("مفاتيح");
          const newKeys = raw.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
          if (newKeys.length === 0) {
            return interaction.editReply("❌ مفيش مفاتيح صح في الرسالة!");
          }
          const result = addKeys(newKeys);
          const embed = new EmbedBuilder()
            .setColor(result.added > 0 ? 0x2ecc71 : 0xf39c12)
            .setTitle("🔑 إضافة مفاتيح Gemini")
            .addFields(
              { name: "✅ اتضافوا",        value: `\`${result.added}\``,          inline: true },
              { name: "⏭️ مكررين (تجاهل)", value: `\`${newKeys.length - result.added}\``, inline: true },
              { name: "📊 الإجمالي دلوقتي", value: `\`${result.total} مفتاح\``,   inline: true },
              { name: "📈 طلبات/يوم",       value: `\`${result.total * 20} طلب\``, inline: true },
            )
            .setFooter({ text: "💾 المفاتيح اتحفظت — هتبقى بعد أي restart تلقائياً" })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        if (sub === "حذف") {
          const num = interaction.options.getInteger("رقم");
          const ok = removeKey(num - 1);
          if (!ok) return interaction.editReply(`❌ رقم المفتاح مش صح — استخدم /مفاتيح-جيميني عرض عشان تشوف الأرقام`);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🗑️ تم حذف المفتاح").setDescription(`✅ تم حذف المفتاح رقم **${num}** من النظام والملف المحفوظ.\nإجمالي المفاتيح دلوقتي: **${getKeyCount()}**`).setTimestamp()] });
        }

        if (sub === "تحديد") {
          const num = interaction.options.getInteger("رقم");
          const ok = setActiveKeyIndex(num - 1);
          if (!ok) return interaction.editReply(`❌ رقم المفتاح مش صح — استخدم /مفاتيح-جيميني عرض عشان تشوف الأرقام`);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("🎯 تم تحديد المفتاح").setDescription(`✅ البوت هيستخدم المفتاح رقم **${num}** من دلوقتي.\nالمفاتيح المحروقة اتمسحت ومستعدة.`).setTimestamp()] });
        }
      }

      // ─── رول-ريأكشن ───────────────────────────────────────────────
      if (cmd === "رول-ريأكشن") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles))
          return interaction.reply({ content: "❌ محتاج صلاحية **إدارة الأدوار** عشان تستخدم الأمر ده!", ephemeral: true });

        // اجمع الأزواج الصالحة (رول + إيموجي مطلوبين لكل زوج)
        const pairs = [];
        for (let i = 1; i <= 5; i++) {
          const role  = interaction.options.getRole(`رول-${i}`);
          const emoji = interaction.options.getString(`إيموجي-${i}`)?.trim();
          if (!role || !emoji) continue;
          const msgText = interaction.options.getString(`رسالة-${i}`) || `👇 اعمل ريأكشن بـ ${emoji} عشان تاخد رول **${role.name}**!`;
          pairs.push({ role, emoji, msgText });
        }

        if (pairs.length === 0)
          return interaction.reply({ content: "❌ لازم تحط رول وإيموجي على الأقل للزوج الأول!", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        const results = [];
        for (const pair of pairs) {
          try {
            const sentMsg = await channel.send(pair.msgText);
            await sentMsg.react(pair.emoji).catch(() => {});
            reactionRoles[sentMsg.id] = { emoji: pair.emoji, roleId: pair.role.id, guildId: interaction.guildId };
            results.push(`✅ ${pair.emoji} → **${pair.role.name}**`);
          } catch (e) {
            results.push(`❌ فشل ${pair.emoji} → **${pair.role.name}** (${e.message})`);
          }
        }

        saveReactionRoles();
        return interaction.editReply({ content: `**رول-ريأكشن — النتيجة:**\n${results.join("\n")}` });
      }

      // ─── رتب المستويات ────────────────────────────────────────────
      if (cmd === "رتب-المستويات") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        // ── عرض ──
        if (sub === "عرض") {
          const ranks = getRanks();
          if (ranks.length === 0) {
            return interaction.editReply({ embeds: [
              new EmbedBuilder().setColor(0x95a5a6)
                .setTitle("🏆 رتب المستويات")
                .setDescription("مفيش رتب مضبوطة دلوقتي — استخدم `/رتب-المستويات إضافة` عشان تضيف.")
                .setTimestamp()
            ]});
          }
          const lines = ranks
            .sort((a, b) => b.level - a.level)
            .map((r, i) => `**${i + 1}.** لفل \`${r.level}\` ← **${r.name}** \`(${r.roleId})\``)
            .join("\n");
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor(0xFFD700)
              .setTitle("🏆 رتب المستويات الحالية")
              .setDescription(lines)
              .addFields({ name: "📊 إجمالي الرتب", value: `\`${ranks.length}\``, inline: true })
              .setFooter({ text: "البوت بيدي أعلى رتبة مستحقة عند ارتقاء المستوى" })
              .setTimestamp()
          ]});
        }

        // ── إضافة ──
        if (sub === "إضافة") {
          const level  = interaction.options.getInteger("لفل");
          const role   = interaction.options.getRole("رول");
          const name   = interaction.options.getString("اسم") || role.name;
          const result = addRank(level, role.id, name);
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor(result.added ? 0x2ecc71 : 0xf39c12)
              .setTitle(result.added ? "✅ تمت الإضافة" : "🔄 تم التحديث")
              .addFields(
                { name: "📶 المستوى",   value: `\`${level}\``,          inline: true },
                { name: "🎭 الرتبة",    value: `${role} — **${name}**`, inline: true },
                { name: "📊 إجمالي",    value: `\`${result.total}\``,   inline: true },
              )
              .setFooter({ text: "💾 اتحفظ — هيفضل بعد أي restart" })
              .setTimestamp()
          ]});
        }

        // ── حذف ──
        if (sub === "حذف") {
          const level = interaction.options.getInteger("لفل");
          const ok    = removeRank(level);
          if (!ok) {
            return interaction.editReply(`❌ مفيش رتبة مضبوطة على المستوى **${level}** — استخدم \`/رتب-المستويات عرض\` عشان تشوف الأرقام الصح.`);
          }
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor(0xe74c3c)
              .setTitle("🗑️ تم الحذف")
              .setDescription(`✅ اتحذفت الرتبة المضبوطة على المستوى **${level}** من النظام.\nإجمالي الرتب دلوقتي: **${getRanks().length}**`)
              .setTimestamp()
          ]});
        }

        // ── ريست ──
        if (sub === "ريست") {
          const defaults = resetRanks();
          const lines = defaults.map(r => `لفل \`${r.level}\` ← **${r.name}**`).join("\n");
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor(0x3498db)
              .setTitle("🔄 تم الريست")
              .setDescription(`✅ رجع للإعدادات الافتراضية:\n${lines}`)
              .setTimestamp()
          ]});
        }
      }

      // ═══════════════════════════════════════════════════════════════
      //  Advanced Features Commands
      // ═══════════════════════════════════════════════════════════════

      // Image Cleaner
      if (cmd === "clean_chapter") {
        return await handleCleanChapter(interaction);
      }

      // Translator
      if (cmd === "translate_chapter") {
        return await handleTranslateChapter(interaction);
      }

      // ── قدرات المتجر ─────────────────────────────────────────────
      if (cmd === "متجر-قدرات")  return await handleShopCommand(interaction, db);
      if (cmd === "قدراتي")      return await handleMyAbilitiesCommand(interaction, db);
      if (cmd === "استفتاء")      return await handlePollCommand(interaction);
      if (cmd === "الألعاب")     return await handleGamesHubCommand(interaction);
      if (cmd === "احدث-المميزات") return await handleLatestFeaturesCommand(interaction);
      if (cmd === "حياة")          return await handleBankLifeCommand(interaction, db);
      if (cmd === "بنك-الحظ-مصري") return await bankLuckEgCommand.execute(interaction, db);
      if (cmd === "تغيير-طريقة-الكلام") {
        if (!config.isOwner(user.id)) return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        const mode    = interaction.options.getString("أسلوب");
        const dialect = interaction.options.getString("لهجة");

        const lines = [];

        if (mode) {
          botSpeechMode = mode;
          const modeLabel = mode === "free"   ? "😈 باد بوي — البوت بيشتم بس لو شتموه هو"
                          : mode === "toxic"  ? "☠️ إكستريم — كل كلامه شتايم ومنفتح جداً 100%"
                          : "🎩 محترم — 0% شتايم حتى لو شتموه";
          lines.push(`🗣️ **الأسلوب:** ${modeLabel}`);
        }

        if (dialect) {
          botDialect = dialect;
          const dialectLabel = dialect === "egyptian" ? "🇪🇬 مصري — عامية مصرية طبيعية"
                             : "🌐 عربي — فصحى / عربي رسمي";
          lines.push(`💬 **اللهجة:** ${dialectLabel}`);
        }

        if (!mode && !dialect) {
          return interaction.reply({ content: "❌ اختار أسلوب أو لهجة على الأقل!", ephemeral: true });
        }

        const modeColor = botSpeechMode === "toxic" ? 0xe74c3c : botSpeechMode === "free" ? 0x9b59b6 : 0x2ecc71;
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(modeColor).setTitle("✅ تم التغيير")
            .setDescription(lines.join("\n") + "\n\n*التغيير فوري على كل الردود الجديدة*")
            .setTimestamp()],
          ephemeral: true
        });
      }

      if (cmd === "auto-mod") {
        if (!config.isOwner(user.id)) return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        const state = interaction.options.getString("حالة");
        autoModEnabled = state === "on";
        moderation.setEnabled(autoModEnabled);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(autoModEnabled ? 0x2ecc71 : 0xe74c3c)
            .setTitle(autoModEnabled ? "✅ Auto-Mod شغال" : "❌ Auto-Mod متوقف")
            .setDescription(
              autoModEnabled
                ? "نظام Auto-Mod **شغال** دلوقتي — الرسايل المخالفة هتتحذف تلقائياً.\n🔒 الأنتي سبام والأنتي لينك والأنتي رايد كلهم **شغالين**."
                : "نظام Auto-Mod **متوقف** — مفيش حاجة هتتعمل تلقائياً.\n🔓 تم إيقاف: مسح الرسايل، الحظر التلقائي، الباند، الطرد، الأنتي سبام، الأنتي لينك، الأنتي رايد — كل حاجة وقفت."
            ).setTimestamp()],
          ephemeral: true
        });
      }

      if (cmd === "حالة-الحماية") {
        if (!config.isOwner(user.id)) return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });

        const amStatus   = autoModEnabled;
        const raidOk     = !!(config.OWNER_ID && config.ADMIN_CHANNEL_ID);
        const spamLimit  = config.ANTI_SPAM_THRESHOLD;
        const spamWindow = (config.ANTI_SPAM_WINDOW / 1000).toFixed(0);
        const raidLimit  = config.ANTI_RAID_THRESHOLD;
        const raidWindow = (config.ANTI_RAID_WINDOW / 1000).toFixed(0);
        const { existsSync: _existsSync } = await import('fs');
        const cookiesSrc = (process.env.YOUTUBE_COOKIES?.length > 0)
          ? 'env:YOUTUBE_COOKIES'
          : _existsSync('./cookies.txt') ? 'file:cookies.txt' : 'none';

        const on  = (v) => v ? '🟢 شغّال' : '🔴 متوقف';
        const embed = new EmbedBuilder()
          .setColor(amStatus ? 0x2ecc71 : 0xe74c3c)
          .setTitle('🛡️ حالة أنظمة الحماية')
          .addFields(
            { name: '🤖 Auto-Mod الرئيسي',   value: on(amStatus),                               inline: true },
            { name: '🚫 أنتي سبام',           value: amStatus ? `🟢 ${spamLimit} رسايل/${spamWindow}ث` : '🔴 متوقف', inline: true },
            { name: '🔗 أنتي لينك',           value: on(amStatus),                               inline: true },
            { name: '🌊 أنتي رايد',           value: raidOk && amStatus ? `🟢 ${raidLimit} join/${raidWindow}ث` : '🔴 متوقف', inline: true },
            { name: '🧠 Gemini Smart-Scan',   value: on(amStatus && _geminiReady),               inline: true },
            { name: '🍪 YouTube Cookies',     value: cookiesSrc === 'none' ? '🔴 مفيش' : `🟢 ${cookiesSrc}`, inline: true },
          )
          .setFooter({ text: 'استخدم /auto-mod on/off للتحكم في كل الأنظمة' })
          .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (cmd === "قائمة-الباند") {
        if (!config.isOwner(user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
          return interaction.reply({ content: "❌ محتاج صلاحية Ban Members عشان تشوف القايمة دي!", ephemeral: true });
        }
        const banList = db.getBanList();
        const entries = Object.values(banList);
        if (entries.length === 0) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("📋 قائمة الباند")
              .setDescription("✅ القائمة فاضية — مفيش حد متبند دلوقتي.")
              .setTimestamp()],
            ephemeral: true,
          });
        }
        const fields = entries.slice(0, 20).map((entry, i) => ({
          name: `🔨 #${i + 1} — <@${entry.userId}>`,
          value: `📋 **السبب:** ${entry.reason ?? "غير محدد"}\n🛡️ **بواسطة:** <@${entry.moderatorId ?? "مجهول"}>\n📅 <t:${Math.floor((entry.timestamp ?? Date.now()) / 1000)}:R>`,
          inline: false,
        }));
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xc0392b).setTitle(`🔨 قائمة الباند (${entries.length} عضو)`)
            .setDescription(entries.length > 20 ? `⚠️ بيظهر أول 20 فقط من إجمالي ${entries.length}` : null)
            .addFields(fields)
            .setTimestamp()],
          ephemeral: true,
        });
      }

      // ── نظام الأنمي ────────────────────────────────────────────
      if (cmd === "أنمي") return await handleAnimeCommand(interaction);

      if (cmd === "رفع-باند") {
        if (!config.isOwner(user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
          return interaction.reply({ content: "❌ محتاج صلاحية Ban Members عشان تستخدم الأمر ده!", ephemeral: true });
        }
        const targetId = interaction.options.getString("id")?.trim();
        const reason   = interaction.options.getString("سبب") ?? "مش محدد";

        if (!/^\d{17,20}$/.test(targetId)) {
          return interaction.reply({ content: "❌ الـ ID مش صح! لازم يكون أرقام بس (17-20 رقم).", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          await guild.bans.remove(targetId, reason);
        } catch (err) {
          if (err.code === 10026) {
            return interaction.editReply({ content: "❌ العضو ده مش متبند أصلاً على ديسكورد!" });
          }
          return interaction.editReply({ content: `❌ فشل رفع الباند: ${err.message}` });
        }

        const wasInList = db.removeBan(targetId);

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🔓 تم رفع الحظر")
            .addFields(
              { name: "👤 العضو",      value: `<@${targetId}> (\`${targetId}\`)`, inline: true },
              { name: "📋 السبب",      value: reason,                              inline: true },
              { name: "🛡️ بواسطة",   value: `<@${user.id}>`,                     inline: true },
              { name: "📋 القائمة",    value: wasInList ? "✅ اتشال من قائمة الباند" : "ℹ️ مكانش في قائمة الباند المحلية", inline: false },
            )
            .setTimestamp()],
        });
      }

      // ─── أمر إيمبد ────────────────────────────────────────────────
      if (cmd === "إيمبد") {
        if (!config.isOwner(user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: "❌ الأمر ده للمشرفين بس!", ephemeral: true });
        }

        // ─── ألوان جاهزة بالعربي ─────────────────────────────────
        const colorPresets = {
          "أحمر": 0xe74c3c, "أخضر": 0x2ecc71, "أزرق": 0x3498db,
          "ذهبي": 0xf1c40f, "بنفسجي": 0x9b59b6, "برتقالي": 0xe67e22,
          "وردي": 0xff6b9d, "سماوي": 0x1abc9c, "أبيض": 0xffffff,
          "أسود": 0x2c2f33, "رمادي": 0x95a5a6, "بني": 0xa0522d,
        };

        // ─── تخزين إعدادات الإيمبد مؤقتاً ───────────────────────
        const embedId = `${interaction.user.id}_${Date.now()}`;

        const rawColor = interaction.options.getString("لون");
        let resolvedColor = 0x5865f2; // أزرق Discord افتراضي
        if (rawColor) {
          const presetKey = Object.keys(colorPresets).find(k => rawColor.includes(k));
          if (presetKey) {
            resolvedColor = colorPresets[presetKey];
          } else {
            const hex = rawColor.replace("#", "");
            const parsed = parseInt(hex, 16);
            if (!isNaN(parsed)) resolvedColor = parsed;
          }
        }

        const targetChannel = interaction.options.getChannel("قناة") || interaction.channel;
        const wantPreview   = interaction.options.getBoolean("معاينة") ?? true;

        // حفظ البيانات مؤقتاً
        const embedDraft = {
          title:        interaction.options.getString("عنوان") || null,
          color:        resolvedColor,
          image:        interaction.options.getString("صورة") || null,
          thumbnail:    interaction.options.getString("مصغرة") || null,
          authorName:   interaction.options.getString("أوثر") || null,
          authorIcon:   interaction.options.getString("أوثر-صورة") || null,
          authorUrl:    interaction.options.getString("أوثر-لينك") || null,
          footerText:   interaction.options.getString("فوتر") || null,
          footerIcon:   interaction.options.getString("فوتر-صورة") || null,
          titleUrl:     interaction.options.getString("لينك-عنوان") || null,
          showTimestamp: interaction.options.getBoolean("تاريخ") ?? false,
          channelId:    targetChannel.id,
          wantPreview,
        };
        autoModLogs.set(`embed_${embedId}`, embedDraft); // نستخدم نفس الـ map المؤقت
        setTimeout(() => autoModLogs.delete(`embed_${embedId}`), 30 * 60 * 1000);

        // ─── فتح Modal للوصف والحقول ────────────────────────────
        const modal = new ModalBuilder()
          .setCustomId(`embed_modal_${embedId}`)
          .setTitle("🎨 إيمبد Builder — تفاصيل المحتوى");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_desc")
              .setLabel("📝 الوصف (يدعم Markdown وكل الأسطر)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(4000)
              .setPlaceholder("اكتب وصف الإيمبد هنا...\nتقدر تستخدم **بولد** و *إيطاليك* وكل حاجة")
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_field1")
              .setLabel("📌 حقل 1 — اكتب بالشكل: العنوان | المحتوى")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(500)
              .setPlaceholder("مثال: 🎮 اللعبة | Minecraft أو اتركه فاضي")
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_field2")
              .setLabel("📌 حقل 2 — اكتب بالشكل: العنوان | المحتوى")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(500)
              .setPlaceholder("مثال: 👥 الأعضاء | 500+ عضو أو اتركه فاضي")
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_field3")
              .setLabel("📌 حقل 3 — اكتب بالشكل: العنوان | المحتوى")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(500)
              .setPlaceholder("مثال: 📅 التاريخ | كل جمعة 9م أو اتركه فاضي")
          ),
        );

        return interaction.showModal(modal);
      }

      // ─── أمر تعديل إيمبد ──────────────────────────────────────────
      if (cmd === "إيمبد-تعديل") {
        if (!config.isOwner(user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: "❌ الأمر ده للمشرفين بس!", ephemeral: true });
        }

        const msgId     = interaction.options.getString("message_id")?.trim();
        const targetCh  = interaction.options.getChannel("قناة") || interaction.channel;

        if (!/^\d{17,20}$/.test(msgId)) {
          return interaction.reply({ content: "❌ الـ Message ID مش صح! لازم يكون أرقام بس (17-20 رقم).", ephemeral: true });
        }

        // ─── نجيب الرسالة ────────────────────────────────────────
        let targetMsg;
        try {
          targetMsg = await targetCh.messages.fetch(msgId);
        } catch {
          return interaction.reply({ content: `❌ مش لاقي الرسالة في <#${targetCh.id}>!\nتأكد من الـ ID أو اختار القناة الصح.`, ephemeral: true });
        }

        if (!targetMsg.author.bot || targetMsg.author.id !== client.user.id) {
          return interaction.reply({ content: "❌ الرسالة دي مش بتاعة البوت — مينفعش أعدّلها!", ephemeral: true });
        }

        if (!targetMsg.embeds || targetMsg.embeds.length === 0) {
          return interaction.reply({ content: "❌ الرسالة دي مفيهاش إيمبد!", ephemeral: true });
        }

        // ─── ألوان جاهزة بالعربي ─────────────────────────────────
        const colorPresets = {
          "أحمر": 0xe74c3c, "أخضر": 0x2ecc71, "أزرق": 0x3498db,
          "ذهبي": 0xf1c40f, "بنفسجي": 0x9b59b6, "برتقالي": 0xe67e22,
          "وردي": 0xff6b9d, "سماوي": 0x1abc9c, "أبيض": 0xffffff,
          "أسود": 0x2c2f33, "رمادي": 0x95a5a6, "بني": 0xa0522d,
        };

        const oldEmbed  = targetMsg.embeds[0];
        const editId    = `${interaction.user.id}_${Date.now()}`;

        // ─── دمج الإعدادات القديمة مع الجديدة ───────────────────
        function resolveColor(rawColor, fallback) {
          if (!rawColor) return fallback;
          const presetKey = Object.keys(colorPresets).find(k => rawColor.includes(k));
          if (presetKey) return colorPresets[presetKey];
          const parsed = parseInt(rawColor.replace("#", ""), 16);
          return isNaN(parsed) ? fallback : parsed;
        }
        function resolveStr(newVal, oldVal) {
          if (newVal === null) return oldVal ?? null;
          if (newVal.trim().toLowerCase() === "مسح") return null;
          return newVal.trim() || oldVal || null;
        }

        const rawNewTitle  = interaction.options.getString("عنوان");
        const rawNewColor  = interaction.options.getString("لون");
        const rawNewImg    = interaction.options.getString("صورة");
        const rawNewThumb  = interaction.options.getString("مصغرة");
        const rawNewAuthor = interaction.options.getString("أوثر");
        const rawNewAuthImg= interaction.options.getString("أوثر-صورة");
        const rawNewFooter = interaction.options.getString("فوتر");
        const rawNewFtImg  = interaction.options.getString("فوتر-صورة");
        const rawNewUrl    = interaction.options.getString("لينك-عنوان");
        const newTimestamp = interaction.options.getBoolean("تاريخ");

        const editDraft = {
          messageId:    msgId,
          channelId:    targetCh.id,
          title:        resolveStr(rawNewTitle,  oldEmbed.title),
          color:        resolveColor(rawNewColor, oldEmbed.color ?? 0x5865f2),
          image:        resolveStr(rawNewImg,   oldEmbed.image?.url ?? null),
          thumbnail:    resolveStr(rawNewThumb, oldEmbed.thumbnail?.url ?? null),
          authorName:   resolveStr(rawNewAuthor, oldEmbed.author?.name ?? null),
          authorIcon:   resolveStr(rawNewAuthImg, oldEmbed.author?.iconURL ?? null),
          footerText:   resolveStr(rawNewFooter, oldEmbed.footer?.text ?? null),
          footerIcon:   resolveStr(rawNewFtImg,  oldEmbed.footer?.iconURL ?? null),
          titleUrl:     resolveStr(rawNewUrl,    oldEmbed.url ?? null),
          showTimestamp: newTimestamp !== null ? newTimestamp : !!(oldEmbed.timestamp),
          // نحتفظ بالحقول القديمة
          oldFields:    oldEmbed.fields ?? [],
          oldDesc:      oldEmbed.description ?? "",
        };
        autoModLogs.set(`embededit_${editId}`, editDraft);
        setTimeout(() => autoModLogs.delete(`embededit_${editId}`), 30 * 60 * 1000);

        // ─── Modal بالوصف والحقول مملوءة بالقيم القديمة ─────────
        const oldField1 = oldEmbed.fields?.[0] ? `${oldEmbed.fields[0].name} | ${oldEmbed.fields[0].value}` : "";
        const oldField2 = oldEmbed.fields?.[1] ? `${oldEmbed.fields[1].name} | ${oldEmbed.fields[1].value}` : "";
        const oldField3 = oldEmbed.fields?.[2] ? `${oldEmbed.fields[2].name} | ${oldEmbed.fields[2].value}` : "";

        const modal = new ModalBuilder()
          .setCustomId(`embededit_modal_${editId}`)
          .setTitle("✏️ تعديل الإيمبد — المحتوى");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_desc")
              .setLabel("📝 الوصف (اتركه فاضي يفضل زي ما هو — اكتب 'مسح' تشيله)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(4000)
              .setValue(oldEmbed.description?.slice(0, 4000) ?? "")
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_field1")
              .setLabel("📌 حقل 1 — العنوان | المحتوى (فاضي = مسح)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(500)
              .setValue(oldField1.slice(0, 500))
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_field2")
              .setLabel("📌 حقل 2 — العنوان | المحتوى (فاضي = مسح)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(500)
              .setValue(oldField2.slice(0, 500))
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("embed_field3")
              .setLabel("📌 حقل 3 — العنوان | المحتوى (فاضي = مسح)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(500)
              .setValue(oldField3.slice(0, 500))
          ),
        );

        return interaction.showModal(modal);
      }

      // Quick Cleaning Tools
      if (cmd === "تنظيف_صورة") {
        return await handleWhitenUpload(interaction);
      }
      if (cmd === "تنظيف_رابط") {
        return await handleWhitenLink(interaction);
      }
      if (cmd === "استخراج_نص") {
        return await handleOcrUpload(interaction);
      }

      // Music Commands
      // ─── لو الأمر جاي من DM: بنجيب الميمبر من السيرفر عشان نعرف الـ voice channel ───
      const MUSIC_CMDS = ["شغل","شغل-اغنية","تخطي","skip","خروج","قائمة","queue","بوز","pause","كمل","resume","شغال-ايه","nowplaying","صوت","volume","تكرار","خلط","تخطى-لـ","احذف","كلمات"];
      if (MUSIC_CMDS.includes(cmd)) {
        let musicInteraction = interaction;
        if (isFromDM && guild) {
          const guildMember = await guild.members.fetch(user.id).catch(() => null);
          musicInteraction = new Proxy(interaction, {
            get(target, prop) {
              if (prop === "guild")   return guild;
              if (prop === "guildId") return guild.id;
              if (prop === "member")  return guildMember;
              const val = target[prop];
              return typeof val === "function" ? val.bind(target) : val;
            }
          });
        }

        if (cmd === "شغل" || cmd === "شغل-اغنية") return await handlePlay(musicInteraction);
        if (cmd === "تخطي" || cmd === "skip")      return await handleSkip(musicInteraction);
        if (cmd === "وقف"  || cmd === "خروج")      return await handleStop(musicInteraction);
        if (cmd === "قائمة"|| cmd === "queue")     return await handleQueue(musicInteraction);
        if (cmd === "بوز"  || cmd === "pause")     return await handlePause(musicInteraction);
        if (cmd === "كمل"  || cmd === "resume")    return await handleResume(musicInteraction);
        if (cmd === "شغال-ايه" || cmd === "nowplaying") return await handleNowPlaying(musicInteraction);
        if (cmd === "صوت"  || cmd === "volume")    return await handleVolume(musicInteraction);
        if (cmd === "تكرار")                       return await handleRepeat(musicInteraction);
        if (cmd === "خلط")                         return await handleShuffle(musicInteraction);
        if (cmd === "تخطى-لـ")                     return await handleJump(musicInteraction);
        if (cmd === "احذف")                        return await handleRemove(musicInteraction);
        if (cmd === "كلمات")                       return await handleLyrics(musicInteraction);
      }

      // ═══════════════════════════════════════════════════════════════
      //  Legacy Commands
      // ═══════════════════════════════════════════════════════════════

      if (cmd === "ping") {
        return interaction.reply({ content: `🏓 سرعة البوت الحالية: **${client.ws.ping}ms**` });
      }

      if (cmd === "hello") {
        return interaction.reply({ content: `أهلاً يا صاحبى ${user}! عامل إيه النهاردة؟ 😉` });
      }

      if (cmd === "roll") {
        const sides = interaction.options.getInteger("sides") ?? 6;
        return interaction.reply({ content: `🎲 رميت النرد وطلعلك النتيجة: **${Math.floor(Math.random() * sides) + 1}**` });
      }

      if (cmd === "serverinfo") {
        if (!guild) return interaction.reply({ content: "❌ الأمر ده في السيرفرات بس يسطا!", ephemeral: true });
        await interaction.deferReply();
        await guild.members.fetch().catch(() => {});
        await guild.emojis.fetch().catch(() => {});
        await guild.stickers.fetch().catch(() => {});

        const owner = await guild.fetchOwner().catch(() => null);

        // ── الأعضاء ──
        const allMembers = guild.members.cache;
        const humanCount = allMembers.filter(m => !m.user.bot).size;
        const botCount   = allMembers.filter(m => m.user.bot).size;

        // ── القنوات ──
        const chCache   = guild.channels.cache;
        const txtCount  = chCache.filter(c => c.type === 0).size;
        const voiceCount = chCache.filter(c => c.type === 2).size;
        const catCount  = chCache.filter(c => c.type === 4).size;
        const newsCount = chCache.filter(c => c.type === 5).size;
        const stageCount = chCache.filter(c => c.type === 13).size;
        const forumCount = chCache.filter(c => c.type === 15).size;
        const threadCount = chCache.filter(c => [10, 11, 12].includes(c.type)).size;
        const totalCh   = chCache.size;

        // ── الرتب والإيموجي ──
        const roleCount   = guild.roles.cache.size - 1; // بدون @everyone
        const emojiCount  = guild.emojis.cache.size;
        const stickerCount = guild.stickers.cache.size;
        const animatedEmojis = guild.emojis.cache.filter(e => e.animated).size;

        // ── البوست ──
        const boostTier  = guild.premiumTier;         // 0-3
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostNeeded = [2, 7, 14][boostTier] ?? "—";

        const verifyMap = ["❌ لا يوجد", "🟢 منخفض", "🟡 متوسط", "🟠 عالي", "🔴 عالي جداً"];
        const mfaMap   = ["❌ لا يُشترط", "✅ مطلوب للإدارة"];
        const nsfw     = ["✅ آمن","🟡 فعّال","🟠 صريح","🔴 عمر 18+"][guild.nsfwLevel] ?? "غير معروف";

        const createdTs = Math.floor(guild.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🏛️ ${guild.name}`)
          .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: "🆔 ID السيرفر",       value: `\`${guild.id}\``,                                                     inline: true },
            { name: "👑 الأونر",             value: owner ? `<@${owner.id}>\n\`${owner.user.username}\`` : "غير معروف",   inline: true },
            { name: "📅 تاريخ الإنشاء",     value: `<t:${createdTs}:D>\n<t:${createdTs}:R>`,                             inline: true },

            { name: "👥 الأعضاء",
              value: `**الكل:** ${guild.memberCount}\n👤 بشر: ${humanCount}\n🤖 بوتات: ${botCount}`,                       inline: true },
            { name: "📡 القنوات (${totalCh})",
              value: `💬 نصية: ${txtCount}\n🔊 صوتية: ${voiceCount}\n📁 كاتيجوري: ${catCount}\n📰 أخبار: ${newsCount}\n🎭 ستيج: ${stageCount}\n💬 فورم: ${forumCount}\n🧵 ثريدز: ${threadCount}`,
                                                                                                                            inline: true },
            { name: "🎭 الرتب",             value: `\`${roleCount}\` رتبة`,                                               inline: true },

            { name: "😀 الإيموجي",
              value: `**الكل:** ${emojiCount}\n🖼️ ثابت: ${emojiCount - animatedEmojis}\n✨ متحرك: ${animatedEmojis}\n🎭 ستيكرز: ${stickerCount}`,
                                                                                                                            inline: true },
            { name: "🚀 البوست",
              value: `**المستوى:** ${boostTier}\n⚡ البوستات: ${boostCount}`,                                              inline: true },
            { name: "🔒 التحقق",
              value: `${verifyMap[guild.verificationLevel] ?? "؟"}\n🛡️ 2FA: ${mfaMap[guild.mfaLevel] ?? "؟"}\n🔞 NSFW: ${nsfw}`,
                                                                                                                            inline: true },
          )
          .setFooter({ text: `زنجي Bot • معلومات تفصيلية للسيرفر` })
          .setTimestamp();

        if (guild.description) embed.setDescription(`📝 ${guild.description}`);
        if (guild.bannerURL())  embed.setImage(guild.bannerURL({ size: 1024 }));

        const featureLabels = {
          COMMUNITY: "🏘️ كوميونيتي", VERIFIED: "✅ موثّق", PARTNERED: "🤝 بارتنر",
          DISCOVERABLE: "🔍 قابل للاكتشاف", VANITY_URL: "🔗 URL مخصص",
          NEWS: "📰 أخبار", ANIMATED_ICON: "🎨 أيقونة متحركة",
          BANNER: "🖼️ بانر", INVITE_SPLASH: "✨ سبلاش",
          ANIMATED_BANNER: "🎬 بانر متحرك", AUTO_MODERATION: "🛡️ Auto-Mod",
          WELCOME_SCREEN_ENABLED: "👋 شاشة ترحيب", MONETIZATION_ENABLED: "💰 مونتيزيشن",
        };
        const featList = guild.features.map(f => featureLabels[f] ?? f.replace(/_/g, " ")).join(" • ");
        if (featList) embed.addFields({ name: "⭐ مميزات السيرفر", value: featList.slice(0, 1024) });

        const vanity = guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : "لا يوجد";
        embed.addFields({ name: "🔗 رابط مخصص", value: vanity, inline: true });

        return interaction.editReply({ embeds: [embed] });
      }

      if (cmd === "userinfo") {
        const target = interaction.options.getUser("user") ?? user;
        await interaction.deferReply();

        // جيب المـ member عشان نوصل لبيانات السيرفر
        const member = guild
          ? await guild.members.fetch(target.id).catch(() => null)
          : null;

        // بيانات الداتابيس
        const uData    = db.getUser(target.id);
        const warnings = db.getWarnings(target.id);
        const abilities = db.getGameAbilities(target.id);

        // ── تواريخ ──
        const createdTs = Math.floor(target.createdTimestamp / 1000);
        const joinedTs  = member?.joinedTimestamp
          ? Math.floor(member.joinedTimestamp / 1000)
          : null;

        // ── الرتب (بدون @everyone، أعلى 10 بس عشان ما يطولش) ──
        const roles = member
          ? [...member.roles.cache.values()]
              .filter(r => r.id !== guild.id)
              .sort((a, b) => b.position - a.position)
          : [];
        const topRoles   = roles.slice(0, 10).map(r => `<@&${r.id}>`).join(" ");
        const rolesText  = roles.length
          ? `${topRoles}${roles.length > 10 ? ` +${roles.length - 10} أكتر` : ""}`
          : "لا توجد رتب";
        const highestRole = roles[0] ? `<@&${roles[0].id}>` : "لا يوجد";

        // ── XP والمستوى ──
        const lvl        = uData.level || 0;
        const xp         = uData.xp   || 0;
        const nextLvlXp  = (lvl + 1) * (lvl + 1) * 50;
        const progress   = nextLvlXp > 0 ? Math.min(Math.floor((xp / nextLvlXp) * 10), 10) : 0;
        const progressBar = "█".repeat(progress) + "░".repeat(10 - progress);

        // ── القدرات ──
        const abilityNames = { shield:"🛡️ درع", skip:"⏭️ تخطي", double:"💰 ضعف", steal:"🥷 سرقة" };
        const abilityText = Object.entries(abilities).length
          ? Object.entries(abilities).map(([k, v]) => `${abilityNames[k] ?? k}: x${v}`).join(" • ")
          : "لا توجد قدرات";

        // ── حالة البوست ──
        const boostSince = member?.premiumSince
          ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`
          : "لا";

        // ── تايم-اوت حالي ──
        const timedOut = member?.communicationDisabledUntilTimestamp > Date.now();
        const muteUntil = timedOut
          ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
          : "لا";

        // ── badges ──
        const flags = target.flags?.toArray() ?? [];
        const badgeMap = {
          Staff:                   "👮 ديسكورد ستاف",
          Partner:                 "🤝 بارتنر",
          Hypesquad:               "🏠 HypeSquad",
          BugHunterLevel1:         "🐛 Bug Hunter",
          BugHunterLevel2:         "🐛 Bug Hunter Gold",
          HypeSquadOnlineHouse1:   "⚖️ Balance",
          HypeSquadOnlineHouse2:   "💛 Bravery",
          HypeSquadOnlineHouse3:   "💙 Brilliance",
          PremiumEarlySupporter:   "🌟 Early Supporter",
          VerifiedDeveloper:       "🔧 Verified Dev",
          ActiveDeveloper:         "🛠️ Active Dev",
          CertifiedModerator:      "🛡️ Moderator",
        };
        const badgesText = flags.length
          ? flags.map(f => badgeMap[f] ?? f).join(" • ")
          : "لا توجد";

        const embed = new EmbedBuilder()
          .setColor(member?.displayHexColor && member.displayHexColor !== "#000000"
            ? member.displayHexColor : 0x5865f2)
          .setTitle(`${target.bot ? "🤖" : "👤"} ${member?.displayName ?? target.username}`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: "🏷️ اسم المستخدم",    value: `\`${target.username}\``,                  inline: true },
            { name: "🆔 الـ ID",            value: `\`${target.id}\``,                        inline: true },
            { name: "🤖 بوت؟",             value: target.bot ? "✅ آيه" : "❌ لأ",            inline: true },

            { name: "📅 تاريخ الحساب",     value: `<t:${createdTs}:D>\n<t:${createdTs}:R>`, inline: true },
            { name: "📥 انضم للسيرفر",      value: joinedTs
              ? `<t:${joinedTs}:D>\n<t:${joinedTs}:R>`
              : "غير متاح",                                                                    inline: true },
            { name: "🚀 بوستر؟",           value: boostSince,                                inline: true },

            { name: "✨ المستوى والـ XP",
              value: `**Lvl ${lvl}** — ${xp} XP\n\`${progressBar}\` → ${nextLvlXp} XP`,     inline: false },

            { name: "🪙 الكوينز",          value: `**${uData.coins ?? 0}**`,                 inline: true },
            { name: "⚠️ التحذيرات",        value: `**${warnings.length}**`,                  inline: true },
            { name: "🔇 مسكوت لـ",         value: muteUntil,                                 inline: true },

            { name: `🎭 الرتب (${roles.length})`, value: rolesText,                          inline: false },
            { name: "⭐ أعلى رتبة",        value: highestRole,                               inline: true },
            { name: "🎮 قدرات الألعاب",    value: abilityText,                               inline: false },
            { name: "🏅 الشارات",          value: badgesText,                                inline: false },
          )
          .setFooter({ text: "زنجي Bot • معلومات تفصيلية للعضو" })
          .setTimestamp();

        // آخر مكافأة يومية
        if (uData.lastDaily) {
          const dailyTs = Math.floor(new Date(uData.lastDaily).getTime() / 1000);
          embed.addFields({ name: "🎁 آخر يومي", value: `<t:${dailyTs}:R>`, inline: true });
        }

        // آخر 3 تحذيرات
        if (warnings.length > 0) {
          const lastWarns = warnings.slice(-3).reverse()
            .map((w, i) => `**${i + 1}.** ${w.reason} — بواسطة \`${w.moderator}\``)
            .join("\n");
          embed.addFields({ name: "📋 آخر التحذيرات", value: lastWarns });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      if (cmd === "القوانين") {
        return interaction.reply({ content: "📜 **قوانين السيرفر:**\n1. الاحترام المتبادل.\n2. عدم نشر روابط خارجية وإعلانات سبام.\n3. التحدث فى الرومات المخصصة." });
      }

      // ✅ دمج: /اقتصاد بروفايل|محفظة|متجر|شراء|إعطاء|يومي
      if (cmd === "اقتصاد") {
        const econSub = interaction.options.getSubcommand();

        if (econSub === "بروفايل") {
          const target = interaction.options.getUser("عضو") ?? user;
          const uData = db.getUser(target.id);
          return interaction.reply({ content: `✨ **بروفايل ${target.username}:**\n📊 المستوى: \`${uData.level}\`\n🪙 الكوينز: \`${uData.coins}\`\n⭐ الـ XP الحالي: \`${uData.xp}\`` });
        }

        if (econSub === "محفظة") {
          const uData = db.getUser(user.id);
          return interaction.reply({ content: `🪙 محفظتك فيها حالياً: **${uData.coins}** كوينز يسطا!` });
        }

        if (econSub === "متجر") {
          const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle("🛒 متجر رتب السيرفر")
            .setDescription("🥇 Golden: 5000 كوينز\n🥈 Silver: 2500 كوينز\n🥉 Bronze: 1000 كوينز\n\nللشراء اكتب `/اقتصاد شراء الرتبة:(الاسم)`");
          return interaction.reply({ embeds: [embed] });
        }

        if (econSub === "شراء") {
          const choice = interaction.options.getString("الرتبة");
          const uData = db.getUser(user.id);
          const prices = { golden: 5000, silver: 2500, bronze: 1000 };
          if (uData.coins < prices[choice]) return interaction.reply({ content: "❌ معندكش كوينز كفاية يا غالي!", ephemeral: true });

          const role = guild.roles.cache.find(r => r.name.toLowerCase() === choice);
          if (!role) return interaction.reply({ content: "❌ الرتبة مش متأسسة بنفس الاسم في السيرفر ده!", ephemeral: true });

          const member = await guild.members.fetch(user.id);
          await member.roles.add(role);
          db.updateUser(user.id, { coins: uData.coins - prices[choice] });
          return interaction.reply({ content: `🎉 مبروك! اشتريت الرتبة بنجاح واتخصم ${prices[choice]} كوينز.` });
        }

        if (econSub === "إعطاء") {
          // ✅ ملحوظة: Discord مش بيسمح بـ default permissions مختلفة لكل subcommand،
          //   فبنعمل فحص يدوي هنا للصلاحية بدل الاعتماد على setDefaultMemberPermissions
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ الأمر ده للإدارة بس!", ephemeral: true });
          }
          const target = interaction.options.getUser("عضو");
          const amount = interaction.options.getInteger("كمية");
          const uData = db.getUser(target.id);
          db.updateUser(target.id, { coins: uData.coins + amount });
          return interaction.reply({ content: `🪙 تم منح **${amount}** كوينز لـ ${target} بنجاح.` });
        }

        if (econSub === "يومي") {
          const uData = db.getUser(user.id);
          const now = Date.now();
          if (uData.lastDaily && now - uData.lastDaily < 86400000) return interaction.reply({ content: "❌ أخدت المكافأة بتاعتك النهاردة خلاص يسطا تعالي بكره!", ephemeral: true });
          db.updateUser(user.id, { coins: uData.coins + 200, lastDaily: now });
          return interaction.reply({ content: "🎁 أخدت الـ **200 كوينز** اليومية بتاعتك بنجاح! نوّرت المحفظة." });
        }
      }

      // ✅ دمج: /مانهوا إنشاء|إضافة-مصطلح|عرض-مصطلحات
      if (cmd === "مانهوا") {
        const mSub = interaction.options.getSubcommand();

        if (mSub === "إنشاء") {
          const name = interaction.options.getString("الاسم");
          if (db.getManhwaDict(name) && Object.keys(db.getManhwaDict(name)).length > 0) return interaction.reply({ content: "❌ القاموس ده موجود بالفعل يسطا!", ephemeral: true });
          db.addManhwaTerm(name, "_init", "_init");
          return interaction.reply({ content: `✅ تم إنشاء قاموس مانهوا جديد باسم: **${name}**` });
        }

        if (mSub === "إضافة-مصطلح") {
          const mName = interaction.options.getString("المانهوا");
          const eng = interaction.options.getString("الإنجليزي");
          const arb = interaction.options.getString("العربي");
          if (!db.getManhwaDict(mName) || Object.keys(db.getManhwaDict(mName)).length === 0) return interaction.reply({ content: "❌ القاموس ده مش موجود، اعمله الأول!", ephemeral: true });
          db.addManhwaTerm(mName, eng, arb);
          return interaction.reply({ content: `✅ تم إضافة المصطلح بنجاح في قاموس **${mName}**.` });
        }

        if (mSub === "عرض-مصطلحات") {
          const mName = interaction.options.getString("المانهوا");
          if (mName) {
            const dict = db.getManhwaDict(mName);
            if (!dict || Object.keys(dict).length === 0) return interaction.reply({ content: "❌ مش موجود القاموس ده!", ephemeral: true });
            let txt = `📖 **مصطلحات مانهوا [ ${mName} ]:**\n`;
            Object.keys(dict).forEach(k => { if (k !== "_init") txt += `• \`${k}\` ➡️ \`${dict[k]}\` \n`; });
            return interaction.reply({ content: txt });
          } else {
            const allDicts = db.getAllManhwaDicts();
            const dictNames = Object.keys(allDicts).filter(k => Object.keys(allDicts[k]).length > 1);
            return interaction.reply({ content: `📂 **القواامس المتوفرة:** ${dictNames.join(", ") || "مفيش"}` });
          }
        }
      }

      if (cmd === "مسح") {
        if (isFromDM) {
          return interaction.reply({ content: "⚡ عشان تمسح رسايل من الـ DM، قول للـ AI جوه الشات:\n**\"امسح X رسالة من قناة [اسم القناة]\"** 🤖", ephemeral: true });
        }
        const num = interaction.options.getInteger("عدد");
        await interaction.deferReply({ ephemeral: true });
        try {
          // تأكد إن البوت عنده صلاحية ManageMessages في القناة دي
          const botMember = interaction.guild?.members?.me;
          if (botMember && !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.editReply({ content: "❌ البوت مش عنده صلاحية **Manage Messages** في القناة دي!" });
          }
          let remaining = num;
          let totalDeleted = 0;
          while (remaining > 0) {
            const batch = Math.min(remaining, 100);
            const deleted = await channel.bulkDelete(batch, true);
            totalDeleted += deleted.size;
            remaining -= batch;
            if (deleted.size < batch) break;
          }
          if (totalDeleted === 0) {
            return interaction.editReply({ content: "⚠️ مفيش رسايل اتمسحت — ممكن كل الرسايل أقدم من 14 يوم أو القناة فاضية!" });
          }
          sendModLog("clear", interaction.user, null, `مسح ${totalDeleted} رسالة`, { count: totalDeleted, channel: channel.id }).catch(() => {});
          return interaction.editReply({ content: `🧹 تم تنظيف الروم ومسح **${totalDeleted}** رسالة!` });
        } catch (err) {
          logger.error("خطأ في أمر /مسح:", err);
          const errMsg = err?.code === 50013
            ? "❌ البوت مش عنده صلاحية **Manage Messages** في القناة دي!"
            : err?.code === 50034
            ? "❌ مينفعش تمسح رسايل أقدم من 14 يوم بالـ BulkDelete!"
            : `❌ فشل المسح: ${err?.message || "خطأ غير معروف"}`;
          return interaction.editReply({ content: errMsg });
        }
      }

      if (cmd === "مسح-الكل") {
        if (isFromDM) {
          return interaction.reply({ content: "⚡ عشان تمسح روم بالكامل من الـ DM، قول للـ AI:\n**\"امسح قناة [اسم القناة] بالكامل\"** 🤖", ephemeral: true });
        }
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`wipe_confirm|${channel.id}`)
            .setLabel("✅ نعم، امسح كل حاجة")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("wipe_cancel")
            .setLabel("❌ إلغاء")
            .setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("⚠️ تأكيد مسح الروم بالكامل")
              .setDescription(`هتمسح **كل** رسايل الروم ${channel} بما فيها اللي فوق 14 يوم!\n\nمتقدرش ترجعها، متأكد؟`)
          ],
          components: [confirmRow],
          ephemeral: true
        });
      }

      // ─── تعديل إعلان (2-Step: اعرض المحتوى → زر → موداال ممليء) ──
      if (cmd === "تعديل-إعلان") {
        if (!isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const msgId   = interaction.options.getString("message_id")?.trim();
          const pos     = interaction.options.getInteger("موضع") ?? 1;
          const annCh   = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

          let targetMsg = null;
          if (msgId) {
            targetMsg = await annCh.messages.fetch(msgId).catch(() => null);
            if (!targetMsg) return interaction.editReply({ content: "❌ مش لاقي الرسالة دي! تأكد إن الـ ID صح." });
          } else {
            const fetched = await annCh.messages.fetch({ limit: 50 });
            const botMsgs = [...fetched.values()].filter(m => m.author.id === client.user.id);
            targetMsg = botMsgs[pos - 1] ?? null;
            if (!targetMsg) return interaction.editReply({ content: `❌ مش لاقي رسالة رقم **${pos}** من الأخر للبوت في روم الإعلانات!` });
          }

          if (targetMsg.author.id !== client.user.id)
            return interaction.editReply({ content: "❌ الرسالة دي مش بتاعت البوت!" });

          const preview = (targetMsg.content || "— الرسالة فيها Embed بس —").slice(0, 800);
          pendingAnnounceEdits.set(targetMsg.id, { content: targetMsg.content || "", channelId: ANNOUNCE_CHANNEL_ID });
          setTimeout(() => pendingAnnounceEdits.delete(targetMsg.id), 600_000);

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("✏️ تعديل الإعلان — الخطوة الأولى")
                .setDescription(`**الرسالة الحالية:**\n\`\`\`\n${preview}\n\`\`\``)
                .setFooter({ text: `ID: ${targetMsg.id}` })
                .setTimestamp()
            ],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`edit_announce_btn|${targetMsg.id}`)
                .setLabel("✏️ افتح المحرر")
                .setStyle(ButtonStyle.Primary)
            )]
          });
        } catch (err) {
          logger.error("خطأ في تعديل-إعلان:", err);
          return interaction.editReply({ content: `❌ حصل خطأ: ${err.message}` });
        }
      }

      // ─── إنشاء رول بصلاحيات ذكية ────────────────────────────────
      // ✅ دمج: /رتبة انشاء|تعديل
      if (cmd === "رتبة") {
        const roleSub = interaction.options.getSubcommand();

        if (roleSub === "انشاء") {
          await interaction.deferReply({ ephemeral: true });
          const roleName  = interaction.options.getString("الاسم");
          const roleType  = interaction.options.getString("نوع");
          const roleColor = interaction.options.getString("لون");
          const roleHoist = interaction.options.getBoolean("ظهور-منفصل");

          const preset  = roleType ? ROLE_PRESETS[roleType] : smartRolePerms(roleName);
          const color   = roleColor ? parseRoleColor(roleColor) : (preset?.color ?? 0x99aab5);
          const hoist   = roleHoist !== null ? roleHoist : (preset?.hoist ?? false);
          const perms   = preset?.permissions ?? [];

          try {
            const newRole = await guild.roles.create({ name: roleName, color, hoist, reason: `بأمر ${user.username}` });
            if (perms.length) {
              const valid = perms.filter(p => PermissionFlagsBits[p]);
              if (valid.length) await newRole.setPermissions(valid.map(p => PermissionFlagsBits[p]));
            }
            const presetLabel = preset?.label ?? "تلقائي";
            return interaction.editReply({ embeds: [
              new EmbedBuilder().setColor(color)
                .setTitle("✨ تم إنشاء الرتبة")
                .addFields(
                  { name: "🏷️ الاسم",       value: newRole.name,                                                  inline: true },
                  { name: "🆔 الـ ID",       value: `\`${newRole.id}\``,                                          inline: true },
                  { name: "📌 النوع",        value: presetLabel,                                                   inline: true },
                  { name: "📌 ظهور منفصل",   value: hoist ? "✅" : "❌",                                          inline: true },
                  { name: "🔐 الصلاحيات",   value: perms.length ? `\`${perms.join(", ")}\`` : "لا صلاحيات",      inline: false },
                ).setTimestamp()
            ]});
          } catch (err) {
            logger.error("خطأ في إنشاء الرول:", err);
            return interaction.editReply({ content: `❌ حصل خطأ: ${err.message}` });
          }
        }

        if (roleSub === "تعديل") {
          await interaction.deferReply({ ephemeral: true });
          const targetRole = interaction.options.getRole("الرول");
          const roleType   = interaction.options.getString("نوع");
          const newName    = interaction.options.getString("اسم");
          const newColor   = interaction.options.getString("لون");

          try {
            let role = guild.roles.cache.get(targetRole.id);
            if (!role) role = await guild.roles.fetch(targetRole.id).catch(() => null);
            if (!role) return interaction.editReply({ content: "❌ مش لاقي الرول — تأكد إنه موجود!" });

            const changes = [];
            const editData = {};

            if (roleType) {
              const preset = ROLE_PRESETS[roleType];
              if (!preset) return interaction.editReply({ content: "❌ نوع غير معروف!" });
              const valid = preset.permissions.filter(p => PermissionFlagsBits[p]);
              editData.permissions = valid.map(p => PermissionFlagsBits[p]);
              changes.push({ name: "🔐 الصلاحيات", value: preset.permissions.length ? `\`${preset.permissions.join(", ")}\`` : "لا صلاحيات", inline: false });
              changes.push({ name: "📋 النوع", value: preset.label, inline: true });
            }

            if (newName) {
              editData.name = newName;
              changes.push({ name: "🏷️ الاسم الجديد", value: newName, inline: true });
            }

            if (newColor) {
              const parsedColor = parseRoleColor(newColor);
              if (parsedColor === null) return interaction.editReply({ content: `❌ اللون **${newColor}** مش صح — استخدم hex مثل #FF5733 أو اسم إنجليزي مثل red` });
              editData.color = parsedColor;
              changes.push({ name: "🎨 اللون", value: newColor, inline: true });
            }

            if (!roleType && !newName && !newColor) {
              return interaction.editReply({ content: "❌ لازم تحدد نوع أو اسم أو لون على الأقل!" });
            }

            await role.edit({ ...editData, reason: `بأمر ${user.username}` });

            return interaction.editReply({ embeds: [
              new EmbedBuilder().setColor(editData.color ?? 0x9b59b6)
                .setTitle("✅ تم تعديل الرتبة")
                .addFields(
                  { name: "🏷️ الرتبة", value: role.name, inline: true },
                  { name: "🆔 الـ ID", value: `\`${role.id}\``, inline: true },
                  ...changes
                ).setTimestamp()
            ]});
          } catch (err) {
            logger.error("خطأ في تعديل الرول:", err);
            return interaction.editReply({ content: `❌ حصل خطأ: ${err.message}` });
          }
        }
      }

      // ✅ دمج: /عقوبة تحذير|اسكات|طرد|تبنيد|عرض — كل واحدة بفحص صلاحية خاص بيها
      //   (شلنا setDefaultMemberPermissions من الأمر نفسه لأن كل subcommand كانت
      //   بصلاحية مختلفة (ModerateMembers/KickMembers/BanMembers)، ومحتاجين فحص
      //   دقيق بدل صلاحية موحّدة قد تحجب أو تفتح زيادة عن المطلوب)
      if (cmd === "عقوبة") {
        const modSub = interaction.options.getSubcommand();

        if (modSub === "تحذير" || modSub === "اسكات") {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: "❌ محتاج صلاحية Moderate Members عشان تستخدم الأمر ده!", ephemeral: true });
          }
        }
        if (modSub === "طرد") {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: "❌ محتاج صلاحية Kick Members عشان تستخدم الأمر ده!", ephemeral: true });
          }
        }
        if (modSub === "تبنيد") {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: "❌ محتاج صلاحية Ban Members عشان تستخدم الأمر ده!", ephemeral: true });
          }
        }

        if (modSub === "تحذير") {
          const targetUser = interaction.options.getUser("عضو");
          if (!targetUser) return interaction.reply({ content: "❌ لازم تختار عضو!", ephemeral: true });
          const target = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!target) return interaction.reply({ content: `❌ العضو <@${targetUser.id}> مش في السيرفر ده!`, ephemeral: true });
          const reason = interaction.options.getString("السبب");
          const actionId = `modwarn_${Date.now()}_${user.id}`;
          pendingModActions.set(actionId, { type: "warn", targetId: target.id, reason, modId: user.id, guildId: guild.id });
          setTimeout(() => pendingModActions.delete(actionId), 90_000);
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle("⚠️ تأكيد التحذير")
              .setDescription(`هتحذّر <@${target.id}>؟\n📋 **السبب:** ${reason}`)
              .setFooter({ text: "الإجراء ده هينتهي بعد دقيقة ونص لو ما اتأكدش" }).setTimestamp()],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`modyes_${actionId}`).setLabel("✅ طبّق التحذير").setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`modno_${actionId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary),
            )],
            ephemeral: true,
          });
        }

        if (modSub === "اسكات") {
          const targetUser = interaction.options.getUser("عضو");
          if (!targetUser) return interaction.reply({ content: "❌ لازم تختار عضو!", ephemeral: true });
          const target = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!target) return interaction.reply({ content: `❌ العضو <@${targetUser.id}> مش في السيرفر ده!`, ephemeral: true });
          const dur = interaction.options.getInteger("مدة");
          const reason = interaction.options.getString("السبب") ?? "غير محدد";
          const actionId = `modmute_${Date.now()}_${user.id}`;
          pendingModActions.set(actionId, { type: "mute", targetId: target.id, reason, duration: dur, modId: user.id, guildId: guild.id });
          setTimeout(() => pendingModActions.delete(actionId), 90_000);
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("🔇 تأكيد الإسكات")
              .setDescription(`هتسكّت <@${target.id}> لمدة **${dur} دقيقة**؟\n📋 **السبب:** ${reason}`)
              .setFooter({ text: "الإجراء ده هينتهي بعد دقيقة ونص لو ما اتأكدش" }).setTimestamp()],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`modyes_${actionId}`).setLabel("✅ طبّق الإسكات").setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`modno_${actionId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary),
            )],
            ephemeral: true,
          });
        }

        if (modSub === "طرد") {
          const targetUser = interaction.options.getUser("عضو");
          if (!targetUser) return interaction.reply({ content: "❌ لازم تختار عضو!", ephemeral: true });
          const target = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!target) return interaction.reply({ content: `❌ العضو <@${targetUser.id}> مش في السيرفر ده!`, ephemeral: true });
          const reason = interaction.options.getString("السبب") ?? "غير محدد";
          const actionId = `modkick_${Date.now()}_${user.id}`;
          pendingModActions.set(actionId, { type: "kick", targetId: target.id, reason, modId: user.id, guildId: guild.id });
          setTimeout(() => pendingModActions.delete(actionId), 90_000);
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("👢 تأكيد الطرد")
              .setDescription(`هتطرد <@${target.id}> من السيرفر؟\n📋 **السبب:** ${reason}`)
              .setFooter({ text: "الإجراء ده هينتهي بعد دقيقة ونص لو ما اتأكدش" }).setTimestamp()],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`modyes_${actionId}`).setLabel("✅ طبّق الطرد").setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`modno_${actionId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary),
            )],
            ephemeral: true,
          });
        }

        if (modSub === "تبنيد") {
          const targetUser = interaction.options.getUser("عضو");
          if (!targetUser) return interaction.reply({ content: "❌ لازم تختار عضو!", ephemeral: true });
          const target = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!target) return interaction.reply({ content: `❌ العضو <@${targetUser.id}> مش في السيرفر ده!`, ephemeral: true });
          const reason = interaction.options.getString("السبب") ?? "غير محدد";
          const actionId = `modban_${Date.now()}_${user.id}`;
          pendingModActions.set(actionId, { type: "ban", targetId: target.id, reason, modId: user.id, guildId: guild.id });
          setTimeout(() => pendingModActions.delete(actionId), 90_000);
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xc0392b).setTitle("🔨 تأكيد التبنيد")
              .setDescription(`هتبند <@${target.id}> من السيرفر نهائياً؟\n📋 **السبب:** ${reason}`)
              .setFooter({ text: "الإجراء ده هينتهي بعد دقيقة ونص لو ما اتأكدش" }).setTimestamp()],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`modyes_${actionId}`).setLabel("✅ طبّق التبنيد").setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`modno_${actionId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary),
            )],
            ephemeral: true,
          });
        }

        if (modSub === "عرض") {
          const nameOrId = interaction.options.getString("عضو");
          let targetMember = null;
          let targetUser = user;
          if (nameOrId) {
            targetMember = await resolveMember(guild, nameOrId);
            if (!targetMember) return interaction.reply({ content: `❌ ما لقيتش عضو بالاسم أو الـ ID: **${nameOrId}**`, ephemeral: true });
            targetUser = targetMember.user;
          }
          const warns = db.getWarnings(targetUser.id);
          if (warns.length === 0) {
            return interaction.reply({
              embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("😇 سجل أبيض!")
                .setDescription(`<@${targetUser.id}> ما عندهوش أي تحذيرات 🌟`)
                .setThumbnail(targetUser.displayAvatarURL())],
              ephemeral: true,
            });
          }
          const warnFields = warns.slice(-10).reverse().map((w, i) => ({
            name: `⚠️ تحذير #${warns.length - i}`,
            value: `📋 **السبب:** ${w.reason ?? "غير محدد"}\n🛡️ **المشرف:** <@${w.modId ?? "مجهول"}>\n📅 **التاريخ:** <t:${Math.floor((w.timestamp ?? Date.now()) / 1000)}:R>`,
            inline: false,
          }));
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle(`⚠️ تحذيرات ${targetUser.username} (${warns.length})`)
              .addFields(warnFields).setThumbnail(targetUser.displayAvatarURL()).setTimestamp()],
            ephemeral: true,
          });
        }
      }

      if (cmd === "مساعدة") {
        return interaction.reply({ content: "🤖 **جميع الأوامر بتشتغل بـ السلاش (`/`):**\nعامة: `ping`, `hello`, `serverinfo`\nنظام مالي: `/اقتصاد` (بروفايل, محفظة, يومي...)\nليدربورد: `ليدربورد`\nميوزك: `/موسيقى` (تشغيل, إيقاف, تخطي...)\n🎁 متقدم: `clean_chapter`, `translate_chapter`\n🧹 تنظيف سريع: `تنظيف_صورة`, `تنظيف_رابط`, `استخراج_نص`" });
      }

      if (cmd === "ليدربورد") {
        const type = interaction.options.getString("نوع") ?? "coins";
        const allUsers = db.getAllData().users;
        const sorted = Object.entries(allUsers).sort((a, b) => b[1][type] - a[1][type]).slice(0, 10);
        let txt = `🏆 **قائمة الترتيب الأعلى (حسب ${type}):**\n`;
        sorted.forEach(([id, data], i) => txt += `**#${i+1}** <@${id}> ⬅️ ${data[type]}\n`);
        return interaction.reply({ content: txt });
      }

      if (cmd === "ترحيب-قناة") {
        const ch = interaction.options.getChannel("القناة");
        db.setWelcomeChannel(guild.id, ch.id);
        return interaction.reply({ content: `✅ تم تعيين قناة الترحيب لتكون: ${ch}` });
      }

      if (cmd === "اقتراح") {
        const text = interaction.options.getString("نص");
        return await handleSuggestionModalSubmit(interaction, text);
      }

      if (cmd === "لوحة-إدارة") {
        const embed = new EmbedBuilder().setColor(0x2c3e50).setTitle("🔒 لوحة التحكم").setDescription(`أعضاء السيرفر: ${guild.memberCount}`);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("admin_clear_games").setLabel("🎮 تصفير الألعاب").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("refresh_suggestions_board").setLabel("🔄 تحديث لوحة الاقتراحات").setStyle(ButtonStyle.Primary)
        );
        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (cmd === "لوحة-اقتراحات") {
        try {
          const posted = await ensureSuggestionsPanel(client, true);
          if (!posted) {
            return interaction.reply({
              content: "❌ لم أجد روم الاقتراحات! تأكد من صحة معرف القناة.",
              ephemeral: true,
            });
          }
          return interaction.reply({
            content: "✅ تم إرسال لوحة الاقتراحات بنجاح في روم الاقتراحات!",
            ephemeral: true,
          });
        } catch (err) {
          logger.error("خطأ في إرسال لوحة الاقتراحات:", err);
          return interaction.reply({
            content: "معلش يسطا ثواني بس",
            ephemeral: true,
          });
        }
      }

      if (cmd === "صورة") {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ ميزة غير متاحة")
            .setDescription("توليد الصور بالذكاء الاصطناعي غير متاح حالياً.\nهذه الميزة تحتاج نموذج Gemini متخصص لتوليد الصور وهو غير مفعّل في هذا البوت.")
            .setFooter({ text: "استخدم /زنجي لطلب أي حاجة تانية 😊" })],
          ephemeral: true
        });
      }

      if (cmd === "نسخة-احتياطية") {
        await interaction.deferReply({ ephemeral: true });
        try {
          const allData = db.getAllData();
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
          const jsonBuffer = Buffer.from(JSON.stringify(allData, null, 2), "utf-8");
          const attachment = new AttachmentBuilder(jsonBuffer, { name: `backup_${dateStr}.json` });
          const userCount = Object.keys(allData.users || {}).length;
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("💾 نسخة احتياطية جاهزة")
                .addFields(
                  { name: "📅 التاريخ", value: dateStr, inline: true },
                  { name: "👥 عدد الأعضاء المحفوظين", value: `${userCount}`, inline: true }
                )
                .setFooter({ text: "احتفظ بالملف في مكان آمن ✅" })
                .setTimestamp()
            ],
            files: [attachment]
          });
        } catch (err) {
          logger.error("خطأ في النسخة الاحتياطية:", err);
          return interaction.editReply({ content: "معلش يسطا ثواني بس" });
        }
      }

      if (cmd === "استرجاع") {
        await interaction.deferReply({ ephemeral: true });
        try {
          const attachment = interaction.options.getAttachment("ملف");
          if (!attachment.name.endsWith(".json")) {
            return interaction.editReply({ content: "❌ الملف لازم يكون `.json` — ارفع الملف اللي حملته من أمر `/نسخة-احتياطية`" });
          }
          const response = await fetch(attachment.url);
          const text = await response.text();
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            return interaction.editReply({ content: "❌ الملف تالف أو مش JSON صح!" });
          }
          if (!parsed.users) {
            return interaction.editReply({ content: "❌ الملف ده مش نسخة احتياطية صحيحة — مفيش بيانات أعضاء فيه!" });
          }
          const oldCount = Object.keys(db.getAllData().users || {}).length;
          db.data = parsed;
          db.save();
          const newCount = Object.keys(parsed.users || {}).length;
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("✅ تم الاسترجاع بنجاح")
                .setDescription(`تم استبدال بيانات السيرفر بالنسخة الاحتياطية المرفوعة.`)
                .addFields(
                  { name: "👥 أعضاء قبل", value: `${oldCount}`, inline: true },
                  { name: "👥 أعضاء بعد", value: `${newCount}`, inline: true },
                  { name: "👤 نفّذ العملية", value: `${user}`, inline: false }
                )
                .setFooter({ text: "⚠️ البيانات القديمة اتاستبدلت نهائياً" })
                .setTimestamp()
            ]
          });
        } catch (err) {
          logger.error("خطأ في الاسترجاع:", err);
          return interaction.editReply({ content: "معلش يسطا ثواني بس" });
        }
      }

      if (cmd === "تشغيل-اختبار") {
        const type = interaction.options.getString("نوع");
        const WELCOME_CHANNEL_ID = "1486100560494203183";
        const testChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!testChannel) return interaction.reply({ content: "❌ مش لاقي قناة الترحيب!", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        if (type === "welcome") {
          const imagePath = path.join(__dirname, 'welcome.png');
          const attachment = new AttachmentBuilder(imagePath, { name: 'welcome.png' });
          const embed = new EmbedBuilder()
            .setColor('#A020F0')
            .setTitle('⚜️ 『 بـسـم الله الـرحـمـن الـرحـيـم 』 ⚜️')
            .setDescription(
              `🦅 **أهلاً بك في عرش الفراعنة العظيم** 🏛️\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `✨ **لقد أشرقت الأنوار وانضم إلينا كاتب تاريخ جديد!**\n` +
              `👤 **الـعـضـو الـجـديـد:** ${user}\n` +
              `🆔 **الـمـعـرّف الـخـاص:** \`${user.id}\`\n` +
              `📊 **أنـت الـفـرعـون رقـم:** \`${guild.memberCount}\` في مملكتنا!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔥 **نتمنى لك قضاء وقت أسطوري مليء بالحماس والذكريات الجبارة. طير على الرومات وتفاعل مع بقية الفراعنة وفجّر المكان بوجودك!** 👑`
            )
            .setImage('attachment://welcome.png')
            .setFooter({ text: '🔱 طاقم الإدارة يرحب بك ويتمنى لك رحلة سعيدة ⚜️ [اختبار]' })
            .setTimestamp();
          await testChannel.send({ embeds: [embed], files: [attachment] });
        } else {
          const embed = new EmbedBuilder()
            .setColor('#A020F0')
            .setTitle('🥀 فرعون جديد سابنا ومشي 🥀')
            .setDescription(
              `🦅 العرش مش هوه هوه من غيرك! 🏛️\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 **الفرعون اللي ودعنا:** ${user}\n` +
              `🚶‍♂️ قرر يكمل رحلته بعيد عننا.\n` +
              `📊 **بقينا** \`${guild.memberCount}\` **فرعون في المملكة.**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔥 نورتنا في وقتك معانا، ومش هننساك. الباب دايماً مفتوح لأي فرعون أصيل يرجع لأهله في أي وقت. في رعاية الله! 👑`
            )
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: '🔱 عيلة الفراعنة بتتمنى لك كل خير يا بطل ⚜️ [اختبار]' })
            .setTimestamp();
          await testChannel.send({ embeds: [embed] });
        }

        return interaction.editReply({ content: `✅ تم إرسال رسالة الاختبار في ${testChannel} بنجاح!` });
      }

      if (cmd === "قناة-اللوجز") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        const ch = interaction.options.getChannel("قناة");
        if (!db.data.settings) db.data.settings = {};
        db.data.settings.ownerLogsChannelId = ch.id;
        db.save();
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle("📋 تم تعيين قناة اللوجز")
              .setDescription(`كل أوامر الأونر هتتسجل في ${ch} من دلوقتي ✅`)
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      if (cmd === "رسالة-جماعية") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const نوع = interaction.options.getString("نوع");
        const نص = interaction.options.getString("نص");

        const embed = new EmbedBuilder()
          .setColor(0xa020f0)
          .setTitle("📣 رسالة من الإدارة")
          .setDescription(نص)
          .setFooter({ text: `⚜️ سيرفر الفراعنة — ${guild.name}` })
          .setTimestamp();

        if (نوع === "channel") {
          const targetChannel = interaction.options.getChannel("قناة");
          if (!targetChannel) {
            return interaction.editReply({ content: "❌ حدد القناة اللي هتبعت فيها الرسالة!" });
          }
          await targetChannel.send({ embeds: [embed] });
          return interaction.editReply({ content: `✅ اتبعتت الرسالة في ${targetChannel} بنجاح!` });
        }

        if (نوع === "dm") {
          // رد فوري عشان التفاعل ميتقفلش
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xa020f0)
                .setTitle("📤 بدأ الإرسال في الخلفية")
                .setDescription("البوت بيبعت الرسائل دلوقتي\nهيبعتلك **DM** لما يخلص بالنتيجة 📬")
                .setTimestamp()
            ]
          });

          // شغّل الإرسال في الخلفية بدون await
          (async () => {
            try {
              await guild.members.fetch();
            } catch {}
            const members = [...guild.members.cache.filter(m => !m.user.bot).values()];
            let sent = 0;
            const failedMembers = [];
            const total = members.length;

            for (let i = 0; i < members.length; i++) {
              const member = members[i];
              try {
                await member.send({ embeds: [embed] });
                sent++;
              } catch (dmErr) {
                if (dmErr?.status === 429 || dmErr?.code === 429) {
                  const retryAfter = (dmErr?.rawError?.retry_after || 5) * 1000;
                  await new Promise(r => setTimeout(r, retryAfter));
                  try { await member.send({ embeds: [embed] }); sent++; }
                  catch { failedMembers.push(member); }
                } else {
                  failedMembers.push(member);
                }
              }
              await new Promise(r => setTimeout(r, 100));
            }

            // لما يخلص ابعت DM للأونر بالنتيجة
            try {
              const owner = await client.users.fetch(user.id);
              const resultEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("✅ اتخلصت الرسالة الجماعية")
                .addFields(
                  { name: "📩 وصلت لـ", value: `${sent} عضو`, inline: true },
                  { name: "❌ فشلت مع", value: `${failedMembers.length} عضو`, inline: true },
                  { name: "👥 الإجمالي", value: `${total} عضو`, inline: true }
                )
                .setTimestamp();

              if (failedMembers.length > 0) {
                // اعرض أسماء اللي فشلوا (أقصى 20 اسم عشان ما يطولش الرسالة)
                const namesList = failedMembers.slice(0, 20)
                  .map(m => `• ${m.user.username} (\`${m.id}\`)`)
                  .join("\n");
                const extra = failedMembers.length > 20 ? `\n... و${failedMembers.length - 20} تاني` : "";
                resultEmbed.addFields({
                  name: "🔒 اللي ما وصلتلهمش (خصوصية مغلقة)",
                  value: namesList + extra
                });
                resultEmbed.setFooter({ text: "دول قافلين الرسائل الخاصة من أعضاء السيرفر" });
              } else {
                resultEmbed.setFooter({ text: "🎉 وصلت لكل الأعضاء بنجاح!" });
              }

              await owner.send({ embeds: [resultEmbed] });
            } catch {}
          })();

          return;
        }
      }

      if (cmd === "قناة-النسخ") {
        const channelId = interaction.options.getString("id").trim();
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (!ch) {
          return interaction.reply({ content: `❌ مش لاقي قناة بالـ ID ده: \`${channelId}\`\nتأكد من الـ ID وإن البوت عنده صلاحية يشوف القناة دي.`, ephemeral: true });
        }
        if (!db.data.settings) db.data.settings = {};
        db.data.settings.backupChannelId = ch.id;
        db.save();
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("✅ تم تعيين قناة النسخ الاحتياطية")
              .setDescription(`البوت هيبعت نسخة احتياطية يومية تلقائية لـ <#${ch.id}> كل 24 ساعة 🔄`)
              .addFields({ name: "📋 الـ ID المحفوظ", value: `\`${ch.id}\``, inline: true })
              .setFooter({ text: "يمكنك تغيير القناة في أي وقت بتكرار الأمر" })
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      if (cmd === "لوحة-dm") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        const g = guild || client.guilds.cache.first();
        const panel = buildDMControlPanel(g);
        if (isFromDM) {
          return interaction.reply(panel);
        }
        return interaction.reply({ ...panel, ephemeral: true });
      }

      // ── RPG Commands ───────────────────────────────────────────────
      if (cmd === "كلاسي")        return await handleClass(interaction);
      if (cmd === "بروفايل-rpg")  return await handleProfile(interaction);
      if (cmd === "الانجازات")    return await handleAchievements(interaction);
      if (cmd === "الالقاب")      return await handleTitles(interaction);

      if (cmd === "ملخص-السيرفر") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        await interaction.deferReply();
        const summary = await generateSummary(geminiModel(), "الفترة الأخيرة", 7 * 24 * 60 * 60 * 1000, client, guild?.id);
        if (!summary) return interaction.editReply({ content: "📊 مفيش بيانات كافية دلوقتي." });
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x66FCF1).setTitle("📊 ملخص السيرفر").setDescription(summary).setTimestamp()],
        });
      }

    } catch (err) {
      logger.error("خطأ في تنفيذ الأمر:", err);
      return interaction.reply({ content: "معلش يسطا ثواني بس", ephemeral: true }).catch(() => {});
    }
  }

  // التعامل مع الأزرار والمودال التفاعلية
  if (interaction.isButton()) {
    try {

      // ─── أزرار التحكم في الموسيقى ────────────────────────────────
      if (interaction.customId.startsWith("music_")) {
        const id = interaction.customId;
        if (id === "music_prev")       return await handlePrevious(interaction);
        if (id === "music_pause")      return await handlePause(interaction);
        if (id === "music_resume")     return await handleResume(interaction);
        if (id === "music_skip")       return await handleSkip(interaction);
        if (id === "music_stop")       return await handleStop(interaction);
        if (id === "music_nowplaying") return await handleNowPlaying(interaction);
        if (id === "music_repeat")     return await handleRepeat(interaction);
        if (id === "music_lyrics")     return await handleLyrics(interaction);
        if (id === "music_vol_up" || id === "music_vol_down") {
          const q = musicHandler.getQueue(interaction.guildId);
          if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
          const next = id === "music_vol_up" ? Math.min(q.volume + 10, 100) : Math.max(q.volume - 10, 0);
          await musicHandler.setVolume(interaction.guildId, next / 100);
          return interaction.reply({ content: `🔊 الصوت: **${next}%**`, ephemeral: true });
        }
        return;
      }

      // ─── أزرار إيمبد Builder ─────────────────────────────────────
      if (interaction.customId.startsWith("embed_send_") || interaction.customId.startsWith("embed_cancel_")) {
        const isCancel = interaction.customId.startsWith("embed_cancel_");
        const embedId  = interaction.customId.replace("embed_send_", "").replace("embed_cancel_", "");
        const draft    = autoModLogs.get(`embed_${embedId}`);

        if (isCancel) {
          autoModLogs.delete(`embed_${embedId}`);
          return interaction.update({ content: "❌ تم إلغاء الإيمبد.", embeds: [], components: [] });
        }

        if (!draft) return interaction.update({ content: "❌ انتهت صلاحية الإيمبد!", embeds: [], components: [] });

        // ─── بناء الإيمبد من الـ draft المحفوظ ──────────────────
        const e = new EmbedBuilder().setColor(draft.color);
        if (draft.title)         e.setTitle(draft.title);
        if (draft.titleUrl && draft.title) e.setURL(draft.titleUrl);
        if (draft.description)   e.setDescription(draft.description);
        if (draft.image)         e.setImage(draft.image);
        if (draft.thumbnail)     e.setThumbnail(draft.thumbnail);
        if (draft.showTimestamp) e.setTimestamp();
        if (draft.authorName)    e.setAuthor({ name: draft.authorName, iconURL: draft.authorIcon || undefined, url: draft.authorUrl || undefined });
        if (draft.footerText)    e.setFooter({ text: draft.footerText, iconURL: draft.footerIcon || undefined });
        if (draft.fields?.length > 0) e.addFields(draft.fields);

        try {
          const targetCh = await client.channels.fetch(draft.channelId).catch(() => null);
          if (!targetCh) return interaction.update({ content: "❌ مش لاقي القناة!", embeds: [], components: [] });
          await targetCh.send({ embeds: [e] });
          autoModLogs.delete(`embed_${embedId}`);
          return interaction.update({
            content: `✅ **الإيمبد اتبعتت بنجاح في <#${draft.channelId}>!**`,
            embeds: [],
            components: [],
          });
        } catch (err) {
          return interaction.update({ content: `❌ فشل الإرسال: ${err.message}`, embeds: [], components: [] });
        }
      }

      // ─── أزرار الألعاب الكلاسيكية ────────────────────────────────
      if (interaction.customId.startsWith("rlt_") ||
          interaction.customId.startsWith("maf_") ||
          interaction.customId.startsWith("ttt_")) {
        return await handleGameButton(interaction, db);
      }

      // ─── أزرار متجر القدرات ──────────────────────────────────────
      if (interaction.customId.startsWith("gshop_")) {
        return await handleShopButton(interaction, db);
      }

      // ─── أزرار كود نيمز ──────────────────────────────────────────
      if (interaction.customId.startsWith("cdn_")) {
        return await handleCodenamesButton(interaction);
      }

      // ─── أزرار الاستفتاء ──────────────────────────────────────────
      if (interaction.customId.startsWith("poll_")) {
        return await handlePollButton(interaction);
      }

      // ─── أزرار المسابقة ───────────────────────────────────────────
      if (interaction.customId.startsWith("quiz_")) {
        return await handleQuizButton(interaction, db);
      }

      // ─── أزرار التحدي اليومي ──────────────────────────────────────
      if (interaction.customId.startsWith("daily_")) {
        return await handleDailyChallengeButton(interaction);
      }

      // ─── أزرار الهاتف المكسور ─────────────────────────────────────
      if (interaction.customId.startsWith("gar_")) {
        return await handleGarticButton(interaction);
      }

      // ─── أزرار ميم جيم ───────────────────────────────────────────
      if (interaction.customId.startsWith("meme_")) {
        return await handleMemeButton(interaction, db);
      }

      // ─── أزرار حجر ورقة مقص العادية ─────────────────────────────
      if (interaction.customId.startsWith("rpsb_")) {
        return await handleRPSBasicButton(interaction);
      }

      // ─── أزرار حجر ورقة مقص الخارقة (accept/decline/open) ──────
      if (interaction.customId.startsWith("rps_")) {
        return await handleRPSButton(interaction);
      }

      // ─── أزرار الحياة ────────────────────────────────────────────
      if (interaction.customId.startsWith("life_")) {
        return await handleBankLifeButton(interaction, db);
      }

      // ─── أزرار بنك الحظ ──────────────────────────────────────────
      if (interaction.customId.startsWith("blk_")) {
        return await handleBankLuckButton(interaction, db);
      }

      // ─── أزرار بنك الادخار ───────────────────────────────────────
      if (interaction.customId.startsWith("bsav_")) {
        return await handleBankButton(interaction, db);
      }

      // ─── أزرار بنك الحظ المصري ───────────────────────────────────
      if (interaction.customId.startsWith("bleg_")) {
        return await handleBankLuckEgButton(interaction, db);
      }

      // ─── أزرار نظام الأنمي ────────────────────────────────────────
      if (interaction.customId === "anime_search_btn")    return await handleAnimeSearchBtn(interaction);
      if (interaction.customId === "anime_trending_btn")  return await handleAnimeTrending(interaction);
      if (interaction.customId === "anime_season_btn")    return await handleAnimeSeason(interaction);
      if (interaction.customId === "anime_mylist_btn")    return await handleAnimeMyList(interaction, db);
      if (interaction.customId === "anime_profile_btn")   return await handleAnimeProfile(interaction, db);
      if (interaction.customId === "anime_recommend_btn") return await handleAnimeRecommend(interaction, db);
      if (interaction.customId === "anime_publish_btn")     return await handleAnimePublish(interaction, db);
      if (interaction.customId === "anime_subscribe_btn")  return await handleAnimeSubscribe(interaction, db);

      if (interaction.customId.startsWith("anime_eps_")) {
        const malId = parseInt(interaction.customId.replace("anime_eps_", ""));
        return await handleAnimeEpisodes(interaction, db, malId);
      }
      if (interaction.customId.startsWith("anime_watch_")) {
        const malId = parseInt(interaction.customId.replace("anime_watch_", ""));
        return await handleAnimeEpisodes(interaction, db, malId);
      }
      if (interaction.customId.startsWith("anime_rate_") && !interaction.customId.startsWith("anime_rate_modal_")) {
        const malId = parseInt(interaction.customId.replace("anime_rate_", ""));
        return await handleAnimeRate(interaction, db, malId);
      }
      if (interaction.customId.startsWith("anime_trailer_")) {
        const malId = parseInt(interaction.customId.replace("anime_trailer_", ""));
        return await handleAnimeTrailer(interaction, malId);
      }
      if (interaction.customId.startsWith("anime_list_")) {
        // anime_list_watching_12345  /  anime_list_remove_12345
        const withoutPrefix = interaction.customId.replace("anime_list_", "");
        const lastUnderscore = withoutPrefix.lastIndexOf("_");
        const status = withoutPrefix.slice(0, lastUnderscore);
        const malId  = parseInt(withoutPrefix.slice(lastUnderscore + 1));
        return await handleAnimeListAction(interaction, db, status, malId);
      }

      // ─── أزرار تجديد اللعبة ───────────────────────────────────────
      // ✅ FIX: شلنا "life" من هنا — لعبة الحياة الجديدة (نظام مستمر) مالها
      //   "جلسة" تتجدد أصلاً، البروفايل دايمًا موجود ومستمر
      if (interaction.customId.startsWith("replay_")) {
        const parts = interaction.customId.split("_");
        const game  = parts[1];
        if (game === "rlt")  return await handleRouletteCommand(interaction, db);
        if (game === "maf")  return await handleMafiaCommand(interaction, db);
        if (game === "gar")  return await handleGarticCommand(interaction);
        if (game === "meme") return await handleMemeCommand(interaction);
        if (game === "luck") return await handleBankLuckCommand(interaction);
        if (game === "cdn")  return await handleCodenamesCommand(interaction);
        if (game === "quiz") return await startQuizGame(interaction);
        return interaction.reply({ content: "❌ مش عارف أجدد اللعبة دي!", flags: 64 });
      }

      // ─── أزرار هب الألعاب + احدث المميزات ───────────────────────
      if (interaction.customId.startsWith("ghub_") || interaction.customId.startsWith("ftr_")) {
        const gid = interaction.customId;
        if (gid === "ghub_rlt" || gid === "ftr_rlt")   return await handleRouletteCommand(interaction, db);
        if (gid === "ghub_maf" || gid === "ftr_maf")   return await handleMafiaCommand(interaction, db);
        if (gid === "ghub_ttt")                         return await handleTTTCommand(interaction, db);
        if (gid === "ghub_cdn" || gid === "ftr_cdn")   return await handleCodenamesCommand(interaction);
        if (gid === "ghub_gar" || gid === "ftr_gar")   return await handleGarticCommand(interaction);
        if (gid === "ghub_meme" || gid === "ftr_meme") return await handleMemeCommand(interaction);
        if (gid === "ghub_quiz")                        return await startQuizGame(interaction);
        if (gid === "ghub_rps_easy")                    return await handleRPSBasicCommand(interaction);
        if (gid === "ghub_rps_ai")                      return await handleRPSCommand(interaction);
        if (gid === "ghub_banklife")                    return await handleBankLifeButton(interaction, db);
        if (gid === "ghub_bankluck")                    return await bankLuckEgCommand.execute(interaction, db);
        if (gid === "ghub_cancel") {
          const cid = interaction.channel.id;
          if (channelGames.has(cid))       { channelGames.delete(cid); }
          if (garticChannelMap.has(cid))   { const gId = garticChannelMap.get(cid); garticGames.delete(gId); garticChannelMap.delete(cid); }
          if (memeChannelMap.has(cid))     { const mId = memeChannelMap.get(cid);   memeGames.delete(mId);   memeChannelMap.delete(cid); }
          if (rpsChannelMap.has(cid))      { const rId = rpsChannelMap.get(cid);    rpsGames.delete(rId);    rpsChannelMap.delete(cid); }
          if (rpsBasicChannelMap.has(cid)) { const rId = rpsBasicChannelMap.get(cid); rpsBasicGames.delete(rId); rpsBasicChannelMap.delete(cid); }
          // ✅ FIX: lifeChannelMap/lifeGames اتشالوا — لعبة الحياة الجديدة نظام
          //   مستمر مالوش "جلسة في روم" تتلغى أصلاً
          if (luckChannelMap.has(cid))     { const lId = luckChannelMap.get(cid);   luckGames.delete(lId);   luckChannelMap.delete(cid); }
          if (quizChannelMap.has(cid))     quizChannelMap.delete(cid);
          await interaction.message.delete().catch(() => {});
          return interaction.reply({ content: "✅ تم إلغاء اللعبة الشغالة في الروم ده!", flags: 64 });
        }

        // ✅ إضافة: إقفال كل الألعاب الشغالة في كل الرومات دفعة واحدة [إدارة]
        //   مفيد لو فيه ألعاب عالقة من قبل أو محتاج تنضيف شامل
        if (gid === "ghub_closeall") {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !config.isOwner(interaction.user.id))
            return interaction.reply({ content: "❌ الزرار ده للإدارة بس!", ephemeral: true });
          let count = 0;
          channelGames.forEach((_, cid)    => { channelGames.delete(cid); count++; });
          rouletteGames.forEach((_, gid2)  => { rouletteGames.delete(gid2); });
          mafiaGames.forEach((_, gid2)     => { mafiaGames.delete(gid2); });
          tttGames.forEach((_, gid2)       => { tttGames.delete(gid2); });
          rpsChannelMap.forEach((rId, cid) => { rpsGames.delete(rId); rpsChannelMap.delete(cid); count++; });
          rpsBasicChannelMap.forEach((rId, cid) => { rpsBasicGames.delete(rId); rpsBasicChannelMap.delete(cid); count++; });
          garticChannelMap.forEach((gId, cid)   => { garticGames.delete(gId); garticChannelMap.delete(cid); count++; });
          memeChannelMap.forEach((mId, cid)     => { memeGames.delete(mId);   memeChannelMap.delete(cid); count++; });
          luckChannelMap.forEach((lId, cid)     => { luckGames.delete(lId);   luckChannelMap.delete(cid); count++; });
          quizChannelMap.clear();
          return interaction.reply({ content: `🛑 تم إقفال **${count}** لعبة من كل الرومات!`, ephemeral: true });
        }
      }

      // ─── أزرار تأكيد/إلغاء أوامر التأديب ────────────────────────
      if (interaction.customId.startsWith("modyes_") || interaction.customId.startsWith("modno_")) {
        const isYes    = interaction.customId.startsWith("modyes_");
        const actionId = interaction.customId.replace("modyes_", "").replace("modno_", "");
        const action   = pendingModActions.get(actionId);

        if (!action) {
          return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("⏰ انتهى الوقت").setDescription("انتهت مهلة هذا الإجراء — أعد الأمر مرة تانية.")], components: [] });
        }
        if (interaction.user.id !== action.modId) {
          return interaction.reply({ content: "❌ الزرار ده للشخص اللي نفّذ الأمر بس!", ephemeral: true });
        }

        pendingModActions.delete(actionId);

        if (!isYes) {
          return interaction.update({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ تم الإلغاء").setDescription("تم إلغاء الإجراء التأديبي بنجاح.")], components: [] });
        }

        const modGuild = client.guilds.cache.get(action.guildId);
        if (!modGuild) return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌ خطأ").setDescription("مش لاقي السيرفر!")], components: [] });

        try {
          const modMember = await modGuild.members.fetch(action.targetId).catch(() => null);

          if (action.type === "warn") {
            db.addWarning(action.targetId, action.reason, interaction.user.id);
            const warns = db.getWarnings(action.targetId);
            sendModLog("warn", interaction.user, action.targetId, action.reason, { warns: warns.length }).catch(() => {});
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle("⚠️ تم التحذير").setDescription(`تم توجيه تحذير رسمي لـ <@${action.targetId}>\n📋 **السبب:** ${action.reason}\n⚠️ **إجمالي تحذيراته:** ${warns.length}`).setTimestamp()], components: [] });
          }

          if (!modMember) {
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌ خطأ").setDescription("العضو مش موجود في السيرفر دلوقتي!")], components: [] });
          }

          if (action.type === "mute") {
            await modMember.timeout(action.duration * 60 * 1000, action.reason);
            db.addTimeout(action.targetId, action.duration * 60 * 1000, action.reason);
            sendModLog("mute", interaction.user, action.targetId, action.reason, { duration: action.duration }).catch(() => {});
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("🔇 تم الإسكات").setDescription(`تم إسكات <@${action.targetId}> لمدة **${action.duration} دقيقة**\n📋 **السبب:** ${action.reason}`).setTimestamp()], components: [] });
          }

          if (action.type === "kick") {
            await modMember.kick(action.reason);
            sendModLog("kick", interaction.user, action.targetId, action.reason).catch(() => {});
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("👢 تم الطرد").setDescription(`تم طرد <@${action.targetId}> من السيرفر\n📋 **السبب:** ${action.reason}`).setTimestamp()], components: [] });
          }

          if (action.type === "ban") {
            await modGuild.members.ban(action.targetId, { reason: action.reason });
            db.addBan(action.targetId, action.reason, interaction.user.id);
            sendModLog("ban", interaction.user, action.targetId, action.reason).catch(() => {});
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0xc0392b).setTitle("🔨 تم التبنيد").setDescription(`تم تبنيد <@${action.targetId}> من السيرفر نهائياً\n📋 **السبب:** ${action.reason}`).setTimestamp()], components: [] });
          }
        } catch (err) {
          logger.error("خطأ في تنفيذ إجراء التأديب:", err);
          return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌ فشل الإجراء").setDescription(`حصل خطأ: ${err.message}`)], components: [] });
        }
      }

      // ─── أزرار لوحة تحكم الأونر ──────────────────────────────────
      if (interaction.customId.startsWith("dmp_")) {
        if (!config.isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ اللوحة دي للأونر بس!", ephemeral: true });
        }
        const g = interaction.guild || client.guilds.cache.first();
        if (g) await g.members.fetch().catch(() => {});

        // 📊 إحصائيات السيرفر
        if (interaction.customId === "dmp_stats") {
          const allUsers = db.getAllData().users;
          const totalCoins = Object.values(allUsers).reduce((s, u) => s + (u.coins || 0), 0);
          const topLevel  = Object.values(allUsers).sort((a, b) => b.level - a.level)[0];
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xa020f0)
              .setTitle(`📊 إحصائيات ${g?.name ?? "السيرفر"}`)
              .addFields(
                { name: "👥 الأعضاء",       value: `\`${g?.memberCount ?? "؟"}\``,          inline: true },
                { name: "🪙 إجمالي الكوينز", value: `\`${totalCoins.toLocaleString()}\``,     inline: true },
                { name: "🏅 أعلى مستوى",    value: `\`${topLevel?.level ?? 0}\``,            inline: true },
                { name: "⏱️ الـ Uptime",     value: `\`${Math.floor(process.uptime()/60)} دقيقة\``, inline: true },
                { name: "📡 الـ Ping",       value: `\`${client.ws.ping}ms\``,               inline: true },
                { name: "🤖 الأوامر",        value: `\`${LEGACY_COMMANDS.length + 14} أمر\``, inline: true }
              )
              .setTimestamp()],
            ephemeral: true
          });
        }

        // 🏆 ليدربورد
        if (interaction.customId === "dmp_lb") {
          const allUsers = db.getAllData().users;
          const sorted = Object.entries(allUsers).sort((a, b) => b[1].coins - a[1].coins).slice(0, 5);
          let txt = "🏆 **أفضل 5 أعضاء بالكوينز:**\n";
          sorted.forEach(([id, d], i) => txt += `**#${i+1}** <@${id}> — 🪙 \`${d.coins}\`\n`);
          return interaction.reply({ content: txt, ephemeral: true });
        }

        // 💾 نسخة احتياطية
        if (interaction.customId === "dmp_backup") {
          await interaction.deferReply({ ephemeral: true });
          const allData = db.getAllData();
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
          const buf = Buffer.from(JSON.stringify(allData, null, 2), "utf-8");
          const att = new AttachmentBuilder(buf, { name: `backup_${dateStr}.json` });
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("💾 نسخة احتياطية").setDescription(`✅ ${Object.keys(allData.users||{}).length} عضو محفوظ`).setTimestamp()],
            files: [att]
          });
        }

        // 🎵 قائمة الميوزك
        if (interaction.customId === "dmp_queue") {
          const q = musicHandler?.getQueue?.(g?.id);
          if (!q || !q.songs?.length) return interaction.reply({ content: "🎵 مفيش أغاني في القائمة دلوقتي!", ephemeral: true });
          const txt = q.songs.slice(0, 5).map((s, i) => `**${i+1}.** ${s.title || s.name}`).join("\n");
          return interaction.reply({ content: `🎵 **قائمة التشغيل:**\n${txt}`, ephemeral: true });
        }

        // ⏹️ إيقاف الميوزك
        if (interaction.customId === "dmp_stop") {
          await musicHandler?.stop?.(g?.id).catch(() => {});
          return interaction.reply({ content: "⏹️ تم إيقاف الميوزك!", ephemeral: true });
        }

        // 🔲 موودالات المودريشن
        const modalMap = {
          dmp_warn:  { id: "dmmod_warn",  title: "⚠️ تحذير عضو",  fields: [["اسم العضو أو ID", "dm_user"], ["السبب", "dm_reason"]] },
          dmp_mute:  { id: "dmmod_mute",  title: "🔇 إسكات عضو",  fields: [["اسم العضو أو ID", "dm_user"], ["المدة (دقايق)", "dm_minutes"], ["السبب", "dm_reason"]] },
          dmp_kick:  { id: "dmmod_kick",  title: "👢 طرد عضو",    fields: [["اسم العضو أو ID", "dm_user"], ["السبب", "dm_reason"]] },
          dmp_ban:   { id: "dmmod_ban",   title: "🔨 حظر عضو",   fields: [["اسم العضو أو ID", "dm_user"], ["السبب", "dm_reason"]] },
          dmp_coins: { id: "dmmod_coins", title: "🪙 إعطاء كوينز", fields: [["اسم العضو أو ID", "dm_user"], ["الكمية", "dm_amount"]] },
        };
        const mCfg = modalMap[interaction.customId];
        if (mCfg) {
          const modal = new ModalBuilder().setCustomId(mCfg.id).setTitle(mCfg.title);
          mCfg.fields.forEach(([label, cid]) =>
            modal.addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId(cid).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true)
            ))
          );
          return interaction.showModal(modal);
        }
      }
      // ─────────────────────────────────────────────────────────────

      // ── أزرار Auto-Mod Log Channel ───────────────────────────────
      if (interaction.customId.startsWith("aml_")) {
        if (!config.isOwner(interaction.user.id) && !interaction.member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
          return interaction.reply({ content: "❌ الأزرار دي للمشرفين بس!", ephemeral: true });
        }

        const parts  = interaction.customId.split("_");
        const action = parts[1]; // restore | confirm | warn | mute | kick | ban | unwarn | unmute | unban
        const logId  = parts.slice(2).join("_");
        const ld     = autoModLogs.get(logId);

        // ↩️ رجاع الرسالة
        if (action === "restore") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت أو منتحجتش!", ephemeral: true });
          try {
            const ch = await client.channels.fetch(ld.channelId).catch(() => null);
            if (!ch) return interaction.reply({ content: "❌ مش لاقي القناة!", ephemeral: true });
            await ch.send({
              content: `📨 **رسالة مرجّعة من Auto-Mod** — <@${ld.userId}>:\n${ld.savedContent || "*(محتوى فارغ)*"}`,
            });
            await interaction.reply({ content: "✅ الرسالة اترجعت في القناة!", ephemeral: true });
          } catch (e) {
            await interaction.reply({ content: `❌ فشلت: ${e.message}`, ephemeral: true });
          }
          return;
        }

        // ✅ تأكيد الحذف
        if (action === "confirm") {
          await interaction.update({
            embeds: interaction.message.embeds,
            components: [],
          }).catch(() => {});
          await interaction.followUp({ content: "✅ تم تأكيد الحذف. الرسالة اتمسحت ومش هترجع.", ephemeral: true });
          autoModLogs.delete(logId);
          return;
        }

        // ⚠️ تحذير فقط
        if (action === "warn") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          db.addWarning(ld.userId, ld.reason, interaction.user.username);
          const warns = db.getWarnings(ld.userId);
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle("⚠️ تم التحذير")
              .setDescription(`<@${ld.userId}> أخد تحذير إضافي\nإجمالي التحذيرات: **${warns.length}**\nالسبب: ${ld.reason}`)
              .setTimestamp()],
            ephemeral: true,
          });
          return;
        }

        // 👢 طرد
        if (action === "kick") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          try {
            await interaction.guild.members.fetch(ld.userId);
            const member = interaction.guild.members.cache.get(ld.userId);
            if (!member) return interaction.reply({ content: "❌ العضو مش في السيرفر!", ephemeral: true });
            await member.kick(`Auto-Mod Log — ${ld.reason}`);
            await interaction.reply({
              embeds: [new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle("👢 تم الطرد")
                .setDescription(`**${ld.username}** اتطرد\nالسبب: ${ld.reason}`)
                .setTimestamp()],
              ephemeral: true,
            });
          } catch (e) {
            await interaction.reply({ content: `❌ فشل الطرد: ${e.message}`, ephemeral: true });
          }
          return;
        }

        // 🔇 إسكات — بيفتح مودال
        if (action === "mute") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          const modal = new ModalBuilder()
            .setCustomId(`aml_mute_modal_${logId}`)
            .setTitle("🔇 إسكات العضو");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("mute_duration")
                .setLabel("المدة بالدقائق (1-10080) — اتركه فاضي لساعتين")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("مثال: 60 أو 1440")
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("mute_reason")
                .setLabel("السبب (اختياري)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder(ld.reason)
            ),
          );
          return interaction.showModal(modal);
        }

        // 🔨 حظر — بيفتح مودال
        if (action === "ban") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          const modal = new ModalBuilder()
            .setCustomId(`aml_ban_modal_${logId}`)
            .setTitle("🔨 حظر العضو");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("ban_duration")
                .setLabel("المدة بالأيام (اتركه فاضي = حظر دائم)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("مثال: 7 أو 30 — فاضي = دائم")
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("ban_reason")
                .setLabel("السبب (اختياري)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder(ld.reason)
            ),
          );
          return interaction.showModal(modal);
        }

        // ❌ شيل التحذير — بيشيل آخر تحذير من العضو
        if (action === "unwarn") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          const warnings = db.getWarnings(ld.userId);
          if (!warnings || warnings.length === 0) {
            return interaction.reply({ content: "ℹ️ العضو ده معندوش تحذيرات أصلاً!", ephemeral: true });
          }
          db.removeLastWarning(ld.userId);
          const newWarnings = db.getWarnings(ld.userId);
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("❌ تم شيل التحذير")
              .setDescription(`<@${ld.userId}> اتشال منه تحذير واحد\nالتحذيرات المتبقية: **${newWarnings.length}**`)
              .setTimestamp()],
            ephemeral: true,
          });
          return;
        }

        // 🔊 شيل الإسكات — بيرفع الـ timeout فوراً
        if (action === "unmute") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          try {
            await interaction.guild.members.fetch(ld.userId);
            const member = interaction.guild.members.cache.get(ld.userId);
            if (!member) return interaction.reply({ content: "❌ العضو مش في السيرفر!", ephemeral: true });
            if (!member.isCommunicationDisabled()) {
              return interaction.reply({ content: "ℹ️ العضو ده مش متساكت أصلاً!", ephemeral: true });
            }
            await member.timeout(null, `Auto-Mod Log — رفع الإسكات بواسطة ${interaction.user.username}`);
            await interaction.reply({
              embeds: [new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("🔊 تم رفع الإسكات")
                .setDescription(`<@${ld.userId}> اترفع منه الإسكات\nبواسطة: ${interaction.user.username}`)
                .setTimestamp()],
              ephemeral: true,
            });
          } catch (e) {
            await interaction.reply({ content: `❌ فشل رفع الإسكات: ${e.message}`, ephemeral: true });
          }
          return;
        }

        // 🔓 رفع الحظر — بيرفع البان عن العضو
        if (action === "unban") {
          if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });
          try {
            await interaction.guild.bans.fetch(ld.userId).catch(() => null);
            await interaction.guild.members.unban(ld.userId, `Auto-Mod Log — رفع الحظر بواسطة ${interaction.user.username}`);
            db.removeBan?.(ld.userId);
            await interaction.reply({
              embeds: [new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("🔓 تم رفع الحظر")
                .setDescription(`<@${ld.userId}> (${ld.username}) اترفع عنه الحظر\nبواسطة: ${interaction.user.username}`)
                .setTimestamp()],
              ephemeral: true,
            });
          } catch (e) {
            const msg = e.code === 10026
              ? "ℹ️ العضو ده مش محظور أصلاً!"
              : `❌ فشل رفع الحظر: ${e.message}`;
            await interaction.reply({ content: msg, ephemeral: true });
          }
          return;
        }

        return;
      }
      // ──────────────────────────────────────────────────────────────

      // ── أزرار قرار طرد Auto-Mod ───────────────────────────────────
      if (interaction.customId.startsWith("automod_kick_yes_") || interaction.customId.startsWith("automod_kick_no_")) {
        if (!config.isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ القرار ده للأونر بس!", ephemeral: true });
        }
        const targetId = interaction.customId.replace("automod_kick_yes_", "").replace("automod_kick_no_", "");
        const isKick   = interaction.customId.startsWith("automod_kick_yes_");
        const guild    = client.guilds.cache.first();

        // عطل الأزرار في رسالة الـ DM
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`automod_kick_yes_${targetId}`).setLabel("✅ اه، اطرده").setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId(`automod_kick_no_${targetId}`).setLabel("❌ لا، سيبه").setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await interaction.update({ components: [disabledRow] }).catch(() => {});

        if (!isKick) {
          return interaction.followUp({ content: "✅ تمام، سيبناه المرة دي. لو كررها هيجيلك تقرير تاني.", ephemeral: true });
        }

        if (!guild) return interaction.followUp({ content: "❌ مش لاقي السيرفر!", ephemeral: true });

        try {
          await guild.members.fetch().catch(() => {});
          const member = guild.members.cache.get(targetId);
          if (!member) return interaction.followUp({ content: "❌ العضو مش موجود أو طلع بنفسه!", ephemeral: true });

          await member.kick("Auto-Mod: قرار الأونر بالطرد");
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("👢 تم الطرد")
              .setDescription(`**${member.user.username}** اتطرد بناءً على قرارك.\nالسبب: Auto-Mod + قرار الأونر`)
              .setTimestamp()],
            ephemeral: true
          });
        } catch (err) {
          return interaction.followUp({ content: `❌ فشلت في الطرد: ${err.message}`, ephemeral: true });
        }
      }
      // ─────────────────────────────────────────────────────────────

      if (interaction.customId === SUGGESTION_BTN_ID) {
        return await showSuggestionModal(interaction);
      }
      if (interaction.customId === "open_suggestion_modal") {
        return await showSuggestionModal(interaction);
      }

      // ✅ [تعديل 5] أزرار اللوحة الجديدة: اقتراح / مشكلة / تعليق
      if (interaction.customId === "suggest_idea") {
        const modal = new ModalBuilder()
          .setCustomId("modal_suggest_idea")
          .setTitle("💡 تقديم اقتراح جديد");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("suggest_text")
              .setLabel("اكتب اقتراحك هنا بالتفصيل:")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(2000)
          )
        );
        return await interaction.showModal(modal);
      }

      if (interaction.customId === "suggest_bug") {
        const modal = new ModalBuilder()
          .setCustomId("modal_suggest_bug")
          .setTitle("🔴 الإبلاغ عن مشكلة");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("bug_text")
              .setLabel("اوصف المشكلة بالتفصيل:")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(2000)
          )
        );
        return await interaction.showModal(modal);
      }

      if (interaction.customId === "suggest_other") {
        const modal = new ModalBuilder()
          .setCustomId("modal_suggest_other")
          .setTitle("💬 تعليق عام");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("other_text")
              .setLabel("اكتب تعليقك هنا:")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(2000)
          )
        );
        return await interaction.showModal(modal);
      }

      // ─── زر تعديل الإعلان ← يعرض موداال مملوء بالمحتوى الحالي ──
      if (interaction.customId.startsWith("edit_announce_btn|")) {
        const targetMsgId = interaction.customId.split("|")[1];
        const stored      = pendingAnnounceEdits.get(targetMsgId);
        const oldContent  = stored?.content ?? "";

        const modal = new ModalBuilder()
          .setCustomId(`edit_announce_modal|${targetMsgId}`)
          .setTitle("✏️ تعديل الإعلان");
        const input = new TextInputBuilder()
          .setCustomId("announce_content")
          .setLabel("المحتوى الجديد (عدّل اللي تريده مباشرةً)")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(2000)
          .setRequired(true);
        if (oldContent) input.setValue(oldContent.slice(0, 4000));
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === "wipe_cancel") {
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription("✅ تم إلغاء عملية المسح")],
          components: []
        });
      }

      if (interaction.customId.startsWith("wipe_confirm|")) {
        const targetChannelId = interaction.customId.split("|")[1];
        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        if (!targetChannel) {
          return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription("❌ مش لاقي الروم!")], components: [] });
        }
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription("⏳ جاري المسح...")],
          components: []
        });
        try {
          const cloned = await targetChannel.clone({ reason: `مسح-الكل بواسطة ${interaction.user.username}` });
          await cloned.setPosition(targetChannel.position);
          await targetChannel.delete(`مسح-الكل بواسطة ${interaction.user.username}`);
          await cloned.send({ embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setDescription(`🧹 تم مسح الروم بالكامل بواسطة ${interaction.user} ✅`)
              .setTimestamp()
          ]});
          sendModLog("wipe", interaction.user, null, "مسح الروم بالكامل", { channel: targetChannelId }).catch(() => {});
        } catch (err) {
          logger.error("خطأ في wipe_confirm:", err);
        }
        return;
      }

      if (interaction.customId === "admin_clear_games") {
        activeGames.clear();
        return await interaction.reply({
          content: "🧹 تم مسح وتصفير قائمة الألعاب النشطة كلها بنجاح!",
          ephemeral: true
        });
      }
      if (interaction.customId === "refresh_suggestions_board") {
        await interaction.deferReply({ ephemeral: true });
        const posted = await ensureSuggestionsPanel(client, true);
        return await interaction.editReply({
          content: posted
            ? "✅ تم تحديث لوحة الاقتراحات بنجاح! 🚀"
            : "❌ لم أستطع تحديث لوحة الاقتراحات. تحقق من معرف الروم وصلاحيات البوت.",
        });
      }
      if (interaction.customId === "admin_approve") {
        return await handleAdminSuggestionAction(interaction, "approved");
      }
      if (interaction.customId === "admin_reject") {
        return await handleAdminSuggestionAction(interaction, "rejected");
      }
      if (interaction.customId === "admin_review") {
        return await handleAdminSuggestionAction(interaction, "review");
      }
      if (interaction.customId === "admin_reply") {
        if (!isSuggestionAdmin(interaction)) {
          return interaction.reply({
            content: "❌ هذا الزر مخصص للإدارة فقط.",
            ephemeral: true,
          });
        }
        const reference = parseSuggestionReference(interaction.message.embeds[0]);
        if (!reference) {
          return interaction.reply({
            content: "❌ تعذر ربط هذا الاقتراح بالرسالة الأصلية.",
            ephemeral: true,
          });
        }
        return await showAdminReplyModal(interaction, reference);
      }
      if (interaction.customId === "admin_solved") {
        return await handleAdminSuggestionAction(interaction, "solved");
      }
      if (interaction.customId === "admin_notify") {
        if (!isSuggestionAdmin(interaction)) {
          return interaction.reply({ content: "❌ هذا الزر مخصص للإدارة فقط.", ephemeral: true });
        }
        const reference = parseSuggestionReference(interaction.message.embeds[0]);
        if (!reference) {
          return interaction.reply({ content: "❌ تعذر ربط هذا الاقتراح بالرسالة الأصلية.", ephemeral: true });
        }
        // استخرج الحالة الحالية من الإمبيد
        const statusField = interaction.message.embeds[0]?.fields?.find(f => f.name === "📊 الحالة");
        const currentStatus = statusField?.value || "⏳ قيد الدراسة والمراجعة";
        const suggestionText = reference.text || "—";

        let authorUser = null;
        try { authorUser = await interaction.client.users.fetch(reference.authorUserId); } catch { /* مش لاقي اليوزر */ }

        if (!authorUser) {
          return interaction.reply({ content: "❌ ما قدرتش أجيب بيانات صاحب الاقتراح.", ephemeral: true });
        }

        const dmEmbed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("📢 تحديث على اقتراحك في سيرفر الفراعنة")
          .setDescription(
            `يا **${authorUser.globalName || authorUser.username}**! الإدارة عملت تحديث على اقتراحك 👇\n\n` +
            `**📝 اقتراحك:**\n${suggestionText.slice(0, 512)}\n\n` +
            `**📊 الحالة الحالية:**\n${currentStatus}\n\n` +
            `*لو عندك أي استفسار، راجع لوحة الاقتراحات في السيرفر 🔱*`
          )
          .setFooter({ text: "سيرفر الفراعنة — نظام الاقتراحات" })
          .setTimestamp();

        let sent = false;
        try {
          await authorUser.send({ embeds: [dmEmbed] });
          sent = true;
        } catch { /* اليوزر مسكّر الـ DMs */ }

        return interaction.reply({
          content: sent
            ? `✅ تم إشعار **${authorUser.globalName || authorUser.username}** بالحالة الحالية عن طريق الـ DM!`
            : `❌ ما قدرتش أبعت DM لـ **${authorUser.globalName || authorUser.username}** — غالباً عنده الـ DMs مقفولة.`,
          ephemeral: true,
        });
      }
    } catch (err) {
      logger.error("خطأ في معالجة الزر:", err);
      return interaction.reply({
        content: "معلش يسطا ثواني بس",
        ephemeral: true
      }).catch(() => {});
    }
  }

  // ─── Context Menu: تعديل رسالة ────────────────────────────────
  if (interaction.isMessageContextMenuCommand() && interaction.commandName === "✏️ تعديل رسالة") {
    if (!config.isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ الأمر ده للأونر بس!", flags: 64 });
    }
    const target  = interaction.targetMessage;
    const isBotMsg = target.author.id === client.user.id;

    // نجيب المحتوى الحالي — نص عادي أو أول embed description
    const currentContent =
      target.content ||
      target.embeds?.[0]?.description ||
      target.embeds?.[0]?.title ||
      "";

    const modal = new ModalBuilder()
      .setCustomId(`editmsg_${isBotMsg ? "bot" : "user"}_${target.channel.id}_${target.id}`)
      .setTitle(isBotMsg ? "✏️ تعديل رسالة البوت" : "✏️ إعادة إرسال رسالة المستخدم");

    const input = new TextInputBuilder()
      .setCustomId("editmsg_content")
      .setLabel(isBotMsg ? "المحتوى الجديد" : "المحتوى بعد التعديل")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(currentContent.slice(0, 4000))
      .setRequired(true)
      .setMaxLength(4000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    try {
      // ─── مودالات نظام الأنمي ───────────────────────────────────────
      if (interaction.customId === "anime_search_modal") {
        return await handleAnimeSearchModal(interaction, db);
      }
      if (interaction.customId.startsWith("anime_rate_modal_")) {
        return await handleAnimeRateModal(interaction, db);
      }

      // ─── مودال إيمبد Builder ───────────────────────────────────────
      if (interaction.customId.startsWith("embed_modal_")) {
        const embedId   = interaction.customId.replace("embed_modal_", "");
        const draft     = autoModLogs.get(`embed_${embedId}`);
        if (!draft) return interaction.reply({ content: "❌ انتهت صلاحية الإيمبد! شغّل الأمر تاني.", ephemeral: true });

        const description = interaction.fields.getTextInputValue("embed_desc").trim() || null;
        const field1raw   = interaction.fields.getTextInputValue("embed_field1").trim();
        const field2raw   = interaction.fields.getTextInputValue("embed_field2").trim();
        const field3raw   = interaction.fields.getTextInputValue("embed_field3").trim();

        // ─── تحليل الحقول (العنوان | المحتوى) ──────────────────
        function parseField(raw) {
          if (!raw) return null;
          const parts = raw.split("|");
          if (parts.length >= 2) {
            return { name: parts[0].trim(), value: parts.slice(1).join("|").trim(), inline: true };
          }
          return { name: "​", value: raw.trim(), inline: false };
        }
        const fields = [parseField(field1raw), parseField(field2raw), parseField(field3raw)].filter(Boolean);

        // ─── بناء الإيمبد ────────────────────────────────────────
        function buildFinalEmbed(d, desc, flds) {
          const e = new EmbedBuilder().setColor(d.color);
          if (d.title)       e.setTitle(d.title);
          if (d.titleUrl && d.title) e.setURL(d.titleUrl);
          if (desc)          e.setDescription(desc);
          if (d.image)       e.setImage(d.image);
          if (d.thumbnail)   e.setThumbnail(d.thumbnail);
          if (d.showTimestamp) e.setTimestamp();
          if (d.authorName)  e.setAuthor({ name: d.authorName, iconURL: d.authorIcon || undefined, url: d.authorUrl || undefined });
          if (d.footerText)  e.setFooter({ text: d.footerText, iconURL: d.footerIcon || undefined });
          if (flds.length > 0) e.addFields(flds);
          return e;
        }

        const finalEmbed = buildFinalEmbed(draft, description, fields);
        const targetCh   = await client.channels.fetch(draft.channelId).catch(() => null);
        if (!targetCh) return interaction.reply({ content: "❌ مش لاقي القناة المختارة!", ephemeral: true });

        if (draft.wantPreview) {
          // ─── معاينة ephemeral + أزرار إرسال/إلغاء ──────────────
          const previewRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`embed_send_${embedId}`)
              .setLabel("✅ إرسال للقناة")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`embed_cancel_${embedId}`)
              .setLabel("❌ إلغاء")
              .setStyle(ButtonStyle.Danger),
          );
          // حفظ الوصف والفيلدز مع الـ draft
          draft.description = description;
          draft.fields       = fields;
          autoModLogs.set(`embed_${embedId}`, draft);

          return interaction.reply({
            content: `📋 **معاينة الإيمبد** — هتتبعت في <#${draft.channelId}>`,
            embeds: [finalEmbed],
            components: [previewRow],
            ephemeral: true,
          });
        } else {
          // ─── إرسال مباشر بدون معاينة ────────────────────────────
          await targetCh.send({ embeds: [finalEmbed] });
          autoModLogs.delete(`embed_${embedId}`);
          return interaction.reply({
            content: `✅ الإيمبد اتبعتت في <#${draft.channelId}> بنجاح!`,
            ephemeral: true,
          });
        }
      }

      // ─── مودال تعديل إيمبد ────────────────────────────────────────
      if (interaction.customId.startsWith("embededit_modal_")) {
        const editId = interaction.customId.replace("embededit_modal_", "");
        const draft  = autoModLogs.get(`embededit_${editId}`);
        if (!draft) return interaction.reply({ content: "❌ انتهت صلاحية التعديل! شغّل الأمر تاني.", ephemeral: true });

        const rawDesc   = interaction.fields.getTextInputValue("embed_desc");
        const field1raw = interaction.fields.getTextInputValue("embed_field1").trim();
        const field2raw = interaction.fields.getTextInputValue("embed_field2").trim();
        const field3raw = interaction.fields.getTextInputValue("embed_field3").trim();

        // ─── وصف: فاضي = يفضل زي ما هو، "مسح" = شيله ──────────
        let newDesc;
        if (rawDesc.trim().toLowerCase() === "مسح") {
          newDesc = null;
        } else if (rawDesc.trim() === "") {
          newDesc = draft.oldDesc || null;
        } else {
          newDesc = rawDesc.trim();
        }

        // ─── تحليل الحقول ────────────────────────────────────────
        function parseField(raw) {
          if (!raw) return null;
          const parts = raw.split("|");
          if (parts.length >= 2) {
            return { name: parts[0].trim(), value: parts.slice(1).join("|").trim(), inline: true };
          }
          return { name: "​", value: raw.trim(), inline: false };
        }
        const newFields = [parseField(field1raw), parseField(field2raw), parseField(field3raw)].filter(Boolean);

        // ─── بناء الإيمبد المعدّل ────────────────────────────────
        const e = new EmbedBuilder().setColor(draft.color);
        if (draft.title)         e.setTitle(draft.title);
        if (draft.titleUrl && draft.title) e.setURL(draft.titleUrl);
        if (newDesc)             e.setDescription(newDesc);
        if (draft.image)         e.setImage(draft.image);
        if (draft.thumbnail)     e.setThumbnail(draft.thumbnail);
        if (draft.showTimestamp) e.setTimestamp();
        if (draft.authorName)    e.setAuthor({ name: draft.authorName, iconURL: draft.authorIcon || undefined, url: draft.authorUrl || undefined });
        if (draft.footerText)    e.setFooter({ text: draft.footerText, iconURL: draft.footerIcon || undefined });
        // الحقول: لو في جديدة يحطها، لو مفيش يفضل القديمة
        const finalFields = newFields.length > 0 ? newFields : draft.oldFields ?? [];
        if (finalFields.length > 0) e.addFields(finalFields);

        // ─── تعديل الرسالة الأصلية ───────────────────────────────
        try {
          const targetCh  = await client.channels.fetch(draft.channelId).catch(() => null);
          if (!targetCh) return interaction.reply({ content: "❌ مش لاقي القناة!", ephemeral: true });
          const targetMsg = await targetCh.messages.fetch(draft.messageId).catch(() => null);
          if (!targetMsg) return interaction.reply({ content: "❌ مش لاقي الرسالة — اتمسحت؟", ephemeral: true });

          await targetMsg.edit({ embeds: [e] });
          autoModLogs.delete(`embededit_${editId}`);

          return interaction.reply({
            content: `✅ **الإيمبد اتعدّلت بنجاح!**\n📍 <#${draft.channelId}> — [اضغط هنا للرسالة](https://discord.com/channels/${interaction.guildId}/${draft.channelId}/${draft.messageId})`,
            ephemeral: true,
          });
        } catch (err) {
          return interaction.reply({ content: `❌ فشل التعديل: ${err.message}`, ephemeral: true });
        }
      }

      // ─── مودالات بنك الادخار ─────────────────────────────────────
      if (interaction.customId.startsWith("bsav_modal_")) {
        return await handleBankModal(interaction, db);
      }

      // ─── مودالات بنك الحظ المصري ─────────────────────────────────
      if (interaction.customId.startsWith("bleg_modal_")) {
        return await handleBankLuckEgModal(interaction, db);
      }

      // ─── مودالات الهاتف المكسور ──────────────────────────────────
      if (interaction.customId.startsWith("garmodal_")) {
        return await handleGarticModal(interaction);
      }

      // ─── مودال رابط دعوة الهاتف المكسور ─────────────────────────
      if (interaction.customId.startsWith("garplay_")) {
        return await handleGarticInviteModal(interaction);
      }

      // ─── مودالات صنع الميم ───────────────────────────────────────
      if (interaction.customId.startsWith("mememodal_") || interaction.customId.startsWith("memedmmodal_")) {
        return await handleMemeModal(interaction, db);
      }

      // ─── مودال رابط دعوة صنع الميم ──────────────────────────────
      if (interaction.customId.startsWith("memeplay_")) {
        return await handleMemeInviteModal(interaction);
      }

      // ─── مودالات كود نيمز — إعدادات ─────────────────────────────
      if (interaction.customId.startsWith("cdnsettings_")) {
        return await handleCodenamesSettingsModal(interaction);
      }

      // ─── مودالات كود نيمز — التلميح ─────────────────────────────
      if (interaction.customId.startsWith("cdnclue_")) {
        return await handleCodenamesClueModal(interaction);
      }

      // ─── مودال رابط دعوة كود نيمز ───────────────────────────────
      if (interaction.customId.startsWith("cdninvite_")) {
        return await handleCodenamesInviteModal(interaction);
      }

      // ─── مودال حجر ورقة مقص العادية ─────────────────────────────
      if (interaction.customId.startsWith("rpsbasicmodal_")) {
        const gameId = interaction.customId.slice(14);
        const state  = rpsBasicGames.get(gameId);
        if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
        const uid = interaction.user.id;
        if (uid !== state.playerA && uid !== state.playerB)
          return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
        const isA = uid === state.playerA;
        if (isA  && state.choiceA) return interaction.reply({ content: "✅ إنت بالفعل اخترت! بنستنى خصمك.", flags: 64 });
        if (!isA && state.choiceB) return interaction.reply({ content: "✅ إنت بالفعل اخترت! بنستنى خصمك.", flags: 64 });

        const raw    = (interaction.fields.getTextInputValue("choice") ?? "").trim();
        const VALID  = { "حجر": "حجر", "ورقة": "ورقة", "ورق": "ورقة", "مقص": "مقص" };
        const choice = VALID[raw];
        if (!choice) return interaction.reply({ content: "❌ اكتب: **حجر** أو **ورقة** أو **مقص** بس!", flags: 64 });

        if (isA) state.choiceA = choice;
        else     state.choiceB = choice;
        await interaction.reply({ content: `✅ اخترت ${RPS_ICON[choice]} **${choice}** — بنستنى خصمك!`, flags: 64 });

        if (state.choiceA && state.choiceB) {
          rpsBasicGames.delete(gameId);
          rpsBasicChannelMap.delete(state.channelId);

          const a = state.choiceA, b = state.choiceB;
          let resultLine;
          if (a === b) {
            resultLine = `🤝 **تعادل!** الاتنين اختاروا ${RPS_ICON[a]} **${a}**`;
          } else if (RPS_BEATS[a] === b) {
            resultLine = `🏆 فاز <@${state.playerA}>! ${RPS_ICON[a]} **${a}** تغلب على ${RPS_ICON[b]} **${b}**`;
          } else {
            resultLine = `🏆 فاز <@${state.playerB}>! ${RPS_ICON[b]} **${b}** تغلب على ${RPS_ICON[a]} **${a}**`;
          }

          const finalEmbed = new EmbedBuilder()
            .setColor(0x2ecc71).setTitle("🪨 حجر ورقة مقص — النتيجة!")
            .setDescription(
              `<@${state.playerA}> اختار: ${RPS_ICON[a]} **${a}**\n` +
              `<@${state.playerB}> اختار: ${RPS_ICON[b]} **${b}**\n\n` +
              resultLine
            ).setTimestamp();

          try {
            const ch = await client.channels.fetch(state.channelId);
            await ch.send({ embeds: [finalEmbed] });
          } catch { /* ignore */ }
        }
        return;
      }

      // ─── مودال حجر ورقة مقص الخارقة (أي اختيار في الكون) ────────
      if (interaction.customId.startsWith("rpsmodal_")) {
        const gameId = interaction.customId.slice(9);
        const state  = rpsGames.get(gameId);
        if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
        const uid = interaction.user.id;
        if (uid !== state.playerA && uid !== state.playerB)
          return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
        const isA = uid === state.playerA;
        if (isA && state.choiceA) return interaction.reply({ content: "✅ إنت بالفعل اخترت! بنستنى خصمك.", flags: 64 });
        if (!isA && state.choiceB) return interaction.reply({ content: "✅ إنت بالفعل اخترت! بنستنى خصمك.", flags: 64 });
        const choice = (interaction.fields.getTextInputValue("choice") ?? "").trim().slice(0, 60);
        if (!choice) return interaction.reply({ content: "❌ لازم تكتب حاجة!", flags: 64 });
        if (isA) state.choiceA = choice;
        else     state.choiceB = choice;
        await interaction.reply({ content: `✅ اخترت **${choice}** — بنستنى خصمك!`, flags: 64 });

        if (state.choiceA && state.choiceB) {
          rpsGames.delete(gameId);
          rpsChannelMap.delete(state.channelId);

          const aiPrompt = `لعبة حجر ورقة مقص متقدمة. اللاعب الأول اختار "${state.choiceA}" واللاعب الثاني اختار "${state.choiceB}". من يفوز؟ فكّر في المنطق (مثلاً: الثقب الأسود يبتلع كل شيء، النار تحرق الورقة، الدرع يصد السيف...). أجب بعربي مصري مرح في سطرين: السطر الأول النتيجة (فاز اللاعب الأول/الثاني/تعادل)، السطر الثاني سبب مضحك.`;
          let verdict = "🤔 البوت مش قادر يحكم — التعادل هو الحل!";
          try {
            const res = await geminiModel().generateContent(aiPrompt);
            verdict = res.response.text().trim();
          } catch { /* fallback above */ }

          const finalEmbed = new EmbedBuilder()
            .setColor(0xf1c40f).setTitle("✂️ حجر ورقة مقص — النتيجة!")
            .setDescription(
              `<@${state.playerA}> اختار: **${state.choiceA}**\n` +
              `<@${state.playerB}> اختار: **${state.choiceB}**\n\n` +
              `🤖 **حكم البوت:**\n${verdict}`
            ).setTimestamp();

          try {
            const ch = await client.channels.fetch(state.channelId);
            await ch.send({ embeds: [finalEmbed] });
          } catch { /* ignore */ }
        }
        return;
      }

      if (interaction.customId === SUGGESTION_MODAL_ID) {
        const text = interaction.fields.getTextInputValue(SUGGESTION_INPUT_ID);
        return await handleSuggestionModalSubmit(interaction, text);
      }
      if (interaction.customId === "sug_modal") {
        const text = interaction.fields.getTextInputValue("sug_input");
        return await handleSuggestionModalSubmit(interaction, text);
      }

      // ✅ [تعديل 5] معالجة مودالات الأزرار الثلاثة
      if (interaction.customId === "modal_suggest_idea") {
        const text = interaction.fields.getTextInputValue("suggest_text");
        return await handleSuggestionModalSubmit(interaction, text);
      }
      if (interaction.customId === "modal_suggest_bug") {
        const text = interaction.fields.getTextInputValue("bug_text");
        return await handleSuggestionModalSubmit(interaction, text);
      }
      if (interaction.customId === "modal_suggest_other") {
        const text = interaction.fields.getTextInputValue("other_text");
        return await handleSuggestionModalSubmit(interaction, text);
      }

      if (interaction.customId.startsWith(`${ADMIN_REPLY_MODAL_ID}|`)) {
        return await handleAdminReplyModalSubmit(interaction);
      }

      // ─── مودال تعديل / إعادة إرسال أي رسالة ─────────────────────
      if (interaction.customId.startsWith("editmsg_")) {
        const parts     = interaction.customId.split("_");
        // editmsg_{bot|user}_{channelId}_{messageId}
        const msgType   = parts[1];
        const channelId = parts[2];
        const messageId = parts[3];
        const newText   = interaction.fields.getTextInputValue("editmsg_content");

        await interaction.deferReply({ ephemeral: true });

        try {
          const ch  = await client.channels.fetch(channelId);
          const msg = await ch.messages.fetch(messageId);

          if (msgType === "bot") {
            // رسالة البوت — نعدل عليها مباشرة
            if (msg.embeds.length > 0) {
              // لو الرسالة عندها embed، نعدل الـ description بتاعه
              const oldEmbed = msg.embeds[0];
              const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(newText);
              await msg.edit({ embeds: [newEmbed] });
            } else {
              await msg.edit({ content: newText, allowedMentions: { parse: [] } });
            }
            return interaction.editReply({ content: "✅ تم تعديل رسالة البوت بنجاح!" });
          } else {
            // رسالة شخص تاني — نمسح الأصل ونعيد إرساله
            const authorTag  = msg.author.displayName ?? msg.author.username;
            const authorAvatar = msg.author.displayAvatarURL();
            await msg.delete().catch(() => {});
            await ch.send({
              content: `> 👤 **${authorTag}** (معدّل)\n${newText}`,
              allowedMentions: { parse: [] },
            });
            return interaction.editReply({ content: "✅ تم حذف الرسالة الأصلية وإعادة إرسالها بالمحتوى الجديد!" });
          }
        } catch (err) {
          return interaction.editReply({ content: `❌ حصل خطأ: ${err.message}` });
        }
      }

      // ─── مودال تعديل الإعلان ──────────────────────────────────────
      if (interaction.customId.startsWith("edit_announce_modal|")) {
        const targetMsgId = interaction.customId.split("|")[1];
        const newContent  = interaction.fields.getTextInputValue("announce_content");

        await interaction.deferReply({ ephemeral: true });

        try {
          const stored     = pendingAnnounceEdits.get(targetMsgId);
          const chId       = stored?.channelId ?? ANNOUNCE_CHANNEL_ID;
          const announceCh = await client.channels.fetch(chId);
          const targetMsg  = await announceCh.messages.fetch(targetMsgId);

          await targetMsg.edit({ content: newContent, allowedMentions: { parse: [] } });
          pendingAnnounceEdits.delete(targetMsgId);

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("✅ تم تعديل الإعلان")
                .setDescription(`الرسالة اتعدلت بنجاح في <#${chId}>`)
                .addFields({ name: "📋 المحتوى الجديد", value: newContent.slice(0, 1024) })
                .setTimestamp()
            ]
          });
        } catch (err) {
          logger.error("خطأ في تعديل الإعلان:", err);
          return interaction.editReply({ content: err.code === 10008 ? "❌ مش لاقي الرسالة! ربما انتهت الجلسة، شغّل الأمر من جديد." : `❌ حصل خطأ: ${err.message}` });
        }
      }

      // ─── مودالات Auto-Mod Log ─────────────────────────────────────
      if (interaction.customId.startsWith("aml_mute_modal_") || interaction.customId.startsWith("aml_ban_modal_")) {
        const isBan = interaction.customId.startsWith("aml_ban_modal_");
        const logId = interaction.customId.replace(isBan ? "aml_ban_modal_" : "aml_mute_modal_", "");
        const ld    = autoModLogs.get(logId);
        if (!ld) return interaction.reply({ content: "❌ البيانات انتهت!", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
          await interaction.guild.members.fetch(ld.userId).catch(() => {});
          const member = interaction.guild.members.cache.get(ld.userId);

          if (isBan) {
            const daysRaw = interaction.fields.getTextInputValue("ban_duration").trim();
            const reason  = interaction.fields.getTextInputValue("ban_reason").trim() || ld.reason;
            const days    = parseInt(daysRaw) || 0;
            const banOptions = { reason };
            if (days > 0) banOptions.deleteMessageSeconds = days * 24 * 60 * 60;

            await interaction.guild.bans.create(ld.userId, banOptions);
            db.addBan(ld.userId, reason, interaction.user.id);
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("🔨 تم الحظر")
                .setDescription(
                  `**${ld.username}** اتحظر${days > 0 ? ` لمدة **${days} يوم**` : " **نهائياً**"}\nالسبب: ${reason}`
                )
                .setTimestamp()],
            });
          } else {
            if (!member) return interaction.editReply({ content: "❌ العضو مش في السيرفر!" });
            const minsRaw = interaction.fields.getTextInputValue("mute_duration").trim();
            const reason  = interaction.fields.getTextInputValue("mute_reason").trim() || ld.reason;
            const mins    = parseInt(minsRaw) || 120;
            const clamped = Math.min(Math.max(mins, 1), 10080);

            await member.timeout(clamped * 60 * 1000, reason);
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("🔇 تم الإسكات")
                .setDescription(`**${ld.username}** اتأسكت لمدة **${clamped} دقيقة**\nالسبب: ${reason}`)
                .setTimestamp()],
            });
          }
        } catch (e) {
          await interaction.editReply({ content: `❌ فشلت العملية: ${e.message}` });
        }
        return;
      }
      // ──────────────────────────────────────────────────────────────

      // ─── موودالات لوحة تحكم الأونر ────────────────────────────────
      if (["dmmod_warn","dmmod_mute","dmmod_kick","dmmod_ban","dmmod_coins"].includes(interaction.customId)) {
        if (!config.isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ اللوحة دي للأونر بس!", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const g = interaction.guild || client.guilds.cache.first();
        if (g) await g.members.fetch().catch(() => {});

        const nameOrId = interaction.fields.getTextInputValue("dm_user")?.trim();
        const member   = findMember(g, nameOrId);

        if (!member && interaction.customId !== "dmmod_coins") {
          return interaction.editReply({ content: `❌ مش لاقي العضو: **${nameOrId}**` });
        }

        if (interaction.customId === "dmmod_warn") {
          const reason = interaction.fields.getTextInputValue("dm_reason");
          const u = db.getUser(member.user.id);
          if (!u.warnings) u.warnings = [];
          u.warnings.push({ reason, date: new Date().toISOString() });
          db.updateUser(member.user.id, u);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle("⚠️ تم التحذير")
              .setDescription(`تحذير لـ **${member.user.username}**\nالسبب: ${reason}\nإجمالي التحذيرات: ${u.warnings.length}`).setTimestamp()]
          });
        }

        if (interaction.customId === "dmmod_mute") {
          const mins   = parseInt(interaction.fields.getTextInputValue("dm_minutes")) || 10;
          const reason = interaction.fields.getTextInputValue("dm_reason");
          await member.timeout(mins * 60000, reason);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("🔇 تم الإسكات")
              .setDescription(`**${member.user.username}** اتأسكت لمدة **${mins} دقيقة**\nالسبب: ${reason}`).setTimestamp()]
          });
        }

        if (interaction.customId === "dmmod_kick") {
          const reason = interaction.fields.getTextInputValue("dm_reason");
          await member.kick(reason);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("👢 تم الطرد")
              .setDescription(`**${member.user.username}** اتطرد\nالسبب: ${reason}`).setTimestamp()]
          });
        }

        if (interaction.customId === "dmmod_ban") {
          const reason = interaction.fields.getTextInputValue("dm_reason");
          await g.bans.create(member.user.id, { reason });
          db.addBan(member.user.id, reason, interaction.user.id);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🔨 تم الحظر")
              .setDescription(`**${member.user.username}** اتحظر نهائياً\nالسبب: ${reason}`).setTimestamp()]
          });
        }

        if (interaction.customId === "dmmod_coins") {
          const amount = parseInt(interaction.fields.getTextInputValue("dm_amount")) || 0;
          const m2 = findMember(g, nameOrId);
          if (!m2) return interaction.editReply({ content: `❌ مش لاقي العضو: **${nameOrId}**` });
          const u = db.getUser(m2.user.id);
          u.coins = (u.coins || 0) + amount;
          db.updateUser(m2.user.id, u);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("🪙 تم إعطاء الكوينز")
              .setDescription(`**${m2.user.username}** أخد **${amount}** كوينز\nرصيده الحالي: **${u.coins}**`).setTimestamp()]
          });
        }
      }
      // ──────────────────────────────────────────────────────────────

    } catch (err) {
      logger.error("خطأ في معالجة الـ Modal:", err);
      return interaction.reply({
        content: "معلش يسطا ثواني بس",
        ephemeral: true
      }).catch(() => {});
    }
  }

  // ─── قوائم الاختيار (Select Menus) ──────────────────────────────
  if (interaction.isStringSelectMenu()) {
    try {
      // ─── قائمة الأغاني في الموسيقى ────────────────────────────────
      if (interaction.customId === "music_queue_select") {
        return await handleQueueJump(interaction);
      }

      // ─── قوائم نظام الأنمي ─────────────────────────────────────────
      if (interaction.customId === "anime_select_result") {
        return await handleAnimeSelectResult(interaction, db);
      }
      if (interaction.customId === "anime_select_episode") {
        return await handleAnimeSelectEpisode(interaction, db);
      }

      // ─── قائمة اختيار وضع AI Spymaster في كود نيمز ────────────────
      if (interaction.customId.startsWith("cdn_aiset_")) {
        return await handleCodenamesAISelect(interaction);
      }

      // ─── RPG: اختيار الكلاس واللقب ────────────────────────────────
      if (interaction.customId === "rpg_select_class") {
        return await handleClassSelect(interaction);
      }
      if (interaction.customId === "rpg_select_title") {
        return await handleTitleSelect(interaction);
      }
    } catch (err) {
      logger.error("خطأ في معالجة القائمة:", err);
      return interaction.reply({
        content: "معلش يسطا ثواني بس",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ───────────────────────────────────────────────────────────────
//  Graceful Shutdown
// ───────────────────────────────────────────────────────────────
process.on("SIGINT", async () => {
  logger.warn("🛑 إيقاف البوت بطريقة آمنة...");
  db.save();
  client.destroy();
  process.exit(0);
});

// ================= نظام الترحيب الأسطوري للفراعنة =================
// deduplication دائمة: بتتحفظ في ملف بتتحمل الـ restart
const _WELCOME_DEDUPE_PATH = path.join(__dirname, 'data', 'welcome-dedupe.json');
const _WELCOME_TTL = 5 * 60 * 1000; // 5 دقايق

function _loadWelcomeDedupe() {
  try {
    const raw = fs.readFileSync(_WELCOME_DEDUPE_PATH, 'utf8');
    const obj = JSON.parse(raw);
    // امسح المداخل القديمة
    const now = Date.now();
    for (const [k, t] of Object.entries(obj)) {
      if (now - t > _WELCOME_TTL) delete obj[k];
    }
    return obj;
  } catch { return {}; }
}
function _saveWelcomeDedupe(obj) {
  try { fs.writeFileSync(_WELCOME_DEDUPE_PATH, JSON.stringify(obj)); } catch {}
}
function _dedupeWelcome(key) {
  const obj = _loadWelcomeDedupe();
  if (obj[key] && Date.now() - obj[key] < _WELCOME_TTL) return false;
  obj[key] = Date.now();
  _saveWelcomeDedupe(obj);
  return true;
}

// in-memory للوداع (مش ضروري تتحفظ)
const _recentLeaves = new Map();
function _dedupeLeave(key, ttl = 10000) {
  if (_recentLeaves.has(key)) return false;
  _recentLeaves.set(key, true);
  setTimeout(() => _recentLeaves.delete(key), ttl);
  return true;
}

client.on('guildMemberAdd', async (member) => {
  // ✅ FIX: تفعيل anti-raid من moderation-listener.js (كانت معمولة new بس مش مربوطة بأي event)
  //   بنستدعيها هنا بشكل مستقل عن منطق الترحيب عشان تشتغل دايمًا حتى لو الترحيب اتعمله dedupe
  moderation.scanGuildJoin(member).catch((err) => {
    logger.error("[Anti-Raid] خطأ في فحص انضمام العضو:", err);
  });

  if (!_dedupeWelcome(`${member.guild.id}-${member.id}`)) return;

  const WELCOME_CHANNEL_ID = "1486100560494203183";

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  try {
    const imagePath = path.join(__dirname, 'welcome.png');
    const attachment = new AttachmentBuilder(imagePath, { name: 'welcome.png' });

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#A020F0')
      .setTitle('⚜️ 『 بـسـم الله الـرحـمـن الـرحـيـم 』 ⚜️')
      .setDescription(
        `🦅 **أهلاً بك في عرش الفراعنة العظيم** 🏛️\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ **لقد أشرقت الأنوار وانضم إلينا كاتب تاريخ جديد!**\n` +
        `👤 **الـعـضـو الـجـديـد:** ${member.displayName}\n` +
        `🆔 **الـمـعـرّف الـخـاص:** \`${member.id}\`\n` +
        `📊 **أنـت الـفـرعـون رقـم:** \`${member.guild.memberCount}\` في مملكتنا!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🔥 **نتمنى لك قضاء وقت أسطوري مليء بالحماس والذكريات الجبارة. طير على الرومات وتفاعل مع بقية الفراعنة وفجّر المكان بوجودك!** 👑`
      )
      .setImage('attachment://welcome.png')
      .setFooter({ text: '🔱 طاقم الإدارة يرحب بك ويتمنى لك رحلة سعيدة ⚜️' })
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed], files: [attachment] });

  } catch (error) {
    console.error("خطأ في نظام الترحيب:", error);
  }
});

// ================= نظام الوداع للفراعنة =================
client.on('guildMemberRemove', async (member) => {
  if (!_dedupeLeave(`${member.guild.id}-${member.id}`)) return;

  const WELCOME_CHANNEL_ID = "1486100560494203183";

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  try {
    const goodbyeEmbed = new EmbedBuilder()
      .setColor('#A020F0')
      .setTitle('🥀 فرعون جديد سابنا ومشي 🥀')
      .setDescription(
        `🦅 العرش مش هوه هوه من غيرك! 🏛️\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 **الفرعون اللي ودعنا:** <@${member.id}>\n` +
        `🚶‍♂️ قرر يكمل رحلته بعيد عننا.\n` +
        `📊 **بقينا** \`${member.guild.memberCount}\` **فرعون في المملكة.**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🔥 نورتنا في وقتك معانا، ومش هننساك. الباب دايماً مفتوح لأي فرعون أصيل يرجع لأهله في أي وقت. في رعاية الله! 👑`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: '🔱 عيلة الفراعنة بتتمنى لك كل خير يا بطل ⚜️' })
      .setTimestamp();

    await channel.send({ embeds: [goodbyeEmbed] });

  } catch (error) {
    console.error("خطأ في نظام الوداع:", error);
  }
});

// ================= نظام إبقاء البوت حياً 24 ساعة =================
// ✅ [تعديل 7] Express بطريقة ES Module الصحيحة + PORT من البيئة
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('👑 بوت الفراعنة يعمل بأعلى كفاءة 24/7 بدون تهنيج! 🦅');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: client.user ? client.user.username : 'connecting...',
    uptime: Math.floor(process.uptime()),
  });
});

function startServer(port, retries = 10, delay = 1000) {
  const srv = app.listen(port, () => {
    console.log(`✅ Server is ready and listening on port ${port}`);
  });
  srv.on("error", (err) => {
    if (err.code === "EADDRINUSE" && retries > 0) {
      console.warn(`⚠️ البورت ${port} مشغول — هنحاول تاني بعد ${delay}ms (${retries} محاولات متبقية)`);
      setTimeout(() => startServer(port, retries - 1, delay), delay);
    } else if (err.code === "EADDRINUSE") {
      console.error(`❌ البورت ${port} مشغول ولم يتحرر — جاري الاستمرار بدون HTTP server`);
    } else {
      throw err;
    }
  });
  return srv;
}
const _server = startServer(PORT);

// ═══════════════════════════════════════════════════════════════
//  نظام Keep-Alive المتطور — 24/7 بدون تهنيج
// ═══════════════════════════════════════════════════════════════
const SELF_URL = `http://localhost:${PORT}/health`;

// ── إحصائيات الـ uptime ──────────────────────────────────────
let _pingOk       = 0;
let _pingFail     = 0;
let _lastPingMs   = 0;
let _reconnects   = 0;
let _reconnecting = false;
let _lastHeartbeat = Date.now();

// ── Heartbeat: يتحدث كل ما البوت يستلم رسالة أو interaction ──
client.on("messageCreate", () => { _lastHeartbeat = Date.now(); });
client.on("interactionCreate", () => { _lastHeartbeat = Date.now(); });

// ── Self-Ping كل دقيقتين ──────────────────────────────────────
setInterval(async () => {
  const t0 = Date.now();
  try {
    const r = await fetch(SELF_URL, { signal: AbortSignal.timeout(10_000) });
    _lastPingMs = Date.now() - t0;
    if (r.ok) {
      _pingOk++;
      _pingFail = 0;
    } else {
      _pingFail++;
      console.warn(`⚠️ [Keep-Alive] الخادم رد بـ ${r.status}`);
    }
  } catch (e) {
    _pingFail++;
    _lastPingMs = Date.now() - t0;
    if (_pingFail >= 3) {
      console.warn(`⚠️ [Keep-Alive] فشل ${_pingFail} مرات — ${e.message}`);
    }
  }
}, 2 * 60 * 1000); // كل دقيقتين

// ── مراقبة الاتصال بـ Discord كل دقيقة ──────────────────────
// بنستنى 90 ثانية بعد الـ startup قبل ما نبدأ نفحص (ping بيبقى -1 في البداية)
const _startupTime = Date.now();

setInterval(async () => {
  if (_reconnecting) return;

  // إيقاف الفحص في أول 90 ثانية من الـ startup
  if (Date.now() - _startupTime < 90_000) return;

  const isReady    = client.isReady();
  const wsPing     = client.ws.ping;
  const secsSilent = (Date.now() - _lastHeartbeat) / 1000;

  // لا نعتبر ping سالب مشكلة (بيحصل طبيعياً في البداية)
  // نفحص بس لو البوت مش ready فعلاً أو الـ ping عالي جداً
  const deadPing = wsPing > 15_000; // أكتر من 15 ثانية بس

  const needsReconnect = !isReady || deadPing;

  if (!needsReconnect) return;

  _reconnecting = true;
  _reconnects++;
  console.warn(`⚠️ [AutoReconnect] مشكلة — ready=${isReady} | ping=${wsPing}ms | صمت=${Math.floor(secsSilent)}s — محاولة #${_reconnects}`);

  try {
    await client.destroy();
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`✅ [AutoReconnect] اتصل تاني بنجاح! (محاولة #${_reconnects})`);
  } catch (e) {
    console.error(`❌ [AutoReconnect] فشل: ${e.message}`);
  } finally {
    _reconnecting = false;
  }
}, 60 * 1000); // كل دقيقة

// ── endpoint لعرض إحصائيات الـ uptime ────────────────────────
app.get('/status', (_req, res) => {
  const uptimeSec = Math.floor(process.uptime());
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  res.json({
    bot:        client.user?.username ?? "connecting...",
    status:     client.isReady() ? "online" : "offline",
    uptime:     `${h}h ${m}m ${s}s`,
    wsPing:     `${client.ws.ping}ms`,
    pingOk:     _pingOk,
    pingFail:   _pingFail,
    lastPingMs: `${_lastPingMs}ms`,
    reconnects: _reconnects,
  });
});

// ── endpoint لإيقاف النسخة القديمة قبل ما نسخة جديدة تشتغل ──
app.post('/shutdown', (_req, res) => {
  res.json({ ok: true, pid: process.pid });
  console.warn("⚠️ [Shutdown] طلب إيقاف تشغيل من نسخة جديدة — بيقفل...");
  setTimeout(() => process.exit(0), 500);
});

console.log(`🔄 [Keep-Alive] شغّال — ping كل 2 دقيقة | مراقبة كل دقيقة | /status للإحصائيات`);

// ───────────────────────────────────────────────────────────────
// Anti-Crash — حماية البوت من الإغلاق + منع تكرار رسايل الـ Error
// ───────────────────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  const msg = reason?.message || String(reason);
  if (canSendError("unhandledRejection:" + msg.slice(0, 60))) {
    console.error("⚠️ [Anti-Crash] unhandledRejection:", msg);
  }
});

process.on("uncaughtException", (err) => {
  if (canSendError("uncaughtException:" + err.message?.slice(0, 60))) {
    console.error("⚠️ [Anti-Crash] uncaughtException:", err.message);
    console.error(err.stack);
  }
});

process.on("uncaughtExceptionMonitor", (err) => {
  if (canSendError("uncaughtExceptionMonitor:" + err.message?.slice(0, 60))) {
    console.error("⚠️ [Anti-Crash] uncaughtExceptionMonitor:", err.message);
  }
});

// ── أحداث الاتصال — منع الـ drops من غير ضجة ──────────────────
client.on("error", (err) => {
  if (canSendError("client:error")) {
    console.error("⚠️ [Discord] خطأ في الاتصال:", err.message);
  }
});

client.on("shardError", (err) => {
  if (canSendError("shard:error")) {
    console.error("⚠️ [Shard] خطأ WebSocket:", err.message);
  }
});

client.on("warn", (info) => {
  if (canSendError("client:warn:" + info.slice(0, 40))) {
    console.warn("⚠️ [Discord]", info);
  }
});

// ─── Auto-Close Games بعد 3 دقايق ────────────────────────────────
const AUTO_CLOSE_MS = 3 * 60 * 1000;
const _autoCloseInterval = setInterval(() => {
  const now = Date.now();
  const expired = (map) => [...map.entries()].filter(([, s]) => s._ts && (now - s._ts) > AUTO_CLOSE_MS).map(([id]) => id);

  expired(rouletteGames).forEach(id => rouletteGames.delete(id));
  expired(mafiaGames).forEach(id => mafiaGames.delete(id));
  expired(tttGames).forEach(id => tttGames.delete(id));
  expired(rpsGames).forEach(id => { const ch = [...rpsChannelMap.entries()].find(([,v])=>v===id)?.[0]; rpsGames.delete(id); if(ch) rpsChannelMap.delete(ch); });
  expired(rpsBasicGames).forEach(id => { const ch = [...rpsBasicChannelMap.entries()].find(([,v])=>v===id)?.[0]; rpsBasicGames.delete(id); if(ch) rpsBasicChannelMap.delete(ch); });

  // مسح channelGames لأي gameId مش موجود في أي Map
  channelGames.forEach((gid2, cid) => {
    if (!rouletteGames.has(gid2) && !mafiaGames.has(gid2) && !tttGames.has(gid2))
      channelGames.delete(cid);
  });
}, 30_000);
_autoCloseInterval.unref?.();

// ─── Reaction Roles Events ────────────────────────────────────────
/** مطابقة الإيموجي — يدعم unicode + custom + animated */
function matchesStoredEmoji(reactionEmoji, stored) {
  if (!stored) return false;
  // unicode emoji مباشر
  if (reactionEmoji.name === stored) return true;
  // custom / animated: نبني الصيغتين ونتحقق من كلهم
  if (reactionEmoji.id) {
    const plain    = `<:${reactionEmoji.name}:${reactionEmoji.id}>`;
    const animated = `<a:${reactionEmoji.name}:${reactionEmoji.id}>`;
    if (plain === stored || animated === stored) return true;
    // fallback: نفس الـ id بغض النظر عن الصيغة
    const storedId = stored.match(/:(\d+)>$/)?.[1];
    if (storedId && storedId === reactionEmoji.id) return true;
  }
  return false;
}

client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user.partial) await user.fetch();
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const data = reactionRoles[reaction.message.id];
    if (!data) return;
    if (!matchesStoredEmoji(reaction.emoji, data.emoji)) return;

    const guild = client.guilds.cache.get(data.guildId)
      ?? await client.guilds.fetch(data.guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
    if (!member) return;

    const roleToAdd = guild.roles.cache.get(data.roleId);
    if (!roleToAdd) {
      logger.warn(`[ReactionRole] الرول ${data.roleId} مش موجود في السيرفر`);
      return;
    }
    try {
      await member.roles.add(roleToAdd);
    } catch (err) {
      logger.warn(`[ReactionRole] فشل إضافة رول ${roleToAdd.name} لـ ${user.tag}: ${err.message}`);
      try {
        await user.send(`❌ **مش قادر أديك رتبة "${roleToAdd.name}"**\nالسبب: ${err.message}\nتواصل مع الأدمن لو المشكلة فضلت.`);
      } catch {}
    }
  } catch (err) {
    logger.error("[ReactionRole] خطأ في messageReactionAdd:", err.message);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  try {
    if (user.partial) await user.fetch();
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const data = reactionRoles[reaction.message.id];
    if (!data) return;
    if (!matchesStoredEmoji(reaction.emoji, data.emoji)) return;

    const guild = client.guilds.cache.get(data.guildId)
      ?? await client.guilds.fetch(data.guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
    if (!member) return;

    await member.roles.remove(data.roleId).catch(err => {
      logger.warn(`[ReactionRole] فشل إزالة رول ${data.roleId} من ${user.id}: ${err.message}`);
    });
  } catch (err) {
    logger.error("[ReactionRole] خطأ في messageReactionRemove:", err.message);
  }
});

client.login(process.env.DISCORD_TOKEN);
