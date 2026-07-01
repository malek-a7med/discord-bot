// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي (نسخة محسّنة)
//  DisTube v5 + SoundCloudPlugin + YtDlpPlugin
//  ✅ تحسينات:
//     1. تصويت للتخطي (vote-skip)
//     2. أمر انتقل (seek)
//     3. فلاتر صوت (باس بوست، نايتكور، 8D، vaporwave)
//     4. تخطي آخر أغنية بيوقف بدل إيرور
//     5. قائمة بأزرار صفحات
//     6. زر الخلط في لوحة التحكم
// ════════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { DisTube } from 'distube';
import { SpotifyPlugin } from '@distube/spotify';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SoundCloudPlugin } from '@distube/soundcloud';
import { sendMusicCard } from '../helpers/music-card.js';
import { execSync } from 'child_process';
import { existsSync, chmodSync, writeFileSync } from 'fs';

// ─── تأكد إن yt-dlp موجود ────────────────────────────────────
const YT_DLP_BIN = '/tmp/yt-dlp';

async function ensureYtDlp() {
  try { execSync('yt-dlp --version', { stdio: 'ignore', timeout: 5000 }); return; } catch {}
  if (existsSync(YT_DLP_BIN)) {
    process.env.PATH = `/tmp:${process.env.PATH}`;
    return;
  }
  console.log('📥 [Music] جاري تنزيل yt-dlp...');
  try {
    const res = await fetch(
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      { redirect: 'follow' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    writeFileSync(YT_DLP_BIN, Buffer.from(buf));
    chmodSync(YT_DLP_BIN, '755');
    process.env.PATH = `/tmp:${process.env.PATH}`;
    console.log('✅ [Music] yt-dlp جاهز!');
  } catch (e) {
    console.warn('⚠️ [Music] فشل تنزيل yt-dlp:', e.message);
  }
}

// ─── كسر اتصال الصوت ─────────────────────────────────────────
function destroyVoiceConnection(guildId) {
  try { distube?.voices?.get(guildId)?.leave(); } catch {}
  try {
    const conn = getVoiceConnection(guildId);
    if (conn) conn.destroy();
  } catch {}
}

// ─── كشف نوع الإدخال ──────────────────────────────────────────
function detectSourceType(query) {
  const q = query.trim();
  if (/^spotify:(track|playlist|album|artist):[a-zA-Z0-9]+$/i.test(q)) {
    const kind = q.split(':')[1].toLowerCase();
    if (kind === 'track')  return 'spotify_track';
    if (kind === 'artist') return 'spotify_artist';
    return 'spotify_collection';
  }
  if (/spotify\.link\//i.test(q))                      return 'spotify_short';
  if (/open\.spotify\.com\/(playlist|album)/i.test(q)) return 'spotify_collection';
  if (/open\.spotify\.com\/artist/i.test(q))            return 'spotify_artist';
  if (/open\.spotify\.com\/track/i.test(q))             return 'spotify_track';
  if (/open\.spotify\.com/i.test(q))                    return 'spotify_track';
  if (/youtube\.com|youtu\.be/i.test(q))               return 'youtube';
  if (/soundcloud\.com/i.test(q))                      return 'soundcloud';
  return 'text';
}

// ─── جيب أغاني Spotify بدون API key ──────────────────────────
async function fetchSpotifyContent(rawQuery) {
  const q = rawQuery.trim();
  let url = q;
  if (/^spotify:/i.test(q)) {
    const parts = q.split(':');
    url = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
  }
  const { default: spotifyUrlInfo } = await import('spotify-url-info');
  const { getDetails } = spotifyUrlInfo(fetch);
  let details;
  try {
    details = await getDetails(url);
  } catch (err) {
    throw new Error(`مش قادر أجيب بيانات الرابط ده — تأكد إن الرابط صح وإن البلاي ليست عامة (🔓 Public)\n${err.message}`);
  }
  const { preview, tracks: rawTracks } = details || {};
  const tracks = [];
  for (const t of (rawTracks || [])) {
    const name   = t?.name;
    const artist = t?.artist || '';
    if (name) tracks.push(`${artist} ${name}`.trim());
  }
  if (!tracks.length) throw new Error('البلاي ليست/الألبوم ده فاضي أو private — جرب رابط عام (🔓 Public)');
  return {
    type:   preview?.type  || 'playlist',
    name:   preview?.title || 'مجموعة أغاني',
    tracks,
  };
}

let distube = null;

// ─── تتبع الأغنية السابقة لكل سيرفر ──────────────────────────
export const previousSongsMap = new Map();
const _currentSongTracker    = new Map();

// ─── تصويت التخطي لكل سيرفر ──────────────────────────────────
const skipVotes = new Map(); // guildId → Set<userId>

// ─── الفلاتر المتاحة ──────────────────────────────────────────
export const AVAILABLE_FILTERS = {
  'off':       { name: '❌ إيقاف الفلاتر',   filters: [] },
  'bassboost': { name: '🔊 باس بوست',         filters: ['bassboost'] },
  'nightcore': { name: '🌙 نايتكور',          filters: ['nightcore'] },
  '8d':        { name: '🎧 8D صوت محيطي',     filters: ['8d'] },
  'vaporwave': { name: '🌊 فيبورويف',         filters: ['vaporwave'] },
  'karaoke':   { name: '🎤 كاريوكي',          filters: ['karaoke'] },
};

// ─── تهيئة DisTube ────────────────────────────────────────────
export async function initMusicSystem(client) {
  await ensureYtDlp();
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
      new SoundCloudPlugin(),
      new YtDlpPlugin({ update: true }),
    ],
  });

  // ─── خروج تلقائي لما القناة تفضى ────────────────────────────
  const emptyLeaveTimers = new Map();

  async function forceLeaveVoice(guild, textChannel) {
    try {
      const q = distube.getQueue(guild.id);
      if (q?.currentMessage) {
        await q.currentMessage.delete().catch(() => {});
        q.currentMessage = null;
      }
      if (q) await distube.stop(guild.id).catch(() => {});
      destroyVoiceConnection(guild.id);
      skipVotes.delete(guild.id);
      textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('👋 القناة فاضية — خرجت تلقائياً!')],
      }).catch(() => {});
    } catch {}
  }

  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const guild = newState.guild || oldState.guild;
      const guildId = guild.id;
      const botVC = guild.members.me?.voice?.channel;
      if (!botVC) {
        if (emptyLeaveTimers.has(guildId)) {
          clearTimeout(emptyLeaveTimers.get(guildId));
          emptyLeaveTimers.delete(guildId);
        }
        return;
      }
      const humans = botVC.members.filter(m => !m.user.bot).size;
      const q = distube.getQueue(guildId);

      if (humans === 0) {
        if (!emptyLeaveTimers.has(guildId)) {
          const textCh = q?.textChannel || null;
          textCh?.send({
            embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⚠️ القناة الصوتية فاضية — هخرج تلقائياً في **30 ثانية** لو محدش رجع')],
          }).catch(() => {});

          const timer = setTimeout(async () => {
            emptyLeaveTimers.delete(guildId);
            const stillEmpty = guild.members.me?.voice?.channel?.members.filter(m => !m.user.bot).size === 0;
            if (!stillEmpty) return;
            await forceLeaveVoice(guild, q?.textChannel || null);
          }, 30_000);
          emptyLeaveTimers.set(guildId, timer);
        }
      } else {
        if (emptyLeaveTimers.has(guildId)) {
          clearTimeout(emptyLeaveTimers.get(guildId));
          emptyLeaveTimers.delete(guildId);
          if (q?.paused) q.resume().catch?.(() => {});
          q?.textChannel?.send({
            embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('▶️ حد رجع! بكمل الموسيقى 🎵')],
          }).catch(() => {});
        }
      }
    } catch {}
  });

  distube.on('playSong', async (queue, song) => {
    try {
      const prevSong = _currentSongTracker.get(queue.id);
      if (prevSong) previousSongsMap.set(queue.id, prevSong);
      _currentSongTracker.set(queue.id, song);
      skipVotes.delete(queue.id); // إعادة تعيين التصويت عند أغنية جديدة

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
      if (queue._batchLoading) return;
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
    try {
      _currentSongTracker.delete(queue.id);
      skipVotes.delete(queue.id);
      queue.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription('🏁 خلصت القائمة!')],
      }).catch(() => {});
    } catch {}
  });

  distube.on('disconnect', (queue) => {
    try {
      _currentSongTracker.delete(queue.id);
      skipVotes.delete(queue.id);
    } catch {}
  });

  distube.on('error', (error, queue) => {
    const msg = error?.message || String(error);
    console.error('❌ [DisTube]', msg);
    try {
      const isSkippable = /FFMPEG_EXITED|ffmpeg exited|no result|not found|Cannot find/i.test(msg);
      if (isSkippable) {
        if (queue && queue.songs.length > 1) {
          distube.skip(queue.id).catch(() => {});
        }
        return;
      }
      queue?.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`⛔ حصل خطأ: ${msg.slice(0, 300)}`)],
      }).catch(() => {});
    } catch {}
  });

  console.log('✅ [Music] DisTube جاهز!');
  return distube;
}

