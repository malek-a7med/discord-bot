import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType
} from '@discordjs/voice';
import playdl from 'play-dl';
import { spawn } from 'child_process';
import { MusicStreamError, VoiceChannelError } from '../errors.js';

const YTDLP_PATH = '/home/runner/workspace/.pythonlibs/bin/yt-dlp';

function createYtDlpStream(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, [
      '--js-runtimes', 'node',
      '--no-playlist',
      '--quiet',
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '-o', '-',
      url
    ]);

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', err => reject(new Error(`yt-dlp spawn error: ${err.message}`)));

    const killTimeout = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timeout بعد 30 ثانية'));
    }, 30000);

    proc.stdout.once('data', () => {
      clearTimeout(killTimeout);
      resolve({ stream: proc.stdout, type: StreamType.Arbitrary, proc });
    });

    proc.on('close', code => {
      clearTimeout(killTimeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`yt-dlp فشل (كود ${code}): ${stderr.slice(-400)}`));
      }
    });
  });
}

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

  async fetchSpotifyInfo(spotifyUrl) {
    const match = spotifyUrl.match(/spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/);
    if (!match) throw new MusicStreamError('رابط Spotify غير صحيح');
    const [, type, id] = match;

    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120' }
    });
    const html = await res.text();

    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new MusicStreamError('فشل جلب بيانات Spotify');

    const data = JSON.parse(m[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) throw new MusicStreamError('فشل العثور على بيانات Spotify');

    if (type === 'track') {
      return [{
        title: entity.name || 'Unknown',
        artist: entity.artists?.map(a => a.name).join(', ') || '',
        duration: Math.floor((entity.duration || 0) / 1000),
        platform: 'spotify'
      }];
    }

    const trackList = entity.trackList || [];
    return trackList
      .filter(t => t.isPlayable !== false)
      .map(t => ({
        title: t.title || 'Unknown',
        artist: t.subtitle || '',
        duration: Math.floor((t.duration || 0) / 1000),
        platform: 'spotify'
      }));
  }

  async resolveSource(query, requestedBy) {
    const isSpotify = query.includes('spotify.com') || query.includes('open.spotify.com');
    const isYouTube = query.includes('youtube.com') || query.includes('youtu.be');

    if (isSpotify) {
      const spotifyTracks = await this.fetchSpotifyInfo(query);
      const results = [];
      for (const track of spotifyTracks) {
        try {
          const searchQuery = track.artist ? `${track.title} ${track.artist}` : track.title;
          const ytResults = await this.searchYouTube(searchQuery);
          if (ytResults.length > 0) {
            results.push({ ...ytResults[0], title: track.title, artist: track.artist, duration: track.duration || ytResults[0].duration, platform: 'spotify', requestedBy });
          }
        } catch (err) {
          console.warn(`⚠️ تخطي "${track.title}": ${err.message}`);
        }
      }
      if (results.length === 0) throw new MusicStreamError('ما لقيتش أي أغنية من Spotify');
      return results;
    }

    if (isYouTube) {
      return [{
        title: 'YouTube Video',
        url: query,
        duration: 0,
        platform: 'youtube',
        requestedBy
      }];
    }

    const ytResults = await this.searchYouTube(query);
    if (ytResults.length === 0) throw new MusicStreamError('ما لقيتش أغنية بالاسم ده');
    return [{ ...ytResults[0], requestedBy }];
  }

  async searchSpotifyPlaylist(playlistId) {
    return this.fetchSpotifyInfo(`https://open.spotify.com/playlist/${playlistId}`);
  }

  async searchSpotify(query) {
    const ytResults = await this.searchYouTube(query);
    return ytResults.slice(0, 1);
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
            stream = await createYtDlpStream(song.url);
            break;
          } catch (streamErr) {
            retries++;
            if (retries >= maxRetries) {
              throw streamErr;
            }
            console.warn(`⚠️ إعادة محاولة تحميل الأغنية (${retries}/${maxRetries}): ${streamErr.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * retries));
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
