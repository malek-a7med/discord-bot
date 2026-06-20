// ═══════════════════════════════════════════════════════════════
//  🌍 الحياة — Full Life Simulation (Solo or Multiplayer)
//  عيش حياة كاملة من أول يوم لآخر نفس — كل قرار بيغير حياتك!
// ═══════════════════════════════════════════════════════════════
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";

const WIN_REWARD      = 400;
const START_MONEY     = 5000;
const START_HEALTH    = 100;
const START_HAPPINESS = 50;
const MAX_PLAYERS     = 6;
const ROUNDS_TOTAL    = 12;

export const lifeGames      = new Map();
export const lifeChannelMap = new Map();

const makeId = () => `lif${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

// ── مراحل الحياة ──────────────────────────────────────────────
function getPhase(round) {
  if (round <= 2)  return "childhood";
  if (round <= 5)  return "education";
  if (round <= 8)  return "work";
  if (round <= 10) return "family";
  return "retirement";
}
const PHASE_NAMES = {
  childhood:  "👶 الطفولة",
  education:  "🎓 التعليم",
  work:       "💼 الشغل",
  family:     "👨‍👩‍👧 الأسرة",
  retirement: "🏖️ التقاعد",
};

// ═══════════════════════════════════════════════════════════════
//  🎭 الأحداث — حياة أسطورية كاملة بكل تفاصيلها
// ═══════════════════════════════════════════════════════════════
const EVENTS = {

  // ── 👶 الطفولة ──────────────────────────────────────────────
  childhood: [
    { text: "🍬 أهلك اشتروا ليك لعبة جديدة — فرحت جداً!", money: 0, health: 0, happiness: +20 },
    { text: "🏃 كنت بتلعب في الشارع ووقعت وكسرت ركبتك!", money: -200, health: -15, happiness: -10 },
    { text: "🎒 أول يوم مدرسة — خفت في الأول بس عملت أصدقاء!", money: 0, health: 0, happiness: +15 },
    { text: "🍕 عيد ميلادك — أهلك عملوا ليك حفلة كبيرة!", money: 0, health: 0, happiness: +30 },
    { text: "😢 صاحبك الحلو انتقل لمدينة تانية!", money: 0, health: 0, happiness: -20 },
    { text: "📺 بقيت تتفرج كتير على الكرتون وإهملت المذاكرة!", money: 0, health: -5, happiness: +15 },
    { text: "🐕 أهلك جابوا ليك كلب صغير — أحسن يوم في حياتك!", money: -300, health: +5, happiness: +35 },
    { text: "🏆 فزت في مسابقة الرسم بالمدرسة!", money: 0, health: 0, happiness: +25 },
    { text: "🤒 مرضت بالإنفلونزا وقعدت أسبوع في البيت!", money: -300, health: -15, happiness: -10 },
    { text: "📚 بدأت تقرأ كتب كتير وحبيت القراءة!", money: 0, health: 0, happiness: +10 },
    { text: "🎮 أهلك اشتروا ليك جيم — عشت أسعد أيام!", money: -500, health: -5, happiness: +30 },
    { text: "🏊 التحقت بنادي سباحة وبدأت تتعلم!", money: -400, health: +15, happiness: +20 },
    {
      text: "🧸 بيتوا هايقلوا — هتاخد معاك إيه؟",
      isChoice: true,
      optionA: { label: "🎮 العبك الجيمز", money: 0, health: 0, happiness: +25 },
      optionB: { label: "📚 الكتب والدراسة", money: 0, health: 0, happiness: +10 },
    },
  ],

  // ── 🎓 التعليم ──────────────────────────────────────────────
  education: [
    { text: "📚 ذاكرت طول الليل ونجحت بتميّز!", money: 0, health: -10, happiness: +20 },
    { text: "🏆 فزت في مسابقة علمية وكسبت جايزة!", money: +1000, health: 0, happiness: +25 },
    { text: "❌ رسبت في مادة ودفعت رسوم إعادة!", money: -400, health: 0, happiness: -20 },
    { text: "🏥 مرضت وقعدت أسبوع في البيت!", money: -500, health: -20, happiness: -10 },
    { text: "👥 اتعلمت شغل جانبي وبدأت تكسب!", money: +700, health: 0, happiness: +10 },
    { text: "🎨 اكتشفت موهبة فنية جديدة!", money: 0, health: 0, happiness: +20 },
    { text: "📱 اشتريت موبايل جديد!", money: -1000, health: 0, happiness: +15 },
    { text: "🎮 ضيّعت وقتك في الجيمز ومراجعتش!", money: 0, health: 0, happiness: +10 },
    { text: "🤝 عملت مشروع مع زمايلك وكسبتوا!", money: +800, health: 0, happiness: +20 },
    { text: "🏃 بدأت رياضة يومية وصحتك تحسّنت!", money: -200, health: +20, happiness: +15 },
    { text: "😴 نمت على الامتحان من الإرهاق!", money: 0, health: +10, happiness: -15 },
    { text: "💔 انكسر قلبك لأول مرة في حياتك!", money: 0, health: 0, happiness: -30 },
    { text: "❤️ عشقت حد في الكلية وعلاقتكم حلوة!", money: -300, health: 0, happiness: +40 },
    { text: "🎓 تخرجت بتقدير ممتاز — مبروك!", money: 0, health: 0, happiness: +35 },
    { text: "🚗 حادثة دراجة بسيطة — عاشق مش خايف!", money: -600, health: -10, happiness: -5 },
    { text: "💻 اشتريت لاب توب للدراسة!", money: -1500, health: 0, happiness: +10 },
    { text: "🌍 فرصة سفر مع الجامعة لمؤتمر دولي!", money: -800, health: 0, happiness: +30 },
    {
      text: "🎓 عرض منحة دراسية بالخارج — هتروح؟",
      isChoice: true,
      optionA: { label: "✈️ روح المنحة!", money: +3000, health: -10, happiness: +35 },
      optionB: { label: "🏠 افضل مع أهلك", money: 0, health: +10, happiness: +15 },
    },
    {
      text: "💑 صاحبك عايز تتجوز — إنت مش متخرج بعد!",
      isChoice: true,
      optionA: { label: "💍 اتخطبوا بدري!", money: -1000, health: 0, happiness: +25 },
      optionB: { label: "📚 المذاكرة الأهم", money: 0, health: 0, happiness: +5 },
    },
  ],

  // ── 💼 الشغل ──────────────────────────────────────────────────
  work: [
    { text: "💼 اتعرضت عليك ترقية وقبلتها!", money: +2500, health: -10, happiness: +20 },
    { text: "🔥 يوم بائس في الشغل — مديرك منرفز!", money: +800, health: -10, happiness: -20 },
    { text: "💰 بونص نهاية الشهر جه حلو!", money: +2000, health: 0, happiness: +20 },
    { text: "😴 أخدت إجازة مدفوعة وريّحت روحك!", money: -300, health: +15, happiness: +25 },
    { text: "🔧 الموبايل اتكسر وعملت صيانة غالية!", money: -1200, health: 0, happiness: -10 },
    { text: "🚗 اشتريت عربية أوكازيون!", money: -3000, health: 0, happiness: +25 },
    { text: "😰 ضغط شغل ومش قادر تنام!", money: +1000, health: -20, happiness: -20 },
    { text: "📊 استثمار صغير في سهم كسبت منه!", money: +2000, health: 0, happiness: +15 },
    { text: "🍕 عزمت فريق الشغل على عشا!", money: -700, health: 0, happiness: +20 },
    { text: "🔥 اتفصلت من الشغل فجأة!", money: -1000, health: -5, happiness: -35 },
    { text: "💳 دفعت على دورة تدريبية متخصصة!", money: -1000, health: 0, happiness: +20 },
    { text: "🤑 لقيت شغل بمرتب عالي وانتقلت!", money: +3500, health: -10, happiness: +15 },
    { text: "🏖️ شركتك عملت رحلة للموظفين!", money: 0, health: +10, happiness: +30 },
    { text: "💡 عندك فكرة مشروع — بدأت تخطط!", money: -500, health: 0, happiness: +20 },
    { text: "🏠 قررت تاجر في عقارات صغيرة!", money: -4000, health: 0, happiness: +15 },
    { text: "📱 بدأت تشتغل فريلانس جانبي!", money: +1500, health: -5, happiness: +10 },
    { text: "🎯 وصلت لهدفك واشتريت عربيتك الأحلام!", money: -8000, health: 0, happiness: +40 },
    { text: "🤝 شريك أعمال خانك وسرق من الشركة!", money: -3000, health: -10, happiness: -30 },
    {
      text: "🤝 عرض شراكة في مشروع — هتشارك؟",
      isChoice: true,
      optionA: { label: "💪 اشترك في المشروع!", money: +5000, health: -15, happiness: +15 },
      optionB: { label: "😌 مش وقته", money: 0, health: +10, happiness: +5 },
    },
    {
      text: "🏪 فرصة تفتح محل صغير — هتجازف؟",
      isChoice: true,
      optionA: { label: "🏪 افتح المحل!", money: -5000, health: -10, happiness: +30 },
      optionB: { label: "💼 افضل في وظيفتي", money: +500, health: +5, happiness: +5 },
    },
    {
      text: "💰 فرصة استثمار عالي المخاطرة — هتجازف؟",
      isChoice: true,
      optionA: { label: "💰 جازف واستثمر!", money: +7000, health: -10, happiness: +20 },
      optionB: { label: "🛡️ العب بأمان", money: +1000, health: +5, happiness: +5 },
    },
  ],

  // ── 👨‍👩‍👧 الأسرة ──────────────────────────────────────────────
  family: [
    { text: "💍 اتجوزت وعملت فرح حلو!", money: -4000, health: 0, happiness: +45 },
    { text: "👶 جاك مولود جميل وحياتك اتغيرت!", money: -1500, health: -5, happiness: +50 },
    { text: "🏠 اشتريت شقة وانتقلتوا!", money: -8000, health: 0, happiness: +35 },
    { text: "💔 مشاكل زوجية — محتاج حل!", money: -500, health: -10, happiness: -30 },
    { text: "🎊 فرح قريبك وصرفت على الهدية!", money: -1000, health: 0, happiness: +15 },
    { text: "🩺 حد في العيلة مرض واحتاج مساعدة!", money: -2500, health: -5, happiness: -20 },
    { text: "✈️ سافرتوا في إجازة عيلة رهيبة!", money: -3000, health: +10, happiness: +35 },
    { text: "🤲 ساعدت أسرة محتاجة في الحي!", money: -500, health: 0, happiness: +30 },
    { text: "🏘️ الجار رد عليك القرض القديم!", money: +500, health: 0, happiness: +10 },
    { text: "🎂 عيد ميلاد ابنك — احتفلتوا احتفال كبير!", money: -800, health: 0, happiness: +25 },
    { text: "👩‍🍳 بدأتوا تاكلوا صح في البيت!", money: -500, health: +20, happiness: +20 },
    { text: "👨‍👦 ابنك / بنتك عملت حاجة تفتخر بيها!", money: 0, health: 0, happiness: +40 },
    { text: "🚗 ابنك دهس العربية وخبطها!", money: -2000, health: 0, happiness: -15 },
    { text: "🏫 دفعت مصاريف مدرسة خاصة للأولاد!", money: -2000, health: 0, happiness: +10 },
    { text: "🌙 راحت الكهرباء أسبوع — فضلتوا مع بعض!", money: -300, health: 0, happiness: +15 },
    { text: "🐈 البيت اتملى قطط والأولاد سعيدين!", money: -400, health: 0, happiness: +20 },
    {
      text: "🏠 فرصة شقة بالتقسيط — هتاخدها؟",
      isChoice: true,
      optionA: { label: "🏠 اشتري الشقة!", money: -3000, health: -5, happiness: +30 },
      optionB: { label: "🏘️ افضل بالإيجار", money: -600, health: +5, happiness: +5 },
    },
    {
      text: "🌍 فرصة سفر بالخارج مع العيلة — غالية شوية!",
      isChoice: true,
      optionA: { label: "✈️ يالا نسافر!", money: -5000, health: +5, happiness: +50 },
      optionB: { label: "🏠 نكمل في البلد", money: 0, health: 0, happiness: +10 },
    },
  ],

  // ── 🏖️ التقاعد ─────────────────────────────────────────────
  retirement: [
    { text: "🏖️ تقاعدت وبدأت تستمتع بوقتك!", money: +1000, health: +20, happiness: +35 },
    { text: "🩺 فحص طبي — صحتك كويسة الحمد لله!", money: -500, health: +15, happiness: +15 },
    { text: "✈️ سافرت لبلد كنت دايماً عايز تروحها!", money: -3000, health: +5, happiness: +45 },
    { text: "📖 بدأت تكتب مذكرات حياتك!", money: 0, health: 0, happiness: +25 },
    { text: "👴 حفيدك الأول اتولد — أسعد لحظة!", money: -500, health: 0, happiness: +55 },
    { text: "💊 مصاريف دوا شهرية ثابتة!", money: -700, health: +10, happiness: -5 },
    { text: "🎨 بدأت هواية رسم في التقاعد!", money: -300, health: +5, happiness: +30 },
    { text: "🤲 تبرعت لجمعية خيرية!", money: -1000, health: 0, happiness: +40 },
    { text: "🏡 بنيت جنينة صغيرة في البيت!", money: -500, health: +10, happiness: +30 },
    { text: "🧘 بدأت مديتيشن يومي وريّحت نفسك!", money: 0, health: +15, happiness: +30 },
    { text: "🎸 اشتريت جيتار وبدأت تتعلم عزف!", money: -800, health: 0, happiness: +25 },
    { text: "📱 أولادك اشتروا ليك موبايل جديد!", money: 0, health: 0, happiness: +30 },
    { text: "🏅 حصلت على تكريم من دولتك لسنين عملك!", money: +2000, health: 0, happiness: +45 },
    { text: "💰 حساب التقاعد جاك بالفوايد حلو!", money: +3000, health: 0, happiness: +20 },
  ],
};

function pickEvent(round) {
  const phase = getPhase(round);
  const arr   = EVENTS[phase];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── حساب النقاط ────────────────────────────────────────────────
function calcScore(stats) {
  const h  = Math.max(0, Math.min(100, stats.health));
  const ha = Math.max(0, stats.happiness);
  return Math.round(stats.money + h * 30 + ha * 20);
}

// ── Embeds ─────────────────────────────────────────────────────
function buildLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("🌍 الحياة — ابدأ حياتك الأسطورية!")
    .setDescription(
      `**🎮 طريقة اللعب:**\n` +
      `┣ عيش **${ROUNDS_TOTAL} جولة** من حياة كاملة وواقعية\n` +
      `┣ مراحل: 👶 طفولة → 🎓 تعليم → 💼 شغل → 👨‍👩‍👧 أسرة → 🏖️ تقاعد\n` +
      `┣ قرارات حقيقية تأثّر على **المال 💰 | الصحة ❤️ | السعادة 😊**\n` +
      `┣ النقاط = المال + (الصحة × 30) + (السعادة × 20)\n` +
      `┗ أعلى نقاط يفوز ويكسب **${WIN_REWARD} 🪙**!\n\n` +
      `👥 **اللاعبين (${state.players.length}/${MAX_PLAYERS}):**\n` +
      (state.players.map(id => `• <@${id}>`).join("\n") || "لا أحد بعد") +
      `\n\n✅ **تقدر تلعب لوحدك أو مع أصحابك!**`
    )
    .setFooter({ text: "اضغط ابدأ وعيش حياتك! 🌟" })
    .setTimestamp();
}

function buildLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bnk_start_${gameId}`).setLabel("▶️ ابدأ اللعبة").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bnk_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function progressBar(val, max) {
  const filled = Math.round((Math.max(0, val) / max) * 5);
  return "█".repeat(filled) + "░".repeat(5 - filled) + ` ${Math.max(0, val)}`;
}

