// ============================================================
// 🏦 البنك المركزي — أمر واحد بس: /بنك
// ⚜️ Black & Gold Luxury Theme
// ============================================================

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import config from "../config.js";
import { COLORS, footer, fmtNum as fmt } from "../helpers/theme.js";

const CB = {
  name: "البنك المركزي",
  currency: "ذهب",
  icon: "💰",
  defaultChannelId: "1523690841468571789",
  claimMin: 200,
  claimMax: 500,
  claimCooldown: 4 * 60 * 60 * 1000,
  salaryMin: 800,
  salaryMax: 1500,
  salaryCooldown: 24 * 60 * 60 * 1000,
  heistCooldown: 2 * 60 * 60 * 1000,
  jailDuration: 30 * 60 * 1000,
  maxSecurity: 10,
  securityBaseCost: 500,
};

const securityCost = (level) => Math.floor(CB.securityBaseCost * Math.pow(1.6, level));

function formatCooldown(ms) {
  if (ms <= 0) return "دلوقتي ✅";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ساعة و ${m} دقيقة`;
  if (m > 0) return `${m} دقيقة و ${sec} ثانية`;
  return `${sec} ثانية`;
}

function isAdmin(interaction) {
  return config.isOwner(interaction.user.id) || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

function getChannelIds(db, guildId) {
  const list = db.getCentralBankChannels(guildId);
  return list.length ? list : [CB.defaultChannelId];
}

function inCorrectChannel(interaction, db) {
  return getChannelIds(db, interaction.guildId).includes(interaction.channelId);
}

function channelsMention(db, guildId) {
  return getChannelIds(db, guildId).map(id => `<#${id}>`).join(" أو ");
}

