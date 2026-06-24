// ═══════════════════════════════════════════════════════════════
//  🃏 كود نيمز — Codenames Arabic Edition
//  25 كلمة | فريقين (أحمر/أزرق) | قائد سري | لوحة 5×5 أزرار
//  التلميح عن طريق زرار + مودال (مش كتابة في الشات)
//  ✅ يدعم AI Spymaster (Gemini) — يقدر يمسك قيادة فريق بدل لاعب بشري
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
} from "discord.js";
import { getChatModel } from "../helpers/gemini-keys.js";

export const codenamesGames  = new Map();
export const cdnChannelGames = new Map();

const AI_SPYMASTER_ID = "AI_SPYMASTER"; // قيمة خاصة في حقل spymaster تشير إن الـ AI هو القائد

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
    roundTimeMinutes: null, // وقت الجولة بالدقايق (null = بلا حد)
    roundTimer: null,
    // ✅ إعدادات الـ AI Spymaster:
    //   "off"      → بدون AI خالص (الوضع الافتراضي القديم)
    //   "fill"     → AI يتدخل بس لو فريق وقت "ابدأ اللعبة" مالوش قائد بشري
    //   "always"   → AI يمسك القيادة من أول دقيقة (تفعيل فوري لفريق أو الاتنين)
    aiMode: "off",
    aiThinking: false, // قفل بسيط — يمنع طلبين Gemini في نفس اللحظة لنفس اللعبة
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
        if (color === "blue")     { style = ButtonStyle.Primary; label = `✓${word}`; }
        else if (color === "red") { style = ButtonStyle.Danger;  label = `✓${word}`; }
        else if (color === "neutral") { style = ButtonStyle.Secondary; label = `⬜${word}`; }
        else if (color === "assassin") { style = ButtonStyle.Danger; label = `💀${word}`; }
      }
      btns.push(new ButtonBuilder()
        .setCustomId(`cdn_g_${gameId}_${idx}`)
        .setLabel(label.slice(0, 25))
        .setStyle(style)
        .setDisabled(rev));
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

// ── هل القائد الحالي لفريق معين هو الـ AI؟ ────────────────────
function isAISpymaster(state, team) {
  return state[team].spymaster === AI_SPYMASTER_ID;
}

