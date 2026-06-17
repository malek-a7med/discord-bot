// ═══════════════════════════════════════════════════════════════
//  Owner AI — نظام تنفيذ أوامر الأونر بالكلام الطبيعي + لوجز
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder } from "discord.js";

const ACTION_PROMPT = `
أنت مساعد بوت Discord اسمه "زنجي". الأونر بعتلك رسالة وأنت محتاج تفهم هو عايز إيه وتنفذه.

ردّك لازم يكون JSON فقط — بدون أي نص قبله أو بعده.

الأكشنز المتاحة:
{ "action": "chat", "reply": "ردك هنا" }
{ "action": "kick", "user_id": "ID", "reason": "السبب" }
{ "action": "ban", "user_id": "ID", "reason": "السبب" }
{ "action": "unban", "user_id": "ID" }
{ "action": "timeout", "user_id": "ID", "minutes": 10, "reason": "السبب" }
{ "action": "untimeout", "user_id": "ID" }
{ "action": "delete_messages", "count": 10, "channel_id": "ID أو null للقناة الحالية" }
{ "action": "send_message", "channel_id": "ID", "message": "النص" }
{ "action": "give_role", "user_id": "ID", "role_id": "ID" }
{ "action": "remove_role", "user_id": "ID", "role_id": "ID" }
{ "action": "rename_channel", "channel_id": "ID أو null للحالية", "name": "الاسم" }
{ "action": "set_topic", "channel_id": "ID أو null للحالية", "topic": "النص" }
{ "action": "create_channel", "name": "الاسم", "type": "text أو voice" }
{ "action": "delete_channel", "channel_id": "ID" }
{ "action": "warn", "user_id": "ID", "reason": "السبب" }
{ "action": "give_coins", "user_id": "ID", "amount": 100 }

قواعد:
- لو قال اسم عضو ابحث عنه في قايمة الأعضاء
- لو مش متأكد من الـ ID ردّ بـ chat واسأله
- لو طلب حاجة مش في القايمة ردّ بـ chat واعتذر
- ردودك في chat بالعربي المصري دايماً
`;

function buildContextPrompt(text, guild, currentChannelName, currentChannelId, authorName) {
  const members = guild.members.cache
    .filter(m => !m.user.bot)
    .map(m => `${m.user.username} (${m.user.id}) — رتبة: ${m.roles.highest.name}`)
    .slice(0, 50).join("\n");

  const channels = guild.channels.cache
    .filter(c => c.type === 0 || c.type === 2)
    .map(c => `${c.name} (${c.id}) — نوع: ${c.type === 0 ? "text" : "voice"}`)
    .slice(0, 30).join("\n");

  const roles = guild.roles.cache
    .filter(r => r.name !== "@everyone")
    .map(r => `${r.name} (${r.id})`)
    .slice(0, 20).join("\n");

  return `
معلومات السيرفر: ${guild.name}
القناة الحالية: ${currentChannelName} (${currentChannelId})
اللي بيكلمك: ${authorName}

قايمة الأعضاء (أول 50):
${members}

القنوات:
${channels}

الرتب:
${roles}

رسالة الأونر: ${text}

ردّ بـ JSON فقط.
`;
}

async function parseOwnerCommand(geminiModel, text, guild, channelName, channelId, authorName) {
  const prompt = ACTION_PROMPT + "\n\n" + buildContextPrompt(text, guild, channelName, channelId, authorName);
  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text().trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { action: "chat", reply: "معلش مفهمتش قصدك، ممكن تكون أوضح؟ 😅" };
  try { return JSON.parse(jsonMatch[0]); }
  catch { return { action: "chat", reply: "معلش مفهمتش قصدك، ممكن تكون أوضح؟ 😅" }; }
}

// ── إرسال اللوج لقناة اللوجز ──────────────────────────────────
async function sendLog(guild, db, action, ownerName, details) {
  if (action === "chat") return;
  const logChannelId = db.data.settings?.ownerLogsChannelId;
  if (!logChannelId) return;
  const ch = await guild.channels.fetch(logChannelId).catch(() => null);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("📋 سجل أوامر الأونر")
    .addFields(
      { name: "👑 الأونر", value: ownerName, inline: true },
      { name: "⚡ الأكشن", value: action, inline: true },
      { name: "📝 التفاصيل", value: details || "—", inline: false }
    )
    .setTimestamp()
    .setFooter({ text: "⚜️ Owner AI Logs" });
  ch.send({ embeds: [embed] }).catch(() => {});
}

