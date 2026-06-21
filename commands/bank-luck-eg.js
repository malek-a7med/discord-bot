// ============================================================
// 🎰 بنك الحظ — النسخة المصرية (كرتونة بنك الحظ الأوتنتك)
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

const CONFIG = {
  bankName: "بنك الحظ 🎰",
  currency: "كوينز",
  minBet: 10,
  maxBet: 100_000,
  spinCooldownMs: 4000,
  segments: [
    { num: 1,  emoji: "💀", label: "خسرت كل حاجة",  mult: 0,   weight: 22 },
    { num: 2,  emoji: "💀", label: "خسرت",           mult: 0,   weight: 18 },
    { num: 3,  emoji: "😢", label: "نص رهانك",       mult: 0.5, weight: 14 },
    { num: 4,  emoji: "😢", label: "نص رهانك",       mult: 0.5, weight: 11 },
    { num: 5,  emoji: "😐", label: "رجّعنا رهانك",   mult: 1,   weight: 9  },
    { num: 6,  emoji: "🙂", label: "رجّعنا رهانك",   mult: 1,   weight: 7  },
    { num: 7,  emoji: "😄", label: "ضعف رهانك!",     mult: 2,   weight: 6  },
    { num: 8,  emoji: "🔥", label: "3 أضعاف رهانك!", mult: 3,   weight: 5  },
    { num: 9,  emoji: "💎", label: "5 أضعاف رهانك!", mult: 5,   weight: 5  },
    { num: 10, emoji: "🎉", label: "الجاكبوت! 10x!", mult: 10,  weight: 3  },
  ],
};

const lastSpin = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function spin() {
  const totalWeight = CONFIG.segments.reduce((s, seg) => s + seg.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const seg of CONFIG.segments) {
    if (rand < seg.weight) return seg;
    rand -= seg.weight;
  }
  return CONFIG.segments[0];
}

function getSegment(num) {
  return CONFIG.segments.find((s) => s.num === num);
}

function renderBankBox(highlighted = null, statusLine = "💰 حط كوينزك!") {
  const fmt = (n) => {
    const seg = getSegment(n);
    const hl = highlighted === n ? " ◄" : "  ";
    const hlStart = highlighted === n ? "▶" : " ";
    return `${hlStart}${seg.emoji} **${n}** (${seg.mult}x)${hl}`;
  };

  let box = "";
  box += "```\n";
  box += "       ╔═══════════════════════════════╗\n";
  box += "       ║      🎰  بنك الحظ  🎰         ║\n";
  box += "       ╠═══════════════════════════════╣\n";
  box += "       ║                               ║\n";
  box += "       ║    ┌─────────────────────┐   ║\n";
  box += `       ║    │   ${statusLine.padEnd(19)} │   ║\n`;
  box += "       ║    └─────────────────────┘   ║\n";
  box += "       ║           ( 🎯 )              ║\n";
  box += "       ║                               ║\n";
  box += "       ╚═══════════════════════════════╝\n";
  box += "```\n";
  box += "🎡 **العجلة:**\n";
  box += `\`${fmt(10)}\` │ \`${fmt(9)}\` │ \`${fmt(8)}\` │ \`${fmt(7)}\`\n`;
  box += `\`${fmt(6)}\` │ \`${fmt(5)}\` │ \`${fmt(4)}\` │ \`${fmt(3)}\`\n`;
  box += `              \`${fmt(2)}\` │ \`${fmt(1)}\`\n`;
  return box;
}

export const bankLuckEgCommand = {
  data: new SlashCommandBuilder()
    .setName("بنك-الحظ-مصري")
    .setDescription("🎰 كرتونة بنك الحظ المصرية - حط كوينزك واكسب!"),

  async execute(interaction, db) {
    return showBankPanel(interaction, db);
  },
};

