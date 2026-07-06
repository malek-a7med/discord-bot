// ============================================================
// 🏆 قناة التوب + 🛡️ بوابة التحقق + 🛒 متجر البنك المركزي
// كل ميزة أمر واحد بس — زي ما اتفقنا
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

const PHARAOH_PURPLE = 0x9b59b6;
const VERIFIED_ROLE_NAME = "Verified";
const VERIFY_BUTTON_ID = "verify_gate_accept";

// ── /top — أعلى 10 أعضاء حسب الـ XP ─────────────────────────────
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

  if (ranked.length === 0) {
    return interaction.editReply("📭 لسه محدش عنده XP كفاية عشان يظهر في التوب!");
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = await Promise.all(
    ranked.map(async (u, i) => {
      const rankIcon = medals[i] || `**#${i + 1}**`;
      let name = `<@${u.userId}>`;
      try {
        const member = await interaction.guild.members.fetch(u.userId);
        name = member.displayName;
      } catch {}
      return `${rankIcon} **${name}** — المستوى \`${u.level}\` | \`${u.xp}\` XP`;
    })
  );

  const embed = new EmbedBuilder()
    .setColor(PHARAOH_PURPLE)
    .setTitle("𓋹 لوحة الأكثر نشاطاً 𓋹")
    .setDescription(lines.join("\n\n"))
    .setThumbnail(interaction.guild.iconURL?.({ dynamic: true }) || null)
    .setFooter({ text: "🏆 التوب بيتحدث كل ما الأعضاء يتفاعلوا في السيرفر" })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── /بوابة-التحقق — رسالة تحقق بزرار واحد ──────────────────────
export const verifyGateCommand = new SlashCommandBuilder()
  .setName("بوابة-التحقق")
  .setDescription("🛡️ انشر رسالة بوابة التحقق في الروم ده [إدارة]")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleVerifyGateCommand(interaction) {
  const embed = new EmbedBuilder()
    .setColor(PHARAOH_PURPLE)
    .setTitle("𓂀 بوابة الدخول للسيرفر 𓂀")
    .setDescription(
      "قبل ما تشوف باقي الرومات، لازم توافق على قوانين السيرفر.\n\n" +
      "دوس على الزرار تحت عشان تأكد إنك موافق على القوانين، وهتفتحلك باقي الرومات على طول ✅"
    )
    .setFooter({ text: "🔐 التحقق بياخد ثانية واحدة بس" });

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
      color: 0x5865f2,
      hoist: false,
      reason: "رتبة التحقق — بوابة الدخول",
    });
  }
  return role;
}

export async function handleVerifyButton(interaction) {
  if (interaction.customId !== VERIFY_BUTTON_ID) return false;

  const member = interaction.member;
  const role = await ensureVerifiedRole(interaction.guild);

  if (member.roles.cache.has(role.id)) {
    await interaction.reply({ content: "✅ إنت متحقق بالفعل يا نجم، استمتع بالسيرفر!", ephemeral: true });
    return true;
  }

  try {
    await member.roles.add(role);
    await interaction.reply({ content: "🎉 تم التحقق بنجاح! اتفتحلك باقي رومات السيرفر، أهلاً بيك 𓂀", ephemeral: true });
  } catch (err) {
    await interaction.reply({ content: "❌ حصلت مشكلة وأنا بديك الرتبة — تأكد إن رتبة البوت فوق رتبة Verified في ترتيب الرتب.", ephemeral: true });
  }
  return true;
}

// ── /متجر — متجر البنك المركزي بأمر واحد وقايمة اختيار ──────────
const SHOP_ITEMS = [
  { value: "role_golden",   label: "رتبة Golden 🥇",         price: 15000, emoji: "🥇", type: "role", roleName: "Golden" },
  { value: "role_silver",   label: "رتبة Silver 🥈",         price: 8000,  emoji: "🥈", type: "role", roleName: "Silver" },
  { value: "role_bronze",   label: "رتبة Bronze 🥉",         price: 3000,  emoji: "🥉", type: "role", roleName: "Bronze" },
  { value: "perk_color",    label: "تغيير لون اسمك",         price: 5000,  emoji: "🎨", type: "perk" },
  { value: "perk_shoutout",  label: "إعلان شخصي في السيرفر", price: 10000, emoji: "📢", type: "perk" },
];

export const bankShopCommand = new SlashCommandBuilder()
  .setName("متجر")
  .setDescription("🛒 متجر البنك المركزي — اشتري رتب ومميزات بذهب البنك");

function buildShopEmbed(balance) {
  const lines = SHOP_ITEMS.map(
    (i) => `${i.emoji} **${i.label}** — \`${i.price.toLocaleString("en-US")}\` ذهب`
  ).join("\n");

  return new EmbedBuilder()
    .setColor(PHARAOH_PURPLE)
    .setTitle("𓋹 متجر البنك المركزي 𓋹")
    .setDescription(`اختار اللي عايز تشتريه من القايمة تحت 👇\n\n${lines}`)
    .addFields({ name: "👛 رصيدك الحالي", value: `\`${balance.toLocaleString("en-US")}\` ذهب`, inline: true })
    .setFooter({ text: "🛒 اختار حاجة من القايمة عشان تشتريها فوراً" });
}

function buildShopSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("shop_menu")
    .setPlaceholder("Make a selection")
    .addOptions(
      SHOP_ITEMS.map((i) => ({
        label: i.label,
        value: i.value,
        emoji: i.emoji,
        description: `${i.price.toLocaleString("en-US")} ذهب`,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

export async function handleShopCommand(interaction, db) {
  const profile = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  return interaction.reply({
    embeds: [buildShopEmbed(profile.balance)],
    components: [buildShopSelectRow()],
  });
}

export async function handleShopSelect(interaction, db) {
  if (interaction.customId !== "shop_menu") return false;

  const choice = interaction.values[0];
  const item = SHOP_ITEMS.find((i) => i.value === choice);
  if (!item) {
    await interaction.reply({ content: "❌ الحاجة دي مش موجودة في المتجر.", ephemeral: true });
    return true;
  }

  const profile = db.getCentralBankProfile(interaction.guildId, interaction.user.id);
  if (profile.balance < item.price) {
    await interaction.reply({
      content: `❌ رصيدك مش كفاية! محتاج \`${item.price.toLocaleString("en-US")}\` ذهب وعندك بس \`${profile.balance.toLocaleString("en-US")}\`.`,
      ephemeral: true,
    });
    return true;
  }

  db.saveCentralBankProfile(interaction.guildId, interaction.user.id, {
    balance: profile.balance - item.price,
  });

  if (item.type === "role") {
    try {
      let role = interaction.guild.roles.cache.find((r) => r.name === item.roleName);
      if (!role) {
        role = await interaction.guild.roles.create({
          name: item.roleName,
          color: item.roleName === "Golden" ? 0xffd700 : item.roleName === "Silver" ? 0xc0c0c0 : 0xcd7f32,
          reason: "شراء من متجر البنك المركزي",
        });
      }
      await interaction.member.roles.add(role);
      await interaction.reply({ content: `🎉 مبروك! اشتريت رتبة **${item.roleName}** بـ \`${item.price.toLocaleString("en-US")}\` ذهب.`, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ حصلت مشكلة في إعطائك الرتبة، كلم الإدارة.", ephemeral: true });
    }
  } else {
    await interaction.reply({
      content: `🎉 تم شراء **${item.label}** بـ \`${item.price.toLocaleString("en-US")}\` ذهب! كلم الإدارة عشان يفعّلها ليك.`,
      ephemeral: true,
    });
  }
  return true;
}
