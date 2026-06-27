// ═══════════════════════════════════════════════════════════════
//  🎮 الألعاب الكلاسيكية — روليت + مافيا + اكس اوه
//  كلها بالأزرار — مع دعم قدرات الألعاب
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";

// ─── حالة الألعاب في الذاكرة ─────────────────────────────────
export const rouletteGames = new Map(); // gameId → state
export const mafiaGames    = new Map(); // gameId → state
export const tttGames      = new Map(); // gameId → state
export const channelGames  = new Map(); // channelId → gameId (لمنع لعبتين في روم واحد)
const tttProcessing = new Set(); // gameId — قفل لمنع المعالجة المتزامنة في XO

// ── helper: reply للأمر / update للزرار ───────────────────────
async function replyOrUpdate(interaction, options) {
  if (interaction.isButton?.()) {
    await interaction.update(options);
    return interaction.fetchReply().catch(() => null);
  }
  return interaction.reply({ ...options, fetchReply: true });
}

// ══════════════════════════════════════════════════════════════
//  ✂️ حجر ورقة مقص
// ══════════════════════════════════════════════════════════════
export const rpsGames      = new Map(); // gameId → state
export const rpsChannelMap = new Map(); // channelId → gameId
const rpsId = () => `rps${Date.now().toString(36)}${Math.random().toString(36).slice(2,4)}`;

export async function handleRPSCommand(interaction) {
  const channelId = interaction.channel.id;
  if (rpsChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة هنا — خلصوها الأول!", flags: 64 });

  const isButton   = interaction.isButton?.();
  const opponent   = isButton ? null : interaction.options?.getUser("خصم");
  if (!isButton && opponent) {
    if (opponent.id === interaction.user.id) return interaction.reply({ content: "❌ ما تعبش مع نفسك!", flags: 64 });
    if (opponent.bot) return interaction.reply({ content: "❌ ما تقدرش تلعب ضد بوت!", flags: 64 });
  }

  const gameId = rpsId();
  const state  = {
    id: gameId, channelId,
    playerA: interaction.user.id,
    playerB: isButton ? null : (opponent?.id ?? null),
    choiceA: null, choiceB: null,
    phase: "waiting", messageId: null,
    isOpen: isButton || !opponent,
  };
  rpsGames.set(gameId, state);
  rpsChannelMap.set(channelId, gameId);

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6).setTitle("✂️ حجر ورقة مقص — دعوة!")
    .setDescription(
      state.isOpen
        ? `<@${interaction.user.id}> بيطلب لعبة حجر ورقة مقص!\n🟢 اضغط "قبول" عشان تلعب ضده!`
        : `<@${interaction.user.id}> بيتحداك يا <@${opponent.id}>!\nاضغط "قبول" أو "رفض"`
    ).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rps_accept_${gameId}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rps_decline_${gameId}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger),
  );

  const msg = await replyOrUpdate(interaction, { embeds: [embed], components: [row] });
  if (msg) state.messageId = msg.id;

  setTimeout(() => {
    if (rpsGames.has(gameId) && rpsGames.get(gameId).phase === "waiting") {
      rpsGames.delete(gameId); rpsChannelMap.delete(channelId);
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("✂️ انتهت المهلة").setDescription("محدش قبل التحدي.")], components: [] }).catch(() => {});
    }
  }, 60_000);
}

export async function handleRPSButton(interaction) {
  const id    = interaction.customId;
  const parts = id.split("_");
  const action = parts[1];
  const gameId = parts.slice(2).join("_");
  const state  = rpsGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  // ── قبول / رفض ──────────────────────────────────────────────
  if (action === "accept" || action === "decline") {
    if (state.phase !== "waiting") return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.isOpen) {
      if (action === "decline") {
        if (interaction.user.id !== state.playerA) return interaction.reply({ content: "❌ مش إنت اللي بدأت!", flags: 64 });
        rpsGames.delete(gameId); rpsChannelMap.delete(state.channelId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("✂️ تم الإلغاء").setDescription("اللعبة اتلغت.")], components: [] });
      }
      if (interaction.user.id === state.playerA) return interaction.reply({ content: "❌ ما تقدرش تلعب ضد نفسك!", flags: 64 });
      state.playerB = interaction.user.id;
    } else {
      if (interaction.user.id !== state.playerB) return interaction.reply({ content: "❌ الدعوة مش إلك!", flags: 64 });
      if (action === "decline") {
        rpsGames.delete(gameId); rpsChannelMap.delete(state.channelId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("✂️ رُفض التحدي").setDescription(`<@${state.playerB}> رفض اللعبة.`)], components: [] });
      }
    }
    state.phase = "choosing";
    const chooseEmbed = new EmbedBuilder()
      .setColor(0x9b59b6).setTitle("✂️ حجر ورقة مقص — اختار حركتك!")
      .setDescription(
        `<@${state.playerA}> 🆚 <@${state.playerB}>\n\n` +
        `🌍 **مش لازم حجر أو ورقة أو مقص!**\n` +
        `اختار **أي حاجة في الكون** — سيف، ثقب أسود، فرعون، طاسة شاي...\n` +
        `الـ AI هيحكم مين يفوز ولماذا 🤖\n\n` +
        `اضغط الزرار ده واكتب اختيارك — **سري لحد ما الاتنين يختاروا!**\n` +
        `⏰ عندكم **2 دقيقة**`
      ).setTimestamp();
    const chooseRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rps_open_${gameId}`).setLabel("✏️ اختار حركتك").setStyle(ButtonStyle.Primary),
    );
    await interaction.update({ embeds: [chooseEmbed], components: [chooseRow] });

    setTimeout(() => {
      if (rpsGames.has(gameId) && rpsGames.get(gameId).phase === "choosing") {
        rpsGames.delete(gameId); rpsChannelMap.delete(state.channelId);
        interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("✂️ انتهى الوقت").setDescription("محدش اختار في الوقت المحدد!")], components: [] }).catch(() => {});
      }
    }, 120_000);
    return;
  }

  // ── فتح الـ Modal لاختيار الحركة ─────────────────────────────
  if (action === "open") {
    if (state.phase !== "choosing") return interaction.reply({ content: "❌ مش وقت الاختيار!", flags: 64 });
    const uid = interaction.user.id;
    if (uid !== state.playerA && uid !== state.playerB)
      return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
    const isA = uid === state.playerA;
    if (isA && state.choiceA) return interaction.reply({ content: "✅ إنت بالفعل اخترت — بنستنى خصمك!", flags: 64 });
    if (!isA && state.choiceB) return interaction.reply({ content: "✅ إنت بالفعل اخترت — بنستنى خصمك!", flags: 64 });

    const modal = new ModalBuilder()
      .setCustomId(`rpsmodal_${gameId}`)
      .setTitle("✂️ اختار حركتك!");
    const input = new TextInputBuilder()
      .setCustomId("choice")
      .setLabel("اكتب أي حاجة في الكون 🌍")
      .setPlaceholder("مثلاً: ثقب أسود / سيف السامورساي / قنبلة نووية...")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(60);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }
}

const randInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randArr  = arr => arr[randInt(0, arr.length - 1)];
const makeId   = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const COIN     = "🪙";

// ══════════════════════════════════════════════════════════════
//  🔫 روليت روسية
// ══════════════════════════════════════════════════════════════
export async function handleRouletteCommand(interaction, db) {
  const channelId = interaction.channel.id;
  if (channelGames.has(channelId)) {
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده — خلصوها الأول!", ephemeral: true });
  }

  const gameId = makeId();
  const state = {
    id: gameId,
    channelId,
    messageId: null,
    creatorId: interaction.user.id,
    players: [interaction.user.id],
    alive: new Set([interaction.user.id]),
    currentIndex: 0,
    bulletPos: randInt(1, 6),
    currentChamber: 1,
    phase: "lobby",
    round: 1,
    lastEliminated: null,
  };

  rouletteGames.set(gameId, state);
  channelGames.set(channelId, gameId);

  const embed = buildRouletteEmbed(state, interaction.guild);
  const rows  = buildRoutleteLobbyRows(gameId);
  const msg   = await replyOrUpdate(interaction, { embeds: [embed], components: rows });
  if (msg) state.messageId = msg.id;

  // إلغاء اللعبة تلقائياً بعد 5 دقايق لو ما بدأتش
  setTimeout(() => {
    if (rouletteGames.has(gameId) && rouletteGames.get(gameId).phase === "lobby") {
      rouletteGames.delete(gameId);
      channelGames.delete(channelId);
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🔫 روليت — انتهت المهلة").setDescription("انتهت مهلة انتظار اللاعبين.")], components: [] }).catch(() => {});
    }
  }, 5 * 60 * 1000);
}

function buildRouletteEmbed(state, guild) {
  const playerMentions = state.players.map((id, i) => {
    const alive = state.alive.has(id);
    const isCurrent = state.phase === "playing" && i === state.currentIndex % state.players.filter(p => state.alive.has(p)).indexOf(state.players[state.currentIndex % state.players.length]);
    return `${alive ? "🟢" : "💀"} <@${id}>`;
  });

  const aliveList = [...state.alive].map(id => `🟢 <@${id}>`);

  if (state.phase === "lobby") {
    return new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle("🔫 روليت روسية — انتظار اللاعبين")
      .setDescription(
        `المسدس فيه **6 طلقات، 1 حقيقية**.\nكل لاعب بيسحب الزناد — اللي يبقى آخر واحد يفوز!\n\n` +
        `👥 **اللاعبين (${state.players.length}/8):**\n${state.players.map(id => `• <@${id}>`).join("\n")}`
      )
      .addFields(
        { name: "⚡ قدرات مفيدة", value: "💚 حياة إضافية — تنجو من موتة | ☢️ نيوك — تفوز فوراً | 💥 طرد مزدوج — تطرد معك واحد", inline: false }
      )
      .setFooter({ text: "دوس «انضم» عشان تلعب | «ابدأ» لما كل الناس جهزوا" })
      .setTimestamp();
  }

  const alivePlayers = [...state.alive];
  const currentPlayerId = alivePlayers[state.currentIndex % alivePlayers.length];

  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🔫 روليت روسية — جولة ${state.round}`)
    .setDescription(
      `**المسدس:** ${"🔲".repeat(state.currentChamber - 1)}🔫${"⬛".repeat(Math.max(0, 6 - state.currentChamber))}\n\n` +
      `🎯 **دور:** <@${currentPlayerId}>\n\n` +
      `👥 **الباقيين (${alivePlayers.length}):**\n${alivePlayers.map(id => `• <@${id}>`).join("\n")}`
    )
    .setFooter({ text: `اسحب الزناد يا بطل! 😤` })
    .setTimestamp();
}

function buildRoutleteLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rlt_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rlt_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rlt_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function buildRoulettePlayRows(gameId, db, playerId) {
  const abilities = db.getGameAbilities(playerId);
  const buttons = [
    new ButtonBuilder().setCustomId(`rlt_pull_${gameId}`).setLabel("🔫 اسحب الزناد").setStyle(ButtonStyle.Danger),
  ];
  if (abilities.nuke > 0) {
    buttons.push(new ButtonBuilder().setCustomId(`rlt_nuke_${gameId}`).setLabel("☢️ نيوك").setStyle(ButtonStyle.Secondary));
  }
  if (abilities.extra_life > 0) {
    buttons.push(new ButtonBuilder().setCustomId(`rlt_shield_${gameId}`).setLabel("💚 حياة إضافية").setStyle(ButtonStyle.Success));
  }
  return [new ActionRowBuilder().addComponents(buttons)];
}

export async function handleRouletteButton(interaction, db) {
  const id = interaction.customId;
  const gameId = id.split("_").slice(2).join("_");
  const state  = rouletteGames.get(gameId);

  // انضم
  if (id.startsWith("rlt_join_")) {
    if (!state) return interaction.reply({ content: "❌ اللعبة ده انتهت!", ephemeral: true });
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت!", ephemeral: true });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", ephemeral: true });
    if (state.players.length >= 8) return interaction.reply({ content: "❌ اللعبة اكتملت (8 لاعبين)!", ephemeral: true });
    state.players.push(interaction.user.id);
    state.alive.add(interaction.user.id);
    const embed = buildRouletteEmbed(state, interaction.guild);
    await interaction.update({ embeds: [embed], components: buildRoutleteLobbyRows(gameId) });
    return;
  }

  // إلغاء
  if (id.startsWith("rlt_cancel_")) {
    if (!state) return interaction.reply({ content: "❌ اللعبة منتهية!", ephemeral: true });
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يقدر يلغيها!", ephemeral: true });
    rouletteGames.delete(gameId);
    channelGames.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🔫 تم إلغاء الروليت").setDescription("تم إلغاء اللعبة.")], components: [] });
  }

  // ابدأ
  if (id.startsWith("rlt_start_")) {
    if (!state) return interaction.reply({ content: "❌ اللعبة منتهية!", ephemeral: true });
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يقدر يبدأها!", ephemeral: true });
    if (state.players.length < 2) return interaction.reply({ content: "❌ لازم لاعبين اتنين على الأقل!", ephemeral: true });
    state.phase = "playing";
    state.bulletPos = randInt(1, 6);
    const embed = buildRouletteEmbed(state, interaction.guild);
    const alivePlayers = [...state.alive];
    const currentPlayerId = alivePlayers[0];
    const rows = buildRoulettePlayRows(gameId, db, currentPlayerId);
    return interaction.update({ embeds: [embed], components: rows });
  }

  // سحب الزناد
  if (id.startsWith("rlt_pull_")) {
    if (!state || state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", ephemeral: true });
    const alivePlayers = [...state.alive];
    const currentPlayerId = alivePlayers[state.currentIndex % alivePlayers.length];
    if (interaction.user.id !== currentPlayerId) return interaction.reply({ content: "❌ مش دورك!", ephemeral: true });

    const boom = state.currentChamber === state.bulletPos;
    state.currentChamber++;

    if (boom) {
      // شيك على الحياة الإضافية
      const hasShield = db.useGameAbility(currentPlayerId, "extra_life");
      if (hasShield) {
        const embed = new EmbedBuilder()
          .setColor(0x27ae60)
          .setTitle("💚 الحياة الإضافية نجّتك!")
          .setDescription(`<@${currentPlayerId}> الطلقة وصلته بس الحياة الإضافية نجّته! 🍀\nاستخدم الحياة الإضافية ومش هتنفعك تاني في الجولة دي.`)
          .setTimestamp();
        // ابدأ من الأول
        state.bulletPos = randInt(state.currentChamber, 10);
        if (state.currentChamber > 6) {
          state.currentChamber = 1;
          state.bulletPos = randInt(1, 6);
          state.round++;
        }
        state.currentIndex = (state.currentIndex + 1) % alivePlayers.length;
        const newAlive = [...state.alive];
        const nextPlayer = newAlive[state.currentIndex % newAlive.length];
        const rows = buildRoulettePlayRows(gameId, db, nextPlayer);
        const mainEmbed = buildRouletteEmbed(state, interaction.guild);
        return interaction.update({ embeds: [embed, mainEmbed], components: rows });
      }

      // اتحذف من الألعاب
      state.alive.delete(currentPlayerId);
      state.lastEliminated = currentPlayerId;
      let eliminationMsg = `💀 **BOOM!** <@${currentPlayerId}> اتطردت من اللعبة! 🎯`;

      // شيك على الطرد المزدوج
      const hasDoubleKick = db.useGameAbility(currentPlayerId, "double_kick");
      let extraEliminated = null;
      if (hasDoubleKick && state.alive.size > 1) {
        const remaining = [...state.alive].filter(p => p !== currentPlayerId);
        extraEliminated = randArr(remaining);
        state.alive.delete(extraEliminated);
        eliminationMsg += `\n💥 **طرد مزدوج!** <@${currentPlayerId}> مع موته أخذ معه <@${extraEliminated}>!`;
      }

      // شيك الفوز
      if (state.alive.size <= 1) {
        const winner = [...state.alive][0];
        const prize  = (state.players.length - 1) * 300;
        if (winner) db.updateUser(winner, { coins: (db.getUser(winner).coins || 0) + prize });
        rouletteGames.delete(gameId);
        channelGames.delete(state.channelId);
        const winEmbed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("🏆 روليت — فاز اللاعب الأخير!")
          .setDescription(`${eliminationMsg}\n\n👑 **الفائز: <@${winner}>**\n${COIN} ربح **${prize} كوينز**!`)
          .setTimestamp();
        return interaction.update({ embeds: [winEmbed], components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`replay_rlt_${state.channelId}`).setLabel("🔄 لعبة روليت جديدة").setStyle(ButtonStyle.Primary),
        )] });
      }

      // تحديث الدور
      state.currentIndex = state.currentIndex % state.alive.size;
      // لو الأشمبر وصل 6 ابدأ من الأول
      if (state.currentChamber > 6) {
        state.currentChamber = 1;
        state.bulletPos = randInt(1, 6);
        state.round++;
      }
      const newAlive = [...state.alive];
      const nextIdx = state.currentIndex % newAlive.length;
      const nextPlayer = newAlive[nextIdx];
      const elimEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("💥 إطلاق نار!")
        .setDescription(eliminationMsg)
        .setTimestamp();
      const mainEmbed = buildRouletteEmbed(state, interaction.guild);
      const rows = buildRoulettePlayRows(gameId, db, nextPlayer);
      return interaction.update({ embeds: [elimEmbed, mainEmbed], components: rows });

    } else {
      // طلقة فاضية
      // لو الأشمبر وصل 6 ابدأ من الأول
      if (state.currentChamber > 6) {
        state.currentChamber = 1;
        state.bulletPos = randInt(1, 6);
        state.round++;
      }
      state.currentIndex = (state.currentIndex + 1) % alivePlayers.length;
      // تأكد إن اللاعب التالي موجود في الـ alive
      let tries = 0;
      while (!state.alive.has(alivePlayers[state.currentIndex % alivePlayers.length]) && tries < alivePlayers.length) {
        state.currentIndex = (state.currentIndex + 1) % alivePlayers.length;
        tries++;
      }
      const newAlive = [...state.alive];
      const nextPlayer = newAlive[state.currentIndex % newAlive.length];
      const safeEmbed = new EmbedBuilder()
        .setColor(0x27ae60)
        .setTitle("😮‍💨 نجا!")
        .setDescription(`<@${currentPlayerId}> سحب الزناد... **كليك** — طلقة فاضية! 😮‍💨\n\nدور <@${nextPlayer}> الجاي`)
        .setTimestamp();
      const mainEmbed = buildRouletteEmbed(state, interaction.guild);
      const rows = buildRoulettePlayRows(gameId, db, nextPlayer);
      return interaction.update({ embeds: [safeEmbed, mainEmbed], components: rows });
    }
  }

  // نيوك
  if (id.startsWith("rlt_nuke_")) {
    if (!state || state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", ephemeral: true });
    const alivePlayers = [...state.alive];
    const currentPlayerId = alivePlayers[state.currentIndex % alivePlayers.length];
    if (interaction.user.id !== currentPlayerId) return interaction.reply({ content: "❌ مش دورك!", ephemeral: true });

    const used = db.useGameAbility(currentPlayerId, "nuke");
    if (!used) return interaction.reply({ content: "❌ ما عندكش نيوك!", ephemeral: true });

    const prize = (state.players.length - 1) * 300;
    db.updateUser(currentPlayerId, { coins: (db.getUser(currentPlayerId).coins || 0) + prize });
    rouletteGames.delete(gameId);
    channelGames.delete(state.channelId);

    const nukeEmbed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle("☢️ نيوك! — إبادة جماعية!")
      .setDescription(
        `<@${currentPlayerId}> فجّر النيوك! 💥\n` +
        `كل اللاعبين اتمحوا من الوجود!\n\n` +
        `👑 **الفائز: <@${currentPlayerId}>**\n${COIN} ربح **${prize} كوينز**!`
      )
      .setTimestamp();
    return interaction.update({ embeds: [nukeEmbed], components: [] });
  }

  // درع / حياة إضافية (استخدام في البداية)
  if (id.startsWith("rlt_shield_")) {
    return interaction.reply({ content: "💚 الحياة الإضافية هتشتغل تلقائياً لما تتضرب!", ephemeral: true });
  }
}

