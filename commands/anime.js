// ═══════════════════════════════════════════════════════════════
//  🎌 نظام الأنمي الكامل — Zangi Bot
//  API: Jikan v4 (MAL wrapper) — مجاني بدون مفتاح
//  الميزات:
//   • بحث + نتائج تفاعلية
//   • صفحة الأنمي الكاملة
//   • قوائم الحلقات
//   • حساب شخصي لكل يوزر
//   • قائمة المشاهدة (watching / completed / plan / dropped)
//   • تقييمات
//   • إحصائيات
//   • أنمي رائج + موسم الآن
// ═══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";

// ─── Jikan API v4 ────────────────────────────────────────────
const JIKAN = "https://api.jikan.moe/v4";
const JIKAN_DELAY_MS = 400; // احترام rate limit (3 req/sec)

let _lastJikanCall = 0;
async function jikan(path, params = {}) {
  const now = Date.now();
  const wait = JIKAN_DELAY_MS - (now - _lastJikanCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastJikanCall = Date.now();

  const url = new URL(`${JIKAN}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json", "User-Agent": "ZangiDiscordBot/3.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${path}`);
  return res.json();
}

// ─── مخزن مؤقت للبيانات (cache 10 دقايق) ──────────────────
const _cache = new Map();
async function cachedJikan(key, path, params = {}) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < 10 * 60_000) return hit.data;
  const data = await jikan(path, params);
  _cache.set(key, { data, ts: Date.now() });
  return data;
}

// ─── Session store (نتائج البحث + صفحة الأنمي + حلقات) ─────
export const animeSessions = new Map(); // sessionKey → data
function sessionKey(userId) { return `anime_${userId}`; }
function setSession(userId, data) {
  animeSessions.set(sessionKey(userId), { ...data, ts: Date.now() });
  setTimeout(() => animeSessions.delete(sessionKey(userId)), 15 * 60_000);
}
function getSession(userId) { return animeSessions.get(sessionKey(userId)); }

// ─── ألوان حسب التقييم ───────────────────────────────────────
function scoreColor(score) {
  if (!score) return 0x95a5a6;
  if (score >= 8.5) return 0xf1c40f;
  if (score >= 7.5) return 0x2ecc71;
  if (score >= 6.0) return 0x3498db;
  if (score >= 5.0) return 0xe67e22;
  return 0xe74c3c;
}

// ─── بناء إيمبد تفاصيل الأنمي ───────────────────────────────
function buildAnimeEmbed(anime) {
  const score    = anime.score ? `⭐ ${anime.score}/10 (${anime.scored_by?.toLocaleString()} تقييم)` : "⭐ لا يوجد تقييم";
  const status   = { "Finished Airing": "✅ انتهى", "Currently Airing": "📡 يعرض الآن", "Not yet aired": "📅 قادم" }[anime.status] || anime.status;
  const type     = { "TV": "📺 TV", "Movie": "🎬 فيلم", "OVA": "💿 OVA", "ONA": "🌐 ONA", "Special": "⭐ خاص" }[anime.type] || anime.type;
  const episodes = anime.episodes ? `${anime.episodes} حلقة` : "؟ حلقات";
  const genres   = anime.genres?.map(g => g.name).join(", ") || "—";
  const studios  = anime.studios?.map(s => s.name).join(", ") || "—";
  const season   = anime.season ? `${anime.season} ${anime.year}` : (anime.year || "—");
  const rating   = { "G": "عام", "PG": "+7", "PG-13": "+13", "R - 17+": "+17", "R+": "+18" }[anime.rating] || (anime.rating || "—");

  const synopsis = anime.synopsis
    ? (anime.synopsis.length > 800 ? anime.synopsis.slice(0, 797) + "..." : anime.synopsis)
    : "لا يوجد وصف.";

  const embed = new EmbedBuilder()
    .setColor(scoreColor(anime.score))
    .setTitle(`${anime.title_arabic || anime.title} ${anime.title_japanese ? `(${anime.title_japanese})` : ""}`.trim())
    .setURL(anime.url || `https://myanimelist.net/anime/${anime.mal_id}`)
    .setDescription(`*${anime.title_english || anime.title}*\n\n${synopsis}`)
    .addFields(
      { name: "📊 التقييم",   value: score,     inline: true },
      { name: "🎬 النوع",     value: type,      inline: true },
      { name: "📺 الحالة",    value: status,    inline: true },
      { name: "📅 الحلقات",   value: episodes,  inline: true },
      { name: "🗓️ الموسم",   value: season,    inline: true },
      { name: "🔞 التصنيف",   value: rating,    inline: true },
      { name: "🎭 التصنيفات", value: genres,    inline: false },
      { name: "🏢 الاستوديو", value: studios,   inline: true },
    )
    .setFooter({ text: `MAL ID: ${anime.mal_id} • بيانات من MyAnimeList` })
    .setTimestamp();

  if (anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url) {
    embed.setThumbnail(anime.images.jpg.large_image_url || anime.images.jpg.image_url);
  }

  return embed;
}

