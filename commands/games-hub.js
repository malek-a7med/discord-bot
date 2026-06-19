// ═══════════════════════════════════════════════════════════════
//  🎮 Games Hub + احدث المميزات + تغيير طريقة الكلام
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";

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
      `📞 **جارتك فون** — سلسلة وصف وتخمين مضحكة\n` +
      `😂 **ميم جيم** — اكتب أحلى كابشن وفوز بالكوينز\n\n` +
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
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 جارتك فون").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 ميم جيم").setStyle(ButtonStyle.Primary),
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
    .addFields(
      {
        name: "🃏 كود نيمز — جديد!",
        value: "لعبة الكلمات السرية الشهيرة بالعربي!\n25 كلمة على لوحة 5×5 — فريقين — قائد سري يعطي إشارات\n→ `/كود-نيمز`",
        inline: false,
      },
      {
        name: "📞 جارتك فون — جديد!",
        value: "سلسلة وصف وتخمين مضحكة!\nاكتب جملة → التاني يصفها → التالت يخمنها → ضحك مضمون\n→ `/جارتك-فون`",
        inline: false,
      },
      {
        name: "😂 ميم جيم — جديد!",
        value: "البوت يختار موقف مضحك — إنت تكتب كابشن — الكل يصوت!\nالفائز يكسب **200 كوينز** 🪙\n→ `/ميم-جيم`",
        inline: false,
      },
      {
        name: "🎮 مركز الألعاب — جديد!",
        value: "كل الألعاب في مكان واحد — اضغط زرار وابدأ!\n→ `/الألعاب`",
        inline: true,
      },
      {
        name: "💬 أسلوب كلام البوت — جديد!",
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
        value: "الآن يستخدم Gemini AI عشان يفهم السياق ويفرق بين الكلام العادي والمحتوى الفعلاً ضار",
        inline: false,
      },
    )
    .setFooter({ text: "زنجي بوت — دايماً في تطور 🤖" })
    .setTimestamp();
}

function buildFeaturesRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ghub_cdn").setLabel("🃏 جرّب كود نيمز").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ghub_gar").setLabel("📞 جرّب جارتك").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ghub_meme").setLabel("😂 جرّب ميم جيم").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function handleLatestFeaturesCommand(interaction) {
  return interaction.reply({ embeds: [buildFeaturesEmbed()], components: buildFeaturesRows() });
}