// ══════════════════════════════════════════════════════════════
//  🕵️ مافيا
// ══════════════════════════════════════════════════════════════
export async function handleMafiaCommand(interaction, db) {
  const channelId = interaction.channel.id;
  if (channelGames.has(channelId)) {
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده!", ephemeral: true });
  }

  const gameId = makeId();
  const state = {
    id: gameId,
    channelId,
    messageId: null,
    creatorId: interaction.user.id,
    phase: "lobby",
    players: [interaction.user.id],
    alive: new Set([interaction.user.id]),
    roles: {},
    votes: new Map(),
    nightKill: null,
    detectiveTarget: null,
    round: 0,
    timer: null,
  };

  mafiaGames.set(gameId, state);
  channelGames.set(channelId, gameId);

  const embed = buildMafiaLobbyEmbed(state);
  const rows  = buildMafiaLobbyRows(gameId);
  const msg   = await replyOrUpdate(interaction, { embeds: [embed], components: rows });
  if (msg) state.messageId = msg.id;

  setTimeout(async () => {
    if (mafiaGames.has(gameId) && mafiaGames.get(gameId).phase === "lobby") {
      mafiaGames.delete(gameId);
      channelGames.delete(channelId);
      const timeoutEmbed = new EmbedBuilder().setColor(0x555).setTitle("🕵️ مافيا — انتهت المهلة").setDescription("انتهت مهلة الانتظار.");
      if (state.messageId) {
        const ch = await interaction.client?.channels?.fetch(channelId).catch(() => null);
        const m  = ch ? await ch.messages.fetch(state.messageId).catch(() => null) : null;
        if (m) { m.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {}); return; }
      }
      interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  }, 10 * 60 * 1000);
}

function buildMafiaLobbyEmbed(state) {
  const n = state.players.length;
  let rolesInfo = "👥 مع 4-5 لاعبين: 1 مافيا | 6+ لاعبين: 2 مافيا";
  return new EmbedBuilder()
    .setColor(0x2c3e50)
    .setTitle("🕵️ لعبة المافيا — انتظار اللاعبين")
    .setDescription(
      `**قواعد المافيا:**\n` +
      `• 🔴 **مافيا** — يقتلوا واحد كل ليلة سراً\n` +
      `• 🔵 **محقق** — يكشف شخص كل ليلة\n` +
      `• ⚪ **مدني** — يصوتوا عشان يطردوا المشتبه بيه\n\n` +
      `**النهار:** كل الأحياء يصوتوا على المشتبه بيه 🗳️\n` +
      `**الليل:** المافيا يختاروا ضحية | المحقق يكشف شخص 🌙\n\n` +
      `👥 **اللاعبين (${n}/10):**\n${state.players.map(id => `• <@${id}>`).join("\n")}\n\n` +
      `${rolesInfo}\n⚠️ **يلزم 4 لاعبين على الأقل**`
    )
    .setFooter({ text: "الأونر يضغط «ابدأ» لما كل الناس جهزوا" })
    .setTimestamp();
}

function buildMafiaLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`maf_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`maf_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`maf_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function assignRoles(players) {
  const n = players.length;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const roles = {};
  let mafiaCount = n >= 9 ? 3 : n >= 6 ? 2 : 1;
  let detectiveCount = n >= 9 ? 2 : 1;
  shuffled.forEach((id, i) => {
    if (i < mafiaCount) roles[id] = "mafia";
    else if (i < mafiaCount + detectiveCount) roles[id] = "detective";
    else roles[id] = "civilian";
  });
  return roles;
}

function buildDayEmbed(state, guild) {
  const alivePlayers = [...state.alive];
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`☀️ النهار — الجولة ${state.round}`)
    .setDescription(
      `صوّتوا على اللي تشكوا فيه عشان يتطرد!\n` +
      `⏱️ عندكم **2 دقيقة** للتصويت\n\n` +
      `👥 **الأحياء (${alivePlayers.length}):**\n${alivePlayers.map(id => `• <@${id}>`).join("\n")}\n\n` +
      `🗳️ **الأصوات:**\n${buildVoteDisplay(state)}`
    )
    .setFooter({ text: "اضغط على اسم اللي تشك فيه!" })
    .setTimestamp();
}

function buildVoteDisplay(state) {
  if (state.votes.size === 0) return "مفيش أصوات لسه";
  const counts = {};
  for (const [, target] of state.votes) {
    counts[target] = (counts[target] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([id, c]) => `<@${id}>: ${"🗳️".repeat(c)} (${c})`)
    .join("\n");
}

function buildVoteRows(gameId, state, voterId, guild = null) {
  const alivePlayers = [...state.alive].filter(id => id !== voterId);
  if (alivePlayers.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < alivePlayers.length; i += 5) chunks.push(alivePlayers.slice(i, i + 5));
  return chunks.slice(0, 5).map(chunk =>
    new ActionRowBuilder().addComponents(
      chunk.map(id => {
        const member = guild?.members?.cache?.get(id);
        const name   = member?.displayName || member?.user?.username || `...${id.slice(-5)}`;
        return new ButtonBuilder()
          .setCustomId(`maf_vote_${gameId}_${id}`)
          .setLabel(name.slice(0, 25))
          .setStyle(ButtonStyle.Secondary);
      })
    )
  );
}

function buildNightEmbed(state) {
  return new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle(`🌙 الليل — الجولة ${state.round}`)
    .setDescription(
      `الليل نزل على السيرفر...\n\n` +
      `🔴 **المافيا:** اضغط "تصرف الليل" عشان تختار ضحيتك\n` +
      `🔵 **المحقق:** اضغط "تصرف الليل" عشان تكشف شخص\n` +
      `⚪ **المدني:** استنوا النهار الجاي\n\n` +
      `⏱️ عندكم **دقيقة واحدة**`
    )
    .setFooter({ text: "🌙 الليل" })
    .setTimestamp();
}

function buildNightRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`maf_night_${gameId}`).setLabel("🌙 تصرف الليل").setStyle(ButtonStyle.Primary),
  )];
}

function buildNightActionRows(gameId, state, actorId, guild = null) {
  const role = state.roles[actorId];
  const targets = [...state.alive].filter(id => {
    if (role === "mafia") return state.roles[id] !== "mafia";
    if (role === "detective") return id !== actorId;
    return false;
  });
  if (targets.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < targets.length; i += 5) chunks.push(targets.slice(i, i + 5));
  const prefix = role === "mafia" ? "maf_kill" : "maf_detect";
  return chunks.slice(0, 5).map(chunk =>
    new ActionRowBuilder().addComponents(
      chunk.map(id => {
        const member = guild?.members?.cache?.get(id);
        const name   = member?.displayName || member?.user?.username || `...${id.slice(-5)}`;
        return new ButtonBuilder()
          .setCustomId(`${prefix}_${gameId}_${id}`)
          .setLabel(name.slice(0, 25))
          .setStyle(role === "mafia" ? ButtonStyle.Danger : ButtonStyle.Primary);
      })
    )
  );
}

async function startDay(interaction, gameId, state) {
  state.phase = "day";
  state.votes.clear();
  state.round++;

  const embed = buildDayEmbed(state, interaction.guild);
  buildVoteRows(gameId, state, null, interaction.guild); // preload — unused here
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`maf_voteself_${gameId}`).setLabel("🗳️ صوّت الآن").setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [actionRow] });

  // مؤقت 2 دقيقة
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    if (!mafiaGames.has(gameId)) return;
    await resolveDay(interaction, gameId, state);
  }, 2 * 60 * 1000);
}

async function resolveDay(interaction, gameId, state) {
  if (!mafiaGames.has(gameId)) return;

  const counts = {};
  for (const [, target] of state.votes) {
    counts[target] = (counts[target] || 0) + 1;
  }

  let eliminated = null;
  if (Object.keys(counts).length > 0) {
    const maxVotes = Math.max(...Object.values(counts));
    const topTargets = Object.entries(counts).filter(([, c]) => c === maxVotes).map(([id]) => id);
    eliminated = randArr(topTargets);
    state.alive.delete(eliminated);
  }

  const role = eliminated ? state.roles[eliminated] : null;
  const roleStr = role === "mafia" ? "🔴 مافيا" : role === "detective" ? "🔵 محقق" : "⚪ مدني";

  const resultEmbed = new EmbedBuilder()
    .setColor(eliminated ? 0xe74c3c : 0x95a5a6)
    .setTitle("☀️ نتيجة التصويت")
    .setDescription(
      eliminated
        ? `البلد قررت تطرد <@${eliminated}>!\nكانوا **${roleStr}** 😱`
        : "ما اتفقوش على حد — محدش اتطرد النهارده! 🤷"
    )
    .setTimestamp();

  // شيك الفوز
  const winner = checkMafiaWin(state);
  if (winner) {
    return endMafiaGame(interaction, gameId, state, winner, resultEmbed);
  }

  // ابدأ الليل
  await interaction.editReply({ embeds: [resultEmbed], components: [] });
  await new Promise(r => setTimeout(r, 3000));
  startNight(interaction, gameId, state);
}

async function startNight(interaction, gameId, state) {
  state.phase = "night";
  state.nightKill = null;
  state.detectiveTarget = null;

  const embed = buildNightEmbed(state);
  const rows  = buildNightRows(gameId);
  await interaction.editReply({ embeds: [embed], components: rows });

  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    if (!mafiaGames.has(gameId)) return;
    await resolveNight(interaction, gameId, state);
  }, 60 * 1000);
}

async function resolveNight(interaction, gameId, state) {
  if (!mafiaGames.has(gameId)) return;

  let nightMsg = "🌙 **نتيجة الليل:**\n";

  // اقتل الضحية
  if (state.nightKill && state.alive.has(state.nightKill)) {
    state.alive.delete(state.nightKill);
    nightMsg += `💀 **المافيا قتلوا <@${state.nightKill}>** في الليل!\n`;
  } else {
    nightMsg += "😴 المافيا ما قتلوش حد الليل ده\n";
  }

  // نتيجة التحقيق
  if (state.detectiveTarget) {
    const dRole = state.roles[state.detectiveTarget];
    const dRoleStr = dRole === "mafia" ? "🔴 مافيا!" : "✅ بريء";
    // الرسالة دي للمحقق بس (هتتبعت كـ follow-up أو في الرد الرئيسي)
    nightMsg += `🔍 المحقق فحص شخص وعرف النتيجة\n`;
  }

  const nightResultEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle("🌅 الفجر طلع!")
    .setDescription(nightMsg)
    .setTimestamp();

  const winner = checkMafiaWin(state);
  if (winner) {
    return endMafiaGame(interaction, gameId, state, winner, nightResultEmbed);
  }

  await interaction.editReply({ embeds: [nightResultEmbed], components: [] });
  await new Promise(r => setTimeout(r, 3000));
  await startDay(interaction, gameId, state);
}

function checkMafiaWin(state) {
  const alive = [...state.alive];
  const mafiaAlive = alive.filter(id => state.roles[id] === "mafia").length;
  const civilianAlive = alive.filter(id => state.roles[id] !== "mafia").length;
  if (mafiaAlive === 0) return "civilian";
  if (mafiaAlive >= civilianAlive) return "mafia";
  return null;
}

async function endMafiaGame(interaction, gameId, state, winner, previousEmbed) {
  mafiaGames.delete(gameId);
  channelGames.delete(state.channelId);

  const winnerIds = [...state.players].filter(id => state.roles[id] === (winner === "mafia" ? "mafia" : undefined) || (winner === "civilian" && state.roles[id] !== "mafia"));
  const isMafiaWin = winner === "mafia";

  const endEmbed = new EmbedBuilder()
    .setColor(isMafiaWin ? 0xe74c3c : 0x27ae60)
    .setTitle(isMafiaWin ? "🔴 المافيا فازت!" : "⚪ المدنيون فازوا!")
    .setDescription(
      isMafiaWin
        ? "المافيا سيطرت على البلدة! 😈\n\n**الأدوار:**\n" + buildRolesReveal(state)
        : "المدنيون كشفوا المافيا! 🎉\n\n**الأدوار:**\n" + buildRolesReveal(state)
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [previousEmbed, endEmbed], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`replay_maf_${state.channelId}`).setLabel("🔄 لعبة مافيا جديدة").setStyle(ButtonStyle.Primary),
  )] });
}

function buildRolesReveal(state) {
  return state.players.map(id => {
    const r = state.roles[id];
    const emoji = r === "mafia" ? "🔴" : r === "detective" ? "🔵" : "⚪";
    return `${emoji} <@${id}> — ${r === "mafia" ? "مافيا" : r === "detective" ? "محقق" : "مدني"}`;
  }).join("\n");
}

export async function handleMafiaButton(interaction, db) {
  const id = interaction.customId;

  // استخرج gameId
  let gameId;
  if (id.startsWith("maf_join_") || id.startsWith("maf_start_") || id.startsWith("maf_cancel_") || id.startsWith("maf_voteself_") || id.startsWith("maf_night_")) {
    gameId = id.split("_").slice(2).join("_");
  } else if (id.startsWith("maf_vote_") || id.startsWith("maf_kill_") || id.startsWith("maf_detect_")) {
    const parts = id.split("_");
    // maf_vote_GAMEID_TARGETID
    gameId = parts.slice(2, parts.length - 1).join("_");
  }

  const state = mafiaGames.get(gameId);

  // انضم
  if (id.startsWith("maf_join_")) {
    if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", ephemeral: true });
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت!", ephemeral: true });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", ephemeral: true });
    if (state.players.length >= 10) return interaction.reply({ content: "❌ اللعبة اكتملت!", ephemeral: true });
    state.players.push(interaction.user.id);
    state.alive.add(interaction.user.id);
    await interaction.update({ embeds: [buildMafiaLobbyEmbed(state)], components: buildMafiaLobbyRows(gameId) });
    return;
  }

  // إلغاء
  if (id.startsWith("maf_cancel_")) {
    if (!state) return interaction.reply({ content: "❌ اللعبة منتهية!", ephemeral: true });
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", ephemeral: true });
    mafiaGames.delete(gameId);
    channelGames.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🕵️ تم إلغاء المافيا")], components: [] });
  }

  // ابدأ
  if (id.startsWith("maf_start_")) {
    if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", ephemeral: true });
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يبدأها!", ephemeral: true });
    if (state.players.length < 4) return interaction.reply({ content: "❌ لازم 4 لاعبين على الأقل!", ephemeral: true });

    state.roles = assignRoles(state.players);

    // بعت لكل لاعب تعليمات مفصلة حسب دوره
    for (const playerId of state.players) {
      const role     = state.roles[playerId];
      const mafiaIds = Object.entries(state.roles).filter(([, r]) => r === "mafia").map(([id]) => id);
      let dmLines = [];

      if (role === "mafia") {
        const teammates = mafiaIds.filter(id => id !== playerId);
        dmLines = [
          `🔴 **إنت مافيا! 😈**`,
          ``,
          `**مهمتك في اللعبة:**`,
          `• 🌙 **الليل:** اضغط "تصرف الليل" في الشات عشان تختار ضحيتك`,
          `• ☀️ **النهار:** اتكلم بشكل طبيعي وحاول تقنع الكل إنك مدني — لا تنكشف!`,
          `• 🗳️ **التصويت:** صوّت على حد عشان تشتت الأنظار بعيداً عنك`,
          ``,
          teammates.length > 0
            ? `👥 **فريقك:** ${teammates.map(id => `<@${id}>`).join(", ")}\nاتفقوا معاهم في الخاص على الضحية!`
            : `👤 إنت المافيا الوحيد — فكر بذكاء!`,
          ``,
          `⚠️ **مهم جداً: ما تقولش لحد دورك!** 🤫`,
        ];
      } else if (role === "detective") {
        dmLines = [
          `🔵 **إنت المحقق! 🔍**`,
          ``,
          `**مهمتك في اللعبة:**`,
          `• 🌙 **الليل:** اضغط "تصرف الليل" في الشات عشان تكشف هوية شخص`,
          `  → البوت هيبعتلك رسالة سرية: هل هو مافيا أو بريء؟`,
          `• ☀️ **النهار:** استخدم معلوماتك لتوجيه التصويت — بحذر عشان متتكشفش`,
          `• ⚠️ لو المافيا عرفت إنك المحقق — هتستهدفك الليلة الجاية!`,
          ``,
          `🎯 **هدفك:** اكشف المافيا وخلّي البلدة تطردهم قبل فوات الأوان`,
          ``,
          `⚠️ **مهم جداً: ما تقولش لحد دورك!** 🤫`,
        ];
      } else {
        dmLines = [
          `⚪ **إنت مدني! 👥**`,
          ``,
          `**مهمتك في اللعبة:**`,
          `• ☀️ **النهار:** شارك في النقاش وحاول تكشف مين المافيا`,
          `• 🗳️ **التصويت:** اضغط "صوّت الآن" وصوّت على اللي تشك فيه`,
          `• 🌙 **الليل:** استنى — مفيش تصرف لك في الليل`,
          ``,
          `💡 **نصيحة:** راقب مين بيحاول يشتت الكلام أو ما بيشاركش بشكل طبيعي`,
          ``,
          `🎯 **هدفك:** ساعد في طرد كل المافيا قبل ما يقضوا عليكم جميعاً`,
        ];
      }

      await interaction.client.users.fetch(playerId)
        .then(u => u.send(dmLines.join("\n")).catch(() => {}))
        .catch(() => {});
    }

    await startDay(interaction, gameId, state);
    return;
  }

  // زر "صوّت الآن" — يفتح أزرار التصويت للمستخدم ده بس
  if (id.startsWith("maf_voteself_")) {
    if (!state || state.phase !== "day") return interaction.reply({ content: "❌ مش وقت التصويت دلوقتي!", ephemeral: true });
    if (!state.alive.has(interaction.user.id)) return interaction.reply({ content: "❌ إنت متت! ما تقدرش تصوت.", ephemeral: true });
    const rows = buildVoteRows(gameId, state, interaction.user.id, interaction.guild);
    if (rows.length === 0) return interaction.reply({ content: "❌ ما فيش حد تصوت عليه!", ephemeral: true });
    return interaction.reply({ content: "🗳️ اختار مين تشك فيه:", components: rows, ephemeral: true });
  }

  // تصويت
  if (id.startsWith("maf_vote_")) {
    if (!state || state.phase !== "day") return interaction.reply({ content: "❌ مش وقت التصويت!", ephemeral: true });
    if (!state.alive.has(interaction.user.id)) return interaction.reply({ content: "❌ إنت متت!", ephemeral: true });
    const parts = id.split("_");
    const targetId = parts[parts.length - 1];
    state.votes.set(interaction.user.id, targetId);
    // حدث الإمبيد الرئيسي
    const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [buildDayEmbed(state, interaction.guild)], components: msg.components }).catch(() => {});
    return interaction.reply({ content: `✅ صوتك على <@${targetId}> اتسجل!`, ephemeral: true });
  }

  // تصرف الليل
  if (id.startsWith("maf_night_")) {
    if (!state || state.phase !== "night") return interaction.reply({ content: "❌ مش الليل دلوقتي!", ephemeral: true });
    if (!state.alive.has(interaction.user.id)) return interaction.reply({ content: "❌ إنت متت!", ephemeral: true });
    const role = state.roles[interaction.user.id];
    if (role !== "mafia" && role !== "detective") return interaction.reply({ content: "⚪ إنت مدني — استنى النهار الجاي!", ephemeral: true });

    const rows = buildNightActionRows(gameId, state, interaction.user.id, interaction.guild);
    if (rows.length === 0) return interaction.reply({ content: "❌ ما فيش هدف متاح!", ephemeral: true });

    const actionTitle = role === "mafia" ? "🔴 اختار ضحيتك الليلة:" : "🔵 اختار مين تحقق معاه:";
    return interaction.reply({ content: actionTitle, components: rows, ephemeral: true });
  }

  // قتل ليلي (مافيا)
  if (id.startsWith("maf_kill_")) {
    if (!state || state.phase !== "night") return interaction.reply({ content: "❌ مش الليل!", ephemeral: true });
    const parts = id.split("_");
    const targetId = parts[parts.length - 1];
    if (state.roles[interaction.user.id] !== "mafia") return interaction.reply({ content: "❌ إنت مش مافيا!", ephemeral: true });
    state.nightKill = targetId;
    return interaction.reply({ content: `✅ اخترت <@${targetId}> — استنى الفجر!`, ephemeral: true });
  }

  // تحقيق ليلي (محقق)
  if (id.startsWith("maf_detect_")) {
    if (!state || state.phase !== "night") return interaction.reply({ content: "❌ مش الليل!", ephemeral: true });
    const parts = id.split("_");
    const targetId = parts[parts.length - 1];
    if (state.roles[interaction.user.id] !== "detective") return interaction.reply({ content: "❌ إنت مش محقق!", ephemeral: true });
    state.detectiveTarget = targetId;
    const targetRole = state.roles[targetId];
    const isMafia = targetRole === "mafia";
    return interaction.reply({
      content: `🔍 **نتيجة التحقيق:**\n<@${targetId}> هو **${isMafia ? "🔴 مافيا! 😱" : "✅ بريء"}**`,
      ephemeral: true
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  ❌⭕ اكس اوه (Tic-Tac-Toe)
// ══════════════════════════════════════════════════════════════
export async function handleTTTCommand(interaction, db, forceAI = false) {
  // ── تحديد الخصم: من الأمر /اكس-اوه أو تحدي مفتوح من مركز الألعاب ──
  const isButton   = interaction.isButton?.();
  const opponent   = isButton ? null : interaction.options?.getUser("خصم");
  const vsAI       = forceAI || (!isButton && !opponent);

  if (!isButton && !vsAI) {
    if (opponent.id === interaction.user.id) return interaction.reply({ content: "❌ ما تعبش مع نفسك 😅", flags: 64 });
    if (opponent.bot) return interaction.reply({ content: "❌ ما تقدرش تلعب ضد بوت تاني 😄", flags: 64 });
  }

  if (channelGames.has(interaction.channel.id))
    return interaction.reply({ content: "❌ في لعبة شغالة هنا بالفعل!", flags: 64 });

  const gameId = makeId();
  const isOpen = isButton && !forceAI;
  const state = {
    id: gameId,
    channelId: interaction.channel.id,
    playerX: interaction.user.id,
    playerO: vsAI ? AI_PLAYER_ID : (isOpen ? null : opponent.id),
    board: Array(9).fill(""),
    currentTurn: "X",
    winner: null,
    phase: vsAI ? "playing" : "waiting",
    isOpen,
    isAI: vsAI,
  };

  tttGames.set(gameId, state);
  channelGames.set(interaction.channel.id, gameId);

  // ── لعبة ضد AI — اختار الصعوبة الأول ───────────────────────
  if (vsAI) {
    state.phase = "difficulty";
    await replyOrUpdate(interaction, { embeds: [buildDifficultyEmbed()], components: [buildDifficultyRow(gameId)] });
    return;
  }

  // ── لعبة ضد لاعب — انتظار قبول ──────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("❌⭕ اكس اوه — دعوة للعب!")
    .setDescription(
      isOpen
        ? `<@${interaction.user.id}> بيطلب لعبة اكس-اوه!\n\n🟢 **مين عنده جرأة يقبل؟** اضغط "قبول" عشان تلعب ضده!`
        : `<@${interaction.user.id}> بيتحداك يا <@${opponent.id}>!\n\nاضغط "قبول" عشان تلعب أو "رفض" عشان تتجنبه 😄`
    )
    .setTimestamp();

  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ttt_accept_${gameId}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ttt_decline_${gameId}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger),
  );
  if (isOpen) {
    acceptRow.addComponents(
      new ButtonBuilder().setCustomId(`ttt_vsai_${gameId}`).setLabel("🤖 ضد AI").setStyle(ButtonStyle.Primary),
    );
  }
  const rows = [acceptRow];

  const msg = await replyOrUpdate(interaction, { embeds: [embed], components: rows });
  if (msg) state.messageId = msg.id;

  setTimeout(() => {
    if (tttGames.has(gameId) && tttGames.get(gameId).phase === "waiting") {
      tttGames.delete(gameId);
      channelGames.delete(interaction.channel.id);
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("❌⭕ انتهت المهلة").setDescription("محدش قبل التحدي 😔")], components: [] }).catch(() => {});
    }
  }, 60 * 1000);
}

function buildTTTEmbed(state) {
  const symbols = { X: "❌", O: "⭕", "": "⬛" };
  const boardStr = [0, 3, 6].map(row =>
    [0, 1, 2].map(col => symbols[state.board[row + col]]).join("")
  ).join("\n");

  const isAI = state.isAI;
  const oName = isAI ? "🤖 الذكاء الاصطناعي" : `<@${state.playerO}>`;
  const currentPlayer = state.currentTurn === "X" ? `<@${state.playerX}>` : oName;

  let statusLine;
  if (state.winner === "draw") {
    statusLine = "🤝 **تعادل!** الذكاء الاصطناعي كانت تعادلت معاك!";
  } else if (state.winner) {
    statusLine = state.winner === AI_PLAYER_ID
      ? `🤖 **الذكاء الاصطناعي فاز!** — جرّب تاني وهتقدر تكسبه 💪`
      : `🏆 **فزت على الذكاء الاصطناعي! مبروك! 🎉**`;
    if (!isAI) {
      statusLine = `🏆 **فاز <@${state.winner}>!**`;
    }
  } else {
    statusLine = `🎯 **دور:** ${currentPlayer} (${state.currentTurn === "X" ? "❌" : "⭕"})`;
    if (isAI && state.currentTurn === "O") statusLine = `🎯 **دور:** 🤖 الذكاء الاصطناعي (⭕)`;
  }

  const diffLabel = isAI && state.difficulty
    ? ({ easy: "🟢 سهل", medium: "🟡 متوسط", hard: "🔴 صعب" }[state.difficulty] ?? state.difficulty)
    : null;

  const embed = new EmbedBuilder()
    .setColor(state.winner ? 0xf1c40f : (isAI ? 0x9b59b6 : 0x3498db))
    .setTitle(isAI ? "❌⭕ اكس اوه — ضد الذكاء الاصطناعي 🤖" : "❌⭕ اكس اوه")
    .setDescription(`${boardStr}\n\n${statusLine}`)
    .addFields(
      { name: "❌ اكس", value: `<@${state.playerX}>`, inline: true },
      { name: "⭕ دايرة", value: oName, inline: true },
    )
    .setTimestamp();

  if (diffLabel) embed.setFooter({ text: `مستوى الصعوبة: ${diffLabel}` });
  return embed;
}

function buildTTTRows(gameId, state) {
  const symbols = { X: "❌", O: "⭕", "": "⬜" };
  const rows = [];
  for (let row = 0; row < 3; row++) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cell = state.board[idx];
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_move_${gameId}_${idx}`)
          .setLabel(cell ? symbols[cell] : "⬜")
          .setStyle(cell === "X" ? ButtonStyle.Danger : cell === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(!!cell || !!state.winner)
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

function checkTTTWinner(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(c => c !== "")) return "draw";
  return null;
}