// ─── بناء أزرار صفحة الأنمي ──────────────────────────────────
function buildAnimeButtons(malId, userId, userStatus = null) {
  const statusBtns = {
    watching:    { label: "📺 أشاهده",   style: ButtonStyle.Primary },
    completed:   { label: "✅ اكتملت",   style: ButtonStyle.Success },
    plan:        { label: "📌 هشاهده",   style: ButtonStyle.Secondary },
    dropped:     { label: "🚫 تركته",    style: ButtonStyle.Danger },
  };

  const currentBtn = userStatus ? statusBtns[userStatus] : null;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`anime_eps_${malId}`)
      .setLabel("📺 الحلقات")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`anime_watch_${malId}`)
      .setLabel("▶️ شاهد الآن")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`anime_rate_${malId}`)
      .setLabel("⭐ قيّم")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`anime_trailer_${malId}`)
      .setLabel("🎬 تريلر")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`anime_list_watching_${malId}`)
      .setLabel("📺 أشاهده")
      .setStyle(userStatus === "watching" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`anime_list_completed_${malId}`)
      .setLabel("✅ أكملت")
      .setStyle(userStatus === "completed" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`anime_list_plan_${malId}`)
      .setLabel("📌 هشاهده")
      .setStyle(userStatus === "plan" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`anime_list_dropped_${malId}`)
      .setLabel("🚫 تركته")
      .setStyle(userStatus === "dropped" ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`anime_list_remove_${malId}`)
      .setLabel("❌ شيل")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

