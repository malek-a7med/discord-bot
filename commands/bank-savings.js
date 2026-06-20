// ============================================================
// 🏦 بنك الادخار — بنك زنجي
// بنك حقيقي (مش قمار): إيداع + سحب + فايدة يومية + تحويل
// Compatible with discord.js v14/v15 (ESM)
// ============================================================

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";

const BANK_CONFIG = {
  bankName: "بنك زنجي",
  currency: "كوينز",
  dailyInterestRate: 0.05,
  maxInterestPct: 0.5,
  interestMinInterval: 3600000,
  minDeposit: 10,
  maxDeposit: 10_000_000,
  minWithdraw: 10,
  minTransfer: 10,
  maxTransfer: 10_000_000,
};

const bankCooldowns = new Map();
const isOnCooldown = (uid) => {
  const now = Date.now();
  const last = bankCooldowns.get(uid) || 0;
  if (now - last < 3000) return true;
  bankCooldowns.set(uid, now);
  return false;
};

const getBankData = (user) => {
  if (typeof user.bankCoins !== "number") user.bankCoins = 0;
  if (typeof user.lastBankInterest !== "number") user.lastBankInterest = 0;
  return { bankCoins: user.bankCoins, lastInterestTs: user.lastBankInterest };
};

const calculatePendingInterest = (bankCoins, lastInterestTs) => {
  if (bankCoins <= 0 || !lastInterestTs) return 0;
  const days = (Date.now() - lastInterestTs) / 86_400_000;
  const raw = Math.floor(bankCoins * BANK_CONFIG.dailyInterestRate * days);
  const cap = Math.floor(bankCoins * BANK_CONFIG.maxInterestPct);
  return Math.max(0, Math.min(raw, cap));
};

export const bankSavingsCommand = {
  data: new SlashCommandBuilder()
    .setName("بنك-الادخار")
    .setDescription("🏦 افتح بنك الادخار - احفظ كوينزك واكسب فايدة يومية 5%"),

  async execute(interaction, db) {
    return showBankPanel(interaction, db, false);
  },
};

