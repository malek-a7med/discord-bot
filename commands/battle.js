// ═══════════════════════════════════════════════════════════════
//  الديناميكا 🥊 — مصارعة الكلام — نظام chat collector سريع
//  بدون modals — اللعبة في الـ chat مباشرة وفيها إثارة حقيقية
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

// ── إعدادات اللعبة ───────────────────────────────────────────
const ROUNDS       = 3;
const WIN_COINS    = 300;
const ATTACK_TIME  = 45_000; // 45 ثانية لكل طعنة
const ACCEPT_TIME  = 60_000; // دقيقة للقبول

// ── مواضيع الجولات (عشوائية) ─────────────────────────────────
const TOPICS = [
  "🍳 طبخك اللي بيسمم الجيران",
  "💤 نومك اللي بيخزي الأموات",
  "📱 تعليقاتك الفارغة على السوشيال ميديا",
  "⚽ لعبك الكورة اللي بيبكي المدرب",
  "🧠 ذكاؤك اللي بيلجأ للكالكيوليتر في 2+2",
  "👗 ستايلك اللي بيخلي البيت يبكي",
  "🎮 لعبك الجيمز وإنت بتخسر دايماً",
  "🚗 قيادتك اللي بتخوف الأسفلت",
  "🏋️ اشتراكك في الجيم اللي بيزوره كل ٦ شهور",
  "💰 مصاريفك اللي بتخلي الفلوس تعيط",
  "📚 مذاكرتك اللي بتبدأ بعد الامتحان بيوم",
  "🎤 غناؤك اللي بيأذي الميكروفون",
  "🤳 صورك السيلفي اللي بتخوف الكاميرا",
  "🍕 أكلك اللي بيحكي عن شخصيتك",
  "😴 استناك في الصبح اللي بيعطّل الكون",
];

// ── بيانات المعارك ────────────────────────────────────────────
const activeBattles = new Map(); // battleId → battle
const userInBattle  = new Map(); // userId   → battleId

// ── تعريف الأمر ──────────────────────────────────────────────
export const battleCommand = new SlashCommandBuilder()
  .setName("مصارعة")
  .setDescription("🥊 الديناميكا — تحدّي في مصارعة كلام مباشرة!")
  .addUserOption(opt =>
    opt.setName("خصم")
      .setDescription("اختار خصمك (اتركه فاضي عشان تتحارب مع زنجي 🤖)")
  );

// ── مساعدات ──────────────────────────────────────────────────
function makeId() {
  return `b${Date.now().toString(36)}`;
}

function randomTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

function scoreBar(score) {
  const n = Math.round((score / 10) * 8);
  return "🟥".repeat(n) + "⬛".repeat(8 - n) + `  **${score}/10**`;
}

function buildArenaEmbed(b, phase, extra = {}) {
  const oLabel  = b.opponentIsBot ? "🤖 زنجي" : `<@${b.opponent}>`;
  const cScore  = b.scores.challenger;
  const oScore  = b.scores.opponent;
  const colors  = [0xe74c3c, 0xf39c12, 0x9b59b6];
  const color   = colors[(b.round - 1) % colors.length];

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: "🥊 الديناميكا — مصارعة الكلام" })
    .addFields(
      { name: "🗡️ المتحدي",    value: `<@${b.challenger}>`,                          inline: true },
      { name: "⚡ VS",           value: "────────",                                    inline: true },
      { name: "🛡️ الخصم",      value: oLabel,                                         inline: true },
      { name: "📊 النتيجة",     value: `<@${b.challenger}>: **${cScore}** ⚡ ${oLabel}: **${oScore}**`, inline: false },
      { name: "🎯 الجولة",      value: `${b.round} / ${ROUNDS}`,                      inline: true },
      { name: "📌 الموضوع",     value: b.currentTopic || "—",                         inline: false },
    )
    .setFooter({ text: "الديناميكا Bot 🥊" })
    .setTimestamp();

  if (phase === "waiting_challenger") {
    embed.setTitle(`🔥 الجولة ${b.round} — دور <@${b.challenger}> يضرب!`);
    embed.setDescription(`⏱️ **اكتب طعنتك في الشات دلوقتي — عندك 45 ثانية!**\n\n> الموضوع: ${b.currentTopic}`);
  } else if (phase === "waiting_opponent") {
    embed.setTitle(`⚡ الجولة ${b.round} — دور ${oLabel} يرد!`);
    embed.setDescription(
      `**<@${b.challenger}> طعن:**\n> ${extra.cAttack || "—"}\n\n` +
      `⏱️ **${oLabel}، ابعت ردك في الشات — 45 ثانية!**`
    );
  } else if (phase === "judging") {
    embed.setTitle(`⏳ الجولة ${b.round} — الحكم بيفكر...`);
    embed.setDescription("🤖 زنجي بيحكّم الطعنتين دلوقتي...");
  } else if (phase === "round_result") {
    embed.setTitle(`📣 نتيجة الجولة ${b.round}`);
    embed.addFields(
      { name: `🗡️ <@${b.challenger}> قال:`,   value: `> ${extra.cAttack || "—"}`,  inline: false },
      { name: `🛡️ ${oLabel} رد:`,             value: `> ${extra.oAttack || "—"}`,  inline: false },
      { name: `<@${b.challenger}>`,            value: scoreBar(extra.score1 || 0),  inline: true  },
      { name: `${oLabel}`,                     value: scoreBar(extra.score2 || 0),  inline: true  },
      { name: "💬 رأي زنجي الحكم",           value: extra.comment || "—",         inline: false },
    );
  } else if (phase === "timeout") {
    embed.setTitle("⏰ انتهى الوقت!");
    embed.setDescription(extra.msg || "حد ما ردش في الوقت!");
    embed.setColor(0x95a5a6);
  }

  return embed;
}

