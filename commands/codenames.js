// ═══════════════════════════════════════════════════════════════
//  🃏 كود نيمز — Codenames Arabic Edition
//  25 كلمة | فريقين (أحمر/أزرق) | قائد سري | لوحة 5×5 أزرار
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";

export const codenamesGames  = new Map();
export const cdnChannelGames = new Map();

const makeId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2,4)}`;

const WORD_LIST = [
  "أسد","نمر","ثعلب","غزال","صقر","ذئب","قرد","تمساح","فيل","دب",
  "تمر","عسل","رمان","خوخ","مانجو","بطيخ","موز","فراولة","تفاح","عنب",
  "نيل","بحر","جبل","صحراء","واحة","قلعة","بئر","نهر","قرية","مدينة",
  "مفتاح","قفل","درع","سيف","قوس","نار","صخرة","ريح","برق","مطر",
  "طيران","قفز","سباحة","جري","صيد","قتال","رقص","غناء","بكاء","ضحك",
  "سر","حلم","خوف","عشق","نور","ظلام","حكمة","شجاعة","أمانة","غدر",
  "قمر","شمس","نجم","سماء","غيوم","عاصفة","فجر","كوكب","مجرة","هواء",
  "فرعون","هرم","خليفة","سلطان","قبيلة","رحلة","كنز","مومياء","ملك","أمير",
  "ساعة","مرآة","عجلة","سفينة","خيمة","فانوس","خنجر","بوق","درج","نافذة",
  "طائر","سمكة","ضفدع","فراشة","نحلة","عقرب","حصان","جمل","كلب","قطة",
  "كتاب","قلم","ورقة","طاولة","كرسي","باب","سقف","أرض","حائط","برج",
  "طريق","جسر","ميناء","مطار","قطار","سيارة","دراجة","قارب","طائرة","صاروخ",
  "موسيقى","أغنية","رقصة","مسرح","فيلم","قصة","شعر","لوحة","تمثال","صورة",
  "ثلج","رمل","حجر","طمي","خشب","حديد","ذهب","فضة","نحاس","ماس",
  "لؤلؤة","مرجان","ياقوت","زمرد","صدف","حرير","قطن","صوف","جلد","حرارة",
  "ملح","سكر","قهوة","شاي","حليب","دقيق","عجين","فرن","مطبخ","وليمة",
  "حرب","سلام","ثورة","حصار","معركة","غزو","نصر","هزيمة","اتفاق","خيانة",
  "علم","فلسفة","رياضيات","طب","قانون","تجارة","زراعة","صناعة","بناء","هندسة",
  "بحيرة","خليج","جزيرة","شلال","برية","حديقة","غابة","سهل","هضبة","وادي",
  "وحش","مارد","غول","تنين","عنقاء","أسطورة","سحر","لغز","معجزة","قدر",
];

function pickWords()  { return [...WORD_LIST].sort(() => Math.random() - 0.5).slice(0, 25); }
function assignColors() {
  return [...Array(9).fill("red"), ...Array(8).fill("blue"), ...Array(7).fill("neutral"), "assassin"]
    .sort(() => Math.random() - 0.5);
}

function createState(channelId, creatorId) {
  const words = pickWords(), colors = assignColors();
  return {
    id: makeId(), channelId, messageId: null,
    phase: "lobby", turn: "red",
    words, colors, revealed: Array(25).fill(false),
    redTotal: 9, blueTotal: 8, redFound: 0, blueFound: 0, clue: null,
    red:  { spymaster: null, agents: [] },
    blue: { spymaster: null, agents: [] },
    creatorId, allPlayers: [creatorId],
  };
}

function buildBoardRows(gameId, state) {
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const btns = [];
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      const word = state.words[idx], color = state.colors[idx], rev = state.revealed[idx];
      let style = ButtonStyle.Secondary, label = word;
      if (rev) {
        style = color === "blue" ? ButtonStyle.Primary : ButtonStyle.Danger;
        label = color === "assassin" ? `💀${word}` : `✓${word}`;
      }
      btns.push(new ButtonBuilder().setCustomId(`cdn_g_${gameId}_${idx}`).setLabel(label.slice(0,25)).setStyle(style).setDisabled(rev));
    }
    rows.push(new ActionRowBuilder().addComponents(...btns));
  }
  return rows;
}

function buildSpymasterMap(state) {
  const emoji = { red:"🔴", blue:"🔵", neutral:"⬜", assassin:"💀" };
  let grid = "";
  for (let r = 0; r < 5; r++) {
    const parts = [];
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      parts.push(`${emoji[state.colors[idx]]}${state.words[idx]}`);
    }
    grid += parts.join(" | ") + "\n";
  }
  return grid;
}

function fmtTeam(state, team) {
  const lines = [];
  if (state[team].spymaster) lines.push(`👑 <@${state[team].spymaster}> (قائد)`);
  state[team].agents.forEach(id => lines.push(`🎮 <@${id}>`));
  return lines.join("\n") || "*فارغ*";
}

function buildLobbyEmbed(state) {
  return new EmbedBuilder()
    .setColor(0x9b59b6).setTitle("🃏 كود نيمز — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ 25 كلمة على اللوحة — كل فريق له كلمات مخفية\n` +
      `┣ **القائد** يكتب في الشات: \`كلمة رقم\` (مثال: \`حيوان 3\`)\n` +
      `┣ **اللاعبون** يضغطوا على الكلمات للتخمين\n` +
      `┣ الكلمة الصح = استمر | المحايدة = دور الخصم | خصم = يأخذ النقطة\n` +
      `┗ الكلمة القاتلة 💀 = تخسر فوراً!\n\n` +
      `⚠️ **متطلبات:** قائد + لاعب واحد لكل فريق`
    )
    .addFields(
      { name: "🔴 الأحمر — 9 كلمات", value: fmtTeam(state,"red"), inline: true },
      { name: "🔵 الأزرق — 8 كلمات", value: fmtTeam(state,"blue"), inline: true }
    )
    .setFooter({ text: "الأحمر يبدأ أول بحكم عنده كلمة زيادة" }).setTimestamp();
}

