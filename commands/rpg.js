// ════════════════════════════════════════════════════════════════
//  أوامر نظام RPG — بوت زنجي
//  ⚜️ Black & Gold Luxury Theme
// ════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import {
  CLASSES, TITLES, ACHIEVEMENTS,
  ensureRpgData, getCurrentTitle, getUnlockedTitles,
  calculateStats, formatProfileSummary,
} from '../helpers/rpg-system.js';
import { COLORS, footer, buildXpBar } from '../helpers/theme.js';

let _db = null;
export function setRpgDatabase(database) { _db = database; }

export async function registerRpgCommands() {
  return [
    {
      data: new SlashCommandBuilder()
        .setName('كلاسي')
        .setDescription('⚔️ اختار الكلاس بتاعك أو اعرضه'),
      execute: handleClass,
    },
    {
      data: new SlashCommandBuilder()
        .setName('بروفايل-rpg')
        .setDescription('📜 اعرض بروفايل الـ RPG بتاعك')
        .addUserOption(o => o.setName('شخص').setDescription('اعرض بروفايل شخص تاني').setRequired(false)),
      execute: handleProfile,
    },
    {
      data: new SlashCommandBuilder()
        .setName('الانجازات')
        .setDescription('🏅 اعرض كل الإنجازات المتاحة وإيه اللي فتحته'),
      execute: handleAchievements,
    },
    {
      data: new SlashCommandBuilder()
        .setName('الالقاب')
        .setDescription('👑 اعرض الألقاب المتاحة واختار لقبك المعروض'),
      execute: handleTitles,
    },
  ];
}

// ─── /كلاسي ────────────────────────────────────────────────────
export async function handleClass(interaction) {
  await interaction.deferReply();

  const userData = _db.getUser(interaction.user.id);
  ensureRpgData(userData);

  if (userData.rpg.class) {
    const cls = CLASSES[userData.rpg.class];
    const stats = calculateStats(userData);
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${cls.emoji} كلاسك: ${cls.name}`)
        .setDescription(`*${cls.desc}*`)
        .addFields(
          { name: '💪 قوة',     value: `\`${stats.strength}\``,     inline: true },
          { name: '🧠 ذكاء',   value: `\`${stats.intelligence}\``, inline: true },
          { name: '✨ كاريزما', value: `\`${stats.charisma}\``,    inline: true },
          { name: '🍀 حظ',     value: `\`${stats.luck}\``,         inline: true },
        )
        .setFooter(footer('الاختيار نهائي ومش قابل للتغيير!'))
        .setTimestamp()],
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select_class')
      .setPlaceholder('Make a selection')
      .addOptions(Object.values(CLASSES).map(c => ({
        label: c.name, description: c.desc.slice(0, 95), value: c.id, emoji: c.emoji,
      })))
  );

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle('⚔️ اختار كلاسك!')
      .setDescription(
        '```\n⚜️  الاختيار نهائي — اختار بعناية!\n```\n' +
        Object.values(CLASSES).map(c => `${c.emoji} **${c.name}**\n${c.desc}`).join('\n\n')
      )
      .setFooter(footer('نظام RPG — زنجي بوت'))
      .setTimestamp()],
    components: [row],
  });
}

// ─── معالج اختيار الكلاس ─────────────────────────────────────
export async function handleClassSelect(interaction) {
  const userData = _db.getUser(interaction.user.id);
  ensureRpgData(userData);

  if (userData.rpg.class)
    return interaction.reply({ content: '❌ اخترت كلاس بالفعل — الاختيار نهائي!', ephemeral: true });

  const classId = interaction.values[0];
  const cls = CLASSES[classId];
  if (!cls) return interaction.reply({ content: '❌ كلاس غير صحيح!', ephemeral: true });

  userData.rpg.class = classId;
  _db.updateUser(interaction.user.id, userData);

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`✅ مبروك! بقيت ${cls.emoji} ${cls.name}`)
      .setDescription(`*${cls.desc}*\n\nاستخدم \`/بروفايل-rpg\` عشان تشوف ستاتسك الكاملة!`)
      .setFooter(footer('نظام RPG — زنجي بوت'))
      .setTimestamp()],
    components: [],
  });
}

