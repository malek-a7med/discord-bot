// ═══════════════════════════════════════════════════════════════
//  🌍 لعبة الحياة — نظام اقتصادي شخصي مستمر (per-guild)
//  ──────────────────────────────────────────────────────────────
//  ✅ النسخة دي تستبدل لعبة "رحلة الحياة" القديمة (8 مواقف + جولات)
//     بالكامل. مفيش انضمام لجلسة، مفيش لوبي، مفيش "ابدأ اللعبة".
//     كل يوزر عنده بروفايل شخصي خاص بيه في السيرفر ده بس، بيتطور
//     تلقائياً بمرور الوقت (دخل/مصاريف) وبيتفاعل معاه بأوامر فورية
//     في أي وقت يحب.
//
//  المبدأ الأساسي (lazy tick):
//  مفيش scheduler خلفي شغال طول الوقت. كل ما اليوزر يستخدم أي أمر
//  من أوامر اللعبة، بنحسب "الفرق الزمني" من آخر مرة لحد دلوقتي،
//  ونطبّق الدخل (مرتب + دخل سلبي من الشركة) والمصاريف (إيجار/صيانة)
//  دفعة واحدة. ده بيوفر كل تعقيد الـ background jobs وبرضه يحس
//  اليوزر إن اللعبة "شغالة طول الوقت" حتى لو هو مش بيكتب حاجة.
// ═══════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, MessageFlags,
} from "discord.js";

// ══════════════════════════════════════════════════════════════
//  ⚙️ الإعدادات الاقتصادية
// ══════════════════════════════════════════════════════════════

// كل قيم الدخل/المصاريف دي "لكل ساعة لعب" — بتُحسب بنسبة الوقت
// الفعلي اللي عدّى (مثلاً نص ساعة = نص القيمة)
const TICK_UNIT_MS = 60 * 60 * 1000; // ساعة واحدة = وحدة الحساب الأساسية

// أقصى مدة بيتم حساب الفارق عليها في تِك واحد (٧ أيام)
// عشان لو يوزر مختفي شهور، مانحسبش له فلوس/ديون متراكمة بجنون
const MAX_TICK_MS = 7 * 24 * TICK_UNIT_MS;

// ── مستويات الوظائف (5 مستويات) ──────────────────────────────
// كل وظيفة: شرط دخول (الأصول المطلوبة) + مرتب لكل ساعة
const JOBS = [
  {
    level: 0,
    name: "بدون وظيفة",
    emoji: "🚫",
    requires: {},
    hourlyWage: 0,
  },
  {
    level: 1,
    name: "دليفري / كول سنتر",
    emoji: "🛵",
    requires: {},
    hourlyWage: 150,
    desc: "وظيفة بداية بدون أي شروط — أول خطوة في حياتك المهنية",
  },
  {
    level: 2,
    name: "موظف محل / كاشير",
    emoji: "🛒",
    requires: {},
    minDaysInPrevJob: 3, // لازم يكون مكمّل 3 أيام في وظيفة أقل أو يساويها
    hourlyWage: 300,
    desc: "بعد خبرة بسيطة في سوق الشغل، بتقدر تترقّى للوظيفة دي",
  },
  {
    level: 3,
    name: "موظف شركة",
    emoji: "🏢",
    requires: { car: true },
    hourlyWage: 600,
    desc: "محتاج عربية للتنقل — الشركات الكبيرة مش بتقبل غير اللي عنده وسيلة نقل",
  },
  {
    level: 4,
    name: "مدير قسم",
    emoji: "💼",
    requires: { car: true, house: true },
    hourlyWage: 1100,
    desc: "محتاج استقرار (بيت) + عربية — المديرين لازم يكونوا مستقرين",
  },
  {
    level: 5,
    name: "رجل أعمال",
    emoji: "👑",
    requires: { car: true, house: true, company: true },
    hourlyWage: 2000,
    desc: "القمة! محتاج كل الأصول الثلاثة — أنت بقيت تدير امبراطوريتك الخاصة",
  },
];

function getJob(level) {
  return JOBS.find(j => j.level === level) || JOBS[0];
}

function nextJob(level) {
  return JOBS.find(j => j.level === level + 1) || null;
}

