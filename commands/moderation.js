// ═══════════════════════════════════════════════════════════════
//  نظام إدارة التحذيرات — مكتمل ومتطور
//  الأوامر: تحذير-يدوي | تحذيرات | مسح-تحذير | مسح-كل-التحذيرات
// ═══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";

// ── مصادر التحذير (ترجمة) ──────────────────────────────────────
const SOURCE_LABELS = {
  MANUAL_MODERATOR: "🛡️ مشرف",
  MANUAL_OWNER:     "👑 أونر",
  AUTO_MOD:         "🤖 أوتو مود",
  SYSTEM:           "⚙️ سيستم",
};

function formatSource(src) {
  return SOURCE_LABELS[src] || `🔹 ${src || "غير محدد"}`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "string" ? ts : ts);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function warnLevelColor(count) {
  if (count === 0) return 0x2ecc71;
  if (count <= 2)  return 0xf39c12;
  if (count <= 4)  return 0xe67e22;
  return 0xe74c3c;
}

function warnLevelEmoji(count) {
  if (count === 0) return "😇";
  if (count === 1) return "⚠️";
  if (count <= 2)  return "🔶";
  if (count <= 4)  return "🔴";
  return "💀";
}

// ── تعريفات الأوامر ────────────────────────────────────────────
export const modWarnCommands = [
  // /تحذير-يدوي
  new SlashCommandBuilder()
    .setName("تحذير-يدوي")
    .setDescription("📋 سجّل تحذير يدوي على عضو مع السبب — بيتراكم مع تحذيرات الأوتو مود")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName("عضو").setDescription("العضو اللي هتحذّره").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("السبب").setDescription("سبب التحذير بالتفصيل").setRequired(true)
    )
    .addBooleanOption(o =>
      o.setName("dm").setDescription("هل تبعتله رسالة خاصة؟ (افتراضي: نعم)").setRequired(false)
    ),

  // /تحذيرات
  new SlashCommandBuilder()
    .setName("تحذيرات")
    .setDescription("📜 اعرض سجل التحذيرات الكامل لأي عضو")
    .addUserOption(o =>
      o.setName("عضو").setDescription("اختر العضو (لو ما اخترتش = أنت)").setRequired(false)
    ),

  // /مسح-تحذير
  new SlashCommandBuilder()
    .setName("مسح-تحذير")
    .setDescription("🗑️ امسح تحذير معين من سجل عضو [مشرف]")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName("عضو").setDescription("العضو").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("رقم").setDescription("رقم التحذير من قائمة /تحذيرات (أول تحذير = 1)").setRequired(true).setMinValue(1)
    )
    .addStringOption(o =>
      o.setName("سبب-المسح").setDescription("ليه بتمسح التحذير ده؟").setRequired(false)
    ),

  // /مسح-كل-التحذيرات
  new SlashCommandBuilder()
    .setName("مسح-كل-التحذيرات")
    .setDescription("🧹 امسح كل سجل التحذيرات لعضو [إدارة]")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName("عضو").setDescription("العضو").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("سبب").setDescription("سبب المسح الكامل").setRequired(false)
    ),
];

