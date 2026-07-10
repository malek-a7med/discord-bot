// ═══════════════════════════════════════════════════════════════
//  🎫 نظام التذاكر — زر في لوحة Auto-Mod
// ═══════════════════════════════════════════════════════════════
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";

const TICKET_CATEGORY_NAME = "✦──── 𝑻𝑰𝑪𝑲𝑬𝑻 𝑺𝑼𝑷𝑷𝑶𝑹𝑻 ─────✦";
const TICKET_LOG_CHANNEL_NAME = "ticket-logs";
const openTickets = new Map(); // userId → channelId
const TICKET_MENTION_ROLE_IDS = [
  "1485896430957625372",
  "1509478513407824033",
  "1520022076491300975",
  "1516027381456830624",
];

export function buildTicketButton() {
  return new ButtonBuilder()
    .setCustomId("open_ticket")
    .setLabel("🎫 افتح تذكرة")
    .setStyle(ButtonStyle.Success);
}

export async function handleTicketButton(interaction, db) {
  const userId = interaction.user.id;
  const guild = interaction.guild;

  if (!guild) return interaction.reply({ content: "❌ الأمر ده بيشتغل في السيرفر بس!", ephemeral: true });

  if (openTickets.has(userId)) {
    const existingCh = guild.channels.cache.get(openTickets.get(userId));
    if (existingCh) {
      return interaction.reply({ content: `❌ عندك تذكرة مفتوحة بالفعل: ${existingCh}`, ephemeral: true });
    }
    openTickets.delete(userId);
  }

  const modal = new ModalBuilder()
    .setCustomId("ticket_modal")
    .setTitle("🎫 افتح تذكرة دعم");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_reason")
        .setLabel("موضوع التذكرة")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("اكتب المشكلة أو الموضوع اللي محتاج فيه مساعدة...")
        .setRequired(true)
        .setMaxLength(500)
    )
  );

  return interaction.showModal(modal);
}

export async function handleTicketModalSubmit(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const guild = interaction.guild;
  const reason = interaction.fields.getTextInputValue("ticket_reason");

  let category = guild.channels.cache.find(c =>
    c.type === ChannelType.GuildCategory &&
    (c.name.includes("التذاكر") || c.name.includes("TICKET") || c.name === TICKET_CATEGORY_NAME)
  );

  if (!category) {
    try {
      category = await guild.channels.create({
        name: TICKET_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
      });
    } catch {
      category = null;
    }
  }

  const ticketNum = Date.now().toString().slice(-5);
  const channelName = `🎫・تذكرة-${interaction.user.username.slice(0,10)}-${ticketNum}`;

  const permsOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  const adminRole = guild.roles.cache.find(r =>
    r.permissions.has(PermissionFlagsBits.Administrator) && !r.managed
  );
  if (adminRole) {
    permsOverwrites.push({
      id: adminRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
    });
  }

  const mentionRoles = TICKET_MENTION_ROLE_IDS
    .map(id => guild.roles.cache.get(id))
    .filter(Boolean);
  for (const role of mentionRoles) {
    permsOverwrites.push({
      id: role.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: permsOverwrites,
      topic: `تذكرة دعم لـ ${interaction.user.tag} | ${reason.slice(0, 100)}`,
    });
  } catch (e) {
    return interaction.editReply({ content: "❌ مقدرتش أعمل قناة للتذكرة — اتأكد إن البوت عنده صلاحية Manage Channels!" });
  }

  openTickets.set(userId, ticketChannel.id);

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close|${userId}`)
      .setLabel("🔒 إغلاق التذكرة")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_claim|${userId}`)
      .setLabel("✋ تولّى التذكرة")
      .setStyle(ButtonStyle.Primary),
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🎫 تذكرة دعم جديدة")
    .setDescription(`👤 **صاحب التذكرة:** ${interaction.user}\n\n📝 **الموضوع:**\n${reason}`)
    .addFields(
      { name: "📅 التاريخ", value: new Date().toLocaleString("ar-EG"), inline: true },
      { name: "🆔 المعرّف", value: `\`${userId}\``, inline: true },
    )
    .setFooter({ text: "اضغط 🔒 لإغلاق التذكرة لما تخلص" })
    .setTimestamp();

  const roleMentions = mentionRoles.length > 0
    ? mentionRoles.map(r => `<@&${r.id}>`).join(" ")
    : (adminRole ? `${adminRole}` : "الإدارة");

  await ticketChannel.send({
    content: `${interaction.user} ${roleMentions} — تذكرة جديدة تحتاج مراجعة! 🔔`,
    embeds: [embed],
    components: [closeRow],
  });

  await interaction.editReply({
    content: `✅ اتعملت تذكرتك! روح: ${ticketChannel} وفيها اكتب اللي محتاجه 🎫`,
  });
}

export async function handleTicketClose(interaction, db) {
  const parts = interaction.customId.split("|");
  const ownerId = parts[1];
  const guild = interaction.guild;
  const channel = interaction.channel;

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isOwner = interaction.user.id === ownerId;

  if (!isAdmin && !isOwner) {
    return interaction.reply({ content: "❌ بس صاحب التذكرة أو الإدارة يقدروا يقفلوها!", ephemeral: true });
  }

  await interaction.reply({ content: "🔒 هيتم إغلاق التذكرة خلال 5 ثواني..." });

  await logTicket(guild, channel, ownerId).catch(() => {});

  openTickets.delete(ownerId);

  setTimeout(async () => {
    await channel.delete("إغلاق تذكرة دعم").catch(() => {});
  }, 5000);
}

export async function handleTicketClaim(interaction) {
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
  if (!isAdmin) return interaction.reply({ content: "❌ الإدارة بس تقدر تتولى التذكرة!", ephemeral: true });

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x3498db)
      .setDescription(`✅ **${interaction.user.displayName}** تولّى التذكرة دي`)
    ]
  });
}

async function logTicket(guild, channel, ownerId) {
  const logChannel = guild.channels.cache.find(c =>
    c.name.includes("ticket-log") || c.name.includes("سجل-التذاكر")
  );
  if (!logChannel) return;

  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const transcript = messages
    ? [...messages.values()].reverse()
        .filter(m => !m.author.bot || m.embeds.length === 0)
        .slice(0, 20)
        .map(m => `[${m.author.username}]: ${m.content || "(embed)"}`)
        .join("\n")
    : "مفيش رسايل";

  await logChannel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔒 تذكرة اتقفلت")
      .addFields(
        { name: "📌 اسم القناة", value: channel.name, inline: true },
        { name: "👤 صاحب التذكرة", value: `<@${ownerId}>`, inline: true },
        { name: "📝 آخر 20 رسالة", value: transcript.slice(0, 1000) || "—", inline: false },
      )
      .setTimestamp()
    ]
  }).catch(() => {});
}
