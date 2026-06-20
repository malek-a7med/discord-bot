import config from '../config.js';
import { ModerationError } from '../errors.js';

class ModerationListener {
  constructor(client, db, logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;
    this.spamCache = new Map();
    this.raidCache = new Map();
    this.linkRegex = /https?:\/\/(www\.)?([-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*))/gi;
    this.whitelistedDomains = [
      'youtube.com',
      'youtu.be',
      'github.com',
      'discord.gg',
      'twitch.tv'
    ];
  }

  async scanMessage(message) {
    try {
      // Ignore bot messages
      if (message.author.bot) return;

      // Ignore owner messages (all owners)
      if (config.isOwner(message.author.id)) return;

      // Check anti-spam
      await this.checkSpam(message);

      // Check anti-link
      await this.checkLinks(message);
    } catch (err) {
      this.logger.error('خطأ في مسح الرسالة:', err);
    }
  }

  async checkSpam(message) {
    try {
      const key = `${message.guildId}-${message.author.id}`;
      const now = Date.now();
      const window = config.ANTI_SPAM_WINDOW;
      const threshold = config.ANTI_SPAM_THRESHOLD;

      if (!this.spamCache.has(key)) {
        this.spamCache.set(key, []);
      }

      const userSpam = this.spamCache.get(key);

      // Remove old messages outside window
      const recentMessages = userSpam.filter((time) => now - time < window);
      recentMessages.push(now);

      this.spamCache.set(key, recentMessages);

      if (recentMessages.length > threshold) {
        await this.triggerSpamViolation(message, recentMessages.length);
      }

      // Clean up old entries
      if (this.spamCache.size > 1000) {
        for (const [k, times] of this.spamCache.entries()) {
          const recent = times.filter((t) => now - t < 60000);
          if (recent.length === 0) {
            this.spamCache.delete(k);
          } else {
            this.spamCache.set(k, recent);
          }
        }
      }
    } catch (err) {
      throw new ModerationError(`خطأ في فحص الـ spam: ${err.message}`);
    }
  }

  async triggerSpamViolation(message, spamCount) {
    try {
      const user = message.author;
      const warnings = this.db.getWarnings(user.id);

      // Add warning to database
      this.db.addWarning(
        user.id,
        `Spam: ${spamCount} messages in ${config.ANTI_SPAM_WINDOW}ms`,
        'ANTI_SPAM_SYSTEM'
      );

      // Escalation logic
      let action = 'warn';
      let duration = null;

      if (warnings.length === 0) {
        action = 'warn';
      } else if (warnings.length === 1) {
        action = 'timeout';
        duration = 5 * 60 * 1000; // 5 minutes
      } else if (warnings.length === 2) {
        action = 'timeout';
        duration = 30 * 60 * 1000; // 30 minutes
      } else if (warnings.length >= 3) {
        action = 'kick';
      }

      // Apply action
      if (action === 'timeout' && message.member) {
        try {
          await message.member.timeout(
            duration,
            `Anti-spam system: ${spamCount} messages`
          );
        } catch (err) {
          console.error('❌ ما تقدرتش أطبق timeout:', err.message);
        }
      } else if (action === 'kick' && message.member) {
        try {
          await message.member.kick('Anti-spam system: repeated violations');
        } catch (err) {
          console.error('❌ ما تقدرتش أطرد المستخدم:', err.message);
        }
      }

      // Log to admin channel
      await this.logger.logModerationAction(
        user.id,
        `🚨 اكتشاف Spam`,
        `${spamCount} رسائل في ${config.ANTI_SPAM_WINDOW}ms - الإجراء: ${action}`,
        duration ? `${duration / 1000} ثانية` : 'N/A'
      );

      // Send DM to user
      try {
        await user.send(
          `⚠️ تم اكتشاف spam من حسابك في السيرفر. الإجراء: **${action}**`
        );
      } catch (err) {
        console.error('❌ ما تقدرتش أبعت DM:', err.message);
      }
    } catch (err) {
      throw new ModerationError(
        `خطأ في تطبيق عقوبة Spam: ${err.message}`
      );
    }
  }

