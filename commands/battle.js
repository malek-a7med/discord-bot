// ═══════════════════════════════════════════════════════════════
//  نظام مصارعة الكلام — مدعوم بالذكاء الاصطناعي Gemini
//  الأوامر: /مصارعة
//  الأزرار: btl_accept | btl_decline | btl_respond
//  المودالات: btl_modal_response
// ═══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} from "discord.js";

// ── جلسات المصارعة النشطة ─────────────────────────────────────
// battleId → { challengerId, opponentId, channelId, guildId, round, turns, status, scores, startedAt }
const activeBattles = new Map();

// ── مساعد: توليد battleId فريد ────────────────────────────────
function genBattleId(a, b) {
  return `btl_${a}_${b}_${Date.now()}`;
}

// ── مساعد: لقي الجلسة بناءً على المستخدم والقناة ──────────────
function findBattleByUser(userId, channelId) {
  for (const [id, battle] of activeBattles) {
    if (
      battle.channelId === channelId &&
      (battle.challengerId === userId || battle.opponentId === userId) &&
      battle.status === "active"
    ) {
      return [id, battle];
    }
  }
  return [null, null];
}

function findBattleById(battleId) {
  return activeBattles.get(battleId) || null;
}

// ── الألوان حسب الحالة ────────────────────────────────────────
const COLOR = {
  challenge: 0x9b59b6,
  active:    0xe74c3c,
  win:       0xf1c40f,
  draw:      0x95a5a6,
  declined:  0x7f8c8d,
};

// ── تعريف الأمر ───────────────────────────────────────────────
export const battleCommand = new SlashCommandBuilder()
  .setName("مصارعة")
  .setDescription("🥊 تحدّى عضو في مصارعة كلام مدعومة بالذكاء الاصطناعي!")
  .addUserOption(o =>
    o.setName("الخصم").setDescription("العضو اللي هتتحداه").setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("جولات").setDescription("عدد الجولات (1–5) — افتراضي 3").setMinValue(1).setMaxValue(5)
  );

