// ═══════════════════════════════════════════════════════════════
//  🏦 بنك وحياة — Bank & Life Game
//  كل لاعب يبدأ بـ 5000 جنيه — 5 جولات — أحداث حياة عشوائية
//  الفايز = أعلى رصيد في الآخر
// ═══════════════════════════════════════════════════════════════
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";

const WIN_REWARD = 300;
const START_BALANCE = 5000;
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const ROUNDS_TOTAL = 5;
const TURN_TIMEOUT = 45_000;

const bankGames = new Map();    // gameId → state
const bankChannelMap = new Map(); // channelId → gameId

const makeId = () => `bnk${Date.now().toString(36)}${Math.random().toString(36).slice(2,4)}`;

// ── أحداث الحياة ───────────────────────────────────────────────
const EVENTS = [
  { text: "💼 اشتغلت ساعات إضافية في شغلك!",          change: +800,   emoji: "💼" },
  { text: "📈 استثماراتك في البورصة ارتفعت!",           change: +1500,  emoji: "📈" },
  { text: "🎰 ربحت في اليانصيب!",                       change: +3000,  emoji: "🎰" },
  { text: "🏠 إيجار شقتك ارتفع هذا الشهر!",            change: -600,   emoji: "🏠" },
  { text: "🚗 عطلت عربيتك وعملت صيانة!",               change: -900,   emoji: "🚗" },
  { text: "🏥 زيارة للدكتور — صحتك أهم من الفلوس!",    change: -1200,  emoji: "🏥" },
  { text: "🎁 أهلك بعتوا لك مصروف!",                   change: +500,   emoji: "🎁" },
  { text: "🍕 عزمت أصحابك وصرفت على الأكل!",           change: -400,   emoji: "🍕" },
  { text: "📱 اشتريت موبايل جديد!",                     change: -1500,  emoji: "📱" },
  { text: "💰 بونص من الشغل في نهاية الشهر!",           change: +2000,  emoji: "💰" },
  { text: "⚡ فاتورة الكهرباء جت غالية!",               change: -700,   emoji: "⚡" },
  { text: "🏆 فزت في مسابقة ثقافية!",                   change: +1000,  emoji: "🏆" },
  { text: "📉 سهم استثمرت فيه وقع!",                    change: -1800,  emoji: "📉" },
  { text: "🍔 مطعمك المفضل عمل ديل للأعضاء!",          change: +300,   emoji: "🍔" },
  { text: "🔥 دفعت فلوس ضرايب!",                        change: -500,   emoji: "🔥" },
  { text: "🎓 اشتركت في كورس هتطور نفسك!",             change: -800,   emoji: "🎓" },
  { text: "💎 لقيت حاجة قيمة وبعتها!",                  change: +2500,  emoji: "💎" },
  { text: "🌧️ المطر خرب حاجة في بيتك!",               change: -1000,  emoji: "🌧️" },
  { text: "😴 يوم إجازة — ما اشتغلتش!",                change: 0,      emoji: "😴" },
  { text: "🤝 صاحبك رد عليك الفلوس اللي كان ديّنك!",   change: +1200,  emoji: "🤝" },
];

function randEvent() {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}

function buildLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("🏦 بنك وحياة — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ كل لاعب يبدأ بـ **${START_BALANCE.toLocaleString()} 💵**\n` +
      `┣ كل دور، الدنيا تبعت لك حدث عشوائي (شغل / استثمار / مصروف...)\n` +
      `┣ **${ROUNDS_TOTAL} جولات** لكل لاعب\n` +
      `┗ اللي عنده أعلى رصيد في الآخر يفوز ويكسب **${WIN_REWARD} 🪙**!\n\n` +
      `👥 **اللاعبين (${state.players.length}/${MAX_PLAYERS}):**\n${state.players.map(id => `• <@${id}>`).join("\n") || "لا أحد"}\n\n` +
      `⚠️ يلزم ${MIN_PLAYERS} لاعبين على الأقل — حد اللاعبين ${MAX_PLAYERS}`
    )
    .setFooter({ text: "انضم وجرّب حظك في الحياة! 🎲" })
    .setTimestamp();
}

function buildLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bnk_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bnk_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function buildGameEmbed(state) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const balances = state.players.map(id => {
    const bal = state.balances[id] ?? START_BALANCE;
    const isCurrent = id === currentPlayer && !state.ended;
    return `${isCurrent ? "▶️" : "•"} <@${id}>: **${bal.toLocaleString()} 💵**`;
  }).join("\n");

  return new EmbedBuilder()
    .setColor(0x2980b9)
    .setTitle(`🏦 بنك وحياة — جولة ${state.currentRound}/${ROUNDS_TOTAL}`)
    .setDescription(
      `**💰 الأرصدة الحالية:**\n${balances}\n\n` +
      (state.ended ? "" : `⏳ دور <@${currentPlayer}> — اضغط "🎲 العب دورك"!`)
    )
    .setTimestamp();
}