  async checkLinks(message) {
    try {
      const content = message.content;
      const matches = content.match(this.linkRegex);

      if (!matches) return;

      for (const url of matches) {
        const domain = this.extractDomain(url);

        if (!this.isWhitelisted(domain)) {
          await this.triggerLinkViolation(message, url, domain);
        }
      }
    } catch (err) {
      throw new ModerationError(`خطأ في فحص الروابط: ${err.message}`);
    }
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || url;
    } catch (err) {
      return url;
    }
  }

  isWhitelisted(domain) {
    return this.whitelistedDomains.some((whitelist) =>
      domain.includes(whitelist)
    );
  }

  async triggerLinkViolation(message, url, domain) {
    try {
      const user = message.author;

      // Delete message
      try {
        await message.delete();
      } catch (err) {
        console.error('❌ ما تقدرتش أحذف الرسالة:', err.message);
      }

      // Add warning
      this.db.addWarning(
        user.id,
        `Suspicious link posted: ${domain}`,
        'ANTI_LINK_SYSTEM'
      );

      // Log to admin channel
      await this.logger.logModerationAction(
        user.id,
        '🔗 رابط مريب',
        `الرابط: ${url}\nالنطاق: ${domain}\nالرسالة تم حذفها`,
        'N/A'
      );

      // Send DM to user
      try {
        await user.send(
          `⚠️ تم حذف رسالتك لأنها تحتوي على رابط مريب: ${domain}`
        );
      } catch (err) {
        console.error('❌ ما تقدرتش أبعت DM:', err.message);
      }
    } catch (err) {
      throw new ModerationError(
        `خطأ في تطبيق عقوبة الرابط: ${err.message}`
      );
    }
  }

  async scanGuildJoin(member) {
    try {
      const guildId = member.guild.id;
      const now = Date.now();
      const key = `${guildId}-raid`;
      const window = config.ANTI_RAID_WINDOW;
      const threshold = config.ANTI_RAID_THRESHOLD;

      if (!this.raidCache.has(key)) {
        this.raidCache.set(key, []);
      }

      const joinTimes = this.raidCache.get(key);

      // Remove old joins outside window
      const recentJoins = joinTimes.filter((time) => now - time < window);
      recentJoins.push(now);

      this.raidCache.set(key, recentJoins);

      if (recentJoins.length > threshold) {
        await this.triggerRaidProtection(member.guild, recentJoins.length);
      }
    } catch (err) {
      this.logger.error('خطأ في فحص الـ raid:', err);
    }
  }

  async triggerRaidProtection(guild, joinCount) {
    try {
      const systemChannel = guild.systemChannel;

      // Lock all channels (remove send permissions for @everyone)
      let lockedCount = 0;
      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased()) {
          try {
            await channel.permissionOverwrites.edit(
              guild.roles.everyone,
              { SendMessages: false }
            );
            lockedCount++;
          } catch (err) {
            console.error(`❌ ما تقدرتش أقفل القناة ${channel.name}:`, err.message);
          }
        }
      }

      // Notify admins
      if (systemChannel) {
        await systemChannel.send({
          content: `🚨 **تحذير الـ Raid**: تم اكتشاف ${joinCount} انضمام مريب!\n\nتم قفل جميع القنوات الكتابية. يجب على الـ مودريتور فتحها يدويًا.`
        });
      }

      // Log to admin channel
      const adminChannel = await this.client.channels.fetch(
        config.ADMIN_CHANNEL_ID
      );
      if (adminChannel) {
        await adminChannel.send({
          content: `🚨 **رايد متكرر في السيرفر**: ${guild.name}\n${joinCount} انضمام في ${config.ANTI_RAID_WINDOW}ms\nتم قفل ${lockedCount} قنوات`
        });
      }
    } catch (err) {
      this.logger.error('خطأ في تطبيق حماية الـ raid:', err);
    }
  }

  isEnabled() {
    return !!config.OWNER_ID && !!config.ADMIN_CHANNEL_ID;
  }
}

export default ModerationListener;