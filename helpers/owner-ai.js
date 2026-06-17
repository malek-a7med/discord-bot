// ═══════════════════════════════════════════════════════════════
//  Owner AI — نظام تنفيذ أوامر الأونر بالكلام الطبيعي
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";

const ACTION_PROMPT = `
أنت مساعد بوت Discord اسمه "زنجي". الأونر بعتلك رسالة وأنت محتاج تفهم هو عايز إيه وتنفذه.

ردّك لازم يكون JSON فقط — بدون أي نص قبله أو بعده.

الأكشنز المتاحة:
{
  "action": "chat",
  "reply": "ردك هنا"
}
{
  "action": "kick",
  "user_id": "ID العضو",
  "reason": "السبب"
}
{
  "action": "ban",
  "user_id": "ID العضو",
  "reason": "السبب"
}
{
  "action": "unban",
  "user_id": "ID العضو"
}
{
  "action": "timeout",
  "user_id": "ID العضو",
  "minutes": 10,
  "reason": "السبب"
}
{
  "action": "untimeout",
  "user_id": "ID العضو"
}
{
  "action": "delete_messages",
  "count": 10,
  "channel_id": "ID القناة أو null للقناة الحالية"
}
{
  "action": "send_message",
  "channel_id": "ID القناة",
  "message": "نص الرسالة"
}
{
  "action": "give_role",
  "user_id": "ID العضو",
  "role_id": "ID الرتبة"
}
{
  "action": "remove_role",
  "user_id": "ID العضو",
  "role_id": "ID الرتبة"
}
{
  "action": "rename_channel",
  "channel_id": "ID القناة أو null للقناة الحالية",
  "name": "الاسم الجديد"
}
{
  "action": "set_topic",
  "channel_id": "ID القناة أو null للقناة الحالية",
  "topic": "الموضوع الجديد"
}
{
  "action": "create_channel",
  "name": "اسم القناة",
  "type": "text أو voice"
}
{
  "action": "delete_channel",
  "channel_id": "ID القناة"
}
{
  "action": "warn",
  "user_id": "ID العضو",
  "reason": "السبب"
}
{
  "action": "give_coins",
  "user_id": "ID العضو",
  "amount": 100
}
{
  "action": "server_info",
  "reply": "معلومات عن السيرفر"
}

قواعد مهمة:
- لو الأونر قال "امسح" أو "احذف رسايل" استخدم delete_messages
- لو قال اسم عضو ابحث عنه في قايمة الأعضاء اللي هتاخدها
- لو مش متأكد من الـ ID قول له إيه اللي محتاج منه بـ action: chat
- لو طلب حاجة مش في القايمة دي ردّ بـ chat واعتذر بشكل ودي
- ردودك في chat بالعربي المصري دايماً
`;

function buildContextPrompt(msg, guild) {
  const members = guild.members.cache
    .filter(m => !m.user.bot)
    .map(m => `${m.user.username} (${m.user.id}) — رتبة: ${m.roles.highest.name}`)
    .slice(0, 50)
    .join("\n");

  const channels = guild.channels.cache
    .filter(c => c.type === 0 || c.type === 2)
    .map(c => `${c.name} (${c.id}) — نوع: ${c.type === 0 ? "text" : "voice"}`)
    .slice(0, 30)
    .join("\n");

  const roles = guild.roles.cache
    .filter(r => r.name !== "@everyone")
    .map(r => `${r.name} (${r.id})`)
    .slice(0, 20)
    .join("\n");

  return `
معلومات السيرفر:
- الاسم: ${guild.name}
- القناة الحالية: ${msg.channel.name} (${msg.channel.id})
- اللي بيكلمك: ${msg.author.username} (${msg.author.id})

قايمة الأعضاء (أول 50):
${members}

قايمة القنوات:
${channels}

قايمة الرتب:
${roles}

رسالة الأونر:
${msg.content.replace(/<@!?\d+>/g, "").trim()}

ردّ بـ JSON فقط.
`;
}

async function parseOwnerCommand(geminiModel, msg, guild) {
  const prompt = ACTION_PROMPT + "\n\n" + buildContextPrompt(msg, guild);
  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text().trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { action: "chat", reply: "معلش مفهمتش قصدك، ممكن تكون أوضح؟ 😅" };

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { action: "chat", reply: "معلش مفهمتش قصدك، ممكن تكون أوضح؟ 😅" };
  }
}

export async function handleOwnerAI(msg, guild, geminiModel, db) {
  msg.channel.sendTyping().catch(() => {});

  let parsed;
  try {
    parsed = await parseOwnerCommand(geminiModel, msg, guild);
  } catch (err) {
    return msg.reply("❌ هنجت في فهم الأمر ده، جرب تاني!").catch(() => {});
  }

  const { action } = parsed;

  try {
    // ─── Chat ───────────────────────────────────────────────
    if (action === "chat" || action === "server_info") {
      return msg.reply(`👑 ${parsed.reply}`).catch(() => {});
    }

    // ─── Kick ───────────────────────────────────────────────
    if (action === "kick") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      await member.kick(parsed.reason || "بأمر الأونر");
      return msg.reply(buildSuccessEmbed("👢 تم الطرد", `**${member.user.username}** اتطرد.\nالسبب: ${parsed.reason || "بأمر الأونر"}`)).catch(() => {});
    }

    // ─── Ban ────────────────────────────────────────────────
    if (action === "ban") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      const name = member ? member.user.username : parsed.user_id;
      await guild.bans.create(parsed.user_id, { reason: parsed.reason || "بأمر الأونر" });
      return msg.reply(buildSuccessEmbed("🔨 تم الحظر", `**${name}** اتحظر نهائياً.\nالسبب: ${parsed.reason || "بأمر الأونر"}`)).catch(() => {});
    }

    // ─── Unban ──────────────────────────────────────────────
    if (action === "unban") {
      await guild.bans.remove(parsed.user_id);
      return msg.reply(buildSuccessEmbed("✅ تم رفع الحظر", `العضو \`${parsed.user_id}\` اترفع عنه الحظر.`)).catch(() => {});
    }

    // ─── Timeout ────────────────────────────────────────────
    if (action === "timeout") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      const ms = (parsed.minutes || 10) * 60 * 1000;
      await member.timeout(ms, parsed.reason || "بأمر الأونر");
      return msg.reply(buildSuccessEmbed("🔇 تم الإسكات", `**${member.user.username}** اتسكت لمدة **${parsed.minutes || 10} دقيقة**.\nالسبب: ${parsed.reason || "بأمر الأونر"}`)).catch(() => {});
    }

    // ─── Untimeout ──────────────────────────────────────────
    if (action === "untimeout") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      await member.timeout(null);
      return msg.reply(buildSuccessEmbed("🔊 تم رفع الإسكات", `**${member.user.username}** رجع يتكلم تاني.`)).catch(() => {});
    }

    // ─── Delete Messages ────────────────────────────────────
    if (action === "delete_messages") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : msg.channel;
      if (!ch) return msg.reply("❌ مش لاقي القناة دي!").catch(() => {});
      const count = Math.min(parsed.count || 10, 100);
      const deleted = await ch.bulkDelete(count, true).catch(() => null);
      const num = deleted ? deleted.size : count;
      return msg.reply(buildSuccessEmbed("🗑️ تم المسح", `تم مسح **${num} رسالة** من ${ch}.`)).catch(() => {});
    }

    // ─── Send Message ───────────────────────────────────────
    if (action === "send_message") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return msg.reply("❌ مش لاقي القناة دي!").catch(() => {});
      await ch.send(parsed.message);
      return msg.reply(buildSuccessEmbed("📨 تم الإرسال", `الرسالة اتبعتت في ${ch} ✅`)).catch(() => {});
    }

    // ─── Give Role ──────────────────────────────────────────
    if (action === "give_role") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      const role = guild.roles.cache.get(parsed.role_id);
      if (!role) return msg.reply("❌ مش لاقي الرتبة دي!").catch(() => {});
      await member.roles.add(role);
      return msg.reply(buildSuccessEmbed("🎖️ تم إعطاء الرتبة", `**${member.user.username}** اخد رتبة **${role.name}** ✅`)).catch(() => {});
    }

    // ─── Remove Role ────────────────────────────────────────
    if (action === "remove_role") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      const role = guild.roles.cache.get(parsed.role_id);
      if (!role) return msg.reply("❌ مش لاقي الرتبة دي!").catch(() => {});
      await member.roles.remove(role);
      return msg.reply(buildSuccessEmbed("🚫 تم سحب الرتبة", `اتسحبت رتبة **${role.name}** من **${member.user.username}** ✅`)).catch(() => {});
    }

    // ─── Rename Channel ─────────────────────────────────────
    if (action === "rename_channel") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : msg.channel;
      if (!ch) return msg.reply("❌ مش لاقي القناة دي!").catch(() => {});
      const oldName = ch.name;
      await ch.setName(parsed.name);
      return msg.reply(buildSuccessEmbed("✏️ تم التغيير", `القناة **${oldName}** اتسميت **${parsed.name}** ✅`)).catch(() => {});
    }

    // ─── Set Topic ──────────────────────────────────────────
    if (action === "set_topic") {
      const ch = parsed.channel_id
        ? await guild.channels.fetch(parsed.channel_id).catch(() => null)
        : msg.channel;
      if (!ch) return msg.reply("❌ مش لاقي القناة دي!").catch(() => {});
      await ch.setTopic(parsed.topic);
      return msg.reply(buildSuccessEmbed("📌 تم تعيين الموضوع", `موضوع ${ch} اتغير لـ: **${parsed.topic}** ✅`)).catch(() => {});
    }

    // ─── Create Channel ─────────────────────────────────────
    if (action === "create_channel") {
      const isVoice = parsed.type === "voice";
      const ch = await guild.channels.create({
        name: parsed.name,
        type: isVoice ? 2 : 0,
      });
      return msg.reply(buildSuccessEmbed("✅ تم إنشاء القناة", `القناة ${ch} اتعملت بنجاح!`)).catch(() => {});
    }

    // ─── Delete Channel ─────────────────────────────────────
    if (action === "delete_channel") {
      const ch = await guild.channels.fetch(parsed.channel_id).catch(() => null);
      if (!ch) return msg.reply("❌ مش لاقي القناة دي!").catch(() => {});
      const name = ch.name;
      await ch.delete();
      return msg.reply(buildSuccessEmbed("🗑️ تم الحذف", `القناة **${name}** اتحذفت ✅`)).catch(() => {});
    }

    // ─── Warn ───────────────────────────────────────────────
    if (action === "warn") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      const userData = db.getUser(member.user.id);
      if (!userData.warnings) userData.warnings = [];
      userData.warnings.push({ reason: parsed.reason || "بأمر الأونر", date: new Date().toISOString() });
      db.updateUser(member.user.id, userData);
      return msg.reply(buildSuccessEmbed("⚠️ تم التحذير", `**${member.user.username}** اتحذّر.\nعدد تحذيراته: **${userData.warnings.length}**\nالسبب: ${parsed.reason || "بأمر الأونر"}`)).catch(() => {});
    }

    // ─── Give Coins ─────────────────────────────────────────
    if (action === "give_coins") {
      const member = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!member) return msg.reply("❌ مش لاقي العضو ده!").catch(() => {});
      const userData = db.getUser(member.user.id);
      userData.coins = (userData.coins || 0) + (parsed.amount || 0);
      db.updateUser(member.user.id, userData);
      return msg.reply(buildSuccessEmbed("🪙 تم إعطاء الكوينز", `**${member.user.username}** اخد **${parsed.amount} كوينز** ✅\nرصيده الحالي: **${userData.coins} كوينز**`)).catch(() => {});
    }

    return msg.reply("❌ مش عارف أنفذ الأكشن ده!").catch(() => {});

  } catch (err) {
    console.error("[OwnerAI] خطأ:", err);
    return msg.reply(`❌ حصل خطأ أثناء التنفيذ: ${err.message}`).catch(() => {});
  }
}

function buildSuccessEmbed(title, description) {
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
