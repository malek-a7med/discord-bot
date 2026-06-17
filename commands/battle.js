// ═══════════════════════════════════════════════════════════════
//  🪨📄✂️ مصارعة — حجر ورقة مقص
//  بسيطة: تحدي → قبول → كل واحد يختار سراً → النتيجة فوراً
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const WIN_COINS   = 200;
const CHOOSE_SECS = 30;
const ACCEPT_SECS = 60;

// 🪨 rock  📄 paper  ✂️ scissors
const CHOICES = {
  rock:     { label: "🪨 حجر",    emoji: "🪨" },
  paper:    { label: "📄 ورقة",   emoji: "📄" },
  scissors: { label: "✂️ مقص",   emoji: "✂️" },
};

// حجر يكسر مقص | ورقة تغطي حجر | مقص يقص ورقة
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

const WIN_LINES = [
  "فاز بفارق رهيب!", "جداً واضح! 😎", "كانها سهلة عليه!", "أجمد من المتوقع! 🔥",
];
const DRAW_LINES = [
  "تعادل! الاتنين فكروا زي بعض 🤔", "نفس التفكير! جرّوا تاني.", "إيه ده! تعادل تمام 😲",
];

const activeBattles = new Map(); // battleId → battle
const userInBattle  = new Map(); // userId   → battleId

const makeId  = () => `b${Date.now().toString(36)}`;
const randArr = arr => arr[Math.floor(Math.random() * arr.length)];

// ─── الأمر ────────────────────────────────────────────────────
export const battleCommand = new SlashCommandBuilder()
  .setName("مصارعة")
  .setDescription("🪨📄✂️ حجر ورقة مقص — تحدّى حد وكسب كوينز!")
  .addUserOption(opt =>
    opt.setName("خصم")
      .setDescription("اختار خصمك (اتركه فاضي تلعب مع زنجي 🤖)")
  );