// ══════════════════════════════════════════════════════════════
//  🤖 Minimax AI — Alpha-Beta Pruning
// ══════════════════════════════════════════════════════════════
const AI_SYMBOL    = "O";
const HUMAN_SYMBOL = "X";
const AI_PLAYER_ID = "AI_BOT";

function minimaxTTT(board, depth, alpha, beta, isMaximizing) {
  const result = checkTTTWinner(board);
  if (result === AI_SYMBOL)    return 10 - depth;
  if (result === HUMAN_SYMBOL) return depth - 10;
  if (result === "draw")       return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = AI_SYMBOL;
        best = Math.max(best, minimaxTTT(board, depth + 1, alpha, beta, false));
        board[i] = "";
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = +Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = HUMAN_SYMBOL;
        best = Math.min(best, minimaxTTT(board, depth + 1, alpha, beta, true));
        board[i] = "";
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

function getAIMove(board, difficulty = "hard") {
  const empty = board.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
  if (empty.length === 0) return -1;

  // سهل — حركة عشوائية بالكامل
  if (difficulty === "easy") {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // متوسط — يدافع بس أحياناً يغلط (60% minimax / 40% عشوائي)
  if (difficulty === "medium") {
    if (Math.random() < 0.4) {
      return empty[Math.floor(Math.random() * empty.length)];
    }
  }

  // صعب (أو متوسط fallthrough) — minimax كامل
  let bestScore = -Infinity;
  let bestMove  = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === "") {
      board[i] = AI_SYMBOL;
      const score = minimaxTTT(board, 0, -Infinity, +Infinity, false);
      board[i] = "";
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
  }
  return bestMove;
}

// ── شاشة اختيار الصعوبة ────────────────────────────────────────
function buildDifficultyEmbed() {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("❌⭕ اكس اوه — ضد الذكاء الاصطناعي 🤖")
    .setDescription(
      "اختار مستوى الصعوبة:\n\n" +
      "🟢 **سهل** — AI بيلعب عشوائي، هتكسب بسهولة\n" +
      "🟡 **متوسط** — AI بيدافع أحياناً وأحياناً بيغلط\n" +
      "🔴 **صعب** — AI بيلعب بكامل قوته، صعب تكسبه"
    )
    .setTimestamp();
}

function buildDifficultyRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ttt_diff_easy_${gameId}`)
      .setLabel("🟢 سهل")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ttt_diff_medium_${gameId}`)
      .setLabel("🟡 متوسط")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ttt_diff_hard_${gameId}`)
      .setLabel("🔴 صعب")
      .setStyle(ButtonStyle.Danger),
  );
}

export async function handleTTTButton(interaction, db) {
  const id = interaction.customId;

  if (id.startsWith("ttt_accept_") || id.startsWith("ttt_decline_")) {
    const gameId = id.split("_").slice(2).join("_");
    const state  = tttGames.get(gameId);
    if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

    // لو اللعبة بدأت بالفعل — منع أي قبول أو رفض جديد
    if (state.phase !== "waiting") return interaction.reply({ content: "❌ اللعبة بدأت بالفعل!", flags: 64 });

    // تحدي مفتوح — أي حد غير اللي بدأ يقدر يقبل
    if (state.isOpen) {
      if (id.startsWith("ttt_decline_")) {
        if (interaction.user.id !== state.playerX) return interaction.reply({ content: "❌ مش إنت اللي بدأت التحدي!", flags: 64 });
        tttGames.delete(gameId);
        channelGames.delete(state.channelId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌⭕ التحدي اتلغى").setDescription("اللي بدأ التحدي ألغاه.")], components: [] });
      }
      if (interaction.user.id === state.playerX) return interaction.reply({ content: "❌ ما تقدرش تلعب ضد نفسك!", flags: 64 });
      state.playerO = interaction.user.id;
      state.isOpen  = false;
    } else {
      // تحدي محدد لشخص معين
      if (interaction.user.id !== state.playerO) return interaction.reply({ content: "❌ الدعوة مش إلك!", flags: 64 });
      if (id.startsWith("ttt_decline_")) {
        tttGames.delete(gameId);
        channelGames.delete(state.channelId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌⭕ رُفضت الدعوة").setDescription(`<@${state.playerO}> رفض يلعب 😢`)], components: [] });
      }
    }

    state.phase = "playing";
    const embed = buildTTTEmbed(state);
    const rows  = buildTTTRows(gameId, state);
    return interaction.update({ embeds: [embed], components: rows });
  }

  // ── زرار "ضد AI" من الـ waiting message ──────────────────────
  if (id.startsWith("ttt_vsai_")) {
    const gameId = id.split("_").slice(2).join("_");
    const state  = tttGames.get(gameId);
    if (!state || state.phase !== "waiting") {
      return interaction.reply({ content: "❌ اللعبة انتهت أو بدأت!", flags: 64 });
    }
    if (interaction.user.id !== state.playerX) {
      return interaction.reply({ content: "❌ بس اللي بدأ التحدي يقدر يختار مود الـ AI!", flags: 64 });
    }
    state.isAI   = true;
    state.playerO = AI_PLAYER_ID;
    state.phase  = "difficulty";
    state.isOpen = false;
    return interaction.update({ embeds: [buildDifficultyEmbed()], components: [buildDifficultyRow(gameId)] });
  }

  // ── اختيار مستوى الصعوبة ──────────────────────────────────────
  if (id.startsWith("ttt_diff_")) {
    const parts  = id.split("_");
    // format: ttt_diff_{level}_{gameId}
    const level  = parts[2];
    const gameId = parts.slice(3).join("_");
    const state  = tttGames.get(gameId);
    if (!state || state.phase !== "difficulty") {
      return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
    }
    if (interaction.user.id !== state.playerX) {
      return interaction.reply({ content: "❌ بس اللي بدأ اللعبة يقدر يختار الصعوبة!", flags: 64 });
    }
    state.difficulty = level;
    state.phase      = "playing";
    const diffLabel = { easy: "🟢 سهل", medium: "🟡 متوسط", hard: "🔴 صعب" }[level] ?? level;
    const embed = buildTTTEmbed(state);
    embed.setFooter({ text: `مستوى الصعوبة: ${diffLabel}` });
    return interaction.update({ embeds: [embed], components: buildTTTRows(gameId, state) });
  }

  if (id.startsWith("ttt_move_")) {
    const parts  = id.split("_");
    const gameId = parts.slice(2, parts.length - 1).join("_");
    const idx    = parseInt(parts[parts.length - 1]);
    const state  = tttGames.get(gameId);

    if (!state || state.winner) {
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x555).setTitle("❌⭕ اللعبة انتهت").setDescription("اللعبة اتنهت فعلاً! اضغط **لعبة جديدة** عشان تلعب تاني. 🔁")],
        components: [],
      }).catch(() => interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 }).catch(() => {}));
    }
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة ما بدأتش!", ephemeral: true });

    // ── قفل المعالجة المتزامنة ────────────────────────────────
    if (tttProcessing.has(gameId)) {
      return interaction.reply({ content: "⏳ لحظة — البوت بيعالج نقرة تانية دلوقتي!", flags: 64 });
    }
    tttProcessing.add(gameId);

    const currentPlayer = state.currentTurn === "X" ? state.playerX : state.playerO;
    if (interaction.user.id !== state.playerX && !state.isAI) {
      if (interaction.user.id !== currentPlayer) {
        tttProcessing.delete(gameId);
        return interaction.reply({ content: "❌ مش دورك!", ephemeral: true });
      }
    } else if (state.isAI) {
      if (interaction.user.id !== state.playerX) {
        tttProcessing.delete(gameId);
        return interaction.reply({ content: "❌ دي لعبتك إنت بس!", ephemeral: true });
      }
      if (state.currentTurn !== "X") {
        tttProcessing.delete(gameId);
        return interaction.reply({ content: "⏳ الذكاء الاصطناعي بيلعب دلوقتي!", ephemeral: true });
      }
    } else {
      if (interaction.user.id !== currentPlayer) {
        tttProcessing.delete(gameId);
        return interaction.reply({ content: "❌ مش دورك!", ephemeral: true });
      }
    }
    if (state.board[idx] !== "") {
      tttProcessing.delete(gameId);
      return interaction.reply({ content: "❌ الخانة دي محجوزة!", ephemeral: true });
    }

    // ── حركة اللاعب ──────────────────────────────────────────
    state.board[idx] = state.currentTurn;
    let result = checkTTTWinner(state.board);

    const finishGame = (winnerValue) => {
      state.winner = winnerValue;
      tttGames.delete(gameId);
      channelGames.delete(state.channelId);
      tttProcessing.delete(gameId);
    };

    if (result) {
      if (result === "draw") {
        finishGame("draw");
      } else {
        const winnerId = result === "X" ? state.playerX : (state.isAI ? AI_PLAYER_ID : state.playerO);
        finishGame(winnerId);
        if (!state.isAI && winnerId !== AI_PLAYER_ID) {
          db.updateUser(winnerId, { coins: (db.getUser(winnerId).coins || 0) + 150 });
        } else if (state.isAI && winnerId === state.playerX) {
          db.updateUser(state.playerX, { coins: (db.getUser(state.playerX).coins || 0) + 200 });
        }
      }
      const embed = buildTTTEmbed(state);
      const endRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(state.isAI ? `ttt_ai_rematch_${state.playerX}` : `ttt_rematch_${state.playerX}_${state.playerO}`)
          .setLabel("🔁 لعبة جديدة").setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ttt_exit_${state.channelId}`)
          .setLabel("🚪 خروج").setStyle(ButtonStyle.Secondary),
      );
      return interaction.update({ embeds: [embed], components: [endRow] });
    }

    // ── لو مفيش winner — بدّل الدور ──────────────────────────
    state.currentTurn = state.currentTurn === "X" ? "O" : "X";

    // ── لو AI ودوره — احسب الحركة فوراً وعمل update واحد بس ────
    if (state.isAI && state.currentTurn === "O") {
      const aiIdx = getAIMove(state.board, state.difficulty ?? "hard");
      if (aiIdx !== -1) {
        state.board[aiIdx] = AI_SYMBOL;
        result = checkTTTWinner(state.board);

        if (result) {
          if (result === "draw") {
            finishGame("draw");
          } else {
            finishGame(AI_PLAYER_ID);
          }
          const finalEmbed = buildTTTEmbed(state);
          const endRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ttt_ai_rematch_${state.playerX}`).setLabel("🔁 العب تاني").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ttt_exit_${state.channelId}`).setLabel("🚪 خروج").setStyle(ButtonStyle.Secondary),
          );
          tttProcessing.delete(gameId);
          return interaction.update({ embeds: [finalEmbed], components: [endRow] });
        }
        state.currentTurn = "X";
      }
      tttProcessing.delete(gameId);
      const finalEmbed = buildTTTEmbed(state);
      const finalRows  = buildTTTRows(gameId, state);
      return interaction.update({ embeds: [finalEmbed], components: finalRows });
    }

    tttProcessing.delete(gameId);
    const embed = buildTTTEmbed(state);
    const rows  = buildTTTRows(gameId, state);
    return interaction.update({ embeds: [embed], components: rows });
  }

  // ── إعادة اللعبة ضد AI ────────────────────────────────────────
  if (id.startsWith("ttt_ai_rematch_")) {
    const pX = id.replace("ttt_ai_rematch_", "");
    if (interaction.user.id !== pX)
      return interaction.reply({ content: "❌ دي لعبتك إنت بس!", flags: 64 });
    if (channelGames.has(interaction.channel.id))
      return interaction.reply({ content: "❌ في لعبة شغالة هنا!", flags: 64 });

    const newId = makeId();
    const newState = {
      id: newId, channelId: interaction.channel.id,
      playerX: pX, playerO: AI_PLAYER_ID,
      board: Array(9).fill(""), currentTurn: "X",
      winner: null, phase: "difficulty", isOpen: false, isAI: true,
    };
    tttGames.set(newId, newState);
    channelGames.set(interaction.channel.id, newId);
    return interaction.update({ embeds: [buildDifficultyEmbed()], components: [buildDifficultyRow(newId)] });
  }

  // ── إعادة اللعبة ضد لاعب ──────────────────────────────────────
  if (id.startsWith("ttt_rematch_")) {
    const p = id.replace("ttt_rematch_", "").split("_");
    const pX = p[0], pO = p[1];
    if (interaction.user.id !== pX && interaction.user.id !== pO)
      return interaction.reply({ content: "❌ مش في اللعبة دي!", flags: 64 });
    if (channelGames.has(interaction.channel.id))
      return interaction.reply({ content: "❌ في لعبة شغالة هنا!", flags: 64 });

    const newId = makeId();
    const newState = {
      id: newId, channelId: interaction.channel.id,
      playerX: pX, playerO: pO,
      board: Array(9).fill(""), currentTurn: "X",
      winner: null, phase: "playing", isOpen: false, isAI: false,
    };
    tttGames.set(newId, newState);
    channelGames.set(interaction.channel.id, newId);
    return interaction.update({ embeds: [buildTTTEmbed(newState)], components: buildTTTRows(newId, newState) });
  }

  // ── خروج ──────────────────────────────────────────────────────
  if (id.startsWith("ttt_exit_")) {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0x555).setTitle("❌⭕ انتهت اللعبة").setDescription("شكراً على اللعب! 👋")],
      components: [],
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  📦 تعريفات الأوامر للتصدير
// ══════════════════════════════════════════════════════════════
export const rouletteCommand = new SlashCommandBuilder()
  .setName("روليت")
  .setDescription("🔫 روليت روسية — آخر واحد يبقى يفوز!");

