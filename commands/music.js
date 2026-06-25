// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي
//  مبني على Lavalink (shoukaku v4) — بدون YouTube scraping أو yt-dlp
//  Spotify-Only: Track / Playlist / Album / بحث نصي
// ════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Shoukaku, Connectors } from 'shoukaku';
import { sendMusicCard } from '../helpers/music-card.js';

// ─── ثوابت ───────────────────────────────────────────────────────
const SPOTIFY_URL_RE = /https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(track|playlist|album)\/([a-zA-Z0-9]+)/i;
const SPOTIFY_INTERNAL_LIMIT = 100;

// ─── إعداد Lavalink Nodes ────────────────────────────────────────
function getLavalinkNodes() {
  const host = process.env.LAVALINK_HOST || 'localhost';
  const port = parseInt(process.env.LAVALINK_PORT || '2333', 10);
  const auth = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
  const secure = process.env.LAVALINK_SECURE === 'true';

  return [
    {
      name: 'MainNode',
      url: `${host}:${port}`,
      auth,
      secure,
    },
  ];
}

// ─── Spotify Resolution (HTTP فقط، بدون YouTube) ─────────────────
function cleanSpotifyName(value = '') {
  return String(value)
    .replace(/\s*[-–]\s*song and lyrics by .+$/i, '')
    .replace(/\s*\|\s*Spotify\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function spotifyTrackToQuery(track) {
  const title = cleanSpotifyName(track?.title || track?.name);
  const artists = Array.isArray(track?.artists)
    ? track.artists.map(a => cleanSpotifyName(a?.name || a)).filter(Boolean).join(' ')
    : cleanSpotifyName(track?.artist || track?.subtitle);
  return [title, artists].filter(Boolean).join(' ').trim();
}

function collectSpotifyTracks(value, tracks = []) {
  if (!value || tracks.length >= SPOTIFY_INTERNAL_LIMIT) return tracks;
  if (Array.isArray(value)) {
    for (const item of value) collectSpotifyTracks(item, tracks);
    return tracks;
  }
  if (typeof value !== 'object') return tracks;
  const type = String(value.type || value.__typename || '').toLowerCase();
  const name = value.name || value.title;
  const artists = value.artists || value.subtitle || value.artist;
  if (name && (type.includes('track') || artists)) {
    const query = spotifyTrackToQuery({ title: name, artists, artist: artists, subtitle: value.subtitle });
    if (query && !tracks.some(t => t.query === query)) {
      tracks.push({ query, title: cleanSpotifyName(name), url: value.uri || value.shareUrl || value.url });
    }
  }
  for (const key of ['track', 'tracks', 'items', 'entities', 'contents', 'data']) {
    collectSpotifyTracks(value[key], tracks);
  }
  return tracks;
}

async function fetchSpotifyOEmbed(url) {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Spotify oEmbed رجّع ${res.status}`);
  const data = await res.json();
  const title = cleanSpotifyName(data?.title);
  if (!title) throw new Error('Spotify oEmbed مرجعش اسم الأغنية');
  return [{ query: title, title, url }];
}

async function resolveSpotifyUrl(url) {
  const match = url.match(SPOTIFY_URL_RE);
  if (!match) throw new Error('رابط Spotify غير صحيح');
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ZangiBot/1.0; +https://discord.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`Spotify page رجّع ${res.status}`);
    const html = await res.text();
    const script = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (!script?.[1]) throw new Error('Spotify غيّر شكل الصفحة');
    const data = JSON.parse(script[1]);
    const tracks = collectSpotifyTracks(data).slice(0, SPOTIFY_INTERNAL_LIMIT);
    if (tracks.length) return tracks;
  } catch (e) {
    console.warn('⚠️ [Music] Spotify page resolve فشل، هنستخدم oEmbed:', e.message);
  }
  return fetchSpotifyOEmbed(url);
}

// ─── كشف نوع الإدخال (Spotify-Only — يقبل بحث نصي) ───────────────
function detectSourceType(query) {
  const q = query.trim();
  if (/open\.spotify\.com\/(playlist|album)/i.test(q)) return 'spotify_playlist';
  if (/open\.spotify\.com\/track/i.test(q))            return 'spotify';
  if (/open\.spotify\.com/i.test(q))                   return 'spotify';
  // روابط مرفوضة
  if (/youtube\.com|youtu\.be|soundcloud\.com/i.test(q)) return 'unsupported';
  return 'text';
}

// ════════════════════════════════════════════════════════════════
//  GuildQueue — قائمة تشغيل سيرفر واحد
// ════════════════════════════════════════════════════════════════
class GuildQueue {
  constructor(guildId, voiceChannel, textChannel, player) {
    this.guildId      = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel  = textChannel;
    this.player       = player;
    this.songs        = [];      // Track[]
    this.currentSong  = null;    // Track | null
    this.volume       = 100;     // 0-100
    this.repeatMode   = 0;       // 0=off 1=song 2=queue
    this.paused       = false;
    this.currentMessage = null;
    this._stopping    = false;   // منع playNext بعد stop
  }

  /** وقت التشغيل الحالي بالثواني */
  get currentTime() {
    return Math.floor((this.player?.position || 0) / 1000);
  }
}

// ════════════════════════════════════════════════════════════════
//  MusicManager — المدير الرئيسي
// ════════════════════════════════════════════════════════════════
class MusicManager {
  constructor() {
    this.queues          = new Map(); // guildId → GuildQueue
    this.shoukaku        = null;
    this._autoLeaveTimers = new Map(); // guildId → TimeoutId
    this._pendingChannels = new Map(); // guildId → { voiceChannel, textChannel }
  }

  // ─── تهيئة Shoukaku ────────────────────────────────────────────
  init(client) {
    if (this.shoukaku) return;

    const nodes = getLavalinkNodes();
    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      nodes,
      {
        moveOnDisconnect: false,
        resumable: false,
        resumableTimeout: 30,
        reconnectTries: 3,
        restTimeout: 10000,
      }
    );

    this.shoukaku.on('ready',      (name) => {
      console.log(`✅ [Lavalink] Node "${name}" جاهز!`);
    });
    this.shoukaku.on('error',      (name, err) => {
      console.error(`❌ [Lavalink] Node "${name}":`, err.message);
    });
    this.shoukaku.on('close',      (name, code, reason) => {
      console.warn(`⚠️ [Lavalink] Node "${name}" أُغلق (${code}): ${reason}`);
    });
    this.shoukaku.on('disconnect', (name, players, moved) => {
      if (!moved) {
        for (const queue of this.queues.values()) {
          this._sendEmbed(queue.textChannel, 0xe74c3c, '🔌 الاتصال بـ Lavalink انقطع! الموسيقى اتوقفت.');
          this._cleanQueue(queue.guildId);
        }
      }
    });
  }

  // ─── أفضل node متاح (shoukaku v4) ──────────────────────────────
  _getNode() {
    if (!this.shoukaku) throw new Error('نظام Lavalink مش متهيّأ بعد!');
    const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
    if (!node) throw new Error('مفيش Lavalink node متاح! تأكد إن السيرفر شغّال وإن LAVALINK_HOST صح.');
    return node;
  }

  // ─── بحث عبر Lavalink REST ─────────────────────────────────────
  async search(query) {
    const node = this._getNode();
    // ytsearch: للبحث النصي، URL كما هو
    const identifier = /^https?:\/\//i.test(query) ? query : `ytsearch:${query}`;
    return node.rest.resolve(identifier);
  }

  // ─── جلب Queue ─────────────────────────────────────────────────
  getQueue(guildId) {
    return this.queues.get(guildId) || null;
  }

  // ─── الانضمام وإنشاء Queue (مرة واحدة فقط لكل guild) ──────────
  async _getOrCreateQueue(guildId, voiceChannel, textChannel) {
    const existing = this.queues.get(guildId);
    if (existing) return existing;

    // shoukaku v4: joinVoiceChannel يأخذ options object
    const player = await this.shoukaku.joinVoiceChannel({
      guildId,
      channelId: voiceChannel.id,
      shardId:   voiceChannel.guild.shardId ?? 0,
      deaf:      true,
      mute:      false,
    });

    const queue = new GuildQueue(guildId, voiceChannel, textChannel, player);
    this.queues.set(guildId, queue);

    // ── Player Events (shoukaku v4) ──────────────────────────────
    player.on('start', (data) => this._onStart(guildId));

    player.on('end', (data) => {
      // reason: 'finished' | 'stopped' | 'replaced' | 'cleanup' | 'loadFailed'
      const reason = data?.reason;
      if (reason !== 'replaced') this._onEnd(guildId, reason);
    });

    player.on('exception', (data) => {
      console.error(`❌ [Lavalink] Exception in ${guildId}:`, data?.exception?.message || JSON.stringify(data));
      const q = this.queues.get(guildId);
      if (q) this._sendEmbed(q.textChannel, 0xe74c3c, `⛔ خطأ في Lavalink: ${data?.exception?.message || 'خطأ مجهول'}`);
      this._onEnd(guildId, 'exception');
    });

    player.on('stuck', (data) => {
      console.warn(`⚠️ [Lavalink] Track stuck in ${guildId}`);
      this._onEnd(guildId, 'stuck');
    });

    player.on('closed', (data) => {
      this._cleanQueue(guildId);
    });

    return queue;
  }

  // ─── عند بداية الأغنية ────────────────────────────────────────
  async _onStart(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue?.currentSong) return;

    // إلغاء الخروج التلقائي لأن في أغنية بتشغّل
    this._clearAutoLeave(guildId);

    try {
      // احذف الكارت القديم
      if (queue.currentMessage) {
        await queue.currentMessage.delete().catch(() => {});
        queue.currentMessage = null;
      }

      if (queue.textChannel) {
        const song  = queue.currentSong;
        const qRef  = queue; // مرجع حي للـ queue الحقيقي

        // كائن متوافق مع sendMusicCard — getters حيّة
        const fakeSong = {
          name:      song.info.title,
          title:     song.info.title,
          thumbnail: song.info.artworkUrl || null,
          duration:  Math.floor((song.info.length || 0) / 1000),
          url:       song.info.uri || '',
          user:      song._requester || null,
        };

        const fakeQueue = {
          get paused()       { return qRef.paused; },
          get destroyed()    { return qRef._stopping; },
          get currentMessage() { return qRef.currentMessage; },
          set currentMessage(v) { qRef.currentMessage = v; },
          get currentTime()  { return qRef.currentTime; },
          get volume()       { return qRef.volume; },
          get repeatMode()   { return qRef.repeatMode; },
        };

        await sendMusicCard(fakeQueue, fakeSong, queue.textChannel);
      }
    } catch (e) {
      console.error('❌ [Music] _onStart:', e.message);
    }
  }

  // ─── عند انتهاء الأغنية ──────────────────────────────────────
  async _onEnd(guildId, reason) {
    const queue = this.queues.get(guildId);
    if (!queue || queue._stopping) return;

    // تكرار أغنية
    if (queue.repeatMode === 1 && queue.currentSong) {
      await this._playSong(queue, queue.currentSong);
      return;
    }

    // تكرار قائمة
    if (queue.repeatMode === 2 && queue.currentSong) {
      queue.songs.push(queue.currentSong);
    }

    // الأغنية التالية
    if (queue.songs.length > 0) {
      const next = queue.songs.shift();
      await this._playSong(queue, next);
    } else {
      queue.currentSong = null;
      if (queue.textChannel) {
        this._sendEmbed(queue.textChannel, 0x66FCF1, '🏁 خلصت القائمة!');
      }
      // انتظر 5 دقايق ثم خروج تلقائي
      this._scheduleAutoLeave(guildId);
    }
  }

  // ─── تشغيل أغنية ─────────────────────────────────────────────
  async _playSong(queue, track) {
    try {
      queue.currentSong = track;
      await queue.player.playTrack(
        { track: { encoded: track.encoded }, options: { volume: queue.volume } },
        false // noReplace = false
      );
    } catch (e) {
      console.error('❌ [Music] _playSong:', e.message);
      // الأغنية فشلت — انتقل للتالي
      setImmediate(() => this._onEnd(queue.guildId, 'loadFailed'));
    }
  }

  // ─── الخروج التلقائي بعد خمول ────────────────────────────────
  _scheduleAutoLeave(guildId) {
    this._clearAutoLeave(guildId);
    const t = setTimeout(() => {
      const q = this.queues.get(guildId);
      if (q && !q.currentSong && q.songs.length === 0) {
        if (q.textChannel) this._sendEmbed(q.textChannel, 0x808080, '💤 خرجت بعد 5 دقايق خمول!');
        this._cleanQueue(guildId);
      }
    }, 5 * 60 * 1000);
    this._autoLeaveTimers.set(guildId, t);
  }

  _clearAutoLeave(guildId) {
    const t = this._autoLeaveTimers.get(guildId);
    if (t) { clearTimeout(t); this._autoLeaveTimers.delete(guildId); }
  }

  // ─── تنظيف قائمة السيرفر (stop + disconnect) ─────────────────
  _cleanQueue(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    queue._stopping = true;
    this._clearAutoLeave(guildId);
    this._pendingChannels.delete(guildId);

    if (queue.currentMessage) {
      queue.currentMessage.delete().catch(() => {});
      queue.currentMessage = null;
    }

    try { this.shoukaku.leaveVoiceChannel(guildId); } catch {}
    this.queues.delete(guildId);
  }

  // ─── إرسال Embed مساعد ───────────────────────────────────────
  _sendEmbed(channel, color, description) {
    if (!channel?.send) return;
    channel.send({
      embeds: [new EmbedBuilder().setColor(color).setDescription(description)],
    }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════
  //  Public Methods — للأوامر
  // ═══════════════════════════════════════════════════════════════

  /** تشغيل أغنية / إضافة للقائمة */
  async play(guildId, voiceChannel, textChannel, searchQuery, requester = null) {
    const queue = await this._getOrCreateQueue(guildId, voiceChannel, textChannel);

    const result = await this.search(searchQuery);
    if (!result || result.loadType === 'empty' || result.loadType === 'error') {
      throw new Error(`مش لاقي نتايج لـ: ${searchQuery}`);
    }

    let tracks = [];
    let playlistName = null;

    if (result.loadType === 'search') {
      tracks = [result.data[0]];
    } else if (result.loadType === 'track') {
      tracks = [result.data];
    } else if (result.loadType === 'playlist') {
      tracks = result.data.tracks;
      playlistName = result.data.info?.name;
    }

    if (!tracks.length) throw new Error('مش لاقي أغاني قابلة للتشغيل!');

    // ربط الـ requester بكل track
    for (const t of tracks) t._requester = requester;

    if (!queue.currentSong) {
      const first = tracks.shift();
      await this._playSong(queue, first);
    }

    for (const t of tracks) queue.songs.push(t);

    return { playlistName, addedCount: tracks.length };
  }

  /** تخطي الأغنية الحالية */
  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    await queue.player.stopTrack();
  }

  /** إيقاف الموسيقى والخروج */
  async stop(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    queue._stopping = true;
    await queue.player.stopTrack().catch(() => {});
    this._cleanQueue(guildId);
  }

  /** إيقاف مؤقت */
  async pause(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    if (queue.paused) throw new Error('الأغنية موقوفة أصلاً!');
    await queue.player.setPaused(true);
    queue.paused = true;
  }

  /** استئناف */
  async resume(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    if (!queue.paused) throw new Error('الأغنية شغالة مش موقوفة!');
    await queue.player.setPaused(false);
    queue.paused = false;
  }

  /** ضبط مستوى الصوت (0-100) */
  async setVolume(guildId, level) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    queue.volume = clamped;
    // shoukaku v4: setGlobalVolume يأخذ 0-1000
    await queue.player.setGlobalVolume(clamped);
    return clamped;
  }

  /** وضع التكرار */
  setRepeatMode(guildId, mode) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    queue.repeatMode = mode;
    return mode;
  }

  /** خلط القائمة */
  shuffle(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    if (queue.songs.length <= 1) throw new Error('مفيش أغاني كفاية للخلط!');
    for (let i = queue.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
    }
    return queue.songs.length;
  }

  /** القفز لأغنية معينة (index 0-based من queue.songs) */
  async jump(guildId, index) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    if (index < 0 || index >= queue.songs.length) throw new Error('رقم غلط!');
    queue.songs.splice(0, index); // احذف ما قبلها
    await queue.player.stopTrack(); // بيشغّل الـ end event → plays next
  }

  /** حذف أغنية من القائمة (index 0-based من queue.songs) */
  removeSong(guildId, index) {
    const queue = this.getQueue(guildId);
    if (!queue) throw new Error('مفيش موسيقى شغالة!');
    if (index < 0 || index >= queue.songs.length) {
      throw new Error(`مفيش رقم ${index + 2} في القائمة!`);
    }
    return queue.songs.splice(index, 1)[0];
  }

  /** عرض القائمة (page 1-based) */
  getQueueDisplay(guildId, page = 1) {
    const queue = this.getQueue(guildId);
    if (!queue || (!queue.currentSong && !queue.songs.length)) return '❌ القائمة فاضية!';
    const perPage = 10;
    const allSongs = queue.currentSong ? [queue.currentSong, ...queue.songs] : queue.songs;
    const start = (page - 1) * perPage;
    return allSongs.slice(start, start + perPage).map((s, i) => {
      const idx = start + i;
      const dur = Math.floor((s.info.length || 0) / 1000);
      const min = Math.floor(dur / 60);
      const sec = (dur % 60).toString().padStart(2, '0');
      return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${s.info.title} \`${min}:${sec}\``;
    }).join('\n') || '❌ مفيش أغاني في الصفحة دي!';
  }

  getQueueSize(guildId) {
    const q = this.getQueue(guildId);
    return q ? q.songs.length + (q.currentSong ? 1 : 0) : 0;
  }

  formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const m   = Math.floor(sec / 60);
    const s   = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}