// ── توليد طعنة البوت ─────────────────────────────────────────
async function generateBotAttack(geminiModel, pName, pAttack, topic) {
  const prompt =
    `أنت "زنجي" — بوت مصري في مصارعة كلام.\n` +
    `الموضوع هو: ${topic}\n` +
    `خصمك "${pName}" قال: "${pAttack}"\n\n` +
    `رد بطعنة مضحكة وذكية بالعامية المصرية، سطر أو اتنين بس. ` +
    `ذكاء لفظي لا إهانة حقيقية.`;
  try {
    const res = await geminiModel.generateContent(prompt);
    return res.response.text().trim().slice(0, 300);
  } catch {
    const fb = [
      "كلامك جاني وراح بالأوتوبيس اللي بعده 🚌",
      "ولا الموضوع ده بيستاهل ردي 😴",
      "بكرة لما تكبر تفهم ليه خسرت 😏",
      "أنا زنجي — وجودي بس طعنة! ✨",
    ];
    return fb[Math.floor(Math.random() * fb.length)];
  }
}

// ── تحكيم الجولة ─────────────────────────────────────────────
async function judgeRound(geminiModel, a1, a2, n1, n2, topic) {
  const prompt =
    `أنت حكم في مصارعة كلام مصرية.\n` +
    `الموضوع: ${topic}\n` +
    `${n1}: "${a1}"\n${n2}: "${a2}"\n\n` +
    `قيّمهم وارد بـ JSON فقط:\n` +
    `{"score1":X,"score2":Y,"comment":"تعليق مضحك قصير بالعامية"}`;
  try {
    const res   = await geminiModel.generateContent(prompt);
    const match = res.response.text().match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("no json");
    const p = JSON.parse(match[0]);
    return {
      score1:  Math.min(10, Math.max(0, Number(p.score1) || 5)),
      score2:  Math.min(10, Math.max(0, Number(p.score2) || 5)),
      comment: p.comment || "جولة متكافئة! 🤷",
    };
  } catch {
    return { score1: 5, score2: 5, comment: "صعبة والله — نقطة لكل واحد! 😅" };
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
    return startBattle(interaction, db, geminiModel, challenger, null);
  }

  // ─── ضد لاعب ──────────────────────────────────────────────
  if (opponent.id === challenger.id)
    return interaction.reply({ content: "❌ ما تقدرش تتحارب مع نفسك! 😂", ephemeral: true });
  if (opponent.bot)
    return interaction.reply({ content: "❌ اكتب `/مصارعة` من غير خصم عشان تتحارب مع زنجي 🤖", ephemeral: true });
  if (userInBattle.has(opponent.id))
    return interaction.reply({ content: `❌ **${opponent.displayName}** في معركة دلوقتي!`, ephemeral: true });

  // أرسل تحدي
  const id = makeId();
  activeBattles.set(id, {
    id, challenger: challenger.id, opponent: opponent.id,
    opponentIsBot: false, channel: interaction.channelId,
    round: 1, scores: { challenger: 0, opponent: 0 },
    attacks: [], status: "waiting", currentTopic: null,
    geminiModel, db,
  });
  userInBattle.set(challenger.id, id);

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🥊 تحدي مصارعة كلام!")
    .setDescription(
      `${challenger} بيتحداك يا ${opponent}!\n\n` +
      `**الأوضاع:** ${ROUNDS} جولات، كل جولة ليها موضوع مختلف\n` +
      `**الفايز:** يكسب **${WIN_COINS} 🪙 كوينز**\n\n` +
      `> هتقبل ولا هتجري يا عيني؟ 😤`
    )
    .addFields(
      { name: "🥊 المتحدي",  value: `${challenger}`,  inline: true },
      { name: "⚡ VS",        value: "────",            inline: true },
      { name: "🛡️ المتحدَى", value: `${opponent}`,     inline: true },
    )
    .setFooter({ text: "⏱️ عندك دقيقة تقبل أو ترفض!" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`btl_accept_${id}`).setLabel("✅ قبلت التحدي!").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`btl_reject_${id}`).setLabel("❌ مش مهتم").setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row] });

  // expire after ACCEPT_TIME
  activeBattles.get(id)._acceptTimer = setTimeout(() => {
    const b = activeBattles.get(id);
    if (b?.status === "waiting") {
      activeBattles.delete(id);
      userInBattle.delete(challenger.id);
    }
  }, ACCEPT_TIME);
}

