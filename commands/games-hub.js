// ═══════════════════════════════════════════════════════════════
//  🎮 Games Hub + احدث المميزات + تغيير طريقة الكلام
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";

// ══════════════════════════════════════════════════════════════
//  قائمة أحدث المميزات — أضف حاجة جديدة هنا وهتظهر تلقائياً
// ══════════════════════════════════════════════════════════════
export const LATEST_FEATURES = [
  {
    name: "🧠 لعبة المسابقة — جديد!",
    value: "أسئلة ثقافية متعددة الخيارات — أول واحد يجاوب صح يكسب **100 كوينز + 30 XP**!\n→ من `/الألعاب` فقط",
    inline: false,
  },
  {
    name: "📊 نظام الاستفتاءات — جديد!",
    value: "أنشئ استفتاء في أي روم بسؤال وخيارات، والنتايج تلقائياً بعد المدة\nالفائز بأكتر أصوات يتعلن تلقائياً 🏆\n→ `/استفتاء`",
    inline: false,
  },
  {
    name: "🃏 كود نيمز",
    value: "لعبة الكلمات السرية الشهيرة بالعربي!\n25 كلمة على لوحة 5×5 — فريقين — قائد سري يعطي إشارات\n→ `/كود-نيمز`",
    inline: false,
  },
  {
    name: "📞 الهاتف المكسور",
    value: "سلسلة وصف وتخمين مضحكة!\nاكتب جملة → التاني يصفها → التالت يخمنها → ضحك مضمون\n→ `/الهاتف-المكسور`",
    inline: false,
  },
  {
    name: "😂 صنع الميم",
    value: "البوت يختار موقف مضحك — إنت تكتب كابشن — الكل يصوت!\nالفائز يكسب **200 كوينز** 🪙\n→ `/صنع-الميم`",
    inline: false,
  },
  {
    name: "🎮 مركز الألعاب",
    value: "كل الألعاب في مكان واحد — اضغط زرار وابدأ!\n→ `/الألعاب`",
    inline: true,
  },
  {
    name: "💬 أسلوب كلام البوت",
    value: "للأونر: غيّر طريقة رد البوت\n→ `/تغيير-طريقة-الكلام`",
    inline: true,
  },
  {
    name: "🕌 رد على السلام عليكم",
    value: "قول السلام عليكم في أي روم والبوت يرد عليك!",
    inline: false,
  },
  {
    name: "🛡️ Auto-Mod أذكى",
    value: "يستخدم Gemini AI عشان يفهم السياق ويفرق بين الكلام العادي والمحتوى الفعلاً ضار",
    inline: false,
  },
];

// ── هب الألعاب ────────────────────────────────────────────────
export const gamesHubCommand = new SlashCommandBuilder()
  .setName("الألعاب").setDescription("🎮 كل ألعاب زنجي في مكان واحد — اضغط وابدأ!");

export const latestFeaturesCommand = new SlashCommandBuilder()
  .setName("احدث-المميزات").setDescription("✨ أحدث مميزات زنجي بوت — اكتشف الجديد!");

export const speechModeCommand = new SlashCommandBuilder()
  .setName("تغيير-طريقة-الكلام")
  .setDescription("💬 غيّر أسلوب كلام البوت في الشات [أونر فقط]")
  .addStringOption(opt =>
    opt.setName("أسلوب").setDescription("اختر الأسلوب المطلوب").setRequired(true)
      .addChoices(
        { name: "🎩 محترم — رد لطيف ومودّب دايماً", value: "normal" },
        { name: "😈 حر — مزاجه حر وبيرد بأسلوب مختلف", value: "free" },
      )
  );

function buildHubEmbed() {
  return new EmbedBuilder()
    .setColor(0x9b59b6).setTitle("🎮 مركز الألعاب — زنجي بوت")
    .setDescription(
      `**اضغط على أي لعبة عشان تبدأها في الروم ده الحين!**\n\n` +
      `🎰 **روليت** — روليت روسية، آخر ناجي يأخذ الكوينز\n` +
      `🕵️ **مافيا** — اكشف المافيا قبل ما يقضوا على البلدة\n` +
      `❌⭕ **اكس-اوه** — تيك تاك تو الكلاسيكي مع التحديات\n` +
      `🃏 **كود نيمز** — فريقين يخمنوا الكلمات السرية\n` +
      `📞 **الهاتف المكسور** — سلسلة وصف وتخمين مضحكة\n` +
      `😂 **صنع الميم** — اكتب أحلى كابشن وفوز بالكوينز\n` +
      `🧠 **مسابقة** — أسئلة ثقافية، أول واحد يجاوب صح يكسب الكوينز\n\n` +
      `⚔️ **/مصارعة** — تحدى أي حد بالكلام\n` +
      `🛒 **/متجر-قدرات** — اشتري قدرات خاصة للألعاب`
    )
    .setFooter({ text: "💡 تحتاج 3+ لاعبين لمعظم الألعاب — دعوّ أصحابك!" })
    .setTimestamp();
}

function buildHubRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_rlt").setLabel("🎰 روليت").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ghub_maf").setLabel("🕵️ مافيا").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ghub_ttt").setLabel("❌ اكس-اوه").setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_cdn").setLabel("🃏 كود نيمز").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 الهاتف المكسور").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 صنع الميم").setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_quiz").setLabel("🧠 مسابقة").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_rps").setLabel("✂️ حجر ورقة مقص").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_cancel").setLabel("🚫 إلغاء اللعبة").setStyle(ButtonStyle.Danger),
    ),
  ];
}

export async function handleGamesHubCommand(interaction) {
  return interaction.reply({ embeds: [buildHubEmbed()], components: buildHubRows() });
}

// ── احدث المميزات ─────────────────────────────────────────────
function buildFeaturesEmbed() {
  return new EmbedBuilder()
    .setColor(0x3498db).setTitle("✨ أحدث مميزات زنجي بوت")
    .setDescription("كل ده جديد — جرّب كل حاجة! 🚀")
    .addFields(...LATEST_FEATURES)
    .setFooter({ text: "زنجي بوت — دايماً في تطور 🤖" })
    .setTimestamp();
}

function buildFeaturesRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_cdn").setLabel("🃏 جرّب كود نيمز").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 جرّب الهاتف المكسور").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 جرّب صنع الميم").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function handleLatestFeaturesCommand(interaction) {
  return interaction.reply({ embeds: [buildFeaturesEmbed()], components: buildFeaturesRows() });
}
