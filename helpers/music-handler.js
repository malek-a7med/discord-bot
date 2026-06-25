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
import { writeFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MusicStreamError, VoiceChannelError } from '../errors.js';
import { generateMusicCard } from './music-card.js';
import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

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
// v4: Cookies Validation + Priority Order
//
// الترتيب:
//   1) ملف cookies.txt في الـ root (الأكثر موثوقية على Replit)
//   2) Environment variable YOUTUBE_COOKIES (Secret)
//   3) مفيش cookies (fallback)

// Cache للـ cookies path عشان منكررش الـ disk I/O كل مرة
let _cookiesPathCache = null;
let _cookiesSourceCache = null;

function validateCookiesFile(filePath) {
  try {
    if (!existsSync(filePath)) return false;
    const stat = statSync(filePath);
    if (stat.size < 100) return false; // ملف صغير = فاضي غالباً
    const content = readFileSync(filePath, 'utf8');
    if (!content.includes('.youtube.com')) return false;
    if (!content.includes('VISITOR_INFO1_LIVE') && !content.includes('LOGIN_INFO')) return false;
    return true;
  } catch (err) {
    console.warn(`⚠️ [cookies] validation error for ${filePath}: ${err.message}`);
    return false;
  }
}

function ensureCookiesFile() {
  // Cache hit
  if (_cookiesPathCache && existsSync(_cookiesPathCache)) {
    return _cookiesPathCache;
  }

  let __dirname_local;
  try {
    const __filename = fileURLToPath(import.meta.url);
    __dirname_local = dirname(__filename);
  } catch {
    __dirname_local = process.cwd();
  }

  // 1) ملف محلي cookies.txt (الأولوية)
  const localCandidates = [
    join(__dirname_local, '..', 'cookies.txt'),       // helpers/../cookies.txt
    join(process.cwd(), 'cookies.txt'),                // ./cookies.txt
    '/home/runner/workspace/cookies.txt'              // absolute
  ];

  for (const localPath of localCandidates) {
    if (validateCookiesFile(localPath)) {
      _cookiesPathCache = localPath;
      _cookiesSourceCache = 'file:cookies.txt';
      console.log(`🍪 [cookies] using local file: ${localPath}`);
      return localPath;
    }
  }

  // 2) Environment Variable
  const envCookies = process.env.YOUTUBE_COOKIES;
  if (envCookies && envCookies.trim().length > 0) {
    const envPath = '/tmp/yt-cookies-env.txt';
    try {
      const normalized = envCookies
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
      writeFileSync(envPath, normalized, 'utf8');
      if (validateCookiesFile(envPath)) {
        _cookiesPathCache = envPath;
        _cookiesSourceCache = 'env:YOUTUBE_COOKIES';
        console.log(`🍪 [cookies] using env var (${envCookies.length} chars)`);
        return envPath;
      } else {
        console.warn('⚠️ [cookies] env var موجود بس invalid - مش فيه VISITOR_INFO1_LIVE');
      }
    } catch (err) {
      console.warn('⚠️ [cookies] فشل كتابة env cookies:', err.message);
    }
  }

  // 3) مفيش
  _cookiesSourceCache = 'none';
  console.warn('⚠️ [cookies] لا ملف محلي ولا env var! YouTube هيرفض الطلب');
  return null;
}

function getCookiesSource() {
  if (_cookiesSourceCache) return _cookiesSourceCache;
  ensureCookiesFile();
  return _cookiesSourceCache || 'none';
}