export async function handleBankButton(interaction, db) {
  const id = interaction.customId;
  if (isOnCooldown(interaction.user.id)) {
    return interaction.reply({ content: "⏳ استنى ثانية، في عملية تانية شغالة.", flags: MessageFlags.Ephemeral });
  }
  try {
    if (id === "bsav_panel")    return showBankPanel(interaction, db, true);
    if (id === "bsav_deposit")  return showDepositModal(interaction);
    if (id === "bsav_withdraw") return showWithdrawModal(interaction);
    if (id === "bsav_transfer") return showTransferModal(interaction);
    if (id === "bsav_collect")  return collectInterest(interaction, db);
    if (id === "bsav_info")     return showBankInfo(interaction);
  } catch (err) {
    console.error("[bank-savings] button error:", err);
    const payload = { content: "❌ حصلت مشكلة، حاول تاني.", flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
}

export async function handleBankModal(interaction, db) {
  const id = interaction.customId;
  try {
    if (id === "bsav_modal_deposit")  return processDeposit(interaction, db);
    if (id === "bsav_modal_withdraw") return processWithdraw(interaction, db);
    if (id === "bsav_modal_transfer") return processTransfer(interaction, db);
  } catch (err) {
    console.error("[bank-savings] modal error:", err);
    const payload = { content: "❌ حصلت مشكلة، حاول تاني.", flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
}

async function showBankPanel(interaction, db, fromButton) {
  const user = db.getUser(interaction.user.id);
  const { bankCoins, lastInterestTs } = getBankData(user);
  const pending = calculatePendingInterest(bankCoins, lastInterestTs);
  const wallet = user.coins || 0;
  const pct = bankCoins > 0 ? Math.min(100, (pending / Math.max(1, Math.floor(bankCoins * BANK_CONFIG.maxInterestPct))) * 100) : 0;
  const bar = makeProgressBar(pct, 16);
  const nextCollectIn = lastInterestTs
    ? formatCooldown(BANK_CONFIG.interestMinInterval - (Date.now() - lastInterestTs))
    : "متاح دلوقتي ✅";

  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(`🏦 ${BANK_CONFIG.bankName}`)
    .setDescription(
      `أهلاً بيك يا **${interaction.user.username}**!\n` +
      `ده بنك الادخار بتاعك — حط كوينزك هنا واكسب فايدة يومية 5% (حد أقصى 50% من رصيدك).`
    )
    .addFields(
      { name: "👛 محفظتك",                value: `\`${wallet.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}`, inline: true },
      { name: "🏦 رصيد البنك",             value: `\`${bankCoins.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}`, inline: true },
      { name: "💸 الفايدة المتاحة للتحصيل", value: `\`${pending.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}\n${bar}`, inline: false },
      { name: "⏱️ التحصيل القادم",          value: nextCollectIn, inline: true },
      { name: "📈 نسبة الفايدة اليومية",    value: `${(BANK_CONFIG.dailyInterestRate * 100).toFixed(1)}%`, inline: true }
    )
    .setFooter({ text: "💡 نصيحة: كل ما رصيدك يفضل في البنك أكتر، كل ما تكسب فايدة أكتر!" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bsav_deposit").setLabel("إيداع").setEmoji("💰").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("bsav_withdraw").setLabel("سحب").setEmoji("💸").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("bsav_transfer").setLabel("تحويل").setEmoji("🔁").setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bsav_collect").setLabel("تحصيل الفايدة").setEmoji("🎁").setStyle(ButtonStyle.Success).setDisabled(pending <= 0),
    new ButtonBuilder().setCustomId("bsav_info").setLabel("قوانين البنك").setEmoji("📜").setStyle(ButtonStyle.Secondary)
  );

  const payload = { embeds: [embed], components: [row1, row2], flags: MessageFlags.Ephemeral };
  if (fromButton) { await interaction.update(payload); } else { await interaction.reply(payload); }
}

async function showDepositModal(interaction) {
  const modal = new ModalBuilder().setCustomId("bsav_modal_deposit").setTitle("💰 إيداع في البنك");
  const input = new TextInputBuilder()
    .setCustomId("bsav_amount")
    .setLabel(`كام ${BANK_CONFIG.currency} عايز تودع؟ (الحد الأدنى ${BANK_CONFIG.minDeposit})`)
    .setPlaceholder("مثال: 500").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(10);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function processDeposit(interaction, db) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const raw = interaction.fields.getTextInputValue("bsav_amount").trim();
  const amount = parseInt(raw.replace(/[,_\s]/g, ""), 10);

  if (!Number.isFinite(amount) || amount <= 0) return interaction.editReply("❌ المبلغ مش صحيح. اكتب رقم بس.");
  if (amount < BANK_CONFIG.minDeposit) return interaction.editReply(`❌ الحد الأدنى للإيداع هو \`${BANK_CONFIG.minDeposit}\` ${BANK_CONFIG.currency}.`);
  if (amount > BANK_CONFIG.maxDeposit) return interaction.editReply(`❌ الحد الأقصى للإيداع هو \`${BANK_CONFIG.maxDeposit.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}.`);

  const user = db.getUser(interaction.user.id);
  if ((user.coins || 0) < amount) return interaction.editReply(`❌ رصيدك في المحفظة مش كفاية.\n👛 عندك: \`${(user.coins || 0).toLocaleString("en-US")}\`\n💰 محتاج: \`${amount.toLocaleString("en-US")}\``);

  user.coins -= amount;
  user.bankCoins = (user.bankCoins || 0) + amount;
  if (!user.lastBankInterest) user.lastBankInterest = Date.now();
  db.save();

  return interaction.editReply({
    embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("✅ تم الإيداع بنجاح")
      .setDescription(`أودعت \`${amount.toLocaleString("en-US")}\` ${BANK_CONFIG.currency} في البنك.\n\n👛 محفظتك: \`${user.coins.toLocaleString("en-US")}\`\n🏦 رصيد البنك: \`${user.bankCoins.toLocaleString("en-US")}\``).setTimestamp()],
  });
}

async function showWithdrawModal(interaction) {
  const modal = new ModalBuilder().setCustomId("bsav_modal_withdraw").setTitle("💸 سحب من البنك");
  const input = new TextInputBuilder()
    .setCustomId("bsav_amount")
    .setLabel(`كام ${BANK_CONFIG.currency} عايز تسحب؟ (الحد الأدنى ${BANK_CONFIG.minWithdraw})`)
    .setPlaceholder("مثال: 200").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(10);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function processWithdraw(interaction, db) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const raw = interaction.fields.getTextInputValue("bsav_amount").trim();
  const amount = parseInt(raw.replace(/[,_\s]/g, ""), 10);

  if (!Number.isFinite(amount) || amount <= 0) return interaction.editReply("❌ المبلغ مش صحيح. اكتب رقم بس.");
  if (amount < BANK_CONFIG.minWithdraw) return interaction.editReply(`❌ الحد الأدنى للسحب هو \`${BANK_CONFIG.minWithdraw}\` ${BANK_CONFIG.currency}.`);

  const user = db.getUser(interaction.user.id);
  const bankCoins = user.bankCoins || 0;
  if (bankCoins < amount) return interaction.editReply(`❌ رصيدك في البنك مش كفاية.\n🏦 عندك: \`${bankCoins.toLocaleString("en-US")}\``);

  const pending = calculatePendingInterest(bankCoins, user.lastBankInterest);
  let bonusNote = "";
  if (pending > 0) {
    user.bankCoins += pending;
    user.lastBankInterest = Date.now();
    bonusNote = `\n🎁 كمان حصّلت فايدة \`${pending.toLocaleString("en-US")}\` تلقائي.`;
  }

  user.bankCoins -= amount;
  user.coins = (user.coins || 0) + amount;
  db.save();

  return interaction.editReply({
    embeds: [new EmbedBuilder().setColor(0x3b82f6).setTitle("✅ تم السحب بنجاح")
      .setDescription(`سحبت \`${amount.toLocaleString("en-US")}\` ${BANK_CONFIG.currency} للمحفظة.${bonusNote}\n\n👛 محفظتك: \`${user.coins.toLocaleString("en-US")}\`\n🏦 رصيد البنك: \`${user.bankCoins.toLocaleString("en-US")}\``).setTimestamp()],
  });
}

async function showTransferModal(interaction) {
  const modal = new ModalBuilder().setCustomId("bsav_modal_transfer").setTitle("🔁 تحويل كوينز");
  const targetInput = new TextInputBuilder()
    .setCustomId("bsav_target").setLabel("ID الشخص اللي عايز تحوله (انسخ الـ ID بتاعه)")
    .setPlaceholder("مثال: 123456789012345678").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(17).setMaxLength(20);
  const amountInput = new TextInputBuilder()
    .setCustomId("bsav_amount").setLabel(`كام ${BANK_CONFIG.currency} عايز تحوّل؟`)
    .setPlaceholder("مثال: 100").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(10);
  modal.addComponents(new ActionRowBuilder().addComponents(targetInput), new ActionRowBuilder().addComponents(amountInput));
  await interaction.showModal(modal);
}

async function processTransfer(interaction, db) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const targetId = interaction.fields.getTextInputValue("bsav_target").trim();
  const raw = interaction.fields.getTextInputValue("bsav_amount").trim();
  const amount = parseInt(raw.replace(/[,_\s]/g, ""), 10);

  if (!/^\d{17,20}$/.test(targetId)) return interaction.editReply("❌ الـ ID مش صحيح. لازم يكون Discord ID (أرقام بس).");
  if (targetId === interaction.user.id) return interaction.editReply("❌ مش هتقدر تحول لنفسك يا حبيبي 😄");
  if (!Number.isFinite(amount) || amount <= 0) return interaction.editReply("❌ المبلغ مش صحيح.");
  if (amount < BANK_CONFIG.minTransfer) return interaction.editReply(`❌ الحد الأدنى للتحويل \`${BANK_CONFIG.minTransfer}\` ${BANK_CONFIG.currency}.`);
  if (amount > BANK_CONFIG.maxTransfer) return interaction.editReply(`❌ الحد الأقصى للتحويل \`${BANK_CONFIG.maxTransfer.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}.`);

  const sender = db.getUser(interaction.user.id);
  const receiver = db.getUser(targetId);
  if (targetId === interaction.client.user.id) return interaction.editReply("❌ مش هتقدر تحول للبوت نفسه.");
  if ((sender.bankCoins || 0) < amount) return interaction.editReply(`❌ رصيدك في البنك مش كفاية.\n🏦 عندك: \`${(sender.bankCoins || 0).toLocaleString("en-US")}\``);

  sender.bankCoins -= amount;
  receiver.bankCoins = (receiver.bankCoins || 0) + amount;
  if (!receiver.lastBankInterest) receiver.lastBankInterest = Date.now();
  db.save();

  try {
    const receiverUser = await interaction.client.users.fetch(targetId);
    await receiverUser.send({
      embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("💰 وصلك تحويل بنكي!")
        .setDescription(`حد اسمه **${interaction.user.tag}** حوّلّك \`${amount.toLocaleString("en-US")}\` ${BANK_CONFIG.currency} في ${BANK_CONFIG.bankName}.\n🏦 رصيدك دلوقتي: \`${receiver.bankCoins.toLocaleString("en-US")}\``).setTimestamp()],
    });
  } catch { /* DM مقفول */ }

  return interaction.editReply({
    embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("✅ تم التحويل بنجاح")
      .setDescription(`حوّلت \`${amount.toLocaleString("en-US")}\` ${BANK_CONFIG.currency} لـ <@${targetId}>.\n\n🏦 رصيدك في البنك: \`${sender.bankCoins.toLocaleString("en-US")}\``).setTimestamp()],
  });
}

