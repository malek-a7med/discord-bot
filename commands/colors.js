// ═══════════════════════════════════════════════════════
//  نظام تلوين الأسماء — 51 لون | تنقل بالأزرار + ANSI
// ═══════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits
} from "discord.js";

// ── قائمة الألوان الكاملة ────────────────────────────
export const COLOR_LIST = [
  { id: 1,  name: "Black",             hex: 0x010101, ansi: 30 },
  { id: 2,  name: "Grey",              hex: 0x808080, ansi: 90 },
  { id: 3,  name: "White",             hex: 0xFFFFFF, ansi: 97 },
  { id: 4,  name: "Dark Red",          hex: 0x8B0000, ansi: 31 },
  { id: 5,  name: "Rose",              hex: 0xFF007F, ansi: 95 },
  { id: 6,  name: "Mona",              hex: 0xF5728C, ansi: 35 },
  { id: 7,  name: "Red",               hex: 0xFF0000, ansi: 91 },
  { id: 8,  name: "Vermilion",         hex: 0xE34234, ansi: 91 },
  { id: 9,  name: "Tangerine",         hex: 0xF28500, ansi: 33 },
  { id: 10, name: "Orange",            hex: 0xFFA500, ansi: 33 },
  { id: 11, name: "Mango Tango",       hex: 0xFF8243, ansi: 93 },
  { id: 12, name: "Koromiko",          hex: 0xFFBD5F, ansi: 93 },
  { id: 13, name: "Yellow",            hex: 0xFFFF00, ansi: 93 },
  { id: 14, name: "Lemon Yellow",      hex: 0xFFF44F, ansi: 93 },
  { id: 15, name: "Pale Canary",       hex: 0xFFFF99, ansi: 97 },
  { id: 16, name: "Lime",              hex: 0x00FF00, ansi: 92 },
  { id: 17, name: "Green Yellow",      hex: 0xADFF2F, ansi: 92 },
  { id: 18, name: "Reef",              hex: 0xD2FF4A, ansi: 92 },
  { id: 19, name: "Green",             hex: 0x008000, ansi: 32 },
  { id: 20, name: "Screamin' Green",   hex: 0x66FF66, ansi: 92 },
  { id: 21, name: "Mint Green",        hex: 0x98FF98, ansi: 96 },
  { id: 22, name: "Spring Green",      hex: 0x00FF7F, ansi: 92 },
  { id: 23, name: "Aquamarine",        hex: 0x7FFFD4, ansi: 96 },
  { id: 24, name: "Aero",              hex: 0x7CB9E8, ansi: 94 },
  { id: 25, name: "Bright Turquoise",  hex: 0x08E8DE, ansi: 96 },
  { id: 26, name: "Aqua",              hex: 0x00FFFF, ansi: 96 },
  { id: 27, name: "Fresh Air",         hex: 0xA6E7FF, ansi: 97 },
  { id: 28, name: "Cyan",              hex: 0x00B7EB, ansi: 36 },
  { id: 29, name: "Malibu",            hex: 0x51B0EF, ansi: 94 },
  { id: 30, name: "Baby Blue",         hex: 0x89CFF0, ansi: 94 },
  { id: 31, name: "Azure Radiance",    hex: 0x007FFF, ansi: 34 },
  { id: 32, name: "Blueberry",         hex: 0x4F86F7, ansi: 94 },
  { id: 33, name: "Anakiwa",           hex: 0x9BC4E2, ansi: 94 },
  { id: 34, name: "Blue Ribbon",       hex: 0x0047AB, ansi: 34 },
  { id: 35, name: "Indigo",            hex: 0x4B0082, ansi: 34 },
  { id: 36, name: "Melrose",           hex: 0xC4B7F8, ansi: 95 },
  { id: 37, name: "Blue",              hex: 0x0000FF, ansi: 94 },
  { id: 38, name: "Royal Blue",        hex: 0x4169E1, ansi: 34 },
  { id: 39, name: "Ship Cove",         hex: 0x788BBA, ansi: 37 },
  { id: 40, name: "Electric Violet",   hex: 0x8B00FF, ansi: 35 },
  { id: 41, name: "Heliotrope",        hex: 0xDF73FF, ansi: 95 },
  { id: 42, name: "Mauve",             hex: 0xE0B0FF, ansi: 95 },
  { id: 43, name: "Violet",            hex: 0xEE82EE, ansi: 35 },
  { id: 44, name: "Amethyst",          hex: 0x9966CC, ansi: 35 },
  { id: 45, name: "East Side",         hex: 0xAC91C8, ansi: 35 },
  { id: 46, name: "Magenta",           hex: 0xFF00FF, ansi: 95 },
  { id: 47, name: "Pink Flamingo",     hex: 0xFC74FD, ansi: 95 },
  { id: 48, name: "Lavender Rose",     hex: 0xFBA0E3, ansi: 95 },
  { id: 49, name: "Hollywood Cerise",  hex: 0xF400A1, ansi: 35 },
  { id: 50, name: "Hot Pink",          hex: 0xFF69B4, ansi: 95 },
  { id: 51, name: "Cotton Candy",      hex: 0xFFB7D5, ansi: 37 },
];

const PER_PAGE    = 10;
const TOTAL_PAGES = Math.ceil(COLOR_LIST.length / PER_PAGE);

