// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي
//  DisTube v5 + SpotifyPlugin + YtDlpPlugin + SoundCloudPlugin
//  الترتيب: رابط Spotify أغنية → Spotify API → YouTube
//           رابط Spotify playlist/album → SpotifyPlugin scraping
//           بحث نصي → YouTube مباشرة
// ════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { DisTube } from 'distube';
import { SpotifyPlugin } from '@distube/spotify';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SoundCloudPlugin } from '@distube/soundcloud';
import { sendMusicCard } from '../helpers/music-card.js';

// ─── كشف نوع الإدخال ──────────────────────────────────────────
function detectSourceType(query) {
  const q = query.trim();
  // Spotify URIs: spotify:track:xxx / spotify:playlist:xxx / spotify:album:xxx / spotify:artist:xxx
  if (/^spotify:(track|playlist|album|artist):[a-zA-Z0-9]+$/i.test(q)) {
    const kind = q.split(':')[1].toLowerCase();
    if (kind === 'track')  return 'spotify_track';
    if (kind === 'artist') return 'spotify_artist';
    return 'spotify_collection'; // playlist / album
  }
  // Spotify short links
  if (/spotify\.link\//i.test(q))                      return 'spotify_short';
  // Spotify web URLs
  if (/open\.spotify\.com\/(playlist|album)/i.test(q)) return 'spotify_collection';
  if (/open\.spotify\.com\/artist/i.test(q))            return 'spotify_artist';
  if (/open\.spotify\.com\/track/i.test(q))             return 'spotify_track';
  if (/open\.spotify\.com/i.test(q))                    return 'spotify_track';
  // Other
  if (/youtube\.com|youtu\.be/i.test(q))               return 'youtube';
  if (/soundcloud\.com/i.test(q))                      return 'soundcloud';
  return 'text';
}

// ─── Spotify token helper ──────────────────────────────────────
async function getSpotifyToken() {
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${process.env.SPOTIFY_CLIENT_ID}&client_secret=${process.env.SPOTIFY_CLIENT_SECRET}`,
  });
  const data = await tokenRes.json();
  if (!data.access_token) throw new Error('فشل الحصول على Spotify token — تأكد من SPOTIFY_CLIENT_ID و SPOTIFY_CLIENT_SECRET');
  return data.access_token;
}

// ─── جيب كل أغاني Spotify (track/album/playlist/artist/short) ──
// بيرجع: { type, name, tracks: string[] }
async function fetchSpotifyContent(rawQuery) {
  const q = rawQuery.trim();

  // — حل الـ Spotify URI إلى URL ويب عادي —
  let url = q;
  if (/^spotify:/i.test(q)) {
    const parts = q.split(':'); // ['spotify','type','id']
    url = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
  }

  // — حل الـ short link —
  if (/spotify\.link\//i.test(url)) {
    const { default: nodeFetch } = await import('node-fetch');
    const res = await nodeFetch(url, { redirect: 'follow', timeout: 8000 });
    url = res.url; // الرابط النهائي بعد redirect
  }

  const token = await getSpotifyToken();
  const headers = { Authorization: `Bearer ${token}` };

  // — Track —
  const trackMatch = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/i);
  if (trackMatch) {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackMatch[1]}`, { headers });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.name) throw new Error('مش لاقي بيانات الأغنية');
    const searchQ = `${data.artists?.[0]?.name || ''} ${data.name}`.trim();
    return { type: 'track', name: data.name, tracks: [searchQ] };
  }

  // — Playlist —
  const plMatch = url.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/i);
  if (plMatch) {
    const tracks = [];
    let endpoint = `https://api.spotify.com/v1/playlists/${plMatch[1]}/tracks?limit=50&fields=next,items(track(name,artists,is_local))`;
    let playlistName = 'بلاي ليست';
    let first = true;
    while (endpoint && tracks.length < 100) {
      const res = await fetch(endpoint, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (first) { playlistName = data.name || playlistName; first = false; }
      for (const item of (data.items || [])) {
        const t = item?.track;
        if (!t || t.is_local || !t.name) continue;
        tracks.push(`${t.artists?.[0]?.name || ''} ${t.name}`.trim());
        if (tracks.length >= 100) break;
      }
      endpoint = data.next || null;
    }
    if (!tracks.length) throw new Error('البلاي ليست فاضية أو private — جرب بلاي ليست عامة (🔓 Public)');
    return { type: 'playlist', name: playlistName, tracks };
  }

  // — Album —
  const albMatch = url.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/i);
  if (albMatch) {
    const tracks = [];
    let endpoint = `https://api.spotify.com/v1/albums/${albMatch[1]}/tracks?limit=50`;
    let albumName = 'ألبوم';
    let first = true;
    while (endpoint && tracks.length < 100) {
      const res = await fetch(endpoint, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (first) { albumName = data.name || albumName; first = false; }
      for (const t of (data.items || [])) {
        if (!t || !t.name) continue;
        tracks.push(`${t.artists?.[0]?.name || ''} ${t.name}`.trim());
        if (tracks.length >= 100) break;
      }
      endpoint = data.next || null;
    }
    if (!tracks.length) throw new Error('الألبوم ده فاضي أو مش متاح');
    return { type: 'album', name: albumName, tracks };
  }

  // — Artist (top tracks) —
  const artMatch = url.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/i);
  if (artMatch) {
    const [artRes, topRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/artists/${artMatch[1]}`, { headers }),
      fetch(`https://api.spotify.com/v1/artists/${artMatch[1]}/top-tracks?market=US`, { headers }),
    ]);
    const artData = await artRes.json();
    const topData = await topRes.json();
    if (artData.error) throw new Error(artData.error.message);
    const tracks = (topData.tracks || []).slice(0, 20).map(t => `${artData.name} ${t.name}`.trim());
    if (!tracks.length) throw new Error('مش لاقي أغاني للفنان ده');
    return { type: 'artist', name: artData.name, tracks };
  }

  throw new Error('نوع رابط Spotify غير مدعوم');
}