// ── القائمة الرئيسية ──────────────────────────────────────────────
function buildMainMenu(interaction, db) {
  const admin = isAdmin(interaction);
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("🏦 البنك المركزي")
    .setDescription(
      "```\n⚜️  مرحباً بك في البنك المركزي\n   أدِر أموالك بذكاء وأسلوب\n```\n" +
      "اختار قسم من القايمة تحت لتبدأ 👇\n\n" +
      "⭐ **الأوامر العامة** — مطالبة، راتب، رصيد، متصدرين\n" +
      "🎮 **أوامر الألعاب** — نهب، أمان، وظيفة\n" +
      "💍 **أوامر الزواج** — زواج، طلاق، حالة اجتماعية"
    )
    .setFooter(footer("البنك المركزي"))
    .setTimestamp();

  const options = [
    { label: "الأوامر العامة", description: "مطالبة، راتب، رصيد، متصدرين، مساعدة", value: "cat_general", emoji: "⭐" },
    { label: "أوامر الألعاب", description: "نهب، أمان، وظيفة", value: "cat_games", emoji: "🎮" },
    { label: "أوامر الزواج", description: "زواج، طلاق، زواجات", value: "cat_marriage", emoji: "💍" },
  ];
  if (admin) {
    options.push({ label: "إدارة البنك", description: "إضافة رصيد، تحديد رومات البنك", value: "admin", emoji: "👑" });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("cbank_menu")
    .setPlaceholder("Make a selection")
    .addOptions(options);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ── قائمة الأوامر العامة ─────────────────────────────────────────
function buildGeneralMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("⭐ الأوامر العامة")
    .setDescription("اختار العملية اللي عايز تنفذها 👇")
    .setFooter(footer("البنك المركزي"));
  const menu = new StringSelectMenuBuilder()
    .setCustomId("cbank_sub_general")
    .setPlaceholder("Make a selection")
    .addOptions([
      { label: "مطالبة", description: `اطلب من ${CB.claimMin}–${CB.claimMax} ${CB.icon} (كل 4 ساعات)`, value: "claim", emoji: "💵" },
      { label: "راتب", description: `استلم من ${CB.salaryMin}–${CB.salaryMax} ${CB.icon} (كل 24 ساعة)`, value: "salary", emoji: "💼" },
      { label: "رصيد", description: "شوف رصيدك وإحصائياتك الكاملة", value: "balance", emoji: "👛" },
      { label: "متصدرين", description: "أغنى أعضاء البنك المركزي", value: "leaderboard", emoji: "🏆" },
      { label: "مساعدة", description: "دليل الأوامر الكامل", value: "help", emoji: "📜" },
      { label: "رجوع", description: "رجوع للقايمة الرئيسية", value: "back", emoji: "🔙" },
    ]);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ── وظايف ─────────────────────────────────────────────────────────
const JOBS = [
  { id: "طبيب",   label: "طبيب",   emoji: "🩺", multiplier: 1.6 },
  { id: "مهندس",  label: "مهندس",  emoji: "👷", multiplier: 1.4 },
  { id: "شرطي",   label: "شرطي",   emoji: "👮", multiplier: 1.2 },
  { id: "سائق",   label: "سائق",   emoji: "🚕", multiplier: 1.0 },
  { id: "طالب",   label: "طالب",   emoji: "🎓", multiplier: 0.6 },
];

function jobMultiplier(jobId) {
  const j = JOBS.find(j => j.id === jobId);
  return j ? j.multiplier : 1.0;
}

// ── قائمة الألعاب ─────────────────────────────────────────────────
function buildGamesMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.DARK_GOLD)
    .setTitle("🎮 أوامر الألعاب")
    .setDescription("اختار العملية اللي عايز تنفذها 👇")
    .setFooter(footer("البنك المركزي"));
  const menu = new StringSelectMenuBuilder()
    .setCustomId("cbank_sub_games")
    .setPlaceholder("Make a selection")
    .addOptions([
      { label: "نهب",     description: "حاول تسرق من رصيد حد تاني",       value: "heist",    emoji: "🔫" },
      { label: "أمان",    description: "ارفع مستوى حماية رصيدك من النهب", value: "security", emoji: "🛡️" },
      { label: "الوظيفة", description: "اختار وظيفة تزود راتبك",           value: "job",      emoji: "💼" },
      { label: "رجوع",    description: "رجوع للقايمة الرئيسية",             value: "back",     emoji: "🔙" },
    ]);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ── بيلود الوظيفة ─────────────────────────────────────────────────
function buildJobPayload(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const currentJob = p.job ? JOBS.find(j => j.id === p.job) : null;
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("💼 نظام الوظائف")
    .setDescription(
      `**وظيفتك الحالية:** ${currentJob ? `${currentJob.emoji} ${currentJob.label} — مضاعف الراتب x${currentJob.multiplier}` : "بدون وظيفة 😴"}\n\n` +
      `اختار وظيفة من القايمة — كل وظيفة بتأثر في قيمة راتبك اليومي.`
    )
    .setFooter(footer("البنك المركزي"));
  const menu = new StringSelectMenuBuilder()
    .setCustomId("cbank_job_select")
    .setPlaceholder("Make a selection")
    .addOptions(JOBS.map(j => ({
      label: `${j.label} — x${j.multiplier}`,
      description: `مضاعف الراتب: ×${j.multiplier}`,
      value: j.id,
      emoji: j.emoji,
    })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral };
}

// ── قائمة الزواج ──────────────────────────────────────────────────
function buildMarriageMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.MARRIAGE)
    .setTitle("💍 أوامر الزواج")
    .setDescription("اختار العملية اللي عايز تنفذها 👇")
    .setFooter(footer("البنك المركزي"));
  const menu = new StringSelectMenuBuilder()
    .setCustomId("cbank_sub_marriage")
    .setPlaceholder("Make a selection")
    .addOptions([
      { label: "زواج",     description: "اطلب يد حد من أعضاء السيرفر",       value: "marry",     emoji: "💍" },
      { label: "زواجي",    description: "شوف حالتك الاجتماعية",              value: "mystatus",  emoji: "❤️" },
      { label: "طلاق",     description: "اطلق شريكك الحالي",                value: "divorce",   emoji: "💔" },
      { label: "زواجات",   description: "أزواج السيرفر ومتصدري الزواجات",  value: "marriages", emoji: "📋" },
      { label: "رجوع",     description: "رجوع للقايمة الرئيسية",             value: "back",      emoji: "🔙" },
    ]);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ── تعريف الأمر ───────────────────────────────────────────────────
export const centralBankCommand = {
  data: new SlashCommandBuilder()
    .setName("بنك")
    .setDescription(`🏦 ${CB.name} — كل حاجة من قايمة واحدة`),

  async execute(interaction, db) {
    if (!inCorrectChannel(interaction, db)) {
      return interaction.reply({
        content: `❌ البنك المركزي بيشتغل بس في: ${channelsMention(db, interaction.guildId)}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({ ...buildMainMenu(interaction, db), flags: MessageFlags.Ephemeral });
  },
};

// ── مساعدة ────────────────────────────────────────────────────────
async function showHelp(interaction, db) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("📜 دليل البنك المركزي")
    .setDescription(`كل حاجة من أمر واحد: \`/بنك\` ← اختار من القايمة\n📍 يشتغل جوه: ${channelsMention(db, interaction.guildId)}`)
    .addFields(
      { name: "💵 مطالبة", value: `${CB.claimMin}–${CB.claimMax} ${CB.icon} • كل ${formatCooldown(CB.claimCooldown)}`, inline: true },
      { name: "💼 راتب",   value: `${CB.salaryMin}–${CB.salaryMax} ${CB.icon} • كل ${formatCooldown(CB.salaryCooldown)}`, inline: true },
      { name: "💼 وظيفة",  value: "اختار وظيفة تضاعف راتبك (طبيب ← أعلى مضاعف)", inline: false },
      { name: "🔫 نهب",    value: "حاول تسرق نسبة من رصيد حد تاني — الفشل = غرامة + سجن مؤقت", inline: false },
      { name: "🛡️ أمان",   value: `ارفع مستوى الحماية (أقصى ${CB.maxSecurity}) — كلما ارتفع كلما صعب تنهبك`, inline: false },
      { name: "💍 الزواج",  value: "نظام زواج كامل — اطلب، اقبل أو ارفض، اطلق", inline: false },
      { name: "👑 الإدارة", value: "إضافة رصيد للأعضاء + تحديد رومات البنك [أدمن/أونر]", inline: false },
    )
    .setFooter(footer("البنك المركزي — إدارة أموالك بذكاء"))
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ── منطق العمليات ─────────────────────────────────────────────────
async function doClaim(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const elapsed = Date.now() - p.lastClaim;
  if (elapsed < CB.claimCooldown) {
    return interaction.reply({
      content: `⏳ تقدر تطالب تاني بعد **${formatCooldown(CB.claimCooldown - elapsed)}**`,
      flags: MessageFlags.Ephemeral,
    });
  }
  const amount = Math.floor(Math.random() * (CB.claimMax - CB.claimMin + 1)) + CB.claimMin;
  const updated = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
    balance: p.balance + amount,
    lastClaim: Date.now(),
    totalEarned: p.totalEarned + amount,
  });
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle("💵 تم استلام المطالبة")
      .setDescription(`استلمت **${fmt(amount)} ${CB.icon}** بنجاح!\n\n👛 **رصيدك الآن:** \`${fmt(updated.balance)}\` ${CB.icon}`)
      .setFooter(footer("البنك المركزي"))
      .setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

async function doSalary(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const elapsed = Date.now() - p.lastSalary;
  if (elapsed < CB.salaryCooldown) {
    return interaction.reply({
      content: `⏳ الراتب الجاي بعد **${formatCooldown(CB.salaryCooldown - elapsed)}**`,
      flags: MessageFlags.Ephemeral,
    });
  }
  const base = Math.floor(Math.random() * (CB.salaryMax - CB.salaryMin + 1)) + CB.salaryMin;
  const amount = Math.floor(base * jobMultiplier(p.job));
  const updated = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
    balance: p.balance + amount,
    lastSalary: Date.now(),
    totalEarned: p.totalEarned + amount,
  });
  const jobObj = p.job ? JOBS.find(j => j.id === p.job) : null;
  const jobLine = jobObj
    ? `💼 **الوظيفة:** ${jobObj.emoji} ${jobObj.label} — مضاعف ×${jobObj.multiplier}`
    : `💼 **من غير وظيفة** — اختار وظيفة من **أوامر الألعاب** عشان تزود راتبك!`;
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle("💼 تم صرف الراتب")
      .setDescription(`استلمت **${fmt(amount)} ${CB.icon}**!\n${jobLine}\n\n👛 **رصيدك الآن:** \`${fmt(updated.balance)}\` ${CB.icon}`)
      .setFooter(footer("البنك المركزي"))
      .setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

async function askHeistTarget(interaction) {
  const menu = new UserSelectMenuBuilder()
    .setCustomId("cbank_heist_user")
    .setPlaceholder("اختار الهدف اللي هتحاول تنهبه...")
    .setMaxValues(1);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.HEIST)
      .setTitle("🔫 اختار هدفك")
      .setDescription("اختار العضو اللي هتحاول تسرق منه من القايمة تحت 👇\n\n⚠️ كلما كان مستوى أمانه أعلى كلما قلّت فرصة نجاحك!")
      .setFooter(footer("البنك المركزي"))],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function doHeist(interaction, db, targetUser) {
  const attacker = db.getCentralBankProfile(interaction.guildId, interaction.user.id);

  if (targetUser.id === interaction.user.id)
    return interaction.reply({ content: "❌ مش هتقدر تنهب نفسك!", flags: MessageFlags.Ephemeral });
  if (targetUser.bot)
    return interaction.reply({ content: "❌ مش هتقدر تنهب بوت.", flags: MessageFlags.Ephemeral });
  if (Date.now() < attacker.jailedUntil)
    return interaction.reply({ content: `🚔 أنت في السجن! يطلع بعد **${formatCooldown(attacker.jailedUntil - Date.now())}**`, flags: MessageFlags.Ephemeral });
  const elapsed = Date.now() - attacker.lastHeist;
  if (elapsed < CB.heistCooldown)
    return interaction.reply({ content: `⏳ تقدر تنهب تاني بعد **${formatCooldown(CB.heistCooldown - elapsed)}**`, flags: MessageFlags.Ephemeral });

  const defender = db.getCentralBankProfile(interaction.guildId, targetUser.id);
  if (defender.balance < 100)
    return interaction.reply({ content: `❌ ${targetUser.username} مالوش رصيد كافي عشان يتنهب (لازم 100 ${CB.icon} على الأقل)`, flags: MessageFlags.Ephemeral });

  const gap = defender.security - attacker.security;
  let successChance = Math.max(0.1, Math.min(0.85, 0.55 - gap * 0.06));
  const success = Math.random() < successChance;

  if (success) {
    const stealPct = 0.10 + Math.random() * 0.15;
    const stolen = Math.max(50, Math.floor(defender.balance * stealPct));
    db.saveCentralBankProfile(interaction.guildId, targetUser.id, { balance: defender.balance - stolen });
    const updatedAttacker = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
      balance: attacker.balance + stolen,
      lastHeist: Date.now(),
      heistWins: attacker.heistWins + 1,
      totalEarned: attacker.totalEarned + stolen,
    });
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.HEIST)
        .setTitle("🔫 نهب ناجح!")
        .setDescription(`سرقت **${fmt(stolen)} ${CB.icon}** من <@${targetUser.id}> بنجاح!\n\n👛 **رصيدك الآن:** \`${fmt(updatedAttacker.balance)}\` ${CB.icon}`)
        .setFooter(footer("البنك المركزي"))
        .setTimestamp()],
      flags: MessageFlags.Ephemeral,
    });
  } else {
    const fine = Math.max(50, Math.floor(attacker.balance * 0.15));
    const updatedAttacker = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
      balance: Math.max(0, attacker.balance - fine),
      lastHeist: Date.now(),
      heistLosses: attacker.heistLosses + 1,
      jailedUntil: Date.now() + CB.jailDuration,
    });
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle("🚔 النهب فشل!")
        .setDescription(`انضبطت وانت بتحاول تنهب <@${targetUser.id}>!\n💸 غرامة: **${fmt(fine)} ${CB.icon}** + سجن **${formatCooldown(CB.jailDuration)}**\n\n👛 **رصيدك الآن:** \`${fmt(updatedAttacker.balance)}\` ${CB.icon}`)
        .setFooter(footer("البنك المركزي"))
        .setTimestamp()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