// ══════════════════════════════════════════════════════════════
//  🤖 AI Spymaster — بيستخدم Gemini عشان يجيب تلميح ذكي
//  ──────────────────────────────────────────────────────────────
//  بيدي الـ AI خريطة الكلمات الكاملة (ألوان + كلمات الفريق بتاعه
//  وكلمات الخصم والمحايدة والقاتلة)، وبيطلب منه يربط كلمة واحدة
//  بأكتر عدد ممكن من كلمات فريقه، بعيد عن القاتلة والخصم.
//  بيرجع { word, count } أو null لو فشل (وقتها بنرجع لتلميح احتياطي).
// ══════════════════════════════════════════════════════════════
async function getAISpymasterClue(state, team) {
  const model = getChatModel();
  if (!model) return fallbackClue(state, team);

  const teamWords = [], enemyWords = [], neutralWords = [], assassinWords = [];
  for (let i = 0; i < 25; i++) {
    if (state.revealed[i]) continue; // الكلمات المكشوفة مالها لازمة في الحساب
    const w = state.words[i], c = state.colors[i];
    if (c === team) teamWords.push(w);
    else if (c === "assassin") assassinWords.push(w);
    else if (c === "neutral") neutralWords.push(w);
    else enemyWords.push(w);
  }

  if (teamWords.length === 0) return null; // الفريق خلص كلماته بالفعل

  const prompt =
    `إنت قائد سري (Spymaster) في لعبة كود نيمز بالعربي. مهمتك تدّي تلميح لفريقك.\n\n` +
    `كلمات فريقك (المفروض يخمنوها): ${teamWords.join("، ")}\n` +
    `كلمات الفريق الخصم (لازم تتجنبها): ${enemyWords.join("، ")}\n` +
    `كلمات محايدة (لازم تتجنبها): ${neutralWords.join("، ")}\n` +
    `الكلمة القاتلة (خطر! ممنوع التلميح يقرّب منها خالص): ${assassinWords.join("، ")}\n\n` +
    `طلوب منك: اختار كلمة تلميح واحدة (مش موجودة في أي قائمة فوق) ترتبط بأكبر عدد ممكن ` +
    `من كلمات فريقك بس، وبعيدة تمامًا عن الكلمة القاتلة. ` +
    `لو معندك تلميح آمن لأكتر من كلمة، اختار كلمة لكلمة واحدة بس وده تمام.\n\n` +
    `رد بصيغة JSON فقط بدون أي نص إضافي: {"word": "كلمة_التلميح", "count": رقم, "targets": ["كلمة1","كلمة2"]}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return fallbackClue(state, team);

    const parsed = JSON.parse(match[0]);
    let word = String(parsed.word || "").trim();
    let count = parseInt(parsed.count, 10);

    // ✅ تحقق أمان: نفس قواعد التلميح البشري بالظبط — كلمة واحدة، مش على
    //   اللوحة، وعدد منطقي. لو فشل أي شرط، نرجع لتلميح احتياطي بسيط
    if (!word || word.includes(" ") || isNaN(count) || count < 1 || count > 9) {
      return fallbackClue(state, team);
    }
    if (state.words.some(w => w === word)) {
      return fallbackClue(state, team);
    }
    count = Math.min(count, teamWords.length);

    return { word, count };
  } catch (err) {
    console.error("⚠️ [AI Spymaster] فشل الحصول على تلميح من Gemini:", err.message);
    return fallbackClue(state, team);
  }
}

// ── تلميح احتياطي بسيط لو فشل Gemini (عشان اللعبة ما توقفش) ───
function fallbackClue(state, team) {
  const remaining = [];
  for (let i = 0; i < 25; i++) {
    if (!state.revealed[i] && state.colors[i] === team) remaining.push(state.words[i]);
  }
  if (remaining.length === 0) return null;
  // بنرجع أول كلمة متاحة كـ "تلميح" مباشر بعدد 1 — بسيط بس بيضمن استمرار اللعبة
  const target = remaining[0];
  // كلمة احتياطية عامة (مش من قاموس اللعبة) عشان تفي بشرط "كلمة مش على اللوحة"
  const genericHints = ["إشارة", "دليل", "خيط", "رابط", "تلميح"];
  const word = genericHints.find(w => !state.words.includes(w)) || "تلميح";
  return { word, count: 1, _isFallback: true, _target: target };
}

function fmtTeam(state, team) {
  const lines = [];
  if (state[team].spymaster === AI_SPYMASTER_ID) lines.push(`🤖 **AI Spymaster** (قائد)`);
  else if (state[team].spymaster) lines.push(`👑 <@${state[team].spymaster}> (قائد)`);
  state[team].agents.forEach(id => lines.push(`🎮 <@${id}>`));
  return lines.join("\n") || "*فارغ*";
}

function buildLobbyEmbed(state) {
  const timeText = state.roundTimeMinutes ? `⏱️ وقت الجولة: **${state.roundTimeMinutes} دقيقة**` : "⏱️ وقت الجولة: **بلا حد**";
  const aiModeText = {
    off:    "🚫 بدون AI — كل القادة بشر",
    fill:   "🤖 AI عند النقص — يتدخل بس لو فريق مالوش قائد وقت البدء",
    always: "🤖 AI من البداية — هيمسك قيادة أي فريق متاح",
  }[state.aiMode] || "🚫 بدون AI";
  return new EmbedBuilder()
    .setColor(0x9b59b6).setTitle("🃏 كود نيمز — انتظار اللاعبين")
    .setDescription(
      `**📖 طريقة اللعب:**\n` +
      `┣ 25 كلمة على اللوحة — كل فريق له كلمات مخفية\n` +
      `┣ القائد يضغط **"💬 أعطِ تلميح"** ويكتب كلمة + رقم\n` +
      `┣ اللاعبون يضغطوا على الكلمات للتخمين\n` +
      `┣ 🔴 أحمر = فريقك | 🔵 أزرق = فريقك | ⬜ محايدة = دورك انتهى | 💀 قاتل = تخسر فوراً!\n` +
      `┗ أول فريق يكشف كل كلماته يفوز!\n\n` +
      `⚠️ **متطلبات:** قائد + لاعب واحد لكل فريق (أو AI بدل القائد)\n\n` +
      `${timeText}\n🤖 **وضع AI Spymaster:** ${aiModeText}`
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
      new ButtonBuilder().setCustomId(`cdn_settings_${gameId}`).setLabel("⚙️ إعدادات الوقت").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cdn_aimenu_${gameId}`).setLabel("🤖 إعدادات AI").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cdn_start_${gameId}`).setLabel("▶️ ابدأ اللعبة").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`cdn_cancel_${gameId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cdn_realplay_${gameId}`).setLabel("🌐 لعب اللعبة الأصلية").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// ── قائمة اختيار وضع الـ AI (select menu) ─────────────────────
function buildAIModeRow(gameId, state) {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cdn_aiset_${gameId}`)
      .setPlaceholder("اختار وضع AI Spymaster")
      .addOptions(
        { label: "🚫 بدون AI", description: "كل القادة لازم يكونوا بشر", value: "off", default: state.aiMode === "off" },
        { label: "🤖 AI عند النقص", description: "AI يتدخل بس لو فريق مالوش قائد وقت البدء", value: "fill", default: state.aiMode === "fill" },
        { label: "🤖 AI من البداية", description: "AI يمسك قيادة أي فريق متاح فورًا", value: "always", default: state.aiMode === "always" },
      )
  )];
}

