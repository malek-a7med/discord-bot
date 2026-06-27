// ═══════════════════════════════════════════════════════════════
//  🏪 متجر قدرات الألعاب
//  قدرات: حياة إضافية | طرد مزدوج | نيوك
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";

export const ABILITIES = {
  extra_life: {
    id: "extra_life",
    name: "💚 حياة إضافية",
    price: 500,
    max: 3,
    desc: "تنجو من موتة واحدة في الروليت — تشتغل تلقائياً لما تتضرب",
    shortDesc: "تنجو من موتة واحدة",
  },
  double_kick: {
    id: "double_kick",
    name: "💥 طرد مزدوج",
    price: 800,
    max: 2,
    desc: "لما تتطرد من الروليت تطرد معك شخص عشوائي تاني",
    shortDesc: "لما تتطرد تطرد واحد معاك",
  },
  nuke: {
    id: "nuke",
    name: "☢️ نيوك",
    price: 2000,
    max: 1,
    desc: "اضغط زر النيوك في الروليت وتطرد الكل وتفوز فوراً — قوي جداً!",
    shortDesc: "تطرد الكل وتفوز فوراً",
  },
};

function buildShopEmbed(db, userId) {
  const abilities = db.getGameAbilities(userId);
  const user = db.getUser(userId);
  const fields = Object.values(ABILITIES).map(ab => ({
    name: `${ab.name} — 🪙 ${ab.price} كوينز`,
    value: `${ab.desc}\n📦 عندك: **${abilities[ab.id] || 0}** / الحد: **${ab.max}**`,
    inline: false,
  }));

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🏪 متجر قدرات الألعاب")
    .setDescription(`💰 رصيدك: **${user.coins || 0} 🪙**\n\nاشتري قدرات عشان تستخدمها في ألعاب الروليت والمافيا!`)
    .addFields(fields)
    .setFooter({ text: "اضغط على الزرار عشان تشتري قدرة" })
    .setTimestamp();
}

function buildShopRows(db, userId) {
  const abilities = db.getGameAbilities(userId);
  const user = db.getUser(userId);
  const buttons = Object.values(ABILITIES).map(ab => {
    const owned = abilities[ab.id] || 0;
    const canBuy = owned < ab.max && (user.coins || 0) >= ab.price;
    return new ButtonBuilder()
      .setCustomId(`gshop_buy_${ab.id}_${userId}`)
      .setLabel(`${ab.name.split(" ")[0]} شراء`)
      .setStyle(canBuy ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!canBuy);
  });

  return [new ActionRowBuilder().addComponents(buttons)];
}

export async function handleShopCommand(interaction, db) {
  const embed = buildShopEmbed(db, interaction.user.id);
  const rows  = buildShopRows(db, interaction.user.id);
  return interaction.reply({ embeds: [embed], components: rows });
}

export async function handleMyAbilitiesCommand(interaction, db) {
  const abilities = db.getGameAbilities(interaction.user.id);
  const user = db.getUser(interaction.user.id);

  const hasAny = Object.values(ABILITIES).some(ab => (abilities[ab.id] || 0) > 0);

  const fields = Object.values(ABILITIES).map(ab => ({
    name: ab.name,
    value: `${ab.shortDesc}\n📦 **${abilities[ab.id] || 0}** قطعة`,
    inline: true,
  }));

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("💼 قدراتك الحالية")
    .setDescription(
      hasAny
        ? `🪙 رصيدك: **${user.coins || 0}**\n\nدي القدرات اللي عندك دلوقتي وتقدر تستخدمها في الألعاب:`
        : `🪙 رصيدك: **${user.coins || 0}**\n\n❌ ما عندكش أي قدرات دلوقتي.\nروح على \`/متجر-قدرات\` عشان تشتري!`
    )
    .addFields(fields)
    .setFooter({ text: "القدرات بتشتغل تلقائياً في الروليت أو من زرار في اللعبة" })
    .setTimestamp();

  const shopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gshop_open_${interaction.user.id}`).setLabel("🏪 افتح المتجر").setStyle(ButtonStyle.Primary)
  );

  return interaction.reply({ embeds: [embed], components: [shopRow] });
}

export async function handleShopButton(interaction, db) {
  const id = interaction.customId;

  // فتح المتجر من زرار القدرات
  if (id.startsWith("gshop_open_")) {
    const embed = buildShopEmbed(db, interaction.user.id);
    const rows  = buildShopRows(db, interaction.user.id);
    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  }

  // شراء قدرة
  if (id.startsWith("gshop_buy_")) {
    const parts    = id.split("_");
    const abilityId = parts[2];
    const requesterId = parts[3];

    if (interaction.user.id !== requesterId) {
      return interaction.reply({ content: "❌ الزرار ده مش إلك!", ephemeral: true });
    }

    const ability = ABILITIES[abilityId];
    if (!ability) return interaction.reply({ content: "❌ قدرة غير موجودة!", ephemeral: true });

    const user     = db.getUser(interaction.user.id);
    const abilities = db.getGameAbilities(interaction.user.id);
    const owned    = abilities[abilityId] || 0;

    if (owned >= ability.max) {
      return interaction.reply({ content: `❌ وصلت للحد الأقصى لـ ${ability.name}!`, ephemeral: true });
    }

    if ((user.coins || 0) < ability.price) {
      return interaction.reply({ content: `❌ ما عندكش كوينز كافية! لازم **${ability.price} 🪙** وعندك **${user.coins || 0} 🪙**`, ephemeral: true });
    }

    db.updateUser(interaction.user.id, { coins: (user.coins || 0) - ability.price });
    db.addGameAbility(interaction.user.id, abilityId);

    const newAbilities = db.getGameAbilities(interaction.user.id);
    const successEmbed = new EmbedBuilder()
      .setColor(0x27ae60)
      .setTitle(`✅ اشتريت ${ability.name}!`)
      .setDescription(`${ability.desc}\n\n📦 عندك دلوقتي: **${newAbilities[abilityId]}** قطعة\n🪙 رصيدك المتبقي: **${db.getUser(interaction.user.id).coins}**`)
      .setTimestamp();

    // حدّث أزرار المتجر
    const rows = buildShopRows(db, interaction.user.id);
    const shopEmbed = buildShopEmbed(db, interaction.user.id);
    await interaction.update({ embeds: [shopEmbed], components: rows });
    return interaction.followUp({ embeds: [successEmbed], ephemeral: true });
  }
}

// تعريف الأوامر
export const shopCommand = new SlashCommandBuilder()
  .setName("متجر-قدرات")
  .setDescription("🏪 اشتري قدرات للألعاب بالكوينز");

export const myAbilitiesCommand = new SlashCommandBuilder()
  .setName("قدراتي")
  .setDescription("💼 شوف قدراتك الحالية للألعاب");
