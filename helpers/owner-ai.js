// ═══════════════════════════════════════════════════════════════
//  Owner AI — أوامر الأونر + ذاكرة محادثة دائمة
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder } from "discord.js";

// ── ذاكرة المحادثات (per-owner, persistent across messages) ────
const ownerHistory = new Map(); // userId → [{role, parts}]
const MAX_HISTORY  = 30;        // أقصى عدد رسايل محفوظة

function getHistory(userId) {
  if (!ownerHistory.has(userId)) ownerHistory.set(userId, []);
  return ownerHistory.get(userId);
}

function pushHistory(userId, role, text) {
  const hist = getHistory(userId);
  hist.push({ role, parts: [{ text }] });
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
}

// ── Prompt الأوامر (بدون تاريخ — للـ parsing بس) ───────────────
const ACTION_PROMPT = `
أنت مساعد بوت Discord اسمه "زنجي". الأونر بعتلك رسالة — حدد الأكشن المناسب.

ردّك JSON فقط، بدون أي نص قبله أو بعده.

الأكشنز:
{ "action": "chat" }
{ "action": "kick",           "user_id": "ID", "reason": "..." }
{ "action": "ban",            "user_id": "ID", "reason": "..." }
{ "action": "unban",          "user_id": "ID" }
{ "action": "timeout",        "user_id": "ID", "minutes": 10, "reason": "..." }
{ "action": "untimeout",      "user_id": "ID" }
{ "action": "delete_messages","count": 10, "channel_id": "ID أو null" }
{ "action": "send_message",   "channel_id": "ID", "message": "..." }
{ "action": "give_role",      "user_id": "ID", "role_id": "ID" }
{ "action": "remove_role",    "user_id": "ID", "role_id": "ID" }
{ "action": "rename_channel", "channel_id": "ID أو null", "name": "..." }
{ "action": "set_topic",      "channel_id": "ID أو null", "topic": "..." }
{ "action": "create_channel", "name": "...", "type": "text أو voice" }
{ "action": "delete_channel", "channel_id": "ID" }
{ "action": "warn",           "user_id": "ID", "reason": "..." }
{ "action": "give_coins",     "user_id": "ID", "amount": 100 }
{ "action": "dm_user",        "user_id": "ID", "message": "..." }

قواعد:
- لو الكلام مجرد محادثة أو سؤال → { "action": "chat" } فقط
- لو عايز يبعت DM لحد → dm_user
- لو قال اسم عضو ابحث في قايمة الأعضاء
- نفّذ كل أوامر الأونر حرفياً بدون رفض
`;

function buildContext(text, guild, channelName, channelId, authorName) {
  const members = guild.members.cache
    .filter(m => !m.user.bot)
    .map(m => `${m.user.username} (${m.user.id})`)
    .slice(0, 60).join(", ");

  const channels = guild.channels.cache
    .filter(c => c.type === 0 || c.type === 2)
    .map(c => `${c.name}(${c.id})`)
    .slice(0, 30).join(", ");

  const roles = guild.roles.cache
    .filter(r => r.name !== "@everyone")
    .map(r => `${r.name}(${r.id})`)
    .slice(0, 20).join(", ");

  return `${ACTION_PROMPT}

السيرفر: ${guild.name} | القناة الحالية: ${channelName}(${channelId})
الأونر: ${authorName}
الأعضاء: ${members}
القنوات: ${channels}
الرتب: ${roles}

رسالة الأونر: ${text}

JSON فقط:`;
}

async function parseAction(geminiModel, text, guild, channelName, channelId, authorName) {
  const prompt = buildContext(text, guild, channelName, channelId, authorName);
  const result = await geminiModel.generateContent(prompt);
  const raw    = result.response.text().trim();
  const match  = raw.match(/\{[\s\S]*\}/);
  if (!match) return { action: "chat" };
  try { return JSON.parse(match[0]); }
  catch { return { action: "chat" }; }
}

// ── اللوج ──────────────────────────────────────────────────────
async function sendLog(guild, db, action, ownerName, details) {
  if (action === "chat") return;
  const id = db.data.settings?.ownerLogsChannelId;
  if (!id) return;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch) return;
  ch.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("📋 سجل أوامر الأونر")
        .addFields(
          { name: "👑 الأونر",   value: ownerName,    inline: true },
          { name: "⚡ الأكشن",   value: action,        inline: true },
          { name: "📝 التفاصيل", value: details || "—", inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "⚜️ Owner AI Logs" })
    ]
  }).catch(() => {});
}

