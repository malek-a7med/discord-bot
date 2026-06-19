// ═══════════════════════════════════════════════════════════════
//  🏆 نظام التحديات اليومية — Daily Challenges
//  كل يوم تحدي مختلف في الروم — أول 3 يكملوا يكسبوا كوينز بونص
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const CHALLENGE_CHANNEL_ID = "1517365030335811644";

// أنواع التحديات اليومية
const CHALLENGE_TYPES = [
  {
    type: "quiz",
    label: "🧠 تحدي الثقافة",
    generate: () => {
      const items = [
        { q: "كم عدد كواكب المجموعة الشمسية؟",             ans: "8",          hint: "رقم" },
        { q: "ما عاصمة اليابان؟",                           ans: "طوكيو",       hint: "مدينة" },
        { q: "من اخترع التليفون؟",                           ans: "بيل",         hint: "اسم عيلة" },
        { q: "كم يوم في السنة الكبيسة؟",                   ans: "366",         hint: "رقم" },
        { q: "ما أسرع طائر في العالم؟",                     ans: "الصقر",       hint: "حيوان" },
        { q: "كم عدد أضلاع المثلث؟",                        ans: "3",           hint: "رقم" },
        { q: "ما اللغة الأكثر انتشاراً في العالم؟",         ans: "الإنجليزية", hint: "لغة" },
        { q: "ما أكبر قارة في العالم؟",                     ans: "آسيا",        hint: "قارة" },
        { q: "كم ساعة في اليوم؟",                           ans: "24",          hint: "رقم" },
        { q: "ما عاصمة المملكة العربية السعودية؟",          ans: "الرياض",      hint: "مدينة" },
        { q: "من كتب رواية هاري بوتر؟",                     ans: "رولينج",      hint: "اسم الكاتبة" },
        { q: "ما اسم أطول نهر في العالم؟",                  ans: "النيل",       hint: "نهر" },
        { q: "كم لون في قوس قزح؟",                          ans: "7",           hint: "رقم" },
        { q: "ما أصغر دولة في العالم مساحةً؟",              ans: "الفاتيكان",   hint: "دولة" },
        { q: "كم عدد أشهر السنة؟",                          ans: "12",          hint: "رقم" },
      ];
      return items[Math.floor(Math.random() * items.length)];
    },
    description: (data) =>
      `**السؤال:** ${data.q}\n\n💡 **تلميح:** الإجابة ${data.hint}\n\nاكتب إجابتك في الروم! أول **3 أشخاص** يجاوبوا صح يكسبوا الجايزة 🏆`,
    coinReward: 150,
    xpReward: 50,
    timeLimit: 5 * 60 * 1000, // 5 دقايق
    checkAnswer: (msg, data) => {
      const content = msg.content.trim().toLowerCase();
      return content.includes(data.ans.toLowerCase());
    },
  },
  {
    type: "count",
    label: "🔢 تحدي العد",
    generate: () => {
      const target = Math.floor(Math.random() * 40) + 10; // 10–49
      return { target };
    },
    description: (data) =>
      `اعدوا مع بعض من **1** لـ **${data.target}**!\n\nقاعدة: كل شخص يكتب رقم واحد بس في كل وقت ✋\nلو حد كتب رقم غلط أو كرر — بنبدأ من الأول 🔄\n\nأول فريق يوصل **${data.target}** يكسب! 🏆`,
    coinReward: 100,
    xpReward: 35,
    timeLimit: 10 * 60 * 1000, // 10 دقايق
    checkAnswer: (msg, data, state) => {
      const num = parseInt(msg.content.trim(), 10);
      if (isNaN(num)) return false;
      if (num !== (state.currentCount || 0) + 1) {
        state.currentCount = 0;
        return "reset";
      }
      state.currentCount = num;
      return num === data.target ? true : "progress";
    },
  },
  {
    type: "fast",
    label: "⚡ تحدي السرعة",
    generate: () => {
      const words = ["بطيخ", "قمر", "نجمة", "سمكة", "زهرة", "جبل", "بحر", "شمس", "قطة", "كلب", "فيل", "أسد", "تفاح", "موزة", "برتقال"];
      const word = words[Math.floor(Math.random() * words.length)];
      return { word };
    },
    description: (data) =>
      `اكتب الكلمة دي بالظبط أسرع ما تقدر:\n\n# \`${data.word}\`\n\n⚡ أسرع **3 أشخاص** يكتبوها صح يكسبوا الجايزة!`,
    coinReward: 80,
    xpReward: 25,
    timeLimit: 3 * 60 * 1000, // 3 دقايق
    checkAnswer: (msg, data) => msg.content.trim() === data.word,
  },
];