// ─── Instance وحيدة ────────────────────────────────────────────
const musicManager = new MusicManager();

// ═══════════════════════════════════════════════════════════════
//  Public Exports
// ═══════════════════════════════════════════════════════════════

/** تهيئة نظام Lavalink على الكلاينت */
export function initMusicSystem(client) {
  musicManager.init(client);

  // خروج تلقائي لو القناة فضت
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      if (oldState.member?.user?.bot || newState.member?.user?.bot) return;
      const guildId = oldState.guildId || newState.guildId;
      const queue   = musicManager.getQueue(guildId);
      if (!queue) return;

      const botChannel = queue.voiceChannel;
      if (!botChannel) return;

      const humans = botChannel.members.filter(m => !m.user.bot).size;
      if (humans === 0) {
        if (queue.textChannel) {
          queue.textChannel.send({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('👋 مفيش حد في القناة — البوت خرج!')],
          }).catch(() => {});
        }
        await musicManager.stop(guildId).catch(() => {});
      }
    } catch {}
  });

  console.log('✅ [Music] Lavalink Manager جاهز — في انتظار الـ node connection...');
  return musicManager;
}

/** musicHandler — للتوافق مع أوامر النص في index.js */
export const musicHandler = {
  getDistube() { return null; }, // للتوافق القديم (لا يُستخدم)

  getQueue(guildId) {
    const q = musicManager.getQueue(guildId);
    if (!q) return null;
    return {
      currentSong: q.currentSong ? {
        title:       q.currentSong.info.title,
        artist:      q.currentSong.info.author,
        duration:    Math.floor((q.currentSong.info.length || 0) / 1000),
        requestedBy: q.currentSong._requester?.username,
      } : null,
      songs:  q.songs.map(s => ({ title: s.info.title })),
      length: q.songs.length + (q.currentSong ? 1 : 0),
      volume: q.volume,
    };
  },

  async joinVoiceChannelAndPlay(guildId, voiceChannel, textChannel) {
    musicManager._pendingChannels.set(guildId, { voiceChannel, textChannel });
  },

  async resolveSource(query, userTag) {
    const sourceType = detectSourceType(query);
    if (sourceType === 'unsupported') {
      throw new Error('النظام Spotify-Only: ابعت رابط Spotify أو اسم أغنية بس');
    }
    if (sourceType === 'spotify' || sourceType === 'spotify_playlist') {
      const tracks = await resolveSpotifyUrl(query);
      return tracks.map(t => ({ query: t.query, title: t.title, requestedBy: userTag }));
    }
    return [{ query, title: query, requestedBy: userTag }];
  },

  async addToQueue(guildId, song) {
    const pending = musicManager._pendingChannels.get(guildId);
    if (!pending) throw new Error('مفيش قناة صوتية مسجّلة!');
    await musicManager.play(guildId, pending.voiceChannel, pending.textChannel, song.query, song.requestedBy);
  },

  async skip(guildId)   { return musicManager.skip(guildId); },
  async stop(guildId)   { return musicManager.stop(guildId); },
  async pause(guildId)  { return musicManager.pause(guildId); },
  async resume(guildId) { return musicManager.resume(guildId); },

  async setVolume(guildId, vol) {
    const level = Math.round(Math.max(0, Math.min(1, vol)) * 100);
    await musicManager.setVolume(guildId, level).catch(() => {});
    return level;
  },

  getQueueSize(guildId)              { return musicManager.getQueueSize(guildId); },
  getQueueDisplay(guildId, page = 1) { return musicManager.getQueueDisplay(guildId, page); },
  formatDuration(sec)                { return musicManager.formatDuration(sec * 1000); },
};

