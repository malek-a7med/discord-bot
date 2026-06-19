// ═══════════════════════════════════════════════════════════════
//  🌍 الحياة — Full Life Simulation Game
//  كل لاعب يعيش حياة كاملة: تعليم → شغل → أسرة → استثمار → تقاعد
//  الفايز = أعلى نقاط حياة في الآخر
// ═══════════════════════════════════════════════════════════════
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";

const WIN_REWARD      = 400;
const START_MONEY     = 5000;
const START_HEALTH    = 100;
const START_HAPPINESS = 50;
const MAX_PLAYERS     = 6;
const MIN_PLAYERS     = 2;
const ROUNDS_TOTAL    = 10;

const lifeGames      = new Map(); // gameId → state
const lifeChannelMap = new Map(); // channelId → gameId

const makeId = () => `lif${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

// ── مراحل الحياة ──────────────────────────────────────────────
function getPhase(round) {
  if (round <= 2)  return "education";
  if (round <= 5)  return "work";
  if (round <= 7)  return "family";
  if (round <= 9)  return "investment";
  return "retirement";
}
const PHASE_NAMES = {
  education:  "🎓 التعليم",
  work:       "💼 الشغل",
  family:     "👨‍👩‍👧 الأسرة",
  investment: "📈 الاستثمار",
  retirement: "🏖️ التقاعد",
};

// ── أحداث كل مرحلة ────────────────────────────────────────────
const EVENTS = {
  education: [
    { text: "📚 ذاكرت طول الليل ونجحت بتميّز!",       money: 0,     health: -10, happiness: +15 },
    { text: "🏆 فزت في مسابقة علمية وكسبت جايزة!",     money: +1000, health: 0,   happiness: +25 },
    { text: "❌ رسبت في مادة ودفعت رسوم إعادة!",       money: -300,  health: 0,   happiness: -15 },
    { text: "🏥 مرضت وقعدت أسبوع في البيت!",            money: -400,  health: -20, happiness: -10 },
    { text: "👥 اتعلمت شغل جانبي وبدأت تكسب!",         money: +600,  health: 0,   happiness: +10 },
    { text: "🎨 اكتشفت موهبة فنية جديدة!",              money: 0,     health: 0,   happiness: +20 },
    { text: "📱 اشتريت موبايل جديد للدراسة!",           money: -800,  health: 0,   happiness: +10 },
    { text: "🎮 ضيّعت وقتك في الجيمز ومراجعتش!",       money: 0,     health: 0,   happiness: +15 },
    { text: "🏫 حضرت كورس إضافي وطوّرت نفسك!",         money: -500,  health: -5,  happiness: +15 },
    { text: "🤝 عملت مشروع مع زمايلك وكسبتوا!",        money: +800,  health: 0,   happiness: +20 },
    { text: "🏃 بدأت رياضة يومية وصحتك تحسّنت!",       money: -200,  health: +20, happiness: +15 },
    { text: "😴 نمت على الامتحان من الإرهاق!",          money: 0,     health: +10, happiness: -10 },
    {
      text: "🎓 عرض منحة دراسية بالخارج — هتروح؟",
      isChoice: true,
      optionA: { label: "✈️ روح المنحة!", money: +3000, health: -10, happiness: +30 },
      optionB: { label: "🏠 افضل مع أهلك",  money: 0,     health: +10, happiness: +10 },
    },
  ],
  work: [
    { text: "💼 اتعرضت على ترقية وقبلتها!",             money: +2500, health: -10, happiness: +15 },
    { text: "🔥 يوم بائس في الشغل — زعلان!",            money: +800,  health: -10, happiness: -15 },
    { text: "💰 بونص نهاية الشهر جه حلو!",              money: +2000, health: 0,   happiness: +20 },
    { text: "😴 أخدت إجازة مدفوعة وريّحت روحك!",        money: -300,  health: +15, happiness: +25 },
    { text: "🔧 الموبايل اتكسر وعملت صيانة غالية!",     money: -1200, health: 0,   happiness: -10 },
    { text: "🚗 اشتريت عربية أوكازيون بس تعيبت!",       money: -2000, health: 0,   happiness: +10 },
    { text: "😰 ضغط شغل ومش قادر تنام صح!",             money: +1000, health: -20, happiness: -15 },
    { text: "📊 استثمار صغير في سهم كسبت منه!",         money: +1800, health: 0,   happiness: +10 },
    { text: "🍕 عزمت فريق الشغل على عشا!",               money: -600,  health: 0,   happiness: +15 },
    { text: "🔥 اتفصلت من الشغل فجأة!",                  money: -1000, health: -5,  happiness: -30 },
    { text: "💳 دفعت فلوس على دورة تدريبية!",            money: -800,  health: 0,   happiness: +20 },
    { text: "🤑 لقيت عمل بارتفاع عالي ونقلت!",           money: +3000, health: -10, happiness: +10 },
    { text: "🏖️ شركتك عملت رحلة للموظفين!",            money: 0,     health: +10, happiness: +30 },
    {
      text: "🤝 عرض شراكة في مشروع — هتشارك؟",
      isChoice: true,
      optionA: { label: "💪 اشترك في المشروع!", money: +4000, health: -15, happiness: +10 },
      optionB: { label: "😌 مش وقته دلوقتي",    money: 0,     health: +10, happiness: +5  },
    },
  ],
  family: [
    { text: "💍 اتجوزت وعملت فرح حلو!",                 money: -2500, health: 0,   happiness: +35 },
    { text: "👶 جالك مولود جميل!",                        money: -1000, health: -5,  happiness: +40 },
    { text: "🏠 اشتريت شقة وانتقلتوا!",                  money: -5000, health: 0,   happiness: +30 },
    { text: "💔 مشاكل عائلية صعبة الفترة دي!",           money: 0,     health: -10, happiness: -25 },
    { text: "🎊 فرح قريبك وانبسطت وصرفت!",               money: -800,  health: 0,   happiness: +15 },
    { text: "🩺 حد في العيلة مرض واحتاج!",               money: -2000, health: -5,  happiness: -20 },
    { text: "✈️ سافرتوا في إجازة عيلة رهيبة!",           money: -2000, health: +10, happiness: +30 },
    { text: "🤲 ساعدت أسرة محتاجة في الحي!",             money: -500,  health: 0,   happiness: +30 },
    { text: "🏘️ الجار رد عليك القرض القديم!",           money: +500,  health: 0,   happiness: +10 },
    { text: "🎂 عيد ميلاد أحد أفراد عيلتك — احتفلتوا!", money: -700,  health: 0,   happiness: +20 },
    { text: "👩‍🍳 بدأتوا تاكلوا بيت أكتر وصحتكم تحسّنت!", money: -400, health: +15, happiness: +15 },
    { text: "👨‍👦 ابنك / بنتك عملت حاجة تفتخر فيها!",    money: 0,     health: 0,   happiness: +35 },
    {
      text: "🏠 فرصة شقة بالتقسيط — هتاخدها؟",
      isChoice: true,
      optionA: { label: "🏠 اشتري الشقة!", money: -2000, health: -5, happiness: +25 },
      optionB: { label: "🏘️ افضل بالإيجار",  money: -500,  health: +5, happiness: +5  },
    },
  ],
  investment: [
    { text: "📈 الأسهم اللي استثمرت فيها طلعت!",         money: +3000, health: 0,   happiness: +25 },
    { text: "📉 الأسهم وقعت وخسرت شوية!",                money: -2000, health: -5,  happiness: -20 },
    { text: "💎 بعت حاجة قيمة كانت عندك!",               money: +2500, health: 0,   happiness: +5  },
    { text: "🏗️ فتحت مشروع صغير بدأ يكسب!",             money: +2000, health: -10, happiness: +20 },
    { text: "💥 المشروع خسر في أولانيه!",                 money: -1500, health: -10, happiness: -15 },
    { text: "🏦 حساب ادخار واستفدت من الفوايد!",          money: +800,  health: 0,   happiness: +10 },
    { text: "⚡ فاتورة كهرباء المحل جت غالية!",            money: -600,  health: 0,   happiness: -5  },
    { text: "🤝 شريك تجاري جاب عملاء جدد!",              money: +2500, health: 0,   happiness: +15 },
    { text: "🔥 دفعت ضرايب السنة!",                       money: -1000, health: 0,   happiness: -10 },
    { text: "🎰 جربت حظك وكسبت!",                         money: +1500, health: 0,   happiness: +20 },
    { text: "🌐 شغلك بدأ يتوسع أونلاين!",                 money: +2000, health: -5,  happiness: +20 },
    { text: "⚖️ مشاكل قانونية مع مورد — وكّلت محامي!",   money: -1200, health: -10, happiness: -10 },
    {
      text: "💹 فرصة استثمار عالي المخاطرة — هتجازف؟",
      isChoice: true,
      optionA: { label: "💰 جازف واستثمر!", money: +6000, health: -10, happiness: +20 },
      optionB: { label: "🛡️ العب بأمان",     money: +1000, health: +5,  happiness: +5  },
    },
  ],
  retirement: [
    { text: "🏖️ تقاعدت وبدأت تستمتع بوقتك!",           money: +1000, health: +20, happiness: +30 },
    { text: "🩺 فحص طبي — صحتك كويسة الحمد لله!",       money: -500,  health: +15, happiness: +15 },
    { text: "✈️ سافرت لبلد كنت دايماً عايز تروحها!",    money: -2000, health: +5,  happiness: +40 },
    { text: "📖 بدأت تكتب مذكرات حياتك!",                money: 0,     health: 0,   happiness: +25 },
    { text: "👴 حفيدك الأول اتولد — أسعد لحظة!",         money: -500,  health: 0,   happiness: +50 },
    { text: "💊 مصاريف دوا شهرية ثابتة!",                money: -600,  health: +10, happiness: -5  },
    { text: "🎨 بدأت هواية رسم في التقاعد!",             money: -300,  health: +5,  happiness: +30 },
    { text: "🤲 تبرعت لجمعية خيرية!",                    money: -800,  health: 0,   happiness: +35 },
    { text: "🏡 بنيت جنينة على سطح البيت!",              money: -400,  health: +10, happiness: +25 },
    { text: "🧘 بدأت تمارس مديتيشن وريّحت نفسك!",        money: 0,     health: +15, happiness: +30 },
  ],
};

function pickEvent(round) {
  const phase = getPhase(round);
  const arr   = EVENTS[phase];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── حساب النقاط النهائية ──────────────────────────────────────
function calcScore(stats) {
  const h  = Math.max(0, Math.min(100, stats.health));
  const ha = Math.max(0, stats.happiness);
  return Math.round(stats.money + h * 30 + ha * 20);
}

// ── Embeds ────────────────────────────────────────────────────
function buildLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("🌍 الحياة — انتظار اللاعبين")
    .setDescription(
      `**🎮 طريقة اللعب:**\n` +
      `┣ كل لاعب يعيش **10 جولات** من الحياة الواقعية\n` +
      `┣ مراحل: 🎓 تعليم ← 💼 شغل ← 👨‍👩‍👧 أسرة ← 📈 استثمار ← 🏖️ تقاعد\n` +
      `┣ اتخّذ قرارات تأثّر على **المال 💰 | الصحة ❤️ | السعادة 😊**\n` +
      `┣ النقاط = المال + (الصحة × 30) + (السعادة × 20)\n` +
      `┗ أعلى نقاط يفوز ويكسب **${WIN_REWARD} 🪙**!\n\n` +
      `👥 **اللاعبين (${state.players.length}/${MAX_PLAYERS}):**\n` +
      (state.players.map(id => `• <@${id}>`).join("\n") || "لا أحد بعد") +
      `\n\n⚠️ لازم ${MIN_PLAYERS} على الأقل`
    )
    .setFooter({ text: "اضغط انضم وابدأ رحلتك! 🌟" })
    .setTimestamp();
}

function buildLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bnk_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bnk_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function statsBar(stats) {
  const hpBar  = progressBar(stats.health, 100);
  const haBar  = progressBar(Math.min(100, Math.max(0, stats.happiness)), 100);
  return `💰 ${stats.money.toLocaleString()} جنيه | ❤️ ${hpBar} | 😊 ${haBar}`;
}

function progressBar(val, max) {
  const filled = Math.round((Math.max(0, val) / max) * 5);
  return "█".repeat(filled) + "░".repeat(5 - filled) + ` ${Math.max(0, val)}`;
}

function buildGameEmbed(state) {
  const currentId = state.players[state.currentPlayerIndex];
  const round     = (state.roundsPlayed[currentId] ?? 0) + 1;
  const phase     = PHASE_NAMES[getPhase(round)] ?? "🏖️ التقاعد";

  const playerList = state.players.map(id => {
    const s    = state.stats[id];
    const score = calcScore(s);
    const arrow = id === currentId && !state.ended ? "▶️ " : "   ";
    return `${arrow}<@${id}>\n    ${statsBar(s)}\n    🏆 النقاط: **${score.toLocaleString()}**`;
  }).join("\n\n");

  return new EmbedBuilder()
    .setColor(0x2980b9)
    .setTitle(`🌍 الحياة — جولة ${state.currentRound}/${ROUNDS_TOTAL}`)
    .addFields(
      { name: "📍 المرحلة الحالية", value: phase, inline: true },
      { name: "👥 اللاعب الحالي",   value: `<@${currentId}>`, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "📊 الأرصدة والإحصائيات", value: playerList },
    )
    .setFooter({ text: `💡 النقاط = المال + الصحة×30 + السعادة×20` })
    .setTimestamp();
}

function buildSpinRow(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_spin_${gameId}`).setLabel("🎲 العب دورك").setStyle(ButtonStyle.Primary),
  )];
}