let distube = null;

// ─── تتبع الأغنية السابقة لكل سيرفر ──────────────────────────
export const previousSongsMap = new Map(); // guildId → Song السابقة
const _currentSongTracker    = new Map(); // guildId → Song الحالية (داخلي)

// ─── تهيئة DisTube ────────────────────────────────────────────
export function initMusicSystem(client) {
  if (distube) return distube;

  distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: true,
    plugins: [
      new SpotifyPlugin(
        process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
          ? { api: { clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET } }
          : {}
      ),
      new YtDlpPlugin({ update: false }),
      new SoundCloudPlugin(),
    ],
  });

  // ─── خروج تلقائي لما القناة تفضى ────────────────────────────
  const emptyLeaveTimers = new Map(); // guildId → timeoutHandle

  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const guildId = newState.guild.id || oldState.guild.id;
      const q = distube.getQueue(guildId);
      if (!q) return;
      const botVC = q.voice?.channel;
      if (!botVC) return;
      const humans = botVC.members.filter(m => !m.user.bot).size;

      if (humans === 0) {
        // فاضية — ابدأ عداد 30 ثانية للخروج
        if (!emptyLeaveTimers.has(guildId)) {
          q.textChannel?.send({
            embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⚠️ القناة الصوتية فاضية — هخرج تلقائياً في **30 ثانية** لو محدش رجع')],
          }).catch(() => {});

          const timer = setTimeout(async () => {
            try {
              emptyLeaveTimers.delete(guildId);
              // تأكد إن القناة لسه فاضية
              const stillEmpty = botVC.members.filter(m => !m.user.bot).size === 0;
              if (!stillEmpty) return;
              const qNow = distube.getQueue(guildId);
              if (!qNow) return;
              if (qNow.currentMessage) {
                await qNow.currentMessage.delete().catch(() => {});
                qNow.currentMessage = null;
              }
              qNow.textChannel?.send({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('👋 القناة فاضية — خرجت تلقائياً!')],
              }).catch(() => {});
              await distube.stop(guildId).catch(() => {});
            } catch {}
          }, 30_000);

          emptyLeaveTimers.set(guildId, timer);
        }
      } else {
        // حد رجع — إلغي العداد وكمّل
        if (emptyLeaveTimers.has(guildId)) {
          clearTimeout(emptyLeaveTimers.get(guildId));
          emptyLeaveTimers.delete(guildId);
          if (q.paused) q.resume().catch?.(() => {});
          q.textChannel?.send({
            embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('▶️ حد رجع! بكمل الموسيقى 🎵')],
          }).catch(() => {});
        }
      }
    } catch {}
  });

  distube.on('playSong', async (queue, song) => {
    try {
      // حفظ الأغنية الحالية كـ "سابقة" قبل ما نبدأ الجديدة
      const prevSong = _currentSongTracker.get(queue.id);
      if (prevSong) previousSongsMap.set(queue.id, prevSong);
      _currentSongTracker.set(queue.id, song);

      if (queue.currentMessage) {
        await queue.currentMessage.delete().catch(() => {});
        queue.currentMessage = null;
      }
      if (queue.textChannel) await sendMusicCard(queue, song, queue.textChannel);
    } catch (e) {
      console.error('❌ [Music] playSong خطأ:', e.message);
    }
  });

  distube.on('addSong', (queue, song) => {
    try {
      if (queue._batchLoading) return; // كتم الرسايل أثناء تحميل البلاي ليست
      if (!queue.textChannel?.send) return;
      const min = Math.floor(song.duration / 60);
      const sec = (song.duration % 60).toString().padStart(2, '0');
      queue.textChannel.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`✅ أُضيفت للقائمة: **${song.name}** \`${min}:${sec}\``)],
      }).catch(() => {});
    } catch {}
  });

  distube.on('addList', (queue, playlist) => {
    try {
      queue.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`📋 أُضيفت بلاي ليست **${playlist.name}** — ${playlist.songs.length} أغنية`)],
      }).catch(() => {});
    } catch {}
  });

  distube.on('finish', (queue) => {
    try { queue.textChannel?.send('🏁 خلصت القائمة!').catch(() => {}); } catch {}
  });

  distube.on('error', (error, queue) => {
    console.error('❌ [DisTube]', error?.message || error);
    try {
      queue?.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`⛔ حصل خطأ: ${String(error).slice(0, 500)}`)],
      }).catch(() => {});
    } catch {}
  });

  console.log('✅ [Music] DisTube جاهز!');
  return distube;
}

