// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي
//  @discordjs/voice + play-dl + spotify-url-info
//  يوتيوب ✅ | Spotify ✅ | SoundCloud ✅ | بحث نصي ✅
// ════════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import playdl from 'play-dl';
import { sendMusicCard } from '../helpers/music-card.js';

// ─── خريطة الجلسات: guildId → GuildPlayer ────────────────────
const players = new Map();

// ─── تنسيق الوقت (ms → m:ss) ──────────────────────────────────
function fmt(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}

// ─── كشف نوع الرابط ───────────────────────────────────────────
function detectSource(q) {
  if (/open\.spotify\.com\/(playlist|album)/i.test(q)) return 'spotify_collection';
  if (/open\.spotify\.com\/artist/i.test(q))            return 'spotify_artist';
  if (/open\.spotify\.com\/track/i.test(q))             return 'spotify_track';
  if (/spotify\.link\//i.test(q))                       return 'spotify_short';
  if (/^spotify:(track|playlist|album|artist):/i.test(q)) return 'spotify_uri';
  if (/soundcloud\.com/i.test(q))                       return 'soundcloud';
  if (/youtu\.?be|youtube\.com/i.test(q)) {
    if (/[?&]list=/i.test(q)) return 'yt_playlist';
    return 'yt_video';
  }
  return 'search';
}

// ─── جلب أغاني Spotify بدون API key ──────────────────────────
async function fetchSpotifyTracks(url) {
  try {
    const { default: sui } = await import('spotify-url-info');
    const { getData }      = sui(fetch);
    const data = await getData(url);

    // تراك واحد
    if (data.type === 'track') {
      const name   = data.name   || '';
      const artist = data.artists?.[0]?.name || '';
      return {
        type:   'track',
        name:   data.name || url,
        tracks: [artist ? `${artist} ${name}` : name],
      };
    }

    // بلاي ليست / ألبوم / فنان
    const rawTracks = data.tracks?.items || data.tracks || [];
    const tracks = [];
    for (const item of rawTracks) {
      const t      = item.track || item;
      const name   = t.name   || '';
      const artist = t.artists?.[0]?.name || '';
      if (name) tracks.push(artist ? `${artist} ${name}` : name);
      if (tracks.length >= 100) break; // حد أقصى 100 أغنية
    }
    if (!tracks.length) throw new Error('البلاي ليست فاضية أو مش عامة (Public)!');
    return { type: data.type || 'playlist', name: data.name || 'Spotify', tracks };
  } catch (e) {
    throw new Error(`فشل جلب Spotify: ${e.message}`);
  }
}

// ─── بحث في يوتيوب وإرجاع Track object ───────────────────────
async function searchYouTube(query) {
  try {
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results.length) throw new Error(`مش لاقي: "${query.slice(0,60)}"`);
    const v = results[0];
    return {
      title:     v.title     || query,
      url:       v.url,
      duration:  (v.durationInSec || 0) * 1000,
      thumbnail: v.thumbnails?.[0]?.url || null,
      author:    v.channel?.name || '',
    };
  } catch (e) {
    throw new Error(`مش لاقي: "${query.slice(0,60)}"`);
  }
}

