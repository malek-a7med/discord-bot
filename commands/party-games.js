// ═══════════════════════════════════════════════════════════════
//  🎉 Party Games — الهاتف المكسور + صنع الميم
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} from "discord.js";

// ══════════════════════════════════════════════════════════════
//  📞 الهاتف المكسور — Broken Phone
// ══════════════════════════════════════════════════════════════
export const garticGames      = new Map();
export const garticChannelMap = new Map();
const garticId = () => `gar${Date.now().toString(36)}${Math.random().toString(36).slice(2,3)}`;

const GARTIC_STARTER_HINTS = [
  "قطة بتقود سيارة في المطر", "فرعون بيلعب ببجي", "برج إيفل في الصحراء",
  "فيل بيحاول يدخل مترو", "شيف بيطبخ في الفضاء", "ديناصور بياكل حمص",
];

function createGarticState(channelId, creatorId) {
  return {
    id: garticId(), channelId, messageId: null,
    phase: "lobby", round: 0,
    players: [creatorId], creatorId,
    chains: {},
    assignments: {},
    pending: new Set(),
    timer: null,
  };
}

function buildGarticLobbyEmbed(state) {
  const hint = GARTIC_STARTER_HINTS[Math.floor(Math.random() * GARTIC_STARTER_HINTS.length)];
  return new EmbedBuilder()
    .setColor(0xe91e63).setTitle("📞 الهاتف المكسور — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ كل لاعب يكتب جملة ويبعتها\n` +
      `┣ التاني يشوف الجملة ويوصفها\n` +
      `┣ التالت يشوف الوصف ويخمن الجملة الأصلية\n` +
      `┗ في الأخر نشوف الفرق الكوميدي! 😂\n\n` +
      `💡 **مثال:** "${hint}"\n\n` +
      `👥 **اللاعبين (${state.players.length}/8):**\n${state.players.map(id => `• <@${id}>`).join("\n")}\n\n` +
      `⚠️ يلزم 3 لاعبين على الأقل`
    )
    .setFooter({ text: "انضم وابدأ الفوضى! 🎉" }).setTimestamp();
}

function buildGarticLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gar_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`gar_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`gar_realplay_${gameId}`).setLabel("🌐 لعب اللعبة الأصلية").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`gar_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function getAssignments(players, round) {
  const assignments = {};
  const n = players.length;
  if (round === 0) {
    players.forEach(p => { assignments[p] = p; });
  } else {
    players.forEach((p, i) => { assignments[p] = players[(i + round) % n]; });
  }
  return assignments;
}

function buildGarticRoundEmbed(state) {
  const types = ["اكتب جملة ابتدائية", "صف الجملة اللي شفتها", "خمن الجملة الأصلية"];
  const typeLabel = state.round < 3 ? types[state.round] : (state.round % 2 === 1 ? types[1] : types[2]);
  const done = state.players.length - state.pending.size;
  return new EmbedBuilder()
    .setColor(0xe91e63)
    .setTitle(`📞 الهاتف المكسور — الجولة ${state.round + 1}`)
    .setDescription(
      `**المطلوب:** ${typeLabel}\n\n` +
      `✅ بعتوا: **${done}/${state.players.length}**\n` +
      `⏳ لسه: ${[...state.pending].map(id => `<@${id}>`).join(", ") || "الكل بعت!"}\n\n` +
      `*اضغط "ارسل ردي" — هتجيك مهمتك في رسالة خاصة*`
    )
    .setFooter({ text: "لو ما بعتش في 3 دقايق، هياخد مهلة تلقائية" })
    .setTimestamp();
}

function buildGarticRoundRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gar_submit_${gameId}`).setLabel("✏️ ارسل ردي").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`gar_task_${gameId}`).setLabel("👁️ شوف مهمتي").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`gar_stop_${gameId}`).setLabel("⏹️ أنهِ اللعبة").setStyle(ButtonStyle.Danger),
  )];
}

async function advanceGarticRound(interaction, gameId, state) {
  const maxRounds = Math.min(state.players.length - 1, 4);
  state.round++;
  if (state.round > maxRounds) {
    return revealGarticChains(interaction, gameId, state);
  }
  state.assignments = getAssignments(state.players, state.round);
  state.pending = new Set(state.players);
  await sendGarticDMs(interaction.client, state);
  const embed = buildGarticRoundEmbed(state);
  const rows  = buildGarticRoundRows(gameId);
  await interaction.editReply({ embeds: [embed], components: rows });
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    if (!garticGames.has(gameId)) return;
    for (const pid of state.pending) {
      const ownerChain = state.assignments[pid];
      if (!state.chains[ownerChain]) state.chains[ownerChain] = [];
      state.chains[ownerChain].push({ type: state.round % 2 === 1 ? "description" : "guess", text: "⏰ انتهى الوقت — لم يرسل", authorId: pid });
    }
    state.pending.clear();
    await advanceGarticRound(interaction, gameId, state).catch(() => {});
  }, 3 * 60 * 1000);
}

async function sendGarticDMs(client, state) {
  const typeLabel = state.round % 2 === 1
    ? "**وصّف** الجملة التالية (كأنك بتشرحها لحد ما يراها)"
    : "**خمّن** الجملة الأصلية من الوصف التالي";
  for (const pid of state.players) {
    const ownerChainId = state.assignments[pid];
    const chain = state.chains[ownerChainId] || [];
    const latest = chain[chain.length - 1];
    if (!latest) continue;
    try {
      const u = await client.users.fetch(pid);
      const embed = new EmbedBuilder()
        .setColor(0xe91e63).setTitle(`📞 الهاتف المكسور — الجولة ${state.round + 1}`)
        .setDescription(`**المطلوب:** ${typeLabel}\n\n**اللي شايفه:**\n> ${latest.text}\n\n*ارجع للشات واضغط "ارسل ردي"*`);
      await u.send({ embeds: [embed] });
    } catch {}
  }
}

async function revealGarticChains(interaction, gameId, state) {
  garticGames.delete(gameId);
  garticChannelMap.delete(state.channelId);

  const embeds = [
    new EmbedBuilder().setColor(0xe91e63).setTitle("📞 الهاتف المكسور — الكشف الكبير! 🎉")
      .setDescription("خلصت اللعبة! شوفوا إزاي الجمل اتغيرت 😂")
  ];

  for (const ownerId of state.players) {
    const chain = state.chains[ownerId] || [];
    if (chain.length === 0) continue;
    const lines = chain.map(entry => {
      const label = entry.type === "phrase" ? "📝 الجملة الأصلية" : entry.type === "description" ? "🎨 وصف" : "❓ تخمين";
      return `**${label}** (بقلم <@${entry.authorId}>):\n> ${entry.text}`;
    }).join("\n\n");
    embeds.push(new EmbedBuilder().setColor(0x9b59b6).setTitle(`🔗 سلسلة <@${ownerId}>`).setDescription(lines || "لا بيانات"));
    if (embeds.length >= 10) break;
  }

  const replayRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`replay_gar_${state.channelId}`).setLabel("🔄 لعبة هاتف مكسور جديدة").setStyle(ButtonStyle.Primary),
  );

  // عدّل الرسالة الأصلية بدل ما تمسحها وتبعت جديدة
  try {
    const ch  = interaction.channel ?? await interaction.client?.channels?.fetch(state.channelId).catch(() => null);
    const msg = ch ? await ch.messages.fetch(state.messageId).catch(() => null) : null;
    if (msg) {
      await msg.edit({ embeds: embeds.slice(0, 10), components: [replayRow] }).catch(() => {});
      return;
    }
    // fallback: لو الرسالة اتمسحت ابعت جديدة
    await ch?.send({ embeds: embeds.slice(0, 10), components: [replayRow] }).catch(() => {});
  } catch {
    await interaction.channel?.send({ embeds: embeds.slice(0, 10), components: [replayRow] }).catch(() => {});
  }
}

export const garticCommand = new SlashCommandBuilder()
  .setName("الهاتف-المكسور").setDescription("📞 الهاتف المكسور — سلسلة وصف وتخمين مضحكة");

export async function handleGarticCommand(interaction) {
  const channelId = interaction.channel.id;
  if (garticChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده!", flags: 64 });
  const state = createGarticState(channelId, interaction.user.id);
  garticGames.set(state.id, state);
  garticChannelMap.set(channelId, state.id);
  let msg;
  if (interaction.isButton?.()) {
    await interaction.update({ embeds: [buildGarticLobbyEmbed(state)], components: buildGarticLobbyRows(state.id) });
    msg = await interaction.fetchReply().catch(() => null);
  } else {
    msg = await interaction.reply({ embeds: [buildGarticLobbyEmbed(state)], components: buildGarticLobbyRows(state.id), fetchReply: true });
  }
  if (msg) state.messageId = msg.id;
  setTimeout(async () => {
    if (garticGames.has(state.id) && garticGames.get(state.id).phase === "lobby") {
      garticGames.delete(state.id); garticChannelMap.delete(channelId);
      const timeoutEmbed = new EmbedBuilder().setColor(0x555).setTitle("📞 انتهت مهلة اللوبي");
      if (state.messageId) {
        const ch = await interaction.client?.channels?.fetch(channelId).catch(() => null);
        const m  = ch ? await ch.messages.fetch(state.messageId).catch(() => null) : null;
        if (m) { m.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {}); return; }
      }
      interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  }, 10 * 60 * 1000);
}

export async function handleGarticButton(interaction) {
  const id = interaction.customId;
  const parts = id.split("_");
  const action = parts[1], gameId = parts.slice(2).join("_");
  const state = garticGames.get(gameId);

  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  if (action === "join") {
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= 8) return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    return interaction.update({ embeds: [buildGarticLobbyEmbed(state)], components: buildGarticLobbyRows(gameId) });
  }

  // لعب اللعبة الأصلية — أول افتح الموقع، بعدين ابعت رابط الدعوة
  if (action === "realplay") {
    return interaction.reply({
      flags: 64,
      embeds: [new EmbedBuilder()
        .setColor(0xe91e63)
        .setTitle("🌐 العب الهاتف المكسور الأصلي!")
        .setDescription("**الخطوات:**\n1️⃣ افتح الموقع واعمل روم جديد\n2️⃣ لما تاخد رابط الدعوة اضغط **📨 ابعت رابط الدعوة**\n3️⃣ الرابط هيتبعت للكل في الشات!")
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🎮 افتح الهاتف المكسور")
          .setURL("https://garticphone.com/ar")
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setCustomId(`gar_sendlink_${gameId}`)
          .setLabel("📨 ابعت رابط الدعوة")
          .setStyle(ButtonStyle.Primary),
      )],
    });
  }

  if (action === "sendlink") {
    const modal = new ModalBuilder()
      .setCustomId(`garplay_${gameId}`)
      .setTitle("🌐 لعب الهاتف المكسور الأصلي");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("invite_link")
        .setLabel("ابعت رابط الدعوة عشان الكل يدخل")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("مثال: https://garticphone.com/ar")
        .setMaxLength(300)
    ));
    return interaction.showModal(modal);
  }

  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", flags: 64 });
    if (state.timer) clearTimeout(state.timer);
    garticGames.delete(gameId); garticChannelMap.delete(state.channelId);
    await interaction.message.delete().catch(() => {});
    return interaction.reply({ content: "📞 تم إلغاء الهاتف المكسور!", flags: 64 });
  }

  if (action === "stop") {
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (state.timer) clearTimeout(state.timer);
    return revealGarticChains(interaction, gameId, state).catch(() =>
      interaction.reply({ content: "❌ حدث خطأ في عرض النتائج", flags: 64 })
    );
  }

  if (action === "start") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يبدأها!", flags: 64 });
    if (state.players.length < 3) return interaction.reply({ content: "❌ لازم 3 لاعبين على الأقل!", flags: 64 });

    state.phase = "playing";
    state.players.forEach(pid => { state.chains[pid] = []; });
    state.assignments = getAssignments(state.players, 0);
    state.pending = new Set(state.players);

    const hint = GARTIC_STARTER_HINTS[Math.floor(Math.random() * GARTIC_STARTER_HINTS.length)];
    for (const pid of state.players) {
      try {
        const u = await interaction.client.users.fetch(pid);
        await u.send(new EmbedBuilder().setColor(0xe91e63).setTitle("📞 الهاتف المكسور — الجولة 1!")
          .setDescription(`**مهمتك:** اكتب جملة أو موقف مضحك / غريب / خيالي\n\n💡 **مثال:** "${hint}"\n\n*ارجع للشات واضغط "ارسل ردي"*`)
          .setFooter({ text: "أكتر ما هي غريبة أحسن!" }));
      } catch {}
    }

    const embed = buildGarticRoundEmbed(state);
    const rows  = buildGarticRoundRows(gameId);
    await interaction.update({ embeds: [embed], components: rows });

    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      if (!garticGames.has(gameId)) return;
      for (const pid of state.pending) {
        state.chains[pid].push({ type: "phrase", text: "⏰ انتهى الوقت", authorId: pid });
      }
      state.pending.clear();
      await advanceGarticRound(interaction, gameId, state).catch(() => {});
    }, 3 * 60 * 1000);
    return;
  }

  if (action === "task") {
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (!state.pending.has(interaction.user.id)) return interaction.reply({ content: "✅ إنت بالفعل بعتت ردك!", flags: 64 });

    if (state.round === 0) {
      const hint = GARTIC_STARTER_HINTS[Math.floor(Math.random() * GARTIC_STARTER_HINTS.length)];
      return interaction.reply({ flags: 64, content: `📝 **مهمتك:** اكتب جملة مضحكة/غريبة!\n💡 مثال: "${hint}"\n\nاضغط "ارسل ردي".` });
    }
    const ownerChainId = state.assignments[interaction.user.id];
    const chain = state.chains[ownerChainId] || [];
    const latest = chain[chain.length - 1];
    if (!latest) return interaction.reply({ content: "❌ مفيش مهمة لك دلوقتي!", flags: 64 });
    const typeLabel = state.round % 2 === 1 ? "وصّف ما يلي" : "خمّن الجملة من الوصف";
    return interaction.reply({ flags: 64, content: `📋 **مهمتك:** ${typeLabel}\n\n> ${latest.text}\n\nاضغط "ارسل ردي".` });
  }

  if (action === "submit") {
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (!state.pending.has(interaction.user.id)) return interaction.reply({ content: "✅ إنت بالفعل بعتت ردك!", flags: 64 });

    const type = state.round === 0 ? "phrase" : state.round % 2 === 1 ? "description" : "guess";
    const label = type === "phrase" ? "اكتب جملتك هنا:" : type === "description" ? "وصّف ما رأيت:" : "خمّن الجملة الأصلية:";

    const modal = new ModalBuilder().setCustomId(`garmodal_${gameId}`).setTitle("📞 الهاتف المكسور");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("gar_input").setLabel(label).setStyle(TextInputStyle.Paragraph)
        .setRequired(true).setMaxLength(300).setMinLength(3)
        .setPlaceholder(type === "phrase" ? "اكتب أي حاجة — أكتر ما هي غريبة أحسن!" : "اكتب ردك هنا...")
    ));
    return interaction.showModal(modal);
  }
}

export async function handleGarticModal(interaction) {
  const gameId = interaction.customId.replace("garmodal_", "");
  const state  = garticGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
  if (!state.pending.has(interaction.user.id))
    return interaction.reply({ content: "✅ إنت بالفعل بعتت ردك!", flags: 64 });

  const text  = interaction.fields.getTextInputValue("gar_input").trim();
  const type  = state.round === 0 ? "phrase" : state.round % 2 === 1 ? "description" : "guess";
  const ownerId = state.round === 0 ? interaction.user.id : state.assignments[interaction.user.id];

  if (!state.chains[ownerId]) state.chains[ownerId] = [];
  state.chains[ownerId].push({ type, text, authorId: interaction.user.id });
  state.pending.delete(interaction.user.id);

  await interaction.reply({ content: "✅ تم استلام ردك!", flags: 64 });

  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [buildGarticRoundEmbed(state)], components: buildGarticRoundRows(gameId) }).catch(() => {});

  if (state.pending.size === 0) {
    if (state.timer) clearTimeout(state.timer);
    const fakeInteraction = { editReply: (x) => msg?.edit(x), client: interaction.client, channel: interaction.channel };
    await advanceGarticRound(fakeInteraction, gameId, state).catch(() => {});
  }
}

// مودال رابط دعوة الهاتف المكسور
export async function handleGarticInviteModal(interaction) {
  const gameId = interaction.customId.replace("garplay_", "");
  const state = garticGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت بالفعل!", flags: 64 });

  const link = (interaction.fields.getTextInputValue("invite_link") || "").trim();
  if (state.timer) clearTimeout(state.timer);
  garticGames.delete(gameId); garticChannelMap.delete(state.channelId);

  await interaction.message.delete().catch(() => {});
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xe91e63)
      .setTitle("🌐 روحوا العبوا الهاتف المكسور الأصلي!")
      .setDescription(`**${interaction.user.displayName}** بعت رابط الدعوة! 🎮\n*(اللعبة على البوت اتلغت)*\n\n🔗 **رابط الدعوة:** ${link}`)
      .setTimestamp()],
  });
}


// ══════════════════════════════════════════════════════════════
//  😂 صنع الميم — Make it Meme
//  البوت يبعت GIF في الخاص — اللاعب يتنقل ويختار — يكتب كابشن
// ══════════════════════════════════════════════════════════════
export const memeGames      = new Map();
export const memeChannelMap = new Map();
const memeId = () => `mm${Date.now().toString(36)}${Math.random().toString(36).slice(2,3)}`;

// قايمة GIFs أنيمي وجيمنج وكرتون
const MEME_TEMPLATES = [
  { title: "عندما تفتح الثلاجة للمرة العاشرة وتلاقي نفس الحاجات",          gif: "https://media.tenor.com/PXzKHHE6ZSUAAAAC/anime-shocked.gif" },
  { title: "عندما الأستاذ يقول 'الامتحان هيكون سهل جداً'",                  gif: "https://media.tenor.com/3n4beqGzHasAAAAC/anime-crying.gif" },
  { title: "عندما تقول 'دقيقة بس' ومر ساعتين",                             gif: "https://media.tenor.com/gKhOKPXGFzsAAAAC/anime-lazy.gif" },
  { title: "عندما تلاقي أكلة من الأكل اللي أخبأتها في الثلاجة اتاكلت",      gif: "https://media.tenor.com/1_-JNXJiBB0AAAAC/anime-angry.gif" },
  { title: "عندما البوت يرد أذكى من اللي توقعته",                           gif: "https://media.tenor.com/5xHNB9lVbF4AAAAC/surprised-anime.gif" },
  { title: "عندما تنسى تحل الواجب وتيجي تعمله في المدرسة",                 gif: "https://media.tenor.com/KBOl_9FvHFUAAAAC/anime-sweat.gif" },
  { title: "عندما تسمع صوت غريب في البيت في نص الليل",                      gif: "https://media.tenor.com/7MmtBCOFMhUAAAAC/scared-anime.gif" },
  { title: "عندما تحاول توضح فكرة بس ما حدش فاهمك",                         gif: "https://media.tenor.com/SoNubhwMq0MAAAAC/anime-exhausted.gif" },
  { title: "عندما تقوم من النوم وتلاقي إن الليلة جمعة",                     gif: "https://media.tenor.com/kPJAQzm3-sQAAAAC/anime-happy.gif" },
  { title: "عندما تبعت رسالة غلط على جروب العيلة",                          gif: "https://media.tenor.com/dR3OhOLPw4QAAAAC/anime-panic.gif" },
  { title: "عندما اللعبة تقفل وإنت لسه ما حفظتش",                          gif: "https://media.tenor.com/ys7JFIBf0HIAAAAC/anime-crying-sad.gif" },
  { title: "عندما تبدأ تذاكر وبعد 10 دقايق تلاقي نفسك في يوتيوب",          gif: "https://media.tenor.com/xhEHPfEXJuMAAAAC/anime-computer.gif" },
  { title: "لما تفوز في الجيم وترجع تموت من أول أسبوع",                     gif: "https://media.tenor.com/9nzOtGsS_WQAAAAC/gaming-win.gif" },
  { title: "لما تحاول تاخد آيتم نادر في لعبة وبتفضل تفوت",                  gif: "https://media.tenor.com/o2_QZ0aGAZAAAAAC/anime-gaming.gif" },
  { title: "لما البوس في اللعبة يتحول وحش فجأة",                            gif: "https://media.tenor.com/3LPq_A48PFQAAAAC/anime-scared-run.gif" },
  { title: "لما تكسب في اللعبة بعد ألف محاولة",                             gif: "https://media.tenor.com/vgMYRBHPpSsAAAAC/anime-victory.gif" },
  { title: "لما حد يقولك 'إنت أحسن من ده'",                                 gif: "https://media.tenor.com/8TJDaJpHJlEAAAAC/anime-blush.gif" },
  { title: "لما الإنترنت يبطأ وإنت في أحمس لحظة في اللعبة",                 gif: "https://media.tenor.com/lKxYQl-VkMIAAAAC/anime-rage.gif" },
  { title: "وجهك لما تصحى الساعة 6 الصبح ليوم مدرسة",                       gif: "https://media.tenor.com/kn1RkbNxkOAAAAAC/anime-sleepy.gif" },
  { title: "لما تلاقي 20 جنيه في جيبك ما كنتش عارف بيهم",                  gif: "https://media.tenor.com/9r3y3CQAAKIAAAAC/anime-money.gif" },
  { title: "لما تحاول تنام بدري وجسمك يرفض",                               gif: "https://media.tenor.com/2LZ-ot4E1EUAAAAC/cant-sleep-anime.gif" },
  { title: "لما تكتب إيميل رسمي وتبعته غلط",                               gif: "https://media.tenor.com/IlvXLrqvT_MAAAAC/anime-oops.gif" },
  { title: "لما يسألوك 'إيه اللي بتعمله في حياتك؟'",                        gif: "https://media.tenor.com/Q5bVUPaFRrsAAAAC/anime-thinking.gif" },
  { title: "لما الاكل يجيلك ويبص أحلى مما كنت متوقع",                      gif: "https://media.tenor.com/FNGlQFNdCxYAAAAC/anime-food.gif" },
  { title: "لما صاحبك يبعتلك ميم الساعة 3 الصبح",                           gif: "https://media.tenor.com/Ef_OhBrkAF0AAAAC/anime-surprised-meme.gif" },
];

function createMemeState(channelId, creatorId) {
  return {
    id: memeId(), channelId, messageId: null,
    phase: "lobby",
    players: [creatorId], creatorId,
    captions: {},
    votes: {},
    timer: null,
    // تتبع GIF كل لاعب في DM
    playerTemplateIdx: {},  // { playerId: currentIdx }
    playerHistory: {},      // { playerId: [idx, idx, ...] }
    playerDmMsgId: {},      // { playerId: messageId in DM }
    playerDmChannelId: {},  // { playerId: DM channel ID }
  };
}

// اختار GIF عشوائي مختلف عن الحالي
function nextTemplate(currentIdx) {
  const next = Math.floor(Math.random() * MEME_TEMPLATES.length);
  if (MEME_TEMPLATES.length <= 1) return 0;
  return next === currentIdx ? (next + 1) % MEME_TEMPLATES.length : next;
}

function buildMemeLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0xf39c12).setTitle("😂 صنع الميم — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ لما اللعبة تبدأ البوت يبعتلك GIF أنيمي/جيمنج في الخاص\n` +
      `┣ تقدر تغير الـ GIF أو ترجع للقديم\n` +
      `┣ لما تختار الـ GIF اللي عاجبك اكتب كابشن مضحك عليه\n` +
      `┣ الكل يصوت على أحلى كابشن\n` +
      `┗ الفائز يكسب **200 كوينز** 🪙\n\n` +
      `👥 **اللاعبين (${state.players.length}/10):**\n${state.players.map(id => `• <@${id}>`).join("\n")}\n\n` +
      `⚠️ يلزم لاعبان على الأقل`
    )
    .setFooter({ text: "جهز نفسك للضحك! 😂" }).setTimestamp();
}