function statsBar(stats) {
  const hpBar = progressBar(stats.health, 100);
  const haBar = progressBar(Math.min(100, Math.max(0, stats.happiness)), 100);
  return `💰 ${stats.money.toLocaleString()} جنيه | ❤️ ${hpBar} | 😊 ${haBar}`;
}

function buildGameEmbed(state) {
  const currentId = state.players[state.currentPlayerIndex];
  const round     = (state.roundsPlayed[currentId] ?? 0) + 1;
  const phase     = PHASE_NAMES[getPhase(round)] ?? "🏖️ التقاعد";

  const playerList = state.players.map(id => {
    const s     = state.stats[id];
    const score = calcScore(s);
    const arrow = id === currentId && !state.ended ? "▶️ " : "   ";
    return `${arrow}<@${id}>\n    ${statsBar(s)}\n    🏆 **${score.toLocaleString()} نقطة**`;
  }).join("\n\n");

  const roundText = round <= ROUNDS_TOTAL ? `جولة ${round}/${ROUNDS_TOTAL}` : "النهاية!";
  return new EmbedBuilder()
    .setColor(0x2980b9)
    .setTitle(`🌍 الحياة — ${roundText}`)
    .addFields(
      { name: "📍 المرحلة", value: phase, inline: true },
      { name: "👤 الدور لـ", value: `<@${currentId}>`, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "📊 الإحصائيات", value: playerList },
    )
    .setFooter({ text: "💡 النقاط = مال + صحة×30 + سعادة×20" })
    .setTimestamp();
}