// ─── محلل الطلبات الموحّد ─────────────────────────────────────
async function resolve(query, requester) {
  const src = detectSource(query);

  // ── Spotify ─────────────────────────────────────────────────
  if (src.startsWith('spotify')) {
    let spotUrl = query;
    // تحويل URI إلى URL
    if (src === 'spotify_uri') {
      const p = query.split(':');
      spotUrl = `https://open.spotify.com/${p[1]}/${p[2]}`;
    }
    const sp = await fetchSpotifyTracks(spotUrl);
    const tracks = [];
    const first  = await searchYouTube(sp.tracks[0]).catch(() => null);
    if (first) tracks.push({ ...first, requester });
    return {
      type:          sp.type === 'track' ? 'track' : 'playlist',
      name:          sp.name,
      spotifyQueue:  sp.tracks.slice(1), // الباقي يتحل في الخلفية
      requester,
      tracks,
    };
  }

  // ── يوتيوب بلاي ليست ────────────────────────────────────────
  if (src === 'yt_playlist') {
    const pl   = await playdl.playlist_info(query, { incomplete: true });
    const vids = await pl.all_videos();
    return {
      type:   'playlist',
      name:   pl.title || 'Playlist',
      tracks: vids.map(v => ({
        title:     v.title || 'أغنية',
        url:       v.url,
        duration:  (v.durationInSec || 0) * 1000,
        thumbnail: v.thumbnails?.[0]?.url || null,
        author:    v.channel?.name || '',
        requester,
      })),
    };
  }

  // ── يوتيوب رابط مباشر ───────────────────────────────────────
  if (src === 'yt_video') {
    const info = await playdl.video_info(query);
    const d    = info.video_details;
    return {
      type:   'track',
      tracks: [{
        title:     d.title || 'أغنية',
        url:       d.url,
        duration:  (d.durationInSec || 0) * 1000,
        thumbnail: d.thumbnails?.[0]?.url || null,
        author:    d.channel?.name || '',
        requester,
      }],
    };
  }

  // ── SoundCloud ───────────────────────────────────────────────
  if (src === 'soundcloud') {
    const info = await playdl.soundcloud(query);
    return {
      type:   'track',
      tracks: [{
        title:     info.name || 'أغنية',
        url:       info.url,
        duration:  (info.durationInSec || 0) * 1000,
        thumbnail: info.thumbnail || null,
        author:    info.publisher?.artist || '',
        requester,
      }],
    };
  }

  // ── بحث نصي (يوتيوب افتراضياً) ──────────────────────────────
  const track = await searchYouTube(query);
  return { type: 'track', tracks: [{ ...track, requester }] };
}

