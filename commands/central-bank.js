// ============================================================
// 🏦 البنك المركزي — أمر واحد بس: /بنك
// كل حاجة بتتحكم فيها من قايمة اختيار (Select Menu) واحدة
// Compatible with discord.js v14/v15 (ESM)
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

const CB = {
  name: "البنك المركزي",
  currency: "ذهب",
  icon: "💰",
  defaultChannelId: "1523690841468571789",
  claimMin: 200,
  claimMax: 500,
  claimCooldown: 4 * 60 * 60 * 1000, // 4 ساعات
  salaryMin: 800,
  salaryMax: 1500,
  salaryCooldown: 24 * 60 * 60 * 1000, // 24 ساعة
  heistCooldown: 2 * 60 * 60 * 1000, // ساعتين
  jailDuration: 30 * 60 * 1000, // 30 دقيقة
  maxSecurity: 10,
  securityBaseCost: 500,
};

const securityCost = (level) => Math.floor(CB.securityBaseCost * Math.pow(1.6, level));

function fmt(n) {
  return Math.floor(n).toLocaleString("en-US");
}

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

function getChannelId(db, guildId) {
  return db.getCentralBankChannel(guildId) || CB.defaultChannelId;
}

function inCorrectChannel(interaction, db) {
  return interaction.channelId === getChannelId(db, interaction.guildId);
}

// ── القائمة الرئيسية ────────────────────────────────────────────
function buildMainMenu(interaction, db) {
  const admin = isAdmin(interaction);
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏦 ${CB.name}`)
    .setDescription(`اختار العملية اللي عايز تعملها من القايمة تحت 👇\n\n💵 مطالبة و راتب — دخل دوري\n🔫 نهب — اسرق من رصيد حد تاني\n🛡️ أمان — احمي رصيدك\n👛 رصيد و 🏆 متصدرين — تابع نفسك والسيرفر`)
    .setFooter({ text: `${CB.icon} ${CB.name} — إدارة أموالك بذكاء` });

  const options = [
    { label: "مطالبة", description: `اطلب من ${CB.claimMin}-${CB.claimMax} ${CB.icon}`, value: "claim", emoji: "💵" },
    { label: "راتب", description: `استلم من ${CB.salaryMin}-${CB.salaryMax} ${CB.icon}`, value: "salary", emoji: "💼" },
    { label: "نهب", description: "حاول تسرق من رصيد حد تاني", value: "heist", emoji: "🔫" },
    { label: "أمان", description: "ارفع مستوى حماية رصيدك", value: "security", emoji: "🛡️" },
    { label: "رصيد", description: "شوف رصيدك وإحصائياتك", value: "balance", emoji: "👛" },
    { label: "متصدرين", description: "أغنى أعضاء البنك المركزي", value: "leaderboard", emoji: "🏆" },
  ];
  if (admin) {
    options.push({ label: "إدارة (أونر/أدمن)", description: "إضافة رصيد أو تغيير روم البنك", value: "admin", emoji: "👑" });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("cbank_menu")
    .setPlaceholder("اختار عملية...")
    .addOptions(options);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

export const centralBankCommand = {
  data: new SlashCommandBuilder()
    .setName("بنك")
    .setDescription(`🏦 ${CB.name} — كل حاجة من قايمة واحدة`),

  async execute(interaction, db) {
    if (!inCorrectChannel(interaction, db)) {
      const channelId = getChannelId(db, interaction.guildId);
      return interaction.reply({ content: `❌ أمر ${CB.name} يشتغل بس في روم <#${channelId}>.`, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ ...buildMainMenu(interaction, db), flags: MessageFlags.Ephemeral });
  },
};

// ── منطق العمليات ───────────────────────────────────────────────
async function doClaim(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const elapsed = Date.now() - p.lastClaim;
  if (elapsed < CB.claimCooldown) {
    return interaction.reply({ content: `⏳ تقدر تطالب تاني بعد ${formatCooldown(CB.claimCooldown - elapsed)}.`, flags: MessageFlags.Ephemeral });
  }
  const amount = Math.floor(Math.random() * (CB.claimMax - CB.claimMin + 1)) + CB.claimMin;
  const updated = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
    balance: p.balance + amount,
    lastClaim: Date.now(),
    totalEarned: p.totalEarned + amount,
  });
  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("💵 تم استلام المطالبة!")
      .setDescription(`استلمت \`${fmt(amount)}\` ${CB.icon}!\n\n👛 رصيدك دلوقتي: \`${fmt(updated.balance)}\` ${CB.icon}`)
      .setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

async function doSalary(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const elapsed = Date.now() - p.lastSalary;
  if (elapsed < CB.salaryCooldown) {
    return interaction.reply({ content: `⏳ لازم تستنى الراتب الجاي بعد ${formatCooldown(CB.salaryCooldown - elapsed)}.`, flags: MessageFlags.Ephemeral });
  }
  const amount = Math.floor(Math.random() * (CB.salaryMax - CB.salaryMin + 1)) + CB.salaryMin;
  const updated = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
    balance: p.balance + amount,
    lastSalary: Date.now(),
    totalEarned: p.totalEarned + amount,
  });
  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("💼 الراتب")
      .setDescription(`تم صرف راتبك: \`${fmt(amount)}\` ${CB.icon}\n\n👛 رصيدك دلوقتي: \`${fmt(updated.balance)}\` ${CB.icon}`)
      .setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

