// ============================================================
// 🏦 البنك المركزي — نظام اقتصادي احترافي مستقل في روم واحدة
// مطالبة يومية + راتب + نهب/سرقة + أمان + متصدرين + إدارة أونر
// Compatible with discord.js v14/v15 (ESM)
// ============================================================

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

function getChannelId(db, guildId) {
  return db.getCentralBankChannel(guildId) || CB.defaultChannelId;
}

async function ensureCorrectChannel(interaction, db) {
  const channelId = getChannelId(db, interaction.guildId);
  if (interaction.channelId !== channelId) {
    await interaction.reply({
      content: `❌ أوامر ${CB.name} تشتغل بس في روم <#${channelId}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

export const centralBankCommand = {
  data: new SlashCommandBuilder()
    .setName("بنك-مركزي")
    .setDescription(`🏦 ${CB.name} — مطالبة، راتب، نهب، أمان، ومتصدرين`)
    .addSubcommand(sub => sub.setName("مطالبة").setDescription("💵 اطلب مكافأتك الدورية"))
    .addSubcommand(sub => sub.setName("راتب").setDescription("💼 استلم راتبك اليومي"))
    .addSubcommand(sub =>
      sub.setName("نهب")
        .setDescription("🔫 حاول تنهب من رصيد حد تاني")
        .addUserOption(o => o.setName("عضو").setDescription("الشخص اللي هتحاول تنهبه").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("امان").setDescription("🛡️ اترقّى في مستوى الأمان بتاعك"))
    .addSubcommand(sub => sub.setName("رصيد").setDescription("👛 شوف رصيدك ومستوى الأمان بتاعك"))
    .addSubcommand(sub => sub.setName("متصدرين").setDescription("🏆 أغنى الأعضاء في البنك المركزي"))
    .addSubcommand(sub => sub.setName("مساعدة").setDescription("📜 كل أوامر البنك المركزي وشرحها"))
    .addSubcommand(sub =>
      sub.setName("اضافة-رصيد")
        .setDescription("👑 [أونر] ضيف رصيد لعضو")
        .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
        .addIntegerOption(o => o.setName("قيمة").setDescription("الكمية").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("تعيين-قناة")
        .setDescription("👑 [أونر] حدد الروم اللي البنك المركزي هيشتغل فيه")
        .addChannelOption(o => o.setName("قناة").setDescription("الروم الجديد").setRequired(true))
    ),

  async execute(interaction, db) {
    const sub = interaction.options.getSubcommand();

    if (sub === "مساعدة") return showHelp(interaction, db);
    if (sub === "تعيين-قناة") return setChannel(interaction, db);
    if (sub === "اضافة-رصيد") return addBalanceAdmin(interaction, db);

    const ok = await ensureCorrectChannel(interaction, db);
    if (!ok) return;

    if (sub === "مطالبة")   return handleClaim(interaction, db);
    if (sub === "راتب")     return handleSalary(interaction, db);
    if (sub === "نهب")      return handleHeist(interaction, db);
    if (sub === "امان")     return showSecurityPanel(interaction, db, false);
    if (sub === "رصيد")     return showBalance(interaction, db);
    if (sub === "متصدرين") return showLeaderboard(interaction, db);
  },
};

async function showHelp(interaction, db) {
  const channelId = getChannelId(db, interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏦 ${CB.name} — دليل الأوامر`)
    .setDescription(`كل أوامر البنك المركزي تشتغل جوه <#${channelId}> فقط.`)
    .addFields(
      { name: "💵 /بنك-مركزي مطالبة", value: `اطلب من ${CB.claimMin}-${CB.claimMax} ${CB.icon} كل ${formatCooldown(CB.claimCooldown)}`, inline: false },
      { name: "💼 /بنك-مركزي راتب", value: `استلم من ${CB.salaryMin}-${CB.salaryMax} ${CB.icon} كل ${formatCooldown(CB.salaryCooldown)}`, inline: false },
      { name: "🔫 /بنك-مركزي نهب [عضو]", value: "حاول تسرق نسبة من رصيد حد تاني — كل ما مستوى أمانه أعلى كل ما يصعب تنجح، ولو فشلت هتتغرّم وتتسجن مؤقتاً", inline: false },
      { name: "🛡️ /بنك-مركزي امان", value: `ارفع مستوى الأمان بتاعك (أقصى مستوى ${CB.maxSecurity}) عشان تحمي رصيدك من النهب`, inline: false },
      { name: "👛 /بنك-مركزي رصيد", value: "شوف رصيدك ومستوى أمانك وإحصائياتك", inline: false },
      { name: "🏆 /بنك-مركزي متصدرين", value: "أغنى 10 أعضاء في البنك المركزي", inline: false }
    )
    .setFooter({ text: `${CB.icon} ${CB.name} — إدارة أموالك بذكاء` });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function setChannel(interaction, db) {
  if (!config.isOwner(interaction.user.id) && !interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ الأمر ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
  }
  const channel = interaction.options.getChannel("قناة");
  db.setCentralBankChannel(interaction.guildId, channel.id);
  return interaction.reply({
    content: `✅ اتحدد <#${channel.id}> كروم البنك المركزي دلوقتي.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function addBalanceAdmin(interaction, db) {
  if (!config.isOwner(interaction.user.id) && !interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ الأمر ده للأونر أو الأدمن بس.", flags: MessageFlags.Ephemeral });
  }
  const target = interaction.options.getUser("عضو");
  const amount = interaction.options.getInteger("قيمة");
  const p = db.saveCentralBankProfile(interaction.guildId, target.id, {
    balance: db.getCentralBankProfile(interaction.guildId, target.id).balance + amount,
  });
  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ تم إضافة الرصيد")
      .setDescription(`اتضاف \`${fmt(amount)}\` ${CB.icon} لـ <@${target.id}>.\nرصيده دلوقتي: \`${fmt(p.balance)}\` ${CB.icon}`)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleClaim(interaction, db) {
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
  });
}

async function handleSalary(interaction, db) {
  const p = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const elapsed = Date.now() - p.lastSalary;
  if (elapsed < CB.salaryCooldown) {
    return interaction.reply({ content: `⏳ لم يحن ميعاد إعدادك للرات بشكل صحيح — لازم تنتظر الراتب الجديد بعد ${formatCooldown(CB.salaryCooldown - elapsed)}.`, flags: MessageFlags.Ephemeral });
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
  });
}

async function handleHeist(interaction, db) {
  const attacker = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const target = interaction.options.getUser("عضو");

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: "❌ مش هتقدر تنهب نفسك 😄", flags: MessageFlags.Ephemeral });
  }
  if (target.bot) {
    return interaction.reply({ content: "❌ مش هتقدر تنهب بوت.", flags: MessageFlags.Ephemeral });
  }
  if (Date.now() < attacker.jailedUntil) {
    return interaction.reply({ content: `🚔 انت في السجن دلوقتي! متاح تنهب تاني بعد ${formatCooldown(attacker.jailedUntil - Date.now())}.`, flags: MessageFlags.Ephemeral });
  }
  const elapsed = Date.now() - attacker.lastHeist;
  if (elapsed < CB.heistCooldown) {
    return interaction.reply({ content: `⏳ استنى شوية قبل ما تحاول تنهب تاني — متاح بعد ${formatCooldown(CB.heistCooldown - elapsed)}.`, flags: MessageFlags.Ephemeral });
  }

  const defender = db.getCentralBankProfile(interaction.guildId, target.id);
  if (defender.balance < 100) {
    return interaction.reply({ content: `❌ ${target.username} مالوش رصيد يكفي عشان يتنهب (لازم 100 ${CB.icon} على الأقل).`, flags: MessageFlags.Ephemeral });
  }

  // فرصة النجاح: كل ما فرق الأمان لصالح المدافع أعلى، كل ما تقل فرصة النجاح
  const gap = defender.security - attacker.security;
  let successChance = 0.55 - gap * 0.06;
  successChance = Math.max(0.1, Math.min(0.85, successChance));

  const success = Math.random() < successChance;

  if (success) {
    const stealPct = 0.10 + Math.random() * 0.15; // 10% - 25%
    const stolen = Math.max(50, Math.floor(defender.balance * stealPct));
    db.saveCentralBankProfile(interaction.guildId, target.id, { balance: defender.balance - stolen });
    const updatedAttacker = db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
      balance: attacker.balance + stolen,
      lastHeist: Date.now(),
      heistWins: attacker.heistWins + 1,
      totalEarned: attacker.totalEarned + stolen,
    });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("🔫 نهب ناجح!")
        .setDescription(`نجحت تسرق \`${fmt(stolen)}\` ${CB.icon} من <@${target.id}>!\n\n👛 رصيدك دلوقتي: \`${fmt(updatedAttacker.balance)}\` ${CB.icon}`)
        .setTimestamp()],
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
        .setDescription(`انضبطت وانت بتحاول تنهب <@${target.id}>!\nاتغرّمت \`${fmt(fine)}\` ${CB.icon} واتسجنت لمدة ${formatCooldown(CB.jailDuration)}.\n\n👛 رصيدك دلوقتي: \`${fmt(updatedAttacker.balance)}\` ${CB.icon}`)
        .setTimestamp()],
    });
  }
}

async function showSecurityPanel(interaction, db, fromButton) {
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

  const payload = { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
  if (fromButton) await interaction.update(payload);
  else await interaction.reply(payload);
}

export async function handleCentralBankButton(interaction, db) {
  if (interaction.customId === "cbank_upgrade_security") {
    const ok = await ensureCorrectChannel(interaction, db);
    if (!ok) return;
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
    return showSecurityPanel(interaction, db, true);
  }
}

async function showBalance(interaction, db) {
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
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function showLeaderboard(interaction, db) {
  const top = db.getCentralBankLeaderboard(interaction.guildId, 10);
  if (!top.length) {
    return interaction.reply({ content: "❌ لسه محدش عنده رصيد في البنك المركزي.", flags: MessageFlags.Ephemeral });
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = top.map((p, i) => `${medals[i] || `**${i + 1}.**`} <@${p.userId}> — \`${fmt(p.balance)}\` ${CB.icon}`);
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 أغنى أعضاء ${CB.name}`)
    .setDescription(lines.join("\n"))
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}