// ══════════════════════════════════════════════════════════════
//  GuildPlayer — إدارة الصوت لكل سيرفر
// ══════════════════════════════════════════════════════════════
class GuildPlayer {
  constructor(guildId, voiceChannel, textChannel) {
    this.guildId        = guildId;
    this.voiceChannel   = voiceChannel;
    this.textChannel    = textChannel;
    this.queue          = [];
    this.current        = null;
    this.volume         = 80;
    this.repeatMode     = 0;     // 0=off 1=track 2=queue
    this.paused         = false;
    this.destroyed      = false;
    this.currentMessage = null;
    this._startedAt     = 0;
    this._pausedAt      = 0;
    this._skipVotes     = new Set();
    this._previous      = [];

    this.player = createAudioPlayer();
    this._setupPlayer();

    this.connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf:       true,
    });
    this.connection.subscribe(this.player);
    this._setupConnection();
  }

  _setupConnection() {
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch { this.destroy(); }
    });
  }

  _setupPlayer() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (!this.destroyed) this._next();
    });
    this.player.on('error', err => {
      console.error(`❌ [Music] ${err.message}`);
      this.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c)
          .setDescription(`❌ خطأ في تشغيل **${this.current?.title || 'الأغنية'}**`)],
      }).catch(() => {});
      this._next();
    });
  }

  async _next() {
    if (this.repeatMode === 1 && this.current) {
      // تكرار نفس الأغنية
    } else {
      if (this.current) this._previous.push(this.current);
      if (this._previous.length > 10) this._previous.shift();
      if (this.repeatMode === 2 && this.current) this.queue.push(this.current);
      this.current = this.queue.shift() || null;
    }

    if (this.current) {
      await this._play(this.current);
    } else {
      this.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1)
          .setDescription('🏁 خلصت القائمة! في خير يا جدعان 👋')],
      }).catch(() => {});
      setTimeout(() => { if (!this.current) this.destroy(); }, 30_000);
    }
  }

  async _play(track) {
    try {
      this._skipVotes.clear();
      this._startedAt = Date.now();
      this._pausedAt  = 0;

      const stream   = await playdl.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType:    stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume / 100);
      this.player.play(resource);
      this.paused = false;

      this.currentMessage?.delete().catch(() => {});
      this.currentMessage = null;

      const song   = this._toSong(track);
      const qProxy = this._proxy();
      if (this.textChannel) await sendMusicCard(qProxy, song, this.textChannel);
    } catch (err) {
      console.error(`❌ [Music] _play: ${err.message}`);
      this.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c)
          .setDescription(`❌ مش قادر يشغّل: **${track.title}**`)],
      }).catch(() => {});
      this.current = this.queue.shift() || null;
      if (this.current) await this._play(this.current);
    }
  }

  _toSong(t) {
    return {
      name:              t.title,
      title:             t.title,
      thumbnail:         t.thumbnail || null,
      duration:          Math.floor((t.duration || 0) / 1000),
      formattedDuration: fmt(t.duration),
      uploader:          { name: t.author || '' },
      user:              t.requester || null,
      url:               t.url,
    };
  }

  _proxy() {
    const g = this;
    return {
      get songs()          { return g.current ? [g._toSong(g.current), ...g.queue.map(t => g._toSong(t))] : []; },
      get volume()         { return g.volume; },
      get repeatMode()     { return g.repeatMode; },
      get paused()         { return g.paused; },
      get destroyed()      { return g.destroyed; },
      get currentTime()    {
        if (g.paused) return Math.floor((g._pausedAt - g._startedAt) / 1000);
        return Math.floor((Date.now() - g._startedAt) / 1000);
      },
      get currentMessage()  { return g.currentMessage; },
      set currentMessage(v) { g.currentMessage = v; },
      get initiatorId()     { return g.current?.requester?.id; },
      set initiatorId(_v)   {},
      get textChannel()     { return g.textChannel; },
      get id()              { return g.guildId; },
    };
  }

  // ─── إضافة أغنية أو قائمة ─────────────────────────────────
  async add(track) {
    if (!this.current) {
      this.current = track;
      await this._play(track);
    } else {
      this.queue.push(track);
    }
  }

  async addMany(tracks) {
    if (!tracks.length) return;
    if (!this.current) {
      this.current = tracks[0];
      this.queue.push(...tracks.slice(1));
      await this._play(this.current);
    } else {
      this.queue.push(...tracks);
    }
  }

  // ─── تحميل Spotify في الخلفية ─────────────────────────────
  async loadSpotifyQueue(searchQueries, requester) {
    for (const q of searchQueries) {
      if (this.destroyed) break;
      try {
        const t = await searchYouTube(q);
        this.queue.push({ ...t, requester });
      } catch {}
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ─── أوامر التحكم ─────────────────────────────────────────
  skip()             { this.player.stop(true); }
  prevTrack()        { 
    const prev = this._previous.pop();
    if (!prev) throw new Error('مفيش أغنية سابقة!');
    if (this.current) this.queue.unshift(this.current);
    this.current = prev;
    this.player.stop(true);
  }
  pause()            { if (!this.paused) { this._pausedAt = Date.now(); this.player.pause(); this.paused = true; } }
  resume()           { if (this.paused) { if (this._pausedAt) this._startedAt += Date.now() - this._pausedAt; this.player.unpause(); this.paused = false; } }
  setVolume(v)       { this.volume = Math.max(0, Math.min(200, v)); this.player.state?.resource?.volume?.setVolume(this.volume / 100); }
  setRepeat(m)       { this.repeatMode = m; }
  shuffle()          { for (let i = this.queue.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [this.queue[i],this.queue[j]]=[this.queue[j],this.queue[i]]; } }
  jump(i)            { if (i < 1 || i > this.queue.length) throw new Error('رقم خارج النطاق!'); this.queue.splice(0, i-1); this.player.stop(true); }
  remove(i)          { if (i < 1 || i > this.queue.length) throw new Error('رقم خارج النطاق!'); return this.queue.splice(i-1, 1)[0]; }
  clearQueue()       { this.queue = []; }
  move(from, to)     {
    if (from < 1 || from > this.queue.length || to < 1 || to > this.queue.length) throw new Error('رقم خارج النطاق!');
    const [t] = this.queue.splice(from-1, 1);
    this.queue.splice(to-1, 0, t);
  }

  currentTime() {
    if (this.paused) return Math.floor((this._pausedAt - this._startedAt) / 1000);
    return Math.floor((Date.now() - this._startedAt) / 1000);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.queue     = [];
    this.current   = null;
    this.player.stop(true);
    this.currentMessage?.delete().catch(() => {});
    try { this.connection?.destroy(); } catch {}
    players.delete(this.guildId);
  }
}

// ─── دالة جلب أو إنشاء player ──────────────────────────────
function getPlayer(guildId) { return players.get(guildId) || null; }

function getOrCreate(guildId, voiceChannel, textChannel) {
  let p = players.get(guildId);
  if (!p) {
    p = new GuildPlayer(guildId, voiceChannel, textChannel);
    players.set(guildId, p);
  }
  p.textChannel = textChannel;
  return p;
}

// ══════════════════════════════════════════════════════════════
//  تسجيل الأوامر
// ══════════════════════════════════════════════════════════════
export function registerMusicCommands() {
  return [
    {
      data: new SlashCommandBuilder()
        .setName('شغل').setDescription('🎵 شغّل أغنية — يوتيوب أو Spotify أو بحث')
        .addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو الرابط').setRequired(true)),
      execute: handlePlay,
    },
    {
      data: new SlashCommandBuilder()
        .setName('بحث').setDescription('🔍 ابحث عن أغنية واختار من النتايج')
        .addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية').setRequired(true)),
      execute: handleSearch,
    },
    {
      data: new SlashCommandBuilder().setName('تخطي').setDescription('⏭️ تخطى للأغنية التالية'),
      execute: handleSkip,
    },
    {
      data: new SlashCommandBuilder().setName('سابق').setDescription('⏮️ رجّع للأغنية السابقة'),
      execute: handlePrevious,
    },
    {
      data: new SlashCommandBuilder().setName('وقف').setDescription('⏹️ وقّف الموسيقى واطلع من القناة'),
      execute: handleStop,
    },
    {
      data: new SlashCommandBuilder()
        .setName('قائمة').setDescription('📋 عرض قائمة التشغيل')
        .addIntegerOption(o => o.setName('صفحة').setDescription('رقم الصفحة').setMinValue(1)),
      execute: handleQueue,
    },
    {
      data: new SlashCommandBuilder().setName('بوز').setDescription('⏸️ إيقاف مؤقت'),
      execute: handlePause,
    },
    {
      data: new SlashCommandBuilder().setName('كمل').setDescription('▶️ استئناف التشغيل'),
      execute: handleResume,
    },
    {
      data: new SlashCommandBuilder().setName('شغال-ايه').setDescription('🎶 الأغنية الشغالة دلوقتي'),
      execute: handleNowPlaying,
    },
    {
      data: new SlashCommandBuilder()
        .setName('صوت').setDescription('🔊 اضبط مستوى الصوت (0-200)')
        .addIntegerOption(o => o.setName('مستوى').setDescription('من 0 لـ 200').setRequired(true).setMinValue(0).setMaxValue(200)),
      execute: handleVolume,
    },
    {
      data: new SlashCommandBuilder().setName('تكرار').setDescription('🔁 بدّل وضع التكرار'),
      execute: handleRepeat,
    },
    {
      data: new SlashCommandBuilder().setName('خلط').setDescription('🔀 خلط القائمة عشوائياً'),
      execute: handleShuffle,
    },
    {
      data: new SlashCommandBuilder()
        .setName('تخطى-لـ').setDescription('⏩ تخطى لأغنية معينة في القائمة')
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية').setRequired(true).setMinValue(1)),
      execute: handleJump,
    },
    {
      data: new SlashCommandBuilder()
        .setName('احذف').setDescription('🗑️ احذف أغنية من القائمة')
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية في القائمة').setRequired(true).setMinValue(1)),
      execute: handleRemove,
    },
    {
      data: new SlashCommandBuilder()
        .setName('نقل').setDescription('🔄 نقل أغنية من مكان لمكان في القائمة')
        .addIntegerOption(o => o.setName('من').setDescription('الرقم الحالي').setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName('لـ').setDescription('الرقم الجديد').setRequired(true).setMinValue(1)),
      execute: handleMove,
    },
    {
      data: new SlashCommandBuilder().setName('مسح-القائمة').setDescription('🗑️ مسح كل القائمة'),
      execute: handleClearQueue,
    },
    {
      data: new SlashCommandBuilder().setName('كلمات').setDescription('📝 كلمات الأغنية الشغالة دلوقتي'),
      execute: handleLyrics,
    },
    {
      data: new SlashCommandBuilder()
        .setName('تصويت-تخطي').setDescription('🗳️ صوّت لتخطي الأغنية الحالية'),
      execute: handleVoteSkip,
    },
  ];
}

// ─── Exports القديمة من index.js ──────────────────────────────
export async function initMusicSystem(_client) {
  console.log('✅ [Music] النظام جاهز — play-dl + @discordjs/voice + Spotify');
}

export const musicHandler = {
  getPlayer,
  getQueue(guildId) {
    const p = getPlayer(guildId);
    if (!p?.current) return null;
    return {
      currentSong: { title: p.current.title, artist: p.current.author, thumbnail: p.current.thumbnail },
      songs: p._proxy().songs,
      volume: p.volume,
    };
  },
  async joinVoiceChannelAndPlay(guildId, vc, tc) {
    return getOrCreate(guildId, vc, tc);
  },
  async resolveSource(query, _tag) {
    const r = await resolve(query, { username: _tag, id: '0' });
    return r.tracks;
  },
  async addToQueue(guildId, track) {
    const p = getPlayer(guildId);
    if (!p) throw new Error('البوت مش في قناة!');
    await p.add(track);
  },
  async skip(guildId)   { const p = getPlayer(guildId); if (!p?.current) throw new Error('مفيش أغنية!'); p.skip(); },
  async stop(guildId)   { getPlayer(guildId)?.destroy(); },
  async pause(guildId)  { const p = getPlayer(guildId); if (!p?.current) throw new Error('مفيش أغنية!'); p.pause(); },
  async resume(guildId) { const p = getPlayer(guildId); if (!p?.current) throw new Error('مفيش أغنية!'); p.resume(); },
  setVolume(guildId, fraction) {
    const p = getPlayer(guildId);
    if (!p) throw new Error('مفيش موسيقى!');
    p.setVolume(Math.round(fraction * 100));
  },
  getQueueDisplay(guildId, page = 1) {
    const p = getPlayer(guildId);
    if (!p?.current) return '❌ القائمة فاضية!';
    const all   = [p.current, ...p.queue];
    const start = (page - 1) * 10;
    return all.slice(start, start + 10).map((t, i) => {
      const idx = start + i;
      return `${idx === 0 ? '🔊 شغّال:' : `${idx}.`} ${t.title.slice(0,60)} [${fmt(t.duration)}]`;
    }).join('\n');
  },
};

export async function handleQueueJump(i) { i?.reply?.({ content: '⚠️ استخدم /تخطى-لـ', ephemeral: true }); }
export async function handleSeek(i)      { i?.reply?.({ content: '⚠️ الأمر ده مش متاح حالياً', ephemeral: true }); }
export async function handleFilter(i)    { i?.reply?.({ content: '⚠️ الفلاتر مش متاحة بدون Lavalink', ephemeral: true }); }

// ══════════════════════════════════════════════════════════════
//  معالجات الأوامر
// ══════════════════════════════════════════════════════════════

// ─── مساعد مشترك: تأكيد الصوت ────────────────────────────────
function requireVoice(interaction) {
  const vc = interaction.member?.voice?.channel;
  if (!vc) {
    interaction.reply({ content: '❌ لازم تكون في قناة صوتية الأول!', ephemeral: true });
    return null;
  }
  return vc;
}

// ─── /شغل ─────────────────────────────────────────────────────
export async function handlePlay(interaction) {
  const vc = requireVoice(interaction);
  if (!vc) return;

  const query = (interaction.options?.getString('اغنية') || '').trim();
  if (!query) return interaction.reply({ content: '❌ اكتب اسم الأغنية أو الرابط!', ephemeral: true });

  await interaction.deferReply();

  try {
    const result = await resolve(query, interaction.user);
    const p      = getOrCreate(interaction.guildId, vc, interaction.channel);

    if (result.type === 'track') {
      const track    = result.tracks[0];
      const wasEmpty = !p.current;
      await p.add(track);
      if (!wasEmpty) {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x66FCF1)
            .setDescription(`✅ أُضيفت للقائمة: **${track.title}** \`${fmt(track.duration)}\``)],
        });
      } else {
        await interaction.editReply({ content: '▶️ جاري التشغيل...' }).catch(() => {});
      }
    } else {
      // Playlist
      const tracks = result.tracks;
      const total  = tracks.length + (result.spotifyQueue?.length || 0);
      await p.addMany(tracks);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x1DB954)
          .setDescription([
            `📋 **${result.name}**`,
            `🎵 **${total}** أغنية — بيتحمّل في الخلفية...`,
          ].join('\n'))],
      });
      // باقي Spotify في الخلفية
      if (result.spotifyQueue?.length) {
        p.loadSpotifyQueue(result.spotifyQueue, interaction.user).catch(() => {});
      }
    }
  } catch (e) {
    await interaction.editReply({ content: `❌ ${e.message}` });
  }
}