export const mafiaCommand = new SlashCommandBuilder()
  .setName("مافيا")
  .setDescription("🕵️ لعبة المافيا — مدنيون ضد المافيا!");

export const tttCommand = new SlashCommandBuilder()
  .setName("اكس-اوه")
  .setDescription("❌⭕ تيك تاك تو — العب ضد حد أو ضد الذكاء الاصطناعي!")
  .addUserOption(o => o.setName("خصم").setDescription("اختار خصمك (اتركه فاضي للعب ضد AI 🤖)").setRequired(false));

export const rpsCommand = new SlashCommandBuilder()
  .setName("حجر-ورقة-مقص-الخارقة")
  .setDescription("✂️ اختار أي حاجة في الكون والـ AI يحكم مين يفوز!")
  .addUserOption(o => o.setName("خصم").setDescription("اختار خصمك (اختياري — لو فاضي تحدي مفتوح)"));

// ══════════════════════════════════════════════════════════════
//  🪨 حجر ورقة مقص — العادية (كلاسيك)
// ══════════════════════════════════════════════════════════════
export const rpsBasicGames      = new Map();
export const rpsBasicChannelMap = new Map();
const rpsBasicId = () => `rpsb${Date.now().toString(36)}${Math.random().toString(36).slice(2,4)}`;

