// ═══════════════════════════════════════════════════════════════
//  🎉 Party Games — جارتك فون + ميم جيم
//  جارتك فون: سلسلة وصف وتخمين | ميم جيم: أفضل كابشن يفوز
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} from "discord.js";

// ══════════════════════════════════════════════════════════════
//  📞 جارتك فون — Gartic Phone
// ══════════════════════════════════════════════════════════════
export const garticGames      = new Map();
export const garticChannelMap = new Map();
const garticId = () => `gar${Date.now().toString(36)}${Math.random().toString(36).slice(2,3)}`;

// أمثلة على جمل البداية لو اللاعب ما عندهوش أفكار
const GARTIC_STARTER_HINTS = [
  "قطة بتقود سيارة في المطر", "فرعون بيلعب ببجي", "برج إيفل في الصحراء",
  "فيل بيحاول يدخل مترو", "شيف بيطبخ في الفضاء", "ديناصور بياكل حمص",
];

function createGarticState(channelId, creatorId) {
  return {
    id: garticId(), channelId, messageId: null,
    phase: "lobby", round: 0,
    players: [creatorId], creatorId,
    chains: {}, // { ownerId: [{ type, text, authorId }] }
    assignments: {}, // { playerId: ownerChainId } — من بيشتغل على مين
    pending: new Set(), // اللاعبين اللي لسه ما بعتوش
    timer: null,
  };
}

function buildGarticLobbyEmbed(state) {
  const hint = GARTIC_STARTER_HINTS[Math.floor(Math.random() * GARTIC_STARTER_HINTS.length)];
  return new EmbedBuilder()
    .setColor(0xe91e63).setTitle("📞 جارتك فون — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ كل لاعب يكتب جملة ويبعتها\n` +
      `┣ التاني يشوف الجملة ويوصفها (زي ما لو بيرسمها)\n` +
      `┣ التالت يشوف الوصف ويخمن الجملة الأصلية\n` +
      `┗ في الأخر نشوف الفرق الكوميدي بين الأول والأخر! 😂\n\n` +
      `💡 **مثال على جملة:** "${hint}"\n\n` +
      `👥 **اللاعبين (${state.players.length}/8):**\n${state.players.map(id => `• <@${id}>`).join("\n")}\n\n` +
      `⚠️ يلزم 3 لاعبين على الأقل`
    )
    .setFooter({ text: "انضم وابدأ الفوضى! 🎉" }).setTimestamp();
}

function buildGarticLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gar_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`gar_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`gar_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function getAssignments(players, round) {
  // كل لاعب يشتغل على chain اللاعب اللي قبله (circular shift)
  const assignments = {};
  const n = players.length;
  if (round === 0) {
    players.forEach(p => { assignments[p] = p; }); // يكتبوا لأنفسهم
  } else {
    players.forEach((p, i) => {
      assignments[p] = players[(i + round) % n];
    });
  }
  return assignments;
}

