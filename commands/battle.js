// ═══════════════════════════════════════════════════════════════
//  مصارعة كلام — نظام ألعاب كامل (بوت vs لاعب، أو لاعب vs لاعب)
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

// ── إعدادات اللعبة ───────────────────────────────────────────
const ROUNDS       = 3;
const WIN_COINS    = 300;
const TURN_TIMEOUT = 3 * 60_000; // 3 دقايق لكل دور

// ── بيانات المعارك الجارية ────────────────────────────────────
const activeBattles = new Map(); // battleId → battle
const userInBattle  = new Map(); // userId   → battleId

// ── تعريف الأمر ──────────────────────────────────────────────
export const battleCommand = new SlashCommandBuilder()
  .setName("مصارعة")
  .setDescription("🥊 تحدّي في مصارعة كلام — إثبت إنك الأقوى!")
  .addUserOption(opt =>
    opt.setName("خصم")
      .setDescription("اختار خصمك (اتركه فاضي عشان تتحارب مع البوت 🤖)")
  );

// ── مساعدات داخلية ───────────────────────────────────────────
function makeBattleId() {
  return `btl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function scoreBar(score) {
  const filled = Math.round(score / 10 * 5);
  return "🟥".repeat(filled) + "⬛".repeat(5 - filled) + ` ${score}/10`;
}

function buildScoreLine(battle, cName, oName) {
  const oLabel = battle.opponent === "bot" ? "🤖 زنجي" : `<@${battle.opponent}>`;
  return `<@${battle.challenger}> \`${battle.scores.challenger}pts\` ⚡ ${oLabel} \`${battle.scores.opponent}pts\``;
}