// ─── /بحث ─────────────────────────────────────────────────────
export async function handleSearch(interaction) {
  const vc = requireVoice(interaction);
  if (!vc) return;

  const query = (interaction.options?.getString('اغنية') || '').trim();
  if (!query) return interaction.reply({ content: '❌ اكتب اسم الأغنية!', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  try {
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });
    if (!results.length) return interaction.editReply({ content: '❌ مش لاقي نتايج!' });

    const lines = results.map((v, i) =>
      `**${i+1}.** [${v.title?.slice(0,50)}](${v.url}) \`${fmt((v.durationInSec||0)*1000)}\``
    );

    const rows = [new ActionRowBuilder().addComponents(
      ...results.slice(0,5).map((_v, i) =>
        new ButtonBuilder()
          .setCustomId(`msearch_${interaction.id}_${i}`)
          .setLabel(`${i+1}`)
          .setStyle(ButtonStyle.Primary)
      ),
      new ButtonBuilder()
        .setCustomId(`msearch_${interaction.id}_cancel`)
        .setLabel('إلغاء')
        .setStyle(ButtonStyle.Danger)
    )];

    // حفظ النتايج مؤقتاً
    searchSessions.set(interaction.id, { results, vc, guildId: interaction.guildId, channel: interaction.channel, user: interaction.user });
    setTimeout(() => searchSessions.delete(interaction.id), 60_000);

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1)
        .setTitle('🔍 نتايج البحث')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'اختار رقم الأغنية اللي عايزها' })],
      components: rows,
    });
  } catch (e) {
    await interaction.editReply({ content: `❌ ${e.message}` });
  }
}