// ── الممتلكات (3 أنواع، بعمق) ────────────────────────────────
const ASSETS = {
  house: {
    key: "house",
    name: "بيت",
    emoji: "🏠",
    price: 8000,
    sellRatio: 0.6,       // تبيعه بـ 60% من سعره (استهلاك واقعي)
    hourlyMaintenance: 25, // إيجار/صيانة لكل ساعة
    desc: "استقرار، وشرط أساسي لوظائف الإدارة. مصروفه الشهري ثابت.",
  },
  car: {
    key: "car",
    name: "عربية",
    emoji: "🚗",
    price: 5000,
    sellRatio: 0.55,
    hourlyMaintenance: 15,
    accidentChance: 0.04,   // احتمال حادث بسيط كل تفاعل (4%)
    accidentCost: 600,
    desc: "بتفتحلك وظائف أحسن (تنقل)، بس فيها خطر حوادث بسيطة كل فترة.",
  },
  company: {
    key: "company",
    name: "شركة/استثمار",
    emoji: "🏢",
    price: 20000,
    sellRatio: 0.65,
    hourlyMaintenance: 40,
    hourlyIncome: 350, // دخل سلبي تلقائي — أهم ميزة في الشركة
    desc: "أعلى تكلفة، بس بترجع دخل سلبي تلقائي طول الوقت + شرط أعلى وظيفة.",
  },
};

// ── نظام الدين التصاعدي (3 مراحل) ────────────────────────────
const DEBT_WARN_AFTER_MS   = 6  * TICK_UNIT_MS;  // 6 ساعات في الدين → إنذار
const DEBT_PENALTY_AFTER_MS = 24 * TICK_UNIT_MS; // 24 ساعة → عقوبة (تقليل صحة/دخل)
const DEBT_SEIZE_AFTER_MS   = 72 * TICK_UNIT_MS; // 72 ساعة → احتجاز إجباري لأصل

const DEBT_PENALTY_HEALTH_LOSS = 15; // فقدان صحة لما يدخل مرحلة العقوبة
const DEBT_PENALTY_WAGE_CUT    = 0.5; // نص المرتب أثناء العقوبة (ضغط نفسي/مالي)

const STARTING_LOAN_LIMIT = -3000; // أقصى دين مسموح بيه قبل التصعيد الكامل (مرجعي فقط للعرض)

// ══════════════════════════════════════════════════════════════
//  🔧 Helpers عامة
// ══════════════════════════════════════════════════════════════
function fmt(n) {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("en-US");
}

function ownedAssetsList(assets) {
  const owned = Object.values(ASSETS).filter(a => assets[a.key]);
  if (owned.length === 0) return "لا يوجد";
  return owned.map(a => `${a.emoji} ${a.name}`).join("، ");
}

function isInPenaltyPhase(profile) {
  if (profile.debt <= 0 || !profile.debtSince) return false;
  return Date.now() - profile.debtSince >= DEBT_PENALTY_AFTER_MS;
}