// ── نظام الزواج ───────────────────────────────────────────────────
async function askMarryTarget(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  if (p.marriedTo) {
    return interaction.reply({ content: `❌ أنت متجوز بالفعل من <@${p.marriedTo}>! لازم تطلق الأول.`, flags: MessageFlags.Ephemeral });
  }
  const menu = new UserSelectMenuBuilder()
    .setCustomId("cbank_marry_user")
    .setPlaceholder("اختار شريك حياتك...")
    .setMaxValues(1);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.MARRIAGE)
      .setTitle("💍 طلب الزواج")
      .setDescription("اختار العضو اللي عايز تتجوزه 👇\nهيوصله طلب زواج رسمي ويقبل أو يرفض.")
      .setFooter(footer("البنك المركزي"))],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function sendMarriageProposal(interaction, db, targetUser) {
  const proposer = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const target = db.getCentralBankProfile(interaction.guildId, targetUser.id);

  if (targetUser.id === interaction.user.id)
    return interaction.reply({ content: "❌ مش هتقدر تتجوز نفسك!", flags: MessageFlags.Ephemeral });
  if (targetUser.bot)
    return interaction.reply({ content: "❌ مش هتقدر تتجوز بوت.", flags: MessageFlags.Ephemeral });
  if (proposer.marriedTo)
    return interaction.reply({ content: "❌ أنت متجوز بالفعل! لازم تطلق الأول.", flags: MessageFlags.Ephemeral });
  if (target.marriedTo)
    return interaction.reply({ content: `❌ <@${targetUser.id}> متجوز بالفعل من حد تاني.`, flags: MessageFlags.Ephemeral });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cbank_marry_accept_${interaction.user.id}_${targetUser.id}`).setLabel("قبول 💍").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cbank_marry_reject_${interaction.user.id}_${targetUser.id}`).setLabel("رفض 💔").setStyle(ButtonStyle.Danger),
  );
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.MARRIAGE)
      .setTitle("💍 طلب زواج رسمي")
      .setDescription(`<@${targetUser.id}>\n\n<@${interaction.user.id}> بيطلب إيدك للزواج! 💝\n\nهل توافق على الزواج؟`)
      .setFooter(footer("البنك المركزي"))],
    components: [row],
  });
}

