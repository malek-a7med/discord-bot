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
import dotenv from "dotenv";
dotenv.config();

// ───────────────────────────────────────────────────────────────
//  Advanced Features Imports
// ───────────────────────────────────────────────────────────────
import config from "./config.js";
import Database from "./database.js";
import Logger from "./logger.js";
import ModerationListener from "./helpers/moderation-listener.js";
import { registerMusicCommands, musicHandler } from "./commands/music.js";
import { registerCleanChapterCommand, handleCleanChapter } from "./commands/image-cleaner.js";
import { registerTranslateChapterCommand, handleTranslateChapter } from "./commands/translator.js";
import {
  registerWhitenCommands,
  handleWhitenUpload,
  handleWhitenLink,
  handleOcrUpload
} from "./commands/quick-clean.js";
import { handleOwnerAI, getProcessingCount } from "./helpers/owner-ai.js";
import { scanMessage as autoModScan } from "./helpers/auto-mod.js";

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
import playdl from "play-dl";
import { initGeminiKeys, getChatModel, getImageModel, getKeyCount, getKeyStats, addKeys, resetExhaustedKeys } from "./helpers/gemini-keys.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Lock File: منع تشغيل أكتر من نسخة واحدة في نفس الوقت ────────
const LOCK_FILE = "/tmp/zangi_bot.lock";
(function enforceSingleInstance() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const oldPid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
      if (oldPid && !isNaN(oldPid) && oldPid !== process.pid) {
        process.kill(oldPid, "SIGTERM");
        console.log(`🔫 [Lock] أوقفت النسخة القديمة (PID: ${oldPid})`);
      }
    } catch { /* النسخة القديمة ماتت فعلاً */ }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
  process.on("exit", cleanup);
  process.on("SIGINT",  () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
})();

// ✅ [جديد] Express import بطريقة ES Module الصحيحة
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "server_database.json");