// ══════════════════════════════════════════════════════════════
//  ⏱️ منطق الـ Tick — بيتنفذ في بداية كل أمر فرعي
//  بيحسب الدخل/المصاريف منذ آخر مرة، وبيطبّق منطق الدين التصاعدي
//  ──────────────────────────────────────────────────────────────
//  ✅ مبدأ أساسي: profile.coins دايمًا >= 0 (محفظة فعلية، مش رقم سالب).
//     profile.debt منفصل تمامًا وبيتراكم لوحده. المصاريف اللي مفيش
//     لها رصيد كافي بتتحول لدين بدل ما تخلي المحفظة سالبة. الدخل
//     (مرتب + دخل سلبي) بيسدد الدين القائم تلقائيًا الأول، والباقي
//     (لو فيه) بيضاف للمحفظة. ده بيخلي أمر "سدد" مفيد فعليًا —
//     لو عنده رصيد في المحفظة وعنده دين، يقدر يسدد بيه يدويًا في
//     أي وقت، مش يستنى الدخل بس يقلل الدين تلقائيًا.
// ══════════════════════════════════════════════════════════════
function applyTick(profile) {
  const now = Date.now();
  let elapsed = now - profile.lastTick;
  if (elapsed < 0) elapsed = 0; // حماية من ساعة نظام غلط
  if (elapsed > MAX_TICK_MS) elapsed = MAX_TICK_MS;

  const hours = elapsed / TICK_UNIT_MS;
  const events = []; // رسايل نعرضها للمستخدم بعد التيك (حوادث، إنذارات، مصادرة)

  if (hours > 0) {
    const job = getJob(profile.jobLevel);
    const penalty = isInPenaltyPhase(profile);

    // ── الدخل ──
    let wage = job.hourlyWage * hours;
    if (penalty) wage *= DEBT_PENALTY_WAGE_CUT;

    let passiveIncome = 0;
    if (profile.assets.company) passiveIncome = ASSETS.company.hourlyIncome * hours;

    const totalIncome = wage + passiveIncome;

    // ── المصاريف ──
    let maintenance = 0;
    if (profile.assets.house)   maintenance += ASSETS.house.hourlyMaintenance * hours;
    if (profile.assets.car)     maintenance += ASSETS.car.hourlyMaintenance * hours;
    if (profile.assets.company) maintenance += ASSETS.company.hourlyMaintenance * hours;

    // ── حادث العربية (فرصة بسيطة لكل تيك فيه ساعات فعلية) ──
    let accidentCost = 0;
    if (profile.assets.car && Math.random() < ASSETS.car.accidentChance) {
      accidentCost = ASSETS.car.accidentCost;
      events.push(`🚗 حصل حادث بسيط في عربيتك! اتسجل عليك **${fmt(accidentCost)} 🪙** في الإصلاح.`);
    }

    const totalExpenses = maintenance + accidentCost;

    // ── خطوة 1: المصاريف بتتسدد من المحفظة أولاً، واللي مفيش له
    //   رصيد كافي بيتحول لدين مباشرة ──
    if (totalExpenses > 0) {
      if (profile.coins >= totalExpenses) {
        profile.coins -= totalExpenses;
      } else {
        const uncovered = totalExpenses - profile.coins;
        profile.coins = 0;
        profile.debt += uncovered;
      }
    }

    // ── خطوة 2: الدخل بيسدد الدين القائم أولاً، والباقي (لو فيه)
    //   بيضاف للمحفظة ──
    if (totalIncome > 0) {
      if (profile.debt > 0) {
        const payoff = Math.min(profile.debt, totalIncome);
        profile.debt -= payoff;
        const remaining = totalIncome - payoff;
        if (remaining > 0) profile.coins += remaining;
      } else {
        profile.coins += totalIncome;
      }
    }

    // ✅ تقريب الأرقام المخزّنة لأقرب قرش — بدون ده ممكن يتراكم
    //   floating point drift بسيط جداً بعد آلاف التفاعلات بمرور الوقت
    profile.coins = Math.round(profile.coins * 100) / 100;
    profile.debt  = Math.round(profile.debt * 100) / 100;
  }

  // ── معالجة الدين التصاعدي (إنذار / عقوبة / احتجاز) ──
  if (profile.debt > 0) {
    if (!profile.debtSince) profile.debtSince = now;

    const debtAge = now - profile.debtSince;

    // مرحلة 1: إنذار
    if (debtAge >= DEBT_WARN_AFTER_MS && !profile.debtWarned) {
      profile.debtWarned = true;
      events.push(`⚠️ **إنذار:** عليك ديون! سدد بأسرع وقت بـ \`/حياة سدد\` قبل ما الوضع يتعقد.`);
    }

    // مرحلة 2: عقوبة (صحة + مرتب)
    if (debtAge >= DEBT_PENALTY_AFTER_MS && !profile._penaltyApplied) {
      profile._penaltyApplied = true;
      profile.health = Math.max(0, profile.health - DEBT_PENALTY_HEALTH_LOSS);
      events.push(`🩺 **تعب من ضغط الدين:** صحتك نزلت ${DEBT_PENALTY_HEALTH_LOSS} نقطة، ومرتبك هيتقطع للنص لحد ما تسدد.`);
    }

    // مرحلة 3: احتجاز إجباري لأصل
    if (debtAge >= DEBT_SEIZE_AFTER_MS) {
      const ownedKeys = Object.keys(profile.assets).filter(k => profile.assets[k]);
      if (ownedKeys.length > 0) {
        // نصادر أرخص أصل عنده (الأقل ضررًا نسبيًا) ونخصم قيمته من الدين
        const cheapest = ownedKeys
          .map(k => ASSETS[k])
          .sort((a, b) => a.price - b.price)[0];

        profile.assets[cheapest.key] = false;
        const seizeValue = Math.round(cheapest.price * cheapest.sellRatio);

        // قيمة البيع بتروح للدين الأول، والباقي (لو فيه) للمحفظة
        const payoff = Math.min(profile.debt, seizeValue);
        profile.debt -= payoff;
        const remaining = seizeValue - payoff;
        if (remaining > 0) profile.coins += remaining;

        // إعادة تصعيد الدين من جديد لو لسه فيه دين
        if (profile.debt <= 0) {
          profile.debt = 0;
          profile.debtSince = null;
          profile.debtWarned = false;
          profile._penaltyApplied = false;
        } else {
          profile.debtSince = now; // بداية جديدة لحساب التصعيد
          profile.debtWarned = false;
          profile._penaltyApplied = false;
        }

        events.push(
          `🚨 **احتجاز إجباري:** ديونك استمرت طويل من غير تسديد، فالبنك صادر ${cheapest.emoji} **${cheapest.name}** بتاعك ` +
          `وباعه بـ **${fmt(seizeValue)} 🪙** لتقليل الدين.`
        );
      }
    }
  } else {
    // الدين خلص بالكامل — نصفّر كل حالة الدين
    if (profile.debt !== 0 || profile.debtSince) {
      const wasInDebt = profile.debtSince !== null;
      profile.debt = 0;
      profile.debtSince = null;
      profile.debtWarned = false;
      profile._penaltyApplied = false;
      if (wasInDebt) events.push(`✅ سددت كل ديونك! حياتك رجعت لطبيعتها.`);
    }
  }

  profile.lastTick = now;
  return events;
}

