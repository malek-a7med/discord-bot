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
  UserSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { buildWarningsEmbed } from "./moderation.js";

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
      { label: "التحذيرات اليدوية", description: "حذّر عضو أو مسح تحذيراته", value: "warnings", emoji: "📋" },
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

// ── قايمة التحذيرات اليدوية ──────────────────────────────────────
function buildWarningsPickUserMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📋 التحذيرات اليدوية")
    .setDescription("اختار العضو الأول عشان تشوف سجله وتقدر تحذّره أو تمسح تحذيراته 👇");
  const userMenu = new UserSelectMenuBuilder()
    .setCustomId("amset_warn_user_select")
    .setPlaceholder("اختار عضو");
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("amset_back_main").setLabel("🔙 رجوع").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(userMenu), backRow] };
}

async function buildWarningsTargetView(interaction, db, targetId) {
  const target = await interaction.client.users.fetch(targetId).catch(() => null);
  if (!target) {
    return { embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription("❌ مش لاقي العضو ده.")], components: [] };
  }
  const warns = db.getWarnings(targetId);
  const embed = buildWarningsEmbed(target, warns, 0);
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`amset_warn_add_${targetId}`).setLabel("➕ تحذير جديد").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`amset_warn_remove_${targetId}`).setLabel("🗑️ مسح تحذير برقم").setStyle(ButtonStyle.Secondary).setDisabled(warns.length === 0),
    new ButtonBuilder().setCustomId(`amset_warn_clearall_${targetId}`).setLabel("🧹 مسح الكل").setStyle(ButtonStyle.Secondary).setDisabled(warns.length === 0),
  );
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("amset_warn_pickuser").setLabel("🔁 عضو تاني").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("amset_back_main").setLabel("🔙 رجوع للرئيسية").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [actionRow, backRow] };
}

function buildWarnAddModal(targetId) {
  const modal = new ModalBuilder().setCustomId(`amset_modal_warnadd_${targetId}`).setTitle("تحذير جديد");
  const reason = new TextInputBuilder()
    .setCustomId("reason").setLabel("سبب التحذير").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
  const dm = new TextInputBuilder()
    .setCustomId("dm").setLabel("تبعتله رسالة خاصة؟ (نعم/لا)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(3).setValue("نعم");
  modal.addComponents(
    new ActionRowBuilder().addComponents(reason),
    new ActionRowBuilder().addComponents(dm),
  );
  return modal;
}

function buildWarnRemoveModal(targetId) {
  const modal = new ModalBuilder().setCustomId(`amset_modal_warnremove_${targetId}`).setTitle("مسح تحذير برقم");
  const num = new TextInputBuilder()
    .setCustomId("num").setLabel("رقم التحذير (زي ما هو في السجل)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
  modal.addComponents(new ActionRowBuilder().addComponents(num));
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

  // زرار "عضو تاني" في التحذيرات اليدوية
  if (interaction.isButton() && interaction.customId === "amset_warn_pickuser") {
    await interaction.update({ ...buildWarningsPickUserMenu() });
    return true;
  }

  // اختيار عضو في التحذيرات اليدوية
  if (interaction.isUserSelectMenu() && interaction.customId === "amset_warn_user_select") {
    const targetId = interaction.values[0];
    await interaction.update({ ...(await buildWarningsTargetView(interaction, db, targetId)) });
    return true;
  }

  // أزرار التحذيرات اليدوية (تحذير جديد / مسح برقم / مسح الكل)
  if (interaction.isButton() && interaction.customId.startsWith("amset_warn_add_")) {
    const targetId = interaction.customId.replace("amset_warn_add_", "");
    await interaction.showModal(buildWarnAddModal(targetId));
    return true;
  }
  if (interaction.isButton() && interaction.customId.startsWith("amset_warn_remove_")) {
    const targetId = interaction.customId.replace("amset_warn_remove_", "");
    await interaction.showModal(buildWarnRemoveModal(targetId));
    return true;
  }
  if (interaction.isButton() && interaction.customId.startsWith("amset_warn_clearall_")) {
    const targetId = interaction.customId.replace("amset_warn_clearall_", "");
    db.clearAllWarnings(targetId);
    await interaction.update({ ...(await buildWarningsTargetView(interaction, db, targetId)) });
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    const settings = db.getAutoModSettings(guildId);

    if (interaction.customId === "amset_menu") {
      const choice = interaction.values[0];
      if (choice === "thresholds") await interaction.update({ ...buildThresholdsMenu() });
      else if (choice === "warnings") await interaction.update({ ...buildWarningsPickUserMenu() });
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

    if (interaction.customId.startsWith("amset_modal_warnadd_")) {
      const targetId = interaction.customId.replace("amset_modal_warnadd_", "");
      const reason = interaction.fields.getTextInputValue("reason");
      const sendDm = (interaction.fields.getTextInputValue("dm") || "نعم").trim() !== "لا";
      const target = await interaction.client.users.fetch(targetId).catch(() => null);
      if (!target) {
        await interaction.reply({ content: "❌ مش لاقي العضو ده.", flags: 64 });
        return true;
      }
      db.addWarning(targetId, reason, "MANUAL_MODERATOR");
      if (sendDm) {
        try {
          await target.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("⚠️ لقيت تحذير يدوي على حسابك")
                .setDescription(`اتسجّل عليك تحذير في **${interaction.guild?.name || "السيرفر"}**.\n\n**السبب:** ${reason.slice(0, 500)}`)
                .setTimestamp(),
            ],
          });
        } catch { /* مبعتش DM */ }
      }
      await interaction.update({ ...(await buildWarningsTargetView(interaction, db, targetId)) });
      return true;
    }

    if (interaction.customId.startsWith("amset_modal_warnremove_")) {
      const targetId = interaction.customId.replace("amset_modal_warnremove_", "");
      const raw = interaction.fields.getTextInputValue("num");
      const num = parseInt(raw, 10);
      const warns = db.getWarnings(targetId);
      if (isNaN(num) || num < 1 || num > warns.length) {
        await interaction.reply({ content: `❌ رقم غلط. العضو عنده \`${warns.length}\` تحذير.`, flags: 64 });
        return true;
      }
      db.removeWarningByIndex(targetId, num - 1);
      await interaction.update({ ...(await buildWarningsTargetView(interaction, db, targetId)) });
      return true;
    }
  }

  return false;
}