// ───────────────────────────────────────────────────────────────
//  Initialize Advanced Systems
// ───────────────────────────────────────────────────────────────
const db = new Database();
const logger = new Logger(null); // Will set client reference in ready event

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
  new SlashCommandBuilder()
    .setName("بروفايل")
    .setDescription("عرض بروفايلك (المستوى والكوينز) / Your profile")
    .addUserOption((o) => o.setName("عضو").setDescription("اختر عضو / Choose member")),
  new SlashCommandBuilder().setName("محفظة").setDescription("عرض رصيدك من الكوينز / Your wallet"),
  new SlashCommandBuilder().setName("العاب").setDescription("لعبة سرعة في الشات — الفائز يكسب 150 كوينز"),
  new SlashCommandBuilder().setName("متجر").setDescription("عرض الرتب المتاحة للشراء / Shop roles"),
  new SlashCommandBuilder()
    .setName("شراء")
    .setDescription("شراء رتبة من المتجر / Buy a role")
    .addStringOption((o) =>
      o
        .setName("الرتبة")
        .setDescription("اختر الرتبة")
        .setRequired(true)
        .addChoices(
          { name: "Golden🥇 — 5000 كوينز", value: "golden" },
          { name: "Silver🥈 — 2500 كوينز", value: "silver" },
          { name: "Bronze🥉 — 1000 كوينز", value: "bronze" }
        )
    ),
  new SlashCommandBuilder()
    .setName("إعطاء")
    .setDescription("منح كوينز لعضو [إدارة] / Give coins [Admin]")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("كمية").setDescription("الكمية").setRequired(true).setMinValue(1)
    ),
  new SlashCommandBuilder().setName("يومي").setDescription("استلم مكافأتك اليومية / Daily reward"),
  new SlashCommandBuilder()
    .setName("مانهوا-إنشاء")
    .setDescription("إنشاء قاموس مصطلحات لمانهوا / Create manhwa dictionary")
    .addStringOption((o) => o.setName("الاسم").setDescription("اسم المانهوا").setRequired(true)),
  new SlashCommandBuilder()
    .setName("مانهوا-إضافة-مصطلح")
    .setDescription("إضافة مصطلح للقاموس / Add term to dictionary")
    .addStringOption((o) => o.setName("المانهوا").setDescription("اسم المانهوا").setRequired(true))
    .addStringOption((o) => o.setName("الإنجليزي").setDescription("الكلمة بالإنجليزية").setRequired(true))
    .addStringOption((o) => o.setName("العربي").setDescription("الترجمة العربية").setRequired(true)),
  new SlashCommandBuilder()
    .setName("مانهوا-عرض-المصطلحات")
    .setDescription("عرض القواامس المخزنة / List dictionaries")
    .addStringOption((o) => o.setName("المانهوا").setDescription("اسم مانهوا محددة (اختياري)")),
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
    .setName("تحذير")
    .setDescription("توجيه تحذير رسمي [مشرف] / Warn a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("السبب").setDescription("السبب").setRequired(true)),
  new SlashCommandBuilder()
    .setName("اسكات")
    .setDescription("إسكات عضو مؤقتاً [مشرف] / Timeout a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("مدة").setDescription("المدة بالدقائق (1-1440)").setRequired(true).setMinValue(1).setMaxValue(1440)
    )
    .addStringOption((o) => o.setName("السبب").setDescription("السبب")),
  new SlashCommandBuilder()
    .setName("طرد")
    .setDescription("طرد عضو [مشرف] / Kick a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("السبب").setDescription("السبب")),
  new SlashCommandBuilder()
    .setName("تبنيد")
    .setDescription("حظر عضو نهائياً [مشرف] / Ban a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("السبب").setDescription("السبب")),
  new SlashCommandBuilder().setName("مساعدة").setDescription("قائمة جميع الأوامر / Help"),
  new SlashCommandBuilder()
    .setName("تحذيرات")
    .setDescription("عرض تحذيرات عضو / View warnings")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو")),
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
    .setName("تشغيل")
    .setDescription("تشغيل أغنية من يوتيوب أو سبوتيفاي / Play a song")
    .addStringOption((o) => o.setName("بحث").setDescription("رابط أو اسم الأغنية").setRequired(true)),
  new SlashCommandBuilder().setName("إيقاف").setDescription("إيقاف الموسيقى وإخراج البوت / Stop music and leave"),
  new SlashCommandBuilder().setName("تخطي").setDescription("تخطي الأغنية الحالية / Skip current song"),
  new SlashCommandBuilder().setName("قائمة-تشغيل").setDescription("عرض قائمة الأغاني الحالية / Show music queue"),
  new SlashCommandBuilder().setName("توقف-مؤقت").setDescription("إيقاف مؤقت / Pause music"),
  new SlashCommandBuilder().setName("استئناف").setDescription("استئناف التشغيل / Resume music"),
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
  new SlashCommandBuilder()
    .setName("نسخة-احتياطية")
    .setDescription("تحميل نسخة احتياطية من بيانات السيرفر [إدارة] / Download server database backup")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("استرجاع")
    .setDescription("استرجاع بيانات السيرفر من نسخة احتياطية [إدارة] / Restore database from backup")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption((o) =>
      o.setName("ملف").setDescription("ملف الـ JSON اللي حملته من أمر نسخة-احتياطية").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("قناة-النسخ")
    .setDescription("تعيين قناة النسخ الاحتياطية اليومية [إدارة] / Set daily backup channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o.setName("id").setDescription("الـ ID بتاع القناة — انسخه من Discord").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("تشغيل-اختبار")
    .setDescription("اختبار رسالة الترحيب أو الوداع [إدارة] / Test welcome or goodbye message")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o.setName("نوع")
        .setDescription("اختار نوع الرسالة")
        .setRequired(true)
        .addChoices(
          { name: "🎉 رسالة ترحيب", value: "welcome" },
          { name: "🥀 رسالة وداع",  value: "goodbye" }
        )
    ),
  new SlashCommandBuilder()
    .setName("قناة-اللوجز")
    .setDescription("تعيين قناة تسجيل أوامر الأونر [أونر فقط]")
    .addChannelOption((o) =>
      o.setName("قناة").setDescription("القناة المخصصة للوجز").setRequired(true)
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
    .setName("حالة-البوت")
    .setDescription("إظهار حالة البوت والـ AI في الوقت الفعلي [أونر فقط]"),
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
    ),
  new SlashCommandBuilder()
    .setName("رفع-بلوك")
    .setDescription("ارفع البلوك عن يوزر قبل ما الوقت يخلص [أونر فقط]")
    .addUserOption(opt =>
      opt.setName("يوزر")
        .setDescription("اليوزر اللي هترفع عنه البلوك")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("قائمة-مبلوكين")
    .setDescription("اعرض كل اليوزرز اللي عندهم بلوك نشط دلوقتي [أونر فقط]"),
];

// Advanced Feature Commands
async function getAdvancedCommands() {
  const musicCommands = await registerMusicCommands(null);
  const cleanCommand = await registerCleanChapterCommand(null);
  const translateCommand = await registerTranslateChapterCommand(null);
  const whitenCommands = await registerWhitenCommands(null);

  return [
    cleanCommand.data,
    translateCommand.data,
    ...musicCommands.map(cmd => cmd.data),
    ...whitenCommands.map(cmd => cmd.data)
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
  ],
  partials: [Partials.Channel, Partials.Message],
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

const activeGames = new Collection();
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
  pending: { text: "⏳ قيد الدراسة والمراجعة", color: 0xa020f0 },
  approved: { text: "✅ مقبول", color: 0x2ecc71 },
  rejected: { text: "❌ مرفوض", color: 0xe74c3c },
  review: { text: "🔍 قيد المراجعة", color: 0x3498db },
};

function buildSuggestionEmbed({ user, text, statusKey = "pending", moderator = null }) {
  const status = SUGGESTION_STATUSES[statusKey] || SUGGESTION_STATUSES.pending;

  const embed = new EmbedBuilder()
    .setColor(status.color)
    .setTitle("💡 اقتراح جديد")
    .addFields(
      {
        name: "👤 مقدم الاقتراح",
        value: `${user} — **${user.tag}**`,
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

  await adminMessage.edit({
    embeds: [updatedAdminEmbed],
    components: [buildAdminActionRow(true)],
  });
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

  const publicMessage = await suggestionsChannel.send({
    embeds: [
      buildSuggestionEmbed({
        user: interaction.user,
        text: trimmedText,
        statusKey: "pending",
      }),
    ],
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

  if (adminChannel?.isTextBased()) {
    await adminChannel.send({
      embeds: [adminEmbed],
      components: [buildAdminActionRow(false)],
    });
  } else {
    logger.warn("⚠️ روم إدارة الاقتراحات غير متاح");
  }

  return interaction.editReply({
    content: "✅ **شكراً لك!** تم استلام اقتراحك بنجاح وسيتم مراجعته من قبل الإدارة قريباً. 🙏",
  });
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
  logger.success(`تسجيل الدخول بـ: ${c.user.tag}`);
  c.user.setActivity(`${LEGACY_COMMANDS.length + 14} أمر | /مساعدة`, { type: 3 });
  await deployCommands(process.env.DISCORD_TOKEN, c.user.id);
  await ensureSuggestionsPanel(c);
  setInterval(() => sendAutoBackup(c), 24 * 60 * 60 * 1000);
  logger.info("⏰ نظام النسخ الاحتياطية التلقائية اليومية جاهز");

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
const processedMessages = new Set();

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
function buildUserPrompt(senderName, question, userId) {
  const hist = getUserHistory(userId);
  const histText = hist.map(m => `${m.role === "user" ? senderName : "زنجي"}: ${m.text}`).join("\n");
  return `أنت زنجي — بوت ديسكورد مصري ودود، بتتكلم بالعامية المصرية الطبيعية.
${histText ? `\nسياق المحادثة:\n${histText}\n` : ""}
${senderName}: ${question}

رد بالعربي المصري بشكل مختصر وودود.`;
}

// ─── DM من الأونر ───────────────────────────────────────────────
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // ── منع تكرار الردود لو في نسختين شغالين ────────────────────
  if (processedMessages.has(msg.id)) return;
  processedMessages.add(msg.id);
  setTimeout(() => processedMessages.delete(msg.id), 60_000);

  // ── روم الاقتراحات: احذف أي رسالة عادية وذكّر بالأزرار ────────
  if (msg.guild && msg.channel.id === SUGGESTIONS_CHANNEL_ID) {
    await msg.delete().catch(() => {});
    await msg.author.send(
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
      return handleOwnerAI(msg, guild, geminiModel(), db, buildDMControlPanel).catch(() => {});
    }

    // باقي الناس يقدروا يكلموا البوت في الخاص — رد AI عادي
    if (!_geminiReady) {
      return msg.channel.send("👋 أهلاً! أنا زنجي 🤖\nالـ AI مش شغال دلوقتي، جرب بعدين!").catch(() => {});
    }
    const question = msg.content.trim();
    if (!question) return;
    try {
      msg.channel.sendTyping().catch(() => {});
      const senderName = msg.author.globalName || msg.author.username;
      const prompt     = buildUserPrompt(senderName, question, msg.author.id);
      const result     = await geminiModel().generateContent(prompt);
      const reply      = result.response.text().trim();
      pushUserHistory(msg.author.id, "user", question);
      pushUserHistory(msg.author.id, "bot",  reply);
      return msg.channel.send(reply).catch(() => {});
    } catch {
      return msg.channel.send("معلش يسطا ثواني بس 🙏").catch(() => {});
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

    const amResult = await autoModScan(msg, db, geminiImageModel(), notifyOwner).catch(() => ({}));
    if (amResult?.triggered) return;

    // Autonomous Moderation Scanning (spam + links)
    if (moderation.isEnabled()) {
      await moderation.scanMessage(msg);
    }
  }

  // XP فقط في السيرفر
  if (msg.guild) {
    const userData = db.getUser(msg.author.id);
    const oldLevel = userData.level;

    userData.xp += 5;
    userData.level = calcLevel(userData.xp);
    db.updateUser(msg.author.id, userData);

    if (userData.level > oldLevel) {
      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("🎉 مبروك! ارتقيت مستوى!")
        .setDescription(`${msg.author} وصل للمستوى **${userData.level}** 🚀`)
        .setTimestamp();
      msg.channel.send({ embeds: [embed] }).catch(() => {});
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

  const isMentioned  = msg.mentions.has(client.user.id);
  const isOwner      = config.isOwner(msg.author.id);
  // باسمه = للأونر بس — باقي الناس لازم يعملوا منشن
  const calledByName = /زنجي/i.test(msg.content) && isOwner;

  // في السيرفر، الكل (حتى الأونر) لازم ينده باسمه أو يعمل منشن
  if (!isMentioned && !calledByName) return;

  // بعث typing فوراً عشان Discord ميعملش مقاطعة
  msg.channel.sendTyping().catch(() => {});

  const BOT_CHANNEL_ID = "1516591390023352370";

  // تقييد الروم ده بس للسيرفر (مش الـ DM) وبس للناس العادية
  if (msg.guild && !isOwner && msg.channel.id !== BOT_CHANNEL_ID) {
    return msg.reply("مقدرش اتكلم هنا 😅 روحلي روم : 🤖روم-زنجي🤖").catch(() => {});
  }

  const question = msg.content.replace(/<@!?\d+>/g, "").trim();
  if (!question || !_geminiReady) return;

  const now = Date.now();

  // ── حماية Spam (الأونر معفي) ─────────────────────────────────
  if (!isOwner) {
    const spamErr = checkSpam(msg.author.id, now);
    if (spamErr) return msg.reply(spamErr).catch(() => {});
  }

  // ── cooldown: 15 ثانية بين كل طلب وتاني (الأونر معفي) ────────
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
    return handleOwnerAI(msg, msg.guild, geminiModel(), db, buildDMControlPanel).catch(() => {});
  }

  try {
    // msg.member ممكن يكون null لو الرسالة جت من DM أو cache miss
    const senderName = msg.member?.displayName ?? msg.author.displayName ?? msg.author.username;
    const prompt     = buildUserPrompt(senderName, question, msg.author.id);
    const result     = await geminiModel().generateContent(prompt);
    const reply      = result.response.text().trim();
    pushUserHistory(msg.author.id, "user", question);
    pushUserHistory(msg.author.id, "bot",  reply);
    await msg.reply(reply);
  } catch (err) {
    logger.error("خطأ في الرد على الرسالة:", err);
    if (err.isQuotaError || err.message === "ALL_KEYS_EXHAUSTED") {
      await msg.reply("⏳ الـ AI وصل للحد اليومي — جرب تاني بعد شوية!").catch(() => {});
    } else {
      await msg.reply("معلش يسطا ثواني بس").catch(() => {});
    }
  }
});

// ───────────────────────────────────────────────────────────────
//  تنفيذ Slash Commands و الأزرار و المودال بالكامل
// ───────────────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
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
      // ─── قائمة المبلوكين ─────────────────────────────────────────
      if (cmd === "قائمة-مبلوكين") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
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

      // ─── رفع البلوك ──────────────────────────────────────────────
      if (cmd === "رفع-بلوك") {
        if (!config.isOwner(user.id)) {
          return interaction.reply({ content: "❌ الأمر ده للأونر بس!", ephemeral: true });
        }
        const target = interaction.options.getUser("يوزر");
        const entry  = spamData.get(target.id);
        if (!entry || entry.blockedUntil <= Date.now()) {
          return interaction.reply({ content: `✅ **${target.username}** مش مبلوك أصلاً.`, ephemeral: true });
        }
        entry.blockedUntil = 0;
        entry.timestamps   = [];
        return interaction.reply({ content: `✅ اترفع البلوك عن **${target.username}** بنجاح.`, ephemeral: true });
      }

      // ─── حالة البوت ─────────────────────────────────────────────
      if (cmd === "حالة-البوت") {
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
            .setFooter({ text: "المفاتيح الجديدة شغالة على طول من غير restart" })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
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

      // Music Commands (New System)
      // ─── لو الأمر جاي من DM: بنجيب الميمبر من السيرفر عشان نعرف الـ voice channel ───
      const MUSIC_CMDS = ["play","skip","stop","queue","pause","resume","nowplaying","volume"];
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
        if (cmd === "play") {
          const { handlePlay } = await import("./commands/music.js");
          return await handlePlay(musicInteraction);
        }
        if (cmd === "skip") {
          const { handleSkip } = await import("./commands/music.js");
          return await handleSkip(musicInteraction);
        }
        if (cmd === "stop") {
          const { handleStop } = await import("./commands/music.js");
          return await handleStop(musicInteraction);
        }
        if (cmd === "queue") {
          const { handleQueue } = await import("./commands/music.js");
          return await handleQueue(musicInteraction);
        }
        if (cmd === "pause") {
          const { handlePause } = await import("./commands/music.js");
          return await handlePause(musicInteraction);
        }
        if (cmd === "resume") {
          const { handleResume } = await import("./commands/music.js");
          return await handleResume(musicInteraction);
        }
        if (cmd === "nowplaying") {
          const { handleNowPlaying } = await import("./commands/music.js");
          return await handleNowPlaying(musicInteraction);
        }
        if (cmd === "volume") {
          const { handleVolume } = await import("./commands/music.js");
          return await handleVolume(musicInteraction);
        }
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
        const embed = new EmbedBuilder()
          .setColor(0x7289da)
          .setTitle(`📊 معلومات سيرفر: ${guild.name}`)
          .addFields(
            { name: "🆔 ID السيرفر", value: guild.id, inline: true },
            { name: "👥 عدد الأعضاء", value: `${guild.memberCount}`, inline: true }
          );
        return interaction.reply({ embeds: [embed] });
      }

      if (cmd === "userinfo") {
        const target = interaction.options.getUser("user") ?? user;
        return interaction.reply({ content: `👤 **اسم المستخدم:** ${target.username}\n🆔 **الـ ID الخاص به:** ${target.id}` });
      }

      if (cmd === "القوانين") {
        return interaction.reply({ content: "📜 **قوانين السيرفر:**\n1. الاحترام المتبادل.\n2. عدم نشر روابط خارجية وإعلانات سبام.\n3. التحدث فى الرومات المخصصة." });
      }

      if (cmd === "بروفايل") {
        const target = interaction.options.getUser("عضو") ?? user;
        const uData = db.getUser(target.id);
        return interaction.reply({ content: `✨ **بروفايل ${target.username}:**\n📊 المستوى: \`${uData.level}\`\n🪙 الكوينز: \`${uData.coins}\`\n⭐ الـ XP الحالي: \`${uData.xp}\`` });
      }

      if (cmd === "محفظة") {
        const uData = db.getUser(user.id);
        return interaction.reply({ content: `🪙 محفظتك فيها حالياً: **${uData.coins}** كوينز يسطا!` });
      }

      if (cmd === "العاب") {
        if (activeGames.has(channel.id)) return interaction.reply({ content: "❌ فيه لعبة شغالة هنا بالفعل!", ephemeral: true });
        activeGames.set(channel.id, true);
        const randomQ = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
        await interaction.reply({ content: `🎮 **لعبة السرعة بدأت!** أسرع إجابة تكسب 150 كوينز.\n\n🔥 **السؤال:** ${randomQ.q}` });

        const filter = (m) => !m.author.bot && randomQ.a.some(ans => m.content.trim() === ans);
        const collector = channel.createMessageCollector({ filter, time: 15000, max: 1 });

        collector.on("collect", (m) => {
          const uData = db.getUser(m.author.id);
          db.updateUser(m.author.id, { coins: uData.coins + 150 });
          m.reply(`🎉 إجابة صحيحة من ${m.author}! مبروك الـ **150 كوينز**! 🪙`);
        });
        collector.on("end", (collected) => {
          activeGames.delete(channel.id);
          if (collected.size === 0) channel.send(`⏰ خلص الوقت ومحدش جاوب! الإجابة هي: \`${randomQ.a[0]}\``);
        });
        return;
      }

      if (cmd === "متجر") {
        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle("🛒 متجر رتب السيرفر")
          .setDescription("🥇 Golden: 5000 كوينز\n🥈 Silver: 2500 كوينز\n🥉 Bronze: 1000 كوينز\n\nللشراء اكتب `/شراء الرتبة:(الاسم)`");
        return interaction.reply({ embeds: [embed] });
      }

      if (cmd === "شراء") {
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

      if (cmd === "إعطاء") {
        const target = interaction.options.getUser("عضو");
        const amount = interaction.options.getInteger("كمية");
        const uData = db.getUser(target.id);
        db.updateUser(target.id, { coins: uData.coins + amount });
        return interaction.reply({ content: `🪙 تم منح **${amount}** كوينز لـ ${target} بنجاح.` });
      }

      if (cmd === "يومي") {
        const uData = db.getUser(user.id);
        const now = Date.now();
        if (uData.lastDaily && now - uData.lastDaily < 86400000) return interaction.reply({ content: "❌ أخدت المكافأة بتاعتك النهاردة خلاص يسطا تعالي بكره!", ephemeral: true });
        db.updateUser(user.id, { coins: uData.coins + 200, lastDaily: now });
        return interaction.reply({ content: "🎁 أخدت الـ **200 كوينز** اليومية بتاعتك بنجاح! نوّرت المحفظة." });
      }

      if (cmd === "مانهوا-إنشاء") {
        const name = interaction.options.getString("الاسم");
        if (db.getManhwaDict(name) && Object.keys(db.getManhwaDict(name)).length > 0) return interaction.reply({ content: "❌ القاموس ده موجود بالفعل يسطا!", ephemeral: true });
        db.addManhwaTerm(name, "_init", "_init");
        return interaction.reply({ content: `✅ تم إنشاء قاموس مانهوا جديد باسم: **${name}**` });
      }

      if (cmd === "مانهوا-إضافة-مصطلح") {
        const mName = interaction.options.getString("المانهوا");
        const eng = interaction.options.getString("الإنجليزي");
        const arb = interaction.options.getString("العربي");
        if (!db.getManhwaDict(mName) || Object.keys(db.getManhwaDict(mName)).length === 0) return interaction.reply({ content: "❌ القاموس ده مش موجود، اعمله الأول!", ephemeral: true });
        db.addManhwaTerm(mName, eng, arb);
        return interaction.reply({ content: `✅ تم إضافة المصطلح بنجاح في قاموس **${mName}**.` });
      }

      if (cmd === "مانهوا-عرض-المصطلحات") {
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

      if (cmd === "مسح") {
        if (isFromDM) {
          return interaction.reply({ content: "⚡ عشان تمسح رسايل من الـ DM، قول للـ AI جوه الشات:\n**\"امسح X رسالة من قناة [اسم القناة]\"** 🤖", ephemeral: true });
        }
        const num = interaction.options.getInteger("عدد");
        await interaction.deferReply({ ephemeral: true });
        let remaining = num;
        let totalDeleted = 0;
        while (remaining > 0) {
          const batch = Math.min(remaining, 100);
          const deleted = await channel.bulkDelete(batch, true);
          totalDeleted += deleted.size;
          remaining -= batch;
          if (deleted.size < batch) break;
        }
        return interaction.editReply({ content: `🧹 تم تنظيف الروم ومسح **${totalDeleted}** رسالة!` });
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

      if (cmd === "تحذير") {
        const target = interaction.options.getUser("عضو");
        const reason = interaction.options.getString("السبب");
        db.addWarning(target.id, reason, "MANUAL_MODERATOR");
        return interaction.reply({ content: `⚠️ تم توجيه تحذير لـ ${target} بسبب: ${reason}` });
      }

      if (cmd === "اسكات") {
        const target = interaction.options.getUser("عضو");
        const dur = interaction.options.getInteger("مدة");
        const reason = interaction.options.getString("السبب") ?? "غير محدد";
        const member = await guild.members.fetch(target.id);
        await member.timeout(dur * 60 * 1000, reason);
        db.addTimeout(target.id, dur * 60 * 1000, reason);
        return interaction.reply({ content: `🔇 تم إسكات العضو ${target} لمدة ${dur} دقيقة.` });
      }

      if (cmd === "طرد") {
        const target = interaction.options.getUser("عضو");
        const reason = interaction.options.getString("السبب") ?? "غير محدد";
        const member = await guild.members.fetch(target.id);
        await member.kick(reason);
        return interaction.reply({ content: `👢 تم طرد العضو **${target.username}** من السيرفر.` });
      }

      if (cmd === "تبنيد") {
        const target = interaction.options.getUser("عضو");
        const reason = interaction.options.getString("السبب") ?? "غير محدد";
        await guild.members.ban(target.id, { reason });
        return interaction.reply({ content: `🔨 طيرنا الجبهة! تم تبنيد الباشا بنجاح بسبب: ${reason}` });
      }

      if (cmd === "مساعدة") {
        return interaction.reply({ content: "🤖 **جميع الأوامر بتشتغل بـ السلاش (`/`):**\nعامة: `ping`, `hello`, `serverinfo`\nنظام مالي: `بروفايل`, `محفظة`, `يومي`, `ليدربورد`\nميوزك: `play`, `skip`, `stop`, `queue`\n🎁 متقدم: `clean_chapter`, `translate_chapter`\n🧹 تنظيف سريع: `تنظيف_صورة`, `تنظيف_رابط`, `استخراج_نص`" });
      }

      if (cmd === "تحذيرات") {
        const target = interaction.options.getUser("عضو") ?? user;
        const warns = db.getWarnings(target.id);
        if (warns.length === 0) return interaction.reply({ content: "😇 العضو ده سجلّه أبيض وزي الفل!" });
        return interaction.reply({ content: `⚠️ عدد تحذيراته: **${warns.length}** تحذير.` });
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
        const prompt = interaction.options.getString("وصف");
        if (!_geminiReady) return interaction.reply("❌ ميزة توليد الصور بالذكاء الاصطناعي غير متاحة حالياً.");

        await interaction.deferReply();
        try {
          const result = await geminiImageModel().generateContent(prompt);
          const image = result.response.candidates[0].content.parts[0].inlineData;
          const imageBuffer = Buffer.from(image.data, 'base64');

          const attachment = new AttachmentBuilder(imageBuffer, { name: 'ai_image.png' });

          return interaction.editReply({ files: [attachment] });
        } catch (error) {
          logger.error("خطأ في توليد الصورة بالذكاء الاصطناعي:", error);
          return interaction.editReply("معلش يسطا ثواني بس");
        }
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
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
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
          await guild.members.fetch();
          const members = guild.members.cache.filter(m => !m.user.bot);
          let sent = 0, failed = 0;

          for (const [, member] of members) {
            await member.send({ embeds: [embed] }).then(() => sent++).catch(() => failed++);
            await new Promise(r => setTimeout(r, 500));
          }

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("✅ تم إرسال الرسالة الجماعية")
                .addFields(
                  { name: "📩 وصلت لـ", value: `${sent} عضو`, inline: true },
                  { name: "❌ فشلت مع", value: `${failed} عضو`, inline: true }
                )
                .setFooter({ text: "الفشل عادةً بسبب إعدادات الخصوصية عند العضو" })
                .setTimestamp()
            ]
          });
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

    } catch (err) {
      logger.error("خطأ في تنفيذ الأمر:", err);
      return interaction.reply({ content: "معلش يسطا ثواني بس", ephemeral: true }).catch(() => {});
    }
  }

  // التعامل مع الأزرار والمودال التفاعلية
  if (interaction.isButton()) {
    try {

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
          const { musicHandler: mh } = await import("./commands/music.js");
          const q = mh?.getQueue?.(g?.id);
          if (!q || q.length === 0) return interaction.reply({ content: "🎵 مفيش أغاني في القائمة دلوقتي!", ephemeral: true });
          const txt = q.slice(0, 5).map((s, i) => `**${i+1}.** ${s.title}`).join("\n");
          return interaction.reply({ content: `🎵 **قائمة التشغيل:**\n${txt}`, ephemeral: true });
        }

        // ⏹️ إيقاف الميوزك
        if (interaction.customId === "dmp_stop") {
          const { musicHandler: mh } = await import("./commands/music.js");
          mh?.stop?.(g?.id);
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
          const cloned = await targetChannel.clone({ reason: `مسح-الكل بواسطة ${interaction.user.tag}` });
          await cloned.setPosition(targetChannel.position);
          await targetChannel.delete(`مسح-الكل بواسطة ${interaction.user.tag}`);
          await cloned.send({ embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setDescription(`🧹 تم مسح الروم بالكامل بواسطة ${interaction.user} ✅`)
              .setTimestamp()
          ]});
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
    } catch (err) {
      logger.error("خطأ في معالجة الزر:", err);
      return interaction.reply({
        content: "معلش يسطا ثواني بس",
        ephemeral: true
      }).catch(() => {});
    }
  }

  if (interaction.isModalSubmit()) {
    try {
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
// ✅ [تعديل 6] حذف require() داخل الدالة — المكتبات محملة في الأعلى
client.on('guildMemberAdd', async (member) => {
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
        `👤 **الـعـضـو الـجـديـد:** <@${member.id}>\n` +
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
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
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
    bot: client.user ? client.user.tag : 'connecting...',
    uptime: Math.floor(process.uptime()),
  });
});

const _server = app.listen(PORT, () => {
  console.log(`✅ Server is ready and listening on port ${PORT}`);
});
_server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ البورت ${PORT} مشغول — في نسخة تانية شغالة، هيتم إغلاق هذه النسخة.`);
    process.exit(1);
  } else {
    throw err;
  }
});

// ═══════════════════════════════════════════════════════════════
//  نظام Keep-Alive المتطور — 24/7 بدون تهنيج
// ═══════════════════════════════════════════════════════════════
const SELF_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/health`
  : `http://localhost:${PORT}/health`;

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
    bot:        client.user?.tag ?? "connecting...",
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

client.login(process.env.DISCORD_TOKEN);