function buildGameEmbed(state) {
  const cur = state.turn === "red" ? "🔴 الأحمر" : "🔵 الأزرق";
  const spy = state[state.turn].spymaster;
  const clueText = state.clue
    ? `📢 **الإشارة:** \`${state.clue.word}\` — **${state.clue.count}** كلمات (متبقي: ${state.clue.remaining})`
    : `⏳ القائد <@${spy ?? "؟"}> يعطي الإشارة — اضغط زرار **"💬 أعطِ تلميح"** في الأسفل`;
  const timeText = state.roundTimeMinutes ? ` | ⏱️ ${state.roundTimeMinutes} د/جولة` : "";
  return new EmbedBuilder()
    .setColor(state.turn === "red" ? 0xe74c3c : 0x3498db)
    .setTitle(`🃏 كود نيمز — دور ${cur}`)
    .setDescription(`${clueText}\n\n🔴 ${state.redFound}/${state.redTotal}  •  🔵 ${state.blueFound}/${state.blueTotal}${timeText}`)
    .setFooter({ text: state.clue ? "اضغط الكلمة اللي تعتقد إنها صحيحة" : "القائد بس يقدر يعطي الإشارة" })
    .setTimestamp();
}

function buildGameActionRow(gameId, state) {
  const btns = [
    new ButtonBuilder().setCustomId(`cdn_skip_${gameId}`).setLabel("⏭️ تخطي الدور").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cdn_cancel_${gameId}`).setLabel("❌ إنهاء").setStyle(ButtonStyle.Danger),
  ];
  return new ActionRowBuilder().addComponents(...btns);
}

// صف منفصل يتبعت كرسالة تانية للـ control (لو الـ board مليان 5 rows)
function buildSpymasterClueRow(gameId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cdn_giveclue_${gameId}`).setLabel("💬 أعطِ تلميح الآن").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cdn_skip_${gameId}`).setLabel("⏭️ تخطي دوري").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cdn_cancel_${gameId}`).setLabel("❌ إنهاء اللعبة").setStyle(ButtonStyle.Danger),
  )];
}