// ─── بناء اللوحة الرئيسية ────────────────────────────────────
export function buildAnimePanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("🎌 مركز الأنمي — Zangi Bot")
    .setDescription(
      "**أهلاً بك في مركز الأنمي! 🌸**\n\n" +
      "🔍 **بحث** — ابحث عن أي أنمي بالاسم\n" +
      "🔥 **رائج** — أشهر الأنميات دلوقتي\n" +
      "🌸 **موسم الآن** — أنمي الموسم الحالي\n" +
      "🔁 **توصيات** — أنمي مقترح بناءً على قائمتك\n" +
      "📋 **قائمتي** — قوايم مشاهدتك (watching / completed / plan)\n" +
      "👤 **ملفي** — إحصائياتك وتقييماتك\n" +
      "📤 **نشر اللوحة** — ابعت اللوحة دي عامة في الروم عشان الكل يستخدمها\n\n" +
      "*ردودك الشخصية مخفية — بس أنت اللي تشوفها* 🔒"
    )
    .setFooter({ text: "بيانات من MyAnimeList • Jikan API v4" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("anime_search_btn").setLabel("🔍 بحث").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("anime_trending_btn").setLabel("🔥 رائج").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("anime_season_btn").setLabel("🌸 موسم الآن").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("anime_recommend_btn").setLabel("🔁 توصيات").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("anime_publish_btn").setLabel("📤 نشر اللوحة").setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("anime_mylist_btn").setLabel("📋 قائمتي").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("anime_profile_btn").setLabel("👤 ملفي").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ═══════════════════════════════════════════════════════════════
//  HANDLERS — معالجة كل الأحداث
// ═══════════════════════════════════════════════════════════════

// ─── بحث: فتح modal ──────────────────────────────────────────
export async function handleAnimeSearchBtn(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("anime_search_modal")
    .setTitle("🔍 بحث عن أنمي");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("anime_query")
        .setLabel("اسم الأنمي (عربي أو إنجليزي)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(100)
        .setPlaceholder("مثال: Solo Leveling أو سولو ليفيلنج")
    )
  );
  return interaction.showModal(modal);
}

// ─── بحث: معالجة نتائج الـ modal ────────────────────────────
export async function handleAnimeSearchModal(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  const query = interaction.fields.getTextInputValue("anime_query").trim();

  let results;
  try {
    const data = await jikan("/anime", { q: query, limit: 8, sfw: false });
    results = data.data || [];
  } catch (e) {
    return interaction.editReply({ content: "❌ فشل البحث — جرب تاني بعد شوية." });
  }

  if (!results.length) {
    return interaction.editReply({ content: `❌ ما لقيتش نتايج لـ **${query}** — جرب اسم تاني.` });
  }

  // حفظ النتائج في الـ session
  setSession(interaction.user.id, { type: "search_results", results, query });

  const options = results.slice(0, 10).map((a, i) => ({
    label: (a.title_english || a.title).slice(0, 100),
    description: `${a.type || "?"} • ${a.episodes ? a.episodes + " حلقة" : "؟ حلقات"} • ⭐ ${a.score || "N/A"}`,
    value: `${a.mal_id}`,
    emoji: ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"][i] || "📌",
  }));

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🔍 نتايج البحث: "${query}"`)
    .setDescription(`وجدت **${results.length}** نتيجة — اختار من القايمة:`);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("anime_select_result")
      .setPlaceholder("اختار الأنمي اللي تريده...")
      .addOptions(options)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

// ─── اختيار أنمي من نتايج البحث ────────────────────────────
export async function handleAnimeSelectResult(interaction, db) {
  await interaction.deferUpdate();
  const malId = parseInt(interaction.values[0]);
  await showAnimePage(interaction, db, malId, true);
}

// ─── عرض صفحة الأنمي ────────────────────────────────────────
async function showAnimePage(interaction, db, malId, isDeferred = false) {
  try {
    const data = await cachedJikan(`anime_${malId}`, `/anime/${malId}/full`);
    const anime = data.data;
    if (!anime) throw new Error("مش لاقي بيانات");

    setSession(interaction.user.id, { type: "anime_page", anime });

    const userStatus = db.getAnimeStatus(interaction.user.id, malId);
    const embed = buildAnimeEmbed(anime);
    const rows  = buildAnimeButtons(malId, interaction.user.id, userStatus);

    const method = isDeferred ? interaction.editReply : interaction.reply;
    await method.call(interaction, { embeds: [embed], components: rows, ephemeral: true });
  } catch (e) {
    const msg = { content: `❌ فشلت في تحميل الأنمي: ${e.message}`, ephemeral: true };
    if (isDeferred) interaction.editReply(msg); else interaction.reply(msg);
  }
}

// ─── الأنمي الرائج ───────────────────────────────────────────
export async function handleAnimeTrending(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const data = await cachedJikan("trending", "/top/anime", { filter: "airing", limit: 10 });
    const list = data.data || [];

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔥 أشهر الأنميات الآن")
      .setDescription(
        list.map((a, i) => {
          const rank   = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"][i];
          const score  = a.score ? `⭐ ${a.score}` : "";
          const eps    = a.episodes ? `📺 ${a.episodes}ح` : "📡 يعرض";
          const title  = (a.title_english || a.title).slice(0, 45);
          return `${rank} **[${title}](${a.url})** — ${score} ${eps}`;
        }).join("\n")
      )
      .setFooter({ text: "المصدر: MyAnimeList • يتجدد كل 10 دقايق" })
      .setTimestamp();

    // أزرار للأنميات الأوائل
    const options = list.slice(0, 10).map((a, i) => ({
      label: (a.title_english || a.title).slice(0, 100),
      description: `⭐ ${a.score || "N/A"} • ${a.episodes ? a.episodes + " حلقة" : "يعرض الآن"}`,
      value: `${a.mal_id}`,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("anime_select_result")
        .setPlaceholder("اختار أنمي عشان تشوف تفاصيله...")
        .addOptions(options)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  } catch (e) {
    return interaction.editReply({ content: "❌ فشل تحميل القايمة — جرب تاني." });
  }
}

// ─── أنمي الموسم ─────────────────────────────────────────────
export async function handleAnimeSeason(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const data = await cachedJikan("season_now", "/seasons/now", { limit: 12 });
    const list = (data.data || []).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);

    const now     = new Date();
    const months  = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const seasons = { 1:"شتاء ❄️", 2:"شتاء ❄️", 3:"ربيع 🌸", 4:"ربيع 🌸", 5:"ربيع 🌸", 6:"صيف ☀️", 7:"صيف ☀️", 8:"صيف ☀️", 9:"خريف 🍂", 10:"خريف 🍂", 11:"خريف 🍂", 12:"شتاء ❄️" };
    const currentSeason = seasons[now.getMonth() + 1];

    const embed = new EmbedBuilder()
      .setColor(0xff6b9d)
      .setTitle(`🌸 أنمي الموسم — ${currentSeason} ${now.getFullYear()}`)
      .setDescription(
        list.map((a, i) => {
          const score  = a.score ? `⭐ ${a.score}` : "⭐ جديد";
          const status = a.status === "Currently Airing" ? "📡" : "✅";
          const title  = (a.title_english || a.title).slice(0, 45);
          const genres = a.genres?.slice(0,2).map(g=>g.name).join(", ") || "";
          return `**${i+1}.** ${status} **[${title}](${a.url})** ${score}\n   └ *${genres}*`;
        }).join("\n")
      )
      .setFooter({ text: `${list.length} أنمي من MyAnimeList` })
      .setTimestamp();

    const options = list.slice(0, 10).map(a => ({
      label: (a.title_english || a.title).slice(0, 100),
      description: `⭐ ${a.score || "جديد"} • ${a.genres?.slice(0,2).map(g=>g.name).join(", ") || ""}`,
      value: `${a.mal_id}`,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("anime_select_result")
        .setPlaceholder("اختار أنمي عشان تشوف تفاصيله...")
        .addOptions(options)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  } catch (e) {
    return interaction.editReply({ content: "❌ فشل تحميل موسم الآن — جرب تاني." });
  }
}

// ─── قائمة المشاهدة الشخصية ──────────────────────────────────
export async function handleAnimeMyList(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  const profile  = db.getAnimeProfile(interaction.user.id);
  const watching = profile.watching || [];
  const completed= profile.completed || [];
  const plan     = profile.planToWatch || [];
  const dropped  = profile.dropped || [];

  if (!watching.length && !completed.length && !plan.length && !dropped.length) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("anime_search_btn").setLabel("🔍 ابحث عن أنمي الآن").setStyle(ButtonStyle.Primary)
    );
    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle("📋 قائمتي — فاضية").setDescription("لسه ما أضفتش أي أنمي!\nاضغط على زرار البحث عشان تبدأ.")],
      components: [row],
    });
  }

  function listSection(items, emoji, label) {
    if (!items.length) return "";
    const lines = items.slice(0, 5).map(a => `• **${a.title?.slice(0,40) || "—"}**${a.progress ? ` *(حلقة ${a.progress}/${a.totalEps || "?"})* ` : ""}`);
    const more  = items.length > 5 ? `\n*+ ${items.length - 5} أكتر*` : "";
    return `**${emoji} ${label} (${items.length})**\n${lines.join("\n")}${more}\n\n`;
  }

  const desc =
    listSection(watching,  "📺", "أشاهده الآن") +
    listSection(plan,      "📌", "هشاهده") +
    listSection(completed, "✅", "اكتملت") +
    listSection(dropped,   "🚫", "تركته");

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`📋 قائمة مشاهدة ${interaction.user.displayName}`)
    .setDescription(desc.trim() || "القائمة فاضية")
    .addFields(
      { name: "📊 الإجمالي", value: `📺 ${watching.length} | ✅ ${completed.length} | 📌 ${plan.length} | 🚫 ${dropped.length}`, inline: false }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  // أزرار الفلترة لو القائمة كبيرة
  const rows = [];
  if (watching.length > 0) {
    const options = watching.slice(0, 10).map(a => ({
      label: (a.title || "أنمي").slice(0, 100),
      description: `حلقة ${a.progress || 0}/${a.totalEps || "?"}`,
      value: `${a.malId}`,
    }));
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("anime_select_result")
        .setPlaceholder("📺 اختار أنمي من قائمة المشاهدة...")
        .addOptions(options)
    ));
  }

  return interaction.editReply({ embeds: [embed], components: rows });
}

// ─── ملف المستخدم الشخصي ─────────────────────────────────────
export async function handleAnimeProfile(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  const profile   = db.getAnimeProfile(interaction.user.id);
  const watching  = (profile.watching  || []).length;
  const completed = (profile.completed || []).length;
  const plan      = (profile.planToWatch || []).length;
  const dropped   = (profile.dropped   || []).length;
  const ratings   = profile.ratings || {};
  const ratingList= Object.values(ratings);
  const avgRating = ratingList.length > 0
    ? (ratingList.reduce((s, r) => s + r, 0) / ratingList.length).toFixed(1)
    : "—";

  const totalWatched = completed + watching;
  const topRated = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, r]) => {
      const found = [...(profile.watching||[]), ...(profile.completed||[])].find(a => `${a.malId}` === `${id}`);
      return found ? `⭐ **${r}/10** — ${found.title?.slice(0,30)}` : null;
    })
    .filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`👤 ملف أنمي — ${interaction.user.displayName}`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "📊 إحصائياتي", value:
        `📺 **أشاهده:** ${watching}\n` +
        `✅ **اكتملت:** ${completed}\n` +
        `📌 **هشاهده:** ${plan}\n` +
        `🚫 **تركته:** ${dropped}\n` +
        `📈 **المجموع:** ${watching + completed + plan + dropped}`,
        inline: true
      },
      { name: "⭐ تقييماتي", value:
        `🎯 **عدد التقييمات:** ${ratingList.length}\n` +
        `📊 **متوسط تقييمي:** ${avgRating}\n` +
        (topRated.length ? `\n**الأعلى تقييماً:**\n${topRated.join("\n")}` : "*مش قيّمت لسه*"),
        inline: true
      },
    )
    .setFooter({ text: "البيانات محفوظة في الخادم" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("anime_search_btn").setLabel("🔍 بحث").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("anime_mylist_btn").setLabel("📋 قائمتي").setStyle(ButtonStyle.Secondary),
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

// ─── عرض قائمة الحلقات ───────────────────────────────────────
export async function handleAnimeEpisodes(interaction, db, malId) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const animeData = await cachedJikan(`anime_${malId}`, `/anime/${malId}/full`);
    const anime     = animeData.data;
    const epsData   = await cachedJikan(`eps_${malId}_1`, `/anime/${malId}/episodes`, { page: 1 });
    const episodes  = epsData.data || [];
    const totalEps  = anime.episodes || epsData.pagination?.items?.total || episodes.length;

    const profile     = db.getAnimeProfile(interaction.user.id);
    const animeEntry  = [...(profile.watching||[]), ...(profile.completed||[])].find(a => a.malId === malId);
    const progress    = animeEntry?.progress || 0;

    // عرض أول 25 حلقة كـ select menu
    const chunk = episodes.slice(0, 25);
    if (!chunk.length && totalEps > 0) {
      // مفيش حلقات في الـ API — نعمل select من الأرقام
      const count = Math.min(totalEps, 25);
      const options = Array.from({ length: count }, (_, i) => ({
        label: `حلقة ${i + 1}`,
        description: progress > i ? "✅ شاهدتها" : "",
        value: `ep_${malId}_${i + 1}`,
        emoji: progress > i ? "✅" : (progress === i ? "▶️" : "⬜"),
      }));
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📺 حلقات: ${(anime.title_english || anime.title).slice(0, 60)}`)
        .setDescription(`**${totalEps} حلقة** ${progress > 0 ? `• وصلت حلقة **${progress}**` : "• لسه ما بدأتش"}\nاختار الحلقة اللي عايز تشوفها:`);
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("anime_select_episode")
          .setPlaceholder("اختار الحلقة...")
          .addOptions(options)
      );
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    const options = chunk.map(ep => ({
      label: `حلقة ${ep.mal_id}: ${(ep.title || `Episode ${ep.mal_id}`).slice(0, 80)}`,
      description: ep.aired ? new Date(ep.aired).toLocaleDateString("ar-EG") : "",
      value: `ep_${malId}_${ep.mal_id}`,
      emoji: progress >= ep.mal_id ? "✅" : (progress + 1 === ep.mal_id ? "▶️" : "⬜"),
    }));

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📺 حلقات: ${(anime.title_english || anime.title).slice(0, 60)}`)
      .setDescription(`**${totalEps} حلقة** ${progress > 0 ? `• وصلت حلقة **${progress}**` : "• لسه ما بدأتش"}\nاختار الحلقة اللي عايز تشوفها:`);

    const rows = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("anime_select_episode")
          .setPlaceholder("اختار الحلقة...")
          .addOptions(options)
      )
    ];

    if (totalEps > 25) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`anime_eps_p2_${malId}`)
          .setLabel(`📄 الصفحة التالية (ح ${26}–${Math.min(totalEps, 50)})`)
          .setStyle(ButtonStyle.Secondary)
      ));
    }

    return interaction.editReply({ embeds: [embed], components: rows });
  } catch (e) {
    return interaction.editReply({ content: `❌ فشل تحميل الحلقات: ${e.message}` });
  }
}

// ─── اختيار حلقة وإرسال رابط في الخاص ──────────────────────
export async function handleAnimeSelectEpisode(interaction, db) {
  await interaction.deferUpdate();

  const value   = interaction.values[0]; // ep_${malId}_${epNum}
  const parts   = value.split("_");
  const malId   = parseInt(parts[1]);
  const epNum   = parseInt(parts[2]);

  try {
    const animeData = await cachedJikan(`anime_${malId}`, `/anime/${malId}/full`);
    const anime     = animeData.data;
    const title     = anime.title_english || anime.title;
    const titleJP   = anime.title;

    // تحديث progress في قايمة المستخدم
    db.updateAnimeProgress(interaction.user.id, malId, epNum, anime.episodes || 0);

    // بناء روابط المشاهدة
    const encoded    = encodeURIComponent(titleJP || title);
    const encodedEN  = encodeURIComponent(title);

    const watchLinks = [
      { name: "🟢 AniWatch.to",    url: `https://aniwatch.to/search?keyword=${encodedEN}` },
      { name: "🔵 Gogoanime",      url: `https://gogoanime.tel/search.html?keyword=${encodedEN}` },
      { name: "🟡 Crunchyroll",    url: `https://www.crunchyroll.com/search?q=${encodedEN}` },
      { name: "🔴 AnimeKai",       url: `https://animekai.to/browser?keyword=${encodedEN}` },
      { name: "⚫ MyAnimeList",     url: `https://myanimelist.net/anime/${malId}` },
    ];

    const dmEmbed = new EmbedBuilder()
      .setColor(scoreColor(anime.score))
      .setTitle(`▶️ ${title}`)
      .setDescription(
        `**حلقة ${epNum}** ${anime.episodes ? `من ${anime.episodes}` : ""}\n\n` +
        `📺 روابط المشاهدة:\n` +
        watchLinks.map(l => `• [${l.name}](${l.url})`).join("\n") +
        `\n\n💡 *ابحث عن الاسم في أي موقع من فوق وهتلاقي الحلقة مباشرة*`
      )
      .setThumbnail(anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url)
      .addFields(
        { name: "📊 تقييم الأنمي", value: anime.score ? `⭐ ${anime.score}/10` : "لا يوجد", inline: true },
        { name: "📺 إجمالي الحلقات", value: `${anime.episodes || "؟"} حلقة`, inline: true },
        { name: "📈 تقدمك", value: `حلقة **${epNum}**/${anime.episodes || "?"}`, inline: true },
      )
      .setFooter({ text: `MAL ID: ${malId} • زنجي Bot 🎌` })
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [dmEmbed] });
      await interaction.followUp({
        content: `✅ **تم إرسال رابط الحلقة ${epNum} في الخاص!** 📬\nتقدمك اتسجّل تلقائياً.`,
        ephemeral: true,
      });
    } catch {
      // لو الـ DM مغلق، نرد في نفس المكان
      await interaction.editReply({
        content: `❌ مش قادر أبعتلك في الخاص — تأكد إن الـ DM مفتوح.\n\n📺 **روابط المشاهدة لحلقة ${epNum}:**\n${watchLinks.map(l => `• [${l.name}](${l.url})`).join("\n")}`,
      });
    }
  } catch (e) {
    await interaction.followUp({ content: `❌ خطأ: ${e.message}`, ephemeral: true });
  }
}

