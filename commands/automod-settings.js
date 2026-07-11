// ═══════════════════════════════════════════════════════════════
//  إعدادات الأوتو مود — قايمة اختيار واحدة تحت الرسالة
//  فيها أفضل الأفكار من البوتات المرجعية (kiwi / Discord-Moderation-Bot
//  / Rory Security): رتب إشراف إضافية، حماية ضد التخريب (anti-nuke)،
//  عتبات التحذيرات، قناة سجلات الأمان.
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const COLOR = 0x5865f2;

export const autoModSettingsCommand = new SlashCommandBuilder()
  .setName("اعدادات-الاوتومود")
  .setDescription("⚙️ لوحة إعدادات الأوتو مود — عتبات، حماية ضد التخريب، رتب إشراف [إدارة]")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ── الإيمبد + القايمة الرئيسية ──────────────────────────────────
function buildMainMenu(settings) {
  const an = settings.antiNuke;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("⚙️ إعدادات الأوتو مود")
    .setDescription(
      "اختار من القايمة تحت عشان تظبط أي جزء من نظام الحماية 👇\n\u200B"
    )
    .addFields(
      { name: "🔇 إسكات بعد", value: `\`${settings.warnTimeoutThreshold}\` تحذيرات`, inline: true },
      { name: "👢 طرد بعد", value: `\`${settings.warnKickThreshold}\` تحذيرات`, inline: true },
      { name: "🔨 باند بعد", value: `\`${settings.warnBanThreshold}\` تحذيرات`, inline: true },
      { name: "🛡️ حماية ضد التخريب", value: an.enabled ? `🟢 مفعّلة (${an.limit} فعل/${Math.round(an.windowMs / 1000)}ث → ${punishLabel(an.punishment)})` : "🔴 متوقفة", inline: false },
      { name: "👮 رتب إشراف إضافية", value: settings.extraModRoles.length ? settings.extraModRoles.map(r => `<@&${r}>`).join(", ") : "مفيش", inline: false },
      { name: "📜 قناة سجلات الأمان", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "مش متحددة", inline: false },
    )
    .setFooter({ text: "إعدادات الأوتو مود" });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("amset_menu")
    .setPlaceholder("اختار إعداد عشان تظبطه")
    .addOptions([
      { label: "عتبات التحذيرات", description: "بعد كام تحذير ياخد إسكات/طرد/باند", value: "thresholds", emoji: "⚠️" },
      { label: "الحماية ضد التخريب (Anti-Nuke)", description: "لو مود عمل أفعال خطيرة كتير بسرعة", value: "antinuke", emoji: "🛡️" },
      { label: "رتب إشراف إضافية", description: "رتب تتعامل كمشرفين موثوقين", value: "modroles", emoji: "👮" },
      { label: "قناة سجلات الأمان", description: "فين نبعت تقارير الحماية", value: "logchannel", emoji: "📜" },
    ]);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function punishLabel(p) {
  return { kick: "👢 طرد", ban: "🔨 باند", timeout: "🔇 إسكات ساعة" }[p] || p;
}

// ── قايمة عتبات التحذيرات ───────────────────────────────────────
function buildThresholdsMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("⚠️ عتبات التحذيرات")
    .setDescription("اختار العتبة اللي عايز تغيّر رقمها 👇");
  const menu = new StringSelectMenuBuilder()
    .setCustomId("amset_thresholds_select")
    .setPlaceholder("اختار عتبة")
    .addOptions([
      { label: "عتبة الإسكات", description: "عدد التحذيرات قبل إسكات مؤقت", value: "timeout", emoji: "🔇" },
      { label: "عتبة الطرد", description: "عدد التحذيرات قبل الطرد", value: "kick", emoji: "👢" },
      { label: "عتبة الباند", description: "عدد التحذيرات قبل الباند", value: "ban", emoji: "🔨" },
      { label: "🔙 رجوع", description: "رجوع للقايمة الرئيسية", value: "back" },
    ]);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function buildThresholdModal(type) {
  const labels = { timeout: "الإسكات", kick: "الطرد", ban: "الباند" };
  const modal = new ModalBuilder()
    .setCustomId(`amset_modal_threshold_${type}`)
    .setTitle(`عتبة ${labels[type]}`);
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel("عدد التحذيرات (رقم من 1 لـ 20)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(2);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ── قايمة الحماية ضد التخريب ────────────────────────────────────
function buildAntiNukeMenu(settings) {
  const an = settings.antiNuke;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🛡️ الحماية ضد التخريب")
    .setDescription(
      "بتراقب باند/طرد/حذف رتب/حذف رومات — لو حد (حتى لو مشرف) عدّى الحد المسموح في وقت قصير، بناخد فيه إجراء فوري.\n" +
      "الأونر وصاحب السيرفر مستثنيين دايمًا.\n\u200B"
    )
    .addFields(
      { name: "الحالة", value: an.enabled ? "🟢 مفعّلة" : "🔴 متوقفة", inline: true },
      { name: "الحد المسموح", value: `\`${an.limit}\` أفعال`, inline: true },
      { name: "النافذة الزمنية", value: `\`${Math.round(an.windowMs / 1000)}\` ثانية`, inline: true },
      { name: "العقوبة", value: punishLabel(an.punishment), inline: true },
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("amset_antinuke_select")
    .setPlaceholder("اختار إعداد")
    .addOptions([
      { label: an.enabled ? "إيقاف الحماية" : "تفعيل الحماية", value: "toggle", emoji: an.enabled ? "🔴" : "🟢" },
      { label: "تغيير الحد المسموح", description: "عدد الأفعال الخطيرة", value: "limit", emoji: "🔢" },
      { label: "تغيير النافذة الزمنية", description: "بالثواني", value: "window", emoji: "⏱️" },
      { label: "العقوبة: طرد", value: "punishment_kick", emoji: "👢" },
      { label: "العقوبة: باند", value: "punishment_ban", emoji: "🔨" },
      { label: "العقوبة: إسكات ساعة", value: "punishment_timeout", emoji: "🔇" },
      { label: "🔙 رجوع", value: "back" },
    ]);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function buildAntiNukeModal(field) {
  const labels = { limit: "الحد المسموح (عدد أفعال)", window: "النافذة الزمنية (بالثواني)" };
  const modal = new ModalBuilder().setCustomId(`amset_modal_antinuke_${field}`).setTitle(labels[field]);
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(labels[field])
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(4);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ── قايمة رتب الإشراف الإضافية ───────────────────────────────────
function buildModRolesMenu(settings) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("👮 رتب إشراف إضافية")
    .setDescription(
      "اختار الرتب اللي عايز تديها صلاحية مشرف موثوق (زي أمر mod في البوتات التانية).\n" +
      "اختيارك هيستبدل القايمة الحالية بالكامل.\n\u200B" +
      (settings.extraModRoles.length ? `**الحالي:** ${settings.extraModRoles.map(r => `<@&${r}>`).join(", ")}` : "**الحالي:** مفيش رتب متحددة")
    );
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId("amset_modroles_select")
    .setPlaceholder("اختار الرتب (سيب فاضي عشان تمسحهم كلهم)")
    .setMinValues(0)
    .setMaxValues(10);
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("amset_back_main").setLabel("🔙 رجوع").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(roleMenu), backRow] };
}

// ── قايمة قناة السجلات ──────────────────────────────────────────
function buildLogChannelMenu(settings) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📜 قناة سجلات الأمان")
    .setDescription(
      `هنبعت فيها تقارير الحماية ضد التخريب.\n\u200B\n**الحالي:** ${settings.logChannelId ? `<#${settings.logChannelId}>` : "مش متحددة"}`
    );
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId("amset_logchannel_select")
    .setPlaceholder("اختار قناة")
    .addChannelTypes(ChannelType.GuildText);
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("amset_back_main").setLabel("🔙 رجوع").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(channelMenu), backRow] };
}