function buildChoiceRow(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_choiceA_${gameId}`).setLabel("").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bnk_choiceB_${gameId}`).setLabel("").setStyle(ButtonStyle.Secondary),
  )];
}

// ── اللعب ────────────────────────────────────────────────────
export async function handleBankLifeCommand(interaction) {
  const channelId = interaction.channel.id;
  if (lifeChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة الحياة شغالة هنا — خلصوها الأول!", flags: 64 });

  const gameId = makeId();
  const state  = {
    id: gameId, channelId,
    creatorId: interaction.user.id,
    players: [interaction.user.id],
    stats: { [interaction.user.id]: { money: START_MONEY, health: START_HEALTH, happiness: START_HAPPINESS } },
    phase: "lobby",
    currentPlayerIndex: 0,
    roundsPlayed: { [interaction.user.id]: 0 },
    currentRound: 1,
    ended: false,
    pendingChoice: null,
  };
  lifeGames.set(gameId, state);
  lifeChannelMap.set(channelId, gameId);
  await interaction.reply({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
}

async function startGame(interaction, state) {
  state.phase = "playing";
  state.currentPlayerIndex = 0;
  for (const id of state.players) state.roundsPlayed[id] = 0;
  await interaction.update({ embeds: [buildGameEmbed(state)], components: buildSpinRow(state.id) });
}

async function doSpin(interaction, state) {
  const currentId = state.players[state.currentPlayerIndex];

  // حماية 1: مش في اللعبة أصلاً
  if (!state.players.includes(interaction.user.id))
    return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });

  // حماية 2: مش دوره
  if (interaction.user.id !== currentId)
    return interaction.reply({
      content: `❌ مش دورك! دلوقتي دور <@${currentId}> — استنّاه!`,
      flags: 64,
    });

  const round = (state.roundsPlayed[currentId] ?? 0) + 1;
  const event = pickEvent(round);

  if (event.isChoice) {
    state.pendingChoice = { playerId: currentId, event };
    const choiceEmbed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`🤔 قرار مهم في حياة <@${currentId}>!`)
      .setDescription(`**${event.text}**\n\nهتختار إيه؟`)
      .addFields(
        { name: `${event.optionA.label}`,
          value: applyText(event.optionA), inline: true },
        { name: `${event.optionB.label}`,
          value: applyText(event.optionB), inline: true },
      )
      .setTimestamp();

    const row = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bnk_choiceA_${state.id}`).setLabel(event.optionA.label).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bnk_choiceB_${state.id}`).setLabel(event.optionB.label).setStyle(ButtonStyle.Secondary),
    )];

    return interaction.update({ embeds: [buildGameEmbed(state), choiceEmbed], components: row });
  }

  applyEvent(state, currentId, event);
  return finishTurn(interaction, state, currentId, event);
}