async function collectInterest(interaction, db) {
  const user = db.getUser(interaction.user.id);
  const { bankCoins, lastInterestTs } = getBankData(user);

  if (bankCoins <= 0) return interaction.reply({ content: "❌ رصيدك في البنك صفر. أودع الأول عشان تكسب فايدة.", flags: MessageFlags.Ephemeral });

  const elapsed = Date.now() - (lastInterestTs || 0);
  if (elapsed < BANK_CONFIG.interestMinInterval) {
    return interaction.reply({ content: `⏳ تقدر تحصّل الفايدة بعد ${formatCooldown(BANK_CONFIG.interestMinInterval - elapsed)}.`, flags: MessageFlags.Ephemeral });
  }

  const interest = calculatePendingInterest(bankCoins, lastInterestTs);
  if (interest <= 0) return interaction.reply({ content: "❌ مفيش فايدة متاحة للتحصيل دلوقتي.", flags: MessageFlags.Ephemeral });

  user.bankCoins += interest;
  user.lastBankInterest = Date.now();
  db.save();

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xfacc15).setTitle("🎁 تم تحصيل الفايدة!")
      .setDescription(`حصلت على \`${interest.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}!\n\n🏦 رصيدك الجديد: \`${user.bankCoins.toLocaleString("en-US")}\``)
      .setFooter({ text: `💡 نسبة الفايدة ${(BANK_CONFIG.dailyInterestRate * 100).toFixed(1)}% يومياً` }).setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

