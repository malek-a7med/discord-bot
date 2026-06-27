// ════════════════════════════════════════════════════════════════
//  أوامر الموسيقى — بوت زنجي
//  Kazagumo + Shoukaku (Public Lavalink Nodes)
// ════════════════════════════════════════════════════════════════
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { musicHandler } from "../helpers/music-handler.js";

// ── مساعد: رد سريع ──────────────────────────────────────────────
async function reply(interaction, content, color = 0x9B30FF, ephemeral = false) {
  const embed = new EmbedBuilder().setColor(color).setDescription(content);
  const payload = { embeds: [embed], ephemeral };
  try {
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
    return interaction.reply(payload);
  } catch {}
}
const ok  = (i, msg) => reply(i, msg, 0x9B30FF);
const err = (i, msg) => reply(i, `❌ ${msg}`, 0xe74c3c, true);

function checkVoice(interaction) {
  const vc = interaction.member?.voice?.channel;
  if (!vc) { err(interaction, "لازم تكون في قناة صوتية الأول!"); return null; }
  return vc;
}

// ════════════════════════════════════════════════════════════════
export const playCommand = {
  data: new SlashCommandBuilder()
    .setName("شغل")
    .setDescription("🎵 شغّل أغنية أو بلاي ليست من أي مصدر")
    .addStringOption(o =>
      o.setName("اغنية").setDescription("اسم الأغنية أو رابطها").setRequired(true)
    ),
  async execute(interaction) {
    const vc    = checkVoice(interaction); if (!vc) return;
    const query = interaction.options.getString("اغنية");
    await interaction.deferReply();
    try {
      const result = await musicHandler.play(
        interaction.guildId, vc.id, interaction.channelId, query, interaction.user
      );
      if (result.type === "PLAYLIST")
        return ok(interaction, `📋 أُضيفت **${result.playlistName}** — ${result.tracks.length} أغنية`);
      const t   = result.tracks[0];
      const dur = t.length
        ? `${Math.floor(t.length/1000/60)}:${Math.floor((t.length/1000)%60).toString().padStart(2,"0")}`
        : "??:??";
      return ok(interaction, `✅ **${t.title}** \`${dur}\` أُضيفت للقائمة`);
    } catch (e) { return err(interaction, e.message.slice(0, 300)); }
  },
};

export const skipCommand = {
  data: new SlashCommandBuilder().setName("تخطي").setDescription("⏭️ تخطي الأغنية الحالية"),
  async execute(interaction) {
    try { await musicHandler.skip(interaction.guildId); return ok(interaction, "⏭️ تم التخطي!"); }
    catch (e) { return err(interaction, e.message); }
  },
};

export const stopCommand = {
  data: new SlashCommandBuilder().setName("وقف").setDescription("⏹️ وقف الموسيقى والخروج"),
  async execute(interaction) {
    try { await musicHandler.stop(interaction.guildId); return ok(interaction, "⏹️ تم الإيقاف!"); }
    catch (e) { return err(interaction, e.message); }
  },
};

export const pauseCommand = {
  data: new SlashCommandBuilder().setName("بوز").setDescription("⏸️ إيقاف مؤقت"),
  async execute(interaction) {
    try { await musicHandler.pause(interaction.guildId); return ok(interaction, "⏸️ تم الإيقاف المؤقت!"); }
    catch (e) { return err(interaction, e.message); }
  },
};

export const resumeCommand = {
  data: new SlashCommandBuilder().setName("كمل").setDescription("▶️ استأنف التشغيل"),
  async execute(interaction) {
    try { await musicHandler.resume(interaction.guildId); return ok(interaction, "▶️ استُؤنف التشغيل!"); }
    catch (e) { return err(interaction, e.message); }
  },
};

export const queueCommand = {
  data: new SlashCommandBuilder()
    .setName("قائمة").setDescription("📋 عرض قائمة التشغيل")
    .addIntegerOption(o => o.setName("صفحة").setDescription("رقم الصفحة").setRequired(false).setMinValue(1)),
  async execute(interaction) {
    const page    = interaction.options.getInteger("صفحة") || 1;
    const display = musicHandler.getQueueDisplay(interaction.guildId, page);
    const embed   = new EmbedBuilder().setColor(0x9B30FF).setTitle("📋 قائمة التشغيل").setDescription(display).setFooter({ text: `صفحة ${page}` });
    return interaction.reply({ embeds: [embed] });
  },
};

