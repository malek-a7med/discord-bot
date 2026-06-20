// ═══════════════════════════════════════════════════════════════
//  🎰 بنك الحظ — Lucky Bank Game
//  كل لاعب يبدأ بـ 1000 جنيه — عجلة الحظ تحدد مصيرك!
//  6 جولات — أكتر رصيد في الآخر يفوز ويكسب كوينز
// ═══════════════════════════════════════════════════════════════
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";

const WIN_REWARD  = 350;
const START_MONEY = 1000;
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const ROUNDS_EACH = 6;

export const luckGames      = new Map(); // gameId → state
export const luckChannelMap = new Map(); // channelId → gameId

const makeId = () => `blk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

// ── شرايح عجلة الحظ ──────────────────────────────────────────
const WHEEL = [
  { label: "💰 +200",         emoji: "💰", change: +200,  type: "win",      weight: 18 },
  { label: "💵 +500",         emoji: "💵", change: +500,  type: "win",      weight: 15 },
  { label: "🤑 +1,000",       emoji: "🤑", change: +1000, type: "win",      weight: 10 },
  { label: "😎 +1,500",       emoji: "😎", change: +1500, type: "win",      weight: 6  },
  { label: "💎 +2,000",       emoji: "💎", change: +2000, type: "win",      weight: 4  },
  { label: "🎰 جاكبوت +5,000", emoji: "🎰", change: +5000, type: "jackpot",  weight: 2  },
  { label: "📉 -200",         emoji: "📉", change: -200,  type: "lose",     weight: 14 },
  { label: "💸 -500",         emoji: "💸", change: -500,  type: "lose",     weight: 10 },
  { label: "😱 -1,000",       emoji: "😱", change: -1000, type: "lose",     weight: 6  },
  { label: "🔄 ×2 رصيدك",     emoji: "🔄", change: 0,     type: "double",   weight: 5  },
  { label: "💀 إفلاس!",       emoji: "💀", change: 0,     type: "bankrupt", weight: 3  },
  { label: "🤝 سرقة +800",    emoji: "🤝", change: +800,  type: "steal",    weight: 7  },
];

// بناء قائمة العجلة بالأوزان
const WHEEL_POOL = [];
for (const seg of WHEEL) {
  for (let i = 0; i < seg.weight; i++) WHEEL_POOL.push(seg);
}

function spinWheel() {
  return WHEEL_POOL[Math.floor(Math.random() * WHEEL_POOL.length)];
}

function applySegment(state, playerId, seg) {
  const bal = state.balances[playerId] ?? START_MONEY;
  if (seg.type === "double")   { state.balances[playerId] = bal * 2; return; }
  if (seg.type === "bankrupt") { state.balances[playerId] = 0;       return; }
  if (seg.type === "steal") {
    // اسرق من أغنى لاعب (غير اللاعب الحالي)
    const richest = state.players
      .filter(id => id !== playerId)
      .sort((a, b) => (state.balances[b] ?? 0) - (state.balances[a] ?? 0))[0];
    if (richest) {
      const stolen = Math.min(800, state.balances[richest] ?? 0);
      state.balances[richest]  = Math.max(0, (state.balances[richest] ?? 0) - stolen);
      state.balances[playerId] = Math.max(0, bal + stolen);
    } else {
      state.balances[playerId] = Math.max(0, bal + seg.change);
    }
    return;
  }
  state.balances[playerId] = Math.max(0, bal + seg.change);
}

function getResultDesc(state, playerId, seg, before) {
  const after = state.balances[playerId];
  const diff  = after - before;
  if (seg.type === "double")   return `🔄 رصيدك اتضاعف! ${before.toLocaleString()} → **${after.toLocaleString()}** جنيه`;
  if (seg.type === "bankrupt") return `💀 إفلاس! خسرت كل رصيدك (${before.toLocaleString()} جنيه)!`;
  if (seg.type === "steal")    return `🤝 سرقت من أغنى لاعب! +${Math.abs(diff).toLocaleString()} جنيه`;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toLocaleString()} جنيه | رصيدك الجديد: **${after.toLocaleString()}** جنيه`;
}

// ── Wheel Display ─────────────────────────────────────────────
function buildWheelDisplay(landed = null) {
  const segs = [
    "💰 +200", "💵 +500", "🤑 +1,000", "📉 -200",
    "🎰 جاكبوت", "💀 إفلاس", "💵 +500", "🔄 ×2",
    "😎 +1,500", "💸 -500", "💎 +2,000", "🤝 سرقة",
  ];
  return segs.map(s => (landed && s.includes(landed.substring(0, 4))) ? `**[${s}]**` : s).join(" ┃ ");
}

// ── Embeds ────────────────────────────────────────────────────
function buildLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🎰 بنك الحظ — انتظار اللاعبين")
    .setDescription(
      `**🎮 طريقة اللعب:**\n` +
      `┣ كل لاعب يبدأ بـ **${START_MONEY.toLocaleString()} 💵**\n` +
      `┣ **${ROUNDS_EACH} جولات** لكل لاعب\n` +
      `┣ كل جولة: اضغط 🎰 لتدوير عجلة الحظ!\n` +
      `┣ شرايح العجلة: +200 | +500 | +1000 | +1500 | +2000 | جاكبوت +5000 | -200 | -500 | -1000 | ×2 | إفلاس | سرقة\n` +
      `┗ أعلى رصيد في الآخر يفوز ويكسب **${WIN_REWARD} 🪙**!\n\n` +
      `👥 **اللاعبين (${state.players.length}/${MAX_PLAYERS}):**\n` +
      (state.players.map(id => `• <@${id}>`).join("\n") || "لا أحد بعد") +
      `\n\n⚠️ لازم ${MIN_PLAYERS} على الأقل`
    )
    .setFooter({ text: "🍀 الحظ مع مين؟ انضم وشوف!" })
    .setTimestamp();
}

function buildLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`blk_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`blk_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`blk_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function buildGameEmbed(state) {
  const currentId = state.players[state.currentPlayerIndex];
  const board     = state.players.map(id => {
    const done = state.roundsPlayed[id] ?? 0;
    const cur  = id === currentId && !state.ended ? "▶️ " : "   ";
    return `${cur}<@${id}> — **${(state.balances[id] ?? START_MONEY).toLocaleString()} 💵** (جولة ${done}/${ROUNDS_EACH})`;
  }).join("\n");

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`🎰 بنك الحظ — جولة ${state.currentRound}/${ROUNDS_EACH}`)
    .addFields(
      { name: "👤 دور", value: `<@${currentId}>`, inline: true },
      { name: "🎰 العجلة", value: "💰┃💵┃🤑┃📉┃🎰┃💀┃🔄┃😎┃💸┃💎┃🤝", inline: false },
      { name: "💰 الأرصدة", value: board },
    )
    .setTimestamp();
}

function buildSpinRow(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`blk_spin_${gameId}`).setLabel("🎰 دوّر العجلة").setStyle(ButtonStyle.Success),
  )];
}

// ── Game Logic ────────────────────────────────────────────────
export async function handleBankLuckCommand(interaction) {
  const channelId = interaction.channel.id;
  if (luckChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة بنك الحظ شغالة هنا — خلصوها الأول!", flags: 64 });

  const gameId = makeId();
  const state  = {
    id: gameId, channelId,
    creatorId: interaction.user.id,
    players:   [interaction.user.id],
    balances:  { [interaction.user.id]: START_MONEY },
    phase:     "lobby",
    currentPlayerIndex: 0,
    roundsPlayed: { [interaction.user.id]: 0 },
    currentRound: 1,
    ended: false,
  };
  luckGames.set(gameId, state);
  luckChannelMap.set(channelId, gameId);
  await interaction.reply({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
}

async function startGame(interaction, state) {
  state.phase = "playing";
  state.currentPlayerIndex = 0;
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
      content: `❌ مش دورك! دلوقتي دور <@${currentId}> — استنّاه يدوّر!`,
      flags: 64,
    });

  const seg    = spinWheel();
  const before = state.balances[currentId] ?? START_MONEY;
  applySegment(state, currentId, seg);
  const after  = state.balances[currentId];

  state.roundsPlayed[currentId] = (state.roundsPlayed[currentId] ?? 0) + 1;

  const isGood   = after >= before;
  const eventEmbed = new EmbedBuilder()
    .setColor(seg.type === "jackpot" ? 0xf1c40f : seg.type === "bankrupt" ? 0x2c3e50 : isGood ? 0x2ecc71 : 0xe74c3c)
    .setTitle(`${seg.emoji} ${seg.label} — وقعت على <@${currentId}>!`)
    .setDescription(getResultDesc(state, currentId, seg, before))
    .setTimestamp();

  // انتقل للتالي
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  if (state.currentPlayerIndex === 0) state.currentRound++;

  const allDone = state.players.every(id => (state.roundsPlayed[id] ?? 0) >= ROUNDS_EACH);
  if (allDone) return endGame(interaction, state, eventEmbed);

  await interaction.update({ embeds: [eventEmbed, buildGameEmbed(state)], components: buildSpinRow(state.id) });
}

async function endGame(interaction, state, lastEmbed) {
  state.ended = true;
  luckGames.delete(state.id);
  luckChannelMap.delete(state.channelId);

  const sorted = [...state.players].sort((a, b) => (state.balances[b] ?? 0) - (state.balances[a] ?? 0));
  const winner = sorted[0];
  const medals = ["🥇", "🥈", "🥉"];
  const board  = sorted.map((id, i) =>
    `${medals[i] ?? `${i + 1}.`} <@${id}> — **${(state.balances[id] ?? 0).toLocaleString()} 💵**`
  ).join("\n");

  const endEmbed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🎰 انتهى بنك الحظ!")
    .setDescription(`🎉 **الفايز: <@${winner}>!**\n\n**📊 الترتيب النهائي:**\n${board}`)
    .setFooter({ text: `🍀 بنك الحظ — الفايز بياخد ${WIN_REWARD} 🪙` })
    .setTimestamp();

  await interaction.update({ embeds: [lastEmbed, endEmbed], components: [] });

  if (interaction.client?._db) {
    try { interaction.client._db.addCoins(winner, WIN_REWARD); } catch {}
  }
}

export async function handleBankLuckButton(interaction, db) {
  const full   = interaction.customId;
  const second = full.split("_")[1];
  const gameId = full.split("_").slice(2).join("_");

  const state = luckGames.get(gameId);
  if (!state) {
    // اللعبة مش موجودة (ربما البوت اعاد التشغيل) — شيل الأزرار من الرسالة
    try {
      await interaction.update({
        content: "❌ انتهت اللعبة أو البوت اتعمل له restart — ابدأ لعبة جديدة من `/الألعاب`!",
        components: [],
      });
    } catch {
      await interaction.reply({ content: "❌ اللعبة انتهت — ابدأ لعبة جديدة!", flags: 64 });
    }
    return;
  }

  if (second === "join") {
    if (state.phase !== "lobby")              return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= MAX_PLAYERS) return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    state.balances[interaction.user.id]       = START_MONEY;
    state.roundsPlayed[interaction.user.id]   = 0;
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
    luckGames.delete(gameId);
    luckChannelMap.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🎰 تم إلغاء لعبة بنك الحظ")], components: [] });
  }

  if (second === "spin") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    return doSpin(interaction, state);
  }
}