// جلسات بحث مؤقتة
const searchSessions = new Map();

export async function handleSearchButton(interaction) {
  const parts = interaction.customId.split('_');
  const sessId = parts[1];
  const pick   = parts[2];
  const sess   = searchSessions.get(sessId);
  if (!sess) return interaction.update({ content: '❌ انتهت الجلسة — جرّب تبحث تاني', components: [], embeds: [] });

  if (pick === 'cancel') {
    searchSessions.delete(sessId);
    return interaction.update({ content: '❌ تم الإلغاء', components: [], embeds: [] });
  }

  const v = sess.results[parseInt(pick)];
  if (!v) return interaction.update({ content: '❌ اختيار غلط!', components: [], embeds: [] });

  searchSessions.delete(sessId);

  const track = {
    title:     v.title || 'أغنية',
    url:       v.url,
    duration:  (v.durationInSec || 0) * 1000,
    thumbnail: v.thumbnails?.[0]?.url || null,
    author:    v.channel?.name || '',
    requester: sess.user,
  };

  const p       = getOrCreate(sess.guildId, sess.vc, sess.channel);
  const wasEmpty = !p.current;
  await p.add(track);

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0x66FCF1)
      .setDescription(wasEmpty
        ? `▶️ جاري تشغيل: **${track.title}**`
        : `✅ أُضيفت: **${track.title}** \`${fmt(track.duration)}\``
      )],
    components: [],
  });
}

