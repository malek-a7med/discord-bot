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
    name: "🃏 كود نيمز — محدّث كلياً! — جديد!",
    value: "**تلميح عن طريق زرار → فورم** مش كتابة في الشات!\n**SPYMASTER** يستقبل خريطة الكلمات السرية في الخاص تلقائياً\n⚙️ زرار **إعدادات الوقت** — تقدر تحدد وقت لكل جولة (1-10 دق)\n⬜ محايدة = دورك انتهى فوراً | 💀 قاتل = خسارة فورية!\n🌐 **لعب اللعبة الأصلية** دلوقتي بيطلع فورم رابط دعوة\n→ `/كود-نيمز` أو من `/الألعاب`",
    inline: false,
  },
  {
    name: "😂 صنع الميم — محدّث كلياً! — جديد!",
    value: "البوت يبعت GIF أنيمي/جيمنج في الخاص لكل لاعب!\n◀️ **رجوع** | 🔄 **غير الـ GIF** | ✍️ **اكتب كابشن** — كلها من الـ DM!\nكل لاعب يختار GIF مختلف ويكتب كابشنه الخاص عليه\nزرار **⬇️ تنزيل الميم الفايز** بيجي مع النتيجة!\n→ `/صنع-الميم` أو من `/الألعاب`",
    inline: false,
  },
  {
    name: "🌍 الحياة — أسطورية ومنفردة! — جديد!",
    value: "دلوقتي تقدر تلعب **لوحدك** بدون ما تحتاج حد تاني!\n12 جولة كاملة — 5 مراحل: 👶 طفولة → 🎓 تعليم → 💼 شغل → 👨‍👩‍👧 أسرة → 🏖️ تقاعد\nأحداث أسطورية كاملة: زواج، شراء شقة/عربية، ترقية، استثمار، أولاد والمزيد!\n→ `/الألعاب` → الحياة",
    inline: false,
  },
  {
    name: "📞 الهاتف المكسور — محدّث! — جديد!",
    value: "🌐 **لعب اللعبة الأصلية** دلوقتي بيطلع **فورم رابط دعوة** تبعته للكل\n❌ زرار **الإلغاء** في أي لعبة دلوقتي بيمسح الرسالة فوراً\n→ `/الهاتف-المكسور` أو من `/الألعاب`",
    inline: false,
  },
  {
    name: "🎰 بنك الحظ — جديد!",
    value: "دوّر عجلة الحظ! 12 شريحة مختلفة — +200 | +500 | +1000 | +1500 | +2000 | جاكبوت +5000 | -200 | -500 | -1000 | ×2 | إفلاس | سرقة\nالفايز بأعلى رصيد يكسب كوينز!\n→ من `/الألعاب` بس",
    inline: false,
  },
  {
    name: "🗳️ تغيير الصوت في الاستفتاء — جديد!",
    value: "دلوقتي تقدر تغيّر صوتك في الاستفتاء لو غيّرت رأيك — مش مقفول على اختيارك الأول!\n→ `/استفتاء`",
    inline: false,
  },
  {
    name: "🌐 رابط اللعبة الأصلية — قابل للضغط — جديد!",
    value: "زرار **لعب اللعبة الأصلية** بقا رابط مباشر قابل للضغط — مش مجرد نص!\n→ في لوبي الهاتف المكسور، كود نيمز، وصنع الميم",
    inline: false,
  },
  {
    name: "✏️ /تعديل-رول — محدّث! — جديد!",
    value: "الأمر اتبسّط — دلوقتي تقدر تعدّل **الاسم + اللون + الصلاحيات** من أمر واحد!\nاللون بيتعرف تلقائياً وبيُطبَّق على الرول فوراً\n→ `/تعديل-رول`",
    inline: false,
  },
  {
    name: "🪨 حجر ورقة مقص — نسختين! — جديد!",
    value: "**العادية 🪨** — كلاسيك حجر ورقة مقص، بدون AI، نتيجة فورية\n**الخارقة ✂️** — اختار **أي حاجة في الكون** (سيف، ثقب أسود، فرعون...) والـ AI يحكم مين يفوز!\n→ من `/الألعاب` بس",
    inline: false,
  },
  {
    name: "🎮 الألعاب من /الألعاب بس — جديد!",
    value: "كل ألعاب الهب دلوقتي بس من `/الألعاب` — مفيش أوامر مستقلة لكل لعبة\nعشان يبقى كل حاجة في مكان واحد منظم 🗂️",
    inline: false,
  },
  {
    name: "🕌 تحديات أسبوعية — جديد!",
    value: "التحديات بقت **أسبوعية** — كل جمعة بعد الصلاة (الساعة 1 ظهراً) 🗓️\nمش كل يوم، ومش بيبعت عند ريستارت البوت\n→ بالتلقائي في الروم المخصص",
    inline: false,
  },
  {
    name: "🌐 لعب اللعبة الأصلية",
    value: "في لوبي الهاتف المكسور، كود نيمز، وصنع الميم — فيه زرار **لعب اللعبة الأصلية** 🎮\nاضغط عليه والبوت يبعت رابط الدعوة للروم!\n→ من لوبي أي لعبة من الثلاثة",
    inline: false,
  },
  {
    name: "💬 أوضاع الكلام الجديدة",
    value: "3 أوضاع للبوت:\n🎩 **محترم** — مفيش شتايم خالص\n😈 **حر** — لو حد شتمه يرد بنفس الشتيمة\n☠️ **توكسيك** — شتايم في أغلب كلامه\n→ `/تغيير-طريقة-الكلام` [أونر فقط]",
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
      `🪨 **ح.و.م العادية** — حجر ورقة مقص كلاسيك، بدون AI\n` +
      `✂️ **ح.و.م الخارقة** — اختار أي حاجة في الكون والـ AI يحكم!\n` +
      `🌍 **الحياة** — عيش حياة كاملة (تعليم→شغل→أسرة→استثمار→تقاعد) واكسب أعلى نقاط!\n` +
      `🎰 **بنك الحظ** — دوّر عجلة الحظ وارفع رصيدك — أكتر فلوس يفوز!\n\n` +
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
      new ButtonBuilder().setCustomId("ghub_cdn").setLabel("🃏 كود نيمز").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 الهاتف المكسور").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 صنع الميم").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_quiz").setLabel("🧠 مسابقة").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_rps_easy").setLabel("🪨 ح.و.م العادية").setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_rps_ai").setLabel("✂️ ح.و.م الخارقة").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ghub_banklife").setLabel("🌍 الحياة").setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_bankluck").setLabel("🎰 بنك الحظ").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_cancel").setLabel("🚫 إلغاء").setStyle(ButtonStyle.Danger),
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
      new ButtonBuilder().setCustomId("ghub_rps_easy").setLabel("🪨 ح.و.م العادية").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_rps_ai").setLabel("✂️ ح.و.م الخارقة").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 الهاتف المكسور").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 صنع الميم").setStyle(ButtonStyle.Primary),
    ),
  ];
}

export async function handleLatestFeaturesCommand(interaction) {
  return interaction.reply({ embeds: [buildFeaturesEmbed()], components: buildFeaturesRows() });
}