// ─── /بروفايل-rpg ─────────────────────────────────────────────
export async function handleProfile(interaction) {
  await interaction.deferReply();
  const target = interaction.options.getUser('شخص') || interaction.user;
  const userData = _db.getUser(target.id);
  ensureRpgData(userData);

  const summary = formatProfileSummary(userData, target.username);
  const xpForNext    = (summary.level + 1) ** 2 * 50;
  const xpForCurrent = summary.level ** 2 * 50;
  const progress  = summary.xp - xpForCurrent;
  const needed    = xpForNext - xpForCurrent;
  const bar = buildXpBar(progress, needed, 14);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setAuthor({ name: `بروفايل ${target.username}`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👑 اللقب',      value: summary.title,                                  inline: true },
        { name: '⚔️ الكلاس',    value: summary.class,                                  inline: true },
        { name: '📊 المستوى',   value: `\`${summary.level}\``,                         inline: true },
        { name: '✨ التقدم',    value: `\`${bar}\`\n${progress.toLocaleString()} / ${needed.toLocaleString()} XP`, inline: false },
        { name: '💪 قوة',       value: `\`${summary.stats.strength}\``,               inline: true },
        { name: '🧠 ذكاء',     value: `\`${summary.stats.intelligence}\``,            inline: true },
        { name: '🎭 كاريزما',  value: `\`${summary.stats.charisma}\``,               inline: true },
        { name: '🍀 حظ',       value: `\`${summary.stats.luck}\``,                   inline: true },
        { name: '🏅 الإنجازات', value: summary.achievementsProgress,                  inline: true },
        { name: '💰 الكوينز',  value: `\`${(userData.coins || 0).toLocaleString()}\` 🪙`, inline: true },
      )
      .setFooter(footer('نظام RPG — زنجي بوت'))
      .setTimestamp()],
  });
}

// ─── /الانجازات ───────────────────────────────────────────────
export async function handleAchievements(interaction) {
  await interaction.deferReply();
  const userData = _db.getUser(interaction.user.id);
  ensureRpgData(userData);

  const unlocked = new Set(userData.rpg.achievements);
  const lines = ACHIEVEMENTS.map(a => {
    const status = unlocked.has(a.id) ? '✅' : '🔒';
    return `${status} **${a.name}** — ${a.desc} \`+${a.xpReward} XP\``;
  });

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.DARK_GOLD)
      .setTitle(`🏅 الإنجازات — ${unlocked.size} / ${ACHIEVEMENTS.length} مفتوح`)
      .setDescription(lines.join('\n'))
      .setFooter(footer('نظام RPG — زنجي بوت'))
      .setTimestamp()],
  });
}

// ─── /الالقاب ─────────────────────────────────────────────────
export async function handleTitles(interaction) {
  await interaction.deferReply();
  const userData = _db.getUser(interaction.user.id);
  ensureRpgData(userData);

  const unlockedTitles = getUnlockedTitles(userData);
  const currentTitle = getCurrentTitle(userData);

  if (unlockedTitles.length === 0)
    return interaction.editReply({ content: '🔒 لسه محدش فتح ألقاب — شيّل إنجازات عشان تفتح ألقاب!' });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select_title')
      .setPlaceholder('Make a selection')
      .addOptions(unlockedTitles.map(t => ({
        label: t.name,
        value: t.id,
        default: t.id === (userData.rpg.selectedTitle || currentTitle?.id),
      })))
  );

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle('👑 الألقاب المتاحة')
      .setDescription(
        unlockedTitles.map(t =>
          `${t.id === currentTitle?.id ? '▸' : '◦'} **${t.name}**`
        ).join('\n')
      )
      .setFooter(footer('اختار لقب من القايمة عشان يظهر في بروفايلك'))
      .setTimestamp()],
    components: [row],
  });
}

// ─── معالج اختيار اللقب ──────────────────────────────────────
export async function handleTitleSelect(interaction) {
  const userData = _db.getUser(interaction.user.id);
  ensureRpgData(userData);

  const titleId = interaction.values[0];
  const title = TITLES.find(t => t.id === titleId);
  if (!title || !title.condition(userData))
    return interaction.reply({ content: '❌ مش معاك اللقب ده!', ephemeral: true });

  userData.rpg.selectedTitle = titleId;
  _db.updateUser(interaction.user.id, userData);

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('✅ تم تغيير اللقب')
      .setDescription(`لقبك الجديد: **${title.name}**\nهيظهر في بروفايلك من دلوقتي!`)
      .setFooter(footer('نظام RPG — زنجي بوت'))
      .setTimestamp()],
    components: [],
  });
}