function applyText(opt) {
  const parts = [];
  if (opt.money)    parts.push(`💰 ${opt.money > 0 ? "+" : ""}${opt.money.toLocaleString()} جنيه`);
  if (opt.health)   parts.push(`❤️ ${opt.health > 0 ? "+" : ""}${opt.health}`);
  if (opt.happiness) parts.push(`😊 ${opt.happiness > 0 ? "+" : ""}${opt.happiness}`);
  return parts.join("\n") || "لا تغيير";
}

function applyEvent(state, playerId, changes) {
  const s = state.stats[playerId];
  s.money     = Math.max(0, s.money + (changes.money ?? 0));
  s.health    = Math.max(0, Math.min(100, s.health + (changes.health ?? 0)));
  s.happiness = s.happiness + (changes.happiness ?? 0);
}

async function finishTurn(interaction, state, playerId, event) {
  state.roundsPlayed[playerId] = (state.roundsPlayed[playerId] ?? 0) + 1;
  state.pendingChoice           = null;

  const changeText = buildChangeText(event);
  const eventColor = (event.money ?? 0) >= 0 ? 0x2ecc71 : 0xe74c3c;
  const s          = state.stats[playerId];
  const eventEmbed = new EmbedBuilder()
    .setColor(eventColor)
    .setTitle(`📰 ما حصل لـ <@${playerId}>`)
    .setDescription(`${event.text}\n\n${changeText}`)
    .addFields({ name: "📊 وضعك بعد الحدث", value: statsBar(s) })
    .setTimestamp();

  // انتقل للتالي
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  if (state.currentPlayerIndex === 0) state.currentRound++;

  const allDone = state.players.every(id => (state.roundsPlayed[id] ?? 0) >= ROUNDS_TOTAL);
  if (allDone) return endGame(interaction, state, eventEmbed);

  const gameEmbed = buildGameEmbed(state);
  await interaction.update({ embeds: [eventEmbed, gameEmbed], components: buildSpinRow(state.id) });
}

