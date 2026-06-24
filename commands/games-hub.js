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
    name: "🔧 إصلاح تلقائي + كاشف الأخطاء!",
    value: "**أمرين جدد للأونر:**\n🔍 `/كاشف-الأخطاء` — فحص 16 نقطة في البوت وتقرير شامل في الروم\n🔧 `/إصلاح-تلقائي` — إصلاح فوري للمشاكل: استرجاع مفاتيح Gemini المحروقة، مسح الألعاب المتعلقة، تجديد لوحة الاقتراحات، تنظيف الذاكرة\n→ كلاهما [أونر فقط] وبيبعتوا تقرير في روم التشخيص",
    inline: false,
  },
  {
    name: "🌍 لعبة الحياة — نظام جديد بالكامل!",
    value: "بقت **نظام اقتصادي شخصي مستمر** بدل المواقف والجولات القديمة!\n💼 5 مستويات وظائف (من دليفري لرجل أعمال)\n🏠 ممتلكات (بيت، عربية، شركة) بدخل ومصاريف حقيقية\n💸 نظام ديون واقعي — إنذارات وعقوبات لو اتأخرت في السداد\n🔁 حوّل فلوس لأصحابك وشوف ترتيب أغنى أعضاء السيرفر\n→ `/حياة` (بكل الأوامر الفرعية) أو من `/الألعاب`",
    inline: false,
  },
  {
    name: "🤖 اكس-اوه ضد الذكاء الاصطناعي!",
    value: "دلوقتي تقدر تلعب اكس-اوه ضد **AI لا يُهزم** يستخدم خوارزمية Minimax!\n❌ إنت (X) ضد 🤖 AI (O) — جرّب تكسبه لو قدرت!\n🏆 لو كسبت بتاخد **200 كوينز** — والتعادل مجاني!\n→ `/اكس-اوه` (من غير خصم) أو من `/الألعاب` → 🤖 اكس-اوه ضد AI",
    inline: false,
  },
  {
    name: "🎰 بنك الحظ المصري!",
    value: "كرتونة بنك الحظ الأوتنتك! دوّر العجلة وشوف هتوقف على رقم كام\nمن **خسارة كل حاجة 💀** لـ **10 أضعاف رهانك 🎉**\n→ `/بنك-الحظ-مصري`",
    inline: false,
  },
  {
    name: "🃏 كود نيمز — محدّث كلياً!",
    value: "**تلميح عن طريق زرار → فورم** مش كتابة في الشات!\n**SPYMASTER** يستقبل خريطة الكلمات السرية في الخاص تلقائياً\n⚙️ زرار **إعدادات الوقت** — تقدر تحدد وقت لكل جولة (1-10 دق)\n⬜ محايدة = دورك انتهى فوراً | 💀 قاتل = خسارة فورية!\n→ `/كود-نيمز` أو من `/الألعاب`",
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
      new ButtonBuilder().setCustomId("ghub_cancel").setLabel("🚫 إلغاء الروم").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ghub_closeall").setLabel("🛑 إقفال كل الألعاب").setStyle(ButtonStyle.Danger),
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
