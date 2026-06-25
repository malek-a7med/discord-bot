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
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MusicStreamError, VoiceChannelError } from '../errors.js';

const YTDLP_PATHS = [
  '/home/runner/workspace/.pythonlibs/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  '/opt/homebrew/bin/yt-dlp'
];
const { execSync } = await import('child_process');

function findYtDlp() {
  for (const p of YTDLP_PATHS) {
    try {
      if (existsSync(p)) return p;
    } catch {}
  }
  try {
    const found = execSync('which yt-dlp', { encoding: 'utf8' }).trim();
    if (found) return found;
  } catch {}
  return YTDLP_PATHS[0]; // fallback
}
const YTDLP_PATH = findYtDlp();

// === Platform Detection ===
function detectPlatform(input) {
  const lower = input.toLowerCase();
  const info = {
    isSpotify: false,
    isYouTube: false,
    isSoundCloud: false,
    soundcloudType: null, // 'track' | 'playlist' | 'set'
    isDirect: false,
    platform: 'unknown'
  };

  // Spotify
  if (/open\.spotify\.com|spotify\.com/i.test(input)) {
    info.isSpotify = true;
    info.platform = 'spotify';
    return info;
  }

  // YouTube
  if (/youtube\.com|youtu\.be/i.test(input)) {
    info.isYouTube = true;
    info.platform = 'youtube';
    return info;
  }

  // SoundCloud
  if (/soundcloud\.com/i.test(input)) {
    info.isSoundCloud = true;
    info.platform = 'soundcloud';
    if (/\/sets?\//i.test(input)) info.soundcloudType = 'playlist';
    else info.soundcloudType = 'track';
    return info;
  }

  // روابط مباشرة (ملفات صوتية / HLS streams)
  if (/^https?:\/\//i.test(input) && /\.(mp3|m4a|aac|ogg|opus|wav|flac|m3u8|m3u|mp4|webm|mpd)(\?|$)/i.test(input)) {
    info.isDirect = true;
    info.platform = 'direct';
    return info;
  }

  // m3u8 / m3u من أي domain
  if (/^https?:\/\//i.test(input) && /m3u8|m3u(\?|$)/i.test(input)) {
    info.isDirect = true;
    info.platform = 'direct';
    return info;
  }

  return info;
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').pop() || 'audio';
    return decodeURIComponent(path.split('?')[0]) || 'audio';
  } catch {
    return 'audio';
  }
}

// === YouTube Cookies Support ===
// الترتيب:
// 1) Environment variable YOUTUBE_COOKIES (الأفضل لـ Replit Secrets)
// 2) ملف cookies.txt في جذر المشروع (fallback للتطوير المحلي)
function ensureCookiesFile() {
  // 1) من Environment Variable
  const envCookies = process.env.YOUTUBE_COOKIES;
  if (envCookies && envCookies.trim().length > 0) {
    const envPath = '/tmp/yt-cookies.txt';
    try {
      // اكتب الملف من الـ env (ممكن newline-escaped أو raw)
      const normalized = envCookies.includes('\\n')
        ? envCookies.replace(/\\n/g, '\n')
        : envCookies;
      writeFileSync(envPath, normalized, 'utf8');
      return envPath;
    } catch (err) {
      console.warn('⚠️ فشل كتابة cookies من env:', err.message);
    }
  }

  // 2) من ملف محلي (cookies.txt في جذر المشروع)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const localPath = join(__dirname, '..', 'cookies.txt');
    if (existsSync(localPath)) {
      return localPath;
    }
  } catch {}

  return null;
}