// ─── تقييم الأنمي ────────────────────────────────────────────
export async function handleAnimeRate(interaction, db, malId) {
  const modal = new ModalBuilder()
    .setCustomId(`anime_rate_modal_${malId}`)
    .setTitle("⭐ قيّم الأنمي");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rate_value")
        .setLabel("تقييمك من 10 (مثال: 8 أو 7.5)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4)
        .setPlaceholder("1 – 10")
    )
  );
  return interaction.showModal(modal);
}

export async function handleAnimeRateModal(interaction, db) {
  const malId    = parseInt(interaction.customId.replace("anime_rate_modal_", ""));
  const rawScore = interaction.fields.getTextInputValue("rate_value").trim();
  const score    = parseFloat(rawScore);

  if (isNaN(score) || score < 1 || score > 10) {
    return interaction.reply({ content: "❌ التقييم لازم يكون رقم من 1 لـ 10!", ephemeral: true });
  }

  try {
    const animeData = await cachedJikan(`anime_${malId}`, `/anime/${malId}/full`);
    const anime     = animeData.data;
    db.rateAnime(interaction.user.id, malId, score, anime.title_english || anime.title);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(scoreColor(score))
        .setTitle("⭐ تم التقييم!")
        .setDescription(`قيّمت **${anime.title_english || anime.title}** بـ **${score}/10** ⭐\nتقييمك اتحفظ في ملفك الشخصي.`)
        .setTimestamp()],
      ephemeral: true,
    });
  } catch (e) {
    return interaction.reply({ content: `❌ خطأ: ${e.message}`, ephemeral: true });
  }
}