function buildMemeLobbyRows(gameId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`meme_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`meme_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`meme_realplay_${gameId}`).setLabel("🌐 لعب اللعبة الأصلية").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`meme_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
    ),
  ];
}

// بناء embed الـ DM للاعب
function buildPlayerDmEmbed(state, playerId) {
  const idx = state.playerTemplateIdx[playerId] ?? 0;
  const template = MEME_TEMPLATES[idx];
  const histLen  = (state.playerHistory[playerId] || []).length;
  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("😂 صنع الميم — اختار الـ GIF اللي عاجبك!")
    .setDescription(
      `**الموقف:** ${template.title}\n\n` +
      `*تقدر تغير الـ GIF أو ترجع للقديم — لما تختار اضغط "✍️ اكتب كابشن"*\n\n` +
      `📊 عندك ${histLen} GIF في السجل للرجوع ليه`
    )
    .setImage(template.gif)
    .setFooter({ text: `GIF رقم ${idx + 1} من ${MEME_TEMPLATES.length}` })
    .setTimestamp();
}

function buildPlayerDmRows(gameId, playerId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`meme_dm_back_${gameId}_${playerId}`)
      .setLabel("◀️ رجوع")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`meme_dm_change_${gameId}_${playerId}`)
      .setLabel("🔄 غير الـ GIF")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`meme_dm_caption_${gameId}_${playerId}`)
      .setLabel("✍️ اكتب كابشن وابعت")
      .setStyle(ButtonStyle.Success),
  )];
}

// إرسال DM لكل لاعب مع أول GIF
async function sendMemeDMs(client, state) {
  for (const pid of state.players) {
    const startIdx = Math.floor(Math.random() * MEME_TEMPLATES.length);
    state.playerTemplateIdx[pid] = startIdx;
    state.playerHistory[pid]     = [];
    try {
      const u = await client.users.fetch(pid);
      const dmMsg = await u.send({
        embeds: [buildPlayerDmEmbed(state, pid)],
        components: buildPlayerDmRows(state.id, pid),
      });
      state.playerDmMsgId[pid] = dmMsg.id;
      state.playerDmChannelId[pid] = dmMsg.channel.id;
    } catch {
      // لو ما قدرش يبعت DM، يضيف كابشن فارغ عشان ميوقفش اللعبة
      state.captions[pid] = "⚠️ ما قدرش يبعت DM";
    }
  }
}

function buildMemeCaptionEmbed(state) {
  const submitted = Object.keys(state.captions).length;
  return new EmbedBuilder()
    .setColor(0xf39c12).setTitle("😂 صنع الميم — اكتب كابشنك!")
    .setDescription(
      `**البوت بعتلك GIF في الخاص — روح اختار واكتب كابشنك!**\n\n` +
      `✅ **${submitted}/${state.players.length}** بعتوا كابشناتهم\n` +
      `⏱️ عندكم **90 ثانية**`
    )
    .setFooter({ text: "روح الـ DM — اختار GIF واكتب كابشن 📬" }).setTimestamp();
}

function buildMemeVoteEmbed(state) {
  const entries = Object.entries(state.captions);
  const list = entries.map(([pid, data], i) => {
    const tmpl = MEME_TEMPLATES[data.templateIdx ?? 0];
    return `**${i + 1}.** <@${pid}>\n> ${data.text}\n*(${tmpl?.title?.slice(0,40)}...)*`;
  }).join("\n\n");

  return new EmbedBuilder()
    .setColor(0xf39c12).setTitle("😂 صنع الميم — صوّت على أحلى كابشن!")
    .setDescription(
      `**الكابشنات:**\n${list || "لا يوجد!"}\n\n⏱️ التصويت ينتهي بعد 30 ثانية`
    )
    .setFooter({ text: "اضغط رقم الكابشن اللي أضحكك!" }).setTimestamp();
}

function buildMemeVoteRows(gameId, state) {
  const entries = Object.entries(state.captions);
  const btns = entries.slice(0, 5).map(([pid], i) =>
    new ButtonBuilder().setCustomId(`meme_vote_${gameId}_${pid}`).setLabel(`${i + 1}`).setStyle(ButtonStyle.Secondary)
  );
  if (btns.length === 0) return [];
  return [new ActionRowBuilder().addComponents(...btns)];
}

async function startMemeVoting(interaction, gameId, state) {
  state.phase = "voting";
  const embed = buildMemeVoteEmbed(state);
  const rows  = buildMemeVoteRows(gameId, state);
  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [embed], components: rows }).catch(() => {});
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => endMemeGame(interaction, gameId, state), 30 * 1000);
}

async function endMemeGame(interaction, gameId, state) {
  memeGames.delete(gameId); memeChannelMap.delete(state.channelId);

  const voteCounts = {};
  for (const targetId of Object.values(state.votes)) {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }

  const entries = Object.entries(state.captions);
  const sorted = entries
    .map(([pid, data]) => ({ pid, data, votes: voteCounts[pid] || 0 }))
    .sort((a, b) => b.votes - a.votes);

  const winner = sorted[0];
  const coins  = 200;

  const resultLines = sorted.map((e, i) => {
    const tmpl = MEME_TEMPLATES[e.data.templateIdx ?? 0];
    return `${i === 0 ? "🏆" : i === 1 ? "🥈" : "🥉"} ${i === 0 ? `**<@${e.pid}>**` : `<@${e.pid}>`}: **${e.votes} صوت**\n> ${e.data.text}\n*(${tmpl?.title?.slice(0,50)}...)*`;
  }).join("\n\n");

  const winnerTemplate = winner ? MEME_TEMPLATES[winner.data.templateIdx ?? 0] : null;

  const endEmbed = new EmbedBuilder()
    .setColor(0xf1c40f).setTitle("😂 صنع الميم — النتائج!")
    .setDescription(
      `${resultLines || "لا كابشنات!"}\n\n` +
      `${winner ? `🎉 <@${winner.pid}> فاز بـ **${coins} كوينز**! 🪙` : ""}`
    )
    .setTimestamp();

  // أضف صورة الفايز وزرار التنزيل
  const components = [];
  if (winnerTemplate) {
    endEmbed.setImage(winnerTemplate.gif);
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("⬇️ تنزيل الميم الفايز")
        .setURL(winnerTemplate.gif)
        .setStyle(ButtonStyle.Link)
    ));
  }

  components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`replay_meme_${state.channelId}`).setLabel("🔄 لعبة ميم جديدة").setStyle(ButtonStyle.Primary),
  ));

  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [endEmbed], components }).catch(() => {});

  return { winnerId: winner?.pid, coins };
}

export const memeCommand = new SlashCommandBuilder()
  .setName("صنع-الميم").setDescription("😂 صنع الميم — اكتب أحلى كابشن وفوز بالكوينز");

export async function handleMemeCommand(interaction) {
  const channelId = interaction.channel.id;
  if (memeChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده!", flags: 64 });
  const state = createMemeState(channelId, interaction.user.id);
  memeGames.set(state.id, state);
  memeChannelMap.set(channelId, state.id);
  let msg;
  if (interaction.isButton?.()) {
    await interaction.update({ embeds: [buildMemeLobbyEmbed(state)], components: buildMemeLobbyRows(state.id) });
    msg = await interaction.fetchReply().catch(() => null);
  } else {
    msg = await interaction.reply({ embeds: [buildMemeLobbyEmbed(state)], components: buildMemeLobbyRows(state.id), fetchReply: true });
  }
  if (msg) state.messageId = msg.id;
}

export async function handleMemeButton(interaction, db) {
  const id = interaction.customId;
  const parts = id.split("_");
  const action = parts[1];
  let gameId, targetId, playerId;

  if (action === "vote") {
    gameId = parts.slice(2, parts.length - 1).join("_");
    targetId = parts[parts.length - 1];
  } else if (action === "dm") {
    // meme_dm_{subaction}_{gameId}_{playerId}
    const subaction = parts[2];
    // gameId and playerId: need to handle compound IDs
    // format: meme_dm_change_{gameId}_{playerId}
    // playerId is the last segment, gameId is everything between subaction and playerId
    playerId = parts[parts.length - 1];
    gameId = parts.slice(3, parts.length - 1).join("_");
    return handleMemeDmButton(interaction, subaction, gameId, playerId, db);
  } else {
    gameId = parts.slice(2).join("_");
  }

  const state = memeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  // لعب اللعبة الأصلية — أول افتح الموقع، بعدين ابعت رابط الدعوة
  if (action === "realplay") {
    return interaction.reply({
      flags: 64,
      embeds: [new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle("🌐 العب صنع الميم الأصلي!")
        .setDescription("**الخطوات:**\n1️⃣ افتح الموقع واعمل روم جديد\n2️⃣ لما تاخد رابط الدعوة اضغط **📨 ابعت رابط الدعوة**\n3️⃣ الرابط هيتبعت للكل في الشات!")
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("😂 افتح صنع الميم")
          .setURL("https://makeitmeme.com")
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setCustomId(`meme_sendlink_${gameId}`)
          .setLabel("📨 ابعت رابط الدعوة")
          .setStyle(ButtonStyle.Primary),
      )],
    });
  }

  if (action === "sendlink") {
    const modal = new ModalBuilder()
      .setCustomId(`memeplay_${gameId}`)
      .setTitle("🌐 لعب صنع الميم الأصلي");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("invite_link")
        .setLabel("ابعت رابط الدعوة عشان الكل يدخل")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("مثال: https://makeitmeme.com")
        .setMaxLength(300)
    ));
    return interaction.showModal(modal);
  }

  if (action === "join") {
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= 10) return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    return interaction.update({ embeds: [buildMemeLobbyEmbed(state)], components: buildMemeLobbyRows(gameId) });
  }

  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", flags: 64 });
    if (state.timer) clearTimeout(state.timer);
    memeGames.delete(gameId); memeChannelMap.delete(state.channelId);
    await interaction.message.delete().catch(() => {});
    return interaction.reply({ content: "😂 تم إلغاء صنع الميم!", flags: 64 });
  }

  if (action === "start") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يبدأها!", flags: 64 });
    if (state.players.length < 2) return interaction.reply({ content: "❌ لازم لاعبان على الأقل!", flags: 64 });

    state.phase = "captioning";
    await interaction.update({ embeds: [buildMemeCaptionEmbed(state)], components: [] });

    // بعت DMs لكل لاعب
    await sendMemeDMs(interaction.client, state);

    // تحديث الرسالة عشان يظهر عدد اللي بعتوا
    const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [buildMemeCaptionEmbed(state)], components: [] }).catch(() => {});

    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => startMemeVoting(interaction, gameId, state), 90 * 1000);
    return;
  }

  if (action === "vote") {
    if (state.phase !== "voting") return interaction.reply({ content: "❌ وقت التصويت انتهى!", flags: 64 });
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (interaction.user.id === targetId) return interaction.reply({ content: "❌ ما تقدرش تصوت لنفسك!", flags: 64 });
    if (state.votes[interaction.user.id]) return interaction.reply({ content: "✅ صوتك اتسجل بالفعل!", flags: 64 });
    state.votes[interaction.user.id] = targetId;
    await interaction.reply({ content: "✅ صوتك اتسجل!", flags: 64 });

    const allVoted = state.players.filter(p => state.captions[p]).every(p => state.votes[p] || p === targetId);
    if (Object.keys(state.votes).length >= state.players.filter(p => state.captions[p]).length) {
      if (state.timer) clearTimeout(state.timer);
      const result = await endMemeGame(interaction, gameId, state);
      if (result?.winnerId && db) {
        const u = db.getUser(result.winnerId);
        u.coins = (u.coins || 0) + result.coins;
        db.updateUser(result.winnerId, u);
      }
    }
  }
}

// معالج أزرار الـ DM لصنع الميم
async function handleMemeDmButton(interaction, subaction, gameId, playerId, db) {
  // تحقق إن الضاغط هو صاحب الـ DM
  if (interaction.user.id !== playerId)
    return interaction.reply({ content: "❌ ده مش DM بتاعك!", flags: 64 });

  const state = memeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
  if (state.phase !== "captioning") return interaction.reply({ content: "❌ مش وقت اختيار الـ GIF دلوقتي!", flags: 64 });

  const currentIdx = state.playerTemplateIdx[playerId] ?? 0;
  const history    = state.playerHistory[playerId] ?? [];

  if (subaction === "change") {
    // حفظ الحالي في السجل وانتقل للتالي
    history.push(currentIdx);
    state.playerHistory[playerId] = history;
    state.playerTemplateIdx[playerId] = nextTemplate(currentIdx);
    return interaction.update({
      embeds: [buildPlayerDmEmbed(state, playerId)],
      components: buildPlayerDmRows(gameId, playerId),
    });
  }

  if (subaction === "back") {
    if (history.length === 0)
      return interaction.reply({ content: "❌ مفيش GIF قديم ترجع ليه!", flags: 64 });
    const prevIdx = history.pop();
    state.playerHistory[playerId] = history;
    state.playerTemplateIdx[playerId] = prevIdx;
    return interaction.update({
      embeds: [buildPlayerDmEmbed(state, playerId)],
      components: buildPlayerDmRows(gameId, playerId),
    });
  }

  if (subaction === "caption") {
    if (state.captions[playerId])
      return interaction.reply({ content: "✅ إنت بالفعل بعتت كابشنك!", flags: 64 });
    const idx = state.playerTemplateIdx[playerId] ?? 0;
    const tmpl = MEME_TEMPLATES[idx];
    const modal = new ModalBuilder()
      .setCustomId(`memedmmodal_${gameId}_${playerId}`)
      .setTitle("😂 صنع الميم — كابشنك");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("meme_caption_input")
        .setLabel(`الموقف: ${tmpl.title.slice(0, 40)}`)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true).setMaxLength(200)
        .setPlaceholder("اكتب كابشن مضحك...")
    ));
    return interaction.showModal(modal);
  }
}

export async function handleMemeModal(interaction, db) {
  // مودال كابشن DM
  if (interaction.customId.startsWith("memedmmodal_")) {
    const rest = interaction.customId.replace("memedmmodal_", "");
    const playerId = rest.split("_").pop();
    const gameId   = rest.split("_").slice(0, -1).join("_");

    const state = memeGames.get(gameId);
    if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
    if (state.captions[playerId]) return interaction.reply({ content: "✅ بعتت كابشنك بالفعل!", flags: 64 });

    const text = interaction.fields.getTextInputValue("meme_caption_input").trim();
    const templateIdx = state.playerTemplateIdx[playerId] ?? 0;
    state.captions[playerId] = { text, templateIdx };

    // تعطيل أزرار الـ DM
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ تم إرسال كابشنك!")
        .setDescription(`**كابشنك:** ${text}\n\nاستنى إجابات باقي اللاعبين وانتظر التصويت في الشات! 🗳️`)
        .setImage(MEME_TEMPLATES[templateIdx]?.gif)
      ],
      components: [],
    });

    // تحديث رسالة الشات
    try {
      const channelMsg = await interaction.client.channels.fetch(state.channelId)
        .then(ch => ch.messages.fetch(state.messageId)).catch(() => null);
      if (channelMsg) await channelMsg.edit({ embeds: [buildMemeCaptionEmbed(state)], components: [] }).catch(() => {});
    } catch {}

    // لو الكل بعت
    const submitted = Object.keys(state.captions).length;
    if (submitted >= state.players.length) {
      if (state.timer) clearTimeout(state.timer);
      const fakeChannel = await interaction.client.channels.fetch(state.channelId).catch(() => null);
      if (fakeChannel) {
        const fakeInteraction = {
          channel: fakeChannel,
          reply: () => {},
        };
        await startMemeVoting(fakeInteraction, gameId, state);
      }
    }
    return;
  }

  // مودال كابشن قديم (fallback)
  const gameId = interaction.customId.replace("mememodal_", "");
  const state  = memeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
  if (state.captions[interaction.user.id]) return interaction.reply({ content: "✅ بعتت كابشنك بالفعل!", flags: 64 });

  const text = interaction.fields.getTextInputValue("meme_caption_input").trim();
  state.captions[interaction.user.id] = { text, templateIdx: 0 };
  await interaction.reply({ content: `✅ كابشنك: **"${text}"**`, flags: 64 });

  const submitted = Object.keys(state.captions).length;
  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [buildMemeCaptionEmbed(state)], components: [] }).catch(() => {});

  if (submitted >= state.players.length) {
    if (state.timer) clearTimeout(state.timer);
    await startMemeVoting(interaction, gameId, state);
  }
}

// مودال رابط دعوة صنع الميم
export async function handleMemeInviteModal(interaction) {
  const gameId = interaction.customId.replace("memeplay_", "");
  const state = memeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت بالفعل!", flags: 64 });

  const link = (interaction.fields.getTextInputValue("invite_link") || "").trim();
  if (state.timer) clearTimeout(state.timer);
  memeGames.delete(gameId); memeChannelMap.delete(state.channelId);

  await interaction.message.delete().catch(() => {});
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("🌐 روحوا العبوا صنع الميم الأصلي!")
      .setDescription(`**${interaction.user.displayName}** بعت رابط الدعوة! 🎮\n*(اللعبة على البوت اتلغت)*\n\n🔗 **رابط الدعوة:** ${link}`)
      .setTimestamp()],
  });
}