function buildSpinRow(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_spin_${gameId}`).setLabel("🎲 العب دورك").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bnk_cancel_${gameId}`).setLabel("❌ إنهاء").setStyle(ButtonStyle.Danger),
  )];
}

// ── اللعب ─────────────────────────────────────────────────────
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

  if (!state.players.includes(interaction.user.id))
    return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });

  if (interaction.user.id !== currentId)
    return interaction.reply({
      content: `❌ مش دورك! دلوقتي دور <@${currentId}>`,
      flags: 64,
    });

  const round = (state.roundsPlayed[currentId] ?? 0) + 1;
  const event = pickEvent(round);

  if (event.isChoice) {
    state.pendingChoice = { playerId: currentId, event };
    const choiceEmbed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`🤔 قرار مصيري في حياة <@${currentId}>!`)
      .setDescription(`**${event.text}**\n\nهتختار إيه؟`)
      .addFields(
        { name: event.optionA.label, value: applyText(event.optionA), inline: true },
        { name: event.optionB.label, value: applyText(event.optionB), inline: true },
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
  if (opt.money)     parts.push(`💰 ${opt.money > 0 ? "+" : ""}${opt.money.toLocaleString()} جنيه`);
  if (opt.health)    parts.push(`❤️ ${opt.health > 0 ? "+" : ""}${opt.health} صحة`);
  if (opt.happiness) parts.push(`😊 ${opt.happiness > 0 ? "+" : ""}${opt.happiness} سعادة`);
  return parts.join("\n") || "لا تغيير";
}

