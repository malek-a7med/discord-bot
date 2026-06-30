// ════════════════════════════════════════════════════════════════
//  أوامر نظام RPG — بوت زنجي
// ════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import {
  CLASSES, TITLES, ACHIEVEMENTS,
  ensureRpgData, getCurrentTitle, getUnlockedTitles,
  calculateStats, formatProfileSummary,
} from '../helpers/rpg-system.js';

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

  const dbInstance = _db;
  const userData = dbInstance.getUser(interaction.user.id);
  ensureRpgData(userData);

  if (userData.rpg.class) {
    const cls = CLASSES[userData.rpg.class];
    const stats = calculateStats(userData);
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`${cls.emoji} الكلاس بتاعك: ${cls.name}`)
        .setDescription(cls.desc)
        .addFields(
          { name: '💪 قوة', value: `${stats.strength}`, inline: true },
          { name: '🧠 ذكاء', value: `${stats.intelligence}`, inline: true },
          { name: '✨ كاريزما', value: `${stats.charisma}`, inline: true },
          { name: '🍀 حظ', value: `${stats.luck}`, inline: true },
        )
        .setFooter({ text: 'مينفعش تغير الكلاس بعد ما تختاره!' })],
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select_class')
      .setPlaceholder('اختار كلاسك...')
      .addOptions(Object.values(CLASSES).map(c => ({
        label: c.name, description: c.desc.slice(0, 95), value: c.id, emoji: c.emoji,
      })))
  );

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x66FCF1)
      .setTitle('⚔️ اختار كلاسك!')
      .setDescription('كل كلاس عنده ستاتس مختلفة ومميزات خاصة — **الاختيار نهائي!**\n\n' +
        Object.values(CLASSES).map(c => `${c.emoji} **${c.name}**\n${c.desc}`).join('\n\n'))],
    components: [row],
  });
}

// ─── معالج اختيار الكلاس (select menu) ─────────────────────────
export async function handleClassSelect(interaction) {
  const dbInstance = _db;
  const userData = dbInstance.getUser(interaction.user.id);
  ensureRpgData(userData);

  if (userData.rpg.class) {
    return interaction.reply({ content: '❌ أنت اخترت كلاس بالفعل!', ephemeral: true });
  }

  const classId = interaction.values[0];
  const cls = CLASSES[classId];
  if (!cls) return interaction.reply({ content: '❌ كلاس غير صحيح!', ephemeral: true });

  userData.rpg.class = classId;
  dbInstance.updateUser(interaction.user.id, userData);

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ مبروك! بقيت ${cls.emoji} ${cls.name}`)
      .setDescription(cls.desc)
      .setFooter({ text: 'استخدم /بروفايل-rpg عشان تشوف ستاتسك' })],
    components: [],
  });
}

// ─── /بروفايل-rpg ──────────────────────────────────────────────
export async function handleProfile(interaction) {
  await interaction.deferReply();
  const target = interaction.options.getUser('شخص') || interaction.user;
  const dbInstance = _db;
  const userData = dbInstance.getUser(target.id);
  ensureRpgData(userData);

  const summary = formatProfileSummary(userData, target.username);
  const xpForNext = (summary.level + 1) ** 2 * 50;
  const xpForCurrent = summary.level ** 2 * 50;
  const progress = summary.xp - xpForCurrent;
  const needed = xpForNext - xpForCurrent;
  const progressBar = '█'.repeat(Math.floor((progress / needed) * 10)) + '░'.repeat(10 - Math.floor((progress / needed) * 10));

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x66FCF1)
      .setAuthor({ name: `بروفايل ${target.username}`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '👑 اللقب', value: summary.title, inline: true },
        { name: '⚔️ الكلاس', value: summary.class, inline: true },
        { name: '📊 المستوى', value: `${summary.level}`, inline: true },
        { name: '✨ التقدم', value: `\`${progressBar}\` ${progress}/${needed} XP`, inline: false },
        { name: '💪 قوة', value: `${summary.stats.strength}`, inline: true },
        { name: '🧠 ذكاء', value: `${summary.stats.intelligence}`, inline: true },
        { name: '🎭 كاريزما', value: `${summary.stats.charisma}`, inline: true },
        { name: '🍀 حظ', value: `${summary.stats.luck}`, inline: true },
        { name: '🏅 الإنجازات', value: summary.achievementsProgress, inline: true },
        { name: '💰 الكوينز', value: `${(userData.coins || 0).toLocaleString()}`, inline: true },
      )
      .setTimestamp()],
  });
}

// ─── /الانجازات ─────────────────────────────────────────────────
export async function handleAchievements(interaction) {
  await interaction.deferReply();
  const dbInstance = _db;
  const userData = dbInstance.getUser(interaction.user.id);
  ensureRpgData(userData);

  const unlocked = new Set(userData.rpg.achievements);
  const lines = ACHIEVEMENTS.map(a => {
    const status = unlocked.has(a.id) ? '✅' : '🔒';
    return `${status} **${a.name}** — ${a.desc} \`+${a.xpReward} XP\``;
  });

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🏅 الإنجازات (${unlocked.size}/${ACHIEVEMENTS.length})`)
      .setDescription(lines.join('\n'))
      .setTimestamp()],
  });
}

// ─── /الالقاب ───────────────────────────────────────────────────
export async function handleTitles(interaction) {
  await interaction.deferReply();
  const dbInstance = _db;
  const userData = dbInstance.getUser(interaction.user.id);
  ensureRpgData(userData);

  const unlockedTitles = getUnlockedTitles(userData);
  const currentTitle = getCurrentTitle(userData);

  if (unlockedTitles.length === 0) {
    return interaction.editReply({ content: '❌ مفيش ألقاب اتفتحت لسه!' });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select_title')
      .setPlaceholder('اختار لقب تعرضه...')
      .addOptions(unlockedTitles.map(t => ({
        label: t.name, value: t.id, default: t.id === (userData.rpg.selectedTitle || currentTitle.id),
      })))
  );

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('👑 الألقاب المتاحة')
      .setDescription(unlockedTitles.map(t => `${t.id === currentTitle.id ? '➡️' : '•'} ${t.name}`).join('\n'))
      .setFooter({ text: 'اختار لقب من القائمة عشان يظهر في بروفايلك' })],
    components: [row],
  });
}

// ─── معالج اختيار اللقب ──────────────────────────────────────────
export async function handleTitleSelect(interaction) {
  const dbInstance = _db;
  const userData = dbInstance.getUser(interaction.user.id);
  ensureRpgData(userData);

  const titleId = interaction.values[0];
  const title = TITLES.find(t => t.id === titleId);
  if (!title || !title.condition(userData)) {
    return interaction.reply({ content: '❌ مش معاك اللقب ده!', ephemeral: true });
  }

  userData.rpg.selectedTitle = titleId;
  dbInstance.updateUser(interaction.user.id, userData);

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ بقى لقبك: **${title.name}**`)],
    components: [],
  });
}