// ─── musicHandler ─────────────────────────────────────────────
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
    if (q.songs.length <= 1) {
      await distube.stop(guildId);
      return null;
    }
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
    {
      data: new SlashCommandBuilder()
        .setName('شغل')
        .setDescription('🎵 شغّل أغنية من Spotify أو ابحث بالاسم')
        .addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو رابطها').setRequired(true)),
      execute: handlePlay,
    },
    {
      data: new SlashCommandBuilder().setName('تخطي').setDescription('⏭️ تخطي الأغنية الحالية'),
      execute: handleSkip,
    },
    {
      data: new SlashCommandBuilder().setName('تصويت-تخطي').setDescription('🗳️ صوّت لتخطي الأغنية الحالية'),
      execute: handleVoteSkip,
    },
    {
      data: new SlashCommandBuilder().setName('خروج').setDescription('⏹️ إيقاف الموسيقى والخروج من القناة'),
      execute: handleStop,
    },
    {
      data: new SlashCommandBuilder()
        .setName('قائمة')
        .setDescription('📋 عرض قائمة التشغيل')
        .addIntegerOption(o => o.setName('صفحة').setDescription('رقم الصفحة').setRequired(false).setMinValue(1)),
      execute: handleQueue,
    },
    {
      data: new SlashCommandBuilder().setName('بوز').setDescription('⏸️ إيقاف مؤقت للأغنية'),
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
        .setName('صوت')
        .setDescription('🔊 اضبط مستوى الصوت')
        .addIntegerOption(o => o.setName('مستوى').setDescription('من 0 لـ 100').setRequired(true).setMinValue(0).setMaxValue(100)),
      execute: handleVolume,
    },
    {
      data: new SlashCommandBuilder().setName('تكرار').setDescription('🔁 بدّل وضع التكرار'),
      execute: handleRepeat,
    },
    {
      data: new SlashCommandBuilder().setName('خلط').setDescription('🔀 خلط ترتيب القائمة عشوائياً'),
      execute: handleShuffle,
    },
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
    {
      data: new SlashCommandBuilder().setName('كلمات').setDescription('📝 اعرض كلمات الأغنية الشغالة دلوقتي'),
      execute: handleLyrics,
    },
    {
      data: new SlashCommandBuilder()
        .setName('انتقل')
        .setDescription('⏱️ انتقل لوقت معين في الأغنية')
        .addStringOption(o => o.setName('وقت').setDescription('الوقت — مثال: 1:30 أو 90 (ثانية)').setRequired(true)),
      execute: handleSeek,
    },
    {
      data: new SlashCommandBuilder()
        .setName('فلتر')
        .setDescription('🎛️ تطبيق فلتر صوتي على الموسيقى')
        .addStringOption(o =>
          o.setName('نوع')
            .setDescription('نوع الفلتر')
            .setRequired(true)
            .addChoices(
              { name: '❌ إيقاف الفلاتر',   value: 'off' },
              { name: '🔊 باس بوست',         value: 'bassboost' },
              { name: '🌙 نايتكور',          value: 'nightcore' },
              { name: '🎧 8D صوت محيطي',     value: '8d' },
              { name: '🌊 فيبورويف',         value: 'vaporwave' },
              { name: '🎤 كاريوكي',          value: 'karaoke' },
            )
        ),
      execute: handleFilter,
    },
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

      await interaction.editReply({ embeds: [buildPlayEmbed(sp)] });

      const scTrack = (name) => `ytsearch:${name}`;

      if (sp.tracks.length === 1) {
        await distube.play(voiceChannel, scTrack(sp.tracks[0]), playOptions);
      } else {
        await distube.play(voiceChannel, scTrack(sp.tracks[0]), playOptions);
        ;(async () => {
          const q = distube.getQueue(interaction.guildId);
          if (q) q._batchLoading = true;
          for (let i = 1; i < sp.tracks.length; i++) {
            try { await distube.play(voiceChannel, scTrack(sp.tracks[i]), { ...playOptions }); } catch {}
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
      return;
    }

    if (sourceType === 'soundcloud') {
      await interaction.editReply({ content: '🔍 جاري التحميل من SoundCloud...' });
      await distube.play(voiceChannel, query, playOptions);
    } else if (sourceType === 'youtube') {
      await interaction.editReply({ content: '🔍 جاري التحميل...' });
      await distube.play(voiceChannel, query, playOptions);
    } else {
      await interaction.editReply({ content: '🔍 جاري البحث...' });
      await distube.play(voiceChannel, `ytsearch:${query}`, playOptions);
    }

    await interaction.editReply({ content: '✅ تم!' }).catch(() => {});

  } catch (e) {
    const errMsg = e?.message || String(e);
    console.error('❌ [Music] handlePlay:', errMsg);

    let msg;
    if (/private or unavailable|SPOTIFY_API_ERROR|embed page/i.test(errMsg)) {
      msg = [
        '⚠️ **مش قادر أحمّل البلاي ليست من Spotify!**',
        '',
        'سبوتيفاي بيحتاج مفاتيح مجانية عشان يشتغل. اعمل الخطوات دي:',
        '**١.** روح على: `developer.spotify.com/dashboard`',
        '**٢.** سجّل دخول وانشئ App جديدة (اسمها أي حاجة)',
        '**٣.** افتح الـ App وانسخ الـ Client ID والـ Client Secret',
        '**٤.** حطّهم في السيكريتس: `SPOTIFY_CLIENT_ID` و `SPOTIFY_CLIENT_SECRET`',
      ].join('\n');
    } else if (/private|blocked|age.?restricted/i.test(errMsg)) {
      msg = `🔒 الأغنية/البلاي ليست دي مش متاحة (private أو blocked)`;
    } else if (/no result|not found|مش لاقي/i.test(errMsg)) {
      msg = `❌ مش لاقي الأغنية دي! جرب اكتب اسم الأغنية مباشرة`;
    } else {
      msg = `❌ حصل خطأ: \`${errMsg.slice(0, 300)}\``;
    }

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

    skipVotes.delete(interaction.guildId);

    if (q.songs.length <= 1) {
      // آخر أغنية — وقّف بدل إيرور
      if (q.currentMessage) {
        await q.currentMessage.delete().catch(() => {});
        q.currentMessage = null;
      }
      await distube.stop(interaction.guildId).catch(() => {});
      destroyVoiceConnection(interaction.guildId);
      return interaction.reply({ content: '⏹️ دي آخر أغنية — اتوقفت الموسيقى!', ephemeral: true });
    }

    await distube.skip(interaction.guildId);
    await interaction.reply({ content: '⏭️ اتخطت الأغنية!', ephemeral: true });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleVoteSkip — تصويت لتخطي الأغنية ────────────────────
export async function handleVoteSkip(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) return interaction.reply({ content: '❌ لازم تكون في القناة الصوتية عشان تصوّت!', ephemeral: true });

    const humanCount = voiceChannel.members.filter(m => !m.user.bot).size;
    const needed = Math.ceil(humanCount / 2); // الأغلبية

    if (!skipVotes.has(interaction.guildId)) skipVotes.set(interaction.guildId, new Set());
    const votes = skipVotes.get(interaction.guildId);

    if (votes.has(interaction.user.id)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription(`🗳️ صوّتت بالفعل! (${votes.size}/${needed} صوت)`)],
        ephemeral: true,
      });
    }

    votes.add(interaction.user.id);

    if (votes.size >= needed) {
      skipVotes.delete(interaction.guildId);
      if (q.songs.length <= 1) {
        if (q.currentMessage) { await q.currentMessage.delete().catch(() => {}); q.currentMessage = null; }
        await distube.stop(interaction.guildId).catch(() => {});
        destroyVoiceConnection(interaction.guildId);
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ وصلت الأصوات لـ ${needed}/${humanCount} — اتوقفت الموسيقى!`)],
        });
      }
      await distube.skip(interaction.guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ وصلت الأصوات لـ ${needed}/${humanCount} — اتخطت الأغنية! ⏭️`)],
      });
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x66FCF1)
        .setTitle('🗳️ تصويت تخطي')
        .setDescription(`صوّت **${interaction.user.displayName}** للتخطي!\n\n**${votes.size}/${needed}** صوت مطلوب من **${humanCount}** مستخدم`)
        .setFooter({ text: 'استخدم /تصويت-تخطي للمشاركة' })],
    });
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

    skipVotes.delete(interaction.guildId);

    if (q) await distube.stop(interaction.guildId).catch(() => {});
    destroyVoiceConnection(interaction.guildId);

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

