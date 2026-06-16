import config from './config.js';

class Logger {
  constructor(client) {
    this.client = client;
    this.adminChannelId = config.ADMIN_CHANNEL_ID;
  }

  setClient(client) {
    this.client = client;
  }

  async sendToAdmin(embed) {
    try {
      if (!this.client) return;
      const channel = await this.client.channels.fetch(this.adminChannelId);
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('❌ ما تقدرتش أبعت للقناة الإدارية:', err.message);
    }
  }

  info(message) {
    const timestamp = new Date().toLocaleTimeString('ar-EG');
    console.log(`ℹ️ [${timestamp}] ${message}`);
  }

  warn(message) {
    const timestamp = new Date().toLocaleTimeString('ar-EG');
    console.warn(`⚠️ [${timestamp}] تنبيه: ${message}`);
  }

  error(message, error = null) {
    const timestamp = new Date().toLocaleTimeString('ar-EG');
    console.error(`❌ [${timestamp}] خطأ: ${message}`);
    if (error) {
      console.error('   تفاصيل:', error.message);
      console.error('   Stack:', error.stack);
    }
  }

  success(message) {
    const timestamp = new Date().toLocaleTimeString('ar-EG');
    console.log(`✅ [${timestamp}] نجح: ${message}`);
  }

  debug(message) {
    if (process.env.DEBUG) {
      const timestamp = new Date().toLocaleTimeString('ar-EG');
      console.log(`🔍 [${timestamp}] Debug: ${message}`);
    }
  }

  async logToAdminEmbed(title, fields, color = '#2f3136') {
    const { EmbedBuilder } = await import('discord.js');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();

    for (const [key, value] of Object.entries(fields)) {
      embed.addFields({ name: key, value: String(value), inline: false });
    }

    await this.sendToAdmin(embed);
  }

  async logModerationAction(userId, action, reason, duration = null) {
    const { EmbedBuilder } = await import('discord.js');

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ إجراء إداري: ${action}`)
      .setColor('#e74c3c')
      .addFields(
        { name: 'المستخدم', value: `<@${userId}>`, inline: true },
        { name: 'الإجراء', value: action, inline: true },
        { name: 'السبب', value: reason, inline: false }
      );

    if (duration) {
      embed.addFields({ name: 'المدة', value: duration, inline: true });
    }

    embed.setTimestamp();
    await this.sendToAdmin(embed);
  }

  async logAPIError(service, error) {
    const { EmbedBuilder } = await import('discord.js');

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ خطأ API: ${service}`)
      .setColor('#f39c12')
      .addFields(
        { name: 'الخدمة', value: service, inline: true },
        { name: 'الخطأ', value: error.message || String(error), inline: false }
      )
      .setTimestamp();

    await this.sendToAdmin(embed);
  }
}

export default Logger;