// ── تنفيذ الأمر ──────────────────────────────────────────────────
export async function handleAutoModSettingsCommand(interaction, db) {
  const settings = db.getAutoModSettings(interaction.guildId);
  return interaction.reply({ ...buildMainMenu(settings), flags: 64 });
}

// ── معالج القوايم والأزرار ────────────────────────────────────────
export async function handleAutoModSettingsInteraction(interaction, db) {
  const guildId = interaction.guildId;
  if (!guildId) return false;

  // زرار الرجوع
  if (interaction.isButton() && interaction.customId === "amset_back_main") {
    const settings = db.getAutoModSettings(guildId);
    await interaction.update({ ...buildMainMenu(settings) });
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    const settings = db.getAutoModSettings(guildId);

    if (interaction.customId === "amset_menu") {
      const choice = interaction.values[0];
      if (choice === "thresholds") await interaction.update({ ...buildThresholdsMenu() });
      else if (choice === "antinuke") await interaction.update({ ...buildAntiNukeMenu(settings) });
      else if (choice === "modroles") await interaction.update({ ...buildModRolesMenu(settings) });
      else if (choice === "logchannel") await interaction.update({ ...buildLogChannelMenu(settings) });
      return true;
    }

    if (interaction.customId === "amset_thresholds_select") {
      const choice = interaction.values[0];
      if (choice === "back") {
        await interaction.update({ ...buildMainMenu(settings) });
        return true;
      }
      await interaction.showModal(buildThresholdModal(choice));
      return true;
    }

    if (interaction.customId === "amset_antinuke_select") {
      const choice = interaction.values[0];
      if (choice === "back") {
        await interaction.update({ ...buildMainMenu(settings) });
        return true;
      }
      if (choice === "toggle") {
        db.updateAntiNukeSettings(guildId, { enabled: !settings.antiNuke.enabled });
        await interaction.update({ ...buildAntiNukeMenu(db.getAutoModSettings(guildId)) });
        return true;
      }
      if (choice.startsWith("punishment_")) {
        db.updateAntiNukeSettings(guildId, { punishment: choice.replace("punishment_", "") });
        await interaction.update({ ...buildAntiNukeMenu(db.getAutoModSettings(guildId)) });
        return true;
      }
      if (choice === "limit" || choice === "window") {
        await interaction.showModal(buildAntiNukeModal(choice));
        return true;
      }
    }
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === "amset_modroles_select") {
    db.updateAutoModSettings(guildId, { extraModRoles: interaction.values });
    const settings = db.getAutoModSettings(guildId);
    await interaction.update({ ...buildModRolesMenu(settings) });
    return true;
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "amset_logchannel_select") {
    db.updateAutoModSettings(guildId, { logChannelId: interaction.values[0] || null });
    const settings = db.getAutoModSettings(guildId);
    await interaction.update({ ...buildLogChannelMenu(settings) });
    return true;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("amset_modal_threshold_")) {
      const type = interaction.customId.replace("amset_modal_threshold_", "");
      const raw = interaction.fields.getTextInputValue("value");
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 1 || num > 20) {
        await interaction.reply({ content: "❌ الرقم لازم يكون من 1 لـ 20.", flags: 64 });
        return true;
      }
      const key = { timeout: "warnTimeoutThreshold", kick: "warnKickThreshold", ban: "warnBanThreshold" }[type];
      db.updateAutoModSettings(guildId, { [key]: num });
      await interaction.update({ ...buildThresholdsMenu() });
      return true;
    }

    if (interaction.customId.startsWith("amset_modal_antinuke_")) {
      const field = interaction.customId.replace("amset_modal_antinuke_", "");
      const raw = interaction.fields.getTextInputValue("value");
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 1) {
        await interaction.reply({ content: "❌ لازم رقم صحيح أكبر من صفر.", flags: 64 });
        return true;
      }
      if (field === "limit") db.updateAntiNukeSettings(guildId, { limit: num });
      else if (field === "window") db.updateAntiNukeSettings(guildId, { windowMs: num * 1000 });
      await interaction.update({ ...buildAntiNukeMenu(db.getAutoModSettings(guildId)) });
      return true;
    }
  }

  return false;
}