// ─── handleQueue — مع أزرار صفحات ─────────────────────────────
export async function handleQueue(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });

    // لو جه من زرار (صفحات)
    const isButton = interaction.isButton?.();
    if (isButton) await interaction.deferUpdate().catch(() => {});

    const q = distube.getQueue(interaction.guildId);
    if (!q || !q.songs.length) {
      const content = '❌ القائمة فاضية!';
      return isButton
        ? interaction.editReply({ content, components: [] }).catch(() => {})
        : interaction.reply({ content, ephemeral: true });
    }

    const perPage = 10;
    const totalPages = Math.max(1, Math.ceil(q.songs.length / perPage));

    let page = 1;
    if (isButton) {
      const match = interaction.customId.match(/music_queue_page_(\d+)/);
      if (match) page = parseInt(match[1], 10);
    } else {
      page = interaction.options?.getInteger('صفحة') || 1;
    }
    page = Math.max(1, Math.min(page, totalPages));

    const start = (page - 1) * perPage;
    const totalDuration = q.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
    const fmtTotal = `${Math.floor(totalDuration / 3600)}:${Math.floor((totalDuration % 3600) / 60).toString().padStart(2, '0')}:${(totalDuration % 60).toString().padStart(2, '0')}`;

    const lines = q.songs.slice(start, start + perPage).map((s, i) => {
      const idx = start + i;
      const min = Math.floor(s.duration / 60);
      const sec = (s.duration % 60).toString().padStart(2, '0');
      const requester = s.user ? ` • <@${s.user.id}>` : '';
      return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${s.name} \`${min}:${sec}\`${requester}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🎵 قائمة التشغيل')
      .setDescription(lines.join('\n'))
      .setColor(0x66FCF1)
      .addFields(
        { name: '🎵 الإجمالي', value: `${q.songs.length} أغنية`, inline: true },
        { name: '⏱️ المدة الكلية', value: fmtTotal, inline: true },
        { name: '🔊 الصوت', value: `${q.volume}%`, inline: true },
      )
      .setFooter({ text: `صفحة ${page}/${totalPages}` })
      .setTimestamp();

    // أزرار التنقل
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`music_queue_page_${Math.max(1, page - 1)}`)
        .setLabel('◀️ السابقة')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`music_queue_page_${Math.min(totalPages, page + 1)}`)
        .setLabel('▶️ التالية')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    );

    const payload = { embeds: [embed], components: totalPages > 1 ? [row] : [] };

    if (isButton) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload);
    }
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

    // شريط التقدم
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const progressBar = '▬'.repeat(filled) + '🔘' + '▬'.repeat(barLen - filled);

    // الفلاتر الشغالة
    const activeFilters = q.filters?.names?.join(', ') || 'لا يوجد';

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🎵 شغّال دلوقتي')
        .setDescription(`**${song.name}**\n\n${progressBar}`)
        .setThumbnail(song.thumbnail)
        .addFields(
          { name: '⏱️ الوقت', value: `\`${fmt(cur)} / ${fmt(tot)}\``, inline: true },
          { name: '🔊 الصوت', value: `\`${q.volume}%\``, inline: true },
          { name: '🔁 التكرار', value: `\`${repeatLabel}\``, inline: true },
          { name: '📊 التقدم', value: `\`${pct}%\``, inline: true },
          { name: '👤 طلبها', value: song.user ? `<@${song.user.id}>` : 'مجهول', inline: true },
          { name: '🎛️ الفلتر', value: `\`${activeFilters}\``, inline: true },
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
    const isButton = interaction.isButton?.();
    if (isButton) await interaction.deferUpdate().catch(() => {});

    if (!distube) {
      const msg = '❌ نظام الموسيقى مش شغال!';
      return isButton ? interaction.followUp({ content: msg, ephemeral: true }) : interaction.reply({ content: msg, ephemeral: true });
    }
    const q = distube.getQueue(interaction.guildId);
    if (!q) {
      const msg = '❌ مفيش موسيقى شغالة!';
      return isButton ? interaction.followUp({ content: msg, ephemeral: true }) : interaction.reply({ content: msg, ephemeral: true });
    }
    if (q.songs.length <= 1) {
      const msg = '❌ مفيش أغاني كفاية في القائمة عشان تتخلط!';
      return isButton ? interaction.followUp({ content: msg, ephemeral: true }) : interaction.reply({ content: msg, ephemeral: true });
    }

    const current = q.songs[0];
    const rest = q.songs.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    q.songs = [current, ...rest];

    const msg = {
      embeds: [new EmbedBuilder().setColor(0x9b59b6).setDescription(`🔀 اتخلطت القائمة! (${rest.length} أغنية)`)],
    };
    return isButton ? interaction.followUp({ ...msg, ephemeral: true }) : interaction.reply(msg);
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

// ─── handleSeek — انتقل لوقت معين في الأغنية ────────────────────
export async function handleSeek(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q || !q.songs[0]) return interaction.reply({ content: '❌ مفيش أغنية شغالة دلوقتي!', ephemeral: true });

    const timeStr = interaction.options.getString('وقت');
    let seconds = 0;

    if (timeStr.includes(':')) {
      const parts = timeStr.split(':').map(Number);
      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    } else {
      seconds = parseInt(timeStr, 10);
    }

    if (isNaN(seconds) || seconds < 0) {
      return interaction.reply({ content: '❌ الوقت مش صح! مثال: `1:30` أو `90`', ephemeral: true });
    }

    const total = q.songs[0].duration;
    if (seconds >= total) {
      return interaction.reply({ content: `❌ الوقت أكبر من مدة الأغنية (${Math.floor(total/60)}:${(total%60).toString().padStart(2,'0')})!`, ephemeral: true });
    }

    await distube.seek(interaction.guildId, seconds);

    const min = Math.floor(seconds / 60);
    const sec = (seconds % 60).toString().padStart(2, '0');
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x66FCF1)
        .setDescription(`⏱️ انتقلت للثانية **${min}:${sec}** في **${q.songs[0].name}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}

// ─── handleFilter — فلاتر الصوت ──────────────────────────────
export async function handleFilter(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    const filterKey = interaction.options.getString('نوع');
    const filterInfo = AVAILABLE_FILTERS[filterKey];
    if (!filterInfo) return interaction.reply({ content: '❌ الفلتر ده مش موجود!', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    try {
      if (filterKey === 'off') {
        await q.filters.clear();
      } else {
        await q.filters.clear();
        await q.filters.add(filterInfo.filters);
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setDescription(`🎛️ تم تطبيق الفلتر: **${filterInfo.name}**`)],
      });
    } catch (filterErr) {
      // لو DisTube مش بيدعم filters API، نبعت رسالة توضيحية
      console.warn('⚠️ [Music] فشل تطبيق الفلتر:', filterErr.message);
      await interaction.editReply({
        content: '⚠️ الفلاتر مش متاحة دلوقتي — محتاج إعداد إضافي من الأونر',
      });
    }
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
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

    const idx = parseInt(interaction.values[0], 10);
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
