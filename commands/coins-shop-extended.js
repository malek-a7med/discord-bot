// ═══════════════════════════════════════════════════════════════
//  🛒 متجر الكوينز الشامل — ألقاب + ألوان رول + إيموجي خاص
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} from "discord.js";

export const SHOP_ITEMS = {
  titles: {
    legend:  { id: "legend",  name: "🏆 الأسطورة",    price: 3000,  emoji: "🏆" },
    shadow:  { id: "shadow",  name: "🌑 الظل",         price: 2000,  emoji: "🌑" },
    king:    { id: "king",    name: "👑 الملك",         price: 5000,  emoji: "👑" },
    dragon:  { id: "dragon",  name: "🐉 التنين",        price: 4000,  emoji: "🐉" },
    ghost:   { id: "ghost",   name: "👻 الشبح",         price: 1500,  emoji: "👻" },
    devil:   { id: "devil",   name: "😈 الشيطان",       price: 2500,  emoji: "😈" },
    angel:   { id: "angel",   name: "😇 الملاك",        price: 2500,  emoji: "😇" },
    pharaoh: { id: "pharaoh", name: "⚜️ الفرعون",       price: 6000,  emoji: "⚜️" },
    noob:    { id: "noob",    name: "🐣 النوب",         price: 100,   emoji: "🐣" },
    toxic:   { id: "toxic",   name: "☠️ التوكسيك",      price: 1800,  emoji: "☠️" },
  },
  roleColors: {
    red:    { id: "red",    name: "🔴 أحمر",     price: 1000, color: 0xFF4444 },
    blue:   { id: "blue",   name: "🔵 أزرق",     price: 1000, color: 0x4488FF },
    green:  { id: "green",  name: "🟢 أخضر",     price: 1000, color: 0x44CC44 },
    gold:   { id: "gold",   name: "🟡 ذهبي",     price: 2000, color: 0xFFD700 },
    purple: { id: "purple", name: "🟣 بنفسجي",   price: 1500, color: 0xAA44FF },
    orange: { id: "orange", name: "🟠 برتقالي",  price: 1000, color: 0xFF8800 },
    pink:   { id: "pink",   name: "🌸 وردي",     price: 1500, color: 0xFF69B4 },
    cyan:   { id: "cyan",   name: "🩵 سماوي",    price: 1500, color: 0x00BFFF },
    white:  { id: "white",  name: "⚪ أبيض",     price: 800,  color: 0xFFFFFF },
    black:  { id: "black",  name: "⚫ أسود",     price: 800,  color: 0x333333 },
  },
  emojis: {
    fire:    { id: "fire",    name: "🔥 نار",     price: 500,  emoji: "🔥" },
    star:    { id: "star",    name: "⭐ نجمة",    price: 500,  emoji: "⭐" },
    crown:   { id: "crown",   name: "👑 تاج",     price: 800,  emoji: "👑" },
    zap:     { id: "zap",     name: "⚡ برق",     price: 500,  emoji: "⚡" },
    diamond: { id: "diamond", name: "💎 ماسة",    price: 1000, emoji: "💎" },
    skull:   { id: "skull",   name: "💀 جمجمة",  price: 700,  emoji: "💀" },
    snake:   { id: "snake",   name: "🐍 تعبان",  price: 600,  emoji: "🐍" },
    rose:    { id: "rose",    name: "🌹 وردة",   price: 500,  emoji: "🌹" },
    sword:   { id: "sword",   name: "⚔️ سيف",    price: 700,  emoji: "⚔️" },
    moon:    { id: "moon",    name: "🌙 قمر",    price: 500,  emoji: "🌙" },
  },
};