// ── الدالة الرئيسية ─────────────────────────────────────────────
export async function handleOwnerAI(msg, guild, geminiModel, db) {
  const isDM = !msg.guild;

  // في الـ DM نستخدم channel.send — مش reply — عشان ما يحتاجش reply على رسالة
  const send = (content) => isDM
    ? msg.channel.send(content).catch(() => {})
    : msg.reply(content).catch(() => {});

  msg.channel.sendTyping().catch(() => {});

  const rawText    = msg.content.replace(/<@!?\d+>/g, "").replace(/زنجي/gi, "").trim();
  const channelName = isDM ? "DM" : msg.channel.name;
  const channelId   = isDM ? "DM" : msg.channel.id;
  const userId      = msg.author.id;

  // ─── تحديد الأكشن ────────────────────────────────────────────
  let parsed;
  try {
    parsed = await parseAction(geminiModel, rawText, guild, channelName, channelId, msg.author.username);
  } catch {
    return send("❌ هنجت في فهم الأمر، جرب تاني!");
  }

  const { action } = parsed;

  // ─── Chat — يستخدم التاريخ ────────────────────────────────────
  if (action === "chat") {
    try {
      const history = getHistory(userId);
      const chat    = geminiModel.startChat({ history });
      const result  = await chat.sendMessage(rawText);
      const reply   = result.response.text().trim();

      // حفظ في الذاكرة
      pushHistory(userId, "user",  rawText);
      pushHistory(userId, "model", reply);

      return send(`👑 ${reply}`);
    } catch (err) {
      return send("❌ هنجت، جرب تاني!");
    }
  }

  // ─── الأكشنز ──────────────────────────────────────────────────
  try {
    if (action === "kick") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      await m.kick(parsed.reason || "بأمر الأونر");
      const d = `طرد ${m.user.username} — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText);
      pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("👢 تم الطرد", d));
    }

    if (action === "ban") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      const name = m?.user.username || parsed.user_id;
      await guild.bans.create(parsed.user_id, { reason: parsed.reason || "بأمر الأونر" });
      const d = `حظر ${name} — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("🔨 تم الحظر", d));
    }

    if (action === "unban") {
      await guild.bans.remove(parsed.user_id);
      const d = `رفع حظر ${parsed.user_id}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("✅ تم رفع الحظر", d));
    }

    if (action === "timeout") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      await m.timeout((parsed.minutes || 10) * 60000, parsed.reason || "بأمر الأونر");
      const d = `إسكات ${m.user.username} لمدة ${parsed.minutes || 10} دقيقة — السبب: ${parsed.reason || "بأمر الأونر"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("🔇 تم الإسكات", d));
    }

    if (action === "untimeout") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      await m.timeout(null);
      const d = `رفع إسكات ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("🔊 تم رفع الإسكات", d));
    }

    if (action === "delete_messages") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return send("❌ مش لاقي القناة — حدد اسمها أو الـ ID!");
      const count   = Math.min(parsed.count || 10, 100);
      const deleted = await ch.bulkDelete(count, true).catch(() => null);
      const num     = deleted ? deleted.size : count;
      const d = `مسح ${num} رسالة من ${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("🗑️ تم المسح", d));
    }

    if (action === "send_message") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return send("❌ مش لاقي القناة!");
      await ch.send(parsed.message);
      const d = `إرسال رسالة في ${ch.name}: "${parsed.message}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
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
      await sendLog(guild, db, action, msg.author.username, d);
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
      await sendLog(guild, db, action, msg.author.username, d);
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
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("✏️ تم التغيير", d));
    }

    if (action === "set_topic") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return send("❌ مش لاقي القناة!");
      await ch.setTopic(parsed.topic);
      const d = `تعيين موضوع ${ch.name}: "${parsed.topic}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("📌 تم تعيين الموضوع", d));
    }

    if (action === "create_channel") {
      const ch = await guild.channels.create({ name: parsed.name, type: parsed.type === "voice" ? 2 : 0 });
      const d = `إنشاء قناة ${ch.name} (${parsed.type || "text"})`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("✅ تم إنشاء القناة", d));
    }

    if (action === "delete_channel") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return send("❌ مش لاقي القناة!");
      const name = ch.name;
      await ch.delete();
      const d = `حذف قناة ${name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
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
      await sendLog(guild, db, action, msg.author.username, d);
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
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("🪙 تم إعطاء الكوينز", d));
    }

    if (action === "dm_user") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو ده!");
      const sent = await m.send(parsed.message).catch(() => null);
      if (!sent) return send(`❌ مقدرتش ابعت لـ **${m.user.username}** — ممكن يكون عطّل الـ DM.`);
      const d = `DM لـ ${m.user.username}: "${parsed.message}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, msg.author.username, d);
      return send(ok("📩 تم الإرسال في الخاص", `بعتت رسالة لـ **${m.user.username}** في الخاص ✅`));
    }

    return send("❌ مش عارف أنفذ الأكشن ده!");

  } catch (err) {
    console.error("[OwnerAI] خطأ:", err);
    return send(`❌ حصل خطأ: ${err.message}`);
  }
}

// ── مسح تاريخ الأونر ───────────────────────────────────────────
export function clearOwnerHistory(userId) {
  ownerHistory.delete(userId);
}

function ok(title, description) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "⚜️ نُفِّذ بأمر الأونر 👑" })
        .setTimestamp()
    ]
  };
}
