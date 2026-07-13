// ═══════════════════════════════════════════════════════════════
//  /setup — لوحة إعداد شاملة للسيرفر
//  بتغطي: ترحيب، وداع، لوج، مصيدة هاكرات، رتب إشراف،
//          بوابة تحقق، الحماية ضد التخريب، رسايل مخصصة،
//          إعدادات الأوتو مود الكاملة
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { buildAutoModMainMenu } from "./automod-settings.js";

const COLOR  = 0xf1c40f;
const PREFIX = "setup_";

// ── متغيرات الـ placeholders ─────────────────────────────────────
export const PLACEHOLDER_GUIDE =
  "`{mention}` = منشن العضو • `{user}` = اسمه • `{server}` = اسم السيرفر • `{count}` = عدد الأعضاء • `{id}` = الـ ID";

export function applyPlaceholders(template, { mention, user, server, count, id }) {
  return template
    .replace(/{mention}/g, mention)
    .replace(/{user}/g, user)
    .replace(/{server}/g, server)
    .replace(/{count}/g, String(count))
    .replace(/{id}/g, id);
}

// ── النصوص الافتراضية المحايدة ───────────────────────────────────
export const DEFAULT_WELCOME_MSG =
  "👋 أهلاً **{mention}** في **{server}**!\nأنت العضو رقم **{count}**. نتمنالك وقت حلو معنا 🎉";
export const DEFAULT_GOODBYE_MSG =
  "🥀 وداعاً **{user}** — شكراً على وجودك معنا.\nعدد الأعضاء الآن: **{count}**.";

// ─── بناء الإيمبد الرئيسي ──────────────────────────────────────
function buildMainEmbed(guildId, db) {
  const welcome   = db.getWelcomeChannel(guildId);
  const goodbye   = db.getGoodbyeChannel(guildId);
  const trap      = db.getTrapChannel(guildId);
  const automod   = db.getAutoModSettings(guildId);
  const logCh     = automod.logChannelId;
  const an        = automod.antiNuke;
  const modRoles  = automod.extraModRoles;
  const wMsg      = db.getWelcomeMessage(guildId);
  const gMsg      = db.getGoodbyeMessage(guildId);

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("⚙️ لوحة إعداد السيرفر")
    .setDescription("اختار القسم اللي عايز تظبطه من القايمة تحت 👇\n\u200B")
    .addFields(
      { name: "👋 قناة الترحيب",         value: welcome  ? `<#${welcome}>`  : "❌ مش متحددة", inline: true },
      { name: "🥀 قناة الوداع",           value: goodbye  ? `<#${goodbye}>`  : welcome ? `<#${welcome}> (نفس الترحيب)` : "❌ مش متحددة", inline: true },
      { name: "📜 قناة السجلات",          value: logCh    ? `<#${logCh}>`    : "❌ مش متحددة", inline: true },
      { name: "🪤 مصيدة الهاكرات",        value: trap     ? `<#${trap}>`     : "❌ مش متحددة", inline: true },
      { name: "🛡️ حماية ضد التخريب",     value: an.enabled ? `🟢 شغّالة (${an.limit} فعل/${Math.round(an.windowMs/1000)}ث)` : "🔴 متوقفة", inline: true },
      { name: "👮 رتب الإشراف",           value: modRoles.length ? modRoles.map(r => `<@&${r}>`).join(", ") : "مفيش", inline: true },
      { name: "💬 رسالة الترحيب",         value: wMsg ? "✅ مخصصة" : "🔘 افتراضية", inline: true },
      { name: "💬 رسالة الوداع",          value: gMsg ? "✅ مخصصة" : "🔘 افتراضية", inline: true },
    )
    .setFooter({ text: "⚙️ إعداد السيرفر — اختار من القايمة" });
}

function buildMainMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${PREFIX}menu`)
    .setPlaceholder("اختار إعداد تحب تظبطه")
    .addOptions([
      { label: "قناة الترحيب",             description: "القناة اللي البوت يرحب فيها بالأعضاء الجداد",    value: "welcome",    emoji: "👋" },
      { label: "قناة الوداع",              description: "القناة اللي البوت يودع فيها الأعضاء اللي بيخرجوا", value: "goodbye",    emoji: "🥀" },
      { label: "قناة السجلات (Log)",       description: "القناة اللي بتوصلها تقارير الحماية والأوتو مود",  value: "log",        emoji: "📜" },
      { label: "مصيدة الهاكرات",           description: "قناة سرية — أي حد يكتب فيها يتطرد فوراً",        value: "trap",       emoji: "🪤" },
      { label: "بوابة التحقق",             description: "ابعت رسالة بوابة الموافقة على القوانين في روم",  value: "verify",     emoji: "🔐" },
      { label: "رتب الإشراف الإضافية",    description: "رتب تتعامل كمشرفين موثوقين في الأوتو مود",       value: "modroles",   emoji: "👮" },
      { label: "رسايل الترحيب والوداع",   description: "خصص نص رسالة الترحيب والوداع",                   value: "messages",   emoji: "💬" },
      { label: "إعدادات الأوتو مود",       description: "عتبات التحذيرات والحماية ضد التخريب والمزيد",    value: "automod",    emoji: "🛡️" },
    ]);
  return new ActionRowBuilder().addComponents(menu);
}

// ─── قناة الترحيب ──────────────────────────────────────────────
function buildWelcomePanel(guildId, db) {
  const current = db.getWelcomeChannel(guildId);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("👋 قناة الترحيب")
    .setDescription(`الحالي: ${current ? `<#${current}>` : "❌ مش متحددة"}\n\nاختار القناة اللي عايز البوت يرحب فيها بالأعضاء الجداد 👇`);
  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}welcome_ch`)
    .setPlaceholder("اختار قناة الترحيب")
    .addChannelTypes(ChannelType.GuildText);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn()),
    ],
  };
}

// ─── قناة الوداع ───────────────────────────────────────────────
function buildGoodbyePanel(guildId, db) {
  const current = db.getGoodbyeChannel(guildId);
  const welcome = db.getWelcomeChannel(guildId);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🥀 قناة الوداع")
    .setDescription(`الحالي: ${current ? `<#${current}>` : welcome ? `<#${welcome}> (نفس الترحيب افتراضياً)` : "❌ مش متحددة"}\n\nاختار القناة اللي عايز البوت يبعت فيها رسايل الوداع 👇`);
  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}goodbye_ch`)
    .setPlaceholder("اختار قناة الوداع")
    .addChannelTypes(ChannelType.GuildText);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn()),
    ],
  };
}

// ─── قناة السجلات ──────────────────────────────────────────────
function buildLogPanel(guildId, db) {
  const settings = db.getAutoModSettings(guildId);
  const current  = settings.logChannelId;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📜 قناة السجلات")
    .setDescription(`الحالي: ${current ? `<#${current}>` : "❌ مش متحددة"}\n\nاختار القناة اللي بتوصلها تقارير الأوتو مود والحماية 👇`);
  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}log_ch`)
    .setPlaceholder("اختار قناة السجلات")
    .addChannelTypes(ChannelType.GuildText);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn()),
    ],
  };
}

// ─── مصيدة الهاكرات ────────────────────────────────────────────
function buildTrapPanel(guildId, db) {
  const current = db.getTrapChannel(guildId);
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🪤 مصيدة الهاكرات")
    .setDescription(
      `الحالي: ${current ? `<#${current}>` : "❌ مش متحددة"}\n\n` +
      "**إيه ده؟**\nروم سري — أي عضو يكتب فيه يتطرد فوراً.\n" +
      "الأعضاء الحقيقيين مش المفروض يلاقوه أصلاً.\n\nاختار القناة 👇"
    );
  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}trap_ch`)
    .setPlaceholder("اختار قناة المصيدة")
    .addChannelTypes(ChannelType.GuildText);
  const disableBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}trap_disable`)
    .setLabel("🚫 تعطيل المصيدة")
    .setStyle(ButtonStyle.Danger);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(disableBtn, backBtn()),
    ],
  };
}

