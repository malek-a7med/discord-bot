// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي
//  محرك: Lavalink + Lavaplayer (نفس محرك JMusicBot تماماً)
//  المصادر: YouTube, SoundCloud, Bandcamp, Vimeo, Twitch,
//           HTTP مباشر, Spotify (عبر بحث), Apple Music, Deezer
// ════════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { sendMusicCard } from '../helpers/music-card.js';

// ─── متغيرات عامة ─────────────────────────────────────────────
let lavalink = null;
const skipVotes      = new Map(); // guildId → Set<userId>
const previousTracks = new Map(); // guildId → Track

// ─── تنسيق الوقت ──────────────────────────────────────────────
function fmtMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}

// ─── تحويل Track إلى song-object متوافق مع music-card.js ─────
function songFromTrack(track) {
  if (!track) return null;
  return {
    name:              track.info.title,
    title:             track.info.title,
    thumbnail:         track.info.artworkUrl || null,
    duration:          Math.floor((track.info.duration || 0) / 1000),
    formattedDuration: fmtMs(track.info.duration),
    uploader:          { name: track.info.author || '' },
    user:              track.requester || null,
    url:               track.info.uri,
    sourceName:        track.info.sourceName,
  };
}

// ─── Proxy يحوّل Player إلى queue-object متوافق مع music-card ─
function queueProxy(player) {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'songs') {
        const cur = player.queue?.current;
        if (!cur) return [];
        return [songFromTrack(cur), ...(player.queue?.tracks || []).map(songFromTrack)];
      }
      if (prop === 'volume')      return player.volume ?? 100;
      if (prop === 'repeatMode')  return player.repeatMode === 'off' ? 0 : player.repeatMode === 'track' ? 1 : 2;
      if (prop === 'paused')      return player.paused;
      if (prop === 'destroyed')   return !player.connected;
      if (prop === 'currentTime') return Math.floor((player.position || 0) / 1000);
      if (prop === 'currentMessage') return player._currentMessage;
      if (prop === 'textChannel') return player._textChannel;
      if (prop === 'id')          return player.guildId;
      return undefined;
    },
    set(_, prop, value) {
      if (prop === 'currentMessage') player._currentMessage = value;
      if (prop === 'initiatorId')    player._initiatorId   = value;
      if (prop === 'textChannel')    player._textChannel   = value;
      return true;
    },
  });
}

// ─── كشف نوع المصدر ───────────────────────────────────────────
function detectSource(q) {
  if (/^spotify:(track|playlist|album|artist):/i.test(q)) {
    const k = q.split(':')[1];
    return k === 'track' ? 'spotify_track' : k === 'artist' ? 'spotify_artist' : 'spotify_collection';
  }
  if (/spotify\.link\//i.test(q))                        return 'spotify_short';
  if (/open\.spotify\.com\/(playlist|album)/i.test(q))   return 'spotify_collection';
  if (/open\.spotify\.com\/artist/i.test(q))              return 'spotify_artist';
  if (/open\.spotify\.com/i.test(q))                      return 'spotify_track';
  if (/music\.apple\.com/i.test(q))                       return 'apple_music';
  if (/deezer\.com\/(track|album|playlist|artist)/i.test(q)) return 'deezer';
  return 'url_or_search'; // Lavalink بيتعامل مع الباقي مباشرة
}

// ─── جيب اسم الأغنية من Apple Music ─────────────────────────
async function fetchAppleName(url) {
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    const og   = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (og?.[1]) return og[1].replace(/ on Apple Music$/i, '').trim();
    const t = html.match(/<title>([^<]+)<\/title>/i);
    if (t?.[1]) return t[1].replace(/ - Apple Music$/i, '').trim();
  } catch {}
  return null;
}