// ── الأمر ─────────────────────────────────────────────────────
// ✅ ملحوظة: مفيش SlashCommandBuilder منفصل هنا عمدًا — اللعبة بالكامل
//   متاحة بس من زرار "🃏 كود نيمز" جوه /الألعاب (مش أمر slash مستقل)
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
      interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x555).setTitle("🃏 كود نيمز — انتهت مهلة اللوبي")], components: [] }).catch(() => {});
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
    action = "g"; extra = parseInt(parts[parts.length - 1]);
  } else {
    action = parts[1]; gameId = parts.slice(2).join("_");
  }

  const state = codenamesGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  // ── الانضمام للفرق ──────────────────────────────────────────
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

  // ── قائمة وضع AI Spymaster ──────────────────────────────────
  if (action === "aimenu") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ بس اللي بدأ اللعبة يقدر يغير إعدادات الـ AI!", flags: 64 });
    return interaction.reply({
      content: "🤖 اختار وضع AI Spymaster المناسب:",
      components: buildAIModeRow(gameId, state),
      flags: 64,
    });
  }

  // ── إعدادات الوقت ──────────────────────────────────────────
  if (action === "settings") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ بس اللي بدأ اللعبة يقدر يغير الإعدادات!", flags: 64 });
    const modal = new ModalBuilder()
      .setCustomId(`cdnsettings_${gameId}`)
      .setTitle("⚙️ إعدادات كود نيمز");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("round_time")
        .setLabel("وقت كل جولة (بالدقايق) — اتركها فاضية بلا حد")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("مثال: 2 أو 3 — أو اتركها فاضية")
        .setMaxLength(2)
    ));
    return interaction.showModal(modal);
  }

  // ── لعب اللعبة الأصلية — أول افتح الموقع، بعدين ابعت رابط الدعوة ─
  if (action === "realplay") {
    return interaction.reply({
      flags: 64,
      embeds: [new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🌐 العب كود نيمز الأصلي!")
        .setDescription("**الخطوات:**\n1️⃣ افتح الموقع واعمل روم جديد\n2️⃣ لما تاخد رابط الدعوة اضغط **📨 ابعت رابط الدعوة**\n3️⃣ الرابط هيتبعت للكل في الشات!")
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🃏 افتح كود نيمز")
          .setURL("https://codenames.game")
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setCustomId(`cdn_sendlink_${gameId}`)
          .setLabel("📨 ابعت رابط الدعوة")
          .setStyle(ButtonStyle.Primary),
      )],
    });
  }

  if (action === "sendlink") {
    const modal = new ModalBuilder()
      .setCustomId(`cdninvite_${gameId}`)
      .setTitle("🌐 لعب كود نيمز الأصلي");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("invite_link")
        .setLabel("ابعت رابط الدعوة عشان الكل يدخل")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("مثال: https://codenames.game/room/xyz")
        .setMaxLength(300)
    ));
    return interaction.showModal(modal);
  }

  // ── إلغاء ──────────────────────────────────────────────────
  if (action === "cancel") {
    if (state.phase === "lobby" && state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ اللي عملها بس يلغيها!", flags: 64 });
    if (state.roundTimer) clearTimeout(state.roundTimer);
    codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
    await interaction.message.delete().catch(() => {});
    return interaction.reply({ content: "🃏 تم إلغاء / إنهاء لعبة كود نيمز!", flags: 64 });
  }

  // ── ابدأ اللعبة ────────────────────────────────────────────
  if (action === "start") {
    if (state.creatorId !== interaction.user.id)
      return interaction.reply({ content: "❌ اللي عملها بس يبدأها!", flags: 64 });

    // ✅ وضع "AI عند النقص": أي فريق وصل هنا بدون قائد بشري، الـ AI يمسكه فورًا
    if (state.aiMode === "fill") {
      if (!state.red.spymaster) state.red.spymaster = AI_SPYMASTER_ID;
      if (!state.blue.spymaster) state.blue.spymaster = AI_SPYMASTER_ID;
    }

    if (!state.red.spymaster || !state.blue.spymaster)
      return interaction.reply({ content: "❌ كل فريق لازم عنده قائد (بشري أو فعّل AI من ⚙️ إعدادات AI)!", flags: 64 });
    if (state.red.agents.length < 1 || state.blue.agents.length < 1)
      return interaction.reply({ content: "❌ كل فريق لازم عنده لاعب واحد على الأقل!", flags: 64 });

    state.phase = "playing";
    await sendSpymasterDMs(interaction.client, state);
    await sendAgentDMs(interaction.client, state);
    await sendActiveSpymasterControl(interaction.client, interaction.channel, state);

    const boardRows = buildBoardRows(gameId, state);
    await interaction.update({ embeds: [buildGameEmbed(state)], components: boardRows });

    // ✅ لو الفريق الأول (الأحمر بيبدأ دايمًا) قائده AI، خليه يعطي تلميحه فورًا
    if (isAISpymaster(state, state.turn)) {
      await runAITurn(interaction.client, interaction.channel, gameId, state);
    }
    return;
  }

  // ── زرار "أعطِ تلميح" ──────────────────────────────────────
  if (action === "giveclue") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    const spy = state[state.turn].spymaster;
    if (interaction.user.id !== spy)
      return interaction.reply({ content: `❌ مش دورك! دلوقتي القائد <@${spy}> بس يقدر يعطي الإشارة.`, flags: 64 });
    if (state.clue)
      return interaction.reply({ content: "❌ في إشارة موجودة — خلّي اللاعبين يخمنوا الأول!", flags: 64 });

    const modal = new ModalBuilder()
      .setCustomId(`cdnclue_${gameId}`)
      .setTitle("💬 أعطِ تلميح — كود نيمز");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("clue_word")
          .setLabel("كلمة التلميح (كلمة واحدة فقط)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("مثال: حيوان")
          .setMaxLength(30)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("clue_count")
          .setLabel("عدد الكلمات اللي بيشير ليها (1-9)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("مثال: 3")
          .setMaxLength(1)
      )
    );
    return interaction.showModal(modal);
  }

  // ── تخطي الدور ─────────────────────────────────────────────
  if (action === "skip") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    const isAgent = state[state.turn].agents.includes(interaction.user.id);
    const isSpy   = state[state.turn].spymaster === interaction.user.id;
    if (!isAgent && !isSpy)
      return interaction.reply({ content: "❌ مش دورك!", flags: 64 });
    if (state.roundTimer) clearTimeout(state.roundTimer);
    state.clue = null; state.turn = state.turn === "red" ? "blue" : "red";
    startRoundTimer(interaction.client, interaction.channel, gameId, state);

    // تحديث الـ control message (لأن الزرار جاي منه)
    await interaction.update({ embeds: [buildGameEmbed(state)], components: buildGameActionRow(gameId, state).components.length > 0 ? [buildGameActionRow(gameId, state)] : [] });
    // تحديث الـ board
    const boardRows = buildBoardRows(gameId, state);
    await interaction.channel.messages.fetch(state.messageId).then(m => m.edit({ embeds: [buildGameEmbed(state)], components: boardRows })).catch(() => {});
    // بعت DM للـ spymaster الجديد
    await sendActiveSpymasterControl(interaction.client, interaction.channel, state);
    // ✅ لو القائد الجديد AI، خليه يلعب دوره فورًا
    if (isAISpymaster(state, state.turn)) {
      await runAITurn(interaction.client, interaction.channel, gameId, state);
    }
    return;
  }

  // ── تخمين كلمة ─────────────────────────────────────────────
  if (action === "g") {
    if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });
    const idx = extra;
    if (state.revealed[idx]) return interaction.reply({ content: "❌ الكلمة دي اتكشفت!", flags: 64 });
    const currentTeam = state.turn;
    if (!state[currentTeam].agents.includes(interaction.user.id))
      return interaction.reply({ content: `❌ مش دورك! دور الفريق ${currentTeam === "red" ? "🔴 الأحمر" : "🔵 الأزرق"} — اللاعبين بس يخمنوا!`, flags: 64 });
    if (!state.clue)
      return interaction.reply({ content: "❌ استنى القائد يعطي الإشارة الأول!", flags: 64 });

    state.revealed[idx] = true;
    const wordColor = state.colors[idx], word = state.words[idx];
    const otherTeam = currentTeam === "red" ? "blue" : "red";

    // 💀 الكلمة القاتلة
    if (wordColor === "assassin") {
      if (state.roundTimer) clearTimeout(state.roundTimer);
      codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
      const loser  = currentTeam === "red" ? "🔴 الأحمر" : "🔵 الأزرق";
      const winner = currentTeam === "red" ? "🔵 الأزرق" : "🔴 الأحمر";
      await interaction.message.delete().catch(() => {});
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x000000).setTitle("💀 الكلمة القاتلة!")
          .setDescription(`فريق ${loser} لمس الكلمة القاتلة **"${word}"**!\n\n🏆 **فريق ${winner} يفوز بالضربة القاضية!**`)
          .setTimestamp()],
      });
    }

    // ⬜ كلمة محايدة — ينتهي الدور فوراً
    if (wordColor === "neutral") {
      state.clue = null;
      state.turn = otherTeam;
      if (state.roundTimer) clearTimeout(state.roundTimer);
      startRoundTimer(interaction.client, interaction.channel, gameId, state);
      await sendActiveSpymasterControl(interaction.client, interaction.channel, state);
      // ✅ لو الفريق الجديد قائده AI، خليه يلعب دوره فورًا (بعد الرد الحالي)
      if (isAISpymaster(state, state.turn)) {
        setImmediate(() => runAITurn(interaction.client, interaction.channel, gameId, state).catch(() => {}));
      }
      const boardRows = buildBoardRows(gameId, state);
      return interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle("⬜ كلمة محايدة!")
          .setDescription(`<@${interaction.user.id}> ضغط على **"${word}"** — كلمة محايدة!\nالدور انتقل لفريق ${otherTeam === "red" ? "🔴 الأحمر" : "🔵 الأزرق"} ⏭️`)
          .setTimestamp(),
          buildGameEmbed(state)],
        components: boardRows,
      });
    }

    // ✅ كلمة لونها صح
    if (wordColor === currentTeam) {
      if (currentTeam === "red") state.redFound++; else state.blueFound++;
      if (state.clue) state.clue.remaining--;

      // فحص الفوز
      if (state.redFound >= state.redTotal || state.blueFound >= state.blueTotal) {
        const winner = state.redFound >= state.redTotal ? "🔴 الأحمر" : "🔵 الأزرق";
        if (state.roundTimer) clearTimeout(state.roundTimer);
        codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
        const boardRows = buildBoardRows(gameId, state);
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(state.redFound >= state.redTotal ? 0xe74c3c : 0x3498db)
            .setTitle(`🏆 فريق ${winner} يفوز!`)
            .setDescription(`وجدوا كل كلماتهم أولاً! 🎉\n\n*النتيجة: 🔴 ${state.redFound}/${state.redTotal} | 🔵 ${state.blueFound}/${state.blueTotal}*`)
            .setTimestamp()],
          components: boardRows,
        });
      }

      // خلص عدد التخمينات
      if (state.clue && state.clue.remaining <= 0) {
        state.clue = null; state.turn = otherTeam;
        if (state.roundTimer) clearTimeout(state.roundTimer);
        startRoundTimer(interaction.client, interaction.channel, gameId, state);
        await sendActiveSpymasterControl(interaction.client, interaction.channel, state);
        // ✅ لو الفريق الجديد قائده AI، خليه يلعب دوره فورًا (بعد الرد الحالي)
        if (isAISpymaster(state, state.turn)) {
          setImmediate(() => runAITurn(interaction.client, interaction.channel, gameId, state).catch(() => {}));
        }
      }
    } else {
      // كلمة الخصم
      if (wordColor === "red") state.redFound++; else if (wordColor === "blue") state.blueFound++;

      // فحص الفوز للخصم
      if (state.redFound >= state.redTotal || state.blueFound >= state.blueTotal) {
        const winner = state.redFound >= state.redTotal ? "🔴 الأحمر" : "🔵 الأزرق";
        if (state.roundTimer) clearTimeout(state.roundTimer);
        codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);
        const boardRows = buildBoardRows(gameId, state);
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(state.redFound >= state.redTotal ? 0xe74c3c : 0x3498db)
            .setTitle(`🏆 فريق ${winner} يفوز!`)
            .setDescription(`اكتملت كلماتهم! 🎉`)
            .setTimestamp()],
          components: boardRows,
        });
      }
      state.clue = null; state.turn = otherTeam;
      if (state.roundTimer) clearTimeout(state.roundTimer);
      startRoundTimer(interaction.client, interaction.channel, gameId, state);
      await sendActiveSpymasterControl(interaction.client, interaction.channel, state);
      // ✅ لو الفريق الجديد قائده AI، خليه يلعب دوره فورًا (بعد الرد الحالي)
      if (isAISpymaster(state, state.turn)) {
        setImmediate(() => runAITurn(interaction.client, interaction.channel, gameId, state).catch(() => {}));
      }
    }

    const boardRows = buildBoardRows(gameId, state);
    return interaction.update({ embeds: [buildGameEmbed(state)], components: boardRows });
  }
}

