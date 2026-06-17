// ═══════════════════════════════════════════════════════════════
//  🥊 الديناميكا — مصارعة كلام
//  تصميم بسيط: تحدي → قبول → كل واحد يضرب في الشات → زنجي يحكّم
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

// ─── إعدادات ─────────────────────────────────────────────────
const ATTACK_SECS  = 40;          // ثواني لكل طعنة
const ACCEPT_SECS  = 60;          // ثواني للقبول
const WIN_COINS    = 300;

// ─── مواضيع فاجرة وكوميدية ───────────────────────────────────
const TOPICS = [
  "🍳 اهجم على طبخه اللي بيسمم الجيران وبيخلي الكلاب تعوي",
  "💤 اهجم على نومه اللي بيصحى بعد الضهر ويقول إيه الوقت",
  "🎮 اهجم على لعبته اللي دايماً آخر المرتبة وبيلوم التيم",
  "💰 اهجم على مصاريفه اللي بيحسب كيلو الأرز بالدقيقة",
  "📱 اهجم على تعليقاته العبيطة على منشورات الناس",
  "🏋️ اهجم على اشتراكه في الجيم اللي بيدفعه ومشيش يوم",
  "🚗 اهجم على قيادته اللي بتخوف الأسفلت نفسه",
  "🎤 اهجم على غناؤه اللي بيوجع الأذن وبيبكي الميكروفون",
  "👗 اهجم على ستايله اللي بيخلي الدكان يرفضه",
  "🤳 اهجم على سيلفياته اللي بيعيد التصوير 40 مرة عشان صورة",
  "📚 اهجم على مذاكرته اللي بتبدأ ليلة الامتحان الساعة 12",
  "⚽ اهجم على لعبته الكورة اللي مدربه بيبكي كل مباراة",
  "🧠 اهجم على ذكاؤه اللي بيحتاج كالكيليتر في 2+2",
  "🍕 اهجم على أكله اللي بيطلب بيتزا وبيقول دايت",
  "💬 اهجم على تقلته اللي بيسألك إيه الأكل وهو مابيدفعش",
  "😴 اهجم على استناه في الصبح اللي بيبدأ من 6 المساء",
  "🎬 اهجم على اختياره الأفلام اللي بينام في نصها",
  "🌙 اهجم على سهره اللي عمره ما عمل حاجة مفيدة فيه",
];

// ─── بيانات المعارك النشطة ────────────────────────────────────
const activeBattles = new Map(); // battleId → battle
const userInBattle  = new Map(); // userId   → battleId

// ─── تعريف الأمر ─────────────────────────────────────────────
export const battleCommand = new SlashCommandBuilder()
  .setName("مصارعة")
  .setDescription("🥊 تحدّى حد في مصارعة كلام — أحسن طعنة تكسب!")
  .addUserOption(opt =>
    opt.setName("خصم")
      .setDescription("اختار خصمك (اتركه فاضي عشان تلعب مع زنجي 🤖)")
  );

