import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from '@discordjs/voice';
import playdl from 'play-dl';
import { MusicStreamError, VoiceChannelError } from '../errors.js';

class MusicHandler {
  constructor() {
    this.queues = new Map(); // guildId -> queue object
    this.autoplayTimeouts = new Map(); // guildId -> timeout
  }

  createQueue(guildId, textChannel, voiceChannel) {
    if (this.queues.has(guildId)) {
      return this.queues.get(guildId);
    }

    const queue = {
      guildId,
      textChannel,
      voiceChannel,
      connection: null,
      player: null,
      songs: [],
      isPlaying: false,
      isPaused: false,
      currentSong: null,
      volume: 0.5,
      lastActivityTime: Date.now(),
      loopMode: 'none' // 'none', 'one', 'all'
    };

    this.queues.set(guildId, queue);
    return queue;
  }

  getQueue(guildId) {
    return this.queues.get(guildId) || null;
  }

  async joinVoiceChannelAndPlay(guildId, voiceChannel, textChannel) {
    try {
      const queue = this.createQueue(guildId, textChannel, voiceChannel);

      if (queue.connection && queue.connection.state.status !== 'destroyed') {
        return queue;
      }

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
      });

      connection.on('stateChange', (oldState, newState) => {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          this.handleDisconnect(guildId);
        }
      });

      connection.on('error', (error) => {
        console.error('❌ خطأ في الاتصال الصوتي:', error.message);
        this.handleDisconnect(guildId);
      });

      queue.connection = connection;

      if (!queue.player) {
        queue.player = createAudioPlayer();

        queue.player.on(AudioPlayerStatus.Idle, () => {
          this.playNext(guildId);
        });

        queue.player.on(AudioPlayerStatus.Playing, () => {
          queue.isPlaying = true;
          queue.lastActivityTime = Date.now();
        });

        queue.player.on('error', (error) => {
          console.error('❌ خطأ في تشغيل الصوت:', error.message);
          this.playNext(guildId);
        });
      }

      connection.subscribe(queue.player);
      this.setupAutoDisconnect(guildId);

      return queue;
    } catch (err) {
      throw new VoiceChannelError(
        `خطأ في الانضمام للقناة الصوتية: ${err.message}`
      );
    }
  }

  async searchYouTube(query) {
    try {
      const yt_search = await playdl.search(query, {
        source: { youtube: 'video' },
        limit: 5
      });

      return yt_search.map((video) => ({
        title: video.title || 'Unknown',
        url: video.url,
        duration: video.durationInSec || 0,
        platform: 'youtube',
        thumbnail: video.thumbnail ? video.thumbnail.url : null
      }));
    } catch (err) {
      throw new MusicStreamError(`خطأ في البحث على YouTube: ${err.message}`);
    }
  }

  async searchSpotifyPlaylist(playlistId) {
    try {
      const playlist = await playdl.spotify(playlistId);

      if (!playlist || !playlist.page) {
        throw new MusicStreamError('لم يتم العثور على البلاي ليست');
      }

      const results = [];

      // Get all tracks from playlist
      for (const track of playlist.page) {
        try {
          const ytResults = await this.searchYouTube(`${track.name} ${track.artists?.map(a => a.name).join(' ')}`);
          if (ytResults.length > 0) {
            results.push({
              title: track.name || 'Unknown',
              artist: track.artists?.map(a => a.name).join(', ') || '',
              url: ytResults[0].url,
              duration: track.durationInMs ? Math.floor(track.durationInMs / 1000) : 0,
              platform: 'spotify',
              thumbnail: track.thumbnail ? track.thumbnail.url : null
            });
          }
        } catch (err) {
          console.warn(`⚠️ تعذر إضافة الأغنية ${track.name}:`, err.message);
          continue;
        }
      }

      return results;
    } catch (err) {
      throw new MusicStreamError(`خطأ في جلب بلاي ليست Spotify: ${err.message}`);
    }
  }

  async searchSpotify(query) {
    try {
      const sp_search = await playdl.search(query, {
        source: { spotify: 'track' },
        limit: 5
      });

      // Spotify search returns metadata; convert to YouTube for streaming
      const youtubeResults = [];
      for (const track of sp_search) {
        const ytResults = await this.searchYouTube(`${track.name} ${track.artist || ''}`);
        if (ytResults.length > 0) {
          youtubeResults.push({
            title: track.name || 'Unknown',
            artist: track.artist || '',
            url: ytResults[0].url,
            duration: track.durationInSec || 0,
            platform: 'spotify',
            thumbnail: track.thumbnail ? track.thumbnail.url : null
          });
        }
      }
      return youtubeResults;
    } catch (err) {
      throw new MusicStreamError(`خطأ في البحث على Spotify: ${err.message}`);
    }
  }

  async addToQueue(guildId, song) {
    const queue = this.getQueue(guildId);
    if (!queue) {
      throw new MusicStreamError('قائمة التشغيل غير موجودة');
    }

    // Check for duplicates
    const isDuplicate = queue.songs.some((s) => s.url === song.url);
    if (isDuplicate) {
      throw new MusicStreamError('الأغنية موجودة بالفعل في قائمة التشغيل');
    }

    // Max queue size
    if (queue.songs.length >= 100) {
      throw new MusicStreamError('قائمة التشغيل وصلت للحد الأقصى (100 أغنية)');
    }

    queue.songs.push(song);

    if (!queue.isPlaying && queue.songs.length === 1) {
      await this.playNext(guildId);
    }

    return queue.songs.length;
  }

  async playNext(guildId) {
    try {
      const queue = this.getQueue(guildId);
      if (!queue || !queue.connection || !queue.player) {
        return;
      }

      // Handle loop modes
      if (queue.loopMode === 'one' && queue.currentSong) {
        queue.songs.unshift(queue.currentSong);
      }

      if (queue.songs.length === 0) {
        queue.isPlaying = false;
        queue.currentSong = null;
        this.setupAutoDisconnect(guildId);
        return;
      }

      const song = queue.songs.shift();
      queue.currentSong = song;

      try {
        let stream;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            stream = await playdl.stream(song.url);
            break;
          } catch (streamErr) {
            retries++;
            if (retries >= maxRetries) {
              throw streamErr;
            }
            console.warn(`⚠️ إعادة محاولة تحميل الأغنية (${retries}/${maxRetries}): ${streamErr.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }

        if (!stream || !stream.stream) {
          throw new Error('فشل جلب البث الصوتي');
        }

        const resource = createAudioResource(stream.stream, {
          inputType: stream.type,
          inlineVolume: true
        });

        resource.volume.setVolume(queue.volume);
        queue.player.play(resource);
        queue.isPlaying = true;

        // Notify channel
        if (queue.textChannel) {
          const embed = {
            embeds: [
              {
                title: '🎵 شغلت أغنيتك',
                description: `**${song.title}**`,
                fields: [
                  {
                    name: 'المدة',
                    value: this.formatDuration(song.duration),
                    inline: true
                  },
                  {
                    name: 'طلب بواسطة',
                    value: song.requestedBy || 'Unknown',
                    inline: true
                  },
                  {
                    name: 'في القائمة',
                    value: String(queue.songs.length),
                    inline: true
                  }
                ],
                color: 3447003
              }
            ]
          };

          queue.textChannel.send(embed).catch(() => {});
        }
      } catch (err) {
        console.error('❌ خطأ في تشغيل الأغنية:', err.message);
        if (queue.textChannel) {
          await queue.textChannel
            .send({
              content: `⚠️ تعذر تشغيل الأغنية: ${song.title}، جاري الانتقال للأغنية التالية...`
            })
            .catch(() => {});
        }
        // Skip to next song without breaking connection
        await this.playNext(guildId);
      }
    } catch (err) {
      console.error('❌ خطأ في تشغيل التالي:', err.message);
    }
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.isPlaying) {
      throw new MusicStreamError('ما في أغنية تشتغل حالياً');
    }

    queue.player.stop();
    return true;
  }

  async pause(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.isPlaying) {
      throw new MusicStreamError('ما في أغنية تشتغل حالياً');
    }

    queue.player.pause();
    queue.isPaused = true;
    return true;
  }

  async resume(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.isPaused) {
      throw new MusicStreamError('ما في أغنية موقوفة');
    }

    queue.player.unpause();
    queue.isPaused = false;
    return true;
  }

  async stop(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) {
      throw new MusicStreamError('قائمة التشغيل غير موجودة');
    }

    if (queue.player) {
      queue.player.stop();
    }

    if (queue.connection) {
      queue.connection.destroy();
    }

    this.queues.delete(guildId);

    if (this.autoplayTimeouts.has(guildId)) {
      clearTimeout(this.autoplayTimeouts.get(guildId));
      this.autoplayTimeouts.delete(guildId);
    }

    return true;
  }

  getQueueDisplay(guildId, page = 1) {
    const queue = this.getQueue(guildId);
    if (!queue || queue.songs.length === 0) {
      return 'قائمة التشغيل فارغة';
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(queue.songs.length / itemsPerPage);

    if (page < 1 || page > totalPages) {
      page = 1;
    }

    const start = (page - 1) * itemsPerPage;
    const songs = queue.songs.slice(start, start + itemsPerPage);

    let display = `**قائمة التشغيل** (الصفحة ${page}/${totalPages})\n\n`;
    if (queue.currentSong) {
      display += `🎵 **الحالي**: ${queue.currentSong.title} (${this.formatDuration(queue.currentSong.duration)})\n\n`;
    }

    display += songs
      .map(
        (song, i) =>
          `${start + i + 1}. ${song.title} (${this.formatDuration(song.duration)})`
      )
      .join('\n');

    return display;
  }

  getQueueSize(guildId) {
    const queue = this.getQueue(guildId);
    return queue ? queue.songs.length : 0;
  }

  setVolume(guildId, volume) {
    const queue = this.getQueue(guildId);
    if (!queue) {
      throw new MusicStreamError('قائمة التشغيل غير موجودة');
    }

    volume = Math.max(0, Math.min(1, volume)); // Clamp 0-1
    queue.volume = volume;

    if (queue.player && queue.player.state.resource) {
      queue.player.state.resource.volume.setVolume(volume);
    }

    return volume;
  }

  setLoopMode(guildId, mode) {
    const queue = this.getQueue(guildId);
    if (!queue) {
      throw new MusicStreamError('قائمة التشغيل غير موجودة');
    }

    if (!['none', 'one', 'all'].includes(mode)) {
      throw new MusicStreamError('وضع الحلقة غير صالح');
    }

    queue.loopMode = mode;
    return mode;
  }

  setupAutoDisconnect(guildId) {
    if (this.autoplayTimeouts.has(guildId)) {
      clearTimeout(this.autoplayTimeouts.get(guildId));
    }

    const timeout = setTimeout(() => {
      const queue = this.getQueue(guildId);
      if (queue) {
        const voiceChannel = queue.voiceChannel;
        const humanMembers = voiceChannel.members.filter(
          (m) => !m.user.bot
        ).size;

        if (humanMembers === 0) {
          this.stop(guildId).catch(() => {});
        } else {
          this.setupAutoDisconnect(guildId);
        }
      }
    }, 300000); // 5 minutes

    this.autoplayTimeouts.set(guildId, timeout);
  }

  handleDisconnect(guildId) {
    const queue = this.getQueue(guildId);
    if (queue) {
      this.stop(guildId).catch(() => {});
    }
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export default MusicHandler;
