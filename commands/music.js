import MusicHandler from '../helpers/music-handler.js';
import { EmbedBuilder } from 'discord.js';

const musicHandler = new MusicHandler();

async function registerMusicCommands(client) {
  const { SlashCommandBuilder } = await import('discord.js');

  return [
    {
      data: new SlashCommandBuilder()
        .setName('شغل-اغنية')
        .setDescription('شغل أغنية من YouTube أو Spotify 🎵')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('اسم الأغنية أو الرابط')
            .setRequired(true)
        ),
      execute: handlePlay
    },
    {
      data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('تخطي الأغنية الحالية'),
      execute: handleSkip
    },
    {
      data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('توقف التشغيل واتركني من القناة الصوتية'),
      execute: handleStop
    },
    {
      data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('اعرض قائمة التشغيل')
        .addIntegerOption((option) =>
          option
            .setName('page')
            .setDescription('رقم الصفحة')
            .setRequired(false)
            .setMinValue(1)
        ),
      execute: handleQueue
    },
    {
      data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('وقف الأغنية الحالية مؤقتاً'),
      execute: handlePause
    },
    {
      data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('استئناف التشغيل'),
      execute: handleResume
    },
    {
      data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('اعرض الأغنية الحالية'),
      execute: handleNowPlaying
    },
    {
      data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('غير مستوى الصوت')
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('مستوى الصوت (0-100)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        ),
      execute: handleVolume
    }
  ];
}

async function handlePlay(interaction) {
  try {
    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return await interaction.reply({
        content: '❌ لازم تكون في قناة صوتية الأول!',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    await musicHandler.joinVoiceChannelAndPlay(
      interaction.guildId,
      voiceChannel,
      interaction.channel
    );

    const results = await musicHandler.resolveSource(query, interaction.user.tag);

    let totalAdded = 0;
    for (const song of results) {
      try {
        await musicHandler.addToQueue(interaction.guildId, song);
        totalAdded++;
      } catch (err) {
        if (!err.message?.includes('موجودة بالفعل')) {
          console.warn('⚠️ تعذر إضافة أغنية:', err.message);
        }
      }
    }

    if (totalAdded === 0) {
      return await interaction.editReply({ content: '❌ ما قدرتش أضيف أي أغنية للقائمة!' });
    }

    const isPlaylist = results.length > 1;
    const embed = new EmbedBuilder()
      .setTitle(isPlaylist ? '📋 تمت إضافة البلاي ليست' : '🎵 تمت إضافة الأغنية')
      .setDescription(isPlaylist
        ? `تم إضافة **${totalAdded}** أغنية للقائمة`
        : `**${results[0].title}**${results[0].artist ? `\n${results[0].artist}` : ''}`)
      .addFields(
        { name: '➕ مضاف', value: String(totalAdded), inline: true },
        { name: '📋 في القائمة', value: String(await musicHandler.getQueueSize(interaction.guildId)), inline: true }
      )
      .setColor(results[0]?.platform === 'spotify' ? '#1DB954' : '#FF0000')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('❌ خطأ في التشغيل:', err);
    const errMsg = `❌ ${err.message || 'حصل خطأ غير معروف'}`;
    try { await interaction.editReply({ content: errMsg }); } catch { await interaction.reply({ content: errMsg, ephemeral: true }).catch(() => {}); }
  }
}

async function handleSkip(interaction) {
  try {
    const guildId = interaction.guildId;
    await musicHandler.skip(guildId);

    await interaction.reply({
      content: '⏭️ تم تخطي الأغنية!'
    });
  } catch (err) {
    console.error('❌ خطأ في التخطي:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleStop(interaction) {
  try {
    const guildId = interaction.guildId;
    await musicHandler.stop(guildId);

    await interaction.reply({
      content: '⏹️ تم إيقاف التشغيل ومغادرة القناة الصوتية'
    });
  } catch (err) {
    console.error('❌ خطأ في الإيقاف:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleQueue(interaction) {
  try {
    const guildId = interaction.guildId;
    const page = interaction.options.getInteger('page') || 1;

    const display = musicHandler.getQueueDisplay(guildId, page);

    const embed = new EmbedBuilder()
      .setTitle('🎵 قائمة التشغيل')
      .setDescription(display)
      .setColor('#3498db')
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  } catch (err) {
    console.error('❌ خطأ في عرض قائمة التشغيل:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handlePause(interaction) {
  try {
    const guildId = interaction.guildId;
    await musicHandler.pause(guildId);

    await interaction.reply({
      content: '⏸️ تم إيقاف الأغنية مؤقتاً'
    });
  } catch (err) {
    console.error('❌ خطأ في الإيقاف المؤقت:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleResume(interaction) {
  try {
    const guildId = interaction.guildId;
    await musicHandler.resume(guildId);

    await interaction.reply({
      content: '▶️ تم استئناف التشغيل'
    });
  } catch (err) {
    console.error('❌ خطأ في الاستئناف:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleNowPlaying(interaction) {
  try {
    const guildId = interaction.guildId;
    const queue = musicHandler.getQueue(guildId);

    if (!queue || !queue.currentSong) {
      return await interaction.reply({
        content: '❌ ما في أغنية تشتغل حالياً',
        ephemeral: true
      });
    }

    const song = queue.currentSong;
    const embed = new EmbedBuilder()
      .setTitle('🎵 الأغنية الحالية')
      .setDescription(song.title)
      .addFields(
        {
          name: 'المدة',
          value: musicHandler.formatDuration(song.duration),
          inline: true
        },
        {
          name: 'طلب بواسطة',
          value: song.requestedBy || 'Unknown',
          inline: true
        }
      )
      .setColor('#f39c12')
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  } catch (err) {
    console.error('❌ خطأ في عرض الأغنية الحالية:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

async function handleVolume(interaction) {
  try {
    const level = interaction.options.getInteger('level');
    const guildId = interaction.guildId;

    const newVolume = musicHandler.setVolume(guildId, level / 100);

    await interaction.reply({
      content: `🔊 تم تعديل مستوى الصوت إلى ${Math.round(newVolume * 100)}%`
    });
  } catch (err) {
    console.error('❌ خطأ في تعديل الصوت:', err);
    await interaction.reply({
      content: `❌ خطأ: ${err.message}`,
      ephemeral: true
    });
  }
}

export {
  registerMusicCommands,
  musicHandler,
  handlePlay,
  handleSkip,
  handleStop,
  handleQueue,
  handlePause,
  handleResume,
  handleNowPlaying,
  handleVolume
};