export const coinsShopCommand = new SlashCommandBuilder()
  .setName("متجر")
  .setDescription("🛒 متجر الكوينز — ألقاب، ألوان رول، إيموجي خاص")
  .addSubcommand(sub => sub.setName("عرض").setDescription("اعرض كل حاجة في المتجر"))
  .addSubcommand(sub =>
    sub.setName("شراء-لقب").setDescription("اشتري لقب خاص يظهر في بروفايلك")
      .addStringOption(o =>
        o.setName("اللقب").setDescription("اختار اللقب").setRequired(true)
          .addChoices(...Object.values(SHOP_ITEMS.titles).map(t => ({ name: t.name, value: t.id })))
      )
  )
  .addSubcommand(sub =>
    sub.setName("شراء-لون").setDescription("اشتري لون رول خاص")
      .addStringOption(o =>
        o.setName("اللون").setDescription("اختار اللون").setRequired(true)
          .addChoices(...Object.values(SHOP_ITEMS.roleColors).map(c => ({ name: c.name, value: c.id })))
      )
  )
  .addSubcommand(sub =>
    sub.setName("شراء-إيموجي").setDescription("اشتري إيموجي يظهر جنب اسمك")
      .addStringOption(o =>
        o.setName("الإيموجي").setDescription("اختار الإيموجي").setRequired(true)
          .addChoices(...Object.values(SHOP_ITEMS.emojis).map(e => ({ name: e.name, value: e.id })))
      )
  )
  .addSubcommand(sub => sub.setName("مقتنياتي").setDescription("اعرض اللي اشتريته"));

function buildShopEmbed(db, userId) {
  const user = db.getUser(userId);
  const coins = user.coins || 0;
  const purchases = user.shopPurchases || {};

  const titlesText = Object.values(SHOP_ITEMS.titles)
    .map(t => {
      const owned = purchases.titles?.includes(t.id);
      const active = purchases.activeTitle === t.id;
      return `${owned ? "✅" : "❌"} ${t.name} — **${t.price}🪙**${active ? " *(مفعّل)*" : ""}`;
    }).join("\n");

  const colorsText = Object.values(SHOP_ITEMS.roleColors)
    .map(c => {
      const owned = purchases.colors?.includes(c.id);
      return `${owned ? "✅" : "❌"} ${c.name} — **${c.price}🪙**`;
    }).join("\n");

  const emojisText = Object.values(SHOP_ITEMS.emojis)
    .map(e => {
      const owned = purchases.emojis?.includes(e.id);
      const active = purchases.activeEmoji === e.id;
      return `${owned ? "✅" : "❌"} ${e.name} — **${e.price}🪙**${active ? " *(مفعّل)*" : ""}`;
    }).join("\n");

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("🛒 متجر الكوينز — سيرفر الفراعنة")
    .setDescription(`💰 رصيدك: **${coins} 🪙**\n✅ = عندك | ❌ = مش عندك`)
    .addFields(
      { name: "👑 ألقاب", value: titlesText, inline: false },
      { name: "🎨 ألوان رول", value: colorsText, inline: false },
      { name: "✨ إيموجيات", value: emojisText, inline: false },
    )
    .setFooter({ text: "استخدم /متجر شراء-لقب / شراء-لون / شراء-إيموجي للشراء" })
    .setTimestamp();
}

