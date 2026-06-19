// ═══════════════════════════════════════════════════════════════
//  🧠 لعبة المسابقة — Quiz Game
//  أول واحد يجاوب صح يكسب الكوينز — بدون أمر مستقل، من /الألعاب بس
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const quizChannelMap = new Map(); // channelId → game state

const QUIZ_QUESTIONS = [
  { q: "🔢 كم ناتج 7 × 8؟",                      opts: ["52", "56", "64", "48"],       ans: 1 },
  { q: "🌍 ما عاصمة فرنسا؟",                      opts: ["برلين", "باريس", "روما", "مدريد"], ans: 1 },
  { q: "⚽ كم عدد لاعبي الفريق في كرة القدم؟",   opts: ["9", "10", "11", "12"],          ans: 2 },
  { q: "🌊 ما أكبر محيط في العالم؟",              opts: ["الهندي", "الأطلسي", "الهادئ", "المتجمد الشمالي"], ans: 2 },
  { q: "🔬 ما رمز عنصر الذهب في الجدول الدوري؟", opts: ["Gd", "Go", "Au", "Ag"],          ans: 2 },
  { q: "🎨 ما اللون الناتج عن خلط الأحمر والأصفر؟", opts: ["بنفسجي", "برتقالي", "أخضر", "بني"], ans: 1 },
  { q: "📚 كم عدد سور القرآن الكريم؟",            opts: ["112", "113", "114", "115"],     ans: 2 },
  { q: "🏆 كم مرة فاز البرازيل بكأس العالم؟",     opts: ["4", "5", "6", "3"],              ans: 1 },
  { q: "🧬 ما أطول عظمة في جسم الإنسان؟",         opts: ["العمود الفقري", "عظمة الذراع", "عظمة الفخذ", "عظمة الساق"], ans: 2 },
  { q: "🌙 كم يوماً يأخذ القمر ليدور حول الأرض؟", opts: ["25", "27", "29", "31"],          ans: 2 },
  { q: "⚡ ما وحدة قياس الكهرباء (التيار)؟",       opts: ["فولت", "واط", "أمبير", "أوم"],   ans: 2 },
  { q: "🎭 ما اسم بطل انمي Naruto الكامل؟",        opts: ["ناروتو أوزوماكي", "ناروتو أوتشيها", "ناروتو ناميكازي", "ناروتو هيوغا"], ans: 0 },
  { q: "🗺️ ما أكبر دولة في العالم من حيث المساحة؟", opts: ["الصين", "كندا", "أمريكا", "روسيا"], ans: 3 },
  { q: "🔭 ما أقرب كوكب للشمس؟",                  opts: ["الزهرة", "الأرض", "عطارد", "المريخ"], ans: 2 },
  { q: "🏛️ أين توجد الأهرامات الشهيرة؟",          opts: ["العراق", "المكسيك", "مصر", "اليونان"],  ans: 2 },
  { q: "💻 من مؤسس شركة Microsoft؟",              opts: ["ستيف جوبز", "بيل غيتس", "مارك زوكربيرج", "إيلون ماسك"], ans: 1 },
  { q: "🎵 ما عدد النوتات الموسيقية الأساسية؟",    opts: ["5", "6", "7", "8"],              ans: 2 },
  { q: "🦁 ما أسرع حيوان بري في العالم؟",          opts: ["الأسد", "النمر", "الفهد", "الغزال"], ans: 2 },
  { q: "🌋 ما أطول جبل في العالم؟",               opts: ["كليمنجارو", "إيفرست", "K2", "مونت بلان"], ans: 1 },
  { q: "🎲 كم وجهاً للمكعب (النرد)؟",             opts: ["4", "5", "6", "8"],              ans: 2 },
];

const OPTION_LABELS = ["أ", "ب", "ج", "د"];
const COINS_REWARD = 100;

function pickQuestion() {
  return QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
}

function buildQuizEmbed(question, timeLeft = 30) {
  const optLines = question.opts.map((o, i) => `**${OPTION_LABELS[i]}.** ${o}`).join("\n");
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🧠 مسابقة ثقافية!")
    .setDescription(`**السؤال:**\n> ${question.q}\n\n${optLines}\n\n⏱️ عندكم **${timeLeft} ثانية** — أول واحد يجاوب صح يكسب **${COINS_REWARD} كوينز** 🪙`)
    .setFooter({ text: "اضغط على الحرف الصح!" })
    .setTimestamp();
}

function buildQuizRows(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    ...OPTION_LABELS.map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`quiz_ans_${gameId}_${i}`)
        .setLabel(label)
        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(disabled)
    )
  )];
}

export async function startQuizGame(interaction) {
  const channelId = interaction.channel.id;
  if (quizChannelMap.has(channelId))
    return interaction.reply({ content: "❌ في مسابقة شغالة في الروم ده!", flags: 64 });

  const question = pickQuestion();
  const gameId = `qz${Date.now().toString(36)}`;
  const state = { gameId, question, channelId, messageId: null, answered: false, timer: null };

  quizChannelMap.set(channelId, state);

  const msg = await interaction.reply({
    embeds: [buildQuizEmbed(question)],
    components: buildQuizRows(gameId),
    fetchReply: true,
  });
  state.messageId = msg.id;

  state.timer = setTimeout(async () => {
    if (!quizChannelMap.has(channelId)) return;
    quizChannelMap.delete(channelId);
    const correctOpt = question.opts[question.ans];
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x555555).setTitle("⏰ انتهى الوقت!")
        .setDescription(`محدش جاوب في الوقت!\n\n✅ **الإجابة الصحيحة:** ${OPTION_LABELS[question.ans]}. **${correctOpt}**`)
        .setTimestamp()],
      components: buildQuizRows(gameId, true),
    }).catch(() => {});
  }, 30_000);
}

export async function handleQuizButton(interaction, db) {
  const parts   = interaction.customId.split("_");
  const gameId  = parts[2];
  const chosen  = parseInt(parts[3], 10);

  const state = [...quizChannelMap.values()].find(s => s.gameId === gameId);
  if (!state) return interaction.reply({ content: "❌ المسابقة انتهت!", flags: 64 });
  if (state.answered) return interaction.reply({ content: "✅ حد أجاب قبلك!", flags: 64 });

  const { question, channelId } = state;
  state.answered = true;
  if (state.timer) clearTimeout(state.timer);
  quizChannelMap.delete(channelId);

  if (chosen === question.ans) {
    // إجابة صحيحة
    if (db) {
      const u = db.getUser(interaction.user.id);
      u.coins = (u.coins || 0) + COINS_REWARD;
      u.xp    = (u.xp    || 0) + 30;
      db.updateUser(interaction.user.id, u);
    }
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("🎉 إجابة صحيحة!")
        .setDescription(
          `✅ **${OPTION_LABELS[chosen]}. ${question.opts[chosen]}** — صح!\n\n` +
          `🏆 **${interaction.user.displayName}** يكسب **${COINS_REWARD} كوينز** و **30 XP** 🎉`
        ).setTimestamp()],
      components: buildQuizRows(gameId, true),
    });
  } else {
    // إجابة غلط
    const correctOpt = question.opts[question.ans];
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌ إجابة غلط!")
        .setDescription(
          `**${interaction.user.displayName}** جاوب: **${OPTION_LABELS[chosen]}. ${question.opts[chosen]}** — غلط!\n\n` +
          `✅ **الإجابة الصحيحة:** ${OPTION_LABELS[question.ans]}. **${correctOpt}**`
        ).setTimestamp()],
      components: buildQuizRows(gameId, true),
    });
  }
}