// ─── جيب اسم الأغنية من Deezer (API مفتوح بدون key) ─────────
async function fetchDeezerName(url) {
  try {
    const m = url.match(/deezer\.com\/(track|album|playlist|artist)\/(\d+)/i);
    if (!m) return null;
    const res  = await fetch(`https://api.deezer.com/${m[1]}/${m[2]}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (m[1] === 'track')    return `${data.artist?.name || ''} ${data.title || ''}`.trim();
    if (m[1] === 'artist')   return data.name;
    return `${data.artist?.name || ''} ${data.title || ''}`.trim();
  } catch {}
  return null;
}

// ─── جيب بيانات Spotify (spotify-url-info) ────────────────────
async function fetchSpotify(query) {
  let url = query;
  if (/^spotify:/i.test(query)) {
    const parts = query.split(':');
    url = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
  }
  const { default: sui } = await import('spotify-url-info');
  const { getDetails }   = sui(fetch);
  const details = await getDetails(url);
  const { preview, tracks: raw } = details || {};

  const tracks = [];
  if (raw) {
    for (const t of (Array.isArray(raw) ? raw : [raw])) {
      const name = t.name || t.title || '';
      const artist = t.artists?.[0]?.name || t.artist || '';
      if (name) tracks.push(artist ? `${artist} ${name}` : name);
    }
  }
  if (!tracks.length && preview) {
    const name = preview.name || preview.title || '';
    const artist = preview.artists?.[0]?.name || preview.artist || '';
    if (name) tracks.push(artist ? `${artist} ${name}` : name);
  }
  if (!tracks.length) throw new Error('مش قادر أجيب الأغاني من Spotify — تأكد إن البلاي ليست عامة (Public)');

  const type = url.includes('/playlist') ? 'playlist'
             : url.includes('/album') ? 'album'
             : url.includes('/artist') ? 'artist'
             : 'track';
  return { tracks, type, name: details?.name || details?.title || tracks[0] };
}

// ─── بحث في Lavalink مع fallback ──────────────────────────────
async function lvSearch(query, requester) {
  if (!lavalink) throw new Error('نظام الموسيقى مش متصل بـ Lavalink');

  const isUrl = /^https?:\/\//i.test(query);

  // لو رابط — جرّبه مباشرة
  if (isUrl) {
    const res = await lavalink.search({ query }, requester);
    if (res?.loadType !== 'empty' && res?.loadType !== 'error' && res?.tracks?.length) return res;
  }

  // بحث يوتيوب
  const ytRes = await lavalink.search({ query, source: 'ytsearch' }, requester);
  if (ytRes?.tracks?.length) return ytRes;

  // fallback: SoundCloud
  const scRes = await lavalink.search({ query, source: 'scsearch' }, requester);
  if (scRes?.tracks?.length) return scRes;

  throw new Error(`مش لاقي "${query.slice(0, 60)}" — جرّب اسم تاني أو رابط مباشر`);
}

// ─── جيب أو أنشئ Player ───────────────────────────────────────
async function getOrCreatePlayer(guildId, voiceChannel, textChannel) {
  let player = lavalink.getPlayer(guildId);
  if (!player) {
    player = await lavalink.createPlayer({
      guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId:  textChannel.id,
      selfDeaf:       true,
      volume:         100,
    });
  }
  player._textChannel = textChannel;
  if (!player.connected) await player.connect();
  return player;
}

// ─── تهيئة Lavalink — تُستدعى من index.js بعد client.login() ─
export async function initMusicSystem(client) {
  const host     = process.env.LAVALINK_HOST;
  const port     = parseInt(process.env.LAVALINK_PORT || '2333');
  const password = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
  const secure   = process.env.LAVALINK_SECURE === 'true';

  if (!host) {
    console.warn('⚠️ [Music] LAVALINK_HOST مش محدد — نظام الموسيقى معطّل');
    return;
  }

  lavalink = new LavalinkManager({
    nodes: [{
      authorization: password,
      host,
      port,
      id:     'zangi-node',
      secure,
    }],
    sendToShard: (guildId, payload) => {
      client.guilds.cache.get(guildId)?.shard?.send(payload);
    },
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue:  { destroyAfterMs: 30_000 },
    },
  });

  // إعادة توجيه أحداث الصوت إلى Lavalink (ضروري جداً)
  client.on('raw', d => lavalink.sendRawData(d));

  // ── حدث: بدء أغنية جديدة ──────────────────────────────────
  lavalink.on('trackStart', async (player, track) => {
    try {
      const prev = player.queue.previous?.[0];
      if (prev) previousTracks.set(player.guildId, prev);
      skipVotes.delete(player.guildId);

      if (player._currentMessage) {
        await player._currentMessage.delete().catch(() => {});
        player._currentMessage = null;
      }

      const song   = songFromTrack(track);
      const qProxy = queueProxy(player);
      if (player._textChannel) await sendMusicCard(qProxy, song, player._textChannel);
    } catch (e) {
      console.error('❌ [Music] trackStart:', e.message);
    }
  });

  // ── حدث: إضافة أغنية للقائمة ──────────────────────────────
  lavalink.on('trackAdd', (player, tracks) => {
    try {
      if (player._batchLoading) return;
      const arr  = Array.isArray(tracks) ? tracks : [tracks];
      const song = arr[0];
      if (!song) return;
      const dur  = fmtMs(song.info.duration);
      player._textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1)
          .setDescription(`✅ أُضيفت للقائمة: **${song.info.title}** \`${dur}\``)],
      }).catch(() => {});
    } catch {}
  });

  // ── حدث: انتهاء القائمة ───────────────────────────────────
  lavalink.on('queueEnd', (player) => {
    try {
      skipVotes.delete(player.guildId);
      player._textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1)
          .setDescription('🏁 خلصت القائمة! في خير يا جدعان 👋')],
      }).catch(() => {});
    } catch {}
  });

  // ── حدث: خطأ في الأغنية ───────────────────────────────────
  lavalink.on('trackError', (player, track, err) => {
    const msg = err?.exception?.message || 'خطأ غير معروف';
    console.error(`❌ [Lavalink] trackError: ${msg}`);
    player._textChannel?.send({
      embeds: [new EmbedBuilder().setColor(0xe74c3c)
        .setDescription(`❌ خطأ في تشغيل **${track?.info?.title || 'الأغنية'}**: ${msg.slice(0, 200)}`)],
    }).catch(() => {});
  });

  // ── حدث: اتصال/انقطاع ─────────────────────────────────────
  lavalink.on('playerDestroy', (player) => {
    skipVotes.delete(player.guildId);
  });

  // ── تهيئة بعد جاهزية الكلاينت ──────────────────────────────
  const doInit = async () => {
    try {
      await lavalink.init({ id: client.user.id, username: client.user.username });
      console.log('✅ [Music] Lavalink متصل!');
    } catch (e) {
      console.error('❌ [Music] Lavalink فشل في الاتصال:', e.message);
    }
  };

  if (client.isReady()) await doInit();
  else client.once('ready', doInit);
}

