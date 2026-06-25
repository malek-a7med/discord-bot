// ════════════════════════════════════════════════════════════════
//  نظام الموسيقى — بوت زنجي
//  مبني على DisTube + Wick Player، منسوب لـ 𝒎𝒂𝒍𝒆𝒌
// ════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SoundCloudPlugin } from '@distube/soundcloud';
import { SpotifyPlugin } from '@distube/spotify';
import { sendMusicCard } from '../helpers/music-card.js';

// كشف نوع الرابط
function detectSourceType(query) {
  if (/open\.spotify\.com/i.test(query)) return 'spotify';
  if (/youtube\.com|youtu\.be/i.test(query)) return 'youtube';
  if (/soundcloud\.com/i.test(query)) return 'soundcloud';
  return 'text';
}

// نسخة واحدة من DisTube بيتم ربطها بالكلاينت عند init
let distube = null;

// ─── تهيئة DisTube على الكلاينت ───────────────────────────────
export function initMusicSystem(client) {
  if (distube) return distube;

  distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    plugins: [
      new SpotifyPlugin(),
      new SoundCloudPlugin(),
      new YtDlpPlugin({ update: false }),
    ],
  });

  // Map لتتبع وقت الإيقاف التلقائي لكشف انتهاء الصلاحية
  const pausedAt = new Map(); // guildId → Date.now()
  const STREAM_MAX_AGE = 2 * 60 * 60 * 1000; // ساعتين

  // لما حد يدخل/يخرج من القناة الصوتية
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const q = distube.getQueue(newState.guild.id || oldState.guild.id);
      if (!q) return;

      const botVoiceChannel = q.voice?.channel;
      if (!botVoiceChannel) return;

      // حساب عدد الناس في القناة (غير البوت)
      const humanListeners = botVoiceChannel.members.filter(m => !m.user.bot).size;

      if (humanListeners === 0) {
        // القناة فاضية — وقف تلقائي
        if (!q.paused) {
          q.pause();
          pausedAt.set(q.id, Date.now());
          const ch = q.textChannel;
          if (ch?.send) ch.send({
            embeds: [new EmbedBuilder()
              .setColor(0xf39c12)
              .setDescription('⏸️ القناة الصوتية فاضية — الموسيقى اتوقفت تلقائياً\nلما حد يرجع هتكمل! 👂')],
          }).catch(() => {});
        }
      } else {
        // في ناس في القناة — استأنف لو كان موقوف تلقائياً
        if (q.paused && pausedAt.has(q.id)) {
          const pausedTime = Date.now() - pausedAt.get(q.id);
          pausedAt.delete(q.id);

          if (pausedTime > STREAM_MAX_AGE) {
            // الستريم انتهت صلاحيته — تخطى للأغنية التالية
            const ch = q.textChannel;
            if (ch?.send) ch.send({
              embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setDescription('⏭️ الأغنية موقوفة من أكتر من ساعتين — الرابط انتهت صلاحيته، بتخطى للتالية!')],
            }).catch(() => {});
            if (q.songs.length > 1) {
              await distube.skip(q.id).catch(() => {});
            } else {
              await distube.stop(q.id).catch(() => {});
            }
          } else {
            q.resume();
            const ch = q.textChannel;
            if (ch?.send) ch.send({
              embeds: [new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription('▶️ حد رجع! بكمل الموسيقى 🎵')],
            }).catch(() => {});
          }
        }
      }
    } catch {}
  });

  // ── أحداث DisTube ──────────────────────────────────────────
  distube.on('playSong', async (queue, song) => {
    try {
      // حذف الرسالة السابقة لو موجودة
      if (queue.currentMessage) {
        await queue.currentMessage.delete().catch(() => {});
        queue.currentMessage = null;
      }
      const ch = queue.textChannel;
      if (ch) await sendMusicCard(queue, song, ch);
    } catch (e) {
      console.error('❌ [Music] playSong خطأ:', e.message);
    }
  });

  distube.on('addSong', (queue, song) => {
    try {
      const ch = queue.textChannel;
      if (!ch?.send) return;
      const min = Math.floor(song.duration / 60);
      const sec = (song.duration % 60).toString().padStart(2, '0');
      ch.send({
        embeds: [new EmbedBuilder()
          .setColor(0x66FCF1)
          .setDescription(`✅ أُضيفت للقائمة: **${song.name}** \`${min}:${sec}\``)],
      }).catch(() => {});
    } catch {}
  });

  distube.on('addList', (queue, playlist) => {
    try {
      const ch = queue.textChannel;
      if (!ch?.send) return;
      ch.send({
        embeds: [new EmbedBuilder()
          .setColor(0x66FCF1)
          .setDescription(`📋 أُضيفت بلاي ليست **${playlist.name}** — ${playlist.songs.length} أغنية`)],
      }).catch(() => {});
    } catch {}
  });

  distube.on('finish', (queue) => {
    try {
      const ch = queue.textChannel;
      if (ch?.send) ch.send('🏁 خلصت القائمة!').catch(() => {});
    } catch {}
  });

  distube.on('empty', (queue) => {
    // تم التعامل مع الحدة دا في voiceStateUpdate (وقف تلقائي بدل الخروج)
  });

  distube.on('error', (error, queue) => {
    console.error('❌ [DisTube]', error?.message || error);
    try {
      const ch = queue?.textChannel;
      if (ch?.send) ch.send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`⛔ حصل خطأ: ${String(error).slice(0, 500)}`)],
      }).catch(() => {});
    } catch {}
  });

  distube.on('searchNoResult', (message, query) => {
    message?.channel?.send(`⛔ مفيش نتايج لـ \`${query}\``).catch(() => {});
  });

  console.log('✅ [Music] DisTube جاهز!');
  return distube;
}