// حالة التحدي الحالي
let currentChallenge = null;

function getTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function pickChallenge() {
  // نختار تحدي مختلف كل يوم بالتسلسل
  const d = new Date();
  const dayIndex = Math.floor(d.getTime() / 86_400_000) % CHALLENGE_TYPES.length;
  return CHALLENGE_TYPES[dayIndex];
}

function buildChallengeEmbed(type, data, winners = [], ended = false) {
  const color = ended ? 0x555555 : 0xf1c40f;
  const desc = ended
    ? `⏰ انتهى التحدي!\n\n` + (winners.length
        ? `🏆 **الفايزين:**\n${winners.map((w, i) => `${["🥇","🥈","🥉"][i]} ${w}`).join("\n")}`
        : `😅 للأسف محدش كمّل التحدي الأسبوع ده!`)
    : type.description(data) +
      (winners.length
        ? `\n\n✅ **وصلوا لحد دلوقتي (${winners.length}/3):**\n${winners.map((w, i) => `${["🥇","🥈","🥉"][i]} ${w}`).join("\n")}`
        : "");

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(ended ? `${type.label} — انتهى!` : `${type.label} — تحدي الجمعة!`)
    .setDescription(desc)
    .addFields(
      { name: "🪙 الجايزة", value: `${type.coinReward} كوينز + ${type.xpReward} XP لكل فايز`, inline: true },
      { name: "👥 الفايزين", value: `${winners.length}/3`, inline: true },
    )
    .setFooter({ text: "التحدي الأسبوعي — كل جمعة بعد الصلاة 🕌" })
    .setTimestamp();
}

function buildChallengeButton(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`daily_skip_${gameId}`)
      .setLabel("⏭️ أوقف التحدي (أدمن)")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  )];
}