// ─── musicHandler — للاستخدام من index.js (أوامر النص) ────────
export const musicHandler = {
  getPlayer(guildId) { return lavalink?.getPlayer(guildId) || null; },

  getQueue(guildId) {
    const p = lavalink?.getPlayer(guildId);
    if (!p?.queue?.current) return null;
    const cur = songFromTrack(p.queue.current);
    return {
      currentSong: { title: cur.name, artist: cur.uploader?.name, thumbnail: cur.thumbnail },
      songs: [cur, ...(p.queue.tracks || []).map(songFromTrack)],
      volume: p.volume,
    };
  },

  async joinVoiceChannelAndPlay(guildId, voiceChannel, textChannel) {
    if (!lavalink) throw new Error('Lavalink مش متصل');
    await getOrCreatePlayer(guildId, voiceChannel, textChannel);
  },

  async resolveSource(query, requesterTag) {
    const res = await lvSearch(query, { tag: requesterTag, id: '0' });
    if (res.loadType === 'playlist') return res.tracks;
    return [res.tracks[0]];
  },

  async addToQueue(guildId, track) {
    const p = lavalink?.getPlayer(guildId);
    if (!p) throw new Error('مفيش قناة صوتية');
    await p.queue.add(track);
    if (!p.playing && !p.paused) await p.play({ paused: false });
  },

  async skip(guildId) {
    const p = lavalink?.getPlayer(guildId);
    if (!p?.queue?.current) throw new Error('مفيش أغنية');
    await p.skip();
  },

  async stop(guildId) {
    const p = lavalink?.getPlayer(guildId);
    if (!p) throw new Error('مفيش موسيقى');
    if (p._currentMessage) { await p._currentMessage.delete().catch(() => {}); p._currentMessage = null; }
    await p.stopPlaying(true, false);
    await p.destroy();
  },

  async pause(guildId) {
    const p = lavalink?.getPlayer(guildId);
    if (!p?.queue?.current) throw new Error('مفيش أغنية');
    await p.pause(true);
  },

  async resume(guildId) {
    const p = lavalink?.getPlayer(guildId);
    if (!p) throw new Error('مفيش موسيقى');
    await p.pause(false);
  },

  setVolume(guildId, fraction) {
    const p = lavalink?.getPlayer(guildId);
    if (!p) throw new Error('مفيش موسيقى');
    p.setVolume(Math.round(fraction * 100));
  },

  getQueueDisplay(guildId, page = 1) {
    const p = lavalink?.getPlayer(guildId);
    if (!p?.queue?.current) return 'القائمة فارضية!';
    const cur   = p.queue.current;
    const songs = p.queue.tracks || [];
    const perPage = 10;
    const start = (page - 1) * perPage;
    const lines = [`▶️ ${cur.info.title} [${fmtMs(cur.info.duration)}]`, ''];
    songs.slice(start, start + perPage).forEach((t, i) => {
      lines.push(`${start + i + 1}. ${t.info.title} [${fmtMs(t.info.duration)}]`);
    });
    return lines.join('\n');
  },
};