// ─── musicHandler — للتوافق مع أوامر النص في index.js ──────────
export const musicHandler = {
  // store pending vc per guild for prefix commands
  _pending: {},

  getDistube() { return distube; },

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
    await distube.play(p.voiceChannel, song.query, {
      textChannel: p.textChannel,
      member: p.voiceChannel.guild.members.cache.get(p.voiceChannel.guild.me?.id || ''),
    });
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

  getQueueSize(guildId) {
    if (!distube) return 0;
    return distube.getQueue(guildId)?.songs?.length || 0;
  },

  getQueueDisplay(guildId, page = 1) {
    if (!distube) return '❌ نظام الموسيقى مش شغال!';
    const q = distube.getQueue(guildId);
    if (!q || !q.songs.length) return '❌ القائمة فاضية!';
    const perPage = 10;
    const start = (page - 1) * perPage;
    const lines = q.songs.slice(start, start + perPage).map((s, i) => {
      const idx = start + i;
      const min = Math.floor(s.duration / 60);
      const sec = (s.duration % 60).toString().padStart(2, '0');
      return `${idx === 0 ? '🔊' : `${idx}.`} ${s.name} [${min}:${sec}]`;
    });
    return lines.join('\n') || '❌ مفيش أغاني في الصفحة دي!';
  },

  setVolume(guildId, vol) {
    if (!distube) return;
    const pct = Math.round(Math.max(0, Math.min(1, vol)) * 100);
    distube.setVolume(guildId, pct);
    return pct;
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
    { data: new SlashCommandBuilder().setName('شغل').setDescription('🎵 شغّل أغنية من YouTube أو SoundCloud').addStringOption(o => o.setName('اغنية').setDescription('اسم الأغنية أو رابطها').setRequired(true)), execute: handlePlay },
    { data: new SlashCommandBuilder().setName('تخطي').setDescription('⏭️ تخطي الأغنية الحالية'), execute: handleSkip },
    { data: new SlashCommandBuilder().setName('وقف').setDescription('⏹️ إيقاف الموسيقى والخروج من القناة'), execute: handleStop },
    { data: new SlashCommandBuilder().setName('قائمة').setDescription('📋 عرض قائمة التشغيل').addIntegerOption(o => o.setName('صفحة').setDescription('رقم الصفحة').setRequired(false).setMinValue(1)), execute: handleQueue },
    { data: new SlashCommandBuilder().setName('بوز').setDescription('⏸️ إيقاف مؤقت للأغنية'), execute: handlePause },
    { data: new SlashCommandBuilder().setName('كمل').setDescription('▶️ استئناف التشغيل'), execute: handleResume },
    { data: new SlashCommandBuilder().setName('شغال-ايه').setDescription('🎶 اعرض الأغنية الشغالة دلوقتي'), execute: handleNowPlaying },
    { data: new SlashCommandBuilder().setName('صوت').setDescription('🔊 اضبط مستوى الصوت').addIntegerOption(o => o.setName('مستوى').setDescription('من 0 لـ 100').setRequired(true).setMinValue(0).setMaxValue(100)), execute: handleVolume },
    { data: new SlashCommandBuilder().setName('تكرار').setDescription('🔁 بدّل وضع التكرار (إيقاف / أغنية / قائمة)'), execute: handleRepeat },
    { data: new SlashCommandBuilder().setName('خلط').setDescription('🔀 خلط ترتيب القائمة عشوائياً'), execute: handleShuffle },
    { data: new SlashCommandBuilder().setName('تخطى-لـ').setDescription('⏩ تخطى لأغنية معينة في القائمة').addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية في القائمة').setRequired(true).setMinValue(1)), execute: handleJump },
    { data: new SlashCommandBuilder().setName('احذف').setDescription('🗑️ احذف أغنية من القائمة').addIntegerOption(o => o.setName('رقم').setDescription('رقم الأغنية (مش الشغالة دلوقتي)').setRequired(true).setMinValue(2)), execute: handleRemove },
  ];
}

// ─── handlePlay ────────────────────────────────────────────────
export async function handlePlay(interaction) {
  try {
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال! كلم الأونر.', ephemeral: true });

    const query = interaction.options?.getString('اغنية') || interaction.options?.getString('query');
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) return interaction.reply({ content: '❌ لازم تكون في قناة صوتية الأول!', ephemeral: true });
    if (!query) return interaction.reply({ content: '❌ اكتب اسم الأغنية أو رابطها!', ephemeral: true });

    await interaction.deferReply();

    const sourceType = detectSourceType(query);

    // رسالة الانتظار حسب نوع المصدر
    const loadingMsgs = {
      spotify:    '🎵 جاري التحميل من Spotify...',
      youtube:    '▶️ جاري التحميل من YouTube...',
      soundcloud: '🔊 جاري التحميل من SoundCloud...',
      text:       '🔍 جاري البحث...',
    };
    await interaction.editReply({ content: loadingMsgs[sourceType] });

    // محاولة التشغيل مع fallback للبحث النصي
    const playOptions = { textChannel: interaction.channel, member: interaction.member };

    if (sourceType !== 'text') {
      // رابط مباشر — شغّله مباشرة
      await distube.play(voiceChannel, query, playOptions);
    } else {
      // بحث نصي — حاول YouTube أولاً ثم SoundCloud
      let played = false;

      // محاولة YouTube
      try {
        await distube.play(voiceChannel, query, { ...playOptions, searchSources: ['youtube'] });
        played = true;
      } catch (ytErr) {
        console.warn('⚠️ [Music] YouTube فشل، بيجرب SoundCloud...', ytErr.message);
      }

      // fallback إلى SoundCloud
      if (!played) {
        try {
          await distube.play(voiceChannel, `scsearch:${query}`, { ...playOptions });
          played = true;
        } catch (scErr) {
          console.warn('⚠️ [Music] SoundCloud فشل:', scErr.message);
        }
      }

      if (!played) {
        return interaction.editReply({
          content: `❌ مش لاقي الأغنية دي!\n💡 جرب ترفق رابط مباشر من:\n🎵 Spotify: \`open.spotify.com\`\n▶️ YouTube: \`youtube.com\`\n🔊 SoundCloud: \`soundcloud.com\``,
        });
      }
    }

    // لو الرد مش اتعدّل بعد التشغيل، نخليه يختفي
    await interaction.editReply({ content: `✅ تم!` }).catch(() => {});
  } catch (e) {
    console.error('❌ [Music] handlePlay:', e.message);
    const isNotFound = /no result|not found|unavailable|private|blocked/i.test(e.message);
    const msg = isNotFound
      ? `❌ مش لاقي الأغنية دي!\n💡 جرب ترفق رابط مباشر من Spotify أو YouTube أو SoundCloud`
      : `❌ ${e.message || 'حصل خطأ!'}`;
    try { await interaction.editReply({ content: msg }); } catch { await interaction.reply({ content: msg, ephemeral: true }).catch(() => {}); }
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
    if (!distube) return interaction.reply({ content: '❌ نظام الموسيقى مش شغال!', ephemeral: true });
    const q = distube.getQueue(interaction.guildId);
    if (!q) return interaction.reply({ content: '❌ مفيش موسيقى شغالة!', ephemeral: true });

    // لو الأمر جاي من زر الداش بورد — نمسح الرسالة نفسها
    const isButton = interaction.isButton?.();
    if (isButton) {
      await interaction.message?.delete().catch(() => {});
    }

    // مسح رسالة الداش بورد المخزنة على القائمة (لو مش نفس الرسالة)
    if (q.currentMessage && q.currentMessage.id !== interaction.message?.id) {
      await q.currentMessage.delete().catch(() => {});
    }
    q.currentMessage = null;

    await distube.stop(interaction.guildId);

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

    const embed = new EmbedBuilder()
      .setTitle('🎵 قائمة التشغيل')
      .setDescription(lines.join('\n'))
      .setColor(0x66FCF1)
      .setFooter({ text: `🔊 ${q.volume}% | ${q.songs.length} أغنية في المجموع | صفحة ${page}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
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
    const min = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
    const repeatLabel = q.repeatMode === 0 ? '❌ إيقاف' : q.repeatMode === 1 ? '🔂 أغنية' : '🔁 قائمة';

    const embed = new EmbedBuilder()
      .setTitle('🎵 شغّال دلوقتي')
      .setDescription(`**${song.name}**`)
      .setThumbnail(song.thumbnail)
      .addFields(
        { name: '⏱️ الوقت', value: `\`${min(cur)} / ${min(tot)}\``, inline: true },
        { name: '🔊 الصوت', value: `\`${q.volume}%\``, inline: true },
        { name: '🔁 التكرار', value: `\`${repeatLabel}\``, inline: true },
        { name: '📊 التقدم', value: `\`${pct}%\``, inline: true },
        { name: '👤 طلبها', value: song.user ? `<@${song.user.id}>` : 'مجهول', inline: true },
      )
      .setColor(0x66FCF1)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
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

    // خلط كل الأغاني ما عدا الأغنية الشغالة حالياً (أول عنصر)
    const current = q.songs[0];
    const rest = q.songs.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    q.songs = [current, ...rest];

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setDescription(`🔀 اتخلطت القائمة! (${rest.length} أغنية)`)],
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
    if (num < 1 || num > q.songs.length) {
      return interaction.reply({ content: `❌ الرقم لازم يكون بين 1 و${q.songs.length}!`, ephemeral: true });
    }
    if (num === 1) return interaction.reply({ content: '⏩ الأغنية دي شغالة أصلاً!', ephemeral: true });

    const targetSong = q.songs[num - 1];
    await distube.jump(interaction.guildId, num - 1);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x66FCF1)
        .setDescription(`⏩ بتخطى لـ **${targetSong.name}**`)],
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
    if (num > q.songs.length) return interaction.reply({ content: `❌ مفيش رقم ${num} في القائمة! القائمة فيها ${q.songs.length} أغنية بس.`, ephemeral: true });

    const removed = q.songs.splice(num - 1, 1)[0];
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(`🗑️ اتشالت من القائمة: **${removed.name}**`)],
    });
  } catch (e) {
    await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(() => {});
  }
}