// ─── بوابة التحقق ──────────────────────────────────────────────
function buildVerifyPanel() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🔐 بوابة التحقق")
    .setDescription(
      "اختار الروم اللي عايز تبعت فيها رسالة بوابة التحقق.\n\n" +
      "البوت هيبعت رسالة فيها زرار **✅ أنا موافق على القوانين** — أي عضو يضغطه بياخد رتبة Verified ويشوف باقي الرومات.\n\nاختار الروم 👇"
    );
  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}verify_ch`)
    .setPlaceholder("اختار الروم")
    .addChannelTypes(ChannelType.GuildText);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn()),
    ],
  };
}

// ─── رتب الإشراف الإضافية ──────────────────────────────────────
function buildModRolesPanel(guildId, db) {
  const settings = db.getAutoModSettings(guildId);
  const roles    = settings.extraModRoles;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("👮 رتب الإشراف الإضافية")
    .setDescription(
      `الحالي: ${roles.length ? roles.map(r => `<@&${r}>`).join(", ") : "مفيش"}\n\n` +
      "اختار رتبة تضيفها أو تشيلها 👇"
    );
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(`${PREFIX}modroles_select`)
    .setPlaceholder("اختار رتبة تضيفها أو تشيلها")
    .setMinValues(0)
    .setMaxValues(10);
  const clearBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}modroles_clear`)
    .setLabel("🗑️ مسح الكل")
    .setStyle(ButtonStyle.Danger);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(roleMenu),
      new ActionRowBuilder().addComponents(clearBtn, backBtn()),
    ],
  };
}

// ─── رسايل الترحيب والوداع ─────────────────────────────────────
function buildMessagesPanel(guildId, db) {
  const wMsg = db.getWelcomeMessage(guildId) || DEFAULT_WELCOME_MSG;
  const gMsg = db.getGoodbyeMessage(guildId) || DEFAULT_GOODBYE_MSG;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("💬 رسايل الترحيب والوداع")
    .setDescription(
      `**Placeholders المتاحة:**\n${PLACEHOLDER_GUIDE}\n\u200B`
    )
    .addFields(
      { name: "👋 رسالة الترحيب الحالية", value: `\`\`\`${wMsg.slice(0, 900)}\`\`\``, inline: false },
      { name: "🥀 رسالة الوداع الحالية",  value: `\`\`\`${gMsg.slice(0, 900)}\`\`\``, inline: false },
    )
    .setFooter({ text: "اضغط تعديل عشان تكتب نصك المخصص" });
  const editWelcomeBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}welcome_edit`)
    .setLabel("✏️ تعديل رسالة الترحيب")
    .setStyle(ButtonStyle.Primary);
  const editGoodbyeBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}goodbye_edit`)
    .setLabel("✏️ تعديل رسالة الوداع")
    .setStyle(ButtonStyle.Primary);
  const resetWelcomeBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}welcome_reset`)
    .setLabel("↺ إعادة تعيين الترحيب")
    .setStyle(ButtonStyle.Secondary);
  const resetGoodbyeBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}goodbye_reset`)
    .setLabel("↺ إعادة تعيين الوداع")
    .setStyle(ButtonStyle.Secondary);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(editWelcomeBtn, editGoodbyeBtn),
      new ActionRowBuilder().addComponents(resetWelcomeBtn, resetGoodbyeBtn),
      new ActionRowBuilder().addComponents(backBtn()),
    ],
  };
}

function buildWelcomeModal(current) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}modal_welcome`)
    .setTitle("✏️ تعديل رسالة الترحيب");
  const input = new TextInputBuilder()
    .setCustomId("text")
    .setLabel("نص الرسالة (الـ placeholders شغّالة)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800)
    .setValue(current || DEFAULT_WELCOME_MSG);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildGoodbyeModal(current) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}modal_goodbye`)
    .setTitle("✏️ تعديل رسالة الوداع");
  const input = new TextInputBuilder()
    .setCustomId("text")
    .setLabel("نص الرسالة (الـ placeholders شغّالة)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1800)
    .setValue(current || DEFAULT_GOODBYE_MSG);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ─── مساعد: زرار الرجوع ────────────────────────────────────────
function backBtn() {
  return new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);
}