function applyEvent(state, playerId, changes) {
  const s = state.stats[playerId];
  s.money     = Math.max(0, s.money + (changes.money ?? 0));
  s.health    = Math.max(0, Math.min(100, s.health + (changes.health ?? 0)));
  s.happiness = s.happiness + (changes.happiness ?? 0);
}

function buildChangeText(event) {
  const lines = [];
  if (event.money)     lines.push(`💰 ${event.money > 0 ? "+" : ""}${event.money.toLocaleString()} جنيه`);
  if (event.health)    lines.push(`❤️ ${event.health > 0 ? "+" : ""}${event.health} صحة`);
  if (event.happiness) lines.push(`😊 ${event.happiness > 0 ? "+" : ""}${event.happiness} سعادة`);
  return lines.length ? lines.join(" | ") : "لا تغيير في الأرقام";
}

async function finishTurn(interaction, state, playerId, event) {
  state.roundsPlayed[playerId] = (state.roundsPlayed[playerId] ?? 0) + 1;
  state.pendingChoice = null;

  const changeText = buildChangeText(event);
  const eventColor = (event.money ?? 0) >= 0 ? 0x2ecc71 : 0xe74c3c;
  const s = state.stats[playerId];
  const phase = PHASE_NAMES[getPhase(state.roundsPlayed[playerId])] ?? "🏖️ التقاعد";
  const eventEmbed = new EmbedBuilder()
    .setColor(eventColor)
    .setTitle(`📰 ما حصل لـ <@${playerId}> — ${phase}`)
    .setDescription(`${event.text}\n\n${changeText}`)
    .addFields({ name: "📊 وضعك بعد الحدث", value: statsBar(s) })
    .setTimestamp();

  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  if (state.currentPlayerIndex === 0) state.currentRound++;

  const allDone = state.players.every(id => (state.roundsPlayed[id] ?? 0) >= ROUNDS_TOTAL);
  if (allDone) return endGame(interaction, state, eventEmbed);

  await interaction.update({ embeds: [eventEmbed, buildGameEmbed(state)], components: buildSpinRow(state.id) });
}