function createYtDlpStream(url, attempt = 1, platform = 'youtube') {
  return new Promise((resolve, reject) => {
    const cookiesPath = ensureCookiesFile();

    // اختار extractor-args على حسب الـ platform
    let extractorArgs = null;
    if (platform === 'youtube') {
      extractorArgs = 'youtube:player_client=ios,android,web,web_safari,web_embedded,mweb;formats=missing_pot';
    }

    // args الأساسية
    const args = [
      '--no-playlist',
      '--no-warnings',
      ...(extractorArgs ? ['--extractor-args', extractorArgs] : []),
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '--no-part',
      '--no-mtime',
      '-o', '-',
      url
    ];

    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    // attempt 2: جرّب format أقل صرامة (لو bestaudio/webm فشل)
    if (attempt >= 2) {
      const idx = args.indexOf('-f');
      if (idx !== -1) args[idx + 1] = 'bestaudio/best';
    }

    let proc;
    try {
      proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return reject(new Error(`yt-dlp spawn error: ${err.message}`));
    }

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', err => reject(new Error(`yt-dlp spawn error: ${err.message}`)));

    const killTimeout = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      reject(new Error(`yt-dlp timeout بعد 60 ثانية (محاولة ${attempt})`));
    }, 60000);

    proc.stdout.once('data', () => {
      clearTimeout(killTimeout);
      resolve({ stream: proc.stdout, type: StreamType.Arbitrary, proc });
    });

    proc.on('close', code => {
      clearTimeout(killTimeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`yt-dlp فشل (كود ${code}, محاولة ${attempt}): ${stderr.slice(-500)}`));
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
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
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
    // استخرج URL لو موجود في وسط النص (يوتيوب + سبوتيفاي + ساوند كلاود + مباشر)
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const extractedUrl = query.match(urlRegex)?.[1];
    const effectiveQuery = extractedUrl || query.trim();

    const platformInfo = detectPlatform(effectiveQuery);
    const { isSpotify, isYouTube, isSoundCloud, soundcloudType, isDirect } = platformInfo;

    if (isSpotify) {
      const spotifyTracks = await this.fetchSpotifyInfo(effectiveQuery);
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
        url: effectiveQuery,
        duration: 0,
        platform: 'youtube',
        requestedBy
      }];
    }

    if (isSoundCloud) {
      // SoundCloud: لو link مباشر => stream على طول
      // لو playlist => play-dl يجيب قائمة
      try {
        if (soundcloudType === 'track') {
          const info = await playdl.soundcloud(effectiveQuery);
          return [{
            title: info.name || 'SoundCloud Track',
            url: info.url,
            duration: Math.floor((info.durationInSec || info.duration / 1000) || 0),
            artist: info.user?.name || '',
            thumbnail: info.thumbnail || null,
            platform: 'soundcloud',
            requestedBy
          }];
        }
        const so_playlist = await playdl.soundcloud(effectiveQuery);
        const tracks = await so_playlist.allVideos?.() || [];
        if (!tracks.length) throw new MusicStreamError('البلاي ليست SoundCloud فاضية');
        return tracks.slice(0, 100).map(t => ({
          title: t.name || 'Unknown',
          url: t.url,
          duration: Math.floor((t.durationInSec || t.duration / 1000) || 0),
          artist: t.user?.name || '',
          thumbnail: t.thumbnail || null,
          platform: 'soundcloud',
          requestedBy
        }));
      } catch (err) {
        console.warn('⚠️ فشل SoundCloud, بنجرب yt-dlp مباشرة:', err.message);
        return [{
          title: 'SoundCloud',
          url: effectiveQuery,
          duration: 0,
          platform: 'soundcloud',
          requestedBy
        }];
      }
    }

    if (isDirect) {
      // رابط مباشر لملف صوتي (mp3, m3u8, opus, ogg, wav, m4a...)
      return [{
        title: filenameFromUrl(effectiveQuery),
        url: effectiveQuery,
        duration: 0,
        platform: 'direct',
        requestedBy
      }];
    }

    const ytResults = await this.searchYouTube(effectiveQuery);
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

  async searchSoundCloud(query) {
    try {
      const results = await playdl.search(query, {
        source: { soundcloud: 'tracks' },
        limit: 5
      });
      return results.map(t => ({
        title: t.name || 'Unknown',
        url: t.url,
        duration: Math.floor((t.durationInSec || (t.duration || 0) / 1000) || 0),
        artist: t.user?.name || '',
        thumbnail: t.thumbnail || null,
        platform: 'soundcloud'
      }));
    } catch (err) {
      throw new MusicStreamError(`خطأ في البحث على SoundCloud: ${err.message}`);
    }
  }

  getPlatformEmoji(platform) {
    const map = {
      youtube: '📺 YouTube',
      spotify: '🎵 Spotify',
      soundcloud: '☁️ SoundCloud',
      direct: '🔗 Direct'
    };
    return map[platform] || '🎵 Unknown';
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
        const isSignInError = (msg) =>
          msg && (
            msg.includes('Sign in') ||
            msg.includes('bot') ||
            msg.includes('sign_in') ||
            msg.includes('Sign in to confirm') ||
            msg.includes('confirm you') ||
            msg.includes('HTTP Error 403') ||
            msg.includes('429')
          );

        // Try primary URL (نمرّر platform عشان args مناسبة)
        const songPlatform = song.platform || 'youtube';
        try {
          stream = await createYtDlpStream(song.url, 1, songPlatform);
        } catch (primaryErr) {
          const primaryMsg = primaryErr.message || '';

          // 1) لو مشكلة Sign-in / bot detection: جرّب format أضعف
          if (isSignInError(primaryMsg) || primaryMsg.includes('SABR') || primaryMsg.includes('PO Token')) {
            console.warn(`⚠️ حماية YouTube، بنجرب format بديل: ${song.title}`);
            try {
              stream = await createYtDlpStream(song.url, 2, songPlatform);
            } catch (altErr) {
              // 2) بس لو YouTube: جرّب 3 بدائل من نتائج البحث
              if (songPlatform === 'youtube') {
                console.warn(`⚠️ البحث عن نسخة بديلة: ${song.title}`);
                const searchQ = song.artist ? `${song.title} ${song.artist}` : song.title;
                const altResults = await this.searchYouTube(searchQ);
                let found = false;
                for (const alt of altResults.slice(0, 3)) {
                  if (alt.url === song.url) continue;
                  try {
                    stream = await createYtDlpStream(alt.url, 1, 'youtube');
                    song.url = alt.url;
                    found = true;
                    console.log(`✅ لقيت نسخة بديلة: ${alt.title}`);
                    break;
                  } catch {}
                }
                if (!found) throw primaryErr;
              } else {
                // SoundCloud / direct: مفيش بديل، هنرمي الـ err
                throw primaryErr;
              }
            }
          } else {
            throw primaryErr;
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
          const songPlat = song.platform || 'youtube';
          let reason;
          if (isSignInError(err.message)) {
            reason = songPlat === 'youtube'
              ? 'YouTube رفض الطلب (محتاج cookies صالحة في YOUTUBE_COOKIES)'
              : `${songPlat} رفض الطلب`;
          } else if (err.message?.includes('Unsupported URL')) {
            reason = `yt-dlp مش بيساند الرابط ده (${songPlat})`;
          } else if (err.message?.includes('HTTP Error 404')) {
            reason = 'الرابط مش موجود أو اتحذف';
          } else if (err.message?.includes('timeout')) {
            reason = 'انتهت المهلة قبل ما يجيب البث';
          } else if (err.message?.includes('Private video') || err.message?.includes('private')) {
            reason = 'الفيديو private';
          } else {
            reason = 'تعذر جلب البث الصوتي';
          }
          await queue.textChannel
            .send({
              content: `⚠️ تعذر تشغيل: **${song.title}**\n🎯 المنصة: ${this.getPlatformEmoji(songPlat)}\n📋 السبب: ${reason}\n⏭️ جاري الانتقال للأغنية التالية...`
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
