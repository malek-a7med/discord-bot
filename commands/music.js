// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي
//  @discordjs/voice + play-dl | بدون Lavalink
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
  getVoiceConnection,
} from '@discordjs/voice';
import playdl from 'play-dl';
import { sendMusicCard } from '../helpers/music-card.js';

// ─── Map: guildId → GuildPlayer ───────────────────────────────
const players = new Map();

// ─── فورمات الوقت ─────────────────────────────────────────────
function fmt(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}

// ─── GuildPlayer: فئة لإدارة قائمة تشغيل الـ guild ────────────
class GuildPlayer {
  constructor(guildId, voiceChannel, textChannel) {
    this.guildId      = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel  = textChannel;
    this.queue        = [];          // [{ title, url, duration, thumbnail, author, requester }]
    this.current      = null;
    this.volume       = 80;
    this.repeatMode   = 0;           // 0=off 1=song 2=queue
    this.paused       = false;
    this.destroyed    = false;
    this.currentMessage = null;
    this._startedAt   = 0;
    this._pausedAt    = 0;
    this._skipVotes   = new Set();

    this.player = createAudioPlayer();
    this._setupPlayerEvents();

    this.connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf:       true,
    });
    this.connection.subscribe(this.player);
    this._setupConnectionEvents();
  }

  _setupConnectionEvents() {
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling,  5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting,  5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  _setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.destroyed) return;
      this._onTrackEnd();
    });
    this.player.on('error', (err) => {
      console.error(`❌ [Music] خطأ في التشغيل: ${err.message}`);
      this.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c)
          .setDescription(`❌ خطأ في التشغيل: **${this.current?.title || 'أغنية'}** — ${err.message.slice(0,150)}`)],
      }).catch(() => {});
      this._onTrackEnd();
    });
  }

  async _onTrackEnd() {
    if (this.repeatMode === 1 && this.current) {
      // تكرار الأغنية الحالية
    } else if (this.repeatMode === 2 && this.current) {
      this.queue.push(this.current);
      this.current = this.queue.shift();
    } else {
      this.current = this.queue.shift() || null;
    }

    if (this.current) {
      await this._playTrack(this.current);
    } else {
      this.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0x66FCF1)
          .setDescription('🏁 خلصت القائمة! في خير يا جدعان 👋')],
      }).catch(() => {});
      setTimeout(() => { if (!this.current) this.destroy(); }, 30_000);
    }
  }

  async _playTrack(track) {
    try {
      this._skipVotes.clear();
      this._startedAt = Date.now();
      this._pausedAt  = 0;

      const stream = await playdl.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume / 100);

      this.player.play(resource);
      this.paused = false;
      this.currentMessage?.delete().catch(() => {});
      this.currentMessage = null;

      const song = this._trackToSong(track);
      const qProxy = this._queueProxy();
      if (this.textChannel) await sendMusicCard(qProxy, song, this.textChannel);
    } catch (err) {
      console.error(`❌ [Music] _playTrack: ${err.message}`);
      this.textChannel?.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c)
          .setDescription(`❌ مش قادر يشغّل: **${track.title}**\n${err.message.slice(0,150)}`)],
      }).catch(() => {});
      this.current = this.queue.shift() || null;
      if (this.current) await this._playTrack(this.current);
    }
  }

  _trackToSong(track) {
    return {
      name:              track.title,
      title:             track.title,
      thumbnail:         track.thumbnail || null,
      duration:          Math.floor((track.duration || 0) / 1000),
      formattedDuration: fmt(track.duration),
      uploader:          { name: track.author || '' },
      user:              track.requester || null,
      url:               track.url,
    };
  }

  _queueProxy() {
    const self = this;
    return {
      get songs()         { return self.current ? [self._trackToSong(self.current), ...self.queue.map(t => self._trackToSong(t))] : []; },
      get volume()        { return self.volume; },
      get repeatMode()    { return self.repeatMode; },
      get paused()        { return self.paused; },
      get destroyed()     { return self.destroyed; },
      get currentTime()   {
        if (self.paused) return Math.floor((self._pausedAt - self._startedAt) / 1000);
        return Math.floor((Date.now() - self._startedAt) / 1000);
      },
      get currentMessage()  { return self.currentMessage; },
      set currentMessage(v) { self.currentMessage = v; },
      get initiatorId()   { return self.current?.requester?.id; },
      set initiatorId(v)  {},
      get textChannel()   { return self.textChannel; },
      get id()            { return self.guildId; },
    };
  }

  async addTrack(track, playNow = false) {
    if (!this.current || playNow) {
      if (playNow && this.current) this.queue.unshift(track);
      else { this.current = track; }
      await this._playTrack(this.current);
    } else {
      this.queue.push(track);
    }
  }

  async addPlaylist(tracks) {
    if (!tracks.length) return;
    if (!this.current) {
      this.current = tracks[0];
      this.queue.push(...tracks.slice(1));
      await this._playTrack(this.current);
    } else {
      this.queue.push(...tracks);
    }
  }

  skip() {
    this.player.stop(true);
  }

  stop() {
    this.destroyed = true;
    this.queue     = [];
    this.current   = null;
    this.player.stop(true);
    this.currentMessage?.delete().catch(() => {});
    this.connection?.destroy();
    players.delete(this.guildId);
  }

  destroy() {
    if (this.destroyed) return;
    this.stop();
  }

  pause() {
    if (this.paused) return;
    this._pausedAt = Date.now();
    this.player.pause();
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    if (this._pausedAt) this._startedAt += Date.now() - this._pausedAt;
    this.player.unpause();
    this.paused = false;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(100, v));
    const res = this.player.state?.resource;
    res?.volume?.setVolume(this.volume / 100);
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  jump(index) {
    if (index < 1 || index > this.queue.length) throw new Error('رقم خارج النطاق!');
    this.queue.splice(0, index - 1);
    this.player.stop(true);
  }

  remove(index) {
    if (index < 1 || index > this.queue.length) throw new Error('رقم خارج النطاق!');
    return this.queue.splice(index - 1, 1)[0];
  }

  setRepeat(mode) { this.repeatMode = mode; }

  getCurrentTime() {
    if (this.paused) return Math.floor((this._pausedAt - this._startedAt) / 1000);
    return Math.floor((Date.now() - this._startedAt) / 1000);
  }
}