async function endGame(interaction, state, lastEventEmbed) {
  state.ended = true;
  lifeGames.delete(state.id);
  lifeChannelMap.delete(state.channelId);

  const sorted = [...state.players].sort((a, b) => calcScore(state.stats[b]) - calcScore(state.stats[a]));
  const winner = sorted[0];
  const medals = ["🥇", "🥈", "🥉"];

  let board;
  if (state.players.length === 1) {
    const s = state.stats[winner];
    board = `🥇 <@${winner}>\n    ${statsBar(s)}\n    🏆 **${calcScore(s).toLocaleString()} نقطة**`;
  } else {
    board = sorted.map((id, i) => {
      const s = state.stats[id];
      return `${medals[i] ?? `${i+1}.`} <@${id}>\n    ${statsBar(s)}\n    🏆 **${calcScore(s).toLocaleString()} نقطة**`;
    }).join("\n\n");
  }

  const soloMsg = state.players.length === 1
    ? `\n\n🎯 نقطتك النهائية: **${calcScore(state.stats[winner]).toLocaleString()}** — عايز تحسّن نفسك؟ العب تاني! 🔄`
    : "";

  const endEmbed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🌍 انتهت رحلة الحياة!")
    .setDescription(`🎉 **الفايز بحياته: <@${winner}>!**\n\n**📊 الترتيب النهائي:**\n\n${board}${soloMsg}`)
    .setFooter({ text: `🌍 الفايز يكسب ${WIN_REWARD} 🪙 | النقاط = مال + صحة×30 + سعادة×20` })
    .setTimestamp();

  await interaction.update({ embeds: [lastEventEmbed, endEmbed], components: [] });

  if (interaction.client?._db) {
    try { interaction.client._db.addCoins(winner, WIN_REWARD); } catch {}
  }
}