// ─── مساعدات ─────────────────────────────────────────────────
const makeId = () => `b${Date.now().toString(36)}`;
const randTopic = () => TOPICS[Math.floor(Math.random() * TOPICS.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function scoreBar(n) {
  const filled = Math.round((n / 10) * 10);
  return "🟥".repeat(filled) + "⬛".repeat(10 - filled) + `  **${n}/10**`;
}

// ══════════════════════════════════════════════════════════════
//  معالج أمر /مصارعة
// ══════════════════════════════════════════════════════════════
export async function handleBattleCommand(interaction, db, geminiModel) {
  const challenger = interaction.user;
  const opponent   = interaction.options.getUser("خصم");

  if (userInBattle.has(challenger.id)) {
    return interaction.reply({
      content: "❌ إنت كمان في معركة دلوقتي — خلصها الأول!",
      ephemeral: true,
    });
  }

  // ─── مباشرة ضد البوت ─────────────────────────────────────
  if (!opponent) {
    await interaction.deferReply();
    return runBattle(interaction, db, geminiModel, challenger.id, "bot");
  }

  // ─── ضد لاعب ─────────────────────────────────────────────
  if (opponent.id === challenger.id)
    return interaction.reply({ content: "❌ مش هينفع تتحارب مع نفسك 😂", ephemeral: true });
  if (opponent.bot)
    return interaction.reply({ content: "❌ اكتب الأمر من غير خصم عشان تتحارب مع زنجي 🤖", ephemeral: true });
  if (userInBattle.has(opponent.id))
    return interaction.reply({ content: `❌ **${opponent.displayName}** في معركة تانية دلوقتي!`, ephemeral: true });

  // ─── ابعت التحدي ─────────────────────────────────────────
  const id = makeId();
  activeBattles.set(id, {
    id, challenger: challenger.id, opponent: opponent.id,
    opponentIsBot: false, status: "waiting", db, geminiModel,
    channel: interaction.channelId,
  });
  userInBattle.set(challenger.id, id);

  const challengeEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🥊 تحدي مصارعة كلام!")
    .setDescription(
      `> ${challenger} بيتحداك يا ${opponent} في مصارعة كلام!\n\n` +
      `**إيه اللعبة؟**\n` +
      `كل واحد بيكتب طعنة في الشات على موضوع معين\n` +
      `زنجي بيحكّم ويديكم نقطة من 10 مع تعليق مضحك 😈\n` +
      `الفايز بياخد **${WIN_COINS} 🪙 كوينز**\n\n` +
      `⏱️ عندك **${ACCEPT_SECS} ثانية** تقبل!`
    )
    .addFields(
      { name: "🗡️ المتحدي", value: `${challenger}`, inline: true },
      { name: "⚡ VS",       value: "────────",       inline: true },
      { name: "🛡️ الخصم",  value: `${opponent}`,    inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btl_accept_${id}`)
      .setLabel("✅ قبلت التحدي!")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btl_reject_${id}`)
      .setLabel("❌ مش مهتم")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [challengeEmbed], components: [row] });

  // تنتهي صلاحية التحدي بعد ACCEPT_SECS
  setTimeout(() => {
    const b = activeBattles.get(id);
    if (b?.status === "waiting") {
      activeBattles.delete(id);
      userInBattle.delete(challenger.id);
      interaction.editReply({ components: [] }).catch(() => {});
    }
  }, ACCEPT_SECS * 1000);
}

// ══════════════════════════════════════════════════════════════
//  تشغيل المعركة الفعلية
//  challengerId = id المتحدي | opponentId = id الخصم أو "bot"
// ══════════════════════════════════════════════════════════════
async function runBattle(interactionOrCtx, db, geminiModel, challengerId, opponentId) {
  const isBot    = opponentId === "bot";
  const channel  = interactionOrCtx.channel
    || await interactionOrCtx.client?.channels?.fetch(interactionOrCtx.channelId).catch(() => null);
  if (!channel) return;

  // سجّل اللاعبين
  userInBattle.set(challengerId, "active");
  if (!isBot) userInBattle.set(opponentId, "active");

  const topic    = randTopic();
  const oMention = isBot ? "🤖 **زنجي**" : `<@${opponentId}>`;

  // ─── إعلان بداية المعركة ─────────────────────────────────
  const startEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🔥 المعركة بدأت!")
    .setDescription(
      `**<@${challengerId}>** ⚔️ ${oMention}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 **الموضوع:**\n> ${topic}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `**طريقة اللعب:**\n` +
      `1️⃣ <@${challengerId}> يكتب طعنته في الشات (**${ATTACK_SECS} ثانية**)\n` +
      `2️⃣ ${oMention} يرد بطعنته (**${ATTACK_SECS} ثانية**)\n` +
      `3️⃣ زنجي يحكّم ويعلن الفايز 🏆\n\n` +
      `⏱️ **<@${challengerId}> — اكتب طعنتك دلوقتي!**`
    )
    .setFooter({ text: "💡 ابعت رسالة في الشات مباشرة — مش محتاج زراير!" })
    .setTimestamp();

  const sendFn = interactionOrCtx.editReply?.bind(interactionOrCtx)
    || (m => channel.send(m));

  await sendFn({ embeds: [startEmbed], components: [] }).catch(() =>
    channel.send({ embeds: [startEmbed] }).catch(() => {})
  );

  // ─── اجمع طعنة المتحدي ────────────────────────────────────
  const cAttack = await waitForMessage(channel, challengerId, ATTACK_SECS);

  if (!cAttack) {
    cleanup(challengerId, opponentId);
    return channel.send({
      embeds: [timeoutEmbed(`⏰ <@${challengerId}> ما طعنش في الوقت — المعركة اتلغت!`)]
    }).catch(() => {});
  }

  // ─── رد الخصم ────────────────────────────────────────────
  let oAttack;

  if (isBot) {
    // البوت يرد على طول
    const thinkEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setDescription(`**<@${challengerId}> طعن:**\n> ${cAttack}\n\n⏳ زنجي بيفكر في رده...`)
      .setTimestamp();
    await channel.send({ embeds: [thinkEmbed] }).catch(() => {});
    oAttack = await botCounterAttack(geminiModel, challengerId, cAttack, topic);
  } else {
    // أعلن دور الخصم
    const oppEmbed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`⚡ دور ${oMention} دلوقتي!`)
      .setDescription(
        `**<@${challengerId}> طعن:**\n> ${cAttack}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⏱️ ${oMention} — **ردّ في الشات! (${ATTACK_SECS} ثانية)**`
      )
      .setTimestamp();
    await channel.send({ embeds: [oppEmbed] }).catch(() => {});

    oAttack = await waitForMessage(channel, opponentId, ATTACK_SECS);
    if (!oAttack) {
      cleanup(challengerId, opponentId);
      return channel.send({
        embeds: [timeoutEmbed(`⏰ ${oMention} ما ردش في الوقت — المعركة اتلغت!`)]
      }).catch(() => {});
    }
  }

  // ─── التحكيم ──────────────────────────────────────────────
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x2c3e50)
      .setDescription("⏳ **زنجي بيقيّم الطعنتين ويكتب حكمه...**")
      .setTimestamp()]
  }).catch(() => {});

  const cName = (await channel.client.users.fetch(challengerId).catch(() => null))
    ?.displayName || `<@${challengerId}>`;
  const oName = isBot ? "زنجي"
    : ((await channel.client.users.fetch(opponentId).catch(() => null))?.displayName || `<@${opponentId}>`);

  const result = await judgeAttacks(geminiModel, cAttack, oAttack, cName, oName, topic);

  // ─── حساب الفايز ─────────────────────────────────────────
  let winnerId = null;
  let winnerLine = "";
  const { score1, score2, comment, reaction1, reaction2 } = result;

  if (score1 > score2) {
    winnerId  = challengerId;
    winnerLine = `🏆 **<@${challengerId}> فاز!**  ${score1} ⚡ ${score2}`;
  } else if (score2 > score1) {
    winnerId  = isBot ? "bot" : opponentId;
    winnerLine = isBot
      ? `🤖 **زنجي فاز!** 😈  ${score2} ⚡ ${score1}`
      : `🏆 **${oMention} فاز!**  ${score2} ⚡ ${score1}`;
  } else {
    winnerLine = `🤝 **تعادل!**  ${score1} ⚡ ${score2}`;
  }

  if (winnerId && winnerId !== "bot") {
    const u = db.getUser(winnerId);
    u.coins = (u.coins || 0) + WIN_COINS;
    db.updateUser(winnerId, u);
  }

  // ─── embed النهائية ───────────────────────────────────────
  const finalEmbed = new EmbedBuilder()
    .setColor(winnerId ? 0xf1c40f : 0x3498db)
    .setTitle("🏟️ نتيجة المعركة!")
    .setDescription(winnerLine)
    .addFields(
      {
        name: `🗡️ <@${challengerId}> — ${reaction1}`,
        value: `> ${cAttack}\n${scoreBar(score1)}`,
        inline: false,
      },
      {
        name: `🛡️ ${oMention} — ${reaction2}`,
        value: `> ${oAttack}\n${scoreBar(score2)}`,
        inline: false,
      },
      {
        name: "💬 حكم زنجي",
        value: `*${comment}*`,
        inline: false,
      },
    )
    .setFooter({ text: winnerId && winnerId !== "bot" ? `+${WIN_COINS} 🪙 اتضافوا للفايز!` : "معركة شرسة! 🔥" })
    .setTimestamp();

  await channel.send({ embeds: [finalEmbed] }).catch(() => {});
  cleanup(challengerId, opponentId);
}

// ══════════════════════════════════════════════════════════════
//  انتظار رسالة من لاعب محدد في الشات
// ══════════════════════════════════════════════════════════════
function waitForMessage(channel, userId, seconds) {
  return new Promise(resolve => {
    const filter = m => m.author.id === userId && !m.author.bot && m.content.trim().length >= 3;
    const collector = channel.createMessageCollector({ filter, max: 1, time: seconds * 1000 });

    collector.on("collect", m => {
      m.react("⚡").catch(() => {});
      resolve(m.content.trim().slice(0, 350));
    });

    collector.on("end", (col, reason) => {
      if (reason !== "limit") resolve(null);
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  توليد طعنة البوت
// ══════════════════════════════════════════════════════════════
async function botCounterAttack(geminiModel, opponentId, theirAttack, topic) {
  const prompt =
    `أنت "زنجي" بوت مصري بتلعب مصارعة كلام.\n` +
    `الموضوع: ${topic}\n` +
    `خصمك <@${opponentId}> قال: "${theirAttack}"\n\n` +
    `رد عليه بطعنة مضحكة وذكية بالعامية المصرية. سطر أو اتنين بس. ` +
    `لا إهانات حقيقية — فقط ذكاء لفظي مضحك.`;
  try {
    const res = await geminiModel.generateContent(prompt);
    return res.response.text().trim().slice(0, 300);
  } catch {
    const fallbacks = [
      "كلامك جاني وراح بالأوتوبيس اللي قبله! 🚌",
      "يا ولدي أنا زنجي — وجودي بس طعنة! ✨",
      "بكرة لما تكبر تفهم ليه خسرت 😏",
      "الله يرحم اللي علّمك الكلام ده 😅",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ══════════════════════════════════════════════════════════════
//  التحكيم بـ Gemini
// ══════════════════════════════════════════════════════════════
async function judgeAttacks(geminiModel, a1, a2, n1, n2, topic) {
  const prompt =
    `أنت حكم في مصارعة كلام مصرية بالعامية.\n` +
    `الموضوع: ${topic}\n` +
    `${n1}: "${a1}"\n${n2}: "${a2}"\n\n` +
    `قيّمهم وارد بـ JSON فقط بدون أي نص خارجه:\n` +
    `{"score1":7,"score2":8,"comment":"تعليق مضحك جداً بالعامية جملة واحدة","reaction1":"وصف قصير للطعنة","reaction2":"وصف قصير للطعنة"}`;
  try {
    const res   = await geminiModel.generateContent(prompt);
    const txt   = res.response.text();
    const match = txt.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("no json");
    const p = JSON.parse(match[0]);
    return {
      score1:    Math.min(10, Math.max(1, Number(p.score1) || 5)),
      score2:    Math.min(10, Math.max(1, Number(p.score2) || 5)),
      comment:   p.comment   || "جولة محترمة من الاتنين! 🤷",
      reaction1: p.reaction1 || "طعنة لابسة",
      reaction2: p.reaction2 || "رد محترم",
    };
  } catch {
    return { score1: 5, score2: 5, comment: "والله صعبة — الاتنين كويسين! 😅", reaction1: "👌", reaction2: "👌" };
  }
}

// ══════════════════════════════════════════════════════════════
//  معالج الأزرار (قبول / رفض)
// ══════════════════════════════════════════════════════════════
export async function handleBattleButton(interaction, db, geminiModel) {
  const cid = interaction.customId;

  // ─── قبول التحدي ─────────────────────────────────────────
  if (cid.startsWith("btl_accept_")) {
    const id = cid.slice("btl_accept_".length);
    const b  = activeBattles.get(id);

    if (!b || b.status !== "waiting")
      return interaction.reply({ content: "❌ التحدي انتهى أو المعركة بدأت مسبقاً!", ephemeral: true });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى في المعركة دي!", ephemeral: true });

    b.status = "active";
    activeBattles.delete(id);

    await interaction.update({ components: [] }).catch(() => {});
    return runBattle(interaction, db, geminiModel, b.challenger, b.opponent);
  }

  // ─── رفض التحدي ──────────────────────────────────────────
  if (cid.startsWith("btl_reject_")) {
    const id = cid.slice("btl_reject_".length);
    const b  = activeBattles.get(id);

    if (!b)
      return interaction.reply({ content: "❌ التحدي انتهى مسبقاً!", ephemeral: true });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى في المعركة دي!", ephemeral: true });

    activeBattles.delete(id);
    userInBattle.delete(b.challenger);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🏳️ التحدي اترفض")
      .setDescription(
        `<@${b.opponent}> رفض التحدي! 😅\n` +
        `<@${b.challenger}> متزعلش — مفيش حد يتحداك! 😏`
      )
      .setTimestamp();

    return interaction.update({ embeds: [embed], components: [] });
  }

  return false;
}

// ══════════════════════════════════════════════════════════════
//  لا modals مستخدمة في اللعبة الجديدة
// ══════════════════════════════════════════════════════════════
export async function handleBattleModal(interaction, db, geminiModel) {
  return false;
}

// ─── مساعدات داخلية ──────────────────────────────────────────
function cleanup(challengerId, opponentId) {
  userInBattle.delete(challengerId);
  if (opponentId !== "bot") userInBattle.delete(opponentId);
}

function timeoutEmbed(msg) {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle("⏰ انتهى الوقت!")
    .setDescription(msg)
    .setTimestamp();
}