export async function handleBankLuckEgButton(interaction, db) {
  const id = interaction.customId;
  try {
    if (id === "bleg_bet")  return showBetModal(interaction);
    if (id === "bleg_info") return showInfo(interaction);
  } catch (err) {
    console.error("[bank-luck-eg] button error:", err);
    const payload = { content: "❌ حصلت مشكلة، حاول تاني.", flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
}

export async function handleBankLuckEgModal(interaction, db) {
  if (interaction.customId === "bleg_modal_bet") return processBet(interaction, db);
}

async function showBankPanel(interaction, db) {
  const user = db.getUser(interaction.user.id);
  const wallet = user.coins || 0;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle("🎰 كرتونة بنك الحظ — النسخة المصرية!")
    .setDescription(
      `أهلاً يا **${interaction.user.username}**! 🎪\n` +
      `كرتونة بنك الحظ مستنياك — حط كوينزك وشوف العجلة هتقف على رقم كام.\n\n` +
      renderBankBox(null, `💰 رصيدك: ${wallet.toLocaleString("en-US")}`)
    )
    .addFields({
      name: "🎯 جدول المكافآت",
      value: CONFIG.segments.map((s) => `${s.emoji} **${s.num}** → ${s.label} • احتمال: ${s.weight}%`).join("\n"),
      inline: false,
    })
    .setFooter({ text: "💡 نصيحة: لما الرقم يكون أكبر، المكسب أكبر — بس أصعب!" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bleg_bet").setLabel("💰 اراهن دلوقتي!").setStyle(ButtonStyle.Success).setEmoji("🎰"),
    new ButtonBuilder().setCustomId("bleg_info").setLabel("📜 قوانين اللعبة").setStyle(ButtonStyle.Secondary)
  );

  if (interaction.isButton?.()) {
    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row] });
  }
}

async function showBetModal(interaction) {
  const modal = new ModalBuilder().setCustomId("bleg_modal_bet").setTitle("🎰 اراهن على عجلة الحظ");
  const input = new TextInputBuilder()
    .setCustomId("bleg_amount")
    .setLabel(`كام ${CONFIG.currency} عايز تراهن؟ (من ${CONFIG.minBet} لـ ${CONFIG.maxBet.toLocaleString("en-US")})`)
    .setPlaceholder("مثال: 500").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(10);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function processBet(interaction, db) {
  const userId = interaction.user.id;
  const last = lastSpin.get(userId) || 0;
  if (Date.now() - last < CONFIG.spinCooldownMs) {
    const wait = Math.ceil((CONFIG.spinCooldownMs - (Date.now() - last)) / 1000);
    return interaction.reply({ content: `⏳ استنى ${wait} ثانية قبل ما تراهن تاني.`, flags: MessageFlags.Ephemeral });
  }
  lastSpin.set(userId, Date.now());

  const raw = interaction.fields.getTextInputValue("bleg_amount").trim();
  const amount = parseInt(raw.replace(/[,_\s]/g, ""), 10);

  if (!Number.isFinite(amount) || amount <= 0) return interaction.reply({ content: "❌ المبلغ مش صحيح. اكتب رقم بس.", flags: MessageFlags.Ephemeral });
  if (amount < CONFIG.minBet) return interaction.reply({ content: `❌ الحد الأدنى \`${CONFIG.minBet}\` ${CONFIG.currency}.`, flags: MessageFlags.Ephemeral });
  if (amount > CONFIG.maxBet) return interaction.reply({ content: `❌ الحد الأقصى \`${CONFIG.maxBet.toLocaleString("en-US")}\` ${CONFIG.currency}.`, flags: MessageFlags.Ephemeral });

  const user = db.getUser(interaction.user.id);
  if ((user.coins || 0) < amount) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xef4444).setTitle("❌ رصيدك مش كفاية")
        .setDescription(`👛 عندك: \`${(user.coins || 0).toLocaleString("en-US")}\` ${CONFIG.currency}\n💰 محتاج: \`${amount.toLocaleString("en-US")}\` ${CONFIG.currency}\n\n💡 استخدم \`/يومي\` عشان تاخد مكافأتك أو \`/بنك-الادخار\` لو عندك كوينز في البنك.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  user.coins -= amount;
  const result = spin();
  const spinFrames = generateSpinFrames(result.num);

  const msg = await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xffd700).setTitle("🎰 بنك الحظ")
      .setDescription(`يا **${interaction.user.username}**، حطيت \`${amount.toLocaleString("en-US")}\` ${CONFIG.currency} في الكرتونة...\n` + renderBankBox(spinFrames[0].num, spinFrames[0].status))
      .setFooter({ text: "🎰 العجلة بتلف..." }).setTimestamp()],
    fetchReply: true,
  });

  for (let i = 1; i < spinFrames.length - 1; i++) {
    await sleep(800);
    try {
      await msg.edit({
        embeds: [new EmbedBuilder().setColor(0xffd700).setTitle("🎰 بنك الحظ")
          .setDescription(renderBankBox(spinFrames[i].num, spinFrames[i].status))
          .setFooter({ text: "🎰 بتلف..." })],
      });
    } catch {}
  }

  await sleep(1100);

  const winnings = Math.floor(amount * result.mult);
  const profit = winnings - amount;
  user.coins += winnings;
  db.save();

  let color, resultTitle, celebrationEmoji;
  if (profit > 0)      { color = 0x22c55e; resultTitle = `🎉 كسبت! ${result.emoji}`; celebrationEmoji = "🎊🎉🎊"; }
  else if (profit === 0) { color = 0xfacc15; resultTitle = `😐 رجعنا رهانك`;          celebrationEmoji = "😐"; }
  else                 { color = 0xef4444; resultTitle = `💀 خسرت!`;                  celebrationEmoji = "😢"; }

  const finalEmbed = new EmbedBuilder()
    .setColor(color).setTitle(`🎰 ${resultTitle}`)
    .setDescription(
      `${celebrationEmoji}\n\n` +
      renderBankBox(result.num, `النتيجة: ${result.num}`) +
      `\n📊 **النتيجة:** ${result.emoji} **${result.num}** → ${result.label}\n` +
      `💰 **ربحت:** \`${winnings.toLocaleString("en-US")}\` ${CONFIG.currency}\n` +
      `${profit >= 0 ? "📈" : "📉"} **صافي:** \`${profit >= 0 ? "+" : ""}${profit.toLocaleString("en-US")}\` ${CONFIG.currency}\n` +
      `👛 **رصيدك الجديد:** \`${user.coins.toLocaleString("en-US")}\` ${CONFIG.currency}`
    )
    .setFooter({ text: profit > 0 ? "🎊 مبروك! حظك سخن اليوم!" : profit === 0 ? "🍀 على الأقل مخسرتش حاجة!" : "🍀 حاول تاني، يمكن حظك يتحسن!" })
    .setTimestamp();

  const replayRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bleg_bet").setLabel("🔄 اراهن تاني!").setStyle(ButtonStyle.Primary)
  );

  await msg.edit({ embeds: [finalEmbed], components: [replayRow] });
}