function buildGarticRoundEmbed(state) {
  const types = ["اكتب جملة ابتدائية", "صف الجملة/الصورة اللي شفتها", "خمن الجملة الأصلية"];
  const typeLabel = state.round < 3 ? types[state.round] : (state.round % 2 === 1 ? types[1] : types[2]);
  const done = state.players.length - state.pending.size;
  return new EmbedBuilder()
    .setColor(0xe91e63)
    .setTitle(`📞 جارتك فون — الجولة ${state.round + 1}`)
    .setDescription(
      `**المطلوب:** ${typeLabel}\n\n` +
      `✅ بعتوا: **${done}/${state.players.length}**\n` +
      `⏳ لسه: ${[...state.pending].map(id => `<@${id}>`).join(", ") || "الكل بعت!"}\n\n` +
      `*اضغط على "ارسل ردي" — هيجيلك مهمتك في رسالة خاصة*`
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
  // تحقق عدد الجولات — نوقف بعد round لكل لاعب - 1 أو max 4 جولات
  const maxRounds = Math.min(state.players.length - 1, 4);
  state.round++;
  if (state.round > maxRounds) {
    return revealGarticChains(interaction, gameId, state);
  }
  state.assignments = getAssignments(state.players, state.round);
  state.pending = new Set(state.players);

  // بعت DM لكل لاعب عشان يعرف مهمته
  await sendGarticDMs(interaction.client, state);

  const embed = buildGarticRoundEmbed(state);
  const rows  = buildGarticRoundRows(gameId);
  await interaction.editReply({ embeds: [embed], components: rows });

  // مؤقت 3 دقايق — لو ما بعتوش نروح للجولة الجاية
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    if (!garticGames.has(gameId)) return;
    // اللاعبين اللي ما بعتوش — نحط لهم placeholder
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
  const typeLabel = state.round % 2 === 1 ? "**وصّف** الجملة/الصورة التالية (زي ما لو بتشرحها لحد ما يراها)" : "**خمّن** الجملة/الصورة الأصلية من الوصف التالي";

  for (const pid of state.players) {
    const ownerChainId = state.assignments[pid];
    const chain = state.chains[ownerChainId] || [];
    const latest = chain[chain.length - 1];
    if (!latest) continue;
    try {
      const u = await client.users.fetch(pid);
      const embed = new EmbedBuilder()
        .setColor(0xe91e63).setTitle(`📞 جارتك فون — مهمتك في الجولة ${state.round + 1}`)
        .setDescription(`**المطلوب:** ${typeLabel}\n\n**اللي شايفه:**\n> ${latest.text}\n\n*ارجع للشات واضغط "ارسل ردي" عشان تبعت ردك*`);
      await u.send({ embeds: [embed] });
    } catch {}
  }
}

async function revealGarticChains(interaction, gameId, state) {
  garticGames.delete(gameId);
  garticChannelMap.delete(state.channelId);

  const embeds = [
    new EmbedBuilder().setColor(0xe91e63).setTitle("📞 جارتك فون — الكشف الكبير! 🎉")
      .setDescription("خلصت اللعبة! شوفوا إزاي الجمل اتغيرت من أول وجديد 😂")
  ];

  for (const ownerId of state.players) {
    const chain = state.chains[ownerId] || [];
    if (chain.length === 0) continue;
    const lines = chain.map((entry, i) => {
      const label = entry.type === "phrase" ? "📝 الجملة الأصلية" : entry.type === "description" ? "🎨 وصف" : "❓ تخمين";
      return `**${label}** (بقلم <@${entry.authorId}>):\n> ${entry.text}`;
    }).join("\n\n");

    embeds.push(new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🔗 سلسلة <@${ownerId}>`)
      .setDescription(lines || "لا يوجد بيانات")
    );
    if (embeds.length >= 10) break;
  }

  await interaction.editReply({ embeds: embeds.slice(0, 10), components: [] }).catch(() => {});
}

export const garticCommand = new SlashCommandBuilder()
  .setName("جارتك-فون").setDescription("📞 جارتك فون — سلسلة وصف وتخمين مضحكة");

export async function handleGarticCommand(interaction) {
  const channelId = interaction.channel.id;
  if (garticChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده!", flags: 64 });
  const state = createGarticState(channelId, interaction.user.id);
  garticGames.set(state.id, state);
  garticChannelMap.set(channelId, state.id);
  const msg = await interaction.reply({ embeds: [buildGarticLobbyEmbed(state)], components: buildGarticLobbyRows(state.id), fetchReply: true });
  state.messageId = msg.id;
  setTimeout(() => {
    if (garticGames.has(state.id) && garticGames.get(state.id).phase === "lobby") {
      garticGames.delete(state.id); garticChannelMap.delete(channelId);
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("📞 جارتك فون — انتهت المهلة")], components: [] }).catch(() => {});
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

  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", flags: 64 });
    garticGames.delete(gameId); garticChannelMap.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("📞 تم إلغاء جارتك فون")], components: [] });
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
        await u.send(new EmbedBuilder().setColor(0xe91e63).setTitle("📞 جارتك فون — الجولة 1!")
          .setDescription(`**مهمتك:** اكتب جملة أو موقف مضحك / غريب / خيالي\n\n💡 **مثال للإلهام:** "${hint}"\n\n*ارجع للشات واضغط "ارسل ردي" عشان تبعت جملتك*`)
          .setFooter({ text: "اكتب أي حاجة — أكتر ما هو غريب أحسن!" }));
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
      return interaction.reply({ flags: 64, content: `📝 **مهمتك:** اكتب جملة أو موقف مضحك/غريب!\n💡 مثال للإلهام: "${hint}"\n\nاضغط "ارسل ردي" عشان تكتب.` });
    }
    const ownerChainId = state.assignments[interaction.user.id];
    const chain = state.chains[ownerChainId] || [];
    const latest = chain[chain.length - 1];
    if (!latest) return interaction.reply({ content: "❌ مفيش مهمة لك دلوقتي!", flags: 64 });
    const typeLabel = state.round % 2 === 1 ? "وصّف ما يلي (زي ما لو بتشرحه لحد ما يراه)" : "خمّن الجملة الأصلية من هذا الوصف";
    return interaction.reply({ flags: 64, content: `📋 **مهمتك:** ${typeLabel}\n\n> ${latest.text}\n\nاضغط "ارسل ردي" عشان تكتب ردك.` });
  }

  if (action === "submit") {
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (!state.pending.has(interaction.user.id)) return interaction.reply({ content: "✅ إنت بالفعل بعتت ردك!", flags: 64 });

    const type = state.round === 0 ? "phrase" : state.round % 2 === 1 ? "description" : "guess";
    const label = type === "phrase" ? "اكتب جملتك هنا:" : type === "description" ? "وصّف ما رأيت (كأنك تشرحه):" : "خمّن الجملة الأصلية:";

    const modal = new ModalBuilder().setCustomId(`garmodal_${gameId}`).setTitle("📞 جارتك فون — ردّك");
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

  // حدث الرسالة الرئيسية
  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [buildGarticRoundEmbed(state)], components: buildGarticRoundRows(gameId) }).catch(() => {});

  // لو الكل بعت — روح للجولة الجاية
  if (state.pending.size === 0) {
    if (state.timer) clearTimeout(state.timer);
    const fakeInteraction = { editReply: (x) => msg?.edit(x), client: interaction.client, channel: interaction.channel };
    await advanceGarticRound(fakeInteraction, gameId, state).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════
//  😂 ميم جيم — Make it Meme
// ══════════════════════════════════════════════════════════════
export const memeGames      = new Map();
export const memeChannelMap = new Map();
const memeId = () => `mm${Date.now().toString(36)}${Math.random().toString(36).slice(2,3)}`;

const MEME_TEMPLATES = [
  { title: "عندما تفتح الثلاجة للمرة العاشرة وتلاقي نفس الحاجات",      prompt: "وإنت بتفتحها..." },
  { title: "عندما الأستاذ يقول 'الامتحان هيكون سهل جداً'",              prompt: "وإنت لما بتشوف الأسئلة..." },
  { title: "عندما تقول 'دقيقة بس' ومر ساعتين",                         prompt: "وإنت لسه..." },
  { title: "عندما تلاقي أكلة من الأكل اللي أخبأتها في الثلاجة اتاكل",   prompt: "وجه الكارثة اللي بتعملها..." },
  { title: "عندما البوت يرد أذكى من اللي توقعته",                       prompt: "وجهك وإنت..." },
  { title: "عندما تنسى تحل الواجب وتيجي تعمله في المدرسة",             prompt: "وإنت..." },
  { title: "عندما تسمع صوت غريب في البيت في نص الليل",                  prompt: "أول حاجة تعملها..." },
  { title: "عندما تحاول توضح فكرة بس ما حدش فاهمك",                     prompt: "وإنت..." },
  { title: "عندما تقوم من النوم وتلاقي إن الليلة جمعة",                 prompt: "إنت قايل..." },
  { title: "عندما تبعت رسالة غلط على جروب العيلة",                      prompt: "وإنت بتحاول تمسحها..." },
  { title: "عندما اللعبة تقفل وإنت لسه ما حفظتش",                      prompt: "وجهك بعد الكارثة..." },
  { title: "عندما تبدأ تذاكر وبعد 10 دقايق تلاقي نفسك في يوتيوب",      prompt: "وإنت..." },
];

function createMemeState(channelId, creatorId) {
  const template = MEME_TEMPLATES[Math.floor(Math.random() * MEME_TEMPLATES.length)];
  return {
    id: memeId(), channelId, messageId: null,
    phase: "lobby", template,
    players: [creatorId], creatorId,
    captions: {}, // { playerId: text }
    votes: {}, // { voterId: targetPlayerId }
    timer: null,
  };
}

function buildMemeLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0xf39c12).setTitle("😂 ميم جيم — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ البوت يختار موقف مضحك\n` +
      `┣ كل لاعب يكتب **كابشن** مناسب للموقف\n` +
      `┣ الكل يصوت على أحلى كابشن\n` +
      `┗ الفائز يكسب **200 كوينز** 🪙\n\n` +
      `👥 **اللاعبين (${state.players.length}/10):**\n${state.players.map(id => `• <@${id}>`).join("\n")}\n\n` +
      `⚠️ يلزم لاعبان على الأقل`
    )
    .setFooter({ text: "جهز نفسك للضحك! 😂" }).setTimestamp();
}

function buildMemeLobbyRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`meme_join_${gameId}`).setLabel("➕ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`meme_start_${gameId}`).setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`meme_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  )];
}

function buildMemeCaptionEmbed(state) {
  const submitted = Object.keys(state.captions).length;
  return new EmbedBuilder()
    .setColor(0xf39c12).setTitle("😂 ميم جيم — اكتب كابشنك!")
    .setDescription(
      `**الموقف:**\n> 🎭 ${state.template.title}\n> *(${state.template.prompt})*\n\n` +
      `✅ **${submitted}/${state.players.length}** بعتوا كابشناتهم\n` +
      `⏱️ عندكم **60 ثانية** — اضغط "اكتب كابشنك" الآن!`
    )
    .setFooter({ text: "أضحك وحلل! 🤣" }).setTimestamp();
}

function buildMemeCaptionRows(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`meme_caption_${gameId}`).setLabel("✏️ اكتب كابشنك").setStyle(ButtonStyle.Primary),
  )];
}