// ── مؤقت الجولة ───────────────────────────────────────────────
function startRoundTimer(client, channel, gameId, state) {
  if (!state.roundTimeMinutes) return;
  if (state.roundTimer) clearTimeout(state.roundTimer);
  state.roundTimer = setTimeout(async () => {
    if (!codenamesGames.has(gameId)) return;
    const prevTurn = state.turn;
    state.clue = null;
    state.turn = state.turn === "red" ? "blue" : "red";
    startRoundTimer(client, channel, gameId, state);
    const boardRows = buildBoardRows(gameId, state);
    try {
      await channel.messages.fetch(state.messageId).then(m =>
        m.edit({ embeds: [
          new EmbedBuilder().setColor(0xe67e22).setTitle("⏱️ انتهى الوقت!")
            .setDescription(`انتهى وقت فريق ${prevTurn === "red" ? "🔴 الأحمر" : "🔵 الأزرق"} — الدور انتقل!`),
          buildGameEmbed(state)
        ], components: boardRows })
      );
    } catch {}
    await sendActiveSpymasterControl(client, channel, state);
    // ✅ لو الفريق الجديد (بعد انتهاء الوقت) قائده AI، خليه يلعب دوره فورًا
    if (isAISpymaster(state, state.turn)) {
      await runAITurn(client, channel, gameId, state);
    }
  }, state.roundTimeMinutes * 60 * 1000);
}