function buildLobbyRows(gameId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cdn_red_${gameId}`).setLabel("🔴 لاعب أحمر").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cdn_blue_${gameId}`).setLabel("🔵 لاعب أزرق").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cdn_redspy_${gameId}`).setLabel("👑 قائد أحمر").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cdn_bluespy_${gameId}`).setLabel("👑 قائد أزرق").setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cdn_start_${gameId}`).setLabel("▶️ ابدأ اللعبة").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`cdn_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cdn_realplay_${gameId}`).setLabel("🌐 لعب اللعبة الأصلية").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildGameEmbed(state) {
  const cur = state.turn === "red" ? "🔴 الأحمر" : "🔵 الأزرق";
  const spy = state[state.turn].spymaster;
  const clueText = state.clue
    ? `📢 **الإشارة:** \`${state.clue.word}\` — **${state.clue.count}** كلمات (متبقي: ${state.clue.remaining})`
    : `⏳ القائد <@${spy ?? "؟"}> يكتب الإشارة الآن\n*في الشات: \`كلمة رقم\` — مثال: \`حيوان 3\`*`;
  return new EmbedBuilder()
    .setColor(state.turn === "red" ? 0xe74c3c : 0x3498db)
    .setTitle(`🃏 كود نيمز — دور ${cur}`)
    .setDescription(`${clueText}\n\n🔴 ${state.redFound}/${state.redTotal}  •  🔵 ${state.blueFound}/${state.blueTotal}`)
    .setFooter({ text: state.clue ? "اضغط الكلمة اللي تعتقد إنها صحيحة" : "القائد بس يكتب الإشارة" })
    .setTimestamp();
}

