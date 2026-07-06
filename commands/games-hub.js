// ═══════════════════════════════════════════════════════════════
//  🎮 Games Hub + احدث المميزات + تغيير طريقة الكلام
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
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
    .setColor(0x9b59b6)
    .setTitle("🎮 مركز الألعاب — زنجي بوت")
    .setDescription("اختار اللعبة اللي عايز تلعبها من القايمة تحت 👇\nولو محتاج قدرات خاصة، جرّب `/متجر-قدرات`")
    .addFields(
      {
        name: "⚔️ ألعاب جماعية",
        value: "🎰 **روليت** — روليت روسية، آخر ناجي ياخد الكوينز\n🕵️ **مافيا** — اكشف المافيا قبل ما يقضوا على البلدة\n🃏 **كود نيمز** — فريقين يخمنوا الكلمات السرية\n📞 **الهاتف المكسور** — سلسلة وصف وتخمين مضحكة",
        inline: false,
      },
      {
        name: "🧠 ألعاب فردية وتحدي",
        value: "❌⭕ **اكس-اوه** — ضد لاعب أو ضد الذكاء الاصطناعي 🤖\n🪨 **ح.و.م العادية** — حجر ورقة مقص كلاسيك\n✂️ **ح.و.م الخارقة** — اختار أي حاجة والـ AI يحكم!\n🧠 **مسابقة** — أسئلة ثقافية بجوايز\n😂 **صنع الميم** — اكتب أحلى كابشن",
        inline: false,
      },
      {
        name: "💰 اقتصاد وحظ",
        value: "🌍 **الحياة** — نظام اقتصادي مستمر: شغل، ممتلكات، وثروة\n🎰 **بنك الحظ المصري** — دوّر العجلة وارفع رصيدك\n🏦 **البنك المركزي** — أمر `/بنك` بقايمة اختيار كاملة",
        inline: false,
      },
    )
    .setFooter({ text: "💡 تحتاج 3+ لاعبين لمعظم الألعاب الجماعية — دعوّ أصحابك!" })
    .setTimestamp();
}

function buildHubSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ghub_menu")
    .setPlaceholder("🎮 اختار لعبة تبدأها دلوقتي...")
    .addOptions(
      { label: "روليت", value: "ghub_rlt", emoji: "🎰", description: "روليت روسية جماعية" },
      { label: "مافيا", value: "ghub_maf", emoji: "🕵️", description: "اكشف المافيا" },
      { label: "اكس-اوه", value: "ghub_ttt", emoji: "❌", description: "ضد لاعب أو AI" },
      { label: "كود نيمز", value: "ghub_cdn", emoji: "🃏", description: "فريقين وكلمات سرية" },
      { label: "الهاتف المكسور", value: "ghub_gar", emoji: "📞", description: "سلسلة وصف وتخمين" },
      { label: "صنع الميم", value: "ghub_meme", emoji: "😂", description: "أحلى كابشن يفوز" },
      { label: "مسابقة", value: "ghub_quiz", emoji: "🧠", description: "أسئلة ثقافية" },
      { label: "ح.و.م العادية", value: "ghub_rps_easy", emoji: "🪨", description: "حجر ورقة مقص كلاسيك" },
      { label: "ح.و.م الخارقة", value: "ghub_rps_ai", emoji: "✂️", description: "أي حاجة والـ AI يحكم" },
      { label: "الحياة", value: "ghub_banklife", emoji: "🌍", description: "نظام اقتصادي مستمر" },
      { label: "بنك الحظ المصري", value: "ghub_bankluck", emoji: "🎰", description: "دوّر العجلة وارفع رصيدك" },
    );
  return new ActionRowBuilder().addComponents(menu);
}

function buildHubActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ghub_cancel").setLabel("🚫 إلغاء").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ghub_closeall").setLabel("🛑 إقفال الكل [إدارة]").setStyle(ButtonStyle.Danger),
  );
}

function buildHubRows() {
  return [buildHubSelectRow(), buildHubActionRow()];
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