// ─── الأمر الرئيسي ─────────────────────────────────────────────
export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("⚙️ لوحة إعداد شاملة للسيرفر — ترحيب، وداع، لوج، مصيدة، تحقق، إشراف [أدمن]")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ─── تنفيذ الأمر ───────────────────────────────────────────────
export async function handleSetupCommand(interaction, db) {
  const embed = buildMainEmbed(interaction.guild.id, db);
  const menu  = buildMainMenu();
  return interaction.reply({ embeds: [embed], components: [menu], flags: 64 });
}

// ─── التعامل مع كل الإنتراكشنز ────────────────────────────────
export async function handleSetupInteraction(interaction, db, client) {
  const guildId = interaction.guild?.id;
  if (!guildId) return false;

  const id = interaction.customId;
  if (!id?.startsWith(PREFIX)) return false;

  // ── المودالات ────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (id === `${PREFIX}modal_welcome`) {
      const text = interaction.fields.getTextInputValue("text").trim();
      if (!text) {
        await interaction.reply({ content: "❌ لازم تكتب نص.", flags: 64 });
        return true;
      }
      db.setWelcomeMessage(guildId, text);
      await interaction.update(buildMessagesPanel(guildId, db));
      return true;
    }
    if (id === `${PREFIX}modal_goodbye`) {
      const text = interaction.fields.getTextInputValue("text").trim();
      if (!text) {
        await interaction.reply({ content: "❌ لازم تكتب نص.", flags: 64 });
        return true;
      }
      db.setGoodbyeMessage(guildId, text);
      await interaction.update(buildMessagesPanel(guildId, db));
      return true;
    }
    return false;
  }

  // ── القايمة الرئيسية ─────────────────────────────────────────
  if (interaction.isStringSelectMenu() && id === `${PREFIX}menu`) {
    const val = interaction.values[0];
    if (val === "welcome")   return interaction.update(buildWelcomePanel(guildId, db));
    if (val === "goodbye")   return interaction.update(buildGoodbyePanel(guildId, db));
    if (val === "log")       return interaction.update(buildLogPanel(guildId, db));
    if (val === "trap")      return interaction.update(buildTrapPanel(guildId, db));
    if (val === "verify")    return interaction.update(buildVerifyPanel());
    if (val === "modroles")  return interaction.update(buildModRolesPanel(guildId, db));
    if (val === "messages")  return interaction.update(buildMessagesPanel(guildId, db));
    if (val === "automod") {
      // عرض قايمة الأوتو مود الكاملة (amset_ handlers في index.js بيكملوا من هنا)
      const settings = db.getAutoModSettings(guildId);
      return interaction.update(buildAutoModMainMenu(settings));
    }
  }

  // ── زرار الرجوع ──────────────────────────────────────────────
  if (interaction.isButton() && id === `${PREFIX}back`) {
    const embed = buildMainEmbed(guildId, db);
    const menu  = buildMainMenu();
    return interaction.update({ embeds: [embed], components: [menu] });
  }

  // ── اختيار قناة الترحيب ──────────────────────────────────────
  if (interaction.isChannelSelectMenu() && id === `${PREFIX}welcome_ch`) {
    db.setWelcomeChannel(guildId, interaction.values[0]);
    return interaction.update(buildWelcomePanel(guildId, db));
  }

  // ── اختيار قناة الوداع ───────────────────────────────────────
  if (interaction.isChannelSelectMenu() && id === `${PREFIX}goodbye_ch`) {
    db.setGoodbyeChannel(guildId, interaction.values[0]);
    return interaction.update(buildGoodbyePanel(guildId, db));
  }

  // ── اختيار قناة السجلات ──────────────────────────────────────
  if (interaction.isChannelSelectMenu() && id === `${PREFIX}log_ch`) {
    db.updateAutoModSettings(guildId, { logChannelId: interaction.values[0] });
    return interaction.update(buildLogPanel(guildId, db));
  }

  // ── اختيار مصيدة الهاكرات ────────────────────────────────────
  if (interaction.isChannelSelectMenu() && id === `${PREFIX}trap_ch`) {
    db.setTrapChannel(guildId, interaction.values[0]);
    return interaction.update(buildTrapPanel(guildId, db));
  }

  // ── تعطيل المصيدة ────────────────────────────────────────────
  if (interaction.isButton() && id === `${PREFIX}trap_disable`) {
    db.setTrapChannel(guildId, null);
    return interaction.update(buildTrapPanel(guildId, db));
  }

  // ── بوابة التحقق ─────────────────────────────────────────────
  if (interaction.isChannelSelectMenu() && id === `${PREFIX}verify_ch`) {
    const chId = interaction.values[0];
    const ch   = interaction.guild.channels.cache.get(chId)
              || await interaction.guild.channels.fetch(chId).catch(() => null);
    if (!ch) {
      await interaction.reply({ content: "❌ مش لاقي الروم دي.", flags: 64 });
      return true;
    }
    try {
      const { EmbedBuilder: E, ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = await import("discord.js");
      const verifyEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("𓂀 بوابة دخول السيرفر 𓂀")
        .setDescription(
          "```\n⚜️  أهلاً بك في السيرفر\n```\n" +
          "قبل ما تشوف باقي الرومات، لازم توافق على قوانين السيرفر.\n\n" +
          "دوس على الزرار تحت عشان تأكد إنك موافق — وهتفتحلك باقي الرومات على طول ✅"
        )
        .setFooter({ text: "التحقق بياخد ثانية واحدة بس 🔐" });
      const verifyRow = new AR().addComponents(
        new BB()
          .setCustomId("verify_gate_accept")
          .setLabel("✅ أنا موافق على القوانين")
          .setStyle(BS.Success)
      );
      await ch.send({ embeds: [verifyEmbed], components: [verifyRow] });
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ اتبعت بوابة التحقق!")
            .setDescription(`اتبعتت رسالة بوابة التحقق في <#${chId}> بنجاح 🎉`)
        ],
        components: [new AR().addComponents(
          new BB().setCustomId(`${PREFIX}back`).setLabel("↩️ رجوع").setStyle(BS.Secondary)
        )],
      });
    } catch (err) {
      console.error("[Setup] خطأ في بوابة التحقق:", err);
      await interaction.reply({ content: "❌ في مشكلة وانا ببعت البوابة. اتأكد البوت عنده صلاحيات في الروم دي.", flags: 64 });
    }
    return true;
  }

  // ── رتب الإشراف الإضافية ─────────────────────────────────────
  if (interaction.isRoleSelectMenu() && id === `${PREFIX}modroles_select`) {
    const selected = interaction.values;
    const settings = db.getAutoModSettings(guildId);
    for (const roleId of selected) {
      if (settings.extraModRoles.includes(roleId)) db.removeExtraModRole(guildId, roleId);
      else db.addExtraModRole(guildId, roleId);
    }
    return interaction.update(buildModRolesPanel(guildId, db));
  }

  if (interaction.isButton() && id === `${PREFIX}modroles_clear`) {
    db.updateAutoModSettings(guildId, { extraModRoles: [] });
    return interaction.update(buildModRolesPanel(guildId, db));
  }

  // ── رسايل — فتح المودال ──────────────────────────────────────
  if (interaction.isButton() && id === `${PREFIX}welcome_edit`) {
    const current = db.getWelcomeMessage(guildId);
    return interaction.showModal(buildWelcomeModal(current));
  }
  if (interaction.isButton() && id === `${PREFIX}goodbye_edit`) {
    const current = db.getGoodbyeMessage(guildId);
    return interaction.showModal(buildGoodbyeModal(current));
  }

  // ── رسايل — إعادة تعيين ──────────────────────────────────────
  if (interaction.isButton() && id === `${PREFIX}welcome_reset`) {
    db.setWelcomeMessage(guildId, null);
    return interaction.update(buildMessagesPanel(guildId, db));
  }
  if (interaction.isButton() && id === `${PREFIX}goodbye_reset`) {
    db.setGoodbyeMessage(guildId, null);
    return interaction.update(buildMessagesPanel(guildId, db));
  }

  return false;
}