// ── Handler الرئيسي للأزرار ────────────────────────────────────
export async function handleBankLifeButton(interaction, db) {
  const full   = interaction.customId;
  const second = full.split("_")[1];
  const gameId = full.split("_").slice(2).join("_");

  const state = lifeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت أو ما لقتهاش!", flags: 64 });

  if (second === "join") {
    if (state.phase !== "lobby")                  return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= MAX_PLAYERS)      return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    state.stats[interaction.user.id]        = { money: START_MONEY, health: START_HEALTH, happiness: START_HAPPINESS };
    state.roundsPlayed[interaction.user.id] = 0;
    return interaction.update({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  }

  if (second === "start") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي بدأها بس يشغّلها!", flags: 64 });
    if (state.phase !== "lobby")                 return interaction.reply({ content: "❌ اللعبة بدأت بالفعل!", flags: 64 });
    return startGame(interaction, state);
  }

  if (second === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي بدأها بس يلغيها!", flags: 64 });
    lifeGames.delete(gameId);
    lifeChannelMap.delete(state.channelId);
    await interaction.message.delete().catch(() => {});
    return interaction.reply({ content: "🌍 تم إنهاء لعبة الحياة!", flags: 64 });
  }

  if (second === "spin") {
    if (state.phase !== "playing")  return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    if (state.pendingChoice)        return interaction.reply({ content: "❌ في قرار مصيري لازم يتخذ الأول!", flags: 64 });
    return doSpin(interaction, state);
  }

  if (second === "choiceA" || second === "choiceB") {
    if (!state.pendingChoice) return interaction.reply({ content: "❌ ما في قرار معلّق دلوقتي!", flags: 64 });
    if (!state.players.includes(interaction.user.id))
      return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
    if (interaction.user.id !== state.pendingChoice.playerId)
      return interaction.reply({
        content: `❌ ده قرار <@${state.pendingChoice.playerId}> — استنّاه!`,
        flags: 64,
      });

    const chosen = second === "choiceA" ? state.pendingChoice.event.optionA : state.pendingChoice.event.optionB;
    const eventFull = { ...state.pendingChoice.event, ...chosen, text: `${state.pendingChoice.event.text} — اخترت: **${chosen.label}**` };
    applyEvent(state, state.pendingChoice.playerId, chosen);
    return finishTurn(interaction, state, state.pendingChoice.playerId, eventFull);
  }
}