// ── الدالة الرئيسية — تشتغل من داخل السيرفر أو من الـ DM ──────
export async function handleOwnerAI(msg, guild, geminiModel, db) {
  const isDM = !msg.guild;
  const replyFn = (content) => msg.reply(content).catch(() => {});

  if (isDM) msg.channel.sendTyping().catch(() => {});
  else msg.channel.sendTyping().catch(() => {});

  const rawText = msg.content.replace(/<@!?\d+>/g, "").trim();
  const channelName = isDM ? "DM" : msg.channel.name;
  const channelId   = isDM ? "DM" : msg.channel.id;

  let parsed;
  try {
    parsed = await parseOwnerCommand(geminiModel, rawText, guild, channelName, channelId, msg.author.username);
  } catch {
    return replyFn("❌ هنجت في فهم الأمر، جرب تاني!");
  }

  const { action } = parsed;

  try {
    if (action === "chat" || action === "server_info") {
      return replyFn(`👑 ${parsed.reply}`);
    }

    if (action === "kick") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو ده!");
      await member.kick(parsed.reason || "بأمر الأونر");
      const detail = `طرد ${member.user.username} — السبب: ${parsed.reason || "بأمر الأونر"}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("👢 تم الطرد", detail));
    }

    if (action === "ban") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      const name = member?.user.username || parsed.user_id;
      await guild.bans.create(parsed.user_id, { reason: parsed.reason || "بأمر الأونر" });
      const detail = `حظر ${name} — السبب: ${parsed.reason || "بأمر الأونر"}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🔨 تم الحظر", detail));
    }

    if (action === "unban") {
      await guild.bans.remove(parsed.user_id);
      const detail = `رفع حظر ${parsed.user_id}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("✅ تم رفع الحظر", detail));
    }

    if (action === "timeout") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو ده!");
      await member.timeout((parsed.minutes || 10) * 60000, parsed.reason || "بأمر الأونر");
      const detail = `إسكات ${member.user.username} لمدة ${parsed.minutes || 10} دقيقة — السبب: ${parsed.reason || "بأمر الأونر"}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🔇 تم الإسكات", detail));
    }

    if (action === "untimeout") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو ده!");
      await member.timeout(null);
      const detail = `رفع إسكات ${member.user.username}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🔊 تم رفع الإسكات", detail));
    }

    if (action === "delete_messages") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return replyFn("❌ مش لاقي القناة — حدد اسمها أو الـ ID!");
      const count = Math.min(parsed.count || 10, 100);
      const deleted = await ch.bulkDelete(count, true).catch(() => null);
      const num = deleted ? deleted.size : count;
      const detail = `مسح ${num} رسالة من ${ch.name}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🗑️ تم المسح", detail));
    }

    if (action === "send_message") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return replyFn("❌ مش لاقي القناة!");
      await ch.send(parsed.message);
      const detail = `إرسال رسالة في ${ch.name}: "${parsed.message}"`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("📨 تم الإرسال", `الرسالة اتبعتت في **${ch.name}** ✅`));
    }

    if (action === "give_role") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو!");
      const role = guild.roles.cache.get(parsed.role_id);
      if (!role) return replyFn("❌ مش لاقي الرتبة!");
      await member.roles.add(role);
      const detail = `إعطاء رتبة ${role.name} لـ ${member.user.username}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🎖️ تم إعطاء الرتبة", detail));
    }

    if (action === "remove_role") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو!");
      const role = guild.roles.cache.get(parsed.role_id);
      if (!role) return replyFn("❌ مش لاقي الرتبة!");
      await member.roles.remove(role);
      const detail = `سحب رتبة ${role.name} من ${member.user.username}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🚫 تم سحب الرتبة", detail));
    }

    if (action === "rename_channel") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return replyFn("❌ مش لاقي القناة!");
      const oldName = ch.name;
      await ch.setName(parsed.name);
      const detail = `تغيير اسم ${oldName} → ${parsed.name}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("✏️ تم التغيير", detail));
    }

    if (action === "set_topic") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : (isDM ? null : msg.channel);
      if (!ch) return replyFn("❌ مش لاقي القناة!");
      await ch.setTopic(parsed.topic);
      const detail = `تعيين موضوع ${ch.name}: "${parsed.topic}"`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("📌 تم تعيين الموضوع", detail));
    }

    if (action === "create_channel") {
      const ch = await guild.channels.create({ name: parsed.name, type: parsed.type === "voice" ? 2 : 0 });
      const detail = `إنشاء قناة ${ch.name} (${parsed.type || "text"})`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("✅ تم إنشاء القناة", detail));
    }

    if (action === "delete_channel") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return replyFn("❌ مش لاقي القناة!");
      const name = ch.name;
      await ch.delete();
      const detail = `حذف قناة ${name}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🗑️ تم الحذف", detail));
    }

    if (action === "warn") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو!");
      const userData = db.getUser(member.user.id);
      if (!userData.warnings) userData.warnings = [];
      userData.warnings.push({ reason: parsed.reason || "بأمر الأونر", date: new Date().toISOString() });
      db.updateUser(member.user.id, userData);
      const detail = `تحذير ${member.user.username} (${userData.warnings.length} إجمالي) — السبب: ${parsed.reason || "بأمر الأونر"}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("⚠️ تم التحذير", detail));
    }

    if (action === "give_coins") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return replyFn("❌ مش لاقي العضو!");
      const userData = db.getUser(member.user.id);
      userData.coins = (userData.coins || 0) + (parsed.amount || 0);
      db.updateUser(member.user.id, userData);
      const detail = `إعطاء ${parsed.amount} كوينز لـ ${member.user.username} — الرصيد: ${userData.coins}`;
      await sendLog(guild, db, action, msg.author.username, detail);
      return replyFn(ok("🪙 تم إعطاء الكوينز", detail));
    }

    return replyFn("❌ مش عارف أنفذ الأكشن ده!");

  } catch (err) {
    console.error("[OwnerAI] خطأ:", err);
    return replyFn(`❌ حصل خطأ: ${err.message}`);
  }
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