function buildMemeVoteEmbed(state) {
  const captionEntries = Object.entries(state.captions);
  const captionsList = captionEntries.map(([pid, text], i) =>
    `**${i + 1}.** ${text}`
  ).join("\n\n");

  return new EmbedBuilder()
    .setColor(0xf39c12).setTitle("😂 ميم جيم — صوّت على أحلى كابشن!")
    .setDescription(
      `**الموقف:** 🎭 ${state.template.title}\n\n` +
      `**الكابشنات:**\n${captionsList || "لا يوجد كابشنات!"}\n\n` +
      `⏱️ التصويت ينتهي بعد 30 ثانية`
    )
    .setFooter({ text: "اضغط على رقم الكابشن اللي أضحكك أكتر!" }).setTimestamp();
}

function buildMemeVoteRows(gameId, state) {
  const captionEntries = Object.entries(state.captions);
  const btns = captionEntries.slice(0, 5).map(([pid], i) =>
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

  const captionEntries = Object.entries(state.captions);
  const sorted = captionEntries
    .map(([pid, text]) => ({ pid, text, votes: voteCounts[pid] || 0 }))
    .sort((a, b) => b.votes - a.votes);

  const winner = sorted[0];
  const winnerMention = winner ? `<@${winner.pid}>` : "لا أحد";
  const coins = 200;

  // ده بحتاج db — هبعته كـ event بدل ما أحتاجه هنا
  // الـ coins بتنضاف في index.js لما تيجي النتيجة

  const resultLines = sorted.map((e, i) =>
    `${i === 0 ? "🏆" : i === 1 ? "🥈" : "🥉"} ${i === 0 ? `**${winnerMention}**` : `<@${e.pid}>`}: ${e.votes} صوت\n> ${e.text}`
  ).join("\n\n");

  const endEmbed = new EmbedBuilder()
    .setColor(0xf1c40f).setTitle("😂 ميم جيم — النتائج!")
    .setDescription(
      `**الموقف:** 🎭 ${state.template.title}\n\n` +
      `${resultLines || "لا توجد كابشنات!"}\n\n` +
      `${winner ? `🎉 ${winnerMention} فاز بـ **${coins} كوينز**! 🪙` : ""}`
    )
    .setTimestamp();

  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});

  // إرجاع winner id والكوينز عشان index.js يضيفهم
  return { winnerId: winner?.pid, coins };
}