async function handleMarriageDecision(interaction, db, accepted, proposerId, targetId) {
  if (interaction.user.id !== targetId)
    return interaction.reply({ content: "❌ الطلب ده مش ليك.", flags: MessageFlags.Ephemeral });
  if (!accepted)
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(COLORS.ERROR).setTitle("💔 تم رفض طلب الزواج")
        .setDescription(`<@${targetId}> رفض طلب الزواج من <@${proposerId}>.`)
        .setFooter(footer("البنك المركزي"))],
      components: [],
    });
  const proposer = db.getCentralBankProfile(interaction.guildId, proposerId);
  const target = db.getCentralBankProfile(interaction.guildId, targetId);
  if (proposer.marriedTo || target.marriedTo)
    return interaction.update({ content: "❌ واحد منكم اتجوز بالفعل قبل الموافقة.", components: [] });
  db.saveCentralBankProfile(interaction.guildId, proposerId, { marriedTo: targetId, marriedAt: Date.now() });
  db.saveCentralBankProfile(interaction.guildId, targetId, { marriedTo: proposerId, marriedAt: Date.now() });
  return interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.MARRIAGE)
      .setTitle("💍 زواج رسمي مبارك!")
      .setDescription(`🎉 مبروك! <@${proposerId}> و <@${targetId}> بقوا متجوزين رسمياً!\n\nربنا يديم المودة والرحمة بينكم 💕`)
      .setFooter(footer("البنك المركزي"))
      .setTimestamp()],
    components: [],
  });
}