// ─── دوال مساعدة ──────────────────────────────────────────────
function getPlayer(guildId) { return players.get(guildId) || null; }

async function search(query) {
  const isUrl = /^https?:\/\//i.test(query);
  if (isUrl) {
    const type = await playdl.validate(query);
    if (type === 'yt_playlist') {
      const pl = await playdl.playlist_info(query, { incomplete: true });
      const vids = await pl.all_videos();
      return {
        type: 'playlist',
        name: pl.title,
        tracks: vids.map(v => ({
          title:     v.title,
          url:       v.url,
          duration:  v.durationInSec * 1000,
          thumbnail: v.thumbnails?.[0]?.url || null,
          author:    v.channel?.name || '',
        })),
      };
    }
    if (type === 'yt_video') {
      const [info] = await playdl.video_info(query);
      const d = info.video_details;
      return {
        type: 'track',
        tracks: [{
          title:     d.title,
          url:       d.url,
          duration:  d.durationInSec * 1000,
          thumbnail: d.thumbnails?.[0]?.url || null,
          author:    d.channel?.name || '',
        }],
      };
    }
  }
  // بحث نصي
  const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
  if (!results.length) throw new Error(`مش لاقي "${query.slice(0,60)}" — جرّب اسم تاني`);
  const v = results[0];
  return {
    type: 'track',
    tracks: [{
      title:     v.title,
      url:       v.url,
      duration:  v.durationInSec * 1000,
      thumbnail: v.thumbnails?.[0]?.url || null,
      author:    v.channel?.name || '',
    }],
  };
}