// ─── إضافة/تغيير حالة الأنمي في القائمة ───────────────────
export async function handleAnimeListAction(interaction, db, status, malId) {
  try {
    const animeData = await cachedJikan(`anime_${malId}`, `/anime/${malId}/full`);
    const anime     = animeData.data;
    const title     = anime.title_english || anime.title;

    if (status === "remove") {
      db.removeFromAnimeList(interaction.user.id, malId);
      return interaction.reply({
        content: `✅ **${title}** اتشال من قايمتك.`,
        ephemeral: true,
      });
    }

    const labels = { watching: "أشاهده 📺", completed: "اكتملت ✅", plan: "هشاهده 📌", dropped: "تركته 🚫" };
    db.setAnimeStatus(interaction.user.id, malId, title, status, anime.episodes || 0, anime.images?.jpg?.image_url);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(scoreColor(anime.score))
        .setTitle(`✅ تم التحديث`)
        .setDescription(`**${title}** اتضاف لقائمة **${labels[status]}**`)
        .setThumbnail(anime.images?.jpg?.image_url)
        .setTimestamp()],
      ephemeral: true,
    });
  } catch (e) {
    return interaction.reply({ content: `❌ خطأ: ${e.message}`, ephemeral: true });
  }
}

// ─── تريلر ───────────────────────────────────────────────────
export async function handleAnimeTrailer(interaction, malId) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const data  = await cachedJikan(`anime_${malId}`, `/anime/${malId}/full`);
    const anime = data.data;
    const trailer = anime.trailer;

    if (!trailer?.url && !trailer?.youtube_id) {
      return interaction.editReply({ content: "❌ مفيش تريلر متاح لهذا الأنمي على YouTube." });
    }

    const url = trailer.url || `https://www.youtube.com/watch?v=${trailer.youtube_id}`;
    return interaction.editReply({
      content: `🎬 **تريلر: ${anime.title_english || anime.title}**\n${url}`,
    });
  } catch (e) {
    return interaction.editReply({ content: `❌ خطأ: ${e.message}` });
  }
}

