// ═══════════════════════════════════════════════════════════════
//  🌍 رحلة الحياة — Speed Life Decisions
//  كل اللاعبين يختاروا في نفس الوقت — اللعبة بتمشي تلقائياً
//  مفيش جولات ولا دور — كل حدث ينكشف بعد 20 ثانية للكل
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const WIN_COINS     = 400;
const MAX_PLAYERS   = 8;
const CHOOSE_SECS   = 20;
const REVEAL_SECS   = 6;
const SCENARIOS_COUNT = 8;

export const lifeGames      = new Map();
export const lifeChannelMap = new Map();

const makeId  = () => `lif${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
const shuffle = a => [...a].sort(() => Math.random() - 0.5);

// ══════════════════════════════════════════════════════════════
//  📋 السيناريوهات — 12 موقف حياة واقعي
//  كل موقف = 3 خيارات: جريء / متوازن / آمن
// ══════════════════════════════════════════════════════════════
const ALL_SCENARIOS = [
  {
    emoji: "💼",
    situation: "عرضوا عليك وظيفة بمرتب أعلى بكتير — لكن ضغط أكتر وبلد تاني!",
    choices: [
      { label: "🚀 اقبلها وسافر!", points: 22, money: +4000, fate: "بدأت من الأول وبنيت حياة جديدة رائعة ✨" },
      { label: "⚖️ تفاوض وخد زيادة هنا", points: 15, money: +1500, fate: "حصلت على زيادة معقولة وفضلت مع أهلك" },
      { label: "😌 مش هسيب حياتي هنا", points: 5, money: +300, fate: "فضلت مريح لكن الفرصة راحت للأبد" },
    ]
  },
  {
    emoji: "📈",
    situation: "صاحبك عنده فرصة استثمار بتقول عليها — ممكن تكسب كتير أو تخسر كل حاجة!",
    choices: [
      { label: "💰 استثمر كل مدخراتك!", points: 25, money: +8000, fate: "الاستثمار طار وكسبت ثروة 🏆", failRate: 35, failPoints: -5, failMoney: -4000, failFate: "الاستثمار فشل وخسرت المدخرات 💸" },
      { label: "🔢 استثمر نصهم بس", points: 18, money: +3000, fate: "كسبت كويس وفضل عندك احتياط" },
      { label: "🛡️ ما هستثمرش", points: 8, money: 0, fate: "فضلت آمن بس الفرصة مشت" },
    ]
  },
  {
    emoji: "🏠",
    situation: "لقيت شقة بموقع ممتاز — لكن قسطها هياخد 60% من مرتبك!",
    choices: [
      { label: "🔑 اشتري الشقة دلوقتي!", points: 20, money: -3000, fate: "الشقة ارتفعت في السعر وكانت أحسن قرار 🏡" },
      { label: "🏘️ دور على أرخص", points: 15, money: -1000, fate: "لقيت شقة أصغر لكن ملكك وعيشت فيها" },
      { label: "🚶 افضل بالإيجار", points: 5, money: -600, fate: "فضلت حر لكن مش بانيت حاجة" },
    ]
  },
  {
    emoji: "🎓",
    situation: "وصلتلك فرصة ماجستير في الخارج — هتعطّل شغلك 2 سنة كاملة!",
    choices: [
      { label: "✈️ روح واتعلم!", points: 23, money: -2000, fate: "شهادة علمية وفرص ذهبية بعدها 🎓" },
      { label: "📱 تعليم أون لاين جانبي", points: 16, money: -500, fate: "تعلمت وشغلك مستمر — توازن ممتاز" },
      { label: "💼 مش وقته دلوقتي", points: 5, money: +500, fate: "شغلت بس الفرصة فاتت ومش بترجع" },
    ]
  },
  {
    emoji: "🤝",
    situation: "صاحبك من أيام الطفولة محتاج قرض كبير — مش عارف هيرجعهولك امتى!",
    choices: [
      { label: "💛 ساعده بدون شروط!", points: 25, money: -2000, fate: "رجعلك ضعف المبلغ وفضل صاحبك للأبد 🙌" },
      { label: "📝 سلفه بشروط واضحة", points: 14, money: -1500, fate: "رجع المبلغ بالكاد والعلاقة اتأثرت شوية" },
      { label: "😔 معندكش للأسف", points: -5, money: 0, fate: "خسرت صداقة 20 سنة في ثانية واحدة 💔" },
    ]
  },
  {
    emoji: "🎯",
    situation: "حلمك من زمان تفتح مشروعك الخاص — الوقت مناسب دلوقتي!",
    choices: [
      { label: "🚀 ابدأ دلوقتي وجازف!", points: 25, money: -5000, fate: "مشروعك نجح وبقيت صاحب شركة 🏆", failRate: 25, failPoints: 15, failMoney: -3000, failFate: "المشروع وقف لكن اتعلمت وبدأت تاني 💪" },
      { label: "📋 خطط سنة الأول", points: 16, money: -800, fate: "بدأت بخطة صلبة والمشروع اتأسس صح" },
      { label: "💭 لسه مش مستعد", points: 0, money: 0, fate: "فضل حلم في دماغك من غير تنفيذ 😢" },
    ]
  },
  {
    emoji: "❤️",
    situation: "واحد/ة بتحبه/ها من زمان — لو ما حكيتلهوش النهارده هتخسر/يه للأبد!",
    choices: [
      { label: "💑 بادر وقول مشاعرك!", points: 22, money: 0, fate: "علاقة جميلة بدأت وحياتك اتغيرت ✨" },
      { label: "🤝 ابدأ بالصداقة الأول", points: 14, money: 0, fate: "صداقة عميقة — الحكاية لسه مكملاش" },
      { label: "😶 صمّت وهربت!", points: -8, money: 0, fate: "ندمت سنين على اللحظة دي 💔" },
    ]
  },
  {
    emoji: "🏥",
    situation: "صحتك بدأت توعك من الضغط الشديد — الدكتور قالك لازم ترتاح!",
    choices: [
      { label: "🌴 خد إجازة وريّح نفسك!", points: 22, money: -400, fate: "رجعت بطاقة كاملة وإنتاجية أعلى 💪" },
      { label: "🥗 رياضة وأكل صح", points: 18, money: -200, fate: "صحتك تحسنت تدريجياً وبقيت نشيط" },
      { label: "💊 خد دوا وكمّل!", points: -10, money: -600, fate: "الوضع اتأزم وأجبرت على راحة طويلة 😰" },
    ]
  },
  {
    emoji: "👨‍👩‍👧",
    situation: "الأسرة عايزة تقضي وقت مع بعض — إنت غارق في الشغل!",
    choices: [
      { label: "❤️ الأسرة أولاً!", points: 25, money: -300, fate: "ذكريات لا تُنسى وعلاقات أمتن للأبد 💛" },
      { label: "⚖️ وازن بين الشغل والأسرة", points: 14, money: 0, fate: "نجحت في الاثنين بصعوبة — راضي" },
      { label: "💼 الشغل ضروري دلوقتي", points: -8, money: +1200, fate: "كسبت فلوس وخسرت وقت مش هيرجع 😔" },
    ]
  },
  {
    emoji: "🌍",
    situation: "فرصة رحلة حول العالم — 6 أشهر كاملة! بس هتسيب شغلك مؤقتاً",
    choices: [
      { label: "🗺️ روح واكتشف العالم!", points: 22, money: -3000, fate: "تجربة غيّرت حياتك كلها وفتحت أفاق جديدة 🌟" },
      { label: "📸 اطلع في إجازة صغيرة بس", points: 14, money: -800, fate: "استمتعت شوية وفضلت شغلك" },
      { label: "🏠 الاستقرار أهم عندي", points: 8, money: +400, fate: "فضلت في أمانك — قرار مريح" },
    ]
  },
  {
    emoji: "🎪",
    situation: "ربحت في سحب على سيارة فاخرة — تاخدها ولا تبيعها وتاخد فلوسها؟",
    choices: [
      { label: "🚗 خد العربية!", points: 18, money: +500, fate: "استمتعت بأفضل سيارة في حياتك 🚀" },
      { label: "💰 بيعها واستثمر", points: 20, money: +15000, fate: "استثمرت الفلوس في حاجة أهم 📈" },
      { label: "🎁 هدّيها لأهلك!", points: 25, money: 0, fate: "أسعدت أهلك والكون عوّضك بحاجة أحسن 💛" },
    ]
  },
  {
    emoji: "🏆",
    situation: "دعوك لمسابقة محترفة بجايزة كبيرة — بس هتتنافس مع ناس أذكى منك!",
    choices: [
      { label: "🥊 اشترك وحارب!", points: 22, money: +3000, fate: "جاهدت وفزت بالجايزة 🏆", failRate: 30, failPoints: 14, failMoney: 0, failFate: "ما كسبتش لكن الخبرة كانت تمنها 💪" },
      { label: "📣 شارك ودعم غيرك", points: 12, money: +200, fate: "ما كسبتش بس كسبت ناس محترمة" },
      { label: "😴 مش مستعد أصلاً", points: -5, money: 0, fate: "فوّتك فرصة كانت ممكن تغيّر حياتك" },
    ]
  },
];

// ══════════════════════════════════════════════════════════════
//  🔧 helpers
// ══════════════════════════════════════════════════════════════
function pickScenarios() {
  return shuffle(ALL_SCENARIOS).slice(0, SCENARIOS_COUNT);
}

function medalFor(i) { return ["🥇","🥈","🥉"][i] ?? `${i+1}.`; }

function moneyStr(n) {
  return (n >= 0 ? "+" : "") + n.toLocaleString("ar-EG") + " 💰";
}

// ══════════════════════════════════════════════════════════════
//  🖼️  Embeds
// ══════════════════════════════════════════════════════════════
function lobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("🌍 رحلة الحياة — اختارات تحدد مصيرك!")
    .setDescription(
      `**⚡ طريقة اللعب الجديدة:**\n` +
      `┣ **${SCENARIOS_COUNT} موقف حياة** بتظهر للكل في نفس الوقت\n` +
      `┣ عندكم **${CHOOSE_SECS} ثانية** كل موقف تختاروا من 3 خيارات\n` +
      `┣ بعد الوقت — اختيارات الكل بتنكشف مع النتايج دفعة واحدة!\n` +
      `┣ **اللعبة بتمشي تلقائياً** — مفيش "العب دورك" خالص! 🚀\n` +
      `┗ أعلى نقاط في النهاية يفوز بـ **${WIN_COINS} 🪙**!\n\n` +
      `👥 **اللاعبين (${state.players.length}/${MAX_PLAYERS}):**\n` +
      (state.players.map(id => `• <@${id}>`).join("\n") || "*لا أحد بعد*") +
      `\n\n✅ **تلعب لوحدك أو مع أصحابك — اللعبة تمشي بنفسها!**`
    )
    .setFooter({ text: "اضغط ابدأ وعيش اختاراتك! ⚡" })
    .setTimestamp();
}

function lobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bnk_start_${gameId}`).setLabel("▶️ ابدأ اللعبة").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bnk_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function scenarioEmbed(state) {
  const sc = state.scenarios[state.scenarioIndex];
  const chosen = Object.keys(state.currentChoices).length;
  const total  = state.players.length;
  const secsLeft = Math.max(0, Math.ceil((state.timerEnd - Date.now()) / 1000));

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`${sc.emoji} موقف ${state.scenarioIndex + 1}/${SCENARIOS_COUNT}`)
    .setDescription(`## ${sc.situation}\n\n`)
    .addFields(
      { name: "🅰️ الخيار الأول",  value: `**${sc.choices[0].label}**`, inline: true },
      { name: "🅱️ الخيار الثاني", value: `**${sc.choices[1].label}**`, inline: true },
      { name: "🆚 الخيار الثالث", value: `**${sc.choices[2].label}**`, inline: true },
    )
    .setFooter({ text: `⏱️ ${secsLeft} ثانية | ✅ ${chosen}/${total} اختاروا — اللعبة بتمشي تلقائياً` })
    .setTimestamp();
}

function choiceRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_c0_${gameId}`).setLabel("🅰️ الخيار الأول").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bnk_c1_${gameId}`).setLabel("🅱️ الخيار الثاني").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bnk_c2_${gameId}`).setLabel("🆚 الخيار الثالث").setStyle(ButtonStyle.Secondary),
  )];
}

function revealEmbed(state, sc, results) {
  const lines = results.map(r => {
    const choice = sc.choices[r.choiceIdx];
    const pts  = r.points > 0 ? `+${r.points}` : `${r.points}`;
    const cash = moneyStr(r.money);
    return `<@${r.userId}> — **${choice.label}**\n↳ ${r.fate}\n↳ ${pts} نقطة | ${cash}`;
  });

  const noChoose = state.players.filter(id => !state.currentChoices.hasOwnProperty(id));
  if (noChoose.length) lines.push(`\n⏰ ما اختارش: ${noChoose.map(id => `<@${id}>`).join(" | ")}`);

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`${sc.emoji} النتايج — موقف ${state.scenarioIndex + 1}/${SCENARIOS_COUNT}`)
    .setDescription(`**${sc.situation}**\n\n${lines.join("\n\n")}`)
    .setFooter({ text: `🔜 الموقف الجاي بعد ${REVEAL_SECS} ثواني...` })
    .setTimestamp();
}

function scoreboardEmbed(state) {
  const sorted = [...state.players]
    .map(id => ({ id, ...state.scores[id] }))
    .sort((a, b) => b.points - a.points);

  const rows = sorted.map((p, i) =>
    `${medalFor(i)} <@${p.id}> — **${p.points} نقطة** | 💰 ${p.money.toLocaleString()} جنيه`
  ).join("\n");

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🏆 انتهت رحلة الحياة! النتايج النهائية")
    .setDescription(`🎉 **الفايز: <@${sorted[0].id}>!** عاش حياة مليانة قرارات صح!\n\n**📊 الترتيب:**\n${rows}`)
    .setFooter({ text: `الفايز بياخد ${WIN_COINS} 🪙 — شكراً للكل على اللعب!` })
    .setTimestamp();
}

// ══════════════════════════════════════════════════════════════
//  🎮 Game Logic
// ══════════════════════════════════════════════════════════════
async function fetchMsg(client, channelId, msgId) {
  try {
    const ch  = await client.channels.fetch(channelId);
    return await ch.messages.fetch(msgId);
  } catch { return null; }
}

async function launchScenario(client, state) {
  if (!lifeGames.has(state.id)) return;
  state.currentChoices = {};
  state.phase = "scenario";
  state.timerEnd = Date.now() + CHOOSE_SECS * 1000;

  const msg = await fetchMsg(client, state.channelId, state.messageId);
  if (msg) {
    await msg.edit({ embeds: [scenarioEmbed(state)], components: choiceRows(state.id) }).catch(() => {});
  }

  // Update embed halfway through to refresh timer display
  const halfTimer = setTimeout(async () => {
    if (!lifeGames.has(state.id) || state.phase !== "scenario") return;
    const m = await fetchMsg(client, state.channelId, state.messageId);
    if (m) await m.edit({ embeds: [scenarioEmbed(state)], components: choiceRows(state.id) }).catch(() => {});
  }, (CHOOSE_SECS / 2) * 1000);

  state.choiceTimer = setTimeout(async () => {
    clearTimeout(halfTimer);
    if (!lifeGames.has(state.id)) return;
    await revealResults(client, state);
  }, CHOOSE_SECS * 1000);
}

async function revealResults(client, state) {
  if (!lifeGames.has(state.id)) return;
  if (state.timer) clearTimeout(state.timer);
  state.phase = "reveal";

  const sc = state.scenarios[state.scenarioIndex];
  const results = [];

  for (const [userId, choiceIdx] of Object.entries(state.currentChoices)) {
    const choice = sc.choices[choiceIdx];
    let pts   = choice.points;
    let money = choice.money ?? 0;
    let fate  = choice.fate;

    // Random fail for risky choices
    if (choice.failRate && Math.random() * 100 < choice.failRate) {
      pts   = choice.failPoints ?? 0;
      money = choice.failMoney  ?? 0;
      fate  = choice.failFate   ?? choice.fate;
    }

    state.scores[userId].points += pts;
    state.scores[userId].money  += money;
    results.push({ userId, choiceIdx, points: pts, money, fate });
  }

  const msg = await fetchMsg(client, state.channelId, state.messageId);
  if (msg) {
    await msg.edit({ embeds: [revealEmbed(state, sc, results)], components: [] }).catch(() => {});
  }

  state.scenarioIndex++;

  setTimeout(async () => {
    if (!lifeGames.has(state.id)) return;
    if (state.scenarioIndex < SCENARIOS_COUNT) {
      await launchScenario(client, state);
    } else {
      await endGame(client, state);
    }
  }, REVEAL_SECS * 1000);
}

async function endGame(client, state) {
  if (!lifeGames.has(state.id)) return;
  lifeGames.delete(state.id);
  lifeChannelMap.delete(state.channelId);

  const sorted = [...state.players]
    .map(id => ({ id, ...state.scores[id] }))
    .sort((a, b) => b.points - a.points);

  const winner = sorted[0].id;

  const msg = await fetchMsg(client, state.channelId, state.messageId);
  if (msg) {
    await msg.edit({ embeds: [scoreboardEmbed(state)], components: [] }).catch(() => {});
  }

  if (client._db) {
    try { client._db.addCoins(winner, WIN_COINS); } catch {}
  }
}

// ══════════════════════════════════════════════════════════════
//  📨 Command Entry Point
// ══════════════════════════════════════════════════════════════
export async function handleBankLifeCommand(interaction) {
  const channelId = interaction.channel.id;
  if (lifeChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة هنا — خلصوها الأول!", flags: 64 });

  const gameId = makeId();
  const state  = {
    id: gameId, channelId,
    creatorId: interaction.user.id,
    players:   [interaction.user.id],
    scores:    { [interaction.user.id]: { points: 0, money: 0 } },
    scenarios: pickScenarios(),
    scenarioIndex: 0,
    phase: "lobby",
    currentChoices: {},
    messageId: null,
    choiceTimer: null,
    timerEnd: null,
  };

  lifeGames.set(gameId, state);
  lifeChannelMap.set(channelId, gameId);

  const msg = await interaction.reply({
    embeds: [lobbyEmbed(state)],
    components: lobbyRows(gameId),
    fetchReply: true,
  });
  state.messageId = msg.id;
}

// ══════════════════════════════════════════════════════════════
//  🖱️ Button Handler
// ══════════════════════════════════════════════════════════════
export async function handleBankLifeButton(interaction, db) {
  const parts  = interaction.customId.split("_");
  const action = parts[1];
  const gameId = parts.slice(2).join("_");

  const state = lifeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  // ── انضم ────────────────────────────────────────────────────
  if (action === "join") {
    if (state.phase !== "lobby")
      return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id))
      return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= MAX_PLAYERS)
      return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });

    state.players.push(interaction.user.id);
    state.scores[interaction.user.id] = { points: 0, money: 0 };
    return interaction.update({ embeds: [lobbyEmbed(state)], components: lobbyRows(gameId) });
  }

  // ── ابدأ ─────────────────────────────────────────────────────
  if (action === "start") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ اللي بدأها بس يقدر يشغّلها!", flags: 64 });
    if (state.phase !== "lobby")
      return interaction.reply({ content: "❌ اللعبة بدأت بالفعل!", flags: 64 });

    state.phase = "starting";
    await interaction.update({ embeds: [
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🚀 رحلة الحياة بدأت!")
        .setDescription("استعدوا! أول موقف هيظهر دلوقتي...\n\n⚡ كل موقف عندكم **20 ثانية** تختاروا!")
        .setTimestamp()
    ], components: [] });

    setTimeout(() => launchScenario(interaction.client, state), 2000);
    return;
  }

  // ── إلغاء ────────────────────────────────────────────────────
  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ اللي بدأها بس يلغيها!", flags: 64 });
    if (state.choiceTimer) clearTimeout(state.choiceTimer);
    lifeGames.delete(gameId);
    lifeChannelMap.delete(state.channelId);
    await interaction.message.delete().catch(() => {});
    return interaction.reply({ content: "🌍 تم إنهاء لعبة الحياة!", flags: 64 });
  }

  // ── اختيار (c0 / c1 / c2) ────────────────────────────────────
  if (action === "c0" || action === "c1" || action === "c2") {
    if (state.phase !== "scenario")
      return interaction.reply({ content: "❌ مش وقت الاختيار دلوقتي!", flags: 64 });
    if (!state.players.includes(interaction.user.id))
      return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
    if (state.currentChoices.hasOwnProperty(interaction.user.id))
      return interaction.reply({ content: "✅ إنت بالفعل اخترت — استنّى النتايج!", flags: 64 });

    const choiceIdx = parseInt(action[1]);
    const sc = state.scenarios[state.scenarioIndex];
    state.currentChoices[interaction.user.id] = choiceIdx;

    await interaction.reply({
      content: `✅ **اتسجّل اختيارك:** ${sc.choices[choiceIdx].label}\n🤫 مش هيظهر لغيرك — استنّى النتايج!`,
      flags: 64,
    });

    // كل اللاعبين اختاروا → قدّم الكشف فوراً
    if (Object.keys(state.currentChoices).length >= state.players.length) {
      clearTimeout(state.choiceTimer);
      // Update embed to show all chose
      const msg = await fetchMsg(interaction.client, state.channelId, state.messageId);
      if (msg) {
        await msg.edit({ embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ الكل اختار — بتنكشف النتايج!")
            .setDescription(`**${sc.emoji} ${sc.situation}**\n\n⚡ النتايج جاية...`)
            .setTimestamp()
        ], components: [] }).catch(() => {});
      }
      setTimeout(() => revealResults(interaction.client, state), 1500);
    } else {
      // Update embed to show new count
      const msg = await fetchMsg(interaction.client, state.channelId, state.messageId);
      if (msg) {
        await msg.edit({ embeds: [scenarioEmbed(state)], components: choiceRows(state.id) }).catch(() => {});
      }
    }
    return;
  }
}
