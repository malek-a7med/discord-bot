// ═══════════════════════════════════════════════════════════════
//  📊 نظام الاستفتاءات — Polls System
//  يعمل استفتاء بأزرار، كل عضو يصوت مرة، والنتايج تلقائياً بعد المدة
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";

export const activePolls = new Map(); // messageId → poll state

export const pollCommand = new SlashCommandBuilder()
  .setName("استفتاء")
  .setDescription("📊 أنشئ استفتاء في الروم — النتايج تلقائياً بعد المدة")
  .addStringOption(o =>
    o.setName("سؤال").setDescription("سؤال الاستفتاء").setRequired(true).setMaxLength(256)
  )
  .addStringOption(o =>
    o.setName("خيارات")
      .setDescription("الخيارات مفصولة بـ | مثال: نعم|لأ|ربما  (حد أقصى 5 خيارات)")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("مدة").setDescription("المدة بالدقائق (1 – 1440)").setRequired(true).setMinValue(1).setMaxValue(1440)
  )
  .addChannelOption(o =>
    o.setName("قناة").setDescription("القناة المراد نشر الاستفتاء فيها (فاضيها = الروم الحالي)")
  );

// ── الرموز للخيارات ────────────────────────────────────────────
const OPTION_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
const OPTION_COLORS = [0x3498db, 0x2ecc71, 0xe74c3c, 0xf39c12, 0x9b59b6];

function buildPollEmbed(state, ended = false) {
  const totalVotes = Object.keys(state.votes).length;

  const optionLines = state.options.map((opt, i) => {
    const count = state.counts[i] || 0;
    const pct   = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const bar   = buildBar(pct);
    return `${OPTION_EMOJIS[i]} **${opt}**\n${bar} **${pct}%** *(${count} صوت)*`;
  }).join("\n\n");

  const timeLeft = ended
    ? "⏱️ انتهى الاستفتاء"
    : `⏳ ينتهي بعد <t:${Math.floor(state.endsAt / 1000)}:R>`;

  return new EmbedBuilder()
    .setColor(ended ? 0x95a5a6 : 0x3498db)
    .setTitle(ended ? `📊 نتايج الاستفتاء: ${state.question}` : `📊 استفتاء: ${state.question}`)
    .setDescription(`${optionLines}\n\n👥 **إجمالي الأصوات:** ${totalVotes}\n${timeLeft}`)
    .setFooter({ text: ended ? "الاستفتاء انتهى — النتايج نهائية" : "اضغط على الزرار عشان تصوت — صوت واحد لكل شخص" })
    .setTimestamp();
}

function buildBar(pct) {
  const filled = Math.round(pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function buildPollRows(pollId, options, disabled = false) {
  const buttons = options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`poll_vote_${pollId}_${i}`)
      .setLabel(`${OPTION_EMOJIS[i]} ${opt}`.slice(0, 80))
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
  }
  return rows;
}

export async function handlePollCommand(interaction) {
  const question   = interaction.options.getString("سؤال");
  const rawOptions = interaction.options.getString("خيارات");
  const duration   = interaction.options.getInteger("مدة");
  const targetChan = interaction.options.getChannel("قناة") ?? interaction.channel;

  const options = rawOptions.split("|").map(o => o.trim()).filter(Boolean).slice(0, 5);

  if (options.length < 2)
    return interaction.reply({ content: "❌ لازم تحط خيارين على الأقل مفصولين بـ `|`", flags: 64 });

  await interaction.deferReply({ flags: 64 });

  const pollId  = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  const endsAt  = Date.now() + duration * 60 * 1000;

  const state = {
    pollId, question, options,
    votes:  {}, // { userId: optionIndex }
    counts: Object.fromEntries(options.map((_, i) => [i, 0])),
    endsAt,
    channelId: targetChan.id,
    messageId: null,
    timer: null,
  };

  const embed = buildPollEmbed(state);
  const rows  = buildPollRows(pollId, options);

  let msg;
  try {
    msg = await targetChan.send({ embeds: [embed], components: rows });
  } catch {
    return interaction.editReply({ content: `❌ مش قادر أبعت في ${targetChan} — تأكد إن البوت عنده صلاحية!` });
  }

  state.messageId = msg.id;
  activePolls.set(msg.id, state);

  await interaction.editReply({
    content: `✅ تم نشر الاستفتاء في ${targetChan}!\n⏰ ينتهي بعد **${duration} دقيقة** تلقائياً.`
  });

  // مؤقت النهاية التلقائية
  state.timer = setTimeout(() => endPoll(msg, state), duration * 60 * 1000);
}

async function endPoll(msg, state) {
  activePolls.delete(state.messageId);
  const endEmbed = buildPollEmbed(state, true);
  const disabledRows = buildPollRows(state.pollId, state.options, true);
  await msg.edit({ embeds: [endEmbed], components: disabledRows }).catch(() => {});

  // إعلان الفائز
  const totalVotes = Object.keys(state.votes).length;
  if (totalVotes === 0) return;

  const winnerIdx  = Object.entries(state.counts).sort((a, b) => b[1] - a[1])[0][0];
  const winnerOpt  = state.options[winnerIdx];
  const winnerPct  = Math.round((state.counts[winnerIdx] / totalVotes) * 100);

  const announceEmbed = new EmbedBuilder()
    .setColor(OPTION_COLORS[winnerIdx] ?? 0xf1c40f)
    .setTitle("🏆 نتيجة الاستفتاء!")
    .setDescription(
      `**${state.question}**\n\n` +
      `الفائز: ${OPTION_EMOJIS[winnerIdx]} **${winnerOpt}** بـ **${winnerPct}%** (${state.counts[winnerIdx]} صوت)\n\n` +
      `👥 إجمالي المشاركين: **${totalVotes}**`
    )
    .setTimestamp();

  const channel = msg.channel;
  await channel.send({ embeds: [announceEmbed] }).catch(() => {});
}

export async function handlePollButton(interaction) {
  const parts     = interaction.customId.split("_");
  const pollId    = parts[2];
  const optionIdx = parseInt(parts[3], 10);

  // إيجاد الاستفتاء بالـ messageId
  const state = activePolls.get(interaction.message.id);
  if (!state) return interaction.reply({ content: "❌ الاستفتاء انتهى أو ما عدتش لاقيه!", flags: 64 });

  const userId = interaction.user.id;

  if (state.votes[userId] !== undefined) {
    const prev = state.options[state.votes[userId]];
    return interaction.reply({ content: `✅ إنت بالفعل صوّت على **${OPTION_EMOJIS[state.votes[userId]]} ${prev}** — ما تقدرش تغير صوتك.`, flags: 64 });
  }

  state.votes[userId]    = optionIdx;
  state.counts[optionIdx] = (state.counts[optionIdx] || 0) + 1;

  const updatedEmbed = buildPollEmbed(state);
  await interaction.update({ embeds: [updatedEmbed], components: buildPollRows(state.pollId, state.options) });
}
