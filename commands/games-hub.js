// ═══════════════════════════════════════════════════════════════
//  🎮 Games Hub + احدث المميزات + تغيير طريقة الكلام
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";

// ══════════════════════════════════════════════════════════════
//  قائمة أحدث المميزات
//
//  ⚠️ قواعد إلزامية — لازم تتبعها قبل أي push:
//    1. أضف الميزة الجديدة في الأول (الأحدث فوق دايماً)
//    2. احذف آخر entry عشان الـ Array يفضل 5 عناصر بس
//    3. الـ Array لازم يكون 5 عناصر دايماً — مش أكتر مش أقل
//    الهدف: /احدث-المميزات يعرض الجديد بس — مش تاريخ كامل
// ══════════════════════════════════════════════════════════════
export const LATEST_FEATURES = [
  {
    name: "🏦 البنك المركزي — أمر واحد وقايمة اختيار بس!",
    value: "نظام بنك جديد بالكامل ومستقل، مستوحى من أشهر بوتات البنوك بس أقوى!\n💳 أمر واحد بس: `/بنك` — كل حاجة من قايمة اختيار (Select Menu)\n💵 مطالبة وراتب — دخل دوري ثابت\n🔫 نهب — اسرق من رصيد حد تاني حسب مستوى الأمان\n🏆 متصدرين — أغنى أعضاء البنك المركزي\n📰 خبر الأنمي بقى بينزل مباشر في الروم من غير أي ثريد",
    inline: false,
  },
  {
    name: "🤝 AI Companion — زنجي بيتذكرك شخصياً!",
    value: "زنجي دلوقتي عنده **ذاكرة شخصية** لكل عضو!\n🧠 بيتذكر اهتماماتك، شخصيتك، وآخر مواضيع اتكلمتوا فيها\n📊 `/رفيقي` — شوف اللي زنجي يعرفه عنك\n🗑️ `/امسح-ذاكرتك` — امسح معلوماتك وابدأ من الصفر\n💬 كل ما اتكلمت معاه بيتحسن فهمه ليك تلقائياً",
    inline: false,
  },
  {
    name: "🎵 خلفية الموسيقى + سبوتيفاي + ردود ذكية!",
    value: "**3 تحديثات دفعة واحدة:**\n🖼️ خلفية كارت الموسيقى اتغيرت لصورة الفراعنة الجديدة\n🟢 `/شغل` دلوقتي بيدعم روابط **Spotify** مباشرة (أغاني + بلاي ليستات)\n💬 البوت دلوقتي بيرد لو **منشنته @** أو **عملت ريبلاي** على رسالته في الشات\n👑 الأونر بيقول **\"يا زنجي\"** بالظبط (لوحدها) والبوت يرد على طول",
    inline: false,
  },
  {
    name: "🎌 إصلاح الأنمي — بحث عربي + قايمة محدثة!",
    value: "**تحديثان للنظام:**\n🔍 البحث عن أنمي بالعربي شغال تماماً — الـ AI بيترجمه للإنجليزي تلقائياً قبل البحث\n📋 لما تضيف أنمي لقايمتك هيظهر زرار **\"عرض قائمتي\"** فوراً عشان تشوف القايمة المحدثة\n💬 `/تغيير-طريقة-الكلام` فيه خيار اللهجة (مصري / فصحى) بالإضافة للأسلوب",
    inline: false,
  },
  {
    name: "🌍 لعبة الحياة — نظام جديد بالكامل!",
    value: "بقت **نظام اقتصادي شخصي مستمر** بدل المواقف والجولات القديمة!\n💼 5 مستويات وظائف (من دليفري لرجل أعمال)\n🏠 ممتلكات (بيت، عربية، شركة) بدخل ومصاريف حقيقية\n💸 نظام ديون واقعي — إنذارات وعقوبات لو اتأخرت في السداد\n🔁 حوّل فلوس لأصحابك وشوف ترتيب أغنى أعضاء السيرفر\n→ `/حياة` (بكل الأوامر الفرعية) أو من `/الألعاب`",
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
    opt.setName("أسلوب").setDescription("اختر الأسلوب المطلوب").setRequired(false)
      .addChoices(
        { name: "🎩 محترم — 0% شتايم", value: "normal" },
        { name: "😈 باد بوي — 50%", value: "free" },
        { name: "☠️ إكستريم — 100%", value: "toxic" },
      )
  )
  .addStringOption(opt =>
    opt.setName("لهجة").setDescription("اختر لهجة البوت").setRequired(false)
      .addChoices(
        { name: "🇪🇬 مصري — عامية مصرية طبيعية", value: "egyptian" },
        { name: "🌐 عربي — فصحى / عربي رسمي", value: "fus-ha" },
      )
  );

function buildHubEmbed() {
  return new EmbedBuilder()
    .setColor(0x9b59b6).setTitle("🎮 مركز الألعاب — زنجي بوت")
    .setDescription(
      `**اضغط على أي لعبة عشان تبدأها في الروم ده الحين!**\n\n` +
      `🎰 **روليت** — روليت روسية، آخر ناجي يأخذ الكوينز\n` +
      `🕵️ **مافيا** — اكشف المافيا قبل ما يقضوا على البلدة\n` +
      `❌⭕ **اكس-اوه** — تيك تاك تو ضد لاعب أو ضد الذكاء الاصطناعي 🤖\n` +
      `🃏 **كود نيمز** — فريقين يخمنوا الكلمات السرية\n` +
      `📞 **الهاتف المكسور** — سلسلة وصف وتخمين مضحكة\n` +
      `😂 **صنع الميم** — اكتب أحلى كابشن وفوز بالكوينز\n` +
      `🧠 **مسابقة** — أسئلة ثقافية، أول واحد يجاوب صح يكسب الكوينز\n` +
      `🪨 **ح.و.م العادية** — حجر ورقة مقص كلاسيك، بدون AI\n` +
      `✂️ **ح.و.م الخارقة** — اختار أي حاجة في الكون والـ AI يحكم!\n` +
      `🌍 **الحياة** — نظام اقتصادي مستمر! شغل، اشتري ممتلكات، وابني ثروتك\n` +
      `🎰 **بنك الحظ المصري** — كرتونة بنك الحظ الأوتنتك، دوّر العجلة وارفع رصيدك!\n\n` +
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
      new ButtonBuilder().setCustomId("ghub_bankluck").setLabel("🎰 بنك الحظ المصري").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_cancel").setLabel("🚫 إلغاء").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ghub_closeall").setLabel("🛑 إقفال الكل [إدارة]").setStyle(ButtonStyle.Danger),
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