// ══════════════════════════════════════════════════════════════
//  🖼️ الـ Embeds
// ══════════════════════════════════════════════════════════════
function profileEmbed(member, profile, events = []) {
  const job = getJob(profile.jobLevel);
  const penalty = isInPenaltyPhase(profile);

  const embed = new EmbedBuilder()
    .setColor(profile.debt > 0 ? 0xe74c3c : 0x27ae60)
    .setTitle(`🌍 ملف الحياة — ${member.displayName ?? member.username}`)
    .addFields(
      { name: "💰 الرصيد", value: `\`${fmt(profile.coins)}\` 🪙`, inline: true },
      { name: "💼 الوظيفة", value: `${job.emoji} ${job.name}`, inline: true },
      { name: "🩺 الصحة", value: `${profile.health}/100`, inline: true },
      { name: "🏷️ ممتلكاتك", value: ownedAssetsList(profile.assets), inline: false },
    );

  if (profile.debt > 0) {
    const phase = penalty ? "🔴 مرحلة العقوبة" : "🟡 إنذار";
    embed.addFields({
      name: "💸 الديون",
      value: `\`${fmt(profile.debt)}\` 🪙 — ${phase}\nسدد بأسرع وقت بـ \`/حياة سدد\` قبل ما يتم احتجاز ممتلكاتك!`,
      inline: false,
    });
  }

  if (events.length > 0) {
    embed.addFields({ name: "📜 آخر التحديثات", value: events.join("\n"), inline: false });
  }

  embed.setFooter({ text: "كل تفاعل بيحسب دخلك ومصاريفك لحد دلوقتي تلقائياً 🔄" }).setTimestamp();
  return embed;
}

function profileButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("life_job").setLabel("💼 الوظائف").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("life_buy").setLabel("🛒 شراء").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("life_sell").setLabel("📤 بيع").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("life_pay").setLabel("💳 سدد الدين").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("life_transfer").setLabel("🔁 تحويل فلوس").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("life_rank").setLabel("🏆 الترتيب").setStyle(ButtonStyle.Primary),
    ),
  ];
}

function jobsEmbed(profile) {
  const lines = JOBS.filter(j => j.level > 0).map(j => {
    const owned = profile.jobLevel === j.level ? " ✅ (وظيفتك الحالية)" : "";
    const reqParts = [];
    if (j.requires.car) reqParts.push("🚗 عربية");
    if (j.requires.house) reqParts.push("🏠 بيت");
    if (j.requires.company) reqParts.push("🏢 شركة");
    if (j.minDaysInPrevJob) reqParts.push(`خبرة ${j.minDaysInPrevJob} أيام بوظيفة سابقة`);
    const reqStr = reqParts.length ? `📋 الشرط: ${reqParts.join(" + ")}` : "📋 بدون شروط";
    return `${j.emoji} **${j.name}**${owned}\n${reqStr}\n💵 المرتب: \`${fmt(j.hourlyWage)}\`/ساعة\n_${j.desc}_`;
  });

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("💼 سلم الوظائف")
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "استخدم /حياة شغل عشان تتقدم على وظيفة" });
}