// ── بناء embed سجل التحذيرات ───────────────────────────────────
export function buildWarningsEmbed(targetUser, warns, page = 0) {
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(warns.length / ITEMS_PER_PAGE));
  const start = page * ITEMS_PER_PAGE;
  const slice = warns.slice(start, start + ITEMS_PER_PAGE);

  const count = warns.length;
  const embed = new EmbedBuilder()
    .setColor(warnLevelColor(count))
    .setAuthor({
      name: `${targetUser.username} — سجل التحذيرات`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
    .setFooter({ text: `صفحة ${page + 1} / ${totalPages} • إجمالي التحذيرات: ${count}` })
    .setTimestamp();

  if (count === 0) {
    embed
      .setTitle("😇 سجل نظيف تماماً!")
      .setDescription(`العضو ${targetUser} مفيش عليه أي تحذيرات دلوقتي.\nسجلّه أبيض وزي الفل!`);
    return embed;
  }

  // شريط حالة التحذيرات
  const barFull  = "🟥";
  const barEmpty = "⬜";
  const danger   = Math.min(count, 10);
  const bar      = barFull.repeat(danger) + barEmpty.repeat(10 - danger);

  embed.setTitle(`${warnLevelEmoji(count)} تحذيرات ${targetUser.username}`);
  embed.setDescription(
    `**إجمالي التحذيرات:** \`${count}\`\n` +
    `**خطورة:** ${bar}\n\u200B`
  );

  slice.forEach((w, i) => {
    const num     = start + i + 1;
    const src     = formatSource(w.moderator || w.source);
    const date    = formatDate(w.timestamp || w.date);
    const reason  = w.reason || "بدون سبب";
    embed.addFields({
      name:   `#${num} — ${src}`,
      value:  `> **السبب:** ${reason.slice(0, 200)}\n> **التاريخ:** ${date}`,
      inline: false,
    });
  });

  return embed;
}

// ── بناء أزرار التنقل ──────────────────────────────────────────
export function buildWarnPaginationRow(targetUserId, page, totalPages) {
  const prev = new ButtonBuilder()
    .setCustomId(`warns_page|${targetUserId}|${page - 1}`)
    .setLabel("◀️ السابق")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);

  const next = new ButtonBuilder()
    .setCustomId(`warns_page|${targetUserId}|${page + 1}`)
    .setLabel("التالي ▶️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  const counter = new ButtonBuilder()
    .setCustomId("warns_page_dummy")
    .setLabel(`${page + 1} / ${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  return new ActionRowBuilder().addComponents(prev, counter, next);
}

// ── معالج الأوامر الرئيسي ──────────────────────────────────────
export async function handleModWarnCommand(interaction, db, config) {
  const { commandName: cmd, user, guild } = interaction;

  // ════════════════════════════════════════════════════════
  //  /تحذير-يدوي
  // ════════════════════════════════════════════════════════
  if (cmd === "تحذير-يدوي") {
    const target     = interaction.options.getUser("عضو");
    const reason     = interaction.options.getString("السبب");
    const sendDm     = interaction.options.getBoolean("dm") ?? true;

    if (target.bot) {
      return interaction.reply({ content: "❌ مش هتحذّر بوت يسطا!", flags: 64 });
    }
    if (target.id === user.id) {
      return interaction.reply({ content: "❌ مش هتحذّر نفسك ولا إيه ده 😂", flags: 64 });
    }

    // تحديد المصدر — أونر أو مشرف
    const isOwner = config?.isOwner?.(user.id) ?? false;
    const source  = isOwner ? "MANUAL_OWNER" : "MANUAL_MODERATOR";

    db.addWarning(target.id, reason, source);
    const warns = db.getWarnings(target.id);
    const count = warns.length;

    // embed في القناة
    const publicEmbed = new EmbedBuilder()
      .setColor(warnLevelColor(count))
      .setTitle(`${warnLevelEmoji(count)} تم تسجيل تحذير يدوي`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 128 }))
      .addFields(
        { name: "👤 العضو",          value: `${target} \`(${target.id})\``, inline: true  },
        { name: "🛡️ المشرف",        value: `${user}`,                       inline: true  },
        { name: "📋 المصدر",         value: formatSource(source),            inline: true  },
        { name: "💬 السبب",          value: reason.slice(0, 512),            inline: false },
        { name: "⚠️ إجمالي التحذيرات", value: `\`${count}\` تحذير`,          inline: true  },
      )
      .setFooter({ text: `التحذير رقم #${count} في سجل العضو` })
      .setTimestamp();

    await interaction.reply({ embeds: [publicEmbed] });

    // DM للعضو
    if (sendDm) {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`⚠️ لقيت تحذير يدوي على حسابك`)
        .setDescription(
          `اتسجّل عليك تحذير يدوي في **${guild?.name || "السيرفر"}**.\n\n` +
          `لو حسيت إنه ظلم، كلم الإدارة.`
        )
        .addFields(
          { name: "💬 السبب",          value: reason.slice(0, 512), inline: false },
          { name: "⚠️ إجمالي تحذيراتك", value: `\`${count}\``,      inline: true  },
        )
        .setTimestamp();

      try { await target.send({ embeds: [dmEmbed] }); } catch { /* مبعتش DM */ }
    }
    return;
  }

  // ════════════════════════════════════════════════════════
  //  /تحذيرات
  // ════════════════════════════════════════════════════════
  if (cmd === "تحذيرات") {
    const target = interaction.options.getUser("عضو") ?? user;
    const warns  = db.getWarnings(target.id);
    const totalPages = Math.max(1, Math.ceil(warns.length / 5));

    const embed = buildWarningsEmbed(target, warns, 0);
    const components = totalPages > 1
      ? [buildWarnPaginationRow(target.id, 0, totalPages)]
      : [];

    return interaction.reply({ embeds: [embed], components });
  }

  // ════════════════════════════════════════════════════════
  //  /مسح-تحذير
  // ════════════════════════════════════════════════════════
  if (cmd === "مسح-تحذير") {
    const target     = interaction.options.getUser("عضو");
    const num        = interaction.options.getInteger("رقم");
    const removeSrc  = interaction.options.getString("سبب-المسح") || "مفيش سبب";
    const warns      = db.getWarnings(target.id);

    if (warns.length === 0) {
      return interaction.reply({ content: `😇 العضو ${target} مفيش عليه أي تحذيرات أصلاً!`, flags: 64 });
    }
    if (num > warns.length) {
      return interaction.reply({
        content: `❌ رقم التحذير **${num}** مش موجود!\nالعضو عنده **${warns.length}** تحذير بس.`,
        flags: 64,
      });
    }

    const removed = warns[num - 1];
    db.removeWarningByIndex(target.id, num - 1);
    const newCount = db.getWarnings(target.id).length;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🗑️ تم مسح التحذير")
      .addFields(
        { name: "👤 العضو",       value: `${target}`,           inline: true  },
        { name: "🔢 رقم التحذير", value: `#${num}`,             inline: true  },
        { name: "🛡️ المشرف",     value: `${user}`,             inline: true  },
        { name: "💬 السبب المحذوف", value: (removed.reason || "—").slice(0, 512), inline: false },
        { name: "📌 سبب المسح",   value: removeSrc.slice(0, 256), inline: false },
        { name: "📊 التحذيرات المتبقية", value: `\`${newCount}\``, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ════════════════════════════════════════════════════════
  //  /مسح-كل-التحذيرات
  // ════════════════════════════════════════════════════════
  if (cmd === "مسح-كل-التحذيرات") {
    const target  = interaction.options.getUser("عضو");
    const reason  = interaction.options.getString("سبب") || "مفيش سبب";
    const warns   = db.getWarnings(target.id);
    const oldCount = warns.length;

    if (oldCount === 0) {
      return interaction.reply({ content: `😇 العضو ${target} سجلّه أصلاً فاضي!`, flags: 64 });
    }

    db.clearAllWarnings(target.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🧹 تم مسح كل التحذيرات")
      .setDescription(`تم تصفير سجل تحذيرات ${target} بالكامل.`)
      .addFields(
        { name: "👤 العضو",          value: `${target}`,         inline: true  },
        { name: "🛡️ المسؤول",       value: `${user}`,           inline: true  },
        { name: "📊 عدد المحذوف",    value: `\`${oldCount}\` تحذير`, inline: true },
        { name: "📌 السبب",          value: reason.slice(0, 256), inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}

// ── معالج أزرار الـ Pagination ─────────────────────────────────
export async function handleWarnsPagination(interaction, db) {
  if (!interaction.customId.startsWith("warns_page|")) return false;

  const parts      = interaction.customId.split("|");
  const targetId   = parts[1];
  const page       = parseInt(parts[2], 10);

  const target     = await interaction.client.users.fetch(targetId).catch(() => null);
  if (!target) {
    await interaction.update({ content: "❌ مش لاقي العضو ده.", components: [] });
    return true;
  }

  const warns      = db.getWarnings(targetId);
  const totalPages = Math.max(1, Math.ceil(warns.length / 5));
  const safePage   = Math.max(0, Math.min(page, totalPages - 1));

  const embed      = buildWarningsEmbed(target, warns, safePage);
  const components = totalPages > 1
    ? [buildWarnPaginationRow(targetId, safePage, totalPages)]
    : [];

  await interaction.update({ embeds: [embed], components });
  return true;
}