// ─── تسجيل أوامر الموسيقى ─────────────────────────────────────
export async function registerMusicCommands() {
  return [
    {
      data: new SlashCommandBuilder()
        .setName('شغل')
        .setDescription('🎵 شغّل أغنية أو بلاي ليست من Spotify (YouTube/SoundCloud مش مدعومين)')
        .addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو رابطها من Spotify').setRequired(true)),
      execute: handlePlay,
    },
    { data: new SlashCommandBuilder().setName('تخطي').setDescription('⏭️ تخطي الأغنية الحالية'), execute: handleSkip },
    { data: new SlashCommandBuilder().setName('وقف').setDescription('⏹️ إيقاف الموسيقى والخروج من القناة'), execute: handleStop },
    {
      data: new SlashCommandBuilder()
        .setName('قائمة')
        .setDescription('📋 عرض قائمة التشغيل')
        .addIntegerOption(o => o.setName('صفحة').setDescription('رقم الصفحة').setRequired(false).setMinValue(1)),
      execute: handleQueue,
    },
    { data: new SlashCommandBuilder().setName('بوز').setDescription('⏸️ إيقاف مؤقت للأغنية'), execute: handlePause },
    { data: new SlashCommandBuilder().setName('كمل').setDescription('▶️ استئناف التشغيل'), execute: handleResume },
    { data: new SlashCommandBuilder().setName('شغال-ايه').setDescription('🎶 اعرض الأغنية الشغالة دلوقتي'), execute: handleNowPlaying },
    {
      data: new SlashCommandBuilder()
        .setName('صوت')
        .setDescription('🔊 اضبط مستوى الصوت')
        .addIntegerOption(o => o.setName('مستوى').setDescription('من 0 لـ 100').setRequired(true).setMinValue(0).setMaxValue(100)),
      execute: handleVolume,
    },
    { data: new SlashCommandBuilder().setName('تكرار').setDescription('🔁 بدّل وضع التكرار (إيقاف / أغنية / قائمة)'), execute: handleRepeat },
    { data: new SlashCommandBuilder().setName('خلط').setDescription('🔀 خلط ترتيب القائمة عشوائياً'), execute: handleShuffle },
    {
      data: new SlashCommandBuilder()
        .setName('تخطى-لـ')
        .setDescription('⏩ تخطى لأغنية معينة في القائمة')
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية في القائمة').setRequired(true).setMinValue(1)),
      execute: handleJump,
    },
    {
      data: new SlashCommandBuilder()
        .setName('احذف')
        .setDescription('🗑️ احذف أغنية من القائمة')
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية (مش الشغالة دلوقتي)').setRequired(true).setMinValue(2)),
      execute: handleRemove,
    },
    { data: new SlashCommandBuilder().setName('كلمات').setDescription('📝 اعرض كلمات الأغنية الشغالة دلوقتي'), execute: handleLyrics },
  ];
}