// ── hex → RGB ANSI foreground ─────────────────────────
function hexToRgbAnsi(hex) {
  const r = (hex >> 16) & 0xFF;
  const g = (hex >> 8)  & 0xFF;
  const b =  hex        & 0xFF;
  return `\u001b[38;2;${r};${g};${b}m`;
}

// ── جيب ألوان الصفحة ─────────────────────────────────
function pageColors(page) {
  return COLOR_LIST.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
}

// ── بناء إيمبد الصفحة مع RGB ANSI ───────────────────
function buildPageEmbed(page) {
  const colors = pageColors(page);

  // كل سطر بلونه الحقيقي بالكود بتاعه بالظبط
  const half  = Math.ceil(colors.length / 2);
  const left  = colors.slice(0, half);
  const right = colors.slice(half);

  const lines = left.map((lc, i) => {
    const rc   = right[i];
    const lNum = String(lc.id).padStart(2, " ");
    const lTxt = `${hexToRgbAnsi(lc.hex)}${lNum}. ${lc.name}\u001b[0m`;
    if (!rc) return lTxt;
    const rNum = String(rc.id).padStart(2, " ");
    // padding ثابت بين العمودين (الاسم الأطول ~18 حرف + رقم + نقطة = ~23)
    const pad  = " ".repeat(Math.max(1, 24 - (lNum.length + 2 + lc.name.length)));
    const rTxt = `${hexToRgbAnsi(rc.hex)}${rNum}. ${rc.name}\u001b[0m`;
    return `${lTxt}${pad}${rTxt}`;
  });

  return new EmbedBuilder()
    .setColor(colors[0].hex)
    .setTitle("🎨 اختار لون اسمك")
    .setDescription("```ansi\n" + lines.join("\n") + "\n```")
    .setFooter({ text: `📄 صفحة ${page + 1} من ${TOTAL_PAGES}  •  اضغط رقم اللون عشان تاخده ✨` });
}

// ── بناء أزرار الصفحة ────────────────────────────────
function buildPageComponents(page) {
  const colors = pageColors(page);
  const rows   = [];

  // صفين أرقام (5+5)
  const chunks = [];
  for (let i = 0; i < colors.length; i += 5) chunks.push(colors.slice(i, i + 5));
  for (const chunk of chunks) {
    rows.push(new ActionRowBuilder().addComponents(
      chunk.map(c =>
        new ButtonBuilder()
          .setCustomId(`clr_${c.id}`)
          .setLabel(String(c.id))
          .setStyle(ButtonStyle.Primary)
      )
    ));
  }

  // صف التنقل
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`clr_nav_${page - 1}`)
      .setLabel("◀️ السابق")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`clr_nav_${page + 1}`)
      .setLabel("التالي ▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === TOTAL_PAGES - 1),
  ));

  return rows;
}

// ── اسم الرتبة ───────────────────────────────────────
export function colorRoleName(color) {
  return `🎨 ${color.name}`;
}

// ── جيب أو إنشئ رتبة اللون ──────────────────────────
export async function getOrCreateColorRole(guild, color) {
  const name = colorRoleName(color);
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      color: color.hex,
      reason: "نظام تلوين الأسماء",
      hoist: false,
      mentionable: false,
    });
  }
  return role;
}

// ── الأمر الرئيسي ────────────────────────────────────
export const colorsCommand = new SlashCommandBuilder()
  .setName("الوان")
  .setDescription("🎨 عرض لوحة اختيار لون الاسم")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ── هاندلر الأمر — بيبعت صفحة 0 ────────────────────
export async function handleColorsCommand(interaction) {
  const embed = buildPageEmbed(0);
  const components = buildPageComponents(0);
  return interaction.reply({ embeds: [embed], components });
}

// ── هاندلر زرار التنقل ──────────────────────────────
export async function handleColorNav(interaction, page) {
  const embed = buildPageEmbed(page);
  const components = buildPageComponents(page);
  return interaction.update({ embeds: [embed], components });
}

// ── هاندلر زرار اختيار اللون ─────────────────────────
export async function handleColorButton(interaction, colorId) {
  await interaction.deferReply({ ephemeral: true });

  const color = COLOR_LIST.find(c => c.id === colorId);
  if (!color) return interaction.editReply({ content: "❌ اللون ده مش موجود!" });

  const member = interaction.member;
  const guild  = interaction.guild;

  // شيل رتب الألوان القديمة
  const oldColorRoles = member.roles.cache.filter(r => r.name.startsWith("🎨 "));
  if (oldColorRoles.size > 0) {
    await member.roles.remove(oldColorRoles, "تغيير لون الاسم").catch(() => {});
  }

  // جيب أو إنشئ رتبة اللون الجديد
  let role;
  try {
    role = await getOrCreateColorRole(guild, color);
  } catch {
    return interaction.editReply({ content: "❌ مقدرتش أعمل رتبة اللون، تأكد إن البوت عنده صلاحية إدارة الرتب!" });
  }

  await member.roles.add(role, "اختيار لون الاسم").catch(() => {});

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(color.hex)
        .setTitle("🎨 تم تغيير لون اسمك!")
        .setDescription(`لونك دلوقتي: **${color.name}**`)
        .setTimestamp()
    ]
  });
}