export const memeCommand = new SlashCommandBuilder()
  .setName("ميم-جيم").setDescription("😂 ميم جيم — اكتب أحلى كابشن وفوز بالكوينز");

export async function handleMemeCommand(interaction) {
  const channelId = interaction.channel.id;
  if (memeChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده!", flags: 64 });
  const state = createMemeState(channelId, interaction.user.id);
  memeGames.set(state.id, state);
  memeChannelMap.set(channelId, state.id);
  const msg = await interaction.reply({ embeds: [buildMemeLobbyEmbed(state)], components: buildMemeLobbyRows(state.id), fetchReply: true });
  state.messageId = msg.id;
}

export async function handleMemeButton(interaction, db) {
  const id = interaction.customId;
  const parts = id.split("_");
  const action = parts[1];
  let gameId, targetId;

  if (action === "vote") {
    gameId = parts.slice(2, parts.length - 1).join("_");
    targetId = parts[parts.length - 1];
  } else {
    gameId = parts.slice(2).join("_");
  }

  const state = memeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  if (action === "join") {
    if (state.phase !== "lobby") return interaction.reply({ content: "❌ اللعبة بدأت!", flags: 64 });
    if (state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت بالفعل في اللعبة!", flags: 64 });
    if (state.players.length >= 10) return interaction.reply({ content: "❌ اللعبة امتلأت!", flags: 64 });
    state.players.push(interaction.user.id);
    return interaction.update({ embeds: [buildMemeLobbyEmbed(state)], components: buildMemeLobbyRows(gameId) });
  }

  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", flags: 64 });
    memeGames.delete(gameId); memeChannelMap.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("😂 تم إلغاء ميم جيم")], components: [] });
  }

  if (action === "start") {
    if (state.creatorId !== interaction.user.id) return interaction.reply({ content: "❌ اللي عملها بس يبدأها!", flags: 64 });
    if (state.players.length < 2) return interaction.reply({ content: "❌ لازم لاعبان على الأقل!", flags: 64 });
    state.phase = "captioning";
    await interaction.update({ embeds: [buildMemeCaptionEmbed(state)], components: buildMemeCaptionRows(gameId) });

    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => startMemeVoting(interaction, gameId, state), 60 * 1000);
    return;
  }

  if (action === "caption") {
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (state.captions[interaction.user.id]) return interaction.reply({ content: "✅ إنت بالفعل بعتت كابشنك!", flags: 64 });
    const modal = new ModalBuilder().setCustomId(`mememodal_${gameId}`).setTitle("😂 ميم جيم — كابشنك");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("meme_caption_input")
        .setLabel(`الموقف: ${state.template.title.slice(0, 40)}...`)
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(200)
        .setPlaceholder(`${state.template.prompt} اكتب كابشنك هنا...`)
    ));
    return interaction.showModal(modal);
  }

  if (action === "vote") {
    if (state.phase !== "voting") return interaction.reply({ content: "❌ وقت التصويت انتهى!", flags: 64 });
    if (!state.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ إنت مش في اللعبة!", flags: 64 });
    if (interaction.user.id === targetId) return interaction.reply({ content: "❌ ما تقدرش تصوت لنفسك!", flags: 64 });
    if (state.votes[interaction.user.id]) return interaction.reply({ content: "✅ صوتك اتسجل بالفعل!", flags: 64 });
    state.votes[interaction.user.id] = targetId;
    await interaction.reply({ content: "✅ صوتك اتسجل!", flags: 64 });

    if (Object.keys(state.votes).length >= state.players.filter(p => !state.captions[p] || state.captions[p]).length) {
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

export async function handleMemeModal(interaction, db) {
  const gameId = interaction.customId.replace("mememodal_", "");
  const state  = memeGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
  if (state.captions[interaction.user.id]) return interaction.reply({ content: "✅ بعتت كابشنك بالفعل!", flags: 64 });

  const text = interaction.fields.getTextInputValue("meme_caption_input").trim();
  state.captions[interaction.user.id] = text;
  await interaction.reply({ content: `✅ كابشنك اتحفظ: **"${text}"**`, flags: 64 });

  const submitted = Object.keys(state.captions).length;
  const msg = await interaction.channel.messages.fetch(state.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [buildMemeCaptionEmbed(state)], components: buildMemeCaptionRows(gameId) }).catch(() => {});

  if (submitted >= state.players.length) {
    if (state.timer) clearTimeout(state.timer);
    await startMemeVoting(interaction, gameId, state);
  }
}
