// ═══════════════════════════════════════════════════════════════
//  /setup — لوحة إعداد شاملة للسيرفر
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export const DEFAULT_WELCOME_MSG =
  "👋 أهلاً **{mention}** في **{server}**!\nأنت العضو رقم **{count}**. نتمنالك وقت حلو معنا 🎉";
export const DEFAULT_GOODBYE_MSG =
  "🥀 وداعاً **{user}** — شكراً على وجودك معنا.\nعدد الأعضاء الآن: **{count}**.";

export const PLACEHOLDER_GUIDE =
  "`{mention}` منشن • `{user}` اسم • `{server}` سيرفر • `{count}` عدد أعضاء • `{id}` الـ ID";

export function applyPlaceholders(template, { mention = "", user = "", server = "", count = 0, id = "" } = {}) {
  return String(template)
    .replace(/{mention}/g, mention)
    .replace(/{user}/g,    user)
    .replace(/{server}/g,  server)
    .replace(/{count}/g,   String(count))
    .replace(/{id}/g,      id);
}

// ─── الأمر ─────────────────────────────────────────────────────
export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("⚙️ لوحة إعداد السيرفر الشاملة [أدمن]")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ─── بناء لوحة الإعداد الرئيسية ────────────────────────────────
function buildMainPanel(guildId, db) {
  const wCh  = db.getWelcomeChannel(guildId);
  const gCh  = db.getGoodbyeChannel(guildId);
  const trap = db.getTrapChannel(guildId);
  const log  = db.getLogChannel   ? db.getLogChannel(guildId)    : null;
  const vrfy = db.getVerifyChannel ? db.getVerifyChannel(guildId) : null;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("⚙️ لوحة إعداد السيرفر")
    .setDescription("اختر القسم اللي تريد تعديله من الأزرار تحت:")
    .addFields(
      { name: "👋 قناة الترحيب",   value: wCh   ? `<#${wCh}>`   : "غير محددة", inline: true },
      { name: "🥀 قناة الوداع",    value: gCh   ? `<#${gCh}>`   : "غير محددة", inline: true },
      { name: "📜 قناة السجلات",   value: log   ? `<#${log}>`   : "غير محددة", inline: true },
      { name: "🪤 مصيدة الهاكرات", value: trap  ? `<#${trap}>`  : "غير محددة", inline: true },
      { name: "🔐 بوابة التحقق",   value: vrfy  ? `<#${vrfy}>`  : "غير محددة", inline: true },
    )
    .setFooter({ text: "التعديلات تُحفظ فور اختيارها" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_welcome_ch").setLabel("👋 ترحيب").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_goodbye_ch").setLabel("🥀 وداع").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_log_ch").setLabel("📜 سجلات").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_trap_ch").setLabel("🪤 مصيدة").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("setup_verify_ch").setLabel("🔐 تحقق").setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_welcome_msg").setLabel("✏️ رسالة ترحيب").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setup_goodbye_msg").setLabel("✏️ رسالة وداع").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setup_modroles").setLabel("👮 رتب إشراف").setStyle(ButtonStyle.Secondary),
  );

  return { embed, components: [row1, row2] };
}