// ─── musicHandler — للتوافق مع index.js ──────────────────────
export const musicHandler = {
  _pending: {},

  getDistube() { return distube; },

  getQueue(guildId) {
    if (!distube) return null;
    const q = distube.getQueue(guildId);
    if (!q) return null;
    const song = q.songs[0];
    return {
      currentSong: song ? { title: song.name, artist: song.uploader?.name, duration: song.duration, requestedBy: song.user?.username } : null,
      songs: q.songs.map(s => ({ title: s.name })),
      length: q.songs.length,
      volume: q.volume,
    };
  },

  async joinVoiceChannelAndPlay(guildId, voiceChannel, textChannel) {
    this._pending[guildId] = { voiceChannel, textChannel };
  },

  async resolveSource(query, userTag) {
    return [{ query, title: query, requestedBy: userTag }];
  },

  async addToQueue(guildId, song) {
    if (!distube) throw new Error('نظام الموسيقى مش شغال!');
    const p = this._pending[guildId];
    if (!p) throw new Error('مفيش قناة صوتية!');
    await distube.play(p.voiceChannel, song.query, { textChannel: p.textChannel });
  },

  async skip(guildId) {
    if (!distube) throw new Error('نظام الموسيقى مش شغال!');
    const q = distube.getQueue(guildId);
    if (!q) throw new Error('مفيش موسيقى شغالة!');
    if (q.songs.length <= 1) throw new Error('مفيش أغنية تانية في القائمة!');
    return await distube.skip(guildId);
  },

  async stop(guildId) {
    if (!distube) throw new Error('نظام الموسيقى مش شغال!');
    const q = distube.getQueue(guildId);
    if (!q) throw new Error('مفيش موسيقى شغالة!');
    return await distube.stop(guildId);
  },

  async pause(guildId) {
    if (!distube) throw new Error('نظام الموسيقى مش شغال!');
    const q = distube.getQueue(guildId);
    if (!q) throw new Error('مفيش موسيقى شغالة!');
    return distube.pause(guildId);
  },

  async resume(guildId) {
    if (!distube) throw new Error('نظام الموسيقى مش شغال!');
    const q = distube.getQueue(guildId);
    if (!q) throw new Error('مفيش موسيقى شغالة!');
    return distube.resume(guildId);
  },

  setVolume(guildId, vol) {
    if (!distube) return;
    const pct = Math.round(Math.max(0, Math.min(1, vol)) * 100);
    distube.setVolume(guildId, pct);
    return pct;
  },

  getQueueSize(guildId) {
    return distube?.getQueue(guildId)?.songs?.length || 0;
  },

  getQueueDisplay(guildId, page = 1) {
    if (!distube) return '❌ نظام الموسيقى مش شغال!';
    const q = distube.getQueue(guildId);
    if (!q || !q.songs.length) return '❌ القائمة فاضية!';
    const perPage = 10;
    const start = (page - 1) * perPage;
    return q.songs.slice(start, start + perPage).map((s, i) => {
      const idx = start + i;
      const min = Math.floor(s.duration / 60);
      const sec = (s.duration % 60).toString().padStart(2, '0');
      return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${s.name} \`${min}:${sec}\``;
    }).join('\n') || '❌ مفيش أغاني في الصفحة دي!';
  },

  formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },
};