// ─── /تخطي ────────────────────────────────────────────────────
export async function handleSkip(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
  const title = p.current.title;
  p.skip();
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏭️ تخطّينا: **${title}**`)],
  });
}

// ─── /سابق ────────────────────────────────────────────────────
export async function handlePrevious(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
  try {
    p.prevTrack();
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏮️ رجّعنا للأغنية السابقة!`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
  }
}

// ─── /وقف ─────────────────────────────────────────────────────
export async function handleStop(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
  p.destroy();
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('⏹️ وقّفنا وخرجنا من القناة!')],
  });
}

// ─── /قائمة ───────────────────────────────────────────────────
export async function handleQueue(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });

  const page    = interaction.options?.getInteger('صفحة') || 1;
  const perPage = 10;
  const all     = [p.current, ...p.queue];
  const total   = all.length;
  const pages   = Math.ceil(total / perPage);
  const start   = (page - 1) * perPage;
  const slice   = all.slice(start, start + perPage);

  const lines = slice.map((t, i) => {
    const idx = start + i;
    return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${t.title.slice(0,55)} \`${fmt(t.duration)}\``;
  });

  const modes = ['❌ إيقاف', '🔂 أغنية', '🔁 قائمة'];
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x66FCF1)
      .setTitle(`📋 قائمة التشغيل — ${total} أغنية`)
      .setDescription(lines.join('\n'))
      .addFields(
        { name: '🔊 الصوت',   value: `${p.volume}%`,          inline: true },
        { name: '🔁 التكرار', value: modes[p.repeatMode],      inline: true },
        { name: '🎵 الانتظار',value: `${p.queue.length} أغنية`, inline: true },
      )
      .setFooter({ text: `صفحة ${page}/${pages}` })],
  });
}