function addSkipRow(gameId, rows) {
  if (rows.length >= 5) return rows;
  return [...rows, new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cdn_skip_${gameId}`).setLabel("⏭️ تخطي الدور").setStyle(ButtonStyle.Secondary)
  )];
}

// ── الأمر ─────────────────────────────────────────────────────
export const codenamesCommand = new SlashCommandBuilder()
  .setName("كود-نيمز").setDescription("🃏 لعبة كود نيمز — فريقين يخمنوا الكلمات السرية");

export async function handleCodenamesCommand(interaction) {
  const channelId = interaction.channel.id;
  if (cdnChannelGames.has(channelId))
    return interaction.reply({ content: "❌ في لعبة شغالة في الروم ده!", flags: 64 });
  const state = createState(channelId, interaction.user.id);
  codenamesGames.set(state.id, state);
  cdnChannelGames.set(channelId, state.id);
  const msg = await interaction.reply({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(state.id), fetchReply: true });
  state.messageId = msg.id;
  setTimeout(() => {
    if (codenamesGames.has(state.id) && codenamesGames.get(state.id).phase === "lobby") {
      codenamesGames.delete(state.id); cdnChannelGames.delete(channelId);
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🃏 كود نيمز — انتهت المهلة")], components: [] }).catch(() => {});
    }
  }, 10 * 60 * 1000);
}

// ── معالج الأزرار ─────────────────────────────────────────────
export async function handleCodenamesButton(interaction) {
  const id = interaction.customId;
  const parts = id.split("_");

  let gameId, action, extra;
  if (id.startsWith("cdn_g_")) {
    gameId = parts.slice(2, parts.length - 1).join("_");
    action = "guess"; extra = parseInt(parts[parts.length - 1]);
  } else {
    action = parts[1]; gameId = parts.slice(2).join("_");
  }

  const state = codenamesGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  if (action === "red" || action === "blue") {
    const team = action, other = team === "red" ? "blue" : "red";
    state[other].agents = state[other].agents.filter(x => x !== interaction.user.id);
    if (state[other].spymaster === interaction.user.id) state[other].spymaster = null;
    if (!state[team].agents.includes(interaction.user.id) && state[team].spymaster !== interaction.user.id)
      state[team].agents.push(interaction.user.id);
    if (!state.allPlayers.includes(interaction.user.id)) state.allPlayers.push(interaction.user.id);
    return interaction.update({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  }

  if (action === "redspy" || action === "bluespy") {
    const team = action === "redspy" ? "red" : "blue", other = team === "red" ? "blue" : "red";
    state[other].agents = state[other].agents.filter(x => x !== interaction.user.id);
    if (state[other].spymaster === interaction.user.id) state[other].spymaster = null;
    state[team].agents = state[team].agents.filter(x => x !== interaction.user.id);
    state[team].spymaster = interaction.user.id;
    if (!state.allPlayers.includes(interaction.user.id)) state.allPlayers.push(interaction.user.id);
    return interaction.update({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  }

  if (action === "realplay") {
    codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🌐 روحوا العبوا كود نيمز الأصلي!")
        .setDescription(`**${interaction.user.displayName}** قرر يلعبوا اللعبة الأصلية!\n\n*(اللعبة على البوت اتلغت تلقائياً — اضغط الزرار جنب ده)*`)
        .setTimestamp()
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🌐 افتح كود نيمز الأصلي").setURL("https://codenames.game/").setStyle(ButtonStyle.Link)
      )],
    });
  }

  if (action === "cancel") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", flags: 64 });
    codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🃏 تم إلغاء كود نيمز")], components: [] });
  }

  if (action === "start") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ اللي عملها بس يبدأها!", flags: 64 });
    if (!state.red.spymaster || !state.blue.spymaster)
      return interaction.reply({ content: "❌ كل فريق لازم عنده قائد!", flags: 64 });
    if (state.red.agents.length < 1 || state.blue.agents.length < 1)
      return interaction.reply({ content: "❌ كل فريق لازم عنده لاعب واحد على الأقل!", flags: 64 });

    state.phase = "playing";
    const spyMap = buildSpymasterMap(state);
    const spyEmbed = new EmbedBuilder().setColor(0x9b59b6).setTitle("👑 خريطة القائد السرية!")
      .setDescription(
        `**دورك:** اكتب في الشات العام: \`كلمة رقم\`\n` +
        `**مثال:** \`طبيعة 2\` — يعني 2 كلمات من فريقك عن الطبيعة\n\n` +
        `**قواعد الإشارة:**\n` +
        `• كلمة واحدة فقط — ممنوع مركبة\n` +
        `• ممنوع تستخدم كلمة موجودة على اللوحة\n` +
        `• الرقم = عدد الكلمات اللي بيخمنوها\n\n` +
        `**🗺️ خريطتك:**\n\`\`\`\n${spyMap}\`\`\`\n` +
        `🔴 أحمر | 🔵 أزرق | ⬜ محايد | 💀 **قاتل — لا تقترب!**`
      );

    for (const spyId of [state.red.spymaster, state.blue.spymaster]) {
      try { const u = await interaction.client.users.fetch(spyId); await u.send({ embeds: [spyEmbed] }); } catch {}
    }
    for (const uid of state.red.agents) {
      try { const u = await interaction.client.users.fetch(uid); await u.send(`🔴 **إنت في الفريق الأحمر في كود نيمز!**\nاخمن الكلمات اللي بيشير ليها قائدك في الشات — اضغط عليها في الروم!\n💡 كلمة صح = تكمل | محايدة = دورك انتهى | خصم = بيكسبوا نقطة | 💀 قاتل = تخسروا فوراً!`); } catch {}
    }
    for (const uid of state.blue.agents) {
      try { const u = await interaction.client.users.fetch(uid); await u.send(`🔵 **إنت في الفريق الأزرق في كود نيمز!**\nاخمن الكلمات اللي بيشير ليها قائدك في الشات — اضغط عليها في الروم!\n💡 كلمة صح = تكمل | محايدة = دورك انتهى | خصم = بيكسبوا نقطة | 💀 قاتل = تخسروا فوراً!`); } catch {}
    }
    return interaction.update({ embeds: [buildGameEmbed(state)], components: buildBoardRows(gameId, state) });
  }

  if (action === "g") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    const idx = extra;
    if (state.revealed[idx]) return interaction.reply({ content: "❌ الكلمة دي اتكشفت!", flags: 64 });
    const currentTeam = state.turn;
    if (!state[currentTeam].agents.includes(interaction.user.id))
      return interaction.reply({ content: `❌ مش دورك! دور الفريق ${currentTeam === "red" ? "🔴 الأحمر" : "🔵 الأزرق"}`, flags: 64 });
    if (!state.clue)
      return interaction.reply({ content: "❌ استنى القائد يكتب الإشارة في الشات أول!", flags: 64 });

    state.revealed[idx] = true;
    const wordColor = state.colors[idx], word = state.words[idx];
    const otherTeam = currentTeam === "red" ? "blue" : "red";

    if (wordColor === "assassin") {
      codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
      const loser = currentTeam === "red" ? "🔴 الأحمر" : "🔵 الأزرق";
      const winner = currentTeam === "red" ? "🔵 الأزرق" : "🔴 الأحمر";
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x000000).setTitle("💀 الكلمة القاتلة!")
          .setDescription(`فريق ${loser} لمس الكلمة القاتلة **"${word}"**!\n\n🏆 **فريق ${winner} يفوز بالضربة القاضية!**`).setTimestamp()],
        components: [],
      });
    }

    if (wordColor === currentTeam) {
      if (currentTeam === "red") state.redFound++; else state.blueFound++;
      state.clue.remaining--;
      if (state.redFound >= state.redTotal || state.blueFound >= state.blueTotal) {
        const winner = state.redFound >= state.redTotal ? "🔴 الأحمر" : "🔵 الأزرق";
        codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(state.redFound >= state.redTotal ? 0xe74c3c : 0x3498db)
            .setTitle(`🏆 فريق ${winner} يفوز!`).setDescription(`وجدوا كل كلماتهم أولاً! 🎉\n\n*النتيجة النهائية: 🔴 ${state.redFound}/${state.redTotal} | 🔵 ${state.blueFound}/${state.blueTotal}*`).setTimestamp()],
          components: [],
        });
      }
      if (state.clue.remaining <= 0) { state.clue = null; state.turn = otherTeam; }
    } else {
      if (wordColor === "red") state.redFound++; else if (wordColor === "blue") state.blueFound++;
      if (state.redFound >= state.redTotal || state.blueFound >= state.blueTotal) {
        const winner = state.redFound >= state.redTotal ? "🔴 الأحمر" : "🔵 الأزرق";
        codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(state.redFound >= state.redTotal ? 0xe74c3c : 0x3498db)
            .setTitle(`🏆 فريق ${winner} يفوز!`).setDescription(`اكتملت كلماتهم! 🎉`).setTimestamp()],
          components: [],
        });
      }
      state.clue = null; state.turn = otherTeam;
    }
    const newRows = buildBoardRows(gameId, state);
    return interaction.update({ embeds: [buildGameEmbed(state)], components: state.clue ? addSkipRow(gameId, newRows) : newRows });
  }

  if (action === "skip") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    if (!state[state.turn].agents.includes(interaction.user.id))
      return interaction.reply({ content: "❌ مش دورك!", flags: 64 });
    state.clue = null; state.turn = state.turn === "red" ? "blue" : "red";
    return interaction.update({ embeds: [buildGameEmbed(state)], components: buildBoardRows(gameId, state) });
  }
}

// ── معالج إشارات القائد في الشات ─────────────────────────────
export function handleCodenamesMessage(msg) {
  const channelId = msg.channel.id;
  if (!cdnChannelGames.has(channelId)) return false;
  const gameId = cdnChannelGames.get(channelId);
  const state = codenamesGames.get(gameId);
  if (!state || state.phase !== "playing" || state.clue) return false;
  if (msg.author.id !== state[state.turn].spymaster) return false;

  const match = msg.content.trim().match(/^(\S+)\s+(\d+)$/);
  if (!match) return false;
  const [, word, countStr] = match;
  const count = parseInt(countStr);
  if (count < 1 || count > 9) return false;

  if (state.words.some(w => w === word)) {
    msg.reply("❌ ممنوع تستخدم كلمة موجودة على اللوحة!").catch(() => {});
    return true;
  }

  state.clue = { word, count, remaining: count };
  msg.react("✅").catch(() => {});
  msg.channel.messages.fetch(state.messageId).then(m => {
    m.edit({ embeds: [buildGameEmbed(state)], components: addSkipRow(gameId, buildBoardRows(gameId, state)) }).catch(() => {});
  }).catch(() => {});
  return true;
}