function jobButtons(profile) {
  const rows = [];
  let row = new ActionRowBuilder();
  for (const j of JOBS.filter(x => x.level > 0)) {
    if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`life_apply_${j.level}`)
        .setLabel(`${j.emoji} ${j.name}`)
        .setStyle(profile.jobLevel === j.level ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(profile.jobLevel === j.level)
    );
  }
  rows.push(row);
  return rows;
}

function assetsEmbed(profile, mode) {
  const title = mode === "buy" ? "🛒 شراء ممتلكات" : "📤 بيع ممتلكات";
  const lines = Object.values(ASSETS).map(a => {
    const owned = profile.assets[a.key];
    if (mode === "buy" && owned) return `${a.emoji} **${a.name}** ✅ — عندك بالفعل`;
    if (mode === "sell" && !owned) return `${a.emoji} **${a.name}** ❌ — لسه مش عندك`;

    if (mode === "buy") {
      return `${a.emoji} **${a.name}** — \`${fmt(a.price)}\` 🪙\n_${a.desc}_`;
    }
    const sellPrice = Math.round(a.price * a.sellRatio);
    return `${a.emoji} **${a.name}** — تبيعها بـ \`${fmt(sellPrice)}\` 🪙ا (${Math.round(a.sellRatio * 100)}% من سعرها)`;
  });

  return new EmbedBuilder()
    .setColor(mode === "buy" ? 0x2ecc71 : 0xe67e22)
    .setTitle(title)
    .setDescription(lines.join("\n\n"));
}

function assetButtons(profile, mode) {
  const row = new ActionRowBuilder();
  for (const a of Object.values(ASSETS)) {
    const owned = profile.assets[a.key];
    const disabled = mode === "buy" ? owned : !owned;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`life_${mode}_${a.key}`)
        .setLabel(`${a.emoji} ${a.name}`)
        .setStyle(mode === "buy" ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  }
  return [row];
}

function rankEmbed(guild, profiles) {
  const sorted = Object.entries(profiles)
    .map(([userId, p]) => ({ userId, netWorth: p.coins - p.debt + assetsValue(p.assets) }))
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 10);

  if (sorted.length === 0) {
    return new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🏆 قمة الأغنياء")
      .setDescription("لسه محدش لعب لعبة الحياة في السيرفر ده!");
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = sorted.map((entry, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    return `${medal} <@${entry.userId}> — \`${fmt(entry.netWorth)}\` 🪙`;
  });

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 قمة الأغنياء — ${guild.name}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: "الترتيب بناءً على صافي الثروة (الرصيد + قيمة الممتلكات - الديون)" })
    .setTimestamp();
}

function assetsValue(assets) {
  let total = 0;
  for (const a of Object.values(ASSETS)) {
    if (assets[a.key]) total += Math.round(a.price * a.sellRatio);
  }
  return total;
}

// ══════════════════════════════════════════════════════════════
//  📨 الأمر الرئيسي /حياة + الـ Subcommands
// ══════════════════════════════════════════════════════════════
export const bankLifeCommand = new SlashCommandBuilder()
  .setName("حياة")
  .setDescription("🌍 نظام حياتك الاقتصادي الشخصي — شغل، ممتلكات، وثروة")
  .addSubcommand(sc => sc.setName("ملف").setDescription("📋 اعرض ملف حياتك الكامل"))
  .addSubcommand(sc => sc.setName("شغل").setDescription("💼 شوف الوظائف وقدّم على وظيفة جديدة"))
  .addSubcommand(sc => sc.setName("شراء").setDescription("🛒 اشتري ممتلكات جديدة (بيت/عربية/شركة)"))
  .addSubcommand(sc => sc.setName("بيع").setDescription("📤 بيع ممتلكات عندك"))
  .addSubcommand(sc => sc.setName("سدد").setDescription("💳 سدد ديونك للبنك"))
  .addSubcommand(sc =>
    sc.setName("تحويل").setDescription("🔁 حوّل فلوس لشخص آخر في السيرفر")
      .addUserOption(o => o.setName("الشخص").setDescription("الشخص اللي هتحوّل له").setRequired(true))
      .addIntegerOption(o => o.setName("المبلغ").setDescription("المبلغ اللي هتحوّله").setRequired(true).setMinValue(1))
  )
  .addSubcommand(sc => sc.setName("ترتيب").setDescription("🏆 شوف قمة الأغنياء في السيرفر"));