// ─── /بوز ─────────────────────────────────────────────────────
export async function handlePause(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });
  if (p.paused)    return interaction.reply({ content: '❌ واقفة أصلاً!', ephemeral: true });
  p.pause();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⏸️ إيقاف مؤقت!')] });
}

// ─── /كمل ─────────────────────────────────────────────────────
export async function handleResume(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });
  if (!p.paused)   return interaction.reply({ content: '❌ شغالة أصلاً!', ephemeral: true });
  p.resume();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('▶️ استُؤنف التشغيل!')] });
}

// ─── /شغال-ايه ────────────────────────────────────────────────
export async function handleNowPlaying(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });

  const t      = p.current;
  const cur    = p.currentTime();
  const total  = Math.floor((t.duration || 0) / 1000);
  const barLen = 20;
  const filled = total > 0 ? Math.round((cur / total) * barLen) : 0;
  const bar    = '▬'.repeat(Math.max(0,filled)) + '🔘' + '▬'.repeat(Math.max(0, barLen - filled));

  const modes  = ['❌', '🔂', '🔁'];
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x66FCF1)
      .setAuthor({ name: '🎵 شغّال دلوقتي' })
      .setTitle(t.title.slice(0,256))
      .setURL(t.url)
      .setThumbnail(t.thumbnail || null)
      .setDescription(`${bar}\n\`${fmt(cur*1000)} / ${fmt(t.duration)}\``)
      .addFields(
        { name: '🎤 الفنان',  value: t.author || 'مجهول',            inline: true },
        { name: '👑 طلبها',   value: t.requester?.username || 'مجهول', inline: true },
        { name: '🔊 الصوت',   value: `${p.volume}%`,                  inline: true },
        { name: '🔁 التكرار', value: modes[p.repeatMode],              inline: true },
        { name: '🎵 الانتظار',value: `${p.queue.length} أغنية`,         inline: true },
      )],
  });
}

