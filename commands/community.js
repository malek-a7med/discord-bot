// ============================================================
// 🏆 قناة التوب + 🛡️ بوابة التحقق + 🛒 متجر البنك المركزي
// ⚜️ Black & Gold Luxury Theme
// ============================================================

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import config from "../config.js";
import { COLORS, footer, fmtNum } from "../helpers/theme.js";

const VERIFIED_ROLE_NAME = "Verified";
const VERIFY_BUTTON_ID   = "verify_gate_accept";

// ── /top — أعلى 10 أعضاء حسب الـ XP ─────────────────────────
export const topCommand = new SlashCommandBuilder()
  .setName("top")
  .setDescription("🏆 شوف أعلى 10 أعضاء في السيرفر حسب الـ XP");

export async function handleTopCommand(interaction, db) {
  await interaction.deferReply();

  const allData = db.getAllData();
  const users = allData.users || {};

  const ranked = Object.entries(users)
    .map(([userId, u]) => ({ userId, xp: u.xp || 0, level: u.level || 0 }))
    .filter((u) => u.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  if (ranked.length === 0)
    return interaction.editReply({ content: "📭 لسه محدش عنده XP كفاية عشان يظهر في التوب!" });

  const medals = ["🥇", "🥈", "🥉"];
  const lines = await Promise.all(
    ranked.map(async (u, i) => {
      const rankIcon = medals[i] || `**#${i + 1}**`;
      let name = `<@${u.userId}>`;
      try {
        const member = await interaction.guild.members.fetch(u.userId);
        name = member.displayName;
      } catch {}
      return `${rankIcon} **${name}** — المستوى \`${u.level}\` │ \`${u.xp.toLocaleString()}\` XP`;
    })
  );

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("𓋹 لوحة الأكثر نشاطاً 𓋹")
    .setDescription(
      "```\n⚜️  أبطال السيرفر حسب الـ XP\n```\n" +
      lines.join("\n\n")
    )
    .setThumbnail(interaction.guild.iconURL?.({ dynamic: true }) || null)
    .setFooter(footer("بيتحدث تلقائياً كل ما الأعضاء يتفاعلوا"))
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── /بوابة-التحقق ─────────────────────────────────────────────
export const verifyGateCommand = new SlashCommandBuilder()
  .setName("بوابة-التحقق")
  .setDescription("🛡️ انشر رسالة بوابة التحقق في الروم ده [إدارة]")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleVerifyGateCommand(interaction) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("𓂀 بوابة دخول السيرفر 𓂀")
    .setDescription(
      "```\n⚜️  أهلاً بك في السيرفر\n```\n" +
      "قبل ما تشوف باقي الرومات، لازم توافق على قوانين السيرفر.\n\n" +
      "دوس على الزرار تحت عشان تأكد إنك موافق على القوانين — وهتفتحلك باقي الرومات على طول ✅"
    )
    .setFooter(footer("التحقق بياخد ثانية واحدة بس 🔐"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel("✅ أنا موافق على القوانين")
      .setStyle(ButtonStyle.Success)
  );

  return interaction.reply({ embeds: [embed], components: [row] });
}

async function ensureVerifiedRole(guild) {
  let role = guild.roles.cache.find((r) => r.name === VERIFIED_ROLE_NAME);
  if (!role) {
    role = await guild.roles.create({
      name: VERIFIED_ROLE_NAME,
      color: 0xFFD700,
      hoist: false,
      reason: "رتبة التحقق — بوابة الدخول",
    });
  }
  return role;
}

export async function handleVerifyButton(interaction) {
  if (interaction.customId !== VERIFY_BUTTON_ID) return;

  try {
    const role = await ensureVerifiedRole(interaction.guild);
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (member.roles.cache.has(role.id)) {
      return interaction.reply({
        content: "✅ أنت متحقق بالفعل!",
        ephemeral: true,
      });
    }

    await member.roles.add(role);
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle("✅ تم التحقق بنجاح!")
        .setDescription(`أهلاً بك يا **${member.displayName}**!\nاتضافتلك رتبة **${VERIFIED_ROLE_NAME}** وبقت الرومات مفتوحة ليك 🎉`)
        .setFooter(footer())
        .setTimestamp()],
      ephemeral: true,
    });
  } catch (err) {
    return interaction.reply({
      content: "❌ حدث خطأ أثناء التحقق — حاول تاني أو تواصل مع الإدارة.",
      ephemeral: true,
    });
  }
}