export const nowPlayingCommand = {
  data: new SlashCommandBuilder().setName("شغال-ايه").setDescription("🎶 الأغنية الحالية"),
  async execute(interaction) {
    const player = musicHandler.getPlayer(interaction.guildId);
    const track  = player?.queue?.current;
    if (!track) return err(interaction, "مفيش أغنية شغالة دلوقتي!");
    const elapsed = player.position || 0;
    const total   = track.length    || 0;
    const pct     = total ? Math.round((elapsed / total) * 20) : 0;
    const bar     = "▓".repeat(pct) + "░".repeat(20 - pct);
    const fmt     = ms => `${Math.floor(ms/1000/60)}:${Math.floor((ms/1000)%60).toString().padStart(2,"0")}`;
    const embed   = new EmbedBuilder()
      .setColor(0x9B30FF)
      .setTitle(`🎵 ${track.title.slice(0,256)}`)
      .setURL(track.uri || null)
      .setThumbnail(track.thumbnail || null)
      .addFields(
        { name: "🎤 الفنان", value: track.author || "مجهول", inline: true },
        { name: "👑 طلبها",  value: track.requester?.username || "مجهول", inline: true },
        { name: "🔊 الصوت",  value: `${player.volume}%`, inline: true },
        { name: "⏱️ التقدم", value: `\`${fmt(elapsed)}\` ${bar} \`${fmt(total)}\``, inline: false }
      );
    return interaction.reply({ embeds: [embed] });
  },
};

export const volumeCommand = {
  data: new SlashCommandBuilder()
    .setName("صوت").setDescription("🔊 تعديل مستوى الصوت (0-100)")
    .addIntegerOption(o => o.setName("مستوى").setDescription("0-100").setRequired(true).setMinValue(0).setMaxValue(100)),
  async execute(interaction) {
    try {
      const set = musicHandler.setVolume(interaction.guildId, interaction.options.getInteger("مستوى"));
      return ok(interaction, `🔊 الصوت اتغيّر لـ **${set}%**`);
    } catch (e) { return err(interaction, e.message); }
  },
};

export const repeatCommand = {
  data: new SlashCommandBuilder()
    .setName("تكرار").setDescription("🔁 وضع التكرار")
    .addStringOption(o =>
      o.setName("وضع").setDescription("اختار الوضع").setRequired(true)
        .addChoices(
          { name: "إيقاف التكرار", value: "none"  },
          { name: "تكرار الأغنية", value: "track" },
          { name: "تكرار القائمة", value: "queue" }
        )
    ),
  async execute(interaction) {
    try {
      const mode   = interaction.options.getString("وضع");
      await musicHandler.setLoop(interaction.guildId, mode);
      const labels = { none: "⏹️ إيقاف التكرار", track: "🔂 تكرار الأغنية", queue: "🔁 تكرار القائمة" };
      return ok(interaction, `${labels[mode]} — تم!`);
    } catch (e) { return err(interaction, e.message); }
  },
};

export const shuffleCommand = {
  data: new SlashCommandBuilder().setName("خلط").setDescription("🔀 خلط القائمة"),
  async execute(interaction) {
    try { await musicHandler.shuffle(interaction.guildId); return ok(interaction, "🔀 اتخلطت القائمة!"); }
    catch (e) { return err(interaction, e.message); }
  },
};

export const jumpCommand = {
  data: new SlashCommandBuilder()
    .setName("تخطى-لـ").setDescription("⏩ تخطى لأغنية معينة")
    .addIntegerOption(o => o.setName("رقم").setDescription("رقم الأغنية").setRequired(true).setMinValue(1)),
  async execute(interaction) {
    try {
      const idx = interaction.options.getInteger("رقم");
      await musicHandler.jump(interaction.guildId, idx);
      return ok(interaction, `⏩ القفز للأغنية رقم **${idx}**!`);
    } catch (e) { return err(interaction, e.message); }
  },
};

export const removeCommand = {
  data: new SlashCommandBuilder()
    .setName("احذف").setDescription("🗑️ احذف أغنية من القائمة")
    .addIntegerOption(o => o.setName("رقم").setDescription("رقم الأغنية").setRequired(true).setMinValue(2)),
  async execute(interaction) {
    try {
      const removed = await musicHandler.remove(interaction.guildId, interaction.options.getInteger("رقم"));
      return ok(interaction, `🗑️ اتحذفت: **${removed?.title || "أغنية"}**`);
    } catch (e) { return err(interaction, e.message); }
  },
};

export const clearCommand = {
  data: new SlashCommandBuilder().setName("مسح-قائمة").setDescription("🧹 مسح كل القائمة"),
  async execute(interaction) {
    try { await musicHandler.clearQueue(interaction.guildId); return ok(interaction, "🧹 اتمسحت القائمة!"); }
    catch (e) { return err(interaction, e.message); }
  },
};

export const nodesCommand = {
  data: new SlashCommandBuilder().setName("nodes").setDescription("🖥️ حالة سيرفرات الصوت"),
  async execute(interaction) {
    const embed = new EmbedBuilder().setColor(0x9B30FF).setTitle("🖥️ سيرفرات الصوت").setDescription(musicHandler.getNodesStatus());
    return interaction.reply({ embeds: [embed] });
  },
};

export const musicCommands = [
  playCommand, skipCommand, stopCommand, pauseCommand, resumeCommand,
  queueCommand, nowPlayingCommand, volumeCommand, repeatCommand, shuffleCommand,
  jumpCommand, removeCommand, clearCommand, nodesCommand,
];
