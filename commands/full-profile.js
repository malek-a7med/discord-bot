// ═══════════════════════════════════════════════════════════════
//  📊 بروفايل شامل — XP + كوينز + إنجازات + فوز ألعاب + كلاس RPG
// ═══════════════════════════════════════════════════════════════
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CLASSES, TITLES, ACHIEVEMENTS, ensureRpgData, getCurrentTitle, calculateStats } from "../helpers/rpg-system.js";
import { SHOP_ITEMS } from "./coins-shop-extended.js";

export const fullProfileCommand = new SlashCommandBuilder()
  .setName("بروفايل")
  .setDescription("📊 اعرض بروفايل شامل — XP + كوينز + إنجازات + ألعاب + RPG")
  .addUserOption(o => o.setName("عضو").setDescription("بروفايل شخص تاني (اختياري)"));

export async function handleFullProfile(interaction, db) {
  await interaction.deferReply();

  const target = interaction.options.getUser("عضو") ?? interaction.user;
  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

  const userData = db.getUser(target.id);
  ensureRpgData(userData);

  const purchases = userData.shopPurchases || {};
  const activeTitle = SHOP_ITEMS.titles[purchases.activeTitle]?.name || null;
  const activeEmoji = SHOP_ITEMS.emojis[purchases.activeEmoji]?.emoji || "";

  const rpgData = userData.rpg || {};
  const cls = rpgData.class ? CLASSES[rpgData.class] : null;
  const stats = cls ? calculateStats(userData) : null;
  const currentTitleObj = getCurrentTitle(userData);
  const currentTitleName = currentTitleObj?.name || null;

  const unlockedAchievements = ACHIEVEMENTS.filter(a => {
    try { return a.check(userData); } catch { return false; }
  }).map(a => a.name.split(" ")[0]);

  const gameWins = userData.gameWins || {};
  const totalWins = Object.values(gameWins).reduce((a, b) => a + b, 0);
  const rouletteWins = gameWins.roulette || 0;
  const xoWins = gameWins.xo || 0;
  const mafiaWins = gameWins.mafia || 0;
  const rpsWins = gameWins.rps || 0;

  const warnings = userData.warnings || [];
  const level = userData.level || 0;
  const xp = userData.xp || 0;
  const coins = userData.coins || 0;
  const nextLevelXp = (level + 1) * (level + 1) * 50;
  const currLevelXp = level * level * 50;
  const xpBar = buildBar(xp - currLevelXp, nextLevelXp - currLevelXp);

  const displayEmoji = activeEmoji ? `${activeEmoji} ` : "";
  const titleLine = activeTitle || currentTitleName
    ? `**${activeTitle || currentTitleName}**\n`
    : "";

  const embed = new EmbedBuilder()
    .setColor(cls?.color || 0xA020F0)
    .setTitle(`${titleLine}📊 بروفايل ${displayEmoji}${member?.displayName || target.username}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: "🎮 المستوى والـ XP",
        value: `**المستوى:** ${level}\n**XP:** ${xp.toLocaleString()} / ${nextLevelXp.toLocaleString()}\n${xpBar}`,
        inline: true
      },
      {
        name: "💰 الاقتصاد",
        value: `**كوينز:** ${coins.toLocaleString()} 🪙\n**بنك:** ${(userData.bankCoins || 0).toLocaleString()} 🏦`,
        inline: true
      },
      {
        name: "⚔️ الكلاس",
        value: cls
          ? `${cls.emoji} **${cls.name}**\n💪 ${stats?.strength} 🧠 ${stats?.intelligence}\n✨ ${stats?.charisma} 🍀 ${stats?.luck}`
          : "❌ مش محدد — استخدم /كلاسي",
        inline: true
      },
      {
        name: "🏆 انتصارات الألعاب",
        value: `🎰 روليت: **${rouletteWins}**\n❌ اكس اوه: **${xoWins}**\n🕵️ مافيا: **${mafiaWins}**\n✌️ حجر ورقة: **${rpsWins}**\n📊 إجمالي: **${totalWins}**`,
        inline: true
      },
      {
        name: "🏅 الإنجازات",
        value: unlockedAchievements.length > 0
          ? unlockedAchievements.join(" ") + `\n*(${unlockedAchievements.length} إنجاز)*`
          : "لسا مفيش إنجازات",
        inline: true
      },
      {
        name: "🛡️ السجل",
        value: `⚠️ تحذيرات: **${warnings.length}**${warnings.length > 0 ? `\nآخر سبب: *${warnings[warnings.length - 1]?.reason || "—"}*` : ""}`,
        inline: true
      },
    )
    .setFooter({
      text: `📅 عضو منذ: ${member ? new Date(member.joinedAt).toLocaleDateString("ar-EG") : "—"} | ${target.username}`
    })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

function buildBar(current, total, length = 10) {
  if (total <= 0) return "▓".repeat(length);
  const pct = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(pct * length);
  return "▓".repeat(filled) + "░".repeat(length - filled);
}
