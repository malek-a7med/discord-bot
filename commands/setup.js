// ═══════════════════════════════════════════════════════════════
//  /setup — لوحة إعداد شاملة للسيرفر
//  بتغطي: ترحيب، وداع، لوج، مصيدة هاكرات، رتب إشراف،
//          بوابة تحقق، الحماية ضد التخريب
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
} from "discord.js";

const COLOR = 0xf1c40f;
const PREFIX = "setup_";

// ─── بناء الإيمبد الرئيسي ──────────────────────────────────────
function buildMainEmbed(guildId, db) {
  const welcome   = db.getWelcomeChannel(guildId);
  const goodbye   = db.getGoodbyeChannel(guildId);
  const trap      = db.getTrapChannel(guildId);
  const automod   = db.getAutoModSettings(guildId);
  const logCh     = automod.logChannelId;
  const an        = automod.antiNuke;
  const modRoles  = automod.extraModRoles;

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("⚙️ لوحة إعداد السيرفر")
    .setDescription(
      "اختار القسم اللي عايز تظبطه من القايمة تحت 👇\n\u200B"
    )
    .addFields(
      {
        name: "👋 قناة الترحيب",
        value: welcome ? `<#${welcome}>` : "❌ مش متحددة",
        inline: true,
      },
      {
        name: "🥀 قناة الوداع",
        value: goodbye ? `<#${goodbye}>` : welcome ? `<#${welcome}> (نفس الترحيب)` : "❌ مش متحددة",
        inline: true,
      },
      {
        name: "📜 قناة السجلات",
        value: logCh ? `<#${logCh}>` : "❌ مش متحددة",
        inline: true,
      },
      {
        name: "🪤 مصيدة الهاكرات",
        value: trap ? `<#${trap}>` : "❌ مش متحددة",
        inline: true,
      },
      {
        name: "🛡️ حماية ضد التخريب",
        value: an.enabled
          ? `🟢 شغّالة (${an.limit} فعل/${Math.round(an.windowMs / 1000)}ث)`
          : "🔴 متوقفة",
        inline: true,
      },
      {
        name: "👮 رتب الإشراف الإضافية",
        value: modRoles.length
          ? modRoles.map(r => `<@&${r}>`).join(", ")
          : "مفيش",
        inline: true,
      },
    )
    .setFooter({ text: "⚙️ إعداد السيرفر — اختار من القايمة" });
}

function buildMainMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${PREFIX}menu`)
    .setPlaceholder("اختار إعداد تحب تظبطه")
    .addOptions([
      { label: "قناة الترحيب",             description: "القناة اللي البوت بيرحب بيها الأعضاء الجداد", value: "welcome",    emoji: "👋" },
      { label: "قناة الوداع",              description: "القناة اللي البوت بيقول فيها وداع للعضو اللي خرج", value: "goodbye", emoji: "🥀" },
      { label: "قناة السجلات (Log)",       description: "القناة اللي بتوصلها تقارير الحماية والأوتو مود", value: "log",      emoji: "📜" },
      { label: "مصيدة الهاكرات (Honeypot)",description: "قناة سرية — أي حد يكتب فيها يتطرد فوراً",       value: "trap",     emoji: "🪤" },
      { label: "بوابة التحقق",             description: "ابعت رسالة بوابة الموافقة على القوانين في روم",  value: "verify",   emoji: "🔐" },
      { label: "رتب الإشراف الإضافية",    description: "حدد رتب تتعامل كمشرفين موثوقين في الأوتو مود",  value: "modroles", emoji: "👮" },
      { label: "الحماية ضد التخريب",      description: "تفعيل/تعطيل وإعداد Anti-Nuke",                  value: "antinuke", emoji: "🛡️" },
    ]);

  return new ActionRowBuilder().addComponents(menu);
}

// ─── قناة الترحيب ──────────────────────────────────────────────
function buildWelcomePanel(guildId, db) {
  const current = db.getWelcomeChannel(guildId);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("👋 قناة الترحيب")
    .setDescription(
      `الحالي: ${current ? `<#${current}>` : "❌ مش متحددة"}\n\nاختار القناة اللي عايز البوت يرحب فيها بالأعضاء الجداد 👇`
    );

  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}welcome_ch`)
    .setPlaceholder("اختار قناة الترحيب")
    .addChannelTypes(ChannelType.GuildText);

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn),
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
    .setDescription(
      `الحالي: ${current ? `<#${current}>` : welcome ? `<#${welcome}> (نفس الترحيب افتراضياً)` : "❌ مش متحددة"}\n\nاختار القناة اللي عايز البوت يبعت فيها رسايل الوداع للأعضاء اللي بيخرجوا 👇`
    );

  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}goodbye_ch`)
    .setPlaceholder("اختار قناة الوداع")
    .addChannelTypes(ChannelType.GuildText);

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn),
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
    .setDescription(
      `الحالي: ${current ? `<#${current}>` : "❌ مش متحددة"}\n\nاختار القناة اللي بتوصلها تقارير الأوتو مود والحماية 👇`
    );

  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}log_ch`)
    .setPlaceholder("اختار قناة السجلات")
    .addChannelTypes(ChannelType.GuildText);

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn),
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
      "**إيه ده؟**\nده روم سري — أي عضو يكتب فيه بيتطرد فوراً بدون إنذار.\n" +
      "الفكرة إن الأعضاء الحقيقيين مش المفروض يعرفوا بيجدوا الروم ده أصلاً.\n\n" +
      "اختار القناة اللي تحبها تكون المصيدة 👇"
    );

  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}trap_ch`)
    .setPlaceholder("اختار قناة المصيدة")
    .addChannelTypes(ChannelType.GuildText);

  const disableBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}trap_disable`)
    .setLabel("🚫 تعطيل المصيدة")
    .setStyle(ButtonStyle.Danger);

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(disableBtn, backBtn),
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
      "البوت هيبعت رسالة فيها زرار **✅ أنا موافق على القوانين** — أي عضو يضغطه بياخد رتبة Verified ويشوف باقي الرومات.\n\n" +
      "اختار الروم 👇"
    );

  const chMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${PREFIX}verify_ch`)
    .setPlaceholder("اختار الروم اللي تبعت فيها بوابة التحقق")
    .addChannelTypes(ChannelType.GuildText);

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(chMenu),
      new ActionRowBuilder().addComponents(backBtn),
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
      "اختار رتبة تضيفها أو تشيلها. الرتب دي بتتعامل كمشرفين موثوقين في نظام الأوتو مود.\n\n" +
      "اختار رتبة 👇"
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

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(roleMenu),
      new ActionRowBuilder().addComponents(clearBtn, backBtn),
    ],
  };
}

// ─── الحماية ضد التخريب ────────────────────────────────────────
function buildAntiNukePanel(guildId, db) {
  const an = db.getAutoModSettings(guildId).antiNuke;
  const punishLabels = { kick: "طرد 👢", ban: "باند 🔨", timeout: "إسكات 🔇" };
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🛡️ الحماية ضد التخريب (Anti-Nuke)")
    .setDescription(
      "لو أي مشرف عمل أفعال خطيرة كتير بسرعة (حذف رتب / رومات / باند / طرد) البوت بياخد فيه إجراء فوري.\n\u200B"
    )
    .addFields(
      { name: "الحالة",        value: an.enabled ? "🟢 شغّالة" : "🔴 متوقفة", inline: true },
      { name: "الحد الأقصى",  value: `${an.limit} فعل`, inline: true },
      { name: "النافذة الزمنية", value: `${Math.round(an.windowMs / 1000)} ثانية`, inline: true },
      { name: "العقوبة",       value: punishLabels[an.punishment] || an.punishment, inline: true },
    )
    .setFooter({ text: "للإعدادات المتقدمة استخدم /اعدادات-الاوتومود" });

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}antinuke_toggle`)
    .setLabel(an.enabled ? "🔴 إيقاف الحماية" : "🟢 تفعيل الحماية")
    .setStyle(an.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const kickBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}antinuke_kick`)
    .setLabel("عقوبة: طرد")
    .setStyle(an.punishment === "kick" ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const banBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}antinuke_ban`)
    .setLabel("عقوبة: باند")
    .setStyle(an.punishment === "ban" ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const timeoutBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}antinuke_timeout`)
    .setLabel("عقوبة: إسكات")
    .setStyle(an.punishment === "timeout" ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const backBtn = new ButtonBuilder()
    .setCustomId(`${PREFIX}back`)
    .setLabel("↩️ رجوع")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(toggleBtn, kickBtn, banBtn, timeoutBtn),
      new ActionRowBuilder().addComponents(backBtn),
    ],
  };
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

  // ── القايمة الرئيسية ─────────────────────────────────────────
  if (interaction.isStringSelectMenu() && id === `${PREFIX}menu`) {
    const val = interaction.values[0];
    if (val === "welcome")   return interaction.update(buildWelcomePanel(guildId, db));
    if (val === "goodbye")   return interaction.update(buildGoodbyePanel(guildId, db));
    if (val === "log")       return interaction.update(buildLogPanel(guildId, db));
    if (val === "trap")      return interaction.update(buildTrapPanel(guildId, db));
    if (val === "verify")    return interaction.update(buildVerifyPanel());
    if (val === "modroles")  return interaction.update(buildModRolesPanel(guildId, db));
    if (val === "antinuke")  return interaction.update(buildAntiNukePanel(guildId, db));
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

  // ── بوابة التحقق — اختيار الروم وإرسال الرسالة ───────────────
  if (interaction.isChannelSelectMenu() && id === `${PREFIX}verify_ch`) {
    const chId = interaction.values[0];
    const ch   = interaction.guild.channels.cache.get(chId)
              || await interaction.guild.channels.fetch(chId).catch(() => null);
    if (!ch) {
      await interaction.reply({ content: "❌ مش لاقي الروم دي.", flags: 64 });
      return true;
    }

    // استيراد دالة بوابة التحقق من community.js بشكل dynamic لتجنب circular imports
    try {
      const { handleVerifyGateCommand } = await import("./community.js");
      // إنشاء رسالة التحقق في الروم المختارة مباشرة
      const { EmbedBuilder: E, ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = await import("discord.js");

      const verifyEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("𓂀 بوابة دخول السيرفر 𓂀")
        .setDescription(
          "```\n⚜️  أهلاً بك في السيرفر\n```\n" +
          "قبل ما تشوف باقي الرومات، لازم توافق على قوانين السيرفر.\n\n" +
          "دوس على الزرار تحت عشان تأكد إنك موافق على القوانين — وهتفتحلك باقي الرومات على طول ✅"
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
      await interaction.reply({ content: "❌ في مشكلة وانا ببعت بوابة التحقق. اتأكد البوت عنده صلاحيات في الروم دي.", flags: 64 });
    }
    return true;
  }

  // ── رتب الإشراف الإضافية ─────────────────────────────────────
  if (interaction.isRoleSelectMenu() && id === `${PREFIX}modroles_select`) {
    const selected = interaction.values;
    const settings = db.getAutoModSettings(guildId);
    // toggle: لو الرتبة موجودة شيلها، لو مش موجودة ضيفها
    for (const roleId of selected) {
      if (settings.extraModRoles.includes(roleId)) {
        db.removeExtraModRole(guildId, roleId);
      } else {
        db.addExtraModRole(guildId, roleId);
      }
    }
    return interaction.update(buildModRolesPanel(guildId, db));
  }

  if (interaction.isButton() && id === `${PREFIX}modroles_clear`) {
    const settings = db.getAutoModSettings(guildId);
    settings.extraModRoles = [];
    db.updateAutoModSettings(guildId, { extraModRoles: [] });
    return interaction.update(buildModRolesPanel(guildId, db));
  }

  // ── الحماية ضد التخريب ───────────────────────────────────────
  if (interaction.isButton() && id === `${PREFIX}antinuke_toggle`) {
    const an = db.getAutoModSettings(guildId).antiNuke;
    db.updateAntiNukeSettings(guildId, { enabled: !an.enabled });
    return interaction.update(buildAntiNukePanel(guildId, db));
  }

  if (interaction.isButton() && id === `${PREFIX}antinuke_kick`) {
    db.updateAntiNukeSettings(guildId, { punishment: "kick" });
    return interaction.update(buildAntiNukePanel(guildId, db));
  }

  if (interaction.isButton() && id === `${PREFIX}antinuke_ban`) {
    db.updateAntiNukeSettings(guildId, { punishment: "ban" });
    return interaction.update(buildAntiNukePanel(guildId, db));
  }

  if (interaction.isButton() && id === `${PREFIX}antinuke_timeout`) {
    db.updateAntiNukeSettings(guildId, { punishment: "timeout" });
    return interaction.update(buildAntiNukePanel(guildId, db));
  }

  return false;
}