// ─── تسجيل الأوامر ────────────────────────────────────────────
export function registerMusicCommands() {
  return [
    {
      data: new SlashCommandBuilder()
        .setName('شغل').setDescription('🎵 شغّل أغنية أو رابط')
        .addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو الرابط').setRequired(true)),
      execute: handlePlay,
    },
    {
      data: new SlashCommandBuilder().setName('تخطي').setDescription('⏭️ تخطى للأغنية التالية'),
      execute: handleSkip,
    },
    {
      data: new SlashCommandBuilder().setName('وقف').setDescription('⏹️ وقّف الموسيقى واطلع من القناة'),
      execute: handleStop,
    },
    {
      data: new SlashCommandBuilder()
        .setName('قائمة').setDescription('📋 عرض قائمة التشغيل')
        .addIntegerOption(o => o.setName('صفحة').setDescription('رقم الصفحة').setRequired(false).setMinValue(1)),
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
      data: new SlashCommandBuilder().setName('شغال-ايه').setDescription('🎶 اعرض الأغنية الشغالة دلوقتي'),
      execute: handleNowPlaying,
    },
    {
      data: new SlashCommandBuilder()
        .setName('صوت').setDescription('🔊 اضبط مستوى الصوت')
        .addIntegerOption(o => o.setName('مستوى').setDescription('من 0 لـ 100').setRequired(true).setMinValue(0).setMaxValue(100)),
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
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية (مش الشغالة)').setRequired(true).setMinValue(2)),
      execute: handleRemove,
    },
    {
      data: new SlashCommandBuilder().setName('كلمات').setDescription('📝 اعرض كلمات الأغنية الشغالة'),
      execute: handleLyrics,
    },
    {
      data: new SlashCommandBuilder()
        .setName('انتقل').setDescription('⏱️ انتقل لوقت معين في الأغنية')
        .addStringOption(o => o.setName('وقت').setDescription('مثال: 1:30 أو 90 (ثانية)').setRequired(true)),
      execute: handleSeek,
    },
    {
      data: new SlashCommandBuilder()
        .setName('فلتر').setDescription('🎛️ تطبيق فلتر صوتي')
        .addStringOption(o =>
          o.setName('نوع').setDescription('نوع الفلتر').setRequired(true)
           .addChoices(
             { name: '❌ إيقاف الفلاتر',  value: 'off'       },
             { name: '🔊 باس بوست',        value: 'bassboost' },
             { name: '🌙 نايتكور',         value: 'nightcore' },
             { name: '🎧 8D صوت محيطي',    value: '8d'        },
             { name: '🌊 فيبورويف',        value: 'vaporwave' },
             { name: '🎤 كاريوكي',         value: 'karaoke'   },
           )
        ),
      execute: handleFilter,
    },
    {
      data: new SlashCommandBuilder()
        .setName('تصويت-تخطي').setDescription('🗳️ صوّت لتخطي الأغنية الحالية'),
      execute: handleVoteSkip,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
//  معالجات الأوامر
// ═══════════════════════════════════════════════════════════════

// ─── /شغل ─────────────────────────────────────────────────────
export async function handlePlay(interaction) {
  try {
    if (!lavalink)
      return interaction.reply({ content: '❌ Lavalink مش متصل — تأكد من إعداد LAVALINK_HOST في السيكريتس', ephemeral: true });

    const query      = (interaction.options?.getString('اغنية') || '').trim();
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) return interaction.reply({ content: '❌ لازم تكون في قناة صوتية الأول!', ephemeral: true });
    if (!query)        return interaction.reply({ content: '❌ اكتب اسم الأغنية أو رابطها!', ephemeral: true });

    await interaction.deferReply();

    const source = detectSource(query);
    const player = await getOrCreatePlayer(interaction.guildId, voiceChannel, interaction.channel);

    // ── Spotify ─────────────────────────────────────────────
    if (source.startsWith('spotify')) {
      const icons = { spotify_track: '🎵', spotify_collection: '📋', spotify_artist: '🎤', spotify_short: '🔗' };
      await interaction.editReply({ content: `${icons[source] || '🎵'} جاري جلب المحتوى من Spotify...` });

      let sp;
      try { sp = await fetchSpotify(query); }
      catch (e) { return interaction.editReply({ content: `❌ ${e.message}` }); }

      const desc = sp.tracks.length === 1
        ? `🎵 جاري تشغيل: **${sp.tracks[0]}**`
        : `📋 جاري تشغيل **${sp.name}** — **${sp.tracks.length} أغنية** (Spotify)`;
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x1DB954).setDescription(desc)] });

      // شغّل الأولى فوراً
      const first = await lvSearch(sp.tracks[0], interaction.user);
      if (!first.tracks.length) return interaction.editReply({ content: '❌ مش لاقي الأغنية الأولى!' });
      first.tracks[0].requester = interaction.user;
      await player.queue.add(first.tracks[0]);
      if (!player.playing && !player.paused) await player.play({ paused: false });

      // باقي الأغاني في الخلفية
      ;(async () => {
        player._batchLoading = true;
        for (let i = 1; i < sp.tracks.length; i++) {
          try {
            const r = await lvSearch(sp.tracks[i], interaction.user);
            if (r.tracks[0]) { r.tracks[0].requester = interaction.user; await player.queue.add(r.tracks[0]); }
          } catch {}
          await new Promise(r => setTimeout(r, 300));
        }
        player._batchLoading = false;
        player._textChannel?.send({
          embeds: [new EmbedBuilder().setColor(0x1DB954)
            .setDescription(`✅ أُضيفت **${sp.tracks.length} أغنية** من Spotify للقائمة 🎵`)],
        }).catch(() => {});
      })();
      return;
    }

    // ── Apple Music ─────────────────────────────────────────
    if (source === 'apple_music') {
      await interaction.editReply({ content: '🍎 جاري جلب المعلومات من Apple Music...' });
      const name = await fetchAppleName(query);
      if (!name) return interaction.editReply({ content: '❌ مش قادر أجيب معلومات من Apple Music — جرّب الاسم مباشرة' });
      await interaction.editReply({ content: `🔍 لاقيت: **${name}** — جاري البحث...` });
      const res = await lvSearch(name, interaction.user);
      res.tracks[0].requester = interaction.user;
      await player.queue.add(res.tracks[0]);
      if (!player.playing && !player.paused) await player.play({ paused: false });
      await interaction.editReply({ content: `✅ شغّال: **${res.tracks[0].info.title}** 🍎` }).catch(() => {});
      return;
    }

    // ── Deezer ──────────────────────────────────────────────
    if (source === 'deezer') {
      await interaction.editReply({ content: '🎶 جاري جلب المعلومات من Deezer...' });
      const name = await fetchDeezerName(query);
      if (!name) return interaction.editReply({ content: '❌ مش قادر أجيب معلومات من Deezer — جرّب الاسم مباشرة' });
      const res = await lvSearch(name, interaction.user);
      res.tracks[0].requester = interaction.user;
      await player.queue.add(res.tracks[0]);
      if (!player.playing && !player.paused) await player.play({ paused: false });
      await interaction.editReply({ content: `✅ شغّال: **${res.tracks[0].info.title}** 🎶` }).catch(() => {});
      return;
    }

    // ── يوتيوب / ساوند كلاود / رابط مباشر / بحث نصي ───────
    await interaction.editReply({ content: /^https?:\/\//i.test(query) ? '🔗 جاري التحميل...' : '🔍 جاري البحث...' });

    const res = await lvSearch(query, interaction.user);
    if (!res.tracks.length) return interaction.editReply({ content: '❌ مش لاقي حاجة!' });

    if (res.loadType === 'playlist') {
      res.tracks.forEach(t => { t.requester = interaction.user; });
      await player.queue.add(res.tracks);
      if (!player.playing && !player.paused) await player.play({ paused: false });
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x66FCF1)
          .setDescription(`📋 أُضيفت بلاي ليست **${res.playlist?.name || 'بلاي ليست'}** — ${res.tracks.length} أغنية`)],
      }).catch(() => {});
    } else {
      res.tracks[0].requester = interaction.user;
      await player.queue.add(res.tracks[0]);
      if (!player.playing && !player.paused) await player.play({ paused: false });
      await interaction.editReply({ content: '✅ تم!' }).catch(() => {});
    }

  } catch (e) {
    console.error('❌ [Music] handlePlay:', e.message);
    const msg = /LAVALINK|connect/i.test(e.message)
      ? '❌ Lavalink مش متصل — تأكد إن الـ service شغّال على Railway'
      : `❌ حصل خطأ: \`${e.message.slice(0, 300)}\``;
    try { await interaction.editReply({ content: msg }); }
    catch { await interaction.reply({ content: msg, ephemeral: true }).catch(() => {}); }
  }
}