export async function handleBankLifeCommand(interaction, db) {
  if (!interaction.guild) {
    return interaction.reply({ content: "❌ لعبة الحياة شغالة بس جوه السيرفرات، مش في الخاص!", flags: MessageFlags.Ephemeral });
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  if (sub === "تحويل") {
    return handleTransfer(interaction, db);
  }

  if (sub === "ترتيب") {
    const profiles = db.getGuildLifeProfiles(guildId);
    return interaction.reply({ embeds: [rankEmbed(interaction.guild, profiles)] }); // عام — مش ephemeral
  }

  // باقي الـ subcommands كلها ephemeral وبتحتاج tick أول حاجة
  const profile = db.ensureLifeProfile(guildId, userId);
  const events = applyTick(profile);
  db.save();

  if (sub === "ملف") {
    const member = interaction.member ?? interaction.user;
    return interaction.reply({
      embeds: [profileEmbed(member, profile, events)],
      components: profileButtons(),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === "شغل") {
    return interaction.reply({
      embeds: [jobsEmbed(profile)],
      components: jobButtons(profile),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === "شراء") {
    return interaction.reply({
      embeds: [assetsEmbed(profile, "buy")],
      components: assetButtons(profile, "buy"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === "بيع") {
    return interaction.reply({
      embeds: [assetsEmbed(profile, "sell")],
      components: assetButtons(profile, "sell"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === "سدد") {
    return handlePayDebtReply(interaction, profile, events);
  }
}

// ── تحويل فلوس بين يوزرز (تجارة مباشرة) ──────────────────────
async function handleTransfer(interaction, db) {
  const guildId = interaction.guild.id;
  const fromId = interaction.user.id;
  const target = interaction.options.getUser("الشخص");
  const amount = interaction.options.getInteger("المبلغ");

  if (target.id === fromId) {
    return interaction.reply({ content: "❌ مينفعش تحوّل فلوس لنفسك!", flags: MessageFlags.Ephemeral });
  }
  if (target.bot) {
    return interaction.reply({ content: "❌ مينفعش تحوّل فلوس لبوت!", flags: MessageFlags.Ephemeral });
  }

  const fromProfile = db.ensureLifeProfile(guildId, fromId);
  applyTick(fromProfile);

  if (fromProfile.coins < amount) {
    db.save();
    return interaction.reply({
      content: `❌ معاك بس \`${fmt(fromProfile.coins)}\` 🪙 — مش كفاية لتحويل \`${fmt(amount)}\` 🪙.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const toProfile = db.ensureLifeProfile(guildId, target.id);
  applyTick(toProfile);

  fromProfile.coins -= amount;
  toProfile.coins += amount;
  db.save();

  return interaction.reply({
    content: `✅ حوّلت \`${fmt(amount)}\` 🪙 لـ <@${target.id}>!\n💰 رصيدك الحالي: \`${fmt(fromProfile.coins)}\` 🪙`,
    flags: MessageFlags.Ephemeral,
  });
}

// ── تسديد الدين (بدون مودال — بيسدد أقصى ما يقدر فورًا) ──────
function handlePayDebtReply(interaction, profile, events) {
  if (profile.debt <= 0) {
    return interaction.reply({
      content: "✅ مالكش أي ديون دلوقتي! حياتك مستقرة 🎉",
      flags: MessageFlags.Ephemeral,
    });
  }

  const payAmount = Math.min(profile.coins > 0 ? profile.coins : 0, profile.debt);
  if (payAmount <= 0) {
    return interaction.reply({
      content: `⚠️ معاك \`${fmt(profile.coins)}\` 🪙 بس — مش معاك حاجة تسددها بيها دلوقتي. اشتغل عشان تجمع فلوس بـ \`/حياة شغل\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  profile.coins -= payAmount;
  profile.debt -= payAmount;
  if (profile.debt <= 0) {
    profile.debt = 0;
    profile.debtSince = null;
    profile.debtWarned = false;
    profile._penaltyApplied = false;
  }

  return interaction.reply({
    content:
      `💳 سددت \`${fmt(payAmount)}\` 🪙 من ديونك!\n` +
      (profile.debt > 0
        ? `💸 باقي عليك: \`${fmt(profile.debt)}\` 🪙`
        : `✅ خلاص! مفيش عليك أي ديون دلوقتي 🎉`),
    flags: MessageFlags.Ephemeral,
  });
}

// ══════════════════════════════════════════════════════════════
//  🖱️ Button Handler — لكل الأزرار اللي بتبدأ بـ life_
// ══════════════════════════════════════════════════════════════
export async function handleBankLifeButton(interaction, db) {
  if (!interaction.guild) {
    return interaction.reply({ content: "❌ لعبة الحياة شغالة بس جوه السيرفرات!", flags: MessageFlags.Ephemeral });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const customId = interaction.customId;

  // ✅ زرار "🌍 الحياة" في مركز الألعاب (/الألعاب) — يفتح نفس الملف الشخصي ephemeral
  if (customId === "ghub_banklife") {
    const profile = db.ensureLifeProfile(guildId, userId);
    const events = applyTick(profile);
    db.save();
    const member = interaction.member ?? interaction.user;
    return interaction.reply({
      embeds: [profileEmbed(member, profile, events)],
      components: profileButtons(),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (customId === "life_job") {
    const profile = db.ensureLifeProfile(guildId, userId);
    applyTick(profile);
    db.save();
    return interaction.update({ embeds: [jobsEmbed(profile)], components: jobButtons(profile) });
  }

  if (customId === "life_buy") {
    const profile = db.ensureLifeProfile(guildId, userId);
    applyTick(profile);
    db.save();
    return interaction.update({ embeds: [assetsEmbed(profile, "buy")], components: assetButtons(profile, "buy") });
  }

  if (customId === "life_sell") {
    const profile = db.ensureLifeProfile(guildId, userId);
    applyTick(profile);
    db.save();
    return interaction.update({ embeds: [assetsEmbed(profile, "sell")], components: assetButtons(profile, "sell") });
  }

  if (customId === "life_pay") {
    const profile = db.ensureLifeProfile(guildId, userId);
    const events = applyTick(profile);
    const result = payDebtAndReturnMessage(profile);
    db.save();
    return interaction.reply({ content: result, flags: MessageFlags.Ephemeral });
  }

  if (customId === "life_rank") {
    const profiles = db.getGuildLifeProfiles(guildId);
    // الترتيب عام — رد جديد منفصل غير ephemeral، مش تعديل على الإمبيد المخفي
    return interaction.reply({ embeds: [rankEmbed(interaction.guild, profiles)] });
  }

  if (customId === "life_transfer") {
    return interaction.reply({
      content: "🔁 لتحويل فلوس لشخص آخر، استخدم الأمر:\n`/حياة تحويل الشخص:@اسمه المبلغ:1000`",
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── التقديم على وظيفة: life_apply_<level> ──
  if (customId.startsWith("life_apply_")) {
    const level = parseInt(customId.replace("life_apply_", ""), 10);
    const job = getJob(level);
    const profile = db.ensureLifeProfile(guildId, userId);
    applyTick(profile);

    if (!job || job.level === 0) {
      db.save();
      return interaction.reply({ content: "❌ وظيفة غير معروفة.", flags: MessageFlags.Ephemeral });
    }

    // فحص الشروط
    const missing = [];
    if (job.requires.car && !profile.assets.car) missing.push("🚗 عربية");
    if (job.requires.house && !profile.assets.house) missing.push("🏠 بيت");
    if (job.requires.company && !profile.assets.company) missing.push("🏢 شركة");

    if (missing.length > 0) {
      db.save();
      return interaction.reply({
        content: `❌ مش معاك الشروط المطلوبة للوظيفة دي. محتاج: ${missing.join("، ")}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (job.minDaysInPrevJob) {
      const daysInJob = profile.jobSince ? (Date.now() - profile.jobSince) / (24 * TICK_UNIT_MS) : 0;
      if (profile.jobLevel < job.level - 1 || daysInJob < job.minDaysInPrevJob) {
        db.save();
        return interaction.reply({
          content: `❌ لازم تكون شغال بوظيفة أقل منها على الأقل ${job.minDaysInPrevJob} أيام الأول قبل ما تترقّى.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    profile.jobLevel = job.level;
    profile.jobSince = Date.now();
    db.save();

    return interaction.update({
      embeds: [jobsEmbed(profile)],
      components: jobButtons(profile),
    });
  }

  // ── شراء أصل: life_buy_<key> ──
  if (customId.startsWith("life_buy_")) {
    const key = customId.replace("life_buy_", "");
    const asset = ASSETS[key];
    const profile = db.ensureLifeProfile(guildId, userId);
    applyTick(profile);

    if (!asset) { db.save(); return interaction.reply({ content: "❌ ممتلك غير معروف.", flags: MessageFlags.Ephemeral }); }
    if (profile.assets[key]) {
      db.save();
      return interaction.reply({ content: `✅ عندك ${asset.emoji} ${asset.name} بالفعل!`, flags: MessageFlags.Ephemeral });
    }
    if (profile.coins < asset.price) {
      db.save();
      return interaction.reply({
        content: `❌ معاك \`${fmt(profile.coins)}\` 🪙 بس — محتاج \`${fmt(asset.price)}\` 🪙 لشراء ${asset.emoji} ${asset.name}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    profile.coins -= asset.price;
    profile.assets[key] = true;
    db.save();

    return interaction.update({ embeds: [assetsEmbed(profile, "buy")], components: assetButtons(profile, "buy") });
  }

  // ── بيع أصل: life_sell_<key> ──
  if (customId.startsWith("life_sell_")) {
    const key = customId.replace("life_sell_", "");
    const asset = ASSETS[key];
    const profile = db.ensureLifeProfile(guildId, userId);
    applyTick(profile);

    if (!asset) { db.save(); return interaction.reply({ content: "❌ ممتلك غير معروف.", flags: MessageFlags.Ephemeral }); }
    if (!profile.assets[key]) {
      db.save();
      return interaction.reply({ content: `❌ مفيش عندك ${asset.emoji} ${asset.name} أصلاً!`, flags: MessageFlags.Ephemeral });
    }

    // لو الوظيفة الحالية محتاجة الأصل ده، بنرجّعه لوظيفة بدون شرط
    const currentJob = getJob(profile.jobLevel);
    profile.assets[key] = false;
    const sellPrice = Math.round(asset.price * asset.sellRatio);
    profile.coins += sellPrice;

    if (currentJob.requires?.[key]) {
      // فقد الشرط — يرجع لأعلى وظيفة لسه مستوفي شروطها
      let fallback = JOBS.filter(j => {
        if (j.requires.car && !profile.assets.car) return false;
        if (j.requires.house && !profile.assets.house) return false;
        if (j.requires.company && !profile.assets.company) return false;
        return j.level <= profile.jobLevel;
      }).sort((a, b) => b.level - a.level)[0] ?? JOBS[0];
      profile.jobLevel = fallback.level;
    }

    db.save();

    return interaction.update({ embeds: [assetsEmbed(profile, "sell")], components: assetButtons(profile, "sell") });
  }
}

function payDebtAndReturnMessage(profile) {
  if (profile.debt <= 0) return "✅ مالكش أي ديون دلوقتي! حياتك مستقرة 🎉";

  const payAmount = Math.min(profile.coins > 0 ? profile.coins : 0, profile.debt);
  if (payAmount <= 0) {
    return `⚠️ معاك \`${fmt(profile.coins)}\` 🪙 بس — مش معاك حاجة تسددها بيها دلوقتي. اشتغل عشان تجمع فلوس بـ \`/حياة شغل\`.`;
  }

  profile.coins -= payAmount;
  profile.debt -= payAmount;
  if (profile.debt <= 0) {
    profile.debt = 0;
    profile.debtSince = null;
    profile.debtWarned = false;
    profile._penaltyApplied = false;
  }

  return (
    `💳 سددت \`${fmt(payAmount)}\` 🪙 من ديونك!\n` +
    (profile.debt > 0
      ? `💸 باقي عليك: \`${fmt(profile.debt)}\` 🪙`
      : `✅ خلاص! مفيش عليك أي ديون دلوقتي 🎉`)
  );
}