function generateSpinFrames(finalNum) {
  const frames = [];
  const statuses = ["🎰 بتلف...", "🎰 بتلف وبتلف...", "🎰 بطيئة بقى...", "✨ وقفت!"];
  for (let i = 0; i < statuses.length; i++) {
    let num;
    if (i === statuses.length - 1) { num = finalNum; }
    else {
      const others = CONFIG.segments.filter((s) => s.num !== finalNum);
      num = others[Math.floor(Math.random() * others.length)].num;
    }
    frames.push({ num, status: statuses[i] });
  }
  return frames;
}

async function showInfo(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1).setTitle("📜 قوانين كرتونة بنك الحظ")
    .setDescription(
      "كرتونة بنك الحظ هي لعبة حظ مصرية أوتنتك! " +
      "كنت بتحط الـ 25 قرش في الكرتونة وبتنزل العجلة وتلف، " +
      "واللي بتوقف على رقم بيكسب حسب الرقم ده. 🎰\n\n" +
      "**طريقة اللعب:**\n" +
      "1️⃣ اضغط **'اراهن دلوقتي'**\n" +
      "2️⃣ اكتب المبلغ اللي عايز تراهن بيه\n" +
      "3️⃣ العجلة هتلف وتوقف على رقم من 1 لـ 10\n" +
      "4️⃣ حسب الرقم بتاخد مكافأة أو بتخسر الرهان!\n\n**🎯 جدول المكافآت الكامل:**"
    )
    .addFields(
      { name: "📊 كل الأرقام",   value: CONFIG.segments.map((s) => `${s.emoji} **${s.num}** → ${s.label} (احتمال: ${s.weight}%)`).join("\n"), inline: false },
      { name: "⚠️ تنبيه مهم",    value: "دي **لعبة حظ** — ممكن تخسر فلوسك! العب بفلوس تقدر تستغني عنها، ومتتراهنش بكل رصيدك مرة واحدة. 🍀", inline: false }
    )
    .setFooter({ text: "🎰 بنك الحظ - حظ سعيد يا معلم!" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