// ══════════════════════════════════════════════════════════════
//  بدء المعركة الفعلية (بعد القبول أو ضد البوت مباشرة)
// ══════════════════════════════════════════════════════════════
async function startBattle(interaction, db, geminiModel, challenger, opponentUser) {
  const id = makeId();
  const isBot = !opponentUser;

  const battle = {
    id, challenger: challenger.id,
    opponent:      isBot ? "bot" : opponentUser.id,
    opponentIsBot: isBot,
    channel: interaction.channelId,
    round: 1, scores: { challenger: 0, opponent: 0 },
    attacks: [], status: "active",
    currentTopic: randomTopic(),
    geminiModel, db,
  };
  activeBattles.set(id, battle);
  userInBattle.set(challenger.id, id);
  if (!isBot) userInBattle.set(opponentUser.id, id);

  const oLabel = isBot ? "🤖 زنجي" : `<@${opponentUser.id}>`;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🔥 المعركة بدأت!")
    .setDescription(
      `**<@${challenger.id}>** ⚔️ **${oLabel}**\n\n` +
      `📌 **موضوع الجولة 1:**\n> ${battle.currentTopic}\n\n` +
      `⏱️ **<@${challenger.id}> — اكتب طعنتك في الشات دلوقتي! (45 ثانية)**`
    )
    .addFields(
      { name: "🎯 الجولات",  value: `${ROUNDS} جولات`,        inline: true },
      { name: "🏆 المكافأة", value: `${WIN_COINS} 🪙 للفايز`,  inline: true },
    )
    .setFooter({ text: "💡 ابعت رسالة في الشات مباشرة — مش محتاج تضغط أي زرار!" })
    .setTimestamp();

  let message;
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: [] });
    message = await interaction.fetchReply();
  } else {
    await interaction.reply({ embeds: [embed], components: [] });
    message = await interaction.fetchReply();
  }

  battle._message = message;

  // ابدأ جولة أولى
  await runRound(battle, interaction.channel || await interaction.client.channels.fetch(interaction.channelId));
}