// ════════════════════════════════════════════════════════════════
//  Command Handlers
// ════════════════════════════════════════════════════════════════

export async function handlePlay(interaction) {
  try {
    const query        = interaction.options?.getString('اغنية') || '';
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) return interaction.reply({ content: '❌ لازم تكون في قناة صوتية الأول!', ephemeral: true });
    if (!query)        return interaction.reply({ content: '❌ اكتب اسم الأغنية أو رابطها!', ephemeral: true });

    const sourceType = detectSourceType(query);
    if (sourceType === 'unsupported') {
      return interaction.reply({
        content: '❌ النظام Spotify-Only!\n💡 ارفق رابط من `open.spotify.com` أو اكتب اسم الأغنية للبحث.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const loadingMsg = {
      spotify_playlist: '🎵 جاري تحميل البلاي ليست من Spotify...',
      spotify:          '🎵 جاري التحميل من Spotify...',
      text:             '🔍 جاري البحث...',
    };
    await interaction.editReply({ content: loadingMsg[sourceType] || '🔍 جاري التحميل...' });

    const requester = interaction.member?.user || null;

    if (sourceType === 'spotify' || sourceType === 'spotify_playlist') {
      // Spotify URL → أسماء أغاني → Lavalink search
      const tracks = await resolveSpotifyUrl(query);
      if (!tracks.length) throw new Error('Spotify مرجعش أغاني!');

      let added = 0;
      for (const [i, track] of tracks.slice(0, SPOTIFY_INTERNAL_LIMIT).entries()) {
        try {
          await musicManager.play(interaction.guildId, voiceChannel, interaction.channel, track.query, requester);
          added++;
          if (i === 0 && tracks.length > 1) {
            await interaction.editReply({ content: `✅ جاري إضافة **${tracks.length}** أغنية من Spotify...` }).catch(() => {});
          }
        } catch (e) {
          console.warn(`⚠️ [Music] تعذّر إضافة "${track.title}":`, e.message);
        }
      }

      await interaction.editReply({
        content: tracks.length > 1 ? `✅ تم إضافة **${added}** أغنية من Spotify!` : '✅ تم!',
      }).catch(() => {});
    } else {
      // بحث نصي — Lavalink يبحث على YouTube
      await musicManager.play(interaction.guildId, voiceChannel, interaction.channel, query, requester);
      await interaction.editReply({ content: '✅ تم!' }).catch(() => {});
    }
  } catch (e) {
    const errMsg = e?.message || String(e);
    console.error('❌ [Music] handlePlay:', errMsg);

    let msg;
    if (/Lavalink|node|connection|ECONNREFUSED/i.test(errMsg)) {
      msg = `⚠️ مشكلة في الاتصال بـ Lavalink!\n💡 راجع \`LAVALINK_RAILWAY.md\` لإعداد السيرفر.`;
    } else if (/private|unavailable|blocked/i.test(errMsg)) {
      msg = `🔒 الأغنية private أو blocked! جرب أغنية تانية.`;
    } else if (/مش لاقي|empty|no result/i.test(errMsg)) {
      msg = `❌ مش لاقي نتايج! جرب رابط Spotify مباشر أو اسم آخر.`;
    } else {
      msg = `❌ حصل خطأ: \`${errMsg.slice(0, 300)}\``;
    }

    try { await interaction.editReply({ content: msg }); }
    catch { await interaction.reply({ content: msg, ephemeral: true }).catch(() => {}); }
  }
}

export async function handleSkip(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    await musicManager.skip(interaction.guildId);
    await interaction.reply({ content: '⏭️ اتخطت الأغنية!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleStop(interaction) {
  try {
    const isButton = interaction.isButton?.();
    if (isButton) await interaction.deferUpdate().catch(() => {});

    const q = musicManager.getQueue(interaction.guildId);

    if (isButton && interaction.message) {
      await interaction.message.delete().catch(() => {});
    }
    if (q?.currentMessage) {
      await q.currentMessage.delete().catch(() => {});
    }

    if (q) await musicManager.stop(interaction.guildId);

    if (!isButton) {
      await interaction.reply({ content: '⏹️ اتوقف وخرجت من القناة!', ephemeral: true });
    }
  } catch (e) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
      }
    } catch {}
  }
}