// ─── أزرار الاختيار ──────────────────────────────────────────
function choiceRow(battleId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btl_pick_${battleId}_rock`)
      .setLabel("🪨 حجر")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btl_pick_${battleId}_paper`)
      .setLabel("📄 ورقة")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btl_pick_${battleId}_scissors`)
      .setLabel("✂️ مقص")
      .setStyle(ButtonStyle.Secondary),
  );
}

// ═══════════════════════════════════════════════════════════════
//  معالج الأمر /مصارعة
// ═══════════════════════════════════════════════════════════════
export async function handleBattleCommand(interaction, db, geminiModel) {
  const challenger = interaction.user;
  const opponent   = interaction.options.getUser("خصم");

  if (userInBattle.has(challenger.id)) {
    return interaction.reply({ content: "❌ إنت في معركة دلوقتي — خلصها الأول!", flags: 64 });
  }

  // ─── ضد البوت مباشرة ─────────────────────────────────────
  if (!opponent) {
    return startGame(interaction, db, challenger.id, "bot");
  }

  if (opponent.id === challenger.id)
    return interaction.reply({ content: "❌ مش هينفع تتحارب مع نفسك 😂", flags: 64 });
  if (opponent.bot)
    return interaction.reply({ content: "❌ اكتب الأمر من غير خصم عشان تتحارب مع زنجي 🤖", flags: 64 });
  if (userInBattle.has(opponent.id))
    return interaction.reply({ content: `❌ **${opponent.displayName}** في معركة دلوقتي!`, flags: 64 });

  // ─── ابعت تحدي للخصم ────────────────────────────────────
  const id = makeId();
  activeBattles.set(id, { id, challenger: challenger.id, opponent: opponent.id, status: "waiting", db });
  userInBattle.set(challenger.id, id);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🪨📄✂️ تحدي حجر ورقة مقص!")
    .setDescription(
      `${challenger} بيتحداك يا ${opponent}!\n\n` +
      `**اللعبة:**\n` +
      `كل واحد يختار سراً: 🪨 حجر أو 📄 ورقة أو ✂️ مقص\n` +
      `بعدين النتيجة بتتكشف مع بعض — الفايز بياخد **${WIN_COINS} 🪙**\n\n` +
      `⏱️ عندك **${ACCEPT_SECS} ثانية** تقبل!`
    )
    .addFields(
      { name: "🗡️ المتحدي",  value: `${challenger}`, inline: true },
      { name: "⚡ VS",        value: "────────",       inline: true },
      { name: "🛡️ الخصم",   value: `${opponent}`,    inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`btl_accept_${id}`).setLabel("✅ قبلت!").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`btl_reject_${id}`).setLabel("❌ مش مهتم").setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row] });

  // تنتهي صلاحية التحدي بعد ACCEPT_SECS
  setTimeout(() => {
    const b = activeBattles.get(id);
    if (b?.status === "waiting") {
      activeBattles.delete(id);
      userInBattle.delete(challenger.id);
      const expired = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setDescription(`⏰ انتهى وقت قبول التحدي — ${opponent} ما ردش!`)
        .setTimestamp();
      interaction.editReply({ embeds: [expired], components: [] }).catch(() => {});
    }
  }, ACCEPT_SECS * 1000);
}

// ═══════════════════════════════════════════════════════════════
//  بدء الجولة — إرسال أزرار الاختيار
// ═══════════════════════════════════════════════════════════════
async function startGame(interactionOrUpdate, db, challengerId, opponentId) {
  const isBot   = opponentId === "bot";
  const id      = makeId();
  const battle  = {
    id, challengerId, opponentId,
    choices:  {},   // { userId: "rock"|"paper"|"scissors" }
    status:   "choosing",
    db,
    msgRef:   null,
  };
  activeBattles.set(id, battle);
  userInBattle.set(challengerId, id);
  if (!isBot) userInBattle.set(opponentId, id);

  // لو ضد البوت — اختار فوراً وسرّ
  if (isBot) {
    battle.choices["bot"] = randArr(Object.keys(CHOICES));
  }

  const oLabel = isBot ? "🤖 زنجي" : `<@${opponentId}>`;

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🪨📄✂️ اختاروا دلوقتي!")
    .setDescription(
      `<@${challengerId}> ⚡ ${oLabel}\n\n` +
      `**اضغط على اختيارك — مش هيتكشف لحد الآخر يختار!**\n\n` +
      `⏱️ **${CHOOSE_SECS} ثانية**\n\n` +
      `${isBot ? "🤖 زنجي اختار سراً — اختار إنت دلوقتي!" : `<@${challengerId}> و${oLabel} — اختاروا!`}`
    )
    .addFields(
      { name: `<@${challengerId}>`, value: "⏳ لسه ما اختارش",    inline: true },
      { name: oLabel,               value: isBot ? "✅ اختار سراً 🤫" : "⏳ لسه ما اختارش", inline: true },
    )
    .setFooter({ text: "🤫 اختيارك بيفضل سري لحد ما الكل يختار!" })
    .setTimestamp();

  let msg;
  try {
    if (typeof interactionOrUpdate.editReply === "function") {
      await interactionOrUpdate.editReply({ embeds: [embed], components: [choiceRow(id)] }).catch(() => {});
      msg = await interactionOrUpdate.fetchReply().catch(() => null);
    } else {
      await interactionOrUpdate.update({ embeds: [embed], components: [choiceRow(id)] }).catch(() => {});
      msg = await interactionOrUpdate.fetchReply().catch(() => null);
    }
  } catch {
    msg = await interactionOrUpdate.channel?.send({ embeds: [embed], components: [choiceRow(id)] }).catch(() => null);
  }

  battle.msgRef = msg;

  // مؤقت انتهاء الوقت
  battle._timer = setTimeout(async () => {
    const b = activeBattles.get(id);
    if (!b || b.status !== "choosing") return;
    b.status = "done";
    activeBattles.delete(id);
    userInBattle.delete(challengerId);
    if (!isBot) userInBattle.delete(opponentId);

    const timeoutEmbed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("⏰ انتهى الوقت!")
      .setDescription("حد ما اختارش في الوقت — اللعبة اتلغت!")
      .setTimestamp();
    msg?.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
  }, CHOOSE_SECS * 1000);
}

// ═══════════════════════════════════════════════════════════════
//  معالج الأزرار
// ═══════════════════════════════════════════════════════════════
export async function handleBattleButton(interaction, db, geminiModel) {
  const cid = interaction.customId;

  // ─── قبول التحدي ─────────────────────────────────────────
  if (cid.startsWith("btl_accept_")) {
    const id = cid.slice("btl_accept_".length);
    const b  = activeBattles.get(id);

    if (!b || b.status !== "waiting")
      return interaction.reply({ content: "❌ التحدي انتهى!", flags: 64 });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى في المعركة دي!", flags: 64 });

    b.status = "active";
    activeBattles.delete(id);

    await interaction.deferUpdate().catch(() => {});
    return startGame(interaction, db, b.challenger, b.opponent);
  }

  // ─── رفض التحدي ──────────────────────────────────────────
  if (cid.startsWith("btl_reject_")) {
    const id = cid.slice("btl_reject_".length);
    const b  = activeBattles.get(id);

    if (!b) return interaction.reply({ content: "❌ التحدي انتهى!", flags: 64 });
    if (interaction.user.id !== b.opponent)
      return interaction.reply({ content: "❌ إنت مش المتحدَى!", flags: 64 });

    activeBattles.delete(id);
    userInBattle.delete(b.challenger);

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🏳️ التحدي اترفض")
      .setDescription(`<@${b.opponent}> رفض التحدي 😅\n<@${b.challenger}> الدنيا مش قايمة عليه! 😏`)
      .setTimestamp();
    return interaction.update({ embeds: [embed], components: [] });
  }

  // ─── اختيار حجر/ورقة/مقص ────────────────────────────────
  if (cid.startsWith("btl_pick_")) {
    const parts    = cid.split("_");   // ["btl","pick",battleId,"choice"]
    const choice   = parts[parts.length - 1];
    const battleId = parts.slice(2, -1).join("_");
    const b        = activeBattles.get(battleId);
    const userId   = interaction.user.id;

    if (!b || b.status !== "choosing")
      return interaction.reply({ content: "❌ اللعبة مش شغالة دلوقتي!", flags: 64 });

    if (userId !== b.challengerId && userId !== b.opponentId)
      return interaction.reply({ content: "❌ إنت مش في المعركة دي!", flags: 64 });

    if (b.choices[userId])
      return interaction.reply({
        content: `✅ إنت اخترت ${CHOICES[b.choices[userId]].emoji} — استنى الآخر!`,
        flags: 64,
      });

    // سجّل الاختيار
    b.choices[userId] = choice;
    await interaction.reply({
      content: `✅ اخترت **${CHOICES[choice].label}** — سري تماماً! 🤫 استنى الآخر يختار...`,
      flags: 64,
    });

    // حدّث الـ embed: أظهر مين اختار (بدون كشف الاختيار)
    const oLabel  = b.opponentId === "bot" ? "🤖 زنجي" : `<@${b.opponentId}>`;
    const cChosen = !!b.choices[b.challengerId];
    const oChosen = b.opponentId === "bot" || !!b.choices[b.opponentId];

    const updEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🪨📄✂️ اختاروا دلوقتي!")
      .setDescription(
        `<@${b.challengerId}> ⚡ ${oLabel}\n\n` +
        (cChosen && oChosen
          ? "✅ الكل اختار — بيتكشف النتيجة دلوقتي..."
          : "⏳ **استنى الآخر يختار...**")
      )
      .addFields(
        { name: `<@${b.challengerId}>`, value: cChosen ? "✅ اختار! 🤫" : "⏳ لسه",              inline: true },
        { name: oLabel,                  value: oChosen ? "✅ اختار! 🤫" : "⏳ لسه",              inline: true },
      )
      .setFooter({ text: "🤫 الاختيارات محفوظة — النتيجة بعد شوية!" })
      .setTimestamp();

    await b.msgRef?.edit({
      embeds: [updEmbed],
      components: cChosen && oChosen ? [] : [choiceRow(battleId)],
    }).catch(() => {});

    // لو الكل اختار — أظهر النتيجة
    if (cChosen && oChosen) {
      clearTimeout(b._timer);
      b.status = "done";
      activeBattles.delete(battleId);
      userInBattle.delete(b.challengerId);
      if (b.opponentId !== "bot") userInBattle.delete(b.opponentId);
      await revealResult(b);
    }

    return;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
//  كشف النتيجة
// ═══════════════════════════════════════════════════════════════
async function revealResult(b) {
  const channel = b.msgRef?.channel;
  if (!channel) return;

  const cChoice = b.choices[b.challengerId];
  const oChoice = b.opponentId === "bot" ? b.choices["bot"] : b.choices[b.opponentId];
  const oLabel  = b.opponentId === "bot" ? "🤖 زنجي" : `<@${b.opponentId}>`;

  // تأخير درامي صغير
  await new Promise(r => setTimeout(r, 800));

  let resultLine, color, winnerId;
  if (cChoice === oChoice) {
    // تعادل
    resultLine = `🤝 **تعادل!** كلهم اختاروا ${CHOICES[cChoice].emoji}\n*${randArr(DRAW_LINES)}*`;
    color      = 0x3498db;
    winnerId   = null;
  } else if (BEATS[cChoice] === oChoice) {
    // المتحدي فاز
    winnerId   = b.challengerId;
    resultLine = `🏆 **<@${b.challengerId}> فاز!** ${CHOICES[cChoice].emoji} يكسب ${CHOICES[oChoice].emoji}\n*${randArr(WIN_LINES)}*`;
    color      = 0xf1c40f;
  } else {
    // الخصم فاز
    winnerId   = b.opponentId === "bot" ? null : b.opponentId;
    const wLabel = b.opponentId === "bot" ? "🤖 زنجي" : `<@${b.opponentId}>`;
    resultLine = `🏆 **${wLabel} فاز!** ${CHOICES[oChoice].emoji} يكسب ${CHOICES[cChoice].emoji}\n*${randArr(WIN_LINES)}*`;
    color      = b.opponentId === "bot" ? 0xe74c3c : 0xf1c40f;
  }

  // أضف الكوينز للفايز
  if (winnerId) {
    const u = b.db.getUser(winnerId);
    u.coins = (u.coins || 0) + WIN_COINS;
    b.db.updateUser(winnerId, u);
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle("🎲 النتيجة!")
    .setDescription(resultLine)
    .addFields(
      { name: `<@${b.challengerId}>`, value: CHOICES[cChoice].emoji + " " + CHOICES[cChoice].label.split(" ")[1], inline: true },
      { name: "⚡ VS",                 value: "────",                                                                inline: true },
      { name: oLabel,                  value: CHOICES[oChoice].emoji + " " + CHOICES[oChoice].label.split(" ")[1], inline: true },
    )
    .setFooter({ text: winnerId ? `+${WIN_COINS} 🪙 اتضافوا للفايز!` : "لا فايز هالمرة!" })
    .setTimestamp();

  await b.msgRef?.edit({ embeds: [resultEmbed], components: [] }).catch(() =>
    channel.send({ embeds: [resultEmbed] }).catch(() => {})
  );
}

// ─── لا modals ────────────────────────────────────────────────
export async function handleBattleModal(interaction) { return false; }
