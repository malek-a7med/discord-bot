// ═══════════════════════════════════════════════════════════════
//  🎮 Games Hub + احدث المميزات + تغيير طريقة الكلام
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";

// ══════════════════════════════════════════════════════════════
//  قائمة أحدث المميزات
//  ⚠️ قاعدة: أي ميزة جديدة لازم تتضاف هنا قبل ما تتعمل push
//  أضف entry جديد في الأول (الأحدث فوق) باستخدام نفس الشكل
// ══════════════════════════════════════════════════════════════
export const LATEST_FEATURES = [
  {
    name: "✂️ حجر ورقة مقص متقدم — جديد!",
    value: "مش بس حجر ورقة مقص — اختار **أي حاجة في الكون** (سيف، ثقب أسود، فرعون...) والـ AI يحكم مين يفوز ولماذا 🤖\n→ `/حجر-ورقة-مقص` أو من `/الألعاب`",
    inline: false,
  },
  {
    name: "😈 وضع الكلام التوكسيك — جديد!",
    value: "للأونر: وضع كلام جديد — البوت بقى يرد بحدة وبيشتم لو حد شتمه!\n→ `/تغيير-طريقة-الكلام` واختار **توكسيك**",
    inline: false,
  },
  {
    name: "🔍 البحث عن أعضاء بالاسم — جديد!",
    value: "مش محتاج تمنشن أو ID — كتب اسم العضو مباشرة في أوامر الطرد والتحذير والتبنيد والإسكات!\nمثال: `/طرد malek`",
    inline: false,
  },
  {
    name: "📋 قائمة التحذيرات — جديد!",
    value: "اعرض كل تحذيرات أي عضو بتفاصيل كاملة (السبب + المشرف + التاريخ)\n→ `/تحذيرات`",
    inline: false,
  },
  {
    name: "🛡️ Auto-Mod تشغيل/إيقاف — جديد!",
    value: "للأونر: شغّل أو أوقف نظام Auto-Mod في أي وقت\n→ `/auto-mod`",
    inline: false,
  },
  {
    name: "🧠 لعبة المسابقة",
    value: "أسئلة ثقافية متعددة الخيارات — أول واحد يجاوب صح يكسب **100 كوينز + 30 XP**!\n→ من `/الألعاب` فقط",
    inline: false,
  },
  {
    name: "📊 نظام الاستفتاءات",
    value: "أنشئ استفتاء في أي روم بسؤال وخيارات، والنتايج تلقائياً بعد المدة\n→ `/استفتاء`",
    inline: false,
  },
  {
    name: "📞 الهاتف المكسور",
    value: "سلسلة وصف وتخمين مضحكة!\nاكتب جملة → التاني يصفها → التالت يخمنها → ضحك مضمون\n→ `/الهاتف-المكسور`",
    inline: false,
  },
  {
    name: "😂 صنع الميم",
    value: "البوت يختار موقف مضحك مع GIF أنيمي/جيمنج — إنت تكتب كابشن — الكل يصوت!\nالفائز يكسب **200 كوينز** 🪙 + 10 محاولات للتغيير\n→ `/صنع-الميم`",
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
        { name: "🎩 محترم — رد لطيف ومودّب، مفيش شتايم خالص", value: "normal" },
        { name: "😈 حر — لو حد شتم البوت، يرد بنفس الشتيمة", value: "free" },
        { name: "☠️ توكسيك — شتايم في أغلب كلامه", value: "toxic" },
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
      `🧠 **مسابقة** — أسئلة ثقافية، أول واحد يجاوب صح يكسب الكوينز\n` +
      `✂️ **حجر ورقة مقص** — اختار أي حاجة في الكون والـ AI يحكم!\n\n` +
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
      new ButtonBuilder().setCustomId("ghub_rps").setLabel("✂️ جرّب حجر ورقة مقص").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 جرّب الهاتف المكسور").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 جرّب صنع الميم").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function handleLatestFeaturesCommand(interaction) {
  return interaction.reply({ embeds: [buildFeaturesEmbed()], components: buildFeaturesRows() });
}