// ── بعت لـ Spymaster الحالي زرار التحكم في DM ─────────────────
async function sendActiveSpymasterControl(client, channel, state) {
  const gameId = state.id;
  const currentSpyId = state[state.turn].spymaster;
  if (!currentSpyId) return;
  const teamLabel = state.turn === "red" ? "🔴 الأحمر" : "🔵 الأزرق";
  const embed = new EmbedBuilder()
    .setColor(state.turn === "red" ? 0xe74c3c : 0x3498db)
    .setTitle(`👑 دورك! — القائد ${teamLabel}`)
    .setDescription(
      `دورك تعطي الإشارة لفريقك!\n\n` +
      `🔴 ${state.redFound}/${state.redTotal} | 🔵 ${state.blueFound}/${state.blueTotal}\n\n` +
      `*الإشارة لازم كلمة واحدة + عدد (مثال: حيوان 3)*`
    );
  try {
    const u = await client.users.fetch(currentSpyId);
    await u.send({ embeds: [embed], components: buildSpymasterClueRow(gameId) });
  } catch {}
}

// ══════════════════════════════════════════════════════════════
//  🤖 تشغيل دور قائد AI تلقائيًا
//  ──────────────────────────────────────────────────────────────
//  بتُستدعى لما يكون دور الفريق الحالي قائده AI (state.turn's
//  spymaster === AI_SPYMASTER_ID). بتجيب تلميح من Gemini (أو
//  fallback لو فشل)، تحدّث state.clue، وتحدّث رسالة اللعبة في
//  الروم بنفس الطريقة اللي بيحصل لو قائد بشري أعطى تلميح.
//  ✅ حالة خاصة: لو Gemini فشل ورجع fallback (تلميح مولّد عام
//  مش له علاقة حقيقية بالكلمات)، الـ AI بيكشف الكلمة المستهدفة
//  لفريقه مباشرة بدل ما يدّي تلميح مش مفهوم — أحسن من ما يوقف
//  اللعبة أو يدّي تلميح عشوائي يلخبط اللاعبين.
// ══════════════════════════════════════════════════════════════
async function runAITurn(client, channel, gameId, state) {
  if (!codenamesGames.has(gameId)) return;
  if (state.phase !== "playing") return;
  if (state.clue) return; // في إشارة موجودة بالفعل، مفيش لازمة نعمل حاجة

  const team = state.turn;
  if (!isAISpymaster(state, team)) return;

  const result = await getAISpymasterClue(state, team);

  // الفريق خلص كلماته بالفعل أو مفيش تلميح أصلاً — تخطي الدور بهدوء
  if (!result) {
    state.turn = team === "red" ? "blue" : "red";
    startRoundTimer(client, channel, gameId, state);
    await refreshBoardMessage(client, state);
    await sendActiveSpymasterControl(client, channel, state);
    if (isAISpymaster(state, state.turn)) {
      await runAITurn(client, channel, gameId, state);
    }
    return;
  }

  if (result._isFallback) {
    // الـ AI مش لاقي تلميح ذكي — بيكشف الكلمة المستهدفة مباشرة لفريقه
    state.clue = { word: result.word, count: 1, remaining: 1 };
  } else {
    state.clue = { word: result.word, count: result.count, remaining: result.count };
  }

  startRoundTimer(client, channel, gameId, state);
  await refreshBoardMessage(client, state);

  // ✅ نبعت رسالة بسيطة في الروم توضح إن القائد AI أعطى إشارة
  //   (القائد البشري بيتم تنبيهه عبر sendActiveSpymasterControl، لكن
  //   الـ AI مفيش له DM يستقبل فيه زرار، فبنعلن في الروم بدلاً من ذلك)
  try {
    await channel.send({
      embeds: [new EmbedBuilder()
        .setColor(team === "red" ? 0xe74c3c : 0x3498db)
        .setTitle(`🤖 القائد AI (${team === "red" ? "🔴 الأحمر" : "🔵 الأزرق"}) أعطى إشارة!`)
        .setDescription(`📢 **الإشارة:** \`${state.clue.word}\` — **${state.clue.count}** كلمات`)
      ],
    });
  } catch {}
}