async function doDivorce(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  if (!p.marriedTo)
    return interaction.reply({ content: "❌ أنت مش متجوز عشان تطلق.", flags: MessageFlags.Ephemeral });
  const partnerId = p.marriedTo;
  db.saveCentralBankProfile(interaction.guildId, interaction.user.id, { marriedTo: null, marriedAt: 0 });
  db.saveCentralBankProfile(interaction.guildId, partnerId, { marriedTo: null, marriedAt: 0 });
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle("💔 تم الطلاق")
      .setDescription(`اتطلقت من <@${partnerId}> رسمياً.`)
      .setFooter(footer("البنك المركزي"))
      .setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

function buildMarriageStatusPayload(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const embed = new EmbedBuilder().setColor(COLORS.MARRIAGE).setTitle("❤️ حالتك الاجتماعية")
    .setFooter(footer("البنك المركزي")).setTimestamp();
  if (p.marriedTo) {
    embed.setDescription(`💍 **متجوز من:** <@${p.marriedTo}>\n📅 **من تاريخ:** <t:${Math.floor(p.marriedAt / 1000)}:D>`);
  } else {
    embed.setDescription("🕊️ عازب حالياً — استخدم **أوامر الزواج** لتغيير ذلك!");
  }
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function buildMarriagesListPayload(interaction, db) {
  const guild = db.data && db.data.centralBank ? db.data.centralBank[interaction.guildId] : null;
  const profiles = (guild && guild.profiles) || {};
  const seen = new Set();
  const pairs = [];
  for (const [userId, profile] of Object.entries(profiles)) {
    if (profile.marriedTo && !seen.has(userId) && !seen.has(profile.marriedTo)) {
      pairs.push({ a: userId, b: profile.marriedTo, at: profile.marriedAt });
      seen.add(userId);
      seen.add(profile.marriedTo);
    }
  }
  if (!pairs.length) {
    return { content: "💔 لسه محدش اتجوز في السيرفر ده.", flags: MessageFlags.Ephemeral };
  }
  pairs.sort((x, y) => x.at - y.at);
  const lines = pairs.slice(0, 15).map((pr, i) => `**${i + 1}.** <@${pr.a}> 💍 <@${pr.b}>`);
  const embed = new EmbedBuilder()
    .setColor(COLORS.MARRIAGE)
    .setTitle("💍 زواجات السيرفر")
    .setDescription(lines.join("\n"))
    .setFooter(footer(`${pairs.length} زوج مسجل`))
    .setTimestamp();
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

// ── الأمان ────────────────────────────────────────────────────────
function buildSecurityPayload(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const nextLevel = Math.min(p.security + 1, CB.maxSecurity);
  const maxed = p.security >= CB.maxSecurity;
  const cost = maxed ? 0 : securityCost(p.security);

  const secBar = "🟨".repeat(p.security) + "⬛".repeat(CB.maxSecurity - p.security);
  const embed = new EmbedBuilder()
    .setColor(COLORS.DARK_GOLD)
    .setTitle("🛡️ نظام الأمان")
    .setDescription(
      `**مستوى أمانك:** ${secBar} (${p.security}/${CB.maxSecurity})\n\n` +
      (maxed
        ? "🏆 **وصلت لأقصى مستوى أمان — رصيدك محمي بالكامل!**"
        : `تكلفة الترقية للمستوى **${nextLevel}**: \`${fmt(cost)}\` ${CB.icon}`)
    )
    .addFields({ name: "👛 رصيدك الحالي", value: `\`${fmt(p.balance)}\` ${CB.icon}`, inline: true })
    .setFooter(footer("البنك المركزي"))
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cbank_upgrade_security")
      .setLabel(maxed ? "✅ أقصى مستوى" : `⬆️ ترقية — ${fmt(cost)} ${CB.icon}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(maxed || p.balance < cost)
  );
  return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

// ── الرصيد ────────────────────────────────────────────────────────
function buildBalancePayload(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const jobObj = p.job ? JOBS.find(j => j.id === p.job) : null;
  const secBar = "🟨".repeat(p.security) + "⬛".repeat(CB.maxSecurity - p.security);
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`👛 رصيد ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "💰 الرصيد",         value: `\`${fmt(p.balance)}\` ${CB.icon}`,    inline: true },
      { name: "📈 إجمالي المكسب",  value: `\`${fmt(p.totalEarned)}\` ${CB.icon}`, inline: true },
      { name: "💼 الوظيفة",        value: jobObj ? `${jobObj.emoji} ${jobObj.label} (×${jobObj.multiplier})` : "بدون وظيفة", inline: true },
      { name: "🛡️ مستوى الأمان",  value: `${secBar} (${p.security}/${CB.maxSecurity})`, inline: false },
      { name: "🔫 نهبات ناجحة",    value: `${p.heistWins}`, inline: true },
      { name: "🚔 نهبات فاشلة",    value: `${p.heistLosses}`, inline: true },
      { name: "⏱️ حالة السجن",     value: Date.now() < p.jailedUntil ? `🔒 مسجون لـ ${formatCooldown(p.jailedUntil - Date.now())}` : "🟢 حر", inline: true },
    )
    .setFooter(footer("البنك المركزي"))
    .setTimestamp();
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

// ── المتصدرين ─────────────────────────────────────────────────────
function buildLeaderboardPayload(interaction, db) {
  const top = db.getCentralBankLeaderboard(interaction.guildId, 10);
  if (!top.length) {
    return { content: "📭 لسه محدش عنده رصيد في البنك المركزي.", flags: MessageFlags.Ephemeral };
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = top.map((p, i) =>
    `${medals[i] || `**${i + 1}.**`} <@${p.userId}> — \`${fmt(p.balance)}\` ${CB.icon}`
  );
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 أغنى أعضاء البنك المركزي`)
    .setDescription(lines.join("\n"))
    .setFooter(footer("البنك المركزي"))
    .setTimestamp();
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

// ── الإدارة ───────────────────────────────────────────────────────
function buildAdminPayload(db, guildId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.DARK_GOLD)
    .setTitle("👑 إدارة البنك المركزي")
    .setDescription(`اختار العملية المطلوبة:\n\n📌 **الرومات الحالية:** ${channelsMention(db, guildId)}`)
    .setFooter(footer("البنك المركزي — لوحة الإدارة"));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("cbank_admin_addbal").setLabel("إضافة رصيد").setEmoji("💰").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("cbank_admin_addchannel").setLabel("إضافة روم").setEmoji("📌").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("cbank_admin_removechannel").setLabel("حذف روم").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

// ── التوجيه الرئيسي للقوائم ──────────────────────────────────────
export async function handleCentralBankSelect(interaction, db) {
  if (interaction.customId === "cbank_menu") {
    if (!inCorrectChannel(interaction, db)) {
      return interaction.reply({ content: `❌ البنك المركزي يشتغل بس في: ${channelsMention(db, interaction.guildId)}`, flags: MessageFlags.Ephemeral });
    }
    const choice = interaction.values[0];
    if (choice === "cat_general")  return interaction.reply({ ...buildGeneralMenu(), flags: MessageFlags.Ephemeral });
    if (choice === "cat_games")    return interaction.reply({ ...buildGamesMenu(), flags: MessageFlags.Ephemeral });
    if (choice === "cat_marriage") return interaction.reply({ ...buildMarriageMenu(), flags: MessageFlags.Ephemeral });
    if (choice === "admin") {
      if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
      return interaction.reply(buildAdminPayload(db, interaction.guildId));
    }
    return;
  }

  if (interaction.customId === "cbank_sub_general") {
    const choice = interaction.values[0];
    if (choice === "back")        return interaction.update(buildMainMenu(interaction, db));
    if (choice === "claim")       return doClaim(interaction, db);
    if (choice === "salary")      return doSalary(interaction, db);
    if (choice === "balance")     return interaction.reply(buildBalancePayload(interaction, db));
    if (choice === "leaderboard") return interaction.reply(buildLeaderboardPayload(interaction, db));
    if (choice === "help")        return showHelp(interaction, db);
    return;
  }

  if (interaction.customId === "cbank_sub_games") {
    const choice = interaction.values[0];
    if (choice === "back")     return interaction.update(buildMainMenu(interaction, db));
    if (choice === "heist")    return askHeistTarget(interaction);
    if (choice === "security") return interaction.reply(buildSecurityPayload(interaction, db));
    if (choice === "job")      return interaction.reply(buildJobPayload(interaction, db));
    return;
  }

  if (interaction.customId === "cbank_job_select") {
    const jobId = interaction.values[0];
    db.saveCentralBankProfile(interaction.guildId, interaction.user.id, { job: jobId });
    const j = JOBS.find(x => x.id === jobId);
    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle("✅ تم تعيين الوظيفة")
        .setDescription(`بقيت دلوقتي **${j.emoji} ${j.label}** — راتبك هيتضاعف بـ ×${j.multiplier}!`)
        .setFooter(footer("البنك المركزي"))
        .setTimestamp()],
      components: [],
    });
  }

  if (interaction.customId === "cbank_sub_marriage") {
    const choice = interaction.values[0];
    if (choice === "back")      return interaction.update(buildMainMenu(interaction, db));
    if (choice === "marry")     return askMarryTarget(interaction, db);
    if (choice === "mystatus")  return interaction.reply(buildMarriageStatusPayload(interaction, db));
    if (choice === "divorce")   return doDivorce(interaction, db);
    if (choice === "marriages") return interaction.reply(buildMarriagesListPayload(interaction, db));
    return;
  }
}

export async function handleCentralBankUserSelect(interaction, db) {
  if (interaction.customId === "cbank_heist_user") {
    if (!inCorrectChannel(interaction, db)) {
      return interaction.reply({ content: `❌ البنك المركزي يشتغل بس في: ${channelsMention(db, interaction.guildId)}`, flags: MessageFlags.Ephemeral });
    }
    const targetUser = interaction.users.first();
    return doHeist(interaction, db, targetUser);
  }
  if (interaction.customId === "cbank_admin_addbal_user") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const targetUser = interaction.users.first();
    const modal = new ModalBuilder()
      .setCustomId(`cbank_admin_addbal_modal_${targetUser.id}`)
      .setTitle(`إضافة رصيد لـ ${targetUser.username}`);
    const amountInput = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("الكمية المراد إضافتها")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("مثال: 5000")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    return interaction.showModal(modal);
  }
  if (interaction.customId === "cbank_marry_user") {
    if (!inCorrectChannel(interaction, db)) {
      return interaction.reply({ content: `❌ البنك المركزي يشتغل بس في: ${channelsMention(db, interaction.guildId)}`, flags: MessageFlags.Ephemeral });
    }
    const targetUser = interaction.users.first();
    return sendMarriageProposal(interaction, db, targetUser);
  }
}

export async function handleCentralBankChannelSelect(interaction, db) {
  if (interaction.customId === "cbank_admin_addchannel_select") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const channel = interaction.channels.first();
    db.addCentralBankChannel(interaction.guildId, channel.id);
    return interaction.reply({
      content: `✅ اتضاف <#${channel.id}> كروم للبنك المركزي.\n📌 الرومات الحالية: ${channelsMention(db, interaction.guildId)}`,
      flags: MessageFlags.Ephemeral,
    });
  }
  if (interaction.customId === "cbank_admin_removechannel_select") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const channel = interaction.channels.first();
    const remaining = db.removeCentralBankChannel(interaction.guildId, channel.id);
    return interaction.reply({
      content: remaining.length
        ? `✅ اتشال <#${channel.id}> من رومات البنك.\n📌 الرومات الحالية: ${channelsMention(db, interaction.guildId)}`
        : `✅ اتشال <#${channel.id}>. مفيش رومات متحددة — هيستخدم الروم الافتراضي.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleCentralBankModal(interaction, db) {
  if (interaction.customId.startsWith("cbank_admin_addbal_modal_")) {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الأمر ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const targetId = interaction.customId.replace("cbank_admin_addbal_modal_", "");
    const amount = parseInt(interaction.fields.getTextInputValue("amount"), 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return interaction.reply({ content: "❌ اكتب رقم صحيح وموجب.", flags: MessageFlags.Ephemeral });
    const current = db.getCentralBankProfile(interaction.guildId, targetId);
    const p = db.saveCentralBankProfile(interaction.guildId, targetId, { balance: current.balance + amount });
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle("✅ تم إضافة الرصيد")
        .setDescription(`اتضاف **${fmt(amount)} ${CB.icon}** لـ <@${targetId}>\nرصيده الآن: \`${fmt(p.balance)}\` ${CB.icon}`)
        .setFooter(footer("البنك المركزي — الإدارة"))
        .setTimestamp()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleCentralBankButton(interaction, db) {
  if (interaction.customId.startsWith("cbank_marry_accept_") || interaction.customId.startsWith("cbank_marry_reject_")) {
    const accepted = interaction.customId.startsWith("cbank_marry_accept_");
    const prefix = accepted ? "cbank_marry_accept_" : "cbank_marry_reject_";
    const [proposerId, targetId] = interaction.customId.replace(prefix, "").split("_");
    return handleMarriageDecision(interaction, db, accepted, proposerId, targetId);
  }

  if (interaction.customId === "cbank_upgrade_security") {
    if (!inCorrectChannel(interaction, db)) {
      return interaction.reply({ content: `❌ البنك المركزي يشتغل بس في: ${channelsMention(db, interaction.guildId)}`, flags: MessageFlags.Ephemeral });
    }
    const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
    if (p.security >= CB.maxSecurity)
      return interaction.reply({ content: "🏆 وصلت لأقصى مستوى أمان بالفعل.", flags: MessageFlags.Ephemeral });
    const cost = securityCost(p.security);
    if (p.balance < cost)
      return interaction.reply({ content: `❌ رصيدك مش كافي. محتاج \`${fmt(cost)}\` ${CB.icon}`, flags: MessageFlags.Ephemeral });
    db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
      balance: p.balance - cost,
      security: p.security + 1,
    });
    return interaction.update(buildSecurityPayload(interaction, db));
  }

  if (interaction.customId === "cbank_admin_addbal") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const menu = new UserSelectMenuBuilder()
      .setCustomId("cbank_admin_addbal_user")
      .setPlaceholder("اختار العضو اللي هتضيفله رصيد...")
      .setMaxValues(1);
    return interaction.reply({ content: "💰 اختار العضو:", components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }

  if (interaction.customId === "cbank_admin_addchannel") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId("cbank_admin_addchannel_select")
      .setPlaceholder("اختار الروم اللي هتضيفه...")
      .addChannelTypes(ChannelType.GuildText)
      .setMaxValues(1);
    return interaction.reply({ content: "📌 اختار الروم:", components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }

  if (interaction.customId === "cbank_admin_removechannel") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId("cbank_admin_removechannel_select")
      .setPlaceholder("اختار الروم اللي هتشيله...")
      .addChannelTypes(ChannelType.GuildText)
      .setMaxValues(1);
    return interaction.reply({ content: "🗑️ اختار الروم:", components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }
}
