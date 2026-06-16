import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  VoiceConnectionDisconnectReason,
} from "@discordjs/voice";
import playdl from "play-dl";
import { EmbedBuilder } from "discord.js";

class MusicPlayer {
  constructor() {
    this.queues = new Map(); // guildId -> { textChannel, voiceChannel, connection, player, songs, timeout }
  }

  async playSong(guild, textChannel) {
    const queue = this.queues.get(guild.id);
    if (!queue || queue.songs.length === 0) {
      if (queue?.connection) {
        queue.connection.destroy();
      }
      this.queues.delete(guild.id);
      return;
    }

    const song = queue.songs[0];
    
    // Clear auto-disconnect timeout if it exists
    if (queue.timeout) {
      clearTimeout(queue.timeout);
      queue.timeout = null;
    }

    try {
      if (song.isQueryBased && !song.url) {
        const searchRes = await playdl.search(song.query, { source: { youtube: "video" }, limit: 1 }).catch((e) => {
          console.error("❌ خطأ في البحث عن الأغنية:", e);
          return null;
        });

        if (searchRes && searchRes.length > 0) {
          song.url = searchRes[0].url;
          song.duration = searchRes[0].durationRaw ?? "؟";
        } else {
          textChannel.send(`❌ لم أتمكن من العثور على "${song.query}". تخطي الأغنية.`).catch(() => {});
          queue.songs.shift();
          return this.playSong(guild, textChannel);
        }
      }

      const stream = await playdl.stream(song.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, { inputType: stream.type });
      queue.player.play(resource);
      queue.connection.subscribe(queue.player);

      queue.player.removeAllListeners(AudioPlayerStatus.Idle);
      queue.player.once(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        this.playSong(guild, textChannel);
      });

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle("🎵 يشتغل دلوقتي")
        .setDescription(`**[${song.title}](${song.url})**`)
        .setFooter({ text: `طلب بواسطة: ${song.requestedBy}` });
      textChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error("❌ خطأ في تشغيل الأغنية:", err);
      textChannel.send(`❌ حدث خطأ أثناء تشغيل: **${song.title}**. تخطي الأغنية.`).catch(() => {});
      queue.songs.shift();
      this.playSong(guild, textChannel);
    }
  }

  async addSong(interaction, searchStr) {
    const { guild, member, channel, user } = interaction;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({ content: "❌ ادخل روم صوتي الأول يسطا!", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    let queue = this.queues.get(guild.id);
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      queue = {
        textChannel: channel,
        voiceChannel,
        connection,
        player: createAudioPlayer(),
        songs: [],
        timeout: null,
      };
      this.queues.set(guild.id, queue);

      // Handle voice connection state changes
      queue.connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
        if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
          try {
            await entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000);
            // Seems to have reconnected successfully
          } catch (err) {
            // Unable to reconnect, destroy connection
            if (queue.connection) queue.connection.destroy();
            this.queues.delete(guild.id);
            queue.textChannel.send("❌ تم فصلي من الروم الصوتي!").catch(() => {});
          }
        } else if (newState.reason === VoiceConnectionDisconnectReason.AdapterUnavailable) {
          // Adapter became unavailable (server crashed or Discord bug), destroy connection
          if (queue.connection) queue.connection.destroy();
          this.queues.delete(guild.id);
          queue.textChannel.send("❌ حدث خطأ في الاتصال الصوتي. تم إيقاف الموسيقى.").catch(() => {});
        } else if (queue.connection.rejoinAttempts < 5) { // Simple rejoin attempt counter
            await new Promise(r => setTimeout(r, (queue.connection.rejoinAttempts + 1) * 1000));
            queue.connection.rejoinAttempts++;
            try {
              queue.connection.rejoin();
            } catch (err) {
              console.error("Failed to rejoin voice channel:", err);
            }
        } else {
            if (queue.connection) queue.connection.destroy();
            this.queues.delete(guild.id);
            queue.textChannel.send("❌ تعذر إعادة الاتصال بالروم الصوتي.").catch(() => {});
        }
      });
      queue.connection.on('stateChange', (oldState, newState) => {
        if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
          queue.connection.rejoinAttempts = (queue.connection.rejoinAttempts || 0) + 1;
        }
      });

      // Auto-disconnect if bot is alone in voice channel
      queue.connection.on(VoiceConnectionStatus.Ready, () => {
        queue.voiceChannel.members.on('voiceStateUpdate', (oldState, newState) => {
          if (this.queues.has(guild.id) && queue.voiceChannel.members.filter(m => !m.user.bot).size === 0 && !queue.timeout) {
            queue.timeout = setTimeout(() => {
              if (queue.voiceChannel.members.filter(m => !m.user.bot).size === 0) {
                this.stop(guild.id);
                queue.textChannel.send("👋 خرجت من الروم الصوتي لعدم وجود أعضاء!").catch(() => {});
              }
            }, 300000); // 5 minutes
          } else if (queue.voiceChannel.members.filter(m => !m.user.bot).size > 0 && queue.timeout) {
            clearTimeout(queue.timeout);
            queue.timeout = null;
          }
        });
      });
    }

    if (searchStr.includes("spotify.com") && searchStr.includes("/playlist/")) {
      const bSongs = await this.spotifyPlaylistBypass(searchStr);
      if (bSongs && bSongs.length > 0) {
        bSongs.forEach(s => { s.requestedBy = user.username; queue.songs.push(s); });
        await interaction.editReply(`🎶 ضفت **${bSongs.length}** أغنية من البلاي ليست للانتظار!`);
        if (queue.songs.length === bSongs.length) this.playSong(guild, channel);
        return;
      } else {
        await interaction.editReply("❌ لم أتمكن من جلب الأغاني من قائمة التشغيل هذه.");
        return;
      }
    }

    const res = await playdl.search(searchStr, { source: { youtube: "video" }, limit: 1 }).catch((e) => {
      console.error("❌ خطأ في البحث عن الأغنية:", e);
      return null;
    });

    if (!res || res.length === 0) {
      await interaction.editReply("❌ ملاقيتش حاجة بالاسم ده!");
      return;
    }

    const song = { title: res[0].title, url: res[0].url, duration: res[0].durationRaw ?? "؟", requestedBy: user.username, isQueryBased: false };
    queue.songs.push(song);

    if (queue.songs.length === 1) {
      this.playSong(guild, channel);
      await interaction.editReply(`🎵 جاري تشغيل: **${song.title}**`);
    } else {
      await interaction.editReply(`📋 تم الإضافة لقائمة الانتظار: **${song.title}**`);
    }
  }

  async stop(guildId) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.songs = [];
      queue.player.stop();
      queue.connection.destroy();
      this.queues.delete(guildId);
      if (queue.timeout) clearTimeout(queue.timeout);
    }
  }

  async skip(guildId) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.player.stop();
    }
  }

  getQueue(guildId) {
    return this.queues.get(guildId)?.songs || [];
  }

  pause(guildId) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.player.pause();
    }
  }

  unpause(guildId) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.player.unpause();
    }
  }

  async spotifyPlaylistBypass(playlistUrl) {
    try {
      const embedPageUrl = playlistUrl.replace(/open\.spotify\.com/, 'open.spotify.com').replace(/\?.*$/, '');
      const response = await fetch(embedPageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      if (!response.ok) {
        console.error(`⚠️ خطأ في جلب بيانات سبوتيفاي: ${response.statusText}`);
        return null;
      }
      const html = await response.text();
      const trackMatches = html.match(/"name":"([^"]+)","artists":\[\{"name":"([^"]+)"/g);
      
      if (trackMatches && trackMatches.length > 0) {
        return trackMatches.map(match => {
          const [, name, artist] = match.match(/"name":"([^"]+)","artists":\[\{"name":"([^"]+)/);
          return { title: name, query: `${name} ${artist}`, url: null, isQueryBased: true };
        }).slice(0, 100);
      }
      return null;
    } catch (e) {
      console.error("⚠️ خطأ غير متوقع في Spotify Bypass:", e.message);
      return null;
    }
  }
}

export const musicPlayer = new MusicPlayer();