// ─── تسجيل أوامر الموسيقى ─────────────────────────────────────
export async function registerMusicCommands() {
  return [
    { data: new SlashCommandBuilder().setName('شغل').setDescription('🎵 شغّل أغنية من Spotify أو ابحث بالاسم').addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو رابطها من Spotify').setRequired(true)), execute: handlePlay },
    { data: new SlashCommandBuilder().setName('تخطي').setDescription('⏭️ تخطي الأغنية الحالية'), execute: handleSkip },
    { data: new SlashCommandBuilder().setName('خروج').setDescription('⏹️ إيقاف الموسيقى والخروج من القناة'), execute: handleStop },
    { data: new SlashCommandBuilder().setName('قائمة').setDescription('📋 عرض قائمة التشغيل').addIntegerOption(o => o.setName('صفحة').setDescription('رقم الصفحة').setRequired(false).setMinValue(1)), execute: handleQueue },
    { data: new SlashCommandBuilder().setName('بوز').setDescription('⏸️ إيقاف مؤقت للأغنية'), execute: handlePause },
    { data: new SlashCommandBuilder().setName('كمل').setDescription('▶️ استئناف التشغيل'), execute: handleResume },
    { data: new SlashCommandBuilder().setName('شغال-ايه').setDescription('🎶 اعرض الأغنية الشغالة دلوقتي'), execute: handleNowPlaying },
    { data: new SlashCommandBuilder().setName('صوت').setDescription('🔊 اضبط مستوى الصوت').addIntegerOption(o => o.setName('مستوى').setDescription('من 0 لـ 100').setRequired(true).setMinValue(0).setMaxValue(100)), execute: handleVolume },
    { data: new SlashCommandBuilder().setName('تكرار').setDescription('🔁 بدّل وضع التكرار'), execute: handleRepeat },
    { data: new SlashCommandBuilder().setName('خلط').setDescription('🔀 خلط ترتيب القائمة عشوائياً'), execute: handleShuffle },
    { data: new SlashCommandBuilder().setName('تخطى-لـ').setDescription('⏩ تخطى لأغنية معينة في القائمة').addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية في القائمة').setRequired(true).setMinValue(1)), execute: handleJump },
    { data: new SlashCommandBuilder().setName('احذف').setDescription('🗑️ احذف أغنية من القائمة').addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية (مش الشغالة دلوقتي)').setRequired(true).setMinValue(2)), execute: handleRemove },
    { data: new SlashCommandBuilder().setName('كلمات').setDescription('📝 اعرض كلمات الأغنية الشغالة دلوقتي'), execute: handleLyrics },
  ];
}

// ─── بناء Embed للأغنية الواحدة / المجموعة ────────────────────
function buildPlayEmbed(sp) {
  const icons = { track: '🎵', playlist: '📋', album: '💿', artist: '🎤', collection: '🎵' };
  const icon = icons[sp.type] || '🎵';
  const typeAr = { track: 'أغنية', playlist: 'بلاي ليست', album: 'ألبوم', artist: 'فنان' }[sp.type] || 'محتوى';
  const desc = sp.tracks.length === 1
    ? `${icon} جاري تشغيل: **${sp.name}**`
    : `${icon} جاري تشغيل **${sp.type === 'artist' ? `أفضل أغاني ${sp.name}` : sp.name}** — **${sp.tracks.length} أغنية** (${typeAr} Spotify)`;
  return new EmbedBuilder().setColor(0x1DB954).setDescription(desc);
}

// ─── handlePlay ────────────────────────────────────────────────
export async function handlePlay(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال! كلم الأونر.', ephemeral: true });

    const query = interaction.options?.getString('اغنية') || interaction.options?.getString('query') || '';
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) return interaction.reply({ content: '❌ لازم تكون في قناة صوتية الأول!', ephemeral: true });
    if (!query) return interaction.reply({ content: '❌ اكتب اسم الأغنية أو رابطها!', ephemeral: true });

    await interaction.deferReply();

    const sourceType = detectSourceType(query);
    const playOptions = { textChannel: interaction.channel, member: interaction.member };

    // ── كل أنواع Spotify تمر من fetchSpotifyContent ──────────────
    if (sourceType.startsWith('spotify_')) {
      const typeLabels = {
        spotify_track:      '🎵 جاري جلب الأغنية من Spotify...',
        spotify_collection: '📋 جاري تحميل المجموعة من Spotify...',
        spotify_artist:     '🎤 جاري جلب أغاني الفنان من Spotify...',
        spotify_short:      '🔗 جاري تحليل الرابط...',
      };
      await interaction.editReply({ content: typeLabels[sourceType] || '🎵 جاري جلب المحتوى من Spotify...' });

      let sp;
      try {
        sp = await fetchSpotifyContent(query);
      } catch (apiErr) {
        console.error('❌ [Music] fetchSpotifyContent فشل:', apiErr.message);
        return interaction.editReply({ content: `❌ ${apiErr.message}` });
      }

      if (sp.tracks.length === 1) {
        // أغنية واحدة
        await interaction.editReply({ embeds: [buildPlayEmbed(sp)] });
        await distube.play(voiceChannel, sp.tracks[0], playOptions);
      } else {
        // مجموعة — شغّل الأولى وأضيف الباقي في background
        await interaction.editReply({ embeds: [buildPlayEmbed(sp)] });
        await distube.play(voiceChannel, sp.tracks[0], playOptions);

        // أضيف الباقي بدون إزعاج
        ;(async () => {
          const q = distube.getQueue(interaction.guildId);
          if (q) q._batchLoading = true;
          for (let i = 1; i < sp.tracks.length; i++) {
            try { await distube.play(voiceChannel, sp.tracks[i], { ...playOptions }); } catch {}
            await new Promise(r => setTimeout(r, 350));
          }
          const qEnd = distube.getQueue(interaction.guildId);
          if (qEnd) {
            qEnd._batchLoading = false;
            qEnd.textChannel?.send({
              embeds: [new EmbedBuilder()
                .setColor(0x1DB954)
                .setDescription(`✅ أُضيفت **${sp.tracks.length} أغنية** من Spotify للقائمة 🎵`)],
            }).catch(() => {});
          }
        })();
      }

      return; // ← خروج بعد Spotify
    }

    if (sourceType === 'youtube' || sourceType === 'soundcloud') {
      // ── روابط YouTube / SoundCloud مباشرة ──
      await interaction.editReply({ content: '🔍 جاري التحميل...' });
      await distube.play(voiceChannel, query, playOptions);

    } else {
      // ── بحث نصي → YouTube مباشرة (الأضمن) ──
      await interaction.editReply({ content: '🔍 جاري البحث...' });
      await distube.play(voiceChannel, query, playOptions);
    }

    await interaction.editReply({ content: '✅ تم!' }).catch(() => {});

  } catch (e) {
    const errMsg = e?.message || String(e);
    console.error('❌ [Music] handlePlay:', errMsg);

    let msg;
    if (/private|unavailable|blocked|age.?restricted/i.test(errMsg))
      msg = `🔒 الأغنية/البلاي ليست دي مش متاحة (private أو blocked)`;
    else if (/no result|not found|مش لاقي/i.test(errMsg))
      msg = `❌ مش لاقي الأغنية دي!\n💡 جرب ترفق رابط مباشر من \`open.spotify.com\``;
    else
      msg = `❌ حصل خطأ: \`${errMsg.slice(0, 300)}\``;

    try { await interaction.editReply({ content: msg }); }
    catch { await interaction.reply({ content: msg, ephemeral: true }).catch(() => {}); }
  }
}

// ─── handleSkip ────────────────────────────────────────────────
export async function handleSkip(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    if (q.songs.length <= 1) return interaction.reply({ content: '❌ مفيش أغنية تانية في القائمة!', ephemeral: true });
    await distube.skip(interaction.guildId);
    await interaction.reply({ content: '⏭️ اتخطت الأغنية!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleStop ────────────────────────────────────────────────
export async function handleStop(interaction) {
  try {
    const isButton = interaction.isButton?.();
    if (isButton) await interaction.deferUpdate().catch(() => {});

    const q = distube.getQueue(interaction.guildId);

    const dashMsg = isButton ? interaction.message : q?.currentMessage;
    if (dashMsg) await dashMsg.delete().catch(() => {});
    if (q?.currentMessage && q.currentMessage.id !== dashMsg?.id) {
      await q.currentMessage.delete().catch(() => {});
    }
    if (q) q.currentMessage = null;

    if (q) {
      await distube.stop(interaction.guildId).catch(() => {});
    }

    // خروج صريح من القناة الصوتية لو البوت لسه فيها
    const vc = interaction.guild?.members?.me?.voice?.channel;
    if (vc) {
      interaction.guild.members.me.voice.disconnect().catch(() => {});
    }

    if (!isButton) {
      await interaction.reply({ content: '👋 خرجت من القناة وإيقاف الموسيقى!', ephemeral: true });
    }
  } catch (e) {
    try {
      if (!interaction.replied && !interaction.deferred)
        await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    } catch {}
  }
}

// ─── handleQueue ───────────────────────────────────────────────
export async function handleQueue(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q || !q.songs.length) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });

    const page = interaction.options?.getInteger('صفحة') || 1;
    const perPage = 10;
    const start = (page - 1) * perPage;
    const lines = q.songs.slice(start, start + perPage).map((s, i) => {
      const idx = start + i;
      const min = Math.floor(s.duration / 60);
      const sec = (s.duration % 60).toString().padStart(2, '0');
      return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${s.name} \`${min}:${sec}\``;
    });

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🎵 قائمة التشغيل')
        .setDescription(lines.join('\n'))
        .setColor(0x66FCF1)
        .setFooter({ text: `🔊 ${q.volume}% | ${q.songs.length} أغنية | صفحة ${page}` })
        .setTimestamp()],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handlePause ───────────────────────────────────────────────
export async function handlePause(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    if (q.paused) return interaction.reply({ content: '⏸️ الأغنية موقوفة أصلاً!', ephemeral: true });
    distube.pause(interaction.guildId);
    await interaction.reply({ content: '⏸️ اتوقفت مؤقتاً!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleResume ──────────────────────────────────────────────
export async function handleResume(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    if (!q.paused) return interaction.reply({ content: '▶️ الأغنية شغالة مش موقوفة!', ephemeral: true });
    distube.resume(interaction.guildId);
    await interaction.reply({ content: '▶️ كملت التشغيل!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleNowPlaying ──────────────────────────────────────────
export async function handleNowPlaying(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q || !q.songs[0]) return interaction.reply({ content: '❌ مفيش أغنية شغالة دلوقتي!', ephemeral: true });

    const song = q.songs[0];
    const cur = Math.floor(q.currentTime);
    const tot = song.duration;
    const pct = tot > 0 ? Math.floor((cur / tot) * 100) : 0;
    const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const repeatLabel = q.repeatMode === 0 ? '❌ إيقاف' : q.repeatMode === 1 ? '🔂 أغنية' : '🔁 قائمة';

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🎵 شغّال دلوقتي')
        .setDescription(`**${song.name}**`)
        .setThumbnail(song.thumbnail)
        .addFields(
          { name: '⏱️ الوقت', value: `\`${fmt(cur)} / ${fmt(tot)}\``, inline: true },
          { name: '🔊 الصوت', value: `\`${q.volume}%\``, inline: true },
          { name: '🔁 التكرار', value: `\`${repeatLabel}\``, inline: true },
          { name: '📊 التقدم', value: `\`${pct}%\``, inline: true },
          { name: '👤 طلبها', value: song.user ? `<@${song.user.id}>` : 'مجهول', inline: true },
        )
        .setColor(0x66FCF1)
        .setTimestamp()],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleVolume ──────────────────────────────────────────────
export async function handleVolume(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    const level = interaction.options?.getInteger('مستوى') ?? interaction.options?.getInteger('level');
    if (level == null) return interaction.reply({ content: '❌ ادخل مستوى الصوت!', ephemeral: true });
    distube.setVolume(interaction.guildId, level);
    await interaction.reply({ content: `🔊 الصوت اتضبط على **${level}%**`, ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleRepeat ──────────────────────────────────────────────
export async function handleRepeat(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    const next = q.repeatMode === 0 ? 1 : q.repeatMode === 1 ? 2 : 0;
    distube.setRepeatMode(interaction.guildId, next);
    const labels = ['❌ التكرار اتوقف', '🔂 بيكرر الأغنية', '🔁 بيكرر القائمة'];
    await interaction.reply({ content: labels[next], ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleShuffle ─────────────────────────────────────────────
export async function handleShuffle(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    if (q.songs.length <= 1) return interaction.reply({ content: '❌ مفيش أغاني كفاية في القائمة عشان تتخلط!', ephemeral: true });
    const current = q.songs[0];
    const rest = q.songs.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    q.songs = [current, ...rest];
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x9b59b6).setDescription(`🔀 اتخلطت القائمة! (${rest.length} أغنية)`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleJump ────────────────────────────────────────────────
export async function handleJump(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    const num = interaction.options.getInteger('رقم');
    if (num < 1 || num > q.songs.length) return interaction.reply({ content: `❌ الرقم لازم يكون بين 1 و${q.songs.length}!`, ephemeral: true });
    if (num === 1) return interaction.reply({ content: '⏩ الأغنية دي شغالة أصلاً!', ephemeral: true });
    const targetSong = q.songs[num - 1];
    await distube.jump(interaction.guildId, num - 1);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`⏩ بتخطى لـ **${targetSong.name}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleRemove ──────────────────────────────────────────────
export async function handleRemove(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
    const num = interaction.options.getInteger('رقم');
    if (num < 2) return interaction.reply({ content: '❌ مش ممكن تحذف الأغنية الشغالة — استخدم `/تخطي`!', ephemeral: true });
    if (num > q.songs.length) return interaction.reply({ content: `❌ مفيش رقم ${num} في القائمة!`, ephemeral: true });
    const removed = q.songs.splice(num - 1, 1)[0];
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🗑️ اتشالت من القائمة: **${removed.name}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleLyrics ──────────────────────────────────────────────
export async function handleLyrics(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q || !q.songs[0]) return interaction.reply({ content: '❌ مفيش أغنية شغالة دلوقتي!', ephemeral: true });

    await interaction.deferReply();

    const song = q.songs[0];
    const cleanName = song.name
      .replace(/\(.*?(official|video|audio|lyrics|hd|hq|mv|4k|clip|music|lyric|visualizer).*?\)/gi, '')
      .replace(/\[.*?\]/gi, '')
      .replace(/official\s*(video|audio|music video|lyric video)?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const { Client: GeniusClient } = await import('genius-lyrics');
    const genius = new GeniusClient();

    let lyrics = null;
    let foundTitle = cleanName;

    try {
      const searches = await genius.songs.search(cleanName);
      if (searches.length > 0) {
        lyrics = await searches[0].lyrics();
        foundTitle = searches[0].title;
      }
    } catch (searchErr) {
      console.warn('⚠️ [Lyrics] Genius فشل:', searchErr.message);
    }

    if (!lyrics) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ مش لاقي كلمات لـ **${cleanName}**\n💡 جرب اسم الأغنية بالإنجليزي`)],
      });
    }

    const MAX = 4000;
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
      if (i === 0) { e.setTitle(`📝 ${foundTitle}`); if (song.thumbnail) e.setThumbnail(song.thumbnail); }
      if (i === chunks.length - 1) e.setFooter({ text: `🎵 ${song.name} | الكلمات من Genius` });
      return e;
    });

    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      if (i === 0) await interaction.editReply({ embeds: batch });
      else await interaction.followUp({ embeds: batch });
    }
  } catch (e) {
    console.error('❌ [Lyrics]', e.message);
    try { await interaction.editReply({ content: `❌ ${e.message}` }); } catch {}
  }
}

// ─── handlePrevious ────────────────────────────────────────────
export async function handlePrevious(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    const prev = previousSongsMap.get(interaction.guildId);
    if (!prev) return interaction.reply({ content: '⏮️ مفيش أغنية سابقة!', ephemeral: true });

    // أدخّل الأغنية السابقة مباشرة في الـ index 1 بدون ما يتبعت event addSong
    q.songs.splice(1, 0, prev);
    await distube.skip(interaction.guildId);
    await interaction.reply({ content: `⏮️ بيرجع لـ **${prev.name}**`, ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleQueueJump (للـ select menu) ────────────────────────
export async function handleQueueJump(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    const idx = parseInt(interaction.values[0], 10); // 0-based index in q.songs
    if (isNaN(idx) || idx < 1 || idx >= q.songs.length) {
      return interaction.reply({ content: '❌ الأغنية دي مش موجودة في القائمة!', ephemeral: true });
    }

    const targetSong = q.songs[idx];
    await distube.jump(interaction.guildId, idx);
    await interaction.reply({
      content: `⏩ بتخطى لـ **${targetSong.name}**`,
      ephemeral: true,
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}