// ── تحديث رسالة اللوحة في الروم بأحدث حالة ────────────────────
async function refreshBoardMessage(client, state) {
  try {
    const boardRows = buildBoardRows(state.id, state);
    const ch = await client.channels.fetch(state.channelId);
    const msg = await ch.messages.fetch(state.messageId);
    await msg.edit({ embeds: [buildGameEmbed(state)], components: boardRows });
  } catch {}
}

// ── بعت للـ Spymasters خريطة الكلمات ─────────────────────────
async function sendSpymasterDMs(client, state) {
  const spyMap = buildSpymasterMap(state);
  const spyEmbed = new EmbedBuilder().setColor(0x9b59b6).setTitle("👑 خريطتك السرية — قائد كود نيمز!")
    .setDescription(
      `**دورك:** هتستقبل رسالة خاصة لما يكون دورك — فيها زرار "أعطِ تلميح"\n` +
      `**شكل التلميح:** كلمة واحدة + رقم الكلمات (مثال: حيوان 3)\n\n` +
      `**قواعد التلميح:**\n` +
      `• كلمة واحدة فقط — ممنوع مركبة\n` +
      `• ممنوع كلمة موجودة على اللوحة\n\n` +
      `**🗺️ خريطتك:**\n\`\`\`\n${spyMap}\`\`\`\n` +
      `🔴 أحمر | 🔵 أزرق | ⬜ محايد | 💀 **قاتل — لا تقترب!**`
    );
  for (const spyId of [state.red.spymaster, state.blue.spymaster]) {
    if (!spyId) continue;
    try { const u = await client.users.fetch(spyId); await u.send({ embeds: [spyEmbed] }); } catch {}
  }
}

async function sendAgentDMs(client, state) {
  for (const uid of state.red.agents) {
    try {
      const u = await client.users.fetch(uid);
      await u.send(`🔴 **إنت في الفريق الأحمر في كود نيمز!**\nاخمن الكلمات من الإشارة — اضغط على الكلمات في الروم!\n💡 كلمة صح ✅ | ⬜ محايدة = دورك انتهى | خصم = بيكسبوا نقطة | 💀 قاتل = تخسروا فوراً!`);
    } catch {}
  }
  for (const uid of state.blue.agents) {
    try {
      const u = await client.users.fetch(uid);
      await u.send(`🔵 **إنت في الفريق الأزرق في كود نيمز!**\nاخمن الكلمات من الإشارة — اضغط على الكلمات في الروم!\n💡 كلمة صح ✅ | ⬜ محايدة = دورك انتهى | خصم = بيكسبوا نقطة | 💀 قاتل = تخسروا فوراً!`);
    } catch {}
  }
}

