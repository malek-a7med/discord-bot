// ═══════════════════════════════════════════════════════════════
//  🎮 مركز الألعاب + أحدث المميزات + تغيير طريقة الكلام
//  ⚜️ Black & Gold Luxury Theme
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} from "discord.js";
import { COLORS, footer } from "../helpers/theme.js";

// ══════════════════════════════════════════════════════════════
//  قائمة أحدث المميزات
//  ⚠️ قواعد إلزامية:
//    1. أضف الميزة الجديدة في الأول (الأحدث فوق دايماً)
//    2. احذف آخر entry عشان الـ Array يفضل 5 عناصر
//    3. الـ Array لازم يكون 5 عناصر دايماً
// ══════════════════════════════════════════════════════════════
export const LATEST_FEATURES = [
  {
    name: "⚙️ /setup — لوحة إعداد شاملة للسيرفر!",
    value: "أمر واحد بيظبط كل حاجة في السيرفر الجديد من قايمة اختيار:\n👋 قناة الترحيب والوداع\n📜 قناة السجلات (Log)\n🪤 مصيدة الهاكرات (Honeypot) — per-guild\n🔐 بوابة التحقق — بيبعت الرسالة للروم اللي تختارها\n👮 رتب الإشراف الإضافية\n🛡️ الحماية ضد التخريب (Anti-Nuke)",
    inline: false,
  },
  {
    name: "🛡️ إعدادات الأوتو مود + حماية ضد التخريب!",
    value: "قايمة اختيار واحدة تظبط بيها كل نظام الحماية:\n⚙️ `/اعدادات-الاوتومود` — عتبات التحذيرات، رتب إشراف إضافية، وقناة سجلات الأمان\n🛡️ حماية ضد التخريب (Anti-Nuke) — لو حد عمل باند/طرد/حذف رتب/رومات كتير بسرعة بناخد فيه إجراء فوري\n👮 قدر تحدد رتب موثوقة زيادة عن المشرفين الأساسيين",
    inline: false,
  },
  {
    name: "🏆 لوحة الأكثر نشاطاً + بوابة تحقق + متجر بنكي!",
    value: "3 ميزات جديدة دفعة واحدة!\n🏆 `/top` — شوف أعلى 10 أعضاء حسب الـ XP بتصميم فرعوني\n🛡️ `/بوابة-التحقق` — رسالة زرار واحد توافق بيها على القوانين وتاخد رتبة Verified\n🛒 `/متجر` — اشتري رتب ومميزات بذهب البنك المركزي من قايمة اختيار واحدة",
    inline: false,
  },
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
];

// ── أوامر الأقسام ─────────────────────────────────────────────
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
        { name: "😈 باد بوي — 50%",    value: "free" },
        { name: "☠️ إكستريم — 100%",   value: "toxic" },
      )
  )
  .addStringOption(opt =>
    opt.setName("لهجة").setDescription("اختر لهجة البوت").setRequired(false)
      .addChoices(
        { name: "🇪🇬 مصري — عامية مصرية طبيعية", value: "egyptian" },
        { name: "🌐 عربي — فصحى / عربي رسمي",    value: "fus-ha" },
      )
  );

// ── إيمبد مركز الألعاب ────────────────────────────────────────
function buildHubEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("🎮 مركز الألعاب — زنجي بوت")
    .setDescription(
      "```\n⚜️  اختار لعبتك وابدأ الآن\n   من القايمة تحت 👇\n```"
    )
    .addFields(
      {
        name: "⚔️ ألعاب جماعية",
        value:
          "🎰 **روليت** — روليت روسية، آخر ناجي ياخد الكوينز\n" +
          "🕵️ **مافيا** — اكشف المافيا قبل ما يقضوا على البلدة\n" +
          "🃏 **كود نيمز** — فريقين يخمنوا الكلمات السرية\n" +
          "📞 **الهاتف المكسور** — سلسلة وصف وتخمين مضحكة",
        inline: false,
      },
      {
        name: "🧠 ألعاب فردية وتحدي",
        value:
          "❌⭕ **اكس-اوه** — ضد لاعب أو ضد الذكاء الاصطناعي 🤖\n" +
          "🪨 **ح.و.م العادية** — حجر ورقة مقص كلاسيك\n" +
          "✂️ **ح.و.م الخارقة** — اختار أي حاجة والـ AI يحكم!\n" +
          "🧠 **مسابقة** — أسئلة ثقافية بجوايز\n" +
          "😂 **صنع الميم** — اكتب أحلى كابشن",
        inline: false,
      },
      {
        name: "💰 اقتصاد وحظ",
        value:
          "🌍 **الحياة** — نظام اقتصادي مستمر: شغل، ممتلكات، وثروة\n" +
          "🎰 **بنك الحظ المصري** — دوّر العجلة وارفع رصيدك\n" +
          "🏦 **البنك المركزي** — أمر `/بنك` بقايمة اختيار كاملة",
        inline: false,
      },
    )
    .setFooter(footer("تحتاج 3+ لاعبين لمعظم الألعاب الجماعية — دعوّ أصحابك!"))
    .setTimestamp();
}

function buildHubSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ghub_menu")
    .setPlaceholder("🎮 اختار لعبة تبدأها دلوقتي...")
    .addOptions(
      { label: "روليت",          value: "ghub_rlt",      emoji: "🎰", description: "روليت روسية جماعية" },
      { label: "مافيا",          value: "ghub_maf",      emoji: "🕵️", description: "اكشف المافيا" },
      { label: "اكس-اوه",        value: "ghub_ttt",      emoji: "❌", description: "ضد لاعب أو AI" },
      { label: "كود نيمز",       value: "ghub_cdn",      emoji: "🃏", description: "فريقين وكلمات سرية" },
      { label: "الهاتف المكسور", value: "ghub_gar",      emoji: "📞", description: "سلسلة وصف وتخمين" },
      { label: "صنع الميم",      value: "ghub_meme",     emoji: "😂", description: "أحلى كابشن يفوز" },
      { label: "مسابقة",         value: "ghub_quiz",     emoji: "🧠", description: "أسئلة ثقافية" },
      { label: "ح.و.م العادية",  value: "ghub_rps_easy", emoji: "🪨", description: "حجر ورقة مقص كلاسيك" },
      { label: "ح.و.م الخارقة",  value: "ghub_rps_ai",  emoji: "✂️", description: "أي حاجة والـ AI يحكم" },
      { label: "الحياة",         value: "ghub_banklife", emoji: "🌍", description: "نظام اقتصادي مستمر" },
      { label: "بنك الحظ المصري",value: "ghub_bankluck", emoji: "🎰", description: "دوّر العجلة وارفع رصيدك" },
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

// ── أحدث المميزات ─────────────────────────────────────────────
function buildFeaturesEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.PALE_GOLD)
    .setTitle("✨ أحدث مميزات زنجي بوت")
    .setDescription("```\n⚜️  كل ده جديد — جرّب كل حاجة!\n```")
    .addFields(...LATEST_FEATURES)
    .setFooter(footer("زنجي بوت — دايماً في تطور"))
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