function buildChangeText(event) {
  const lines = [];
  if (event.money)     lines.push(`💰 ${event.money > 0 ? "+" : ""}${event.money.toLocaleString()} جنيه`);
  if (event.health)    lines.push(`❤️ ${event.health > 0 ? "+" : ""}${event.health} صحة`);
  if (event.happiness) lines.push(`😊 ${event.happiness > 0 ? "+" : ""}${event.happiness} سعادة`);
  return lines.length ? lines.join(" | ") : "لا تغيير في الأرقام";
}

async function endGame(interaction, state, lastEventEmbed) {
  state.ended = true;
  lifeGames.delete(state.id);
  lifeChannelMap.delete(state.channelId);

  const sorted   = [...state.players].sort((a, b) => calcScore(state.stats[b]) - calcScore(state.stats[a]));
  const winner   = sorted[0];
  const medals   = ["🥇", "🥈", "🥉"];
  const board    = sorted.map((id, i) => {
    const s     = state.stats[id];
    const score = calcScore(s);
    return `${medals[i] ?? `${i + 1}.`} <@${id}>\n    ${statsBar(s)}\n    🏆 **${score.toLocaleString()} نقطة**`;
  }).join("\n\n");

  const endEmbed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🌍 انتهت لعبة الحياة!")
    .setDescription(`🎉 **الفايز بحياته: <@${winner}>!**\n\n**📊 الترتيب النهائي:**\n\n${board}`)
    .setFooter({ text: `🌍 الحياة — الفايز بياخد ${WIN_REWARD} 🪙 | النقاط = مال + صحة×30 + سعادة×20` })
    .setTimestamp();

  await interaction.update({ embeds: [lastEventEmbed, endEmbed], components: [] });

  if (interaction.client?._db) {
    try { interaction.client._db.addCoins(winner, WIN_REWARD); } catch {}
  }
}

