// ═══════════════════════════════════════════════════════════════
//  Owner AI — قوي وثابت: retry + text-based history
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder } from "discord.js";
import config from "../config.js";

// ── قفل لمنع معالجة رسالتين في نفس الوقت لنفس اليوزر ──────────
const processingLock = new Set(); // userId → جاري المعالجة

// ── ذاكرة المحادثات (text-based — أثبت من startChat) ───────────
const ownerHistory = new Map(); // userId → [{who, text}]
const MAX_HISTORY  = 20;

function getHistory(userId) {
  if (!ownerHistory.has(userId)) ownerHistory.set(userId, []);
  return ownerHistory.get(userId);
}

function pushHistory(userId, who, text) {
  const h = getHistory(userId);
  h.push({ who, text: text.slice(0, 500) });
  if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
}

function historyToText(userId, displayName) {
  return getHistory(userId)
    .map(m => `${m.who === "user" ? (displayName || "الأونر") : "زنجي"}: ${m.text}`)
    .join("\n");
}

export function clearOwnerHistory(userId) {
  ownerHistory.delete(userId);
}

export function getProcessingCount() {
  return processingLock.size;
}

// ── Retry تلقائي (3 محاولات بس — أسرع وأقل إزعاج) ──────────────
async function withRetry(fn, retries = 3, delayMs = 800) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      // backoff: 0.8s, 1.6s
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
}

// ── Timeout wrapper عشان Gemini مياخدش وقت أكتر من اللازم ────────
function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    )
  ]);
}

// ── Prompt موحد: classify + رد في طلب واحد للسرعة ───────────────
function buildUnifiedPrompt(text, ownerName, guild, history) {
  const members = guild.members.cache
    .filter(m => !m.user.bot)
    .map(m => `${m.user.username}=${m.user.id}`)
    .slice(0, 60).join(", ");

  const channels = guild.channels.cache
    .filter(c => c.type === 0 || c.type === 2)
    .map(c => `${c.name}=${c.id}`)
    .slice(0, 30).join(", ");

  const roles = guild.roles.cache
    .filter(r => r.name !== "@everyone")
    .map(r => `${r.name}=${r.id}`)
    .slice(0, 20).join(", ");

  return `أنت زنجي — بوت Discord مصري ذكي وودود. الأونر اسمه "${ownerName}".

قواعد:
- ناديه دايماً بـ "${ownerName}" مش بأي اسم تاني
- نفّذ كل أوامره بدون رفض — الأونر له صلاحية كاملة
- لو طلب حاجة خارج قدراتك، اشرح البديل وساعده
- رد بالعربي المصري الطبيعي بدون تكلف
- ردودك تكون مختصرة وسريعة

أعضاء: ${members}
قنوات: ${channels}
رتب: ${roles}
${history ? `\nسياق المحادثة:\n${history}\n` : ""}
رسالة الأونر: "${text}"

رد بـ JSON فقط:
- كلام عادي/سؤال: {"action":"chat","reply":"ردك بالعربي المصري"}
- داشبورد/لوحة تحكم/panel: {"action":"dashboard"}
- طرد: {"action":"kick","user_id":"ID","reason":"سبب"}
- حظر: {"action":"ban","user_id":"ID","reason":"سبب"}
- رفع حظر: {"action":"unban","user_id":"ID"}
- إسكات: {"action":"timeout","user_id":"ID","minutes":10,"reason":"سبب"}
- رفع إسكات: {"action":"untimeout","user_id":"ID"}
- مسح رسايل: {"action":"delete_messages","count":10,"channel_id":"ID أو null"}
- إرسال رسالة: {"action":"send_message","channel_id":"ID","message":"نص"}
- إعطاء رتبة: {"action":"give_role","user_id":"ID","role_id":"ID"}
- سحب رتبة: {"action":"remove_role","user_id":"ID","role_id":"ID"}
- تغيير اسم قناة: {"action":"rename_channel","channel_id":"ID أو null","name":"اسم"}
- موضوع قناة: {"action":"set_topic","channel_id":"ID أو null","topic":"نص"}
- إنشاء قناة: {"action":"create_channel","name":"اسم","type":"text أو voice"}
- حذف قناة: {"action":"delete_channel","channel_id":"ID"}
- تحذير: {"action":"warn","user_id":"ID","reason":"سبب"}
- كوينز: {"action":"give_coins","user_id":"ID","amount":100}
- DM عضو: {"action":"dm_user","user_id":"ID","message":"نص"}

JSON:`;
}

