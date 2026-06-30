// ═══════════════════════════════════════════════════════════════
//  📊 إحصائيات السيرفر Live — بيتحدث تلقائي كل ساعة
// ═══════════════════════════════════════════════════════════════
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

export const serverStatsCommand = new SlashCommandBuilder()
  .setName("إحصائيات-السيرفر")
  .setDescription("📊 إرسال إيمبد إحصائيات السيرفر (بيتحدث تلقائياً كل ساعة) [إدارة]")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o =>
    o.setName("قناة").setDescription("القناة اللي هيتبعت فيها (الافتراضي: هنا)")
  );

let liveStatsMessageId = null;
let liveStatsChannelId = null;
let liveStatsGuildId = null;
let liveStatsInterval = null;

function buildStatsEmbed(guild, db) {
  const allUsers = db.getAllData().users;
  const totalUsers = Object.keys(allUsers).length;

  const topXp = Object.entries(allUsers)
    .sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0))
    .slice(0, 3)
    .map(([id, d], i) => `**#${i + 1}** <@${id}> — ${(d.xp || 0).toLocaleString()} XP`)
    .join("\n") || "مفيش بعد";

  const topCoins = Object.entries(allUsers)
    .sort((a, b) => (b[1].coins || 0) - (a[1].coins || 0))
    .slice(0, 3)
    .map(([id, d], i) => `**#${i + 1}** <@${id}> — ${(d.coins || 0).toLocaleString()} 🪙`)
    .join("\n") || "مفيش بعد";

  const topWins = Object.entries(allUsers)
    .map(([id, d]) => {
      const wins = d.gameWins ? Object.values(d.gameWins).reduce((a, b) => a + b, 0) : 0;
      return [id, wins];
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, wins], i) => `**#${i + 1}** <@${id}> — ${wins} فوز`)
    .join("\n") || "مفيش بعد";

  const onlineCount = guild.members.cache.filter(m => !m.user.bot && m.presence?.status && m.presence.status !== "offline").size;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;

  const now = new Date();

  return new EmbedBuilder()
    .setColor(0xA020F0)
    .setTitle(`📊 إحصائيات سيرفر ${guild.name} — Live`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      {
        name: "👥 الأعضاء",
        value: `🟢 أونلاين: **${onlineCount}**\n👤 إجمالي: **${guild.memberCount}**\n🤖 بوتات: **${botCount}**`,
        inline: true
      },
      {
        name: "📡 القنوات",
        value: `💬 نص: **${textChannels}**\n🔊 صوت: **${voiceChannels}**`,
        inline: true
      },
      {
        name: "🎖️ الرتب",
        value: `**${guild.roles.cache.size}** رتبة`,
        inline: true
      },
      { name: "🏆 أكتر XP", value: topXp, inline: true },
      { name: "🪙 أكتر كوينز", value: topCoins, inline: true },
      { name: "🎮 أكتر انتصارات", value: topWins, inline: true },
      {
        name: "📅 إنشاء السيرفر",
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        inline: true
      },
      {
        name: "💾 إجمالي الأعضاء في DB",
        value: `${totalUsers} عضو`,
        inline: true
      },
    )
    .setFooter({ text: `آخر تحديث: ${now.toLocaleString("ar-EG")} | بيتحدث كل ساعة تلقائياً` })
    .setTimestamp();
}

export async function handleServerStats(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const targetChannel = interaction.options.getChannel("قناة") ?? interaction.channel;

  const msg = await targetChannel.send({
    embeds: [buildStatsEmbed(guild, db)]
  });

  liveStatsMessageId = msg.id;
  liveStatsChannelId = targetChannel.id;
  liveStatsGuildId = guild.id;

  if (liveStatsInterval) clearInterval(liveStatsInterval);

  liveStatsInterval = setInterval(async () => {
    try {
      const ch = await interaction.client.channels.fetch(liveStatsChannelId).catch(() => null);
      if (!ch) return;
      const g = interaction.client.guilds.cache.get(liveStatsGuildId);
      if (!g) return;
      const message = await ch.messages.fetch(liveStatsMessageId).catch(() => null);
      if (!message) return;
      await message.edit({ embeds: [buildStatsEmbed(g, db)] });
    } catch (e) {
      console.error("[ServerStats] خطأ في التحديث التلقائي:", e.message);
    }
  }, 60 * 60 * 1000);

  await interaction.editReply({
    content: `✅ اتبعت إحصائيات السيرفر في ${targetChannel}!\nبيتحدث تلقائياً كل ساعة.`
  });
}