function attackButtons(battleId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btl_attack_${battleId}`)
      .setLabel("🗡️ اضرب!")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`btl_forfeit_${battleId}`)
      .setLabel("🏳️ استسلم")
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── استدعاء Gemini: توليد طعنة البوت ────────────────────────
async function generateBotAttack(geminiModel, playerName, playerAttack, round) {
  const prompt =
    `أنت "زنجي" — بوت مصري يشارك في مصارعة كلام مضحكة.\n` +
    `خصمك اسمه "${playerName}" وطعنك في الجولة ${round} بـ:\n"${playerAttack}"\n\n` +
    `رد بطعنة واحدة مضحكة وذكية بالعامية المصرية، جملة أو اتنين كحد أقصى.\n` +
    `لا تكون مسيء أو وقح — خليها ذكاء لفظي لا إهانة حقيقية.`;
  try {
    const res = await geminiModel.generateContent(prompt);
    return res.response.text().trim().slice(0, 250);
  } catch {
    const fallbacks = [
      "أنا زنجي مش محتاج أتكلم — وجودي بس طعنة! 😏",
      "كلامك وصل... وراح في الهوا على طول 💨",
      "حاول تاني لما تكبر شوية 😂",
      "ده أقوى كلام عندك؟ يا خسارة فيك! 😅",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ── استدعاء Gemini: تحكيم الجولة ────────────────────────────
async function judgeRound(geminiModel, attack1, attack2, name1, name2) {
  const prompt =
    `أنت حكم في مصارعة كلام مصرية. قيّم الطعنتين بشكل عادل.\n\n` +
    `${name1}: "${attack1}"\n` +
    `${name2}: "${attack2}"\n\n` +
    `رد بـ JSON فقط بالشكل ده (بدون أي نص قبله أو بعده):\n` +
    `{"score1":X,"score2":Y,"comment":"تعليق مضحك ومختصر بالعامية المصرية"}`;
  try {
    const res   = await geminiModel.generateContent(prompt);
    const raw   = res.response.text().trim();
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]);
    return {
      score1:  Math.min(10, Math.max(0, Number(parsed.score1) || 5)),
      score2:  Math.min(10, Math.max(0, Number(parsed.score2) || 5)),
      comment: parsed.comment || "جولة متكافئة!",
    };
  } catch {
    return { score1: 5, score2: 5, comment: "الحكم تعب — نقطة لكل واحد! 😅" };
  }
}

// ══════════════════════════════════════════════════════════════
//  معالج أمر /مصارعة
// ══════════════════════════════════════════════════════════════
export async function handleBattleCommand(interaction, db, geminiModel) {
  const challenger = interaction.user;
  const opponent   = interaction.options.getUser("خصم");

  if (userInBattle.has(challenger.id)) {
    return interaction.reply({ content: "❌ إنت كمان في معركة دلوقتي! خلصها الأول.", ephemeral: true });
  }

  // ─── ضد البوت ─────────────────────────────────────────────
  if (!opponent) {
    const id = makeBattleId();
    activeBattles.set(id, {
      id, challenger: challenger.id, opponent: "bot",
      channel: interaction.channelId, round: 1,
      scores: { challenger: 0, opponent: 0 },
      currentTurn: "challenger", attacks: [], status: "active",
      currentRound: {}, geminiModel, db,
    });
    userInBattle.set(challenger.id, id);
    setBattleTimeout(id, interaction.channel);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🥊 مصارعة كلام — إنت ضد البوت!")
      .setDescription(
        `يا **${challenger.displayName}** — جرئت تتحدى زنجي؟ 😤\n\n` +
        `**الجولة 1 من ${ROUNDS}** — دورك تضرب الأول!`
      )
      .addFields({ name: "📊 النتيجة", value: buildScoreLine(activeBattles.get(id), "", ""), inline: false })
      .setFooter({ text: "⏱️ عندك 3 دقايق للطعنة!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [attackButtons(id)] });
    return;
  }

  // ─── ضد لاعب ──────────────────────────────────────────────
  if (opponent.id === challenger.id)
    return interaction.reply({ content: "❌ ما تقدرش تتحارب مع نفسك! 😂", ephemeral: true });
  if (opponent.bot)
    return interaction.reply({ content: "❌ مش هتتحارب مع بوت تاني! جرب `/مصارعة` من غير خصم عشان تتحارب مع زنجي.", ephemeral: true });
  if (userInBattle.has(opponent.id))
    return interaction.reply({ content: `❌ **${opponent.displayName}** كمان في معركة دلوقتي!`, ephemeral: true });

  const id = makeBattleId();
  activeBattles.set(id, {
    id, challenger: challenger.id, opponent: opponent.id,
    channel: interaction.channelId, round: 1,
    scores: { challenger: 0, opponent: 0 },
    currentTurn: "challenger", attacks: [], status: "waiting",
    currentRound: {}, geminiModel, db,
  });
  userInBattle.set(challenger.id, id);

  // timeout للقبول — دقيقتين
  activeBattles.get(id)._acceptTimeout = setTimeout(() => {
    const b = activeBattles.get(id);
    if (b && b.status === "waiting") {
      activeBattles.delete(id);
      userInBattle.delete(challenger.id);
    }
  }, 2 * 60_000);

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🥊 تحدي مصارعة كلام!")
    .setDescription(`${challenger} بيتحداك يا ${opponent}!\n\n**هتقبل ولا هتجري؟** 😤`)
    .addFields(
      { name: "🥊 المتحدي",  value: `${challenger}`,    inline: true },
      { name: "⚡ VS",        value: "────────",         inline: true },
      { name: "🛡️ المتحدَى", value: `${opponent}`,      inline: true },
      { name: "🎯 الجولات",  value: `${ROUNDS} جولات`,  inline: true },
      { name: "🏆 المكافأة", value: `${WIN_COINS} 🪙`,   inline: true },
    )
    .setFooter({ text: "⏱️ عندك دقيقتين تقبل أو ترفض!" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`btl_accept_${id}`).setLabel("✅ قبلت التحدي!").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`btl_reject_${id}`).setLabel("❌ مش مهتم").setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// ══════════════════════════════════════════════════════════════
//  معالج الأزرار
// ══════════════════════════════════════════════════════════════
export async function handleBattleButton(interaction, db, geminiModel) {
  const cid = interaction.customId;

  // ─── قبول ─────────────────────────────────────────────────
  if (cid.startsWith("btl_accept_")) {
    const id = cid.slice("btl_accept_".length);
    const b  = activeBattles.get(id);
    if (!b) return interaction.reply({ content: "❌ انتهت المعركة أو انتهى وقت القبول!", ephemeral: true });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى!", ephemeral: true });

    clearTimeout(b._acceptTimeout);
    b.status = "active";
    userInBattle.set(b.opponent, id);
    setBattleTimeout(id, interaction.channel);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🥊 المعركة بدأت!")
      .setDescription(
        `<@${b.challenger}> ⚔️ <@${b.opponent}>\n\n` +
        `**الجولة 1 من ${ROUNDS}** — دور <@${b.challenger}> يضرب الأول!`
      )
      .addFields({ name: "📊 النتيجة", value: buildScoreLine(b, "", ""), inline: false })
      .setFooter({ text: "⏱️ عندك 3 دقايق للطعنة!" })
      .setTimestamp();

    return interaction.update({ embeds: [embed], components: [attackButtons(id)] });
  }

  // ─── رفض ──────────────────────────────────────────────────
  if (cid.startsWith("btl_reject_")) {
    const id = cid.slice("btl_reject_".length);
    const b  = activeBattles.get(id);
    if (!b) return interaction.reply({ content: "❌ المعركة ما لقيتهاش!", ephemeral: true });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى!", ephemeral: true });

    clearTimeout(b._acceptTimeout);
    activeBattles.delete(id);
    userInBattle.delete(b.challenger);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🏳️ التحدي اترفض")
      .setDescription(`<@${b.opponent}> رفض التحدي! 😅\n<@${b.challenger}> متزعلش — كلنا بنخاف! 😏`)
      .setTimestamp();

    return interaction.update({ embeds: [embed], components: [] });
  }

  // ─── زر الضرب — بيفتح Modal ──────────────────────────────
  if (cid.startsWith("btl_attack_")) {
    const id = cid.slice("btl_attack_".length);
    const b  = activeBattles.get(id);
    if (!b || b.status !== "active")
      return interaction.reply({ content: "❌ المعركة دي انتهت!", ephemeral: true });

    const isChallenger = interaction.user.id === b.challenger;
    const isOpponent   = b.opponent !== "bot" && interaction.user.id === b.opponent;
    if (!isChallenger && !isOpponent)
      return interaction.reply({ content: "❌ إنت مش في المعركة دي!", ephemeral: true });

    const expectedId = b.currentTurn === "challenger" ? b.challenger : b.opponent;
    if (interaction.user.id !== expectedId)
      return interaction.reply({ content: "⏳ مش دورك دلوقتي! استنى خصمك يبعت طعنته.", ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`btl_modal_${id}`)
      .setTitle(`🗡️ جولة ${b.round} — طعنتك!`);

    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("attack_txt")
        .setLabel("اكتب طعنتك (جملة أو اتنين كحد أقصى)")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(5).setMaxLength(200).setRequired(true)
        .setPlaceholder("مثال: مش عارف تلعب ولا تتكلم، الاتنين بيجيلك غلط!")
    ));

    return interaction.showModal(modal);
  }

  // ─── استسلام ──────────────────────────────────────────────
  if (cid.startsWith("btl_forfeit_")) {
    const id = cid.slice("btl_forfeit_".length);
    const b  = activeBattles.get(id);
    if (!b) return interaction.reply({ content: "❌ مفيش معركة!", ephemeral: true });

    const isParticipant = interaction.user.id === b.challenger ||
      (b.opponent !== "bot" && interaction.user.id === b.opponent);
    if (!isParticipant)
      return interaction.reply({ content: "❌ إنت مش في المعركة دي!", ephemeral: true });

    clearTimeout(b._turnTimeout);
    const loser  = interaction.user.id;
    const winner = loser === b.challenger ? b.opponent : b.challenger;

    activeBattles.delete(id);
    userInBattle.delete(b.challenger);
    if (b.opponent !== "bot") userInBattle.delete(b.opponent);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🏳️ استسلام!")
      .setDescription(
        `<@${loser}> رفع الراية البيضا! 😂\n\n` +
        (winner === "bot" ? "🤖 **زنجي** يفوز بدون مجهود! 😈" : `🏆 <@${winner}> يفوز بالاستسلام!`)
      )
      .setTimestamp();

    if (winner !== "bot") {
      const u = db.getUser(winner);
      u.coins = (u.coins || 0) + WIN_COINS;
      db.updateUser(winner, u);
      embed.setFooter({ text: `🏆 ${WIN_COINS} كوينز اتضافت للفايز!` });
    }

    return interaction.update({ embeds: [embed], components: [] });
  }

  return false; // مش تبتاع البوت
}

// ══════════════════════════════════════════════════════════════
//  معالج الـ Modal (إرسال الطعنة)
// ══════════════════════════════════════════════════════════════
export async function handleBattleModal(interaction, db, geminiModel) {
  if (!interaction.customId.startsWith("btl_modal_")) return false;

  const id = interaction.customId.slice("btl_modal_".length);
  const b  = activeBattles.get(id);
  if (!b || b.status !== "active") {
    return interaction.reply({ content: "❌ المعركة دي انتهت!", ephemeral: true });
  }

  const attackText   = interaction.fields.getTextInputValue("attack_txt").trim();
  const isChallenger = interaction.user.id === b.challenger;
  const userName     = interaction.member?.displayName || interaction.user.displayName || interaction.user.username;

  await interaction.deferReply({ ephemeral: true });
  clearTimeout(b._turnTimeout);

  // خزّن الطعنة
  if (isChallenger) {
    b.currentRound.challengerAttack = attackText;
    b.currentRound.challengerName   = userName;
  } else {
    b.currentRound.opponentAttack = attackText;
    b.currentRound.opponentName   = userName;
  }

  const channel = await interaction.client.channels.fetch(b.channel).catch(() => null);

  // ─── ضد لاعب: لو المتحدي ضرب → ننتظر الخصم ───────────────
  if (b.opponent !== "bot" && isChallenger && !b.currentRound.opponentAttack) {
    b.currentTurn = "opponent";
    setBattleTimeout(id, channel);

    await interaction.editReply({ content: "✅ طعنتك اتسجلت! استنى رد خصمك..." });

    if (channel) {
      const waitEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`⚡ الجولة ${b.round} — دور <@${b.opponent}>`)
        .setDescription(`<@${b.challenger}> ضرب! دلوقتي دور <@${b.opponent}> يرد! 🛡️`)
        .setFooter({ text: "⏱️ عندك 3 دقايق!" })
        .setTimestamp();
      await channel.send({ embeds: [waitEmbed], components: [attackButtons(id)] });
    }
    return true;
  }

  // ─── الاتنين ضربوا (أو ضد البوت) → نحكّم ────────────────
  await interaction.editReply({ content: "⚡ بيتم التحكيم..." });

  const cAttack = b.currentRound.challengerAttack;
  const cName   = b.currentRound.challengerName || "المتحدي";
  let   oAttack = b.currentRound.opponentAttack;
  const oName   = b.opponent === "bot" ? "زنجي" : (b.currentRound.opponentName || "الخصم");

  if (b.opponent === "bot") {
    oAttack = await generateBotAttack(b.geminiModel, cName, cAttack, b.round);
  }

  const judgment = await judgeRound(b.geminiModel, cAttack, oAttack, cName, oName);
  b.scores.challenger += judgment.score1;
  b.scores.opponent   += judgment.score2;
  b.attacks.push({ round: b.round, cAttack, oAttack, ...judgment });

  // ─── Embed نتيجة الجولة ────────────────────────────────────
  const oLabel = b.opponent === "bot" ? "🤖 زنجي" : `<@${b.opponent}>`;
  const roundEmbed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`⚡ نتيجة الجولة ${b.round}`)
    .addFields(
      { name: `🗡️ ${cName} قال:`,  value: `> ${cAttack}`,              inline: false },
      { name: `🛡️ ${oName} رد:`,   value: `> ${oAttack}`,              inline: false },
      { name: `${cName}`,           value: scoreBar(judgment.score1),   inline: true  },
      { name: `${oName}`,           value: scoreBar(judgment.score2),   inline: true  },
      { name: "💬 رأي الحكم",      value: judgment.comment,            inline: false },
      { name: "📊 المجموع",         value: buildScoreLine(b, cName, oName), inline: false },
    )
    .setTimestamp();

  const currentRound = b.round;
  b.round++;
  b.currentRound = {};
  b.currentTurn  = "challenger";

  if (!channel) return true;
  await channel.send({ embeds: [roundEmbed] });

  // ─── انتهت المعركة ────────────────────────────────────────
  if (b.round > ROUNDS) {
    clearTimeout(b._turnTimeout);
    activeBattles.delete(id);
    userInBattle.delete(b.challenger);
    if (b.opponent !== "bot") userInBattle.delete(b.opponent);

    let winnerId   = null;
    let winnerName = "تعادل";
    if (b.scores.challenger > b.scores.opponent) {
      winnerId = b.challenger; winnerName = cName;
    } else if (b.scores.opponent > b.scores.challenger) {
      winnerId = b.opponent; winnerName = oName;
    }

    const totalC = b.scores.challenger;
    const totalO = b.scores.opponent;

    const finalEmbed = new EmbedBuilder()
      .setColor(winnerId ? 0xf1c40f : 0x3498db)
      .setTitle(winnerId ? "🏆 المعركة انتهت — في فايز!" : "🤝 تعادل!")
      .setDescription(
        winnerId
          ? (winnerId === "bot"
            ? `🤖 **زنجي** يفوز بـ **${totalO}** نقطة مقابل **${totalC}**! جرب تاني يا جدع 😈`
            : `🎉 <@${winnerId}> يفوز بـ **${Math.max(totalC, totalO)}** نقطة مقابل **${Math.min(totalC, totalO)}**!`)
          : `**${totalC}** نقطة لكل واحد — معركة شرسة يا جماعة! 🔥`
      )
      .addFields(
        { name: `<@${b.challenger}>`, value: `🪙 ${totalC} نقطة`,                                      inline: true },
        { name: "⚡ VS",               value: "────",                                                    inline: true },
        { name: oLabel,               value: `🪙 ${totalO} نقطة`,                                      inline: true },
      )
      .setTimestamp();

    if (winnerId && winnerId !== "bot") {
      const u = db.getUser(winnerId);
      u.coins = (u.coins || 0) + WIN_COINS;
      db.updateUser(winnerId, u);
      finalEmbed.setFooter({ text: `🏆 ${WIN_COINS} كوينز اتضافت للفايز!` });
    }

    await channel.send({ embeds: [finalEmbed] });
    return true;
  }

  // ─── الجولة التالية ───────────────────────────────────────
  setBattleTimeout(id, channel);

  const nextEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🥊 الجولة ${b.round} من ${ROUNDS}`)
    .setDescription(`دور <@${b.challenger}> يضرب!`)
    .addFields({ name: "📊 المجموع", value: buildScoreLine(b, cName, oName), inline: false })
    .setFooter({ text: "⏱️ عندك 3 دقايق للطعنة!" })
    .setTimestamp();

  await channel.send({ embeds: [nextEmbed], components: [attackButtons(id)] });
  return true;
}

// ══════════════════════════════════════════════════════════════
//  Timeout — لو حد ما ردش في الوقت
// ══════════════════════════════════════════════════════════════
function setBattleTimeout(id, channel) {
  const b = activeBattles.get(id);
  if (!b) return;
  clearTimeout(b._turnTimeout);
  b._turnTimeout = setTimeout(async () => {
    const battle = activeBattles.get(id);
    if (!battle) return;
    activeBattles.delete(id);
    userInBattle.delete(battle.challenger);
    if (battle.opponent !== "bot") userInBattle.delete(battle.opponent);

    const whosTurn = battle.currentTurn === "challenger"
      ? `<@${battle.challenger}>`
      : (battle.opponent === "bot" ? "🤖 زنجي" : `<@${battle.opponent}>`);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("⏰ انتهى الوقت!")
      .setDescription(`${whosTurn} ما ردش في الوقت — المعركة اتلغت! 😴`)
      .setTimestamp();

    if (channel && typeof channel.send === "function") {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }, TURN_TIMEOUT);
}