// ── /متجر (متجر البنك المركزي) ───────────────────────────────
export const bankShopCommand = new SlashCommandBuilder()
  .setName("متجر-البنك")
  .setDescription("🛒 تسوّق بذهب البنك المركزي — رتب ومميزات حصرية");

const BANK_SHOP_ITEMS = [
  { id: "vip_role",    label: "رتبة VIP",          description: "رتبة VIP حصرية في السيرفر",      price: 5000,  emoji: "👑" },
  { id: "color_role",  label: "رتبة لون مخصص",    description: "غيّر لون اسمك في السيرفر",        price: 3000,  emoji: "🎨" },
  { id: "badge_gold",  label: "شارة ذهبية",       description: "شارة ذهبية تظهر في بروفايلك",    price: 2000,  emoji: "🏅" },
  { id: "xp_boost",   label: "بوست XP أسبوع",     description: "ضاعف XP بتاعتك لمدة أسبوع",     price: 4000,  emoji: "⚡" },
  { id: "custom_name", label: "اسم مخصص في البوت", description: "البوت هيناديك باسمك الخاص",     price: 1500,  emoji: "✏️" },
];

export async function handleShopCommand(interaction, db) {
  const cbProfile = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const balance   = cbProfile?.balance || 0;

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle("🛒 متجر البنك المركزي")
    .setDescription(
      `**رصيدك الحالي:** \`${fmtNum(balance)}\` 💰\n\n` +
      "```\n⚜️  اختار العنصر اللي عايز تشتريه\n```"
    )
    .addFields(
      BANK_SHOP_ITEMS.map(item => ({
        name: `${item.emoji} ${item.label}`,
        value: `${item.description}\n**السعر:** \`${fmtNum(item.price)}\` 💰`,
        inline: true,
      }))
    )
    .setFooter(footer("متجر البنك المركزي"))
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId("shop_menu")
    .setPlaceholder("Make a selection")
    .addOptions(
      BANK_SHOP_ITEMS.map(item => ({
        label:       item.label,
        description: `${fmtNum(item.price)} 💰 — ${item.description}`,
        value:       item.id,
        emoji:       item.emoji,
      }))
    );

  return interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

export async function handleShopSelect(interaction, db) {
  if (interaction.customId !== "shop_menu") return;

  const itemId = interaction.values[0];
  const item   = BANK_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return interaction.reply({ content: "❌ عنصر غير موجود!", ephemeral: true });

  const cbProfile = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  const balance   = cbProfile?.balance || 0;

  if (balance < item.price) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle("❌ رصيد غير كافٍ")
        .setDescription(
          `محتاج **${fmtNum(item.price)} 💰** عشان تشتري **${item.emoji} ${item.label}**\n` +
          `رصيدك الحالي: \`${fmtNum(balance)}\` 💰\n\n` +
          `استخدم \`/بنك\` عشان تزود رصيدك!`
        )
        .setFooter(footer("متجر البنك المركزي"))],
      ephemeral: true,
    });
  }

  db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
    balance: balance - item.price,
  });

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`✅ تم الشراء بنجاح!`)
      .setDescription(
        `اشتريت **${item.emoji} ${item.label}** بـ \`${fmtNum(item.price)}\` 💰\n\n` +
        `💰 **رصيدك الآن:** \`${fmtNum(balance - item.price)}\``
      )
      .setFooter(footer("متجر البنك المركزي"))
      .setTimestamp()],
    ephemeral: true,
  });
}