// ─── توصيات بناءً على قائمة المستخدم ────────────────────────
export async function handleAnimeRecommend(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  const profile   = db.getAnimeProfile(interaction.user.id);
  const allWatched = [...(profile.completed || []), ...(profile.watching || [])];

  // لو القائمة فاضية، نوصي من أفضل الأنميات عموماً
  if (!allWatched.length) {
    try {
      const data = await cachedJikan("top_all", "/top/anime", { filter: "bypopularity", limit: 10 });
      const list = data.data || [];
      const options = list.slice(0, 10).map(a => ({
        label: (a.title_english || a.title).slice(0, 100),
        description: `⭐ ${a.score || "N/A"} • ${a.genres?.slice(0,2).map(g=>g.name).join(", ") || ""}`,
        value: `${a.mal_id}`,
      }));
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("🔁 توصيات — الأكثر شعبية")
        .setDescription("لسه ما عندكش قائمة مشاهدة، فده أفضل الأنميات عموماً:\n*(أضف أنمي لقائمتك عشان التوصيات تبقى شخصية أكتر)*");
      return interaction.editReply({ embeds: [embed], components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId("anime_select_result").setPlaceholder("اختار أنمي...").addOptions(options)
        )
      ]});
    } catch (e) {
      return interaction.editReply({ content: "❌ فشل تحميل التوصيات." });
    }
  }

  // اختار أنمي عشوائي من القائمة عشان نجيب توصيات منه
  const ratings = profile.ratings || {};
  // الأعلى تقييم أو أي حاجة من القائمة
  const sorted = allWatched
    .map(a => ({ ...a, score: ratings[a.malId] || 0 }))
    .sort((a, b) => b.score - a.score);

  const watchedIds = new Set(allWatched.map(a => a.malId));
  let recs = [];

  // جرب أول 3 أنميات عشان تلاقي توصيات كافية
  for (const entry of sorted.slice(0, 3)) {
    try {
      const data = await jikan(`/anime/${entry.malId}/recommendations`);
      const items = (data.data || [])
        .filter(r => !watchedIds.has(r.entry?.mal_id))
        .slice(0, 5);
      recs.push(...items.map(r => r.entry));
      if (recs.length >= 8) break;
    } catch { continue; }
  }

  // شيل المكرر
  const seen = new Set();
  recs = recs.filter(a => { if (!a?.mal_id || seen.has(a.mal_id)) return false; seen.add(a.mal_id); return true; }).slice(0, 10);

  if (!recs.length) {
    return interaction.editReply({ content: "❌ ما لقيناش توصيات — جرب تضيف أنميات أكتر في قائمتك." });
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🔁 توصيات مخصصة ليك")
    .setDescription(
      `بناءً على قائمتك (${allWatched.length} أنمي)، ده اللي ممكن يعجبك:\n\n` +
      recs.map((a, i) => `**${i+1}.** **[${(a.title_english || a.title || "—").slice(0,45)}](https://myanimelist.net/anime/${a.mal_id})**`).join("\n")
    )
    .setFooter({ text: "اختار من القايمة عشان تشوف تفاصيله" });

  const options = recs.map(a => ({
    label: (a.title_english || a.title || "أنمي").slice(0, 100),
    description: `MAL ID: ${a.mal_id}`,
    value: `${a.mal_id}`,
  }));

  return interaction.editReply({ embeds: [embed], components: [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId("anime_select_result").setPlaceholder("اختار أنمي من التوصيات...").addOptions(options)
    )
  ]});
}

// ─── نشر اللوحة في الروم عاملة ──────────────────────────────
export async function handleAnimePublish(interaction) {
  try {
    await interaction.channel.send(buildAnimePanel());
    return interaction.reply({
      content: `✅ تم نشر لوحة الأنمي في <#${interaction.channel.id}>!\nدلوقتي أي حد في الروم يقدر يستخدمها.`,
      ephemeral: true,
    });
  } catch (e) {
    return interaction.reply({
      content: `❌ مش قادر أنشر في الروم ده — تأكد إن البوت عنده صلاحية إرسال رسايل.\n*${e.message}*`,
      ephemeral: true,
    });
  }
}

// ─── تعريف الأمر الوحيد ──────────────────────────────────────
export const animeCommand = new SlashCommandBuilder()
  .setName("أنمي")
  .setDescription("🎌 افتح مركز الأنمي — بحث، قوايم، تقييمات، وأكتر كله في أزرار");

// ─── handler أمر /أنمي ───────────────────────────────────────
export async function handleAnimeCommand(interaction) {
  const panel = buildAnimePanel();
  return interaction.reply({ ...panel, ephemeral: true });
}
