// ═══════════════════════════════════════════════════════════════
//  🔥 الفعاليات الأسطورية — أحداث عشوائية ضخمة في روم مخصص
//  صندوق كنز، مطر ذهبي، سباق سريع، ملك التحدي
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const LEGENDARY_EVENTS_CHANNEL_ID = "1523688813132644532";

const EVENT_INTERVAL_MIN_MS = 3 * 60 * 60 * 1000;  // كل 3 ساعات كحد أدنى
const EVENT_INTERVAL_MAX_MS = 6 * 60 * 60 * 1000;  // كل 6 ساعات كحد أقصى
const MAX_WINNERS = 5;
const CLAIM_WINDOW_MS = 90 * 1000; // 90 ثانية للضغط

const EVENT_TYPES = [
  {
    type: "treasure",
    title: "🎁 صندوق الكنز الأسطوري",
    color: 0xf1c40f,
    reward: () => 500 + Math.floor(Math.random() * 1500),
    intro: (reward) => `ظهر **صندوق كنز أسطوري** في السيرفر! 🏆\nأول **${MAX_WINNERS}** أشخاص يضغطوا الزرار يكسبوا \`${reward}\` كوينز لكل واحد!`,
    buttonLabel: "افتح الصندوق",
    buttonEmoji: "🎁",
  },
  {
    type: "goldrain",
    title: "🌧️ المطر الذهبي",
    color: 0xffd700,
    reward: () => 300 + Math.floor(Math.random() * 900),
    intro: (reward) => `بدأ **المطر الذهبي** ينزل على السيرفر! 💰\nأول **${MAX_WINNERS}** أشخاص يمسكوا القطرة يكسبوا \`${reward}\` كوينز!`,
    buttonLabel: "امسك القطرة",
    buttonEmoji: "💧",
  },
  {
    type: "boss",
    title: "🐉 غزو الوحش الأسطوري",
    color: 0xe74c3c,
    reward: () => 800 + Math.floor(Math.random() * 2000),
    intro: (reward) => `وحش أسطوري هاجم السيرفر! ⚔️\nساعد في هزيمته — أول **${MAX_WINNERS}** أشخاص يضربوه يكسبوا \`${reward}\` كوينز من الغنيمة!`,
    buttonLabel: "اضرب الوحش",
    buttonEmoji: "⚔️",
  },
  {
    type: "portal",
    title: "🌀 بوابة الحظ الأسطورية",
    color: 0x9b59b6,
    reward: () => 400 + Math.floor(Math.random() * 1200),
    intro: (reward) => `اتفتحت **بوابة حظ أسطورية**! 🌀\nأول **${MAX_WINNERS}** أشخاص يدخلوها يكسبوا \`${reward}\` كوينز!`,
    buttonLabel: "ادخل البوابة",
    buttonEmoji: "🌀",
  },
];

let activeEvent = null;

function pickEvent() {
  return EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
}

function buildEventEmbed(type, reward, winners, ended) {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x555555 : type.color)
    .setTitle(ended ? `${type.title} — انتهت!` : type.title)
    .setDescription(
      ended
        ? (winners.length
            ? `🏆 **الفايزين:**\n${winners.map((w, i) => `${i + 1}. <@${w}>`).join("\n")}`
            : "😅 محدش لحق ياخد الجايزة!")
        : type.intro(reward) + (winners.length ? `\n\n✅ **فازوا لحد دلوقتي (${winners.length}/${MAX_WINNERS}):**\n${winners.map(w => `<@${w}>`).join(", ")}` : "")
    )
    .setFooter({ text: `🔥 الفعاليات الأسطورية — كل فعالية جديدة وأنت جاهز!` })
    .setTimestamp();
  return embed;
}

function buildEventRow(eventId, type, disabled) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`legev_claim_${eventId}`)
      .setLabel(type.buttonLabel)
      .setEmoji(type.buttonEmoji)
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  )];
}

export async function postLegendaryEvent(client, db) {
  const channel = await client.channels.fetch(LEGENDARY_EVENTS_CHANNEL_ID).catch(() => null);
  if (!channel) return console.error("❌ [LegendaryEvents] مش لاقي الروم:", LEGENDARY_EVENTS_CHANNEL_ID);

  const type = pickEvent();
  const reward = type.reward();
  const eventId = `lev${Date.now().toString(36)}`;

  const msg = await channel.send({
    content: "||@here||",
    allowedMentions: { parse: ["everyone"] },
    embeds: [buildEventEmbed(type, reward, [], false)],
    components: buildEventRow(eventId, type, false),
  });

  activeEvent = {
    eventId,
    type,
    reward,
    winnerIds: new Set(),
    ended: false,
    messageId: msg.id,
  };

  setTimeout(async () => {
    if (!activeEvent || activeEvent.eventId !== eventId || activeEvent.ended) return;
    activeEvent.ended = true;
    await msg.edit({
      embeds: [buildEventEmbed(type, reward, [...activeEvent.winnerIds], true)],
      components: buildEventRow(eventId, type, true),
    }).catch(() => {});
  }, CLAIM_WINDOW_MS);
}

export async function handleLegendaryEventButton(interaction, db) {
  const id = interaction.customId;
  if (!id.startsWith("legev_claim_")) return;
  const eventId = id.replace("legev_claim_", "");

  if (!activeEvent || activeEvent.eventId !== eventId || activeEvent.ended) {
    return interaction.reply({ content: "❌ الفعالية دي خلصت خلاص!", flags: 64 });
  }
  if (activeEvent.winnerIds.has(interaction.user.id)) {
    return interaction.reply({ content: "❌ إنت فزت في الفعالية دي بالفعل!", flags: 64 });
  }
  if (activeEvent.winnerIds.size >= MAX_WINNERS) {
    return interaction.reply({ content: "❌ اكتمل عدد الفايزين، حظ أوفر المرة الجاية!", flags: 64 });
  }

  activeEvent.winnerIds.add(interaction.user.id);

  const user = db.getUser(interaction.user.id);
  user.coins = (user.coins || 0) + activeEvent.reward;
  db.updateUser(interaction.user.id, user);

  await interaction.reply({ content: `🎉 مبروك! كسبت \`${activeEvent.reward}\` كوينز!`, flags: 64 });

  const done = activeEvent.winnerIds.size >= MAX_WINNERS;
  await interaction.message.edit({
    embeds: [buildEventEmbed(activeEvent.type, activeEvent.reward, [...activeEvent.winnerIds], done)],
    components: buildEventRow(eventId, activeEvent.type, done),
  }).catch(() => {});

  if (done) activeEvent.ended = true;
}

export function scheduleLegendaryEvents(client, db) {
  function scheduleNext() {
    const delay = EVENT_INTERVAL_MIN_MS + Math.floor(Math.random() * (EVENT_INTERVAL_MAX_MS - EVENT_INTERVAL_MIN_MS));
    setTimeout(() => {
      postLegendaryEvent(client, db).catch(console.error);
      scheduleNext();
    }, delay);
  }
  // أول فعالية بعد 10 دقايق من تشغيل البوت
  setTimeout(() => {
    postLegendaryEvent(client, db).catch(console.error);
    scheduleNext();
  }, 10 * 60 * 1000);

  console.log("✅ [LegendaryEvents] نظام الفعاليات الأسطورية جاهز — أول فعالية بعد 10 دقايق");
}