export const RPS_ICON  = { حجر: "🪨", ورقة: "📄", مقص: "✂️" };
export const RPS_BEATS = { حجر: "مقص", ورقة: "حجر", مقص: "ورقة" };

export const rpsBasicCommand = new SlashCommandBuilder()
  .setName("حجر-ورقة-مقص-العادية")
  .setDescription("🪨 تحدى حد في حجر ورقة مقص الكلاسيكي!")
  .addUserOption(o => o.setName("خصم").setDescription("اختار خصمك (اختياري)"));

export async function handleRPSBasicCommand(interaction) {
  const channelId = interaction.channel.id;
  if (rpsBasicChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة هنا — خلصوها الأول!", flags: 64 });

  const isButton  = interaction.isButton?.();
  const opponent  = isButton ? null : interaction.options?.getUser("خصم");
  if (!isButton && opponent) {
    if (opponent.id === interaction.user.id) return interaction.reply({ content: "❌ ما تعبش مع نفسك!", flags: 64 });
    if (opponent.bot) return interaction.reply({ content: "❌ ما تقدرش تلعب ضد بوت!", flags: 64 });
  }

  const gameId = rpsBasicId();
  const state  = {
    id: gameId, channelId,
    playerA: interaction.user.id,
    playerB: isButton ? null : (opponent?.id ?? null),
    choiceA: null, choiceB: null,
    phase: "waiting", messageId: null,
    isOpen: isButton || !opponent,
  };
  rpsBasicGames.set(gameId, state);
  rpsBasicChannelMap.set(channelId, gameId);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71).setTitle("🪨 حجر ورقة مقص — العادية!")
    .setDescription(
      state.isOpen
        ? `<@${interaction.user.id}> بيطلب لعبة حجر ورقة مقص!\n🟢 اضغط "قبول" عشان تلعب ضده!`
        : `<@${interaction.user.id}> بيتحداك يا <@${opponent.id}>!\nاضغط "قبول" أو "رفض"`
    ).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rpsb_accept_${gameId}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rpsb_decline_${gameId}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger),
  );

  const msg = await replyOrUpdate(interaction, { embeds: [embed], components: [row] });
  if (msg) state.messageId = msg.id;

  setTimeout(() => {
    if (rpsBasicGames.has(gameId) && rpsBasicGames.get(gameId).phase === "waiting") {
      rpsBasicGames.delete(gameId); rpsBasicChannelMap.delete(channelId);
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🪨 انتهت المهلة").setDescription("محدش قبل التحدي.")], components: [] }).catch(() => {});
    }
  }, 60_000);
}