// ─── تسجيل الأوامر ────────────────────────────────────────────
export function registerMusicCommands() {
  return [
    {
      data: new SlashCommandBuilder()
        .setName('شغل').setDescription('🎵 شغّل أغنية أو رابط يوتيوب')
        .addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو رابط يوتيوب').setRequired(true)),
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
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية في القائمة').setRequired(true).setMinValue(1)),
      execute: handleRemove,
    },
    {
      data: new SlashCommandBuilder().setName('كلمات').setDescription('📝 اعرض كلمات الأغنية الشغالة'),
      execute: handleLyrics,
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

// دوال dummy للـ exports القديمة من index.js
export async function initMusicSystem(client) {
  console.log('✅ [Music] النظام جاهز (play-dl + @discordjs/voice)');
}

export const musicHandler = {
  getPlayer,

  getQueue(guildId) {
    const p = getPlayer(guildId);
    if (!p?.current) return null;
    return {
      currentSong: { title: p.current.title, artist: p.current.author, thumbnail: p.current.thumbnail },
      songs: p._queueProxy().songs,
      volume: p.volume,
    };
  },

  async joinVoiceChannelAndPlay(guildId, voiceChannel, textChannel) {
    let p = getPlayer(guildId);
    if (!p) {
      p = new GuildPlayer(guildId, voiceChannel, textChannel);
      players.set(guildId, p);
    }
    return p;
  },

  async resolveSource(query, requesterTag) {
    const result = await search(query);
    return result.tracks;
  },

  async addToQueue(guildId, track) {
    const p = getPlayer(guildId);
    if (!p) throw new Error('البوت مش في قناة صوتية!');
    await p.addTrack(track);
  },

  async skip(guildId) {
    const p = getPlayer(guildId);
    if (!p?.current) throw new Error('مفيش أغنية شغالة!');
    p.skip();
  },

  async stop(guildId) {
    const p = getPlayer(guildId);
    if (p) p.stop();
  },

  async pause(guildId) {
    const p = getPlayer(guildId);
    if (!p?.current) throw new Error('مفيش أغنية شغالة!');
    p.pause();
  },

  async resume(guildId) {
    const p = getPlayer(guildId);
    if (!p?.current) throw new Error('مفيش أغنية شغالة!');
    p.resume();
  },

  setVolume(guildId, fraction) {
    const p = getPlayer(guildId);
    if (!p) throw new Error('مفيش موسيقى!');
    p.setVolume(Math.round(fraction * 100));
  },

  getQueueDisplay(guildId, page = 1) {
    const p = getPlayer(guildId);
    if (!p?.current) return '❌ القائمة فاضية!';
    const all     = [p.current, ...p.queue];
    const perPage = 10;
    const start   = (page - 1) * perPage;
    return all.slice(start, start + perPage).map((t, i) => {
      const idx = start + i;
      const dur = fmt(t.duration);
      return `${idx === 0 ? '🔊 شغّال:' : `${idx}.`} ${t.title.slice(0,60)} [${dur}]`;
    }).join('\n');
  },
};
export async function handleQueueJump(interaction) {
  return interaction?.reply?.({ content: '⚠️ الأمر ده مش متاح دلوقتي', ephemeral: true });
}
export async function handlePrevious(interaction) {
  return interaction?.reply?.({ content: '⚠️ الأمر ده مش متاح دلوقتي', ephemeral: true });
}
export async function handleSeek(interaction) {
  return interaction?.reply?.({ content: '⚠️ الأمر ده مش متاح دلوقتي', ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  معالجات الأوامر
// ══════════════════════════════════════════════════════════════

// ─── /شغل ─────────────────────────────────────────────────────
export async function handlePlay(interaction) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel)
    return interaction.reply({ content: '❌ لازم تكون في قناة صوتية الأول!', ephemeral: true });

  const query = (interaction.options?.getString('اغنية') || '').trim();
  if (!query)
    return interaction.reply({ content: '❌ اكتب اسم الأغنية أو رابطها!', ephemeral: true });

  await interaction.deferReply();

  try {
    const result = await search(query);
    const tracks = result.tracks.map(t => ({ ...t, requester: interaction.user }));

    let p = getPlayer(interaction.guildId);
    if (!p) {
      p = new GuildPlayer(interaction.guildId, voiceChannel, interaction.channel);
      players.set(interaction.guildId, p);
    }

    if (result.type === 'playlist') {
      await p.addPlaylist(tracks);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x66FCF1)
          .setDescription(`📋 أُضيفت بلاي ليست **${result.name}** — **${tracks.length} أغنية**`)],
      });
    } else {
      const track = tracks[0];
      const wasEmpty = !p.current;
      await p.addTrack(track);
      if (!wasEmpty) {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x66FCF1)
            .setDescription(`✅ أُضيفت للقائمة: **${track.title}** \`${fmt(track.duration)}\``)],
        });
      } else {
        await interaction.editReply({ content: '▶️ بدأ التشغيل!' }).catch(() => {});
      }
    }
  } catch (e) {
    await interaction.editReply({ content: `❌ ${e.message}` });
  }
}

// ─── /تخطي ────────────────────────────────────────────────────
export async function handleSkip(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
  p.skip();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription('⏭️ تم التخطي!')] });
}

// ─── /وقف ─────────────────────────────────────────────────────
export async function handleStop(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
  p.stop();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('⏹️ تم الوقف والخروج من القناة!')] });
}

// ─── /قائمة ───────────────────────────────────────────────────
export async function handleQueue(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });

  const page    = (interaction.options?.getInteger('صفحة') || 1);
  const perPage = 10;
  const all     = [p.current, ...p.queue];
  const total   = all.length;
  const pages   = Math.ceil(total / perPage);
  const start   = (page - 1) * perPage;
  const slice   = all.slice(start, start + perPage);

  const lines = slice.map((t, i) => {
    const idx = start + i;
    const dur = fmt(t.duration);
    return `${idx === 0 ? '🔊 **شغّال:**' : `**${idx}.**`} ${t.title.slice(0,60)} \`${dur}\``;
  });

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x66FCF1)
      .setTitle(`📋 قائمة التشغيل — ${total} أغنية`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `صفحة ${page}/${pages}` })],
  });
}

