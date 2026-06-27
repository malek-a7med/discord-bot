// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى الاحترافي — بوت زنجي
//  Kazagumo (Queue Manager) + Shoukaku (Lavalink Client)
//  نفس طريقة FlaviBot تماماً
// ════════════════════════════════════════════════════════════════
import { Kazagumo, KazagumoPlayer } from "kazagumo";
import { Connectors }              from "shoukaku";
import { EmbedBuilder }            from "discord.js";

// ── Public Lavalink Nodes (مجانية وشغالة) ─────────────────────
const NODES = [
  {
    name    : "HeavenCloud-1",
    url     : "lavalink.heavencloud.in:2333",
    auth    : "heavencloud",
    secure  : false,
  },
  {
    name    : "Ajie-Backup",
    url     : "lava-v4.ajieblogs.eu.org",
    auth    : "https://dsc.gg/ajidevserver",
    secure  : true,
  },
];

let kazagumo = null;

// ── تهيئة النظام ────────────────────────────────────────────────
export function initMusicSystem(client) {
  if (kazagumo) return kazagumo;

  kazagumo = new Kazagumo(
    {
      defaultSearchEngine : "youtube",
      send                : (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
    },
    new Connectors.DiscordJS(client),
    NODES,
    { moveOnDisconnect: true, resumable: false, reconnectTries: 3 }
  );

  // ── أحداث الـ Nodes ─────────────────────────────────────────
  kazagumo.shoukaku.on("ready",      (name) => console.log(`✅ [Music] Node جاهز: ${name}`));
  kazagumo.shoukaku.on("error",      (name, err) => console.error(`❌ [Music] Node خطأ [${name}]:`, err.message));
  kazagumo.shoukaku.on("disconnect", (name) => console.warn(`⚠️ [Music] Node انقطع: ${name}`));

  // ── أحداث المشغّل ────────────────────────────────────────────
  kazagumo.on("playerStart", (player, track) => {
    const ch = client.channels.cache.get(player.textId);
    if (!ch) return;
    const min = Math.floor(track.length / 1000 / 60);
    const sec = Math.floor((track.length / 1000) % 60).toString().padStart(2, "0");
    const embed = new EmbedBuilder()
      .setColor(0x9B30FF)
      .setAuthor({ name: "🎵 يشتغل دلوقتي" })
      .setTitle(track.title.slice(0, 256))
      .setURL(track.uri || null)
      .setThumbnail(track.thumbnail || null)
      .addFields(
        { name: "🎤 الفنان",  value: track.author  || "مجهول",    inline: true },
        { name: "⏱️ المدة",   value: `${min}:${sec}`,              inline: true },
        { name: "👑 طلبها",   value: track.requester?.username || "مجهول", inline: true }
      )
      .setFooter({ text: `✨ الفراعنة 👑 | ${player.queue.size} أغنية في الانتظار` });
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  kazagumo.on("playerEnd",    (player)       => {
    const ch = client.channels.cache.get(player.textId);
    ch?.send({ embeds: [new EmbedBuilder().setColor(0x9B30FF).setDescription("🏁 خلصت القائمة!")] }).catch(() => {});
  });

  kazagumo.on("playerEmpty",  (player)       => player.destroy());
  kazagumo.on("playerClosed", (player)       => player.destroy().catch(() => {}));
  kazagumo.on("playerException", (player, err) => {
    const ch = client.channels.cache.get(player.textId);
    ch?.send(`❌ خطأ في التشغيل: ${err.message?.slice(0, 200)}`).catch(() => {});
  });

  // ── Auto-leave لو مفيش حد ──────────────────────────────────
  client.on("voiceStateUpdate", async (oldState) => {
    try {
      const player = kazagumo.getPlayer(oldState.guild?.id);
      if (!player) return;
      const vc = oldState.guild.channels.cache.get(player.voiceId);
      if (!vc) return;
      const humans = vc.members.filter(m => !m.user.bot).size;
      if (humans === 0) {
        const ch = client.channels.cache.get(player.textId);
        ch?.send({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription("👋 مفيش حد — خرجت!")] }).catch(() => {});
        await player.destroy();
      }
    } catch {}
  });

  console.log("✅ [Music] Kazagumo + Shoukaku جاهزين!");
  return kazagumo;
}

// ── دوال التحكم ─────────────────────────────────────────────────
export const musicHandler = {

  getKazagumo() { return kazagumo; },

  getPlayer(guildId) { return kazagumo?.getPlayer(guildId) ?? null; },

  // تشغيل أغنية / بلاي ليست
  async play(guildId, voiceChannelId, textChannelId, query, requester) {
    if (!kazagumo) throw new Error("نظام الموسيقى مش شغال!");

    let player = kazagumo.getPlayer(guildId);
    if (!player) {
      player = await kazagumo.createPlayer({
        guildId,
        voiceId  : voiceChannelId,
        textId   : textChannelId,
        deaf     : true,
        volume   : 80,
      });
    }

    const result = await kazagumo.search(query, { requester });
    if (!result || !result.tracks.length) throw new Error("مش لاقي الأغنية دي!");

    if (result.type === "PLAYLIST") {
      for (const track of result.tracks) player.queue.add(track);
    } else {
      player.queue.add(result.tracks[0]);
    }

    if (!player.playing && !player.paused) await player.play();
    return result;
  },

  async skip(guildId) {
    const p = this._getOrThrow(guildId);
    if (!p.queue.size && !p.playing) throw new Error("مفيش أغنية تانية!");
    return p.skip();
  },

  async stop(guildId) {
    const p = kazagumo?.getPlayer(guildId);
    if (p) await p.destroy().catch(() => {});
  },

  async pause(guildId) {
    const p = this._getOrThrow(guildId);
    if (p.paused) throw new Error("الأغنية مش شغالة أصلاً!");
    return p.pause(true);
  },

  async resume(guildId) {
    const p = this._getOrThrow(guildId);
    if (!p.paused) throw new Error("الأغنية شغالة أصلاً!");
    return p.pause(false);
  },

  setVolume(guildId, vol) {
    const p = this._getOrThrow(guildId);
    const v = Math.max(0, Math.min(100, vol));
    p.setVolume(v);
    return v;
  },

  async seek(guildId, ms) {
    const p = this._getOrThrow(guildId);
    return p.seek(ms);
  },

  async setLoop(guildId, mode) {
    // mode: "none" | "track" | "queue"
    const p = this._getOrThrow(guildId);
    p.setLoop(mode);
    return mode;
  },

  async shuffle(guildId) {
    const p = this._getOrThrow(guildId);
    p.queue.shuffle();
  },

  async jump(guildId, index) {
    const p = this._getOrThrow(guildId);
    if (index < 1 || index > p.queue.size) throw new Error("رقم غلط!");
    p.queue.splice(0, index - 1);
    return p.skip();
  },

  async remove(guildId, index) {
    const p = this._getOrThrow(guildId);
    if (index < 1 || index > p.queue.size) throw new Error("رقم غلط!");
    const removed = p.queue.splice(index - 1, 1);
    return removed[0];
  },

  async clearQueue(guildId) {
    const p = this._getOrThrow(guildId);
    p.queue.clear();
  },

  getQueueDisplay(guildId, page = 1) {
    const p = kazagumo?.getPlayer(guildId);
    if (!p || (!p.queue.current && !p.queue.size)) return "❌ القائمة فاضية!";
    const perPage = 10;
    const all     = p.queue.current ? [p.queue.current, ...p.queue.tracks] : [...p.queue.tracks];
    const start   = (page - 1) * perPage;
    const slice   = all.slice(start, start + perPage);
    return slice.map((t, i) => {
      const idx  = start + i;
      const dur  = t.length ? `${Math.floor(t.length/1000/60)}:${Math.floor((t.length/1000)%60).toString().padStart(2,"0")}` : "??:??";
      return `${idx === 0 ? "🔊 **شغّال:**" : `**${idx}.**`} ${t.title.slice(0, 60)} \`${dur}\``;
    }).join("\n");
  },

  getCurrentSong(guildId) {
    return kazagumo?.getPlayer(guildId)?.queue?.current ?? null;
  },

  getNodesStatus() {
    if (!kazagumo) return "❌ النظام مش شغال";
    return [...kazagumo.shoukaku.nodes.values()].map(n =>
      `${n.state === 1 ? "🟢" : "🔴"} ${n.name} | Ping: ${n.stats?.playingPlayers ?? "?"} مشغّل`
    ).join("\n");
  },

  _getOrThrow(guildId) {
    const p = kazagumo?.getPlayer(guildId);
    if (!p) throw new Error("البوت مش في قناة صوتية دلوقتي!");
    return p;
  },
};