// ─── تنفيذ الأمر ────────────────────────────────────────────────
export async function handleSetupCommand(interaction, db) {
  const { embed, components } = buildMainPanel(interaction.guild.id, db);
  await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// ─── معالج كل تفاعلات setup_ ───────────────────────────────────
export async function handleSetupInteraction(interaction, db, client) {
  const id = interaction.customId;

  // ── اختيار قناة ترحيب ──
  if (id === "setup_welcome_ch") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("setup_set_welcome_ch")
        .setPlaceholder("اختار قناة الترحيب")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "👋 اختار قناة الترحيب:", components: [row], ephemeral: true });
  }

  if (id === "setup_set_welcome_ch") {
    const ch = interaction.values[0];
    db.setWelcomeChannel(interaction.guild.id, ch);
    return interaction.reply({ content: `✅ قناة الترحيب اتحددت: <#${ch}>`, ephemeral: true });
  }

  // ── اختيار قناة وداع ──
  if (id === "setup_goodbye_ch") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("setup_set_goodbye_ch")
        .setPlaceholder("اختار قناة الوداع")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🥀 اختار قناة الوداع:", components: [row], ephemeral: true });
  }

  if (id === "setup_set_goodbye_ch") {
    const ch = interaction.values[0];
    db.setGoodbyeChannel(interaction.guild.id, ch);
    return interaction.reply({ content: `✅ قناة الوداع اتحددت: <#${ch}>`, ephemeral: true });
  }

  // ── اختيار قناة سجلات ──
  if (id === "setup_log_ch") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("setup_set_log_ch")
        .setPlaceholder("اختار قناة السجلات")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "📜 اختار قناة السجلات:", components: [row], ephemeral: true });
  }

  if (id === "setup_set_log_ch") {
    const ch = interaction.values[0];
    if (db.setLogChannel) db.setLogChannel(interaction.guild.id, ch);
    return interaction.reply({ content: `✅ قناة السجلات اتحددت: <#${ch}>`, ephemeral: true });
  }

  // ── اختيار قناة مصيدة ──
  if (id === "setup_trap_ch") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("setup_set_trap_ch")
        .setPlaceholder("اختار قناة المصيدة (honeypot)")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🪤 اختار قناة المصيدة (أي حد يكتب فيها يتطرد):", components: [row], ephemeral: true });
  }

  if (id === "setup_set_trap_ch") {
    const ch = interaction.values[0];
    db.setTrapChannel(interaction.guild.id, ch);
    return interaction.reply({ content: `✅ قناة المصيدة اتحددت: <#${ch}>`, ephemeral: true });
  }

  // ── اختيار قناة التحقق ──
  if (id === "setup_verify_ch") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("setup_set_verify_ch")
        .setPlaceholder("اختار قناة بوابة التحقق")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🔐 اختار قناة بوابة التحقق:", components: [row], ephemeral: true });
  }

  if (id === "setup_set_verify_ch") {
    const ch = interaction.values[0];
    if (db.setVerifyChannel) db.setVerifyChannel(interaction.guild.id, ch);
    return interaction.reply({ content: `✅ قناة التحقق اتحددت: <#${ch}>`, ephemeral: true });
  }

  // ── رتب الإشراف ──
  if (id === "setup_modroles") {
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("setup_set_modrole")
        .setPlaceholder("اختار رتبة مشرف إضافية")
        .setMinValues(1)
        .setMaxValues(5)
    );
    return interaction.reply({ content: "👮 اختار رتب الإشراف الإضافية:", components: [row], ephemeral: true });
  }

  if (id === "setup_set_modrole") {
    const roles = interaction.values;
    if (db.addExtraModRole) roles.forEach(r => db.addExtraModRole(interaction.guild.id, r));
    return interaction.reply({ content: `✅ اتضافت ${roles.length} رتبة للإشراف.`, ephemeral: true });
  }

  // ── رسالة ترحيب مخصصة ──
  if (id === "setup_welcome_msg") {
    const current = db.getWelcomeMessage(interaction.guild.id) || DEFAULT_WELCOME_MSG;
    const modal = new ModalBuilder()
      .setCustomId("setup_modal_welcome_msg")
      .setTitle("✏️ رسالة الترحيب المخصصة");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("msg")
          .setLabel(`المتاح: {mention} {user} {server} {count} {id}`)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(current)
          .setMaxLength(1000)
      )
    );
    return interaction.showModal(modal);
  }

  if (id === "setup_modal_welcome_msg") {
    const text = interaction.fields.getTextInputValue("msg").trim();
    if (!text) return interaction.reply({ content: "❌ النص فاضي!", ephemeral: true });
    db.setWelcomeMessage(interaction.guild.id, text);
    return interaction.reply({ content: `✅ رسالة الترحيب اتحدثت!\n\n**معاينة:**\n${text}`, ephemeral: true });
  }

  // ── رسالة وداع مخصصة ──
  if (id === "setup_goodbye_msg") {
    const current = db.getGoodbyeMessage(interaction.guild.id) || DEFAULT_GOODBYE_MSG;
    const modal = new ModalBuilder()
      .setCustomId("setup_modal_goodbye_msg")
      .setTitle("✏️ رسالة الوداع المخصصة");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("msg")
          .setLabel(`المتاح: {mention} {user} {server} {count} {id}`)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(current)
          .setMaxLength(1000)
      )
    );
    return interaction.showModal(modal);
  }

  if (id === "setup_modal_goodbye_msg") {
    const text = interaction.fields.getTextInputValue("msg").trim();
    if (!text) return interaction.reply({ content: "❌ النص فاضي!", ephemeral: true });
    db.setGoodbyeMessage(interaction.guild.id, text);
    return interaction.reply({ content: `✅ رسالة الوداع اتحدثت!\n\n**معاينة:**\n${text}`, ephemeral: true });
  }
}