// ═════════════════════════════════════════════════════════════
//  معالج الأمر الأساسي
// ═════════════════════════════════════════════════════════════
export async function handleBattleCommand(interaction, db, geminiModel) {
  const { user, guild, channelId } = interaction;
  const opponent = interaction.options.getUser("الخصم");
  const rounds   = interaction.options.getInteger("جولات") ?? 3;

  if (opponent.id === user.id) {
    return interaction.reply({ content: "😂 مش هتتحدى نفسك يسطا!", flags: 64 });
  }
  if (opponent.bot) {
    return interaction.reply({ content: "❌ البوتات مش بتتكلم، هتتحدى عضو حقيقي!", flags: 64 });
  }

  // منع تحدي متعدد في نفس القناة
  const [existId] = findBattleByUser(user.id, channelId);
  if (existId) {
    return interaction.reply({ content: "❌ عندك مصارعة شغالة هنا بالفعل! خلّصها الأول.", flags: 64 });
  }

  const battleId = genBattleId(user.id, opponent.id);
  activeBattles.set(battleId, {
    challengerId: user.id,
    opponentId:   opponent.id,
    channelId,
    guildId:      guild.id,
    totalRounds:  rounds,
    round:        0,
    turns:        [],
    status:       "pending",
    scores:       { [user.id]: 0, [opponent.id]: 0 },
    startedAt:    Date.now(),
  });

  // timeout بعد دقيقتين لو الخصم ما ردش
  setTimeout(() => {
    const b = findBattleById(battleId);
    if (b && b.status === "pending") {
      activeBattles.delete(battleId);
    }
  }, 120_000);

  const embed = new EmbedBuilder()
    .setColor(COLOR.challenge)
    .setTitle("🥊 تحدي مصارعة كلام!")
    .setDescription(
      `${user} بيتحداك يا ${opponent}!\n\n` +
      `**عدد الجولات:** \`${rounds}\`\n` +
      `**الوقت:** عندك **دقيقتين** ترد ✅ أو ❌`
    )
    .setFooter({ text: `معرف المصارعة: ${battleId.slice(-8)}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btl_accept|${battleId}`)
      .setLabel("✅ قبلت التحدي!")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btl_decline|${battleId}`)
      .setLabel("❌ مش مهتم")
      .setStyle(ButtonStyle.Danger),
  );

  return interaction.reply({ embeds: [embed], components: [row] });
}

// ═════════════════════════════════════════════════════════════
//  معالج الأزرار
// ═════════════════════════════════════════════════════════════
export async function handleBattleButton(interaction, db, geminiModel) {
  const [prefix, battleId] = interaction.customId.split("|");
  const { user } = interaction;

  // ── قبول التحدي ──────────────────────────────────────────
  if (prefix === "btl_accept") {
    const battle = findBattleById(battleId);
    if (!battle) {
      return interaction.reply({ content: "❌ المصارعة دي انتهت أو مش موجودة.", flags: 64 });
    }
    if (user.id !== battle.opponentId) {
      return interaction.reply({ content: "❌ التحدي ده مش ليك!", flags: 64 });
    }
    if (battle.status !== "pending") {
      return interaction.reply({ content: "❌ المصارعة بدأت بالفعل.", flags: 64 });
    }

    battle.status = "active";
    battle.round  = 1;

    const challenger = await interaction.client.users.fetch(battle.challengerId);
    const startEmbed = new EmbedBuilder()
      .setColor(COLOR.active)
      .setTitle("🔥 المصارعة بدأت!")
      .setDescription(
        `**${challenger.username}** 🆚 **${user.username}**\n\n` +
        `🎯 **جولة 1 / ${battle.totalRounds}**\n\n` +
        `الدور على **${challenger.username}** الأول!\n` +
        `اضغط الزر تحت وابعت ردّك. 💬`
      )
      .setFooter({ text: "كل رد بيتقيّمه الـ AI — أجمل كلام يكسب!" })
      .setTimestamp();

    const respondRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btl_respond|${battleId}|${battle.challengerId}`)
        .setLabel(`✍️ رد ${challenger.username}`)
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.update({ embeds: [startEmbed], components: [respondRow] });
    return;
  }

  // ── رفض التحدي ───────────────────────────────────────────
  if (prefix === "btl_decline") {
    const battle = findBattleById(battleId);
    if (!battle) {
      return interaction.reply({ content: "❌ المصارعة مش موجودة.", flags: 64 });
    }
    if (user.id !== battle.opponentId && user.id !== battle.challengerId) {
      return interaction.reply({ content: "❌ مش شغلتك!", flags: 64 });
    }

    activeBattles.delete(battleId);
    const declineEmbed = new EmbedBuilder()
      .setColor(COLOR.declined)
      .setTitle("🚪 رُفض التحدي")
      .setDescription(`${user} رفض التحدي. 😤`)
      .setTimestamp();

    return interaction.update({ embeds: [declineEmbed], components: [] });
  }

  // ── زر الرد ───────────────────────────────────────────────
  if (prefix === "btl_respond") {
    const [, bId, expectedUserId] = interaction.customId.split("|");
    const battle = findBattleById(bId);

    if (!battle || battle.status !== "active") {
      return interaction.reply({ content: "❌ المصارعة دي انتهت.", flags: 64 });
    }
    if (user.id !== expectedUserId) {
      return interaction.reply({ content: `❌ دورك مش هنا — استنّي دورك!`, flags: 64 });
    }

    // بفتح مودال الرد
    const modal = new ModalBuilder()
      .setCustomId(`btl_modal_response|${bId}|${expectedUserId}`)
      .setTitle(`✍️ ردّك — جولة ${battle.round}`);

    const input = new TextInputBuilder()
      .setCustomId("btl_text")
      .setLabel("اكتب ردّك هنا (جملة واحدة على الأقل)")
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(500)
      .setRequired(true)
      .setPlaceholder("اكتب أجمل وأشرس رد ممكن...");

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }
}