async function showBankInfo(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1).setTitle(`📜 قوانين ${BANK_CONFIG.bankName}`).setDescription("كل اللي محتاج تعرفه عن بنك الادخار:")
    .addFields(
      { name: "💰 الإيداع",  value: `- الحد الأدنى: \`${BANK_CONFIG.minDeposit}\` ${BANK_CONFIG.currency}\n- الحد الأقصى: \`${BANK_CONFIG.maxDeposit.toLocaleString("en-US")}\` ${BANK_CONFIG.currency}`, inline: true },
      { name: "💸 السحب",   value: `- الحد الأدنى: \`${BANK_CONFIG.minWithdraw}\` ${BANK_CONFIG.currency}\n- مفيش حد أقصى`, inline: true },
      { name: "🔁 التحويل", value: `- الحد الأدنى: \`${BANK_CONFIG.minTransfer}\` ${BANK_CONFIG.currency}\n- لازم تكتب الـ ID بتاع الشخص (مش منشن)`, inline: true },
      { name: "📈 الفايدة", value: `- نسبة يومية: **${(BANK_CONFIG.dailyInterestRate * 100).toFixed(1)}%**\n- أقصى فايدة: **${(BANK_CONFIG.maxInterestPct * 100).toFixed(0)}%** من رصيدك\n- أقل وقت بين كل تحصيل: **ساعة**\n- لما تسحب، الفايدة بتتحصّل تلقائي`, inline: false },
      { name: "🛡️ الحماية", value: `- الفايدة بسيطة (مش مركبة) عشان مفيش استغلال\n- الفايدة الإجمالية محدودة بـ 50% من رصيدك\n- كل العمليات ephemeral (ما حدش غيرك بيشوفها)`, inline: false }
    )
    .setFooter({ text: "🏦 بنك زنجي — مع بعض بنبني ثروة 💪" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

function makeProgressBar(percent, size = 16) {
  const filled = Math.round((percent / 100) * size);
  return "`" + "█".repeat(filled) + "░".repeat(size - filled) + "` " + percent.toFixed(0) + "%";
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