async function askHeistTarget(interaction) {
  const menu = new UserSelectMenuBuilder()
    .setCustomId("cbank_heist_user")
    .setPlaceholder("اختار الشخص اللي هتحاول تنهبه...")
    .setMaxValues(1);
  return interaction.reply({
    content: "🔫 اختار هدفك:",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function doHeist(interaction, db, targetUser) {
  const attacker = db.getCentralBankProfile(interaction.guildId, interaction.user.id);

  if (targetUser.id === interaction.user.id) {
    return interaction.reply({ content: "❌ مش هتقدر تنهب نفسك 😄", flags: MessageFlags.Ephemeral });
  }
  if (targetUser.bot) {
    return interaction.reply({ content: "❌ مش هتقدر تنهب بوت.", flags: MessageFlags.Ephemeral });
  }
  if (Date.now() < attacker.jailedUntil) {
    return interaction.reply({ content: `🚔 انت في السجن دلوقتي! متاح تنهب تاني بعد ${formatCooldown(attacker.jailedUntil - Date.now())}.`, flags: MessageFlags.Ephemeral });
  }
  const elapsed = Date.now() - attacker.lastHeist;
  if (elapsed < CB.heistCooldown) {
    return interaction.reply({ content: `⏳ استنى شوية قبل ما تحاول تنهب تاني — متاح بعد ${formatCooldown(CB.heistCooldown - elapsed)}.`, flags: MessageFlags.Ephemeral });
  }

  const defender = db.getCentralBankProfile(interaction.guildId, targetUser.id);
  if (defender.balance < 100) {
    return interaction.reply({ content: `❌ ${targetUser.username} مالوش رصيد يكفي عشان يتنهب (لازم 100 ${CB.icon} على الأقل).`, flags: MessageFlags.Ephemeral });
  }

  const gap = defender.security - attacker.security;
  let successChance = 0.55 - gap * 0.06;
  successChance = Math.max(0.1, Math.min(0.85, successChance));
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
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("🔫 نهب ناجح!")
        .setDescription(`نجحت تسرق \`${fmt(stolen)}\` ${CB.icon} من <@${targetUser.id}>!\n\n👛 رصيدك دلوقتي: \`${fmt(updatedAttacker.balance)}\` ${CB.icon}`)
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
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🚔 النهب فشل!")
        .setDescription(`انضبطت وانت بتحاول تنهب <@${targetUser.id}>!\nاتغرّمت \`${fmt(fine)}\` ${CB.icon} واتسجنت لمدة ${formatCooldown(CB.jailDuration)}.\n\n👛 رصيدك دلوقتي: \`${fmt(updatedAttacker.balance)}\` ${CB.icon}`)
        .setTimestamp()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

function buildSecurityPayload(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const nextLevel = Math.min(p.security + 1, CB.maxSecurity);
  const maxed = p.security >= CB.maxSecurity;
  const cost = maxed ? 0 : securityCost(p.security);

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🛡️ نظام الأمان")
    .setDescription(
      `مستوى الأمان بتاعك: **${p.security}/${CB.maxSecurity}**\n` +
      (maxed ? "🏆 وصلت لأعلى مستوى أمان!" : `تكلفة الترقية للمستوى ${nextLevel}: \`${fmt(cost)}\` ${CB.icon}`)
    )
    .addFields({ name: "👛 رصيدك", value: `\`${fmt(p.balance)}\` ${CB.icon}`, inline: true });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cbank_upgrade_security")
      .setLabel(maxed ? "أقصى مستوى" : `ترقية (${fmt(cost)} ${CB.icon})`)
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(maxed || p.balance < cost)
  );
  return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

function buildBalancePayload(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`👛 رصيدك في ${CB.name}`)
    .addFields(
      { name: "💰 الرصيد", value: `\`${fmt(p.balance)}\` ${CB.icon}`, inline: true },
      { name: "🛡️ مستوى الأمان", value: `${p.security}/${CB.maxSecurity}`, inline: true },
      { name: "📈 إجمالي المكسب", value: `\`${fmt(p.totalEarned)}\` ${CB.icon}`, inline: true },
      { name: "🔫 نهبات ناجحة", value: `${p.heistWins}`, inline: true },
      { name: "🚔 نهبات فاشلة", value: `${p.heistLosses}`, inline: true },
      { name: "⏱️ حالة السجن", value: Date.now() < p.jailedUntil ? `مسجون لـ ${formatCooldown(p.jailedUntil - Date.now())}` : "حر ✅", inline: true }
    )
    .setTimestamp();
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function buildLeaderboardPayload(interaction, db) {
  const top = db.getCentralBankLeaderboard(interaction.guildId, 10);
  if (!top.length) {
    return { content: "❌ لسه محدش عنده رصيد في البنك المركزي.", flags: MessageFlags.Ephemeral };
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = top.map((p, i) => `${medals[i] || `**${i + 1}.**`} <@${p.userId}> — \`${fmt(p.balance)}\` ${CB.icon}`);
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 أغنى أعضاء ${CB.name}`)
    .setDescription(lines.join("\n"))
    .setTimestamp();
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function buildAdminPayload() {
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("👑 لوحة إدارة البنك المركزي")
    .setDescription("اختار العملية:");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("cbank_admin_addbal").setLabel("إضافة رصيد لعضو").setEmoji("💰").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("cbank_admin_setchannel").setLabel("تغيير روم البنك").setEmoji("📌").setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

// ── التوجيه الرئيسي للقايمة ──────────────────────────────────────
export async function handleCentralBankSelect(interaction, db) {
  if (interaction.customId === "cbank_menu") {
    if (!inCorrectChannel(interaction, db)) {
      const channelId = getChannelId(db, interaction.guildId);
      return interaction.reply({ content: `❌ أمر ${CB.name} يشتغل بس في روم <#${channelId}>.`, flags: MessageFlags.Ephemeral });
    }
    const choice = interaction.values[0];
    if (choice === "claim")       return doClaim(interaction, db);
    if (choice === "salary")      return doSalary(interaction, db);
    if (choice === "heist")       return askHeistTarget(interaction);
    if (choice === "security")    return interaction.reply(buildSecurityPayload(interaction, db));
    if (choice === "balance")     return interaction.reply(buildBalancePayload(interaction, db));
    if (choice === "leaderboard") return interaction.reply(buildLeaderboardPayload(interaction, db));
    if (choice === "admin") {
      if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
      return interaction.reply(buildAdminPayload());
    }
  }
}

export async function handleCentralBankUserSelect(interaction, db) {
  if (interaction.customId === "cbank_heist_user") {
    if (!inCorrectChannel(interaction, db)) {
      const channelId = getChannelId(db, interaction.guildId);
      return interaction.reply({ content: `❌ أمر ${CB.name} يشتغل بس في روم <#${channelId}>.`, flags: MessageFlags.Ephemeral });
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
      .setLabel("الكمية")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("مثال: 5000")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    return interaction.showModal(modal);
  }
}

export async function handleCentralBankChannelSelect(interaction, db) {
  if (interaction.customId === "cbank_admin_setchannel_select") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const channel = interaction.channels.first();
    db.setCentralBankChannel(interaction.guildId, channel.id);
    return interaction.reply({ content: `✅ اتحدد <#${channel.id}> كروم البنك المركزي دلوقتي.`, flags: MessageFlags.Ephemeral });
  }
}

export async function handleCentralBankModal(interaction, db) {
  if (interaction.customId.startsWith("cbank_admin_addbal_modal_")) {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الأمر ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const targetId = interaction.customId.replace("cbank_admin_addbal_modal_", "");
    const amount = parseInt(interaction.fields.getTextInputValue("amount"), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return interaction.reply({ content: "❌ اكتب رقم صحيح وموجب.", flags: MessageFlags.Ephemeral });
    }
    const current = db.getCentralBankProfile(interaction.guildId, targetId);
    const p = db.saveCentralBankProfile(interaction.guildId, targetId, { balance: current.balance + amount });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ تم إضافة الرصيد")
        .setDescription(`اتضاف \`${fmt(amount)}\` ${CB.icon} لـ <@${targetId}>.\nرصيده دلوقتي: \`${fmt(p.balance)}\` ${CB.icon}`)],
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleCentralBankButton(interaction, db) {
  if (interaction.customId === "cbank_upgrade_security") {
    if (!inCorrectChannel(interaction, db)) {
      const channelId = getChannelId(db, interaction.guildId);
      return interaction.reply({ content: `❌ أمر ${CB.name} يشتغل بس في روم <#${channelId}>.`, flags: MessageFlags.Ephemeral });
    }
    const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
    if (p.security >= CB.maxSecurity) {
      return interaction.reply({ content: "🏆 وصلت لأعلى مستوى أمان بالفعل.", flags: MessageFlags.Ephemeral });
    }
    const cost = securityCost(p.security);
    if (p.balance < cost) {
      return interaction.reply({ content: `❌ رصيدك مش كفاية. محتاج \`${fmt(cost)}\` ${CB.icon}.`, flags: MessageFlags.Ephemeral });
    }
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

  if (interaction.customId === "cbank_admin_setchannel") {
    if (!isAdmin(interaction)) return interaction.reply({ content: "❌ الخيار ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId("cbank_admin_setchannel_select")
      .setPlaceholder("اختار الروم الجديد...")
      .addChannelTypes(ChannelType.GuildText)
      .setMaxValues(1);
    return interaction.reply({ content: "📌 اختار الروم:", components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }
}