// ─── /صوت ─────────────────────────────────────────────────────
export async function handleVolume(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
  const v = interaction.options.getInteger('مستوى');
  p.setVolume(v);
  const icon = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`${icon} الصوت: **${v}%**`)] });
}

// ─── /تكرار ───────────────────────────────────────────────────
export async function handleRepeat(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
  const next   = (p.repeatMode + 1) % 3;
  const labels = ['❌ التكرار إيقاف', '🔂 تكرار الأغنية', '🔁 تكرار القائمة'];
  p.setRepeat(next);
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(labels[next])] });
}

// ─── /خلط ─────────────────────────────────────────────────────
export async function handleShuffle(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p || p.queue.length < 2) return interaction.reply({ content: '❌ مفيش أغاني كفاية!', ephemeral: true });
  p.shuffle();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🔀 تم خلط **${p.queue.length}** أغنية!`)] });
}

// ─── /تخطى-لـ ─────────────────────────────────────────────────
export async function handleJump(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });
  const n = interaction.options.getInteger('رقم');
  try {
    p.jump(n);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏩ بيتخطى للأغنية رقم **${n}**!`)] });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
  }
}

// ─── /احذف ────────────────────────────────────────────────────
export async function handleRemove(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p || !p.queue.length) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });
  const n = interaction.options.getInteger('رقم');
  try {
    const removed = p.remove(n);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🗑️ اتحذفت: **${removed?.title || 'الأغنية'}**`)] });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
  }
}

// ─── /نقل ─────────────────────────────────────────────────────
export async function handleMove(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p || !p.queue.length) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });
  const from = interaction.options.getInteger('من');
  const to   = interaction.options.getInteger('لـ');
  try {
    const title = p.queue[from-1]?.title || 'الأغنية';
    p.move(from, to);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🔄 **${title}** اتنقلت من **${from}** لـ **${to}**`)] });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
  }
}

// ─── /مسح-القائمة ─────────────────────────────────────────────
export async function handleClearQueue(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
  const count = p.queue.length;
  p.clearQueue();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🗑️ تم مسح **${count}** أغنية من القائمة!`)] });
}

// ─── /كلمات ───────────────────────────────────────────────────
export async function handleLyrics(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x66FCF1)
      .setDescription(`📝 **${p.current.title}**\n*(ميزة الكلمات هتتضاف قريباً)*`)],
  });
}

// ─── /تصويت-تخطي ──────────────────────────────────────────────
export async function handleVoteSkip(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });

  const vc      = interaction.member?.voice?.channel;
  const members = vc ? vc.members.filter(m => !m.user.bot).size : 1;
  const needed  = Math.max(1, Math.ceil(members / 2));

  p._skipVotes.add(interaction.user.id);
  const votes = p._skipVotes.size;

  if (votes >= needed) {
    const title = p.current.title;
    p.skip();
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71)
        .setDescription(`✅ التصويت نجح (${votes}/${needed}) — تخطّينا **${title}**!`)],
    });
  } else {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1)
        .setDescription(`🗳️ صوّت للتخطي: **${votes}/${needed}** صوت`)],
    });
  }
}