// ─── /تخطي ─────────────────────────────────────────────────────
export async function handleSkip(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
    const title = p.queue.current.info.title;
    await p.skip();
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏭️ تم تخطي: **${title}**`)] });
  } catch (e) {
    interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── /تصويت-تخطي ───────────────────────────────────────────────
export async function handleVoteSkip(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });

    const vc      = interaction.member?.voice?.channel;
    if (!vc) return interaction.reply({ content: '❌ لازم تكون في القناة الصوتية!', ephemeral: true });

    const humans  = vc.members.filter(m => !m.user.bot).size;
    const needed  = Math.ceil(humans * 0.6);
    const votes   = skipVotes.get(interaction.guildId) || new Set();
    votes.add(interaction.user.id);
    skipVotes.set(interaction.guildId, votes);

    if (votes.size >= needed) {
      const title = p.queue.current.info.title;
      await p.skip();
      skipVotes.delete(interaction.guildId);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ التصويت نجح! تم تخطي: **${title}**`)] });
    }

    interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12)
      .setDescription(`🗳️ صوّتت للتخطي — **${votes.size}/${needed}** صوت مطلوب`)] });
  } catch (e) {
    interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── /وقف ──────────────────────────────────────────────────────
export async function handleStop(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    if (p._currentMessage) { await p._currentMessage.delete().catch(() => {}); p._currentMessage = null; }
    skipVotes.delete(interaction.guildId);
    await p.stopPlaying(true, false);
    await p.destroy();
    interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('⏹️ وقّفت الموسيقى وخرجت من القناة!')] });
  } catch (e) {
    interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── /قائمة ────────────────────────────────────────────────────
export async function handleQueue(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ القائمة فارغة!', ephemeral: true });

    const isBtn  = interaction.isButton?.();
    const pageFromId = isBtn ? parseInt(interaction.customId.replace('music_queue_page_', '')) : null;
    const page   = pageFromId || interaction.options?.getInteger('صفحة') || 1;

    const tracks  = p.queue.tracks || [];
    const perPage = 10;
    const totalP  = Math.max(1, Math.ceil((tracks.length + 1) / perPage));
    const curP    = Math.min(Math.max(page, 1), totalP);
    const start   = (curP - 1) * perPage;

    const cur  = p.queue.current;
    const embed = new EmbedBuilder().setColor(0x66FCF1)
      .setTitle(`📋 قائمة التشغيل — صفحة ${curP}/${totalP}`)
      .setDescription([
        `▶️ **الشغّالة دلوقتي:** ${cur.info.title} \`${fmtMs(cur.info.duration)}\``,
        '',
        tracks.length === 0 ? '_القائمة فاضية_' :
          tracks.slice(start, start + perPage)
                .map((t, i) => `\`${start + i + 1}.\` ${t.info.title} \`${fmtMs(t.info.duration)}\``)
                .join('\n'),
      ].join('\n'))
      .setFooter({ text: `${tracks.length} أغنية في القائمة` });

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_queue_page_${curP - 1}`).setLabel('◀️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(curP <= 1),
      new ButtonBuilder().setCustomId(`music_queue_page_${curP + 1}`).setLabel('التالي ▶️').setStyle(ButtonStyle.Secondary).setDisabled(curP >= totalP),
    );

    if (isBtn) await interaction.update({ embeds: [embed], components: [navRow] });
    else       await interaction.reply({ embeds: [embed], components: [navRow] });
  } catch (e) {
    interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── /بوز ──────────────────────────────────────────────────────
export async function handlePause(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });
    if (p.paused) return interaction.reply({ content: '⏸️ الأغنية موقوفة بالفعل!', ephemeral: true });
    await p.pause(true);
    const reply = { embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⏸️ تم إيقاف الأغنية مؤقتاً')] };
    interaction.isButton?.() ? interaction.update(reply).catch(() => interaction.reply(reply)) : interaction.reply(reply);
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /كمل ──────────────────────────────────────────────────────
export async function handleResume(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية!', ephemeral: true });
    if (!p.paused) return interaction.reply({ content: '▶️ الأغنية شغالة بالفعل!', ephemeral: true });
    await p.pause(false);
    const reply = { embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('▶️ تم استئناف التشغيل')] };
    interaction.isButton?.() ? interaction.update(reply).catch(() => interaction.reply(reply)) : interaction.reply(reply);
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /شغال-ايه ─────────────────────────────────────────────────
export async function handleNowPlaying(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });

    const song  = songFromTrack(p.queue.current);
    const pos   = Math.floor((p.position || 0) / 1000);
    const total = song.duration || 1;
    const pct   = Math.min(Math.floor(pos / total * 20), 20);
    const bar   = '█'.repeat(pct) + '░'.repeat(20 - pct);

    const embed = new EmbedBuilder().setColor(0x66FCF1)
      .setTitle('🎵 الشغّالة دلوقتي')
      .setDescription([
        `**${song.name}**`,
        `👤 ${song.uploader?.name || 'غير معروف'}`,
        `\`[${bar}]\``,
        `\`${fmtMs(pos * 1000)} / ${fmtMs(total * 1000)}\``,
        `🔊 ${p.volume}% | 🔁 ${p.repeatMode === 'off' ? 'إيقاف' : p.repeatMode === 'track' ? 'أغنية' : 'قائمة'}`,
      ].join('\n'));
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    interaction.reply({ embeds: [embed] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /صوت ──────────────────────────────────────────────────────
export async function handleVolume(interaction) {
  try {
    const p   = lavalink?.getPlayer(interaction.guildId);
    if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
    const vol = interaction.options?.getInteger('مستوى');
    if (vol == null) return interaction.reply({ content: '❌ اختار مستوى!', ephemeral: true });
    await p.setVolume(vol);
    interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🔊 مستوى الصوت: **${vol}%**`)] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /تكرار ────────────────────────────────────────────────────
export async function handleRepeat(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
    const modes = ['off', 'track', 'queue'];
    const cur   = modes.indexOf(p.repeatMode);
    const next  = modes[(cur + 1) % 3];
    p.setRepeatMode(next);
    const labels = { off: '❌ إيقاف التكرار', track: '🔂 تكرار الأغنية', queue: '🔁 تكرار القائمة' };
    const reply  = { embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(labels[next])] };
    interaction.isButton?.() ? interaction.update(reply).catch(() => interaction.reply(reply)) : interaction.reply(reply);
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /خلط ──────────────────────────────────────────────────────
export async function handleShuffle(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.tracks?.length) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });
    p.queue.shuffle();
    const reply = { embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🔀 تم خلط القائمة — ${p.queue.tracks.length} أغنية`)] };
    interaction.isButton?.() ? interaction.update(reply).catch(() => interaction.reply(reply)) : interaction.reply(reply);
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /تخطى-لـ ──────────────────────────────────────────────────
export async function handleJump(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش قائمة!', ephemeral: true });
    const num = interaction.options?.getInteger('رقم');
    if (!num || num < 1 || num > p.queue.tracks.length)
      return interaction.reply({ content: `❌ الرقم لازم يكون بين 1 و ${p.queue.tracks.length}`, ephemeral: true });
    // احذف كل حاجة قبل الأغنية المطلوبة
    p.queue.splice(0, num - 1);
    await p.skip();
    interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏩ تم التخطي للأغنية رقم ${num}`)] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /احذف ─────────────────────────────────────────────────────
export async function handleRemove(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.tracks?.length) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });
    const num = interaction.options?.getInteger('رقم');
    if (!num || num < 2 || num > p.queue.tracks.length + 1)
      return interaction.reply({ content: `❌ الرقم لازم يكون بين 2 و ${p.queue.tracks.length + 1}`, ephemeral: true });
    const removed = p.queue.splice(num - 2, 1);
    const title   = removed?.[0]?.info?.title || 'الأغنية';
    interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🗑️ تم حذف: **${title}**`)] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /كلمات ────────────────────────────────────────────────────