export async function postDailyChallenge(client, db) {
  const todayKey = getTodayKey();

  // لو التحدي بُعت النهارده بالفعل، ما نبعتش تاني
  if (currentChallenge && currentChallenge.todayKey === todayKey) return;

  const channel = await client.channels.fetch(CHALLENGE_CHANNEL_ID).catch(() => null);
  if (!channel) return console.error("❌ [DailyChallenge] مش لاقي الروم:", CHALLENGE_CHANNEL_ID);

  const type = pickChallenge();
  const data = type.generate();
  const gameId = `dc${Date.now().toString(36)}`;

  const msg = await channel.send({
    content: "||@everyone||",
    allowedMentions: { everyone: true },
    embeds: [buildChallengeEmbed(type, data)],
    components: buildChallengeButton(gameId),
  });

  const state = {
    todayKey,
    gameId,
    type,
    data,
    messageId: msg.id,
    channelId: channel.id,
    winners: [],
    winnerIds: new Set(),
    ended: false,
    currentCount: 0,  // لـ تحدي العد
  };
  currentChallenge = state;

  // Collector للرسايل
  const filter = (m) => !m.author.bot && !state.winnerIds.has(m.author.id);
  const collector = channel.createMessageCollector({ filter, time: type.timeLimit });

  collector.on("collect", async (m) => {
    if (state.ended) return;

    const result = type.checkAnswer(m, data, state);

    if (result === "reset") {
      await m.react("❌").catch(() => {});
      const resetMsg = await channel.send(`🔄 **${m.author.displayName}** كتب رقم غلط — نبدأ من الأول!`).catch(() => null);
      if (resetMsg) setTimeout(() => resetMsg.delete().catch(() => {}), 4000);
      return;
    }

    if (result === "progress") {
      await m.react("✅").catch(() => {});
      return;
    }

    if (result === true) {
      state.winnerIds.add(m.author.id);
      state.winners.push(m.author.displayName);
      await m.react("🏆").catch(() => {});

      if (db) {
        const u = db.getUser(m.author.id);
        u.coins = (u.coins || 0) + type.coinReward;
        u.xp    = (u.xp    || 0) + type.xpReward;
        db.updateUser(m.author.id, u);
      }

      await msg.edit({
        embeds: [buildChallengeEmbed(type, data, state.winners)],
        components: buildChallengeButton(gameId),
      }).catch(() => {});

      if (state.winners.length >= 3) collector.stop("full");
    }
  });

  collector.on("end", async (_, reason) => {
    if (state.ended) return;
    state.ended = true;
    await msg.edit({
      embeds: [buildChallengeEmbed(type, data, state.winners, true)],
      components: buildChallengeButton(gameId, true),
    }).catch(() => {});
    if (reason === "full") {
      await channel.send(`🎉 **انتهى التحدي!** مبروك للفايزين:\n${state.winners.map((w,i)=>`${["🥇","🥈","🥉"][i]} **${w}**`).join("\n")}`).catch(() => {});
    }
  });
}

export async function handleDailyChallengeButton(interaction) {
  const isAdmin = interaction.member?.permissions?.has("ManageGuild");
  if (!isAdmin) return interaction.reply({ content: "❌ الزرار ده للأدمن بس!", flags: 64 });

  const parts = interaction.customId.split("_");
  const gameId = parts[2];

  if (!currentChallenge || currentChallenge.gameId !== gameId) {
    return interaction.reply({ content: "❌ التحدي ده انتهى بالفعل!", flags: 64 });
  }

  currentChallenge.ended = true;
  await interaction.update({
    embeds: [buildChallengeEmbed(currentChallenge.type, currentChallenge.data, currentChallenge.winners, true)],
    components: buildChallengeButton(gameId, true),
  });
}

// جدولة التحدي الأسبوعي — كل جمعة الساعة 11 صباحاً UTC (= 1 ظهراً القاهرة UTC+2)
export function scheduleDailyChallenge(client, db) {
  const MS_IN_WEEK = 7 * 86_400_000;
  const FRIDAY     = 5;            // 0=الأحد … 5=الجمعة
  const TARGET_UTC = 11;           // 11:00 UTC = 1:00 ظهراً بتوقيت القاهرة

  function msUntilNextFriday() {
    const now  = new Date();
    const next = new Date(now);
    next.setUTCHours(TARGET_UTC, 0, 0, 0);
    const daysAway = (FRIDAY - next.getUTCDay() + 7) % 7;
    // لو اليوم جمعة والوقت فات، أجّل لأسبوع جاي
    if (daysAway === 0 && next <= now) {
      next.setUTCDate(next.getUTCDate() + 7);
    } else {
      next.setUTCDate(next.getUTCDate() + daysAway);
    }
    return next.getTime() - now.getTime();
  }

  setTimeout(function tick() {
    postDailyChallenge(client, db).catch(console.error);
    setTimeout(tick, MS_IN_WEEK);
  }, msUntilNextFriday());

  const mins = Math.round(msUntilNextFriday() / 60_000);
  const hrs  = Math.floor(mins / 60);
  const rem  = mins % 60;
  console.log(`✅ [WeeklyChallenge] جُدوِل — التحدي القادم يوم الجمعة الساعة 1 ظهراً (بعد ${hrs} ساعة و${rem} دقيقة)`);
}