export async function handleRPSBasicButton(interaction) {
  const id     = interaction.customId;
  const parts  = id.split("_");
  const action = parts[1];
  const gameId = parts.slice(2).join("_");
  const state  = rpsBasicGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  if (action === "accept" || action === "decline") {
    if (state.phase !== "waiting") return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.isOpen) {
      if (action === "decline") {
        if (interaction.user.id !== state.playerA) return interaction.reply({ content: "❌ مش إنت اللي بدأت!", flags: 64 });
        rpsBasicGames.delete(gameId); rpsBasicChannelMap.delete(state.channelId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🪨 تم الإلغاء").setDescription("اللعبة اتلغت.")], components: [] });
      }
      if (interaction.user.id === state.playerA) return interaction.reply({ content: "❌ ما تقدرش تلعب ضد نفسك!", flags: 64 });
      state.playerB = interaction.user.id;
    } else {
      if (interaction.user.id !== state.playerB) return interaction.reply({ content: "❌ الدعوة مش إلك!", flags: 64 });
      if (action === "decline") {
        rpsBasicGames.delete(gameId); rpsBasicChannelMap.delete(state.channelId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🪨 رُفض التحدي").setDescription(`<@${state.playerB}> رفض اللعبة.`)], components: [] });
      }
    }
    state.phase = "choosing";
    const chooseEmbed = new EmbedBuilder()
      .setColor(0x2ecc71).setTitle("🪨 حجر ورقة مقص — العادية")
      .setDescription(
        `<@${state.playerA}> 🆚 <@${state.playerB}>\n\n` +
        `اضغط الزرار واختار: 🪨 **حجر** / 📄 **ورقة** / ✂️ **مقص**\n` +
        `اختيارك **سري** لحد ما الاتنين يختاروا!\n` +
        `⏰ عندكم **2 دقيقة**`
      ).setTimestamp();
    const chooseRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rpsb_open_${gameId}`).setLabel("✏️ اختار حركتك").setStyle(ButtonStyle.Primary),
    );
    await interaction.update({ embeds: [chooseEmbed], components: [chooseRow] });

    setTimeout(() => {
      if (rpsBasicGames.has(gameId) && rpsBasicGames.get(gameId).phase === "choosing") {
        rpsBasicGames.delete(gameId); rpsBasicChannelMap.delete(state.channelId);
        interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🪨 انتهى الوقت").setDescription("محدش اختار في الوقت المحدد!")], components: [] }).catch(() => {});
      }
    }, 120_000);
    return;
  }

  if (action === "open") {
    if (state.phase !== "choosing") return interaction.reply({ content: "❌ مش وقت الاختيار!", flags: 64 });
    const uid = interaction.user.id;
    if (uid !== state.playerA && uid !== state.playerB)
      return interaction.reply({ content: "❌ إنت مش في اللعبة دي!", flags: 64 });
    const isA = uid === state.playerA;
    if (isA  && state.choiceA) return interaction.reply({ content: "✅ إنت بالفعل اخترت — بنستنى خصمك!", flags: 64 });
    if (!isA && state.choiceB) return interaction.reply({ content: "✅ إنت بالفعل اخترت — بنستنى خصمك!", flags: 64 });

    const modal = new ModalBuilder()
      .setCustomId(`rpsbasicmodal_${gameId}`)
      .setTitle("🪨 اختار حركتك!");
    const input = new TextInputBuilder()
      .setCustomId("choice")
      .setLabel("اكتب: حجر أو ورقة أو مقص")
      .setPlaceholder("حجر / ورقة / مقص")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }
}

// Handler موحد للأزرار
export async function handleGameButton(interaction, db) {
  const id = interaction.customId;
  if (id.startsWith("rlt_")) return handleRouletteButton(interaction, db);
  if (id.startsWith("maf_")) return handleMafiaButton(interaction, db);
  if (id.startsWith("ttt_")) return handleTTTButton(interaction, db);
  if (id.startsWith("rps_")) return handleRPSButton(interaction);
}

// ── إلغاء كل ألعاب يوزر معين عبر كل القنوات ──────────────────
export function cancelUserGames(userId) {
  let count = 0;
  for (const [gId, s] of rouletteGames) {
    if (s.creatorId === userId) {
      channelGames.delete(s.channelId);
      rouletteGames.delete(gId);
      count++;
    }
  }
  for (const [gId, s] of mafiaGames) {
    if (s.creatorId === userId) {
      if (s.timer) clearTimeout(s.timer);
      channelGames.delete(s.channelId);
      mafiaGames.delete(gId);
      count++;
    }
  }
  for (const [gId, s] of tttGames) {
    if (s.playerX === userId) {
      channelGames.delete(s.channelId);
      tttGames.delete(gId);
      count++;
    }
  }
  for (const [gId, s] of rpsGames) {
    if (s.playerA === userId) {
      rpsChannelMap.delete(s.channelId);
      rpsGames.delete(gId);
      count++;
    }
  }
  for (const [gId, s] of rpsBasicGames) {
    if (s.playerA === userId) {
      rpsBasicChannelMap.delete(s.channelId);
      rpsBasicGames.delete(gId);
      count++;
    }
  }
  return count;
}