function createYtDlpStream(url, attempt = 1, platform = 'youtube') {
  return new Promise((resolve, reject) => {
    const cookiesPath = ensureCookiesFile();

    // اختار extractor-args على حسب الـ platform
    // v4: client list أوسع (tv_embedded + web_creator بيدوّر على اللي شغال)
    let extractorArgs = null;
    if (platform === 'youtube') {
      extractorArgs = 'youtube:player_client=default,web_safari,web_embedded,android_vr,android_creator,web_creator,mweb,ios_creator,ios,android,mediaconnect;formats=missing_pot';
    }

    // args الأساسية
    const args = [
      '--no-playlist',
      '--no-warnings',
      ...(extractorArgs ? ['--extractor-args', extractorArgs] : []),
      // format أوسع يشمل mediaconnect
      '-f', 'bestaudio[acodec^=opus]/bestaudio[ext=webm]/bestaudio/best',
      '--no-part',
      '--no-mtime',
      // user agent عشان نتجنّب quick bot detection
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '-o', '-',
      url
    ];

    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    // attempt 2: format أضعف
    if (attempt >= 2) {
      const idx = args.indexOf('-f');
      if (idx !== -1) args[idx + 1] = 'bestaudio/best/worst';
    }
    // attempt 3: بدون cookies (لو cookies فاسدة)
    if (attempt >= 3 && cookiesPath) {
      const cidx = args.indexOf('--cookies');
      if (cidx !== -1) {
        args.splice(cidx, 2); // شيل --cookies و الـ path
      }
    }

    if (process.env.MUSIC_DEBUG === '1') {
      console.log(`\n🎬 [yt-dlp attempt ${attempt}] url=${url}`);
      console.log(`   platform=${platform} cookies=${cookiesPath ? '✅' : '❌'}`);
      console.log(`   cmd: ${YTDLP_PATH} ${args.join(' ')}\n`);
    }

    let proc;
    try {
      proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return reject(new Error(`yt-dlp spawn error: ${err.message}`));
    }

    let stderr = '';
    proc.stderr.on('data', d => {
      const s = d.toString();
      stderr += s;
      // 🐛 Debug: اطبع stderr المهم في الـ console
      const line = s.trim();
      if (line && (
        line.includes('ERROR') ||
        line.includes('Sign in') ||
        line.includes('HTTP Error') ||
        line.includes('confirm') ||
        line.includes('SABR') ||
        line.includes('PO Token') ||
        line.includes('Could not extract') ||
        line.includes('Unable to extract') ||
        line.includes('n challenge')
      )) {
        console.warn(`[yt-dlp attempt ${attempt}] ${line}`);
      }
    });

    proc.on('error', err => reject(new Error(`yt-dlp spawn error: ${err.message}`)));

    const killTimeout = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      reject(new Error(`yt-dlp timeout بعد 60 ثانية (محاولة ${attempt})`));
    }, 60000);

    proc.stdout.once('data', () => {
      clearTimeout(killTimeout);
      resolve({ stream: proc.stdout, type: StreamType.WebmOpus, proc });
    });

    proc.on('close', code => {
      clearTimeout(killTimeout);
      if (code !== 0 && code !== null) {
        if (process.env.MUSIC_DEBUG === '1') {
          console.error(`\n[yt-dlp exit ${code}]: ${stderr.slice(-1200)}\n`);
        }
        reject(new Error(`yt-dlp فشل (كود ${code}, محاولة ${attempt}): ${stderr.slice(-500)}`));
      }
    });
  });
}