// ══════════════════════════════════════════════════════════════
//  تشغيل الجولة — collect من الـ chat
// ══════════════════════════════════════════════════════════════
async function runRound(battle, channel) {
  if (!channel || battle.status !== "active") return;

  const b = battle;

  // ─── اجمع طعنة المتحدي ────────────────────────────────────
  const cAttack = await collectMessage(channel, b.challenger, b.currentTopic, "challenger", b);
  if (cAttack === null) {
    return endBattle(b, channel, "timeout", `⏰ <@${b.challenger}> ما طعنش في الوقت — المعركة اتلغت!`);
  }

  // ─── رد الخصم (بوت أو لاعب) ─────────────────────────────
  let oAttack;
  const oLabel = b.opponentIsBot ? "🤖 زنجي" : `<@${b.opponent}>`;

  if (b.opponentIsBot) {
    // البوت يرد على طول
    const waitEmbed = buildArenaEmbed(b, "judging");
    waitEmbed.setDescription(`**<@${b.challenger}> طعن:**\n> ${cAttack}\n\n⏳ زنجي بيفكر في رد...`);
    await channel.send({ embeds: [waitEmbed] }).catch(() => {});
    oAttack = await generateBotAttack(b.geminiModel, `<@${b.challenger}>`, cAttack, b.currentTopic);
  } else {
    // نطلب من الخصم
    const oppWaitEmbed = buildArenaEmbed(b, "waiting_opponent", { cAttack });
    await channel.send({ embeds: [oppWaitEmbed] }).catch(() => {});

    oAttack = await collectMessage(channel, b.opponent, b.currentTopic, "opponent", b);
    if (oAttack === null) {
      return endBattle(b, channel, "timeout", `⏰ ${oLabel} ما ردش في الوقت — المعركة اتلغت!`);
    }
  }

  // ─── التحكيم ──────────────────────────────────────────────
  const cName = (await channel.client.users.fetch(b.challenger).catch(() => null))?.displayName
    || `<@${b.challenger}>`;
  const oName = b.opponentIsBot ? "زنجي"
    : ((await channel.client.users.fetch(b.opponent).catch(() => null))?.displayName || `<@${b.opponent}>`);

  const judgment = await judgeRound(b.geminiModel, cAttack, oAttack, cName, oName, b.currentTopic);
  b.scores.challenger += judgment.score1;
  b.scores.opponent   += judgment.score2;
  b.attacks.push({ round: b.round, cAttack, oAttack, ...judgment });

  // ─── عرض نتيجة الجولة ────────────────────────────────────
  const resultEmbed = buildArenaEmbed(b, "round_result", {
    cAttack, oAttack,
    score1: judgment.score1, score2: judgment.score2,
    comment: judgment.comment,
  });
  const resultMsg = await channel.send({ embeds: [resultEmbed] }).catch(() => null);

  // reactions للتصويت
  if (resultMsg) {
    await resultMsg.react("🗡️").catch(() => {});
    await resultMsg.react("🛡️").catch(() => {});
  }

  await sleep(2500);

  b.round++;

  // ─── نهاية المعركة؟ ──────────────────────────────────────
  if (b.round > ROUNDS) {
    return endBattle(b, channel, "winner");
  }

  // ─── الجولة التالية ──────────────────────────────────────
  b.currentTopic = randomTopic();
  const nextEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🥊 الجولة ${b.round} من ${ROUNDS}`)
    .setDescription(
      `📌 **الموضوع الجديد:**\n> ${b.currentTopic}\n\n` +
      `⏱️ **<@${b.challenger}> — اضرب! (45 ثانية)**`
    )
    .addFields({
      name: "📊 المجموع",
      value: `<@${b.challenger}>: **${b.scores.challenger}** ⚡ ${oLabel}: **${b.scores.opponent}**`,
      inline: false,
    })
    .setFooter({ text: "💡 ابعت رسالة في الشات مباشرة!" })
    .setTimestamp();

  await channel.send({ embeds: [nextEmbed] }).catch(() => {});
  await runRound(b, channel);
}

// ══════════════════════════════════════════════════════════════
//  collect رسالة من لاعب محدد في الـ channel
// ══════════════════════════════════════════════════════════════
function collectMessage(channel, userId, topic, role, battle) {
  return new Promise((resolve) => {
    if (battle.status !== "active") return resolve(null);

    const filter = m => m.author.id === userId && !m.author.bot && m.content.trim().length >= 3;
    const collector = channel.createMessageCollector({ filter, max: 1, time: ATTACK_TIME });

    // countdown في الكونسول بس (مش رسالة زيادة في الشات)
    const tickInterval = setInterval(() => {
      if (battle.status !== "active") {
        clearInterval(tickInterval);
        collector.stop("inactive");
      }
    }, 5000);

    collector.on("collect", (msg) => {
      clearInterval(tickInterval);
      // أضف reaction على الرسالة عشان نعرف إنها اتسجلت
      msg.react("⚡").catch(() => {});
      resolve(msg.content.trim().slice(0, 300));
    });

    collector.on("end", (collected, reason) => {
      clearInterval(tickInterval);
      if (reason !== "limit" && collected.size === 0) {
        resolve(null);
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  إنهاء المعركة
// ══════════════════════════════════════════════════════════════
async function endBattle(battle, channel, reason, timeoutMsg = "") {
  if (battle.status !== "active") return;
  battle.status = "ended";

  activeBattles.delete(battle.id);
  userInBattle.delete(battle.challenger);
  if (!battle.opponentIsBot) userInBattle.delete(battle.opponent);

  if (reason === "timeout") {
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("⏰ انتهى الوقت!")
      .setDescription(timeoutMsg)
      .setTimestamp();
    return channel.send({ embeds: [embed] }).catch(() => {});
  }

  const oLabel = battle.opponentIsBot ? "🤖 زنجي" : `<@${battle.opponent}>`;
  const cScore = battle.scores.challenger;
  const oScore = battle.scores.opponent;

  let winnerId   = null;
  let winnerText = "";

  if (cScore > oScore) {
    winnerId   = battle.challenger;
    winnerText = `🏆 <@${battle.challenger}> يفوز بـ **${cScore}** مقابل **${oScore}**! 🎉`;
  } else if (oScore > cScore) {
    winnerId   = battle.opponentIsBot ? "bot" : battle.opponent;
    winnerText = battle.opponentIsBot
      ? `🤖 **زنجي** يفوز بـ **${oScore}** مقابل **${cScore}**! صعبان أوي 😈`
      : `🏆 ${oLabel} يفوز بـ **${oScore}** مقابل **${cScore}**! 🎉`;
  } else {
    winnerText = `🤝 **تعادل!** كلهم **${cScore}** نقطة — معركة شرسة! 🔥`;
  }

  // تاريخ الجولات
  const historyLines = battle.attacks.map(a =>
    `**ج${a.round}:** 🗡️${a.score1} vs 🛡️${a.score2} — *${a.comment}*`
  ).join("\n");

  const finalEmbed = new EmbedBuilder()
    .setColor(winnerId ? 0xf1c40f : 0x3498db)
    .setTitle("🏟️ المعركة انتهت!")
    .setDescription(winnerText)
    .addFields(
      { name: `<@${battle.challenger}>`, value: `🪙 ${cScore} نقطة`,   inline: true },
      { name: "⚡ VS",                   value: "────",                  inline: true },
      { name: oLabel,                    value: `🪙 ${oScore} نقطة`,    inline: true },
      { name: "📋 ملخص الجولات",        value: historyLines || "—",     inline: false },
    )
    .setTimestamp();

  if (winnerId && winnerId !== "bot") {
    const u = battle.db.getUser(winnerId);
    u.coins = (u.coins || 0) + WIN_COINS;
    battle.db.updateUser(winnerId, u);
    finalEmbed.setFooter({ text: `🏆 ${WIN_COINS} كوينز اتضافت للفايز!` });
  }

  await channel.send({ embeds: [finalEmbed] }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════
//  معالج الأزرار (قبول / رفض / استسلام)
// ══════════════════════════════════════════════════════════════
export async function handleBattleButton(interaction, db, geminiModel) {
  const cid = interaction.customId;

  // ─── قبول ─────────────────────────────────────────────────
  if (cid.startsWith("btl_accept_")) {
    const id = cid.slice("btl_accept_".length);
    const b  = activeBattles.get(id);
    if (!b || b.status !== "waiting")
      return interaction.reply({ content: "❌ انتهى وقت القبول أو المعركة دي خلصت!", ephemeral: true });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى في المعركة دي!", ephemeral: true });

    clearTimeout(b._acceptTimer);
    b.status = "active";

    const challenger = await interaction.client.users.fetch(b.challenger).catch(() => null);
    const channel    = interaction.channel;

    await interaction.update({ components: [] });
    await startBattle(interaction, db, geminiModel, challenger, interaction.user);
    return;
  }

  // ─── رفض ──────────────────────────────────────────────────
  if (cid.startsWith("btl_reject_")) {
    const id = cid.slice("btl_reject_".length);
    const b  = activeBattles.get(id);
    if (!b) return interaction.reply({ content: "❌ المعركة ما لقيتهاش!", ephemeral: true });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى!", ephemeral: true });

    clearTimeout(b._acceptTimer);
    activeBattles.delete(id);
    userInBattle.delete(b.challenger);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🏳️ التحدي اترفض")
      .setDescription(`<@${b.opponent}> رفض التحدي! 😅\n<@${b.challenger}> متزعلش — كلنا بنخاف! 😏`)
      .setTimestamp();

    return interaction.update({ embeds: [embed], components: [] });
  }

  return false;
}

// ── لا modals في اللعبة الجديدة ──────────────────────────────
export async function handleBattleModal(interaction, db, geminiModel) {
  return false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