export async function handleQueue(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q || (!q.currentSong && !q.songs.length)) {
      return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });
    }

    const page     = interaction.options?.getInteger('صفحة') || 1;
    const allSongs = q.currentSong ? [q.currentSong, ...q.songs] : q.songs;
    const perPage  = 10;
    const start    = (page - 1) * perPage;

    const lines = allSongs.slice(start, start + perPage).map((s, i) => {
      const idx = start + i;
      const dur = Math.floor((s.info.length || 0) / 1000);
      const min = Math.floor(dur / 60);
      const sec = (dur % 60).toString().padStart(2, '0');
      return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${s.info.title} \`${min}:${sec}\``;
    });

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🎵 قائمة التشغيل')
        .setDescription(lines.join('\n') || '❌ مفيش أغاني في الصفحة دي!')
        .setColor(0x66FCF1)
        .setFooter({ text: `🔊 ${q.volume}% | ${allSongs.length} أغنية | صفحة ${page}` })
        .setTimestamp()],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handlePause(interaction) {
  try {
    await musicManager.pause(interaction.guildId);
    await interaction.reply({ content: '⏸️ اتوقفت مؤقتاً!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleResume(interaction) {
  try {
    await musicManager.resume(interaction.guildId);
    await interaction.reply({ content: '▶️ كملت التشغيل!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleNowPlaying(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q?.currentSong) return interaction.reply({ content: '❌ مفيش أغنية شغالة دلوقتي!', ephemeral: true });

    const song        = q.currentSong;
    const cur         = q.currentTime;
    const tot         = Math.floor((song.info.length || 0) / 1000);
    const pct         = tot > 0 ? Math.floor((cur / tot) * 100) : 0;
    const fmt         = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const repeatLabel = q.repeatMode === 0 ? '❌ إيقاف' : q.repeatMode === 1 ? '🔂 أغنية' : '🔁 قائمة';

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🎵 شغّال دلوقتي')
        .setDescription(`**${song.info.title}**`)
        .setThumbnail(song.info.artworkUrl || null)
        .addFields(
          { name: '⏱️ الوقت',   value: `\`${fmt(cur)} / ${fmt(tot)}\``, inline: true },
          { name: '🔊 الصوت',   value: `\`${q.volume}%\``,              inline: true },
          { name: '🔁 التكرار', value: `\`${repeatLabel}\``,            inline: true },
          { name: '📊 التقدم',  value: `\`${pct}%\``,                   inline: true },
        )
        .setColor(0x66FCF1)
        .setTimestamp()],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleVolume(interaction) {
  try {
    const level = interaction.options?.getInteger('مستوى') ?? interaction.options?.getInteger('level');
    if (level == null) return interaction.reply({ content: '❌ ادخل مستوى الصوت!', ephemeral: true });
    await musicManager.setVolume(interaction.guildId, level);
    await interaction.reply({ content: `🔊 الصوت اتضبط على **${level}%**`, ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleRepeat(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    const next   = q.repeatMode === 0 ? 1 : q.repeatMode === 1 ? 2 : 0;
    musicManager.setRepeatMode(interaction.guildId, next);
    const labels = ['❌ التكرار اتوقف', '🔂 بيكرر الأغنية', '🔁 بيكرر القائمة'];
    await interaction.reply({ content: labels[next], ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleShuffle(interaction) {
  try {
    const count = musicManager.shuffle(interaction.guildId);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x9b59b6).setDescription(`🔀 اتخلطت القائمة! (${count} أغنية)`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleJump(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    const num = interaction.options.getInteger('رقم');
    if (num < 2) return interaction.reply({ content: '⏩ الأغنية دي شغالة أصلاً!', ephemeral: true });

    const queueIndex = num - 2; // queue.songs هي الأغاني من الثانية فصاعداً
    if (queueIndex >= q.songs.length) {
      return interaction.reply({ content: `❌ مفيش رقم ${num} في القائمة! (في ${q.songs.length + 1} أغنية)`, ephemeral: true });
    }

    const targetTitle = q.songs[queueIndex]?.info?.title || '';
    await musicManager.jump(interaction.guildId, queueIndex);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏩ بتخطى لـ **${targetTitle}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleRemove(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    const num        = interaction.options.getInteger('رقم');
    const queueIndex = num - 2; // الرقم 2 = أول عنصر في queue.songs

    if (num < 2) {
      return interaction.reply({ content: '❌ مش ممكن تحذف الأغنية الشغالة — استخدم `/تخطي`!', ephemeral: true });
    }
    if (queueIndex >= q.songs.length) {
      return interaction.reply({ content: `❌ مفيش رقم ${num} في القائمة! (في ${q.songs.length + 1} أغنية)`, ephemeral: true });
    }

    const removed = musicManager.removeSong(interaction.guildId, queueIndex);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🗑️ اتشالت من القائمة: **${removed.info.title}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

export async function handleLyrics(interaction) {
  try {
    const q = musicManager.getQueue(interaction.guildId);
    if (!q?.currentSong) return interaction.reply({ content: '❌ مفيش أغنية شغالة دلوقتي!', ephemeral: true });

    await interaction.deferReply();

    const song      = q.currentSong;
    const cleanName = song.info.title
      .replace(/\(.*?(official|video|audio|lyrics|hd|hq|mv|4k|clip|music|lyric|visualizer).*?\)/gi, '')
      .replace(/\[.*?\]/gi, '')
      .replace(/official\s*(video|audio|music video|lyric video)?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    let genius;
    try {
      const { Client: GeniusClient } = await import('genius-lyrics');
      genius = new GeniusClient();
    } catch {
      return interaction.editReply({ content: '❌ مكتبة الكلمات مش متثبّتة! شغّل: `npm install genius-lyrics`' });
    }

    let lyrics    = null;
    let foundTitle = cleanName;

    try {
      const searches = await genius.songs.search(cleanName);
      if (searches.length > 0) {
        lyrics     = await searches[0].lyrics();
        foundTitle = searches[0].title;
      }
    } catch (searchErr) {
      console.warn('⚠️ [Lyrics] Genius فشل:', searchErr.message);
    }

    if (!lyrics) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setDescription(`❌ مش لاقي كلمات لـ **${cleanName}**\n💡 جرب اسم الأغنية بالإنجليزي`)],
      });
    }

    const MAX    = 4000;
    const chunks = [];
    let remaining = lyrics;
    while (remaining.length > 0) {
      if (remaining.length <= MAX) { chunks.push(remaining); break; }
      const cut = remaining.lastIndexOf('\n', MAX);
      chunks.push(remaining.slice(0, cut > 0 ? cut : MAX));
      remaining = remaining.slice(cut > 0 ? cut + 1 : MAX);
    }

    const embeds = chunks.map((chunk, i) => {
      const e = new EmbedBuilder().setColor(0xf1c40f).setDescription(chunk);
      if (i === 0) {
        e.setTitle(`📝 ${foundTitle}`);
        if (song.info.artworkUrl) e.setThumbnail(song.info.artworkUrl);
      }
      if (i === chunks.length - 1) e.setFooter({ text: `🎵 ${song.info.title} | الكلمات من Genius` });
      return e;
    });

    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      if (i === 0) await interaction.editReply({ embeds: batch });
      else         await interaction.followUp({ embeds: batch });
    }
  } catch (e) {
    console.error('❌ [Lyrics]', e.message);
    try { await interaction.editReply({ content: `❌ ${e.message}` }); } catch {}
  }
}