// ── Handler الرئيسي للأزرار ───────────────────────────────────
export async function handleBankLifeButton(interaction, db) {
  const full   = interaction.customId;
  // bnk_join_xxx / bnk_start_xxx / bnk_cancel_xxx / bnk_spin_xxx / bnk_choiceA_xxx / bnk_choiceB_xxx
  const second = full.split("_")[1];                         // join / start / cancel / spin / choiceA / choiceB
  const gameId = full.split("_").slice(2).join("_");

  const state = lifeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت أو ما لقتهاش!", flags: 64 });

  if (second === "join") {
    if (state.phase !== "lobby")              return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= MAX_PLAYERS) return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    state.stats[interaction.user.id]        = { money: START_MONEY, health: START_HEALTH, happiness: START_HAPPINESS };
    state.roundsPlayed[interaction.user.id] = 0;
    return interaction.update({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  }

  if (second === "start") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي بدأها بس يقدر يشغّلها!", flags: 64 });
    if (state.players.length < MIN_PLAYERS)      return interaction.reply({ content: `❌ لازم ${MIN_PLAYERS} لاعبين على الأقل!`, flags: 64 });
    if (state.phase !== "lobby")                 return interaction.reply({ content: "❌ اللعبة بدأت بالفعل!", flags: 64 });
    return startGame(interaction, state);
  }

  if (second === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي بدأها بس يقدر يلغيها!", flags: 64 });
    lifeGames.delete(gameId);
    lifeChannelMap.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🌍 تم إلغاء لعبة الحياة")], components: [] });
  }

  if (second === "spin") {
    if (state.phase !== "playing")  return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    if (state.pendingChoice)        return interaction.reply({ content: "❌ في قرار لازم يُتخذ الأول!", flags: 64 });
    return doSpin(interaction, state);
  }

  if (second === "choiceA" || second === "choiceB") {
    if (!state.pendingChoice) return interaction.reply({ content: "❌ ما في قرار معلّق دلوقتي!", flags: 64 });
    if (!state.players.includes(interaction.user.id))
      return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
    if (interaction.user.id !== state.pendingChoice.playerId)
      return interaction.reply({
        content: `❌ مش قرارك! ده قرار <@${state.pendingChoice.playerId}> — استنّاه يختار!`,
        flags: 64,
      });

    const chosen  = second === "choiceA" ? state.pendingChoice.event.optionA : state.pendingChoice.event.optionB;
    const eventFull = { ...state.pendingChoice.event, ...chosen, text: `${state.pendingChoice.event.text} — اخترت: **${chosen.label}**` };
    applyEvent(state, state.pendingChoice.playerId, chosen);
    return finishTurn(interaction, state, state.pendingChoice.playerId, eventFull);
  }
}