function buildTurnRow(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bnk_spin_${gameId}`).setLabel("🎲 العب دورك").setStyle(ButtonStyle.Primary),
  )];
}

export async function handleBankLifeCommand(interaction) {
  const channelId = interaction.channel.id;
  if (bankChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة بنك وحياة شغالة هنا — خلصوها الأول!", flags: 64 });

  const gameId = makeId();
  const state = {
    id: gameId, channelId,
    creatorId: interaction.user.id,
    players: [interaction.user.id],
    balances: { [interaction.user.id]: START_BALANCE },
    phase: "lobby",
    currentPlayerIndex: 0,
    roundsPlayed: {},
    currentRound: 1,
    ended: false,
    turnTimer: null,
  };
  bankGames.set(gameId, state);
  bankChannelMap.set(channelId, gameId);

  await interaction.reply({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
}

async function startGame(interaction, state) {
  const gameId = state.id;
  state.phase = "playing";
  state.currentPlayerIndex = 0;
  for (const id of state.players) state.roundsPlayed[id] = 0;

  const gameEmbed = buildGameEmbed(state);
  await interaction.update({ embeds: [gameEmbed], components: buildTurnRow(gameId) });
}

async function doSpin(interaction, state) {
  const gameId = state.id;
  const currentId = state.players[state.currentPlayerIndex];
  if (interaction.user.id !== currentId)
    return interaction.reply({ content: "❌ مش دورك دلوقتي!", flags: 64 });

  const event = randEvent();
  state.balances[currentId] = Math.max(0, (state.balances[currentId] ?? START_BALANCE) + event.change);
  state.roundsPlayed[currentId] = (state.roundsPlayed[currentId] || 0) + 1;

  const changeText = event.change > 0 ? `+${event.change.toLocaleString()}` : event.change === 0 ? "±0" : event.change.toLocaleString();
  const changeColor = event.change > 0 ? 0x2ecc71 : event.change < 0 ? 0xe74c3c : 0x95a5a6;

  const eventEmbed = new EmbedBuilder()
    .setColor(changeColor)
    .setTitle(`${event.emoji} حدث لـ <@${currentId}>`)
    .setDescription(`${event.text}\n\n💵 التغيير: **${changeText} جنيه**\n💰 الرصيد الجديد: **${state.balances[currentId].toLocaleString()} جنيه**`)
    .setTimestamp();

  // انتقل للاعب التالي أو انهِ اللعبة
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  // لو رجعنا للأول، معناها دارت جولة كاملة
  if (state.currentPlayerIndex === 0) state.currentRound++;

  const allDone = state.players.every(id => (state.roundsPlayed[id] || 0) >= ROUNDS_TOTAL);

  if (allDone) {
    return endGame(interaction, state, eventEmbed);
  }

  const gameEmbed = buildGameEmbed(state);
  await interaction.update({
    embeds: [eventEmbed, gameEmbed],
    components: buildTurnRow(gameId),
  });
}

async function endGame(interaction, state, lastEventEmbed) {
  state.ended = true;
  bankGames.delete(state.id);
  bankChannelMap.delete(state.channelId);

  const sorted = [...state.players].sort((a, b) => (state.balances[b] ?? 0) - (state.balances[a] ?? 0));
  const winner = sorted[0];

  const leaderboard = sorted.map((id, i) => {
    const medals = ["🥇", "🥈", "🥉"];
    const medal = medals[i] ?? `${i + 1}.`;
    return `${medal} <@${id}> — **${(state.balances[id] ?? 0).toLocaleString()} 💵**`;
  }).join("\n");

  const endEmbed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🏆 انتهت لعبة بنك وحياة!")
    .setDescription(
      `🎉 **الفايز: <@${winner}>!**\n\n` +
      `**📊 الترتيب النهائي:**\n${leaderboard}\n\n` +
      `💵 الرصيد الابتدائي كان: **${START_BALANCE.toLocaleString()} جنيه** للجميع`
    )
    .setFooter({ text: `🏦 بنك وحياة — انتهت اللعبة | الفايز بياخد ${WIN_REWARD} 🪙` })
    .setTimestamp();

  await interaction.update({ embeds: [lastEventEmbed, endEmbed], components: [] });

  // منح الكوينز للفايز
  if (interaction.client?._db) {
    try {
      interaction.client._db.addCoins(winner, WIN_REWARD);
    } catch {}
  }
}

export async function handleBankLifeButton(interaction, db) {
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const gameId = parts.slice(2).join("_");

  const state = bankGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت أو ما عدتش لاقيها!", flags: 64 });

  if (action === "join") {
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= MAX_PLAYERS) return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    state.balances[interaction.user.id] = START_BALANCE;
    return interaction.update({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  }

  if (action === "start") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي بدأها بس يقدر يشغّلها!", flags: 64 });
    if (state.players.length < MIN_PLAYERS) return interaction.reply({ content: `❌ لازم ${MIN_PLAYERS} لاعبين على الأقل!`, flags: 64 });
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت بالفعل!", flags: 64 });
    return startGame(interaction, state);
  }

  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي بدأها بس يقدر يلغيها!", flags: 64 });
    bankGames.delete(gameId);
    bankChannelMap.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🏦 تم إلغاء لعبة بنك وحياة")], components: [] });
  }

  if (action === "spin") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    return doSpin(interaction, state, db);
  }
}