// ═════════════════════════════════════════════════════════════
//  معالج المودالات
// ═════════════════════════════════════════════════════════════
export async function handleBattleModal(interaction, db, geminiModel) {
  if (!interaction.customId.startsWith("btl_modal_response")) return;

  const [, battleId, expectedUserId] = interaction.customId.split("|");
  const { user } = interaction;

  if (user.id !== expectedUserId) {
    return interaction.reply({ content: "❌ مش دورك!", flags: 64 });
  }

  const battle = findBattleById(battleId);
  if (!battle || battle.status !== "active") {
    return interaction.reply({ content: "❌ المصارعة انتهت.", flags: 64 });
  }

  await interaction.deferReply();

  const text = interaction.fields.getTextInputValue("btl_text");
  battle.turns.push({ userId: user.id, text, round: battle.round });

  const challenger = await interaction.client.users.fetch(battle.challengerId);
  const opponent   = await interaction.client.users.fetch(battle.opponentId);

  // لو الجولة جاها رد من الاتنين
  const roundTurns = battle.turns.filter(t => t.round === battle.round);

  if (roundTurns.length === 1) {
    // الأول رد — دلوقتي دور التاني
    const nextUserId = user.id === battle.challengerId
      ? battle.opponentId
      : battle.challengerId;
    const nextUser = user.id === battle.challengerId ? opponent : challenger;

    const waitEmbed = new EmbedBuilder()
      .setColor(COLOR.active)
      .setTitle(`🎯 جولة ${battle.round} / ${battle.totalRounds}`)
      .addFields(
        { name: `${user.username} قال:`, value: text.slice(0, 512), inline: false },
      )
      .setDescription(`\nدلوقتي دور **${nextUser.username}** ✍️`)
      .setTimestamp();

    const respondRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btl_respond|${battleId}|${nextUserId}`)
        .setLabel(`✍️ رد ${nextUser.username}`)
        .setStyle(ButtonStyle.Primary),
    );

    return interaction.editReply({ embeds: [waitEmbed], components: [respondRow] });
  }

  // الاتنين ردّوا — بنقيّم بالـ AI
  const t1 = roundTurns.find(t => t.userId === battle.challengerId);
  const t2 = roundTurns.find(t => t.userId === battle.opponentId);

  let roundResult = null;
  let winnerId    = null;
  let aiSummary   = "مقيّمتش بالـ AI في الجولة دي.";

  if (geminiModel) {
    try {
      const prompt =
        `أنت حكم مصارعة كلام بالعامية المصرية.\n\n` +
        `المتسابق الأول (${challenger.username}) قال:\n"${t1.text}"\n\n` +
        `المتسابق الثاني (${opponent.username}) قال:\n"${t2.text}"\n\n` +
        `قيّم الردّين وقول مين أحسن في الجولة دي وليه في جملتين بالعامية المصرية.\n` +
        `ردّك لازم يبدأ بـ: "الفايز في الجولة: [اسم المتسابق]"\n` +
        `بعدين التقييم.`;

      const result = await geminiModel.generateContent(prompt);
      aiSummary    = result.response.text().slice(0, 600);

      if (aiSummary.includes(challenger.username)) {
        winnerId = battle.challengerId;
      } else if (aiSummary.includes(opponent.username)) {
        winnerId = battle.opponentId;
      }
    } catch {
      aiSummary = "مقدرتش أقيّم بالـ AI في الجولة دي! الجولة تعادل.";
    }
  }

  if (winnerId) {
    battle.scores[winnerId] = (battle.scores[winnerId] || 0) + 1;
  }

  const roundEmbed = new EmbedBuilder()
    .setColor(COLOR.active)
    .setTitle(`⚔️ نتيجة جولة ${battle.round} / ${battle.totalRounds}`)
    .addFields(
      { name: `${challenger.username} قال:`, value: t1.text.slice(0, 400), inline: false },
      { name: `${opponent.username} قال:`,   value: t2.text.slice(0, 400), inline: false },
      { name: "🤖 تقييم الـ AI:",             value: aiSummary,            inline: false },
    )
    .addFields(
      { name: "📊 النقاط الحالية:",
        value: `**${challenger.username}:** \`${battle.scores[battle.challengerId]}\` | **${opponent.username}:** \`${battle.scores[battle.opponentId]}\``,
        inline: false },
    )
    .setTimestamp();

  battle.round++;

  // هل انتهت المصارعة؟
  if (battle.round > battle.totalRounds) {
    battle.status = "finished";
    activeBattles.delete(battleId);

    const cScore = battle.scores[battle.challengerId];
    const oScore = battle.scores[battle.opponentId];
    let finalTitle, finalDesc;

    if (cScore > oScore) {
      finalTitle = `🏆 الفائز: ${challenger.username}!`;
      finalDesc  = `${challenger} هزم ${opponent} بـ \`${cScore}\` مقابل \`${oScore}\` نقطة! 🎉`;
      db.updateUser(battle.challengerId, { coins: (db.getUser(battle.challengerId).coins || 0) + 300 });
    } else if (oScore > cScore) {
      finalTitle = `🏆 الفائز: ${opponent.username}!`;
      finalDesc  = `${opponent} هزم ${challenger} بـ \`${oScore}\` مقابل \`${cScore}\` نقطة! 🎉`;
      db.updateUser(battle.opponentId, { coins: (db.getUser(battle.opponentId).coins || 0) + 300 });
    } else {
      finalTitle = "🤝 تعادل!";
      finalDesc  = `المصارعة انتهت بتعادل! \`${cScore}\` لكل طرف. الاتنين بطل!`;
    }

    roundEmbed.setTitle(`⚔️ الجولة الأخيرة!`);

    const finalEmbed = new EmbedBuilder()
      .setColor(cScore !== oScore ? COLOR.win : COLOR.draw)
      .setTitle(finalTitle)
      .setDescription(finalDesc)
      .addFields(
        { name: "📊 النقاط النهائية:",
          value: `**${challenger.username}:** \`${cScore}\` | **${opponent.username}:** \`${oScore}\``,
          inline: false },
      )
      .setFooter({ text: "الفائز كسب 300 كوينز! 🪙" })
      .setTimestamp();

    return interaction.editReply({ embeds: [roundEmbed, finalEmbed], components: [] });
  }

  // جولة جديدة — الدور على المُتحدّي
  const nextRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btl_respond|${battleId}|${battle.challengerId}`)
      .setLabel(`✍️ رد ${challenger.username} — جولة ${battle.round}`)
      .setStyle(ButtonStyle.Primary),
  );

  roundEmbed.setDescription(`\n🎯 **جولة ${battle.round} / ${battle.totalRounds}** — دور **${challenger.username}** ✍️`);
  return interaction.editReply({ embeds: [roundEmbed], components: [nextRow] });
}