export async function handleCoinsShop(interaction, db) {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const user = db.getUser(userId);

  if (!user.shopPurchases) user.shopPurchases = { titles: [], colors: [], emojis: [], activeTitle: null, activeEmoji: null };

  if (sub === "عرض") {
    return interaction.reply({ embeds: [buildShopEmbed(db, userId)], ephemeral: true });
  }

  if (sub === "مقتنياتي") {
    const p = user.shopPurchases;
    const titles = (p.titles || []).map(id => SHOP_ITEMS.titles[id]?.name || id).join(", ") || "مفيش";
    const colors = (p.colors || []).map(id => SHOP_ITEMS.roleColors[id]?.name || id).join(", ") || "مفيش";
    const emojis = (p.emojis || []).map(id => SHOP_ITEMS.emojis[id]?.name || id).join(", ") || "مفيش";
    const activeT = SHOP_ITEMS.titles[p.activeTitle]?.name || "مفيش";
    const activeE = SHOP_ITEMS.emojis[p.activeEmoji]?.emoji || "مفيش";

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("🎒 مقتنياتك من المتجر")
        .addFields(
          { name: "👑 ألقاب عندك", value: titles, inline: false },
          { name: "🎨 ألوان عندك", value: colors, inline: false },
          { name: "✨ إيموجيات عندك", value: emojis, inline: false },
          { name: "⚡ اللقب المفعّل", value: activeT, inline: true },
          { name: "⚡ الإيموجي المفعّل", value: activeE, inline: true },
        )
        .setTimestamp()],
      ephemeral: true
    });
  }

  if (sub === "شراء-لقب") {
    const id = interaction.options.getString("اللقب");
    const item = SHOP_ITEMS.titles[id];
    if (!item) return interaction.reply({ content: "❌ اللقب ده مش موجود!", ephemeral: true });

    const p = user.shopPurchases;
    if (!p.titles) p.titles = [];

    if (p.titles.includes(id)) {
      p.activeTitle = id;
      db.updateUser(userId, { shopPurchases: p });
      return interaction.reply({ content: `✅ فعّلت لقب **${item.name}** — هيظهر في بروفايلك دلوقتي!`, ephemeral: true });
    }

    if ((user.coins || 0) < item.price) {
      return interaction.reply({ content: `❌ معندكش كوينز كفاية! محتاج ${item.price}🪙 وعندك ${user.coins || 0}🪙`, ephemeral: true });
    }

    p.titles.push(id);
    p.activeTitle = id;
    db.updateUser(userId, { coins: (user.coins || 0) - item.price, shopPurchases: p });
    return interaction.reply({
      content: `🎉 اشتريت وفعّلت لقب **${item.name}**!\nاتخصم **${item.price}🪙** — رصيدك دلوقتي: **${(user.coins || 0) - item.price}🪙**`,
      ephemeral: true
    });
  }

  if (sub === "شراء-لون") {
    const id = interaction.options.getString("اللون");
    const item = SHOP_ITEMS.roleColors[id];
    if (!item) return interaction.reply({ content: "❌ اللون ده مش موجود!", ephemeral: true });

    const p = user.shopPurchases;
    if (!p.colors) p.colors = [];

    if (p.colors.includes(id)) {
      await applyColorRole(interaction, item);
      return interaction.reply({ content: `✅ طبّقت لون **${item.name}** على رول خاص بيك!`, ephemeral: true });
    }

    if ((user.coins || 0) < item.price) {
      return interaction.reply({ content: `❌ معندكش كوينز كفاية! محتاج ${item.price}🪙 وعندك ${user.coins || 0}🪙`, ephemeral: true });
    }

    p.colors.push(id);
    db.updateUser(userId, { coins: (user.coins || 0) - item.price, shopPurchases: p });
    await applyColorRole(interaction, item);
    return interaction.reply({
      content: `🎨 اشتريت لون **${item.name}**!\nاتخصم **${item.price}🪙** — رصيدك دلوقتي: **${(user.coins || 0) - item.price}🪙**`,
      ephemeral: true
    });
  }

  if (sub === "شراء-إيموجي") {
    const id = interaction.options.getString("الإيموجي");
    const item = SHOP_ITEMS.emojis[id];
    if (!item) return interaction.reply({ content: "❌ الإيموجي ده مش موجود!", ephemeral: true });

    const p = user.shopPurchases;
    if (!p.emojis) p.emojis = [];

    if (p.emojis.includes(id)) {
      p.activeEmoji = id;
      db.updateUser(userId, { shopPurchases: p });
      return interaction.reply({ content: `✅ فعّلت إيموجي **${item.name}** — هيظهر في بروفايلك دلوقتي!`, ephemeral: true });
    }

    if ((user.coins || 0) < item.price) {
      return interaction.reply({ content: `❌ معندكش كوينز كفاية! محتاج ${item.price}🪙 وعندك ${user.coins || 0}🪙`, ephemeral: true });
    }

    p.emojis.push(id);
    p.activeEmoji = id;
    db.updateUser(userId, { coins: (user.coins || 0) - item.price, shopPurchases: p });
    return interaction.reply({
      content: `✨ اشتريت إيموجي **${item.name}**!\nاتخصم **${item.price}🪙** — رصيدك دلوقتي: **${(user.coins || 0) - item.price}🪙**`,
      ephemeral: true
    });
  }
}

async function applyColorRole(interaction, colorItem) {
  try {
    const guild = interaction.guild;
    if (!guild) return;
    const member = await guild.members.fetch(interaction.user.id);
    const roleName = `🎨 ${colorItem.name}`;
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      role = await guild.roles.create({
        name: roleName,
        color: colorItem.color,
        reason: "رول لون من متجر الكوينز",
        position: 1,
      });
    }
    const oldColorRoles = member.roles.cache.filter(r => r.name.startsWith("🎨 "));
    for (const [, r] of oldColorRoles) {
      await member.roles.remove(r).catch(() => {});
    }
    await member.roles.add(role);
  } catch (e) {
    console.error("[CoinsShop] خطأ في تطبيق لون الرول:", e.message);
  }
}