// ─── /بوز ─────────────────────────────────────────────────────
export async function handlePause(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
  if (p.paused)    return interaction.reply({ content: '❌ الأغنية واقفة أصلاً!', ephemeral: true });
  p.pause();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⏸️ تم الإيقاف المؤقت!')] });
}

// ─── /كمل ─────────────────────────────────────────────────────
export async function handleResume(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
  if (!p.paused)   return interaction.reply({ content: '❌ الأغنية شغالة أصلاً!', ephemeral: true });
  p.resume();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('▶️ استُؤنف التشغيل!')] });
}

// ─── /شغال-ايه ────────────────────────────────────────────────
export async function handleNowPlaying(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });

  const t        = p.current;
  const cur      = p.getCurrentTime();
  const total    = Math.floor((t.duration || 0) / 1000);
  const barLen   = 20;
  const filled   = total > 0 ? Math.round((cur / total) * barLen) : 0;
  const bar      = '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(0, barLen - filled));

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x66FCF1)
      .setAuthor({ name: '🎵 شغّال دلوقتي' })
      .setTitle(t.title.slice(0, 256))
      .setURL(t.url)
      .setThumbnail(t.thumbnail || null)
      .setDescription(`${bar}\n\`${fmt(cur * 1000)} / ${fmt(t.duration)}\``)
      .addFields(
        { name: '🎤 الفنان',  value: t.author   || 'مجهول', inline: true },
        { name: '👑 طلبها',   value: t.requester?.username || 'مجهول', inline: true },
        { name: '🔊 الصوت',   value: `${p.volume}%`, inline: true },
      )],
  });
}

// ─── /صوت ─────────────────────────────────────────────────────
export async function handleVolume(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
  const v = interaction.options.getInteger('مستوى');
  p.setVolume(v);
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🔊 تم ضبط الصوت على **${v}%**`)] });
}

// ─── /تكرار ───────────────────────────────────────────────────
export async function handleRepeat(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });
  const next   = (p.repeatMode + 1) % 3;
  const labels = ['❌ التكرار إيقاف', '🔂 تكرار الأغنية', '🔁 تكرار القائمة'];
  p.setRepeat(next);
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(labels[next])] });
}

// ─── /خلط ─────────────────────────────────────────────────────
export async function handleShuffle(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p || p.queue.length < 2) return interaction.reply({ content: '❌ مفيش أغاني كفاية للخلط!', ephemeral: true });
  p.shuffle();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🔀 تم خلط **${p.queue.length}** أغنية!`)] });
}

// ─── /تخطى-لـ ─────────────────────────────────────────────────
export async function handleJump(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
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
  if (!p || p.queue.length === 0) return interaction.reply({ content: '❌ القائمة فاضية!', ephemeral: true });
  const n = interaction.options.getInteger('رقم');
  try {
    const removed = p.remove(n);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🗑️ تم حذف: **${removed?.title || 'الأغنية'}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
  }
}

// ─── /كلمات ───────────────────────────────────────────────────
export async function handleLyrics(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x66FCF1)
      .setDescription(`🔍 جارٍ البحث عن كلمات **${p.current.title}**...\n*(الميزة دي هتتضاف قريباً)*`)],
  });
}

// ─── /فلتر ────────────────────────────────────────────────────
export async function handleFilter(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });
  const type = interaction.options.getString('نوع');
  const names = { off: '❌ إيقاف الفلاتر', bassboost: '🔊 باس بوست', nightcore: '🌙 نايتكور', '8d': '🎧 8D', vaporwave: '🌊 فيبورويف', karaoke: '🎤 كاريوكي' };
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x66FCF1).setDescription(`🎛️ الفلتر: **${names[type] || type}**\n*(الفلاتر متوفرة مع Lavalink فقط)*`)],
  });
}

// ─── /تصويت-تخطي ──────────────────────────────────────────────
export async function handleVoteSkip(interaction) {
  const p = getPlayer(interaction.guildId);
  if (!p?.current) return interaction.reply({ content: '❌ مفيش أغنية شغالة!', ephemeral: true });

  const vc      = interaction.member?.voice?.channel;
  const members = vc ? vc.members.filter(m => !m.user.bot).size : 1;
  const needed  = Math.ceil(members / 2);

  p._skipVotes.add(interaction.user.id);

  if (p._skipVotes.size >= needed) {
    p.skip();
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71)
        .setDescription(`✅ التصويت نجح (${p._skipVotes.size}/${needed}) — تم التخطي!`)],
    });
  } else {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x66FCF1)
        .setDescription(`🗳️ صوّت للتخطي: **${p._skipVotes.size}/${needed}** صوت`)],
    });
  }
}