export async function handleLyrics(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });

    await interaction.deferReply();
    const title  = p.queue.current.info.title;
    const artist = p.queue.current.info.author || '';

    const res  = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (!data.lyrics) return interaction.editReply({ content: '❌ مش لاقي كلمات الأغنية دي!' });

    const lyrics = data.lyrics.slice(0, 3900);
    interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setTitle(`📝 ${title}`).setDescription(`\`\`\`\n${lyrics}\n\`\`\``)] });
  } catch (e) { interaction.editReply({ content: `❌ ${e.message}` }).catch(() => {}); }
}

// ─── /انتقل ────────────────────────────────────────────────────
export async function handleSeek(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });

    const timeStr = interaction.options?.getString('وقت') || '';
    let secs = 0;
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':').map(Number);
      secs = parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2] : parts[0]*60 + parts[1];
    } else {
      secs = parseInt(timeStr) || 0;
    }

    const maxSecs = Math.floor((p.queue.current.info.duration || 0) / 1000);
    if (secs < 0 || secs > maxSecs)
      return interaction.reply({ content: `❌ الوقت لازم يكون بين 0:00 و ${fmtMs(maxSecs * 1000)}`, ephemeral: true });

    await p.seek(secs * 1000);
    interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏱️ تم الانتقال إلى **${fmtMs(secs * 1000)}**`)] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── /فلتر ─────────────────────────────────────────────────────
export async function handleFilter(interaction) {
  try {
    const p = lavalink?.getPlayer(interaction.guildId);
    if (!p?.queue?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });

    const type = interaction.options?.getString('نوع');
    await p.filterManager.resetFilters();

    const labels = {
      off:       '❌ تم إيقاف الفلاتر',
      bassboost: '🔊 باس بوست مفعّل',
      nightcore: '🌙 نايتكور مفعّل',
      '8d':      '🎧 صوت 8D مفعّل',
      vaporwave: '🌊 فيبورويف مفعّل',
      karaoke:   '🎤 كاريوكي مفعّل',
    };

    if (type === 'bassboost') {
      await p.filterManager.setEqualizer([
        { band: 0, gain: 0.6 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.8 },
        { band: 3, gain: 0.55 }, { band: 4, gain: 0.25 },
      ]);
    } else if (type === 'nightcore') {
      await p.filterManager.setTimescale({ speed: 1.3, pitch: 1.3, rate: 1.0 });
    } else if (type === '8d') {
      await p.filterManager.setRotation({ rotationHz: 0.2 });
    } else if (type === 'vaporwave') {
      await p.filterManager.setTimescale({ speed: 0.8, pitch: 0.8, rate: 1.0 });
    } else if (type === 'karaoke') {
      await p.filterManager.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 });
    }

    interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(labels[type] || '🎛️ تم تطبيق الفلتر')] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── أغنية سابقة (زر) ─────────────────────────────────────────
export async function handlePrevious(interaction) {
  try {
    const p    = lavalink?.getPlayer(interaction.guildId);
    const prev = previousTracks.get(interaction.guildId);
    if (!p || !prev) return interaction.reply({ content: '❌ مفيش أغنية سابقة!', ephemeral: true });
    prev.requester = interaction.user;
    await p.queue.add(prev, 0);
    await p.skip();
    interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏮️ رجّعت: **${prev.info.title}**`)] });
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── تخطي من قائمة (select menu) ─────────────────────────────
export async function handleQueueJump(interaction) {
  try {
    const p   = lavalink?.getPlayer(interaction.guildId);
    if (!p) return interaction.reply({ content: '❌ مفيش موسيقى!', ephemeral: true });
    const idx = parseInt(interaction.values?.[0]) - 1;
    if (isNaN(idx) || idx < 0) return interaction.reply({ content: '❌ اختيار غير صالح!', ephemeral: true });
    p.queue.splice(0, idx);
    await p.skip();
    interaction.update({ content: '✅ تم الانتقال!', components: [] }).catch(() => interaction.reply({ content: '✅ تم!', ephemeral: true }));
  } catch (e) { interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {}); }
}

// ─── export الخاصية القديمة (للتوافق مع index.js) ─────────────
export const previousSongsMap = previousTracks;
export const AVAILABLE_FILTERS = {
  bassboost: 'باس بوست',
  nightcore: 'نايتكور',
  '8d':      '8D صوت محيطي',
  vaporwave: 'فيبورويف',
  karaoke:   'كاريوكي',
};