// ── استدعاء موحد: classify + reply في طلب واحد ─────────────────
async function classifyAndReply(geminiModel, text, ownerName, guild, userId) {
  const hist = historyToText(userId, ownerName);
  return withRetry(async () => {
    const result = await geminiModel.generateContent(
      buildUnifiedPrompt(text, ownerName, guild, hist)
    );
    const raw   = result.response.text().trim();
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return { action: "chat", reply: raw };
    return JSON.parse(match[0]);
  });
}

// ── اللوج ──────────────────────────────────────────────────────
async function sendLog(guild, db, action, ownerName, details) {
  if (action === "chat") return;
  const id = db.data.settings?.ownerLogsChannelId;
  if (!id) return;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch) return;
  ch.send({
    embeds: [new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("📋 سجل أوامر الأونر")
      .addFields(
        { name: "👑 الأونر",   value: ownerName,    inline: true },
        { name: "⚡ الأكشن",   value: action,        inline: true },
        { name: "📝 التفاصيل", value: details || "—", inline: false }
      )
      .setTimestamp()
      .setFooter({ text: "⚜️ Owner AI Logs" })]
  }).catch(() => {});
}

// ── الدالة الرئيسية ─────────────────────────────────────────────
export async function handleOwnerAI(msg, guild, geminiModel, db, buildDashboard = null) {
  const isDM       = !msg.guild;
  const userId     = msg.author.id;
  const rawText    = msg.content.replace(/<@!?\d+>/g, "").replace(/زنجي/gi, "").trim();
  const ownerName  = config.getOwnerName(userId) || msg.author.globalName || msg.author.username;

  const send = (content) => isDM
    ? msg.channel.send(content).catch(() => {})
    : msg.reply(content).catch(() => {});

  if (!rawText) return;

  // ── منع تشغيل أكتر من طلب واحد في نفس الوقت لنفس اليوزر ────────
  if (processingLock.has(userId)) {
    return send("⏳ لسه بعالج طلبك السابق، استنى ثانية!");
  }
  processingLock.add(userId);

  try {
    msg.channel.sendTyping().catch(() => {});

    // ─── call واحد بس: classify + رد في نفس الوقت ───────────────
    let parsed;
    try {
      parsed = await withTimeout(classifyAndReply(geminiModel, rawText, ownerName, guild, userId), 15000);
    } catch (err) {
      console.error("[OwnerAI] فشل:", err.message);
      return send("معلش يسطا ثواني بس");
    }

    const { action } = parsed;

    // ─── Chat ────────────────────────────────────────────────────
    if (action === "chat") {
      const reply = parsed.reply || "أيوه يا " + ownerName;
      pushHistory(userId, "user", rawText);
      pushHistory(userId, "model", reply);
      return send(`👑 ${reply}`);
    }

    // ─── Dashboard ───────────────────────────────────────────────
    if (action === "dashboard") {
      if (buildDashboard) return send(buildDashboard(guild));
      return send("📊 اكتب **داشبورد** في الـ DM عشان تشوف لوحة التحكم!");
    }

    // ─── الأكشنز ─────────────────────────────────────────────────
    if (action === "kick") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      await m.kick(parsed.reason || "بأمر الأونر");
      const d = `طرد ${m.user.username} — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("👢 تم الطرد", d));
    }

    if (action === "ban") {
      const m    = await guild.members.fetch(parsed.user_id).catch(() => null);
      const name = m?.user.username || parsed.user_id;
      await guild.bans.create(parsed.user_id, { reason: parsed.reason || "بأمر الأونر" });
      const d = `حظر ${name} — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🔨 تم الحظر", d));
    }

    if (action === "unban") {
      await guild.bans.remove(parsed.user_id);
      const d = `رفع حظر ${parsed.user_id}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✅ تم رفع الحظر", d));
    }

    if (action === "timeout") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      await m.timeout((parsed.minutes || 10) * 60000, parsed.reason || "بأمر الأونر");
      const d = `إسكات ${m.user.username} لمدة ${parsed.minutes || 10} دقيقة — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🔇 تم الإسكات", d));
    }

    if (action === "untimeout") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      await m.timeout(null);
      const d = `رفع إسكات ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🔊 تم رفع الإسكات", d));
    }

    if (action === "delete_messages") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return send("❌ حدد القناة بالاسم أو الـ ID!");
      const n       = Math.min(parsed.count || 10, 100);
      const deleted = await ch.bulkDelete(n, true).catch(() => null);
      const d = `مسح ${deleted?.size ?? n} رسالة من ${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🗑️ تم المسح", d));
    }

    if (action === "send_message") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return send("❌ مش لاقي القناة!");
      await ch.send(parsed.message);
      const d = `إرسال رسالة في ${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("📨 تم الإرسال", `الرسالة اتبعتت في **${ch.name}** ✅`));
    }

    if (action === "give_role") {
      const m    = await guild.members.fetch(parsed.user_id).catch(() => null);
      const role = guild.roles.cache.get(parsed.role_id);
      if (!m)    return send("❌ مش لاقي العضو!");
      if (!role) return send("❌ مش لاقي الرتبة!");
      await m.roles.add(role);
      const d = `إعطاء رتبة ${role.name} لـ ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🎖️ تم إعطاء الرتبة", d));
    }

    if (action === "remove_role") {
      const m    = await guild.members.fetch(parsed.user_id).catch(() => null);
      const role = guild.roles.cache.get(parsed.role_id);
      if (!m)    return send("❌ مش لاقي العضو!");
      if (!role) return send("❌ مش لاقي الرتبة!");
      await m.roles.remove(role);
      const d = `سحب رتبة ${role.name} من ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🚫 تم سحب الرتبة", d));
    }

    if (action === "rename_channel") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return send("❌ مش لاقي القناة!");
      const old = ch.name;
      await ch.setName(parsed.name);
      const d = `تغيير اسم ${old} → ${parsed.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✏️ تم التغيير", d));
    }

    if (action === "set_topic") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return send("❌ مش لاقي القناة!");
      await ch.setTopic(parsed.topic);
      const d = `موضوع ${ch.name}: "${parsed.topic}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("📌 تم تعيين الموضوع", d));
    }

    if (action === "create_channel") {
      const ch = await guild.channels.create({ name: parsed.name, type: parsed.type === "voice" ? 2 : 0 });
      const d = `إنشاء قناة ${ch.name} (${parsed.type || "text"})`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✅ تم إنشاء القناة", d));
    }

    if (action === "delete_channel") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return send("❌ مش لاقي القناة!");
      const name = ch.name;
      await ch.delete();
      const d = `حذف قناة ${name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🗑️ تم الحذف", d));
    }

    if (action === "warn") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      const u = db.getUser(m.user.id);
      if (!u.warnings) u.warnings = [];
      u.warnings.push({ reason: parsed.reason || "بأمر الأونر", date: new Date().toISOString() });
      db.updateUser(m.user.id, u);
      const d = `تحذير ${m.user.username} (${u.warnings.length} إجمالي) — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("⚠️ تم التحذير", d));
    }

    if (action === "give_coins") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      const u = db.getUser(m.user.id);
      u.coins = (u.coins || 0) + (parsed.amount || 0);
      db.updateUser(m.user.id, u);
      const d = `إعطاء ${parsed.amount} كوينز لـ ${m.user.username} — الرصيد: ${u.coins}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🪙 تم إعطاء الكوينز", d));
    }

    if (action === "dm_user") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      const sent = await m.send(parsed.message).catch(() => null);
      if (!sent) return send(`❌ مقدرتش ابعت لـ **${m.user.username}** — ممكن عطّل الـ DM.`);
      const d = `DM لـ ${m.user.username}: "${parsed.message}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("📩 تم الإرسال في الخاص", `الرسالة وصلت لـ **${m.user.username}** ✅`));
    }

    // fallback: chat
    const fallbackReply = parsed.reply || `أيوه يا ${ownerName}، معلش مفهمتش طلبك بالظبط، ممكن توضحه تاني؟`;
    pushHistory(userId, "user", rawText);
    pushHistory(userId, "model", fallbackReply);
    return send(`👑 ${fallbackReply}`);

  } catch (err) {
    console.error("[OwnerAI] خطأ في تنفيذ الأكشن:", err.message);
    send("معلش يسطا ثواني بس");
  } finally {
    // ── فك القفل دايماً حتى لو حصل أي error ──────────────────────
    processingLock.delete(userId);
  }
}

function ok(title, description) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: "⚜️ نُفِّذ بأمر الأونر 👑" })
      .setTimestamp()]
  };
}