// ── معالج قائمة اختيار وضع AI Spymaster ────────────────────────
export async function handleCodenamesAISelect(interaction) {
  const gameId = interaction.customId.replace("cdn_aiset_", "");
  const state = codenamesGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  if (state.creatorId !== interaction.user.id)
    return interaction.reply({ content: "❌ بس اللي بدأ اللعبة يقدر يغير إعدادات الـ AI!", flags: 64 });

  const mode = interaction.values[0]; // "off" | "fill" | "always"
  state.aiMode = mode;

  // ✅ "AI من البداية": لو حد من الفريقين مفتوح ومحدش مسكه قائد بشري،
  //   الـ AI يمسكه فورًا. لو فريق ماسكه بشري بالفعل، نسيبه زي ما هو
  //   (مانشيلش قائد بشري موجود بالفعل عشان نحط AI بدل منه)
  if (mode === "always") {
    if (!state.red.spymaster) state.red.spymaster = AI_SPYMASTER_ID;
    if (!state.blue.spymaster) state.blue.spymaster = AI_SPYMASTER_ID;
  } else if (mode === "off") {
    // إلغاء أي AI كان متفعّل قبل كده، يرجع الفريق محتاج قائد بشري
    if (state.red.spymaster === AI_SPYMASTER_ID) state.red.spymaster = null;
    if (state.blue.spymaster === AI_SPYMASTER_ID) state.blue.spymaster = null;
  } else if (mode === "fill") {
    // لو كان متفعّل always قبل كده وفريق ماسكه AI بس مفيش بشر طلب الدور،
    // نسيبه لحد ما يحصل "start" — هيتقرر هناك. هنا بس نشيل AI لو كان موجود
    // فعليًا عشان نرجّع الفرصة للبشر يدخلوا (التدخل بيحصل وقت "ابدأ اللعبة" بس)
    if (state.red.spymaster === AI_SPYMASTER_ID) state.red.spymaster = null;
    if (state.blue.spymaster === AI_SPYMASTER_ID) state.blue.spymaster = null;
  }

  try {
    const ch = await interaction.client.channels.fetch(state.channelId);
    const msg = await ch.messages.fetch(state.messageId);
    await msg.edit({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  } catch {}

  const modeLabel = { off: "🚫 بدون AI", fill: "🤖 AI عند النقص", always: "🤖 AI من البداية" }[mode];
  return interaction.reply({ content: `✅ وضع AI Spymaster بقى: ${modeLabel}`, flags: 64 });
}

// ── معالجات المودالات ─────────────────────────────────────────
export async function handleCodenamesSettingsModal(interaction) {
  const gameId = interaction.customId.replace("cdnsettings_", "");
  const state = codenamesGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });

  const raw = (interaction.fields.getTextInputValue("round_time") || "").trim();

  if (!raw) {
    state.roundTimeMinutes = null;
  } else {
    const mins = parseInt(raw);
    if (isNaN(mins) || mins < 1 || mins > 10)
      return interaction.reply({ content: "❌ الوقت لازم يكون من 1 لـ 10 دقايق!", flags: 64 });
    state.roundTimeMinutes = mins;
  }

  // Modal submits don't support update() - edit the lobby message directly
  try {
    const ch = await interaction.client.channels.fetch(state.channelId);
    const msg = await ch.messages.fetch(state.messageId);
    await msg.edit({ embeds: [buildLobbyEmbed(state)], components: buildLobbyRows(gameId) });
  } catch {}

  const resultMsg = state.roundTimeMinutes
    ? `✅ وقت الجولة اتحدد: **${state.roundTimeMinutes} دقيقة**`
    : "✅ الوقت أُلغي — اللعبة بلا حد وقت!";
  return interaction.reply({ content: resultMsg, flags: 64 });
}

export async function handleCodenamesClueModal(interaction) {
  const gameId = interaction.customId.replace("cdnclue_", "");
  const state = codenamesGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت!", flags: 64 });
  if (state.phase !== "playing") return interaction.reply({ content: "❌ اللعبة مش شغالة!", flags: 64 });

  const spy = state[state.turn].spymaster;
  if (interaction.user.id !== spy)
    return interaction.reply({ content: "❌ مش دورك تعطي الإشارة!", flags: 64 });
  if (state.clue)
    return interaction.reply({ content: "❌ في إشارة موجودة بالفعل!", flags: 64 });

  const word  = (interaction.fields.getTextInputValue("clue_word") || "").trim();
  const countStr = (interaction.fields.getTextInputValue("clue_count") || "").trim();
  const count = parseInt(countStr);

  if (!word || word.includes(" "))
    return interaction.reply({ content: "❌ التلميح لازم يكون كلمة واحدة فقط!", flags: 64 });
  if (isNaN(count) || count < 1 || count > 9)
    return interaction.reply({ content: "❌ العدد لازم يكون من 1 لـ 9!", flags: 64 });
  if (state.words.some(w => w === word))
    return interaction.reply({ content: "❌ ممنوع تستخدم كلمة موجودة على اللوحة!", flags: 64 });

  state.clue = { word, count, remaining: count };
  if (state.roundTimer) clearTimeout(state.roundTimer);
  startRoundTimer(interaction.client, interaction.channel, gameId, state);

  const boardRows = buildBoardRows(gameId, state);
  try {
    const ch = await interaction.client.channels.fetch(state.channelId);
    const msg = await ch.messages.fetch(state.messageId);
    await msg.edit({ embeds: [buildGameEmbed(state)], components: boardRows });
  } catch {}
  return interaction.reply({ content: `✅ الإشارة **"${word} — ${count}"** اتبعتت للشات! اللاعبون يخمنوا دلوقتي 🕵️`, flags: 64 });
}

export async function handleCodenamesInviteModal(interaction) {
  const gameId = interaction.customId.replace("cdninvite_", "");
  const state = codenamesGames.get(gameId);
  if (!state) return interaction.reply({ content: "❌ اللعبة انتهت بالفعل!", flags: 64 });

  const link = (interaction.fields.getTextInputValue("invite_link") || "").trim();
  if (state.roundTimer) clearTimeout(state.roundTimer);
  codenamesGames.delete(gameId); cdnChannelGames.delete(state.channelId);

  await interaction.message.delete().catch(() => {});
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🌐 روحوا العبوا كود نيمز الأصلي!")
      .setDescription(`**${interaction.user.displayName}** بعت رابط الدعوة! 🎮\n*(اللعبة على البوت اتلغت تلقائياً)*\n\n🔗 **رابط الدعوة:** ${link}`)
      .setTimestamp()],
  });
}

// ── معالج إشارات القائد (deprecated — kept for compatibility) ──
export function handleCodenamesMessage(msg) { return false; }