class MusicHandler {
  constructor() {
    this.queues = new Map(); // guildId -> queue object
    this.autoplayTimeouts = new Map(); // guildId -> timeout
    this.skipCounters = new Map(); // guildId -> عدد الأغاني اللي اتخطّت على التوالي (عشان recursion)
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
      console.log(`🎵 Spotify: ${spotifyTracks.length} أغنية`);

      // ⚡ البحث في parallel (بدل sequential) عشان نوفر وقت
      const searchPromises = spotifyTracks.map(async (track) => {
        try {
          const searchQuery = track.artist ? `${track.title} ${track.artist}` : track.title;
          const ytResults = await this.searchYouTube(searchQuery);
          if (ytResults.length > 0) {
            return {
              ...ytResults[0],
              title: track.title,
              artist: track.artist,
              duration: track.duration || ytResults[0].duration,
              platform: 'spotify',
              requestedBy
            };
          }
        } catch (err) {
          console.warn(`⚠️ تخطي "${track.title}": ${err.message}`);
        }
        return null;
      });

      const searchResults = await Promise.allSettled(searchPromises);
      for (const r of searchResults) {
        if (r.status === 'fulfilled' && r.value) {
          results.push(r.value);
        }
      }

      if (results.length === 0) throw new MusicStreamError('ما لقيتش أي أغنية من Spotify');
      console.log(`✅ Spotify: ${results.length}/${spotifyTracks.length} أغنية جاهزة`);
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

  _incrementSkipCounter(guildId) {
    const c = (this.skipCounters.get(guildId) || 0) + 1;
    this.skipCounters.set(guildId, c);
    return c;
  }

  _resetSkipCounter(guildId) {
    this.skipCounters.set(guildId, 0);
  }

  async playNext(guildId) {
    try {
      const queue = this.getQueue(guildId);
      if (!queue || !queue.connection || !queue.player) {
        return;
      }

      // ⚠️ أمان: لو عدّى أكتر من 10 أغاني متخطّية على التوالي، نوقف (احتمال مشكلة كبيرة)
      const skippedCount = this.skipCounters.get(guildId) || 0;
      if (skippedCount > 10) {
        console.error(`❌ وقف التشغيل: ${skippedCount} أغنية متخطّية على التوالي (غلط كبير)`);
        this._resetSkipCounter(guildId);
        queue.isPlaying = false;
        queue.currentSong = null;
        if (queue.textChannel) {
          await queue.textChannel.send({
            content: `⛔ **وقف التشغيل بسبب فشل متكرر**\n📋 اتخطّت ${skippedCount} أغنية على التوالي\n💡 شوف الـ console للتفاصيل أو حدّث YOUTUBE_COOKIES`
          }).catch(() => {});
        }
        this.setupAutoDisconnect(guildId);
        return;
      }

      // Handle loop modes
      if (queue.loopMode === 'one' && queue.currentSong) {
        queue.songs.unshift(queue.currentSong);
      }

      if (queue.songs.length === 0) {
        queue.isPlaying = false;
        queue.currentSong = null;
        this._resetSkipCounter(guildId);
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
            msg.includes('429') ||
            msg.includes('SABR') ||
            msg.includes('PO Token') ||
            msg.includes('Could not extract') ||
            msg.includes('Unable to extract')
          );

        // Try primary URL (نمرّر platform عشان args مناسبة)
        const songPlatform = song.platform || 'youtube';
        let lastErr = null;

        // Strategy 1: yt-dlp attempt 1 (default clients)
        try {
          stream = await createYtDlpStream(song.url, 1, songPlatform);
        } catch (err1) {
          lastErr = err1;
          const msg1 = err1.message || '';

          // Strategy 2: yt-dlp attempt 2 (format أضعف)
          if (isSignInError(msg1) || msg1.includes('format') || msg1.includes('No video')) {
            console.warn(`⚠️ محاولة 2 (format أضعف): ${song.title}`);
            try {
              stream = await createYtDlpStream(song.url, 2, songPlatform);
            } catch (err2) {
              lastErr = err2;
              // Strategy 3: yt-dlp attempt 3 (بدون cookies)
              if (songPlatform === 'youtube' && getCookiesSource() !== 'none') {
                console.warn(`⚠️ محاولة 3 (بدون cookies): ${song.title}`);
                try {
                  stream = await createYtDlpStream(song.url, 3, songPlatform);
                } catch (err3) {
                  lastErr = err3;
                  // Strategy 4: لو YouTube، جرّب 3 بدائل من نتائج البحث
                  if (songPlatform === 'youtube') {
                    console.warn(`⚠️ محاولة 4 (بحث عن بديل): ${song.title}`);
                    const searchQ = song.artist ? `${song.title} ${song.artist}` : song.title;
                    try {
                      const altResults = await this.searchYouTube(searchQ);
                      let found = false;
                      for (const alt of altResults.slice(0, 5)) {
                        if (alt.url === song.url) continue;
                        try {
                          stream = await createYtDlpStream(alt.url, 1, 'youtube');
                          song.url = alt.url;
                          song.title = alt.title;
                          found = true;
                          console.log(`✅ نسخة بديلة: ${alt.title}`);
                          break;
                        } catch {}
                      }
                      if (!found) throw err3;
                    } catch (searchErr) {
                      throw err3;
                    }
                  } else {
                    throw err3;
                  }
                }
              } else if (songPlatform === 'youtube') {
                // بدون cookies من الأساس: روح على Strategy 4 مباشرة
                console.warn(`⚠️ محاولة 4 (بحث عن بديل): ${song.title}`);
                const searchQ = song.artist ? `${song.title} ${song.artist}` : song.title;
                try {
                  const altResults = await this.searchYouTube(searchQ);
                  let found = false;
                  for (const alt of altResults.slice(0, 5)) {
                    if (alt.url === song.url) continue;
                    try {
                      stream = await createYtDlpStream(alt.url, 1, 'youtube');
                      song.url = alt.url;
                      song.title = alt.title;
                      found = true;
                      console.log(`✅ نسخة بديلة: ${alt.title}`);
                      break;
                    } catch {}
                  }
                  if (!found) throw err2;
                } catch (searchErr) {
                  throw err2;
                }
              } else {
                throw err2;
              }
            }
          } else {
            throw err1;
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
        this._resetSkipCounter(guildId); // reset لأن الأغنية نجحت

        // Notify channel with music card + control buttons
        if (queue.textChannel) {
          try {
            const cardBuf = await generateMusicCard(song, 0);
            const row1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('music_pause').setLabel('⏸ إيقاف').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('music_resume').setLabel('▶️ استئناف').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('music_skip').setLabel('⏭ تخطي').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('music_stop').setLabel('⏹ خروج').setStyle(ButtonStyle.Danger),
            );
            const row2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('music_vol_up').setLabel('🔊 +10').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('music_vol_down').setLabel('🔉 -10').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('music_nowplaying').setLabel('🎵 الآن').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setUrl(song.url || 'https://youtube.com').setLabel('🔗 الرابط').setStyle(ButtonStyle.Link),
            );
            const payload = { components: [row1, row2] };
            if (cardBuf) {
              const attachment = new AttachmentBuilder(cardBuf, { name: 'musiccard.png' });
              payload.files = [attachment];
            } else {
              payload.content = `🎵 **جاري التشغيل:** ${song.title}`;
            }
            // حذف البطاقة القديمة لو موجودة
            if (queue.currentCardMsg) {
              queue.currentCardMsg.delete().catch(() => {});
              queue.currentCardMsg = null;
            }
            queue.currentCardMsg = await queue.textChannel.send(payload).catch(() => null);
          } catch {
            queue.textChannel.send({ content: `🎵 **جاري التشغيل:** ${song.title}` }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`❌ فشل تشغيل: ${song.title} | ${song.url}`);
        console.error(`   السبب: ${err.message}`);
        const skipNum = this._incrementSkipCounter(guildId);

        if (queue.textChannel) {
          const songPlat = song.platform || 'youtube';
          let reason;
          const msg = err.message || '';
          if (isSignInError(msg)) {
            const cs = getCookiesSource();
            reason = songPlat === 'youtube'
              ? `YouTube رفض الطلب (cookies: ${cs === 'none' ? '❌ مفقودة!' : '⚠️ موجودة بس ممكن تكون قديمة'})`
              : `${songPlat} رفض الطلب`;
          } else if (msg.includes('Unsupported URL')) {
            reason = `yt-dlp مش بيساند الرابط ده (${songPlat})`;
          } else if (msg.includes('HTTP Error 404')) {
            reason = 'الرابط مش موجود أو اتحذف';
          } else if (msg.includes('timeout')) {
            reason = 'انتهت المهلة (النت بطيء)';
          } else if (msg.includes('Private video') || msg.includes('private')) {
            reason = 'الفيديو private';
          } else if (msg.includes('Video unavailable')) {
            reason = 'الفيديو مش متاح';
          } else {
            // اظهر آخر 200 حرف من الـ error عشان المستخدم يفهم
            reason = msg.length > 200 ? msg.slice(-200) : msg;
          }

          await queue.textChannel
            .send({
              content: `⚠️ تعذر تشغيل: **${song.title}**\n🎯 المنصة: ${this.getPlatformEmoji(songPlat)}\n📋 السبب: ${reason}\n⏭️ تخطّى (${skipNum} على التوالي)...`
            })
            .catch(() => {});
        }

        // بدل recursion: setImmediate (أأمن للـ stack)
        setImmediate(() => this.playNext(guildId));
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
