// ═══════════════════════════════════════════════════════════════
//  Owner AI — قوي وثابت: retry + text-based history
// ═══════════════════════════════════════════════════════════════
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import config from "../config.js";
import {
  memoryRemember, memoryForget, memoryClear,
  memoryGetAll, memoryToPromptText, memorySearch
} from "./bot-memory.js";

// ─── Presets الرتب الذكية ────────────────────────────────────────
export const ROLE_PRESETS = {
  admin:      { label: "إدارة",             permissions: ["Administrator"],                                                                                                                               color: 0xe74c3c, hoist: true  },
  mod:        { label: "مشرف",              permissions: ["ManageMessages","KickMembers","ModerateMembers","ManageNicknames","ViewAuditLog","BanMembers"],                                                  color: 0xe67e22, hoist: true  },
  helper:     { label: "مساعد مشرف",        permissions: ["ManageMessages","ModerateMembers","ViewAuditLog"],                                                                                             color: 0xF0A500, hoist: true  },
  vip:        { label: "VIP",               permissions: ["AddReactions","UseExternalEmojis","AttachFiles","EmbedLinks","SendMessages","UseExternalStickers"],                                             color: 0xFFD700, hoist: true  },
  booster:    { label: "بوستر",             permissions: ["AddReactions","UseExternalEmojis","AttachFiles","EmbedLinks","SendMessages","UseExternalStickers","CreatePublicThreads"],                       color: 0xF47FFF, hoist: true  },
  verified:   { label: "موثّق",             permissions: ["SendMessages","ReadMessageHistory","AddReactions","AttachFiles","EmbedLinks"],                                                                  color: 0x5865F2, hoist: false },
  music:      { label: "موسيقى",            permissions: ["Connect","Speak","UseVAD","SendMessages","AddReactions"],                                                                                      color: 0x1DB954, hoist: false },
  gaming:     { label: "جيمنج",             permissions: ["SendMessages","Connect","Speak","AddReactions"],                                                                                               color: 0x9B59B6, hoist: false },
  art:        { label: "فن وتصميم",         permissions: ["SendMessages","AttachFiles","EmbedLinks","AddReactions"],                                                                                      color: 0xE91E8C, hoist: false },
  event:      { label: "منظّم فعاليات",     permissions: ["ManageEvents","SendMessages","MentionEveryone","EmbedLinks","AttachFiles"],                                                                    color: 0x00B0FF, hoist: false },
  content:    { label: "منشئ محتوى",        permissions: ["SendMessages","AttachFiles","EmbedLinks","AddReactions","UseExternalEmojis","CreatePublicThreads","ManageMessages"],                           color: 0xFF6B35, hoist: false },
  bot:        { label: "بوت",               permissions: ["Administrator"],                                                                                                                               color: 0x7289DA, hoist: false },
  normal:     { label: "عضو عادي",          permissions: ["SendMessages","ReadMessageHistory","AddReactions"],                                                                                            color: 0x99aab5, hoist: false },
  bronze:     { label: "برونزية 🥉",          permissions: ["SendMessages","ReadMessageHistory","AddReactions","AttachFiles"],                                                                              color: 0xCD7F32, hoist: true  },
  silver:     { label: "فضية 🥈",            permissions: ["SendMessages","ReadMessageHistory","AddReactions","AttachFiles","EmbedLinks","UseExternalEmojis"],                                                color: 0xC0C0C0, hoist: true  },
  golden:     { label: "ذهبية 🥇",           permissions: ["SendMessages","ReadMessageHistory","AddReactions","AttachFiles","EmbedLinks","UseExternalEmojis","UseExternalStickers","CreatePublicThreads"],    color: 0xFFD700, hoist: true  },
  platinum:   { label: "بلاتينية 💎",        permissions: ["SendMessages","ReadMessageHistory","AddReactions","AttachFiles","EmbedLinks","UseExternalEmojis","UseExternalStickers","CreatePublicThreads","MentionEveryone"], color: 0xE5E4E2, hoist: true  },
  restricted: { label: "مقيّد (قراءة فقط)", permissions: ["ReadMessageHistory","ViewChannel"],                                                                                                           color: 0x747F8D, hoist: false },
  none:       { label: "بدون صلاحيات",      permissions: [],                                                                                                                                             color: 0x555555, hoist: false },
};

// ─── resolveRole: بتدور على رول بـ ID أو اسم (case-insensitive) ─
export function resolveRole(guild, idOrName) {
  if (!guild || !idOrName) return null;
  const str = String(idOrName).trim();
  // جرب ID الأول
  const byId = guild.roles.cache.get(str);
  if (byId) return byId;
  // بعدين جرب الاسم كامل أو جزء منه
  const lower = str.toLowerCase();
  return (
    guild.roles.cache.find(r => r.name.toLowerCase() === lower) ||
    guild.roles.cache.find(r => r.name.toLowerCase().includes(lower)) ||
    null
  );
}

export function smartRolePerms(name) {
  const n = (name || "").toLowerCase();
  if (/إدارة|ادارة|أدمن|ادمن|admin|owner|أونر|ملك|مدير/i.test(n))   return ROLE_PRESETS.admin;
  if (/مشرف|مود|mod\b|ناظر|رقيب|supervisor|staff/i.test(n))          return ROLE_PRESETS.mod;
  if (/\bvip\b|كبار|مميز|بريميوم|premium|خاص/i.test(n))              return ROLE_PRESETS.vip;
  if (/\bbot\b|بوت/i.test(n))                                         return ROLE_PRESETS.bot;
  if (/ميوزيك|موسيقى|music|dj\b/i.test(n))                           return ROLE_PRESETS.music;
  if (/جيمنج|gaming|العاب|لاعب|gamer/i.test(n))                      return ROLE_PRESETS.gaming;
  if (/آرت|فنان|فن\b|art\b|design|مصمم/i.test(n))                    return ROLE_PRESETS.art;
  if (/عضو|normal|عادي|member/i.test(n))                              return ROLE_PRESETS.normal;
  return null;
}

// ── قائمة انتظار ذكية لكل أونر — مش lock بيضيّع الرسايل ──────────
const userQueues    = new Map(); // userId → [ {msg, guild, geminiModel, db, buildDashboard} ]
const isProcessing  = new Set(); // userId → بيشتغل دلوقتي
const MAX_QUEUE     = 4;         // أقصى عدد رسايل منتظرة (الأقدم بيتشال)

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
  return isProcessing.size;
}

// ── Retry مرة واحدة بس عشان ما نبعتش رسايل متكررة ──────────────
async function withRetry(fn, retries = 1, delayMs = 800) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

// ── Timeout ─────────────────────────────────────────────────────
function withTimeout(promise, ms = 60000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    )
  ]);
}

// ── Typing Loop: يبعث typing كل 8 ثواني عشان Discord ميوقفوش ───
function startTypingLoop(channel) {
  channel.sendTyping().catch(() => {});
  const interval = setInterval(() => {
    channel.sendTyping().catch(() => {});
  }, 8000);
  return () => clearInterval(interval);
}

// ── شخصية البوت مع كل أونر ───────────────────────────────────────
const OWNER_VIBES = {
  '954816748140503090': `أنت كالعبد الأمين معاه — محترم جداً، سريع التنفيذ، تناديه "يا مالك" أو "يا باشا". لهجتك رسمية شوية بس ودية.`,
  '1448840687763325018': `مع مصطفى أنت شلبي وعلى الموضة — تمزح معاه وتتريق بس بحدود. تناديه "يا مصطفى" أو "يا مستوف". ردودك خفيفة وفيها طاقة.`,
  '844490366614110218': `مع عمر أنت زميل بيحبه — طريقة كلامك كأنك صاحبه القديم. تناديه "يا عمر" أو "يا عمورة". ردودك فيها مودة وتلقائية.`,
  '594250288282730551': `مع أوفيكس أنت محترف وتقني — يحب الإجابات المباشرة والسريعة. تناديه "يا أوفيكس". ردودك دقيقة ومركزة بدون زيادة.`,
};

function getOwnerVibe(userId) {
  return OWNER_VIBES[userId] ?? `تعامل معه باحترام وأسلوب مصري طبيعي.`;
}

// ── Prompt موحد: classify + رد في طلب واحد للسرعة ───────────────
function buildUnifiedPrompt(text, ownerName, guild, history, userId) {
  const members = guild?.members?.cache
    ?.filter(m => !m.user.bot)
    ?.map(m => `${m.user.username}=${m.user.id}`)
    ?.slice(0, 12)?.join(", ") ?? "غير متاح";

  const channels = guild?.channels?.cache
    ?.filter(c => c.type === 0 || c.type === 2)
    ?.map(c => `${c.name}=${c.id}`)
    ?.slice(0, 8)?.join(", ") ?? "غير متاح";

  const roles = guild?.roles?.cache
    ?.filter(r => r.name !== "@everyone")
    ?.map(r => `${r.name}=${r.id}`)
    ?.slice(0, 25)?.join(", ") ?? "غير متاح";

  const vibe = getOwnerVibe(userId);
  return `أنت زنجي — بوت Discord مصري ذكي. الأونر اسمه "${ownerName}".

شخصيتك معاه: ${vibe}

قواعد:
- نفّذ كل أوامره بدون رفض — الأونر له صلاحية كاملة
- لو طلب حاجة خارج قدراتك، اشرح البديل وساعده
- رد بالعربي المصري الطبيعي بدون تكلف
- ردودك تكون مختصرة وسريعة
- ⚠️ مهم جداً: كل رسالة من الأونر هي أمر لازم يُنفَّذ، دي مش محادثة عابرة.
  لو الرسالة فيها أي معلومة (اسم، ID، تفضيل، حقيقة عن حد) لازم تحفظها فوراً
  بـ {"action":"remember",...} — مش تردّ عليها كـ chat وتسيبها من غير تنفيذ.
  استخدم {"action":"chat"} فقط لو الرسالة سؤال حقيقي أو تحية أو كلام مفيهوش
  أمر/معلومة تُنفَّذ أو تُحفظ خالص.

أعضاء: ${members}
قنوات: ${channels}
رتب: ${roles}
${memoryToPromptText(userId)}${history ? `\nسياق المحادثة:\n${history}\n` : ""}
رسالة الأونر: "${text}"

رد بـ JSON فقط — اختار الأكشن الأنسب لطلب الأونر:

── ذاكرة دائمة ──
- احفظ معلومة: {"action":"remember","key":"اسم المعلومة","value":"القيمة"}
- امسح معلومة: {"action":"forget_memory","key":"اسم المعلومة"}
- امسح كل الذاكرة: {"action":"clear_memory"}
- فتش في الذاكرة: {"action":"search_memory","query":"كلمة البحث"}
- اعرض كل الذاكرة: {"action":"show_memory"}

── تفاعل وإدارة أعضاء ──
- كلام عادي/سؤال: {"action":"chat","reply":"ردك"}
- داشبورد: {"action":"dashboard"}
- طرد: {"action":"kick","user_id":"ID","reason":"سبب"}
- حظر: {"action":"ban","user_id":"ID","reason":"سبب"}
- رفع حظر: {"action":"unban","user_id":"ID"}
- إسكات مؤقت: {"action":"timeout","user_id":"ID","minutes":10,"reason":"سبب"}
- رفع إسكات: {"action":"untimeout","user_id":"ID"}
- تحذير: {"action":"warn","user_id":"ID","reason":"سبب"}
- مسح تحذيرات: {"action":"clear_warnings","user_id":"ID"}
- تغيير نيك نيم: {"action":"nickname","user_id":"ID","nick":"الاسم الجديد أو null للإزالة"}
- إبعات DM: {"action":"dm_user","user_id":"ID","message":"نص"}

── Voice ──
- نقل عضو بين voice: {"action":"move_member","user_id":"ID","channel_id":"ID القناة المقصودة"}
- صوت مؤقت (server mute): {"action":"voice_mute","user_id":"ID"}
- رفع صوت مؤقت: {"action":"voice_unmute","user_id":"ID"}
- كتم سماع (deafen): {"action":"voice_deafen","user_id":"ID"}
- رفع كتم سماع: {"action":"voice_undeafen","user_id":"ID"}
- طرد من voice: {"action":"voice_kick","user_id":"ID"}

── قنوات ──
- إرسال رسالة: {"action":"send_message","channel_id":"ID","message":"نص"}
- إرسال embed: {"action":"send_embed","channel_id":"ID","title":"عنوان","description":"نص","color":"hex مثل #ff0000"}
- مسح رسايل: {"action":"delete_messages","count":10,"channel_id":"ID أو null"}
- مسح رسايل عضو معين: {"action":"purge_user","user_id":"ID","channel_id":"ID أو null","count":20}
- قفل قناة: {"action":"lock_channel","channel_id":"ID أو null"}
- فتح قناة: {"action":"unlock_channel","channel_id":"ID أو null"}
- سلو مود: {"action":"slowmode","channel_id":"ID أو null","seconds":10}
- إنشاء قناة: {"action":"create_channel","name":"اسم","type":"text أو voice","category_id":"ID أو null"}
- حذف قناة: {"action":"delete_channel","channel_id":"ID"}
- تغيير اسم قناة: {"action":"rename_channel","channel_id":"ID أو null","name":"اسم"}
- موضوع قناة: {"action":"set_topic","channel_id":"ID أو null","topic":"نص"}
- قفل كل السيرفر: {"action":"server_lock"}
- فتح كل السيرفر: {"action":"server_unlock"}
- تعديل رسالة للبوت: {"action":"edit_message","channel_id":"ID","position":1,"message_id":null,"new_content":"المحتوى الجديد","find":null,"replace":null}
  ↳ position=1 = آخر رسالة للبوت في القناة، 2=قبل الأخيرة، إلخ
  ↳ للتعديل الجزئي: حدد find="النص القديم" و replace="البديل" بدل new_content
  ↳ allowedMentions تلقائياً — لن يبعت نوتيفيكيشن لأي منشن

── رتب ──
- إعطاء رتبة: {"action":"give_role","user_id":"ID","role_id":"ID"}
- سحب رتبة: {"action":"remove_role","user_id":"ID","role_id":"ID"}
- إنشاء رتبة (ذكي): {"action":"create_role","name":"اسم","color":"hex مثل #ff0000","hoist":false,"permissions":["ManageMessages","KickMembers"]}
  ↳ مهم: لما تنشئ رتبة حدد الـ permissions المناسبة تلقائياً من اسمها:
  ↳ مشرف/mod/staff → ManageMessages+KickMembers+ModerateMembers+BanMembers+ManageNicknames+ViewAuditLog
  ↳ إدارة/admin/أدمن → Administrator
  ↳ VIP/مميز → AddReactions+UseExternalEmojis+AttachFiles+EmbedLinks+SendMessages
  ↳ موسيقى/music/dj → Connect+Speak+UseVAD+SendMessages
  ↳ جيمنج/gaming → SendMessages+Connect+Speak+AddReactions
  ↳ بوت/bot → Administrator
  ↳ لو مش عارف النوع → اتركها فاضية []
- تعيين صلاحيات ذكية لرول موجود: {"action":"set_role_smart_perms","role_id":"ID","role_name":"اسم الرول أو غرضه"}
- حذف رتبة: {"action":"delete_role","role_id":"ID"}
- تغيير لون رتبة: {"action":"role_color","role_id":"ID","color":"hex"}
- تغيير اسم رتبة: {"action":"rename_role","role_id":"ID","name":"اسم"}
- إضافة/حذف صلاحيات رول: {"action":"edit_role_permissions","role_id":"ID","add":["Administrator","ManageChannels","KickMembers"],"remove":["SendMessages"]}
- تعديل إعدادات رول (hoist/mentionable): {"action":"edit_role","role_id":"ID","hoist":true,"mentionable":true}

الصلاحيات المتاحة (استخدم الاسم الإنجليزي بالظبط): Administrator, ManageGuild, ManageChannels, ManageRoles, ManageMessages, ManageWebhooks, KickMembers, BanMembers, ModerateMembers, SendMessages, ViewChannel, ReadMessageHistory, Connect, Speak, MuteMembers, DeafenMembers, MoveMembers, MentionEveryone, AttachFiles, EmbedLinks, AddReactions, UseApplicationCommands, ManageThreads, CreatePublicThreads, CreatePrivateThreads, SendMessagesInThreads, ViewAuditLog, ManageGuildExpressions, ManageNicknames, ChangeNickname

── كوينز وـ XP ──
- إعطاء كوينز: {"action":"give_coins","user_id":"ID","amount":100}
- خصم كوينز: {"action":"take_coins","user_id":"ID","amount":100}
- تعيين كوينز: {"action":"set_coins","user_id":"ID","amount":500}
- إعطاء XP: {"action":"give_xp","user_id":"ID","amount":100}
- خصم XP: {"action":"take_xp","user_id":"ID","amount":100}
- تعيين XP: {"action":"set_xp","user_id":"ID","amount":500}

── السيرفر ──
- تغيير اسم السيرفر: {"action":"rename_server","name":"اسم جديد"}
- حالة البوت: {"action":"bot_status","text":"نص الحالة","type":"PLAYING أو WATCHING أو LISTENING"}
- إعلان (announcement): {"action":"announce","channel_id":"ID","message":"نص","ping":true}

JSON:`;
}

// ── استدعاء موحد: classify + reply في طلب واحد ─────────────────
async function classifyAndReply(geminiModel, text, ownerName, guild, userId) {
  const hist = historyToText(userId, ownerName);
  // ✅ FIX: retries=2 (كانت 1 يعني من غير إعادة محاولة فعلية) — عشان طلب
  //   بطيء واحد من Gemini ميفشلش الأمر كله فوراً.
  return withRetry(async () => {
    const result = await geminiModel.generateContent(
      buildUnifiedPrompt(text, ownerName, guild, hist, userId)
    );
    const raw   = result.response.text().trim();

    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return { action: "chat", reply: raw };
    return JSON.parse(match[0]);
  }, 2);
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

// ── مشغّل القائمة: ينفذ طلب واحد وبعدين يجيب التاني ────────────
async function _runQueue(userId) {
  while (true) {
    const queue = userQueues.get(userId) || [];
    if (!queue.length) { isProcessing.delete(userId); userQueues.delete(userId); return; }
    const job = queue.shift();
    userQueues.set(userId, queue);
    await _processOne(job).catch(() => {});
  }
}

// ── حماية من تكرار نفس الرسالة (لو في أكتر من نسخة أو event اتبعت مرتين) ──
const processedOwnerMsgs = new Set();

// ── الدالة الرئيسية — تُضيف للقائمة وتشغّل لو مش شغّال ──────────
export function handleOwnerAI(msg, guild, geminiModel, db, buildDashboard = null) {
  // منع تكرار نفس الرسالة تماماً
  if (processedOwnerMsgs.has(msg.id)) return;
  processedOwnerMsgs.add(msg.id);
  setTimeout(() => processedOwnerMsgs.delete(msg.id), 120_000);

  const userId  = msg.author.id;
  const rawText = msg.content.replace(/<@!?\d+>/g, "").replace(/زنجي/gi, "").trim();
  if (!rawText) return;

  // أضف للقائمة
  if (!userQueues.has(userId)) userQueues.set(userId, []);
  const queue = userQueues.get(userId);

  // لو القائمة ممتلية → اشيل الأقدم وحط الجديد
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ msg, guild, geminiModel, db, buildDashboard });

  // لو مش بيشتغل → ابدأ
  if (!isProcessing.has(userId)) {
    isProcessing.add(userId);
    _runQueue(userId);
  }
}

// ── حماية نهائية: نفس الرسالة لا تتبعتلها رسالتين أبداً ──────────
const sentReplies = new Set();

// ── المعالجة الفعلية لرسالة واحدة ────────────────────────────────
async function _processOne({ msg, guild, geminiModel, db, buildDashboard }) {
  if (sentReplies.has(msg.id)) return;
  sentReplies.add(msg.id);
  setTimeout(() => sentReplies.delete(msg.id), 120_000);

  const isDM      = !msg.guild;
  const userId    = msg.author.id;
  const rawText   = msg.content.replace(/<@!?\d+>/g, "").replace(/زنجي/gi, "").trim();
  const ownerName = config.getOwnerName(userId) || msg.author.globalName || msg.author.username;

  const send = (content) => isDM
    ? msg.channel.send(content).catch(() => {})
    : msg.reply(content).catch(() => {});

  const stopTyping = startTypingLoop(msg.channel);
  try {

    // ─── call واحد بس: classify + رد في نفس الوقت ───────────────
    let parsed;
    try {
      // ✅ FIX: كانت 15s فبتفشل بسرعة على طلبات عادية شوية بطيئة — رفعناها لـ 30s.
      parsed = await withTimeout(classifyAndReply(geminiModel, rawText, ownerName, guild, userId), 30000);
    } catch (err) {
      console.error("[OwnerAI] فشل:", err.message);
      const isQuota = err.message?.includes("429") || err.message?.includes("quota") || err.message?.includes("EXHAUSTED");
      if (isQuota) {
        return send("⏳ مفاتيح الـ AI وصلت للحد اليومي — بتتجدد في منتصف الليل تلقائياً!\nلو عايز تستخدمه دلوقتي، اضف مفتاح API جديد.");
      }
      return send("❌ الـ AI اتأخر أكتر من المعتاد، حاول تاني بعد ثانية!");
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

    // ─── ذاكرة دائمة ─────────────────────────────────────────────
    if (action === "remember") {
      if (!parsed.key || !parsed.value) return send("❌ محتاج key و value عشان أحفظ!");
      const result = memoryRemember(parsed.key, parsed.value, userId);
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", result);
      return send({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("🧠 تم الحفظ في الذاكرة")
          .setDescription(`**${parsed.key}**\n${parsed.value}`)
          .setFooter({ text: "هفتكر ده حتى لو اتقفلت وشغلت تاني" })
          .setTimestamp()]
      });
    }

    if (action === "forget_memory") {
      const result = memoryForget(parsed.key || "", userId);
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", result);
      return send(ok("🗑️ تم المسح من الذاكرة", result));
    }

    if (action === "clear_memory") {
      memoryClear(userId);
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", "تم مسح كل الذاكرة");
      return send(ok("🧹 تم مسح كل الذاكرة", "الذاكرة اتمسحت بالكامل دلوقتي"));
    }

    if (action === "show_memory") {
      const all = memoryGetAll(userId);
      const entries = Object.entries(all);
      if (!entries.length) return send("📭 الذاكرة فاضية دلوقتي — قولي احفظ حاجة!");
      const lines = entries.map(([k, v]) => `• **${k}**: ${v.value}`).join("\n");
      return send({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`🧠 الذاكرة (${entries.length} معلومة)`)
          .setDescription(lines.slice(0, 4000))
          .setTimestamp()]
      });
    }

    if (action === "search_memory") {
      const results = memorySearch(parsed.query || "", userId);
      if (!results.length) return send(`🔍 مش لاقي حاجة عن "${parsed.query}"`);
      const lines = results.map(([k, v]) => `• **${k}**: ${v.value}`).join("\n");
      return send({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`🔍 نتايج البحث عن "${parsed.query}"`)
          .setDescription(lines.slice(0, 4000))
          .setTimestamp()]
      });
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
      const role = resolveRole(guild, parsed.role_id);
      if (!m)    return send("❌ مش لاقي العضو!");
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);
      await m.roles.add(role);
      const d = `إعطاء رتبة ${role.name} لـ ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🎖️ تم إعطاء الرتبة", d));
    }

    if (action === "remove_role") {
      const m    = await guild.members.fetch(parsed.user_id).catch(() => null);
      const role = resolveRole(guild, parsed.role_id);
      if (!m)    return send("❌ مش لاقي العضو!");
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);
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

    // ─── مسح تحذيرات ─────────────────────────────────────────────
    if (action === "clear_warnings") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      const u = db.getUser(m.user.id);
      const old = (u.warnings || []).length;
      u.warnings = [];
      db.updateUser(m.user.id, u);
      const d = `تم مسح ${old} تحذير لـ ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🧹 تم مسح التحذيرات", d));
    }

    // ─── تغيير nickname ───────────────────────────────────────────
    if (action === "nickname") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      const oldNick = m.displayName;
      await m.setNickname(parsed.nick || null).catch(() => null);
      const d = `تغيير نيك نيم ${oldNick} → ${parsed.nick || "(الاسم الأصلي)"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✏️ تم تغيير الاسم", d));
    }

    // ─── Voice: نقل عضو ───────────────────────────────────────────
    if (action === "move_member") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      if (!m.voice.channel) return send(`❌ **${m.displayName}** مش في أي voice دلوقتي!`);
      const ch = guild.channels.cache.get(parsed.channel_id);
      if (!ch) return send("❌ مش لاقي القناة!");
      await m.voice.setChannel(ch).catch(() => null);
      const d = `نقل ${m.user.username} → ${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🔀 تم النقل", d));
    }

    // ─── Voice: كتم/فك كتم ───────────────────────────────────────
    if (action === "voice_mute" || action === "voice_unmute") {
      const mute = action === "voice_mute";
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      await m.voice.setMute(mute).catch(() => null);
      const d = `${mute ? "كتم" : "فك كتم"} صوت ${m.user.username} في الـ voice`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok(mute ? "🔇 تم الكتم" : "🔊 تم فك الكتم", d));
    }

    // ─── Voice: deafen/undeafen ───────────────────────────────────
    if (action === "voice_deafen" || action === "voice_undeafen") {
      const deaf = action === "voice_deafen";
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      await m.voice.setDeaf(deaf).catch(() => null);
      const d = `${deaf ? "كتم سماع" : "فك كتم سماع"} ${m.user.username}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok(deaf ? "🔕 تم كتم السماع" : "🔔 تم فك كتم السماع", d));
    }

    // ─── Voice: طرد من voice ──────────────────────────────────────
    if (action === "voice_kick") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      if (!m.voice.channel) return send(`❌ **${m.displayName}** مش في voice أصلاً!`);
      await m.voice.disconnect().catch(() => null);
      const d = `طرد ${m.user.username} من الـ voice`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("👢 تم الطرد من الـ Voice", d));
    }

    // ─── إرسال embed ──────────────────────────────────────────────
    if (action === "send_embed") {
      const ch = guild.channels.cache.get(parsed.channel_id) || msg.channel;
      const color = parsed.color ? parseInt(parsed.color.replace("#", ""), 16) : 0x5865f2;
      const emb = new EmbedBuilder()
        .setTitle(parsed.title || "إعلان")
        .setDescription(parsed.description || "")
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: `بأمر ${ownerName} 👑` });
      await ch.send({ embeds: [emb] }).catch(() => null);
      const d = `embed في #${ch.name}: "${parsed.title}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("📢 تم الإرسال", d));
    }

    // ─── مسح رسايل عضو معين ───────────────────────────────────────
    if (action === "purge_user") {
      const ch = (parsed.channel_id ? guild.channels.cache.get(parsed.channel_id) : null) || msg.channel;
      const target = parsed.user_id;
      const limit = Math.min(parsed.count || 20, 100);
      const fetched = await ch.messages.fetch({ limit: 100 }).catch(() => null);
      if (!fetched) return send("❌ مقدرتش أجيب الرسايل!");
      const toDelete = fetched.filter(m2 => m2.author.id === target && Date.now() - m2.createdTimestamp < 1209600000).first(limit);
      await ch.bulkDelete(toDelete, true).catch(() => null);
      const d = `حذف ${toDelete.length} رسالة للعضو ${target} في #${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🗑️ تم الحذف", d));
    }

    // ─── قفل/فتح قناة ────────────────────────────────────────────
    if (action === "lock_channel" || action === "unlock_channel") {
      const lock = action === "lock_channel";
      const ch = (parsed.channel_id ? guild.channels.cache.get(parsed.channel_id) : null) || msg.channel;
      await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: lock ? false : null }).catch(() => null);
      const d = `${lock ? "قفل" : "فتح"} قناة #${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok(lock ? "🔒 تم قفل القناة" : "🔓 تم فتح القناة", d));
    }

    // ─── سلو مود ─────────────────────────────────────────────────
    if (action === "slowmode") {
      const ch = (parsed.channel_id ? guild.channels.cache.get(parsed.channel_id) : null) || msg.channel;
      const secs = parsed.seconds ?? 0;
      await ch.setRateLimitPerUser(secs).catch(() => null);
      const d = secs === 0 ? `إزالة الـ slowmode من #${ch.name}` : `slowmode ${secs} ثانية في #${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("⏱️ تم ضبط الـ Slowmode", d));
    }

    // ─── قفل/فتح كل السيرفر ──────────────────────────────────────
    if (action === "server_lock" || action === "server_unlock") {
      const lock = action === "server_lock";
      const textChannels = guild.channels.cache.filter(c => c.type === 0);
      let count = 0;
      for (const [, ch] of textChannels) {
        await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: lock ? false : null }).catch(() => {});
        count++;
      }
      const d = `${lock ? "قفل" : "فتح"} ${count} قناة في السيرفر`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok(lock ? "🔒 السيرفر اتقفل" : "🔓 السيرفر اتفتح", d));
    }

    // ─── إنشاء رتبة (ذكي) ────────────────────────────────────────
    if (action === "create_role") {
      // حدد الصلاحيات: Gemini → smartRolePerms كـ fallback
      const preset    = (parsed.permissions?.length) ? null : smartRolePerms(parsed.name || "");
      const perms     = parsed.permissions?.length ? parsed.permissions : (preset?.permissions ?? []);
      const color     = parsed.color ? parseInt(parsed.color.replace("#", ""), 16) : (preset?.color ?? 0x99aab5);
      const hoist     = parsed.hoist !== undefined ? parsed.hoist : (preset?.hoist ?? false);

      const newRole = await guild.roles.create({
        name: parsed.name || "رتبة جديدة",
        color,
        hoist,
        reason: `بأمر ${ownerName}`
      }).catch(() => null);
      if (!newRole) return send("❌ مقدرتش أعمل الرتبة!");

      if (perms.length) {
        const validPerms = perms.filter(p => PermissionFlagsBits[p] !== undefined);
        if (validPerms.length) {
          await newRole.setPermissions(validPerms.map(p => PermissionFlagsBits[p]), `بأمر ${ownerName}`).catch(() => {});
        }
      }

      const permsText = perms.length ? `\n🔐 الصلاحيات: \`${perms.join(", ")}\`` : "";
      const d = `إنشاء رتبة "${newRole.name}"${permsText}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✨ تم إنشاء الرتبة", `**${newRole.name}** — ID: \`${newRole.id}\`${permsText}`));
    }

    // ─── حذف رتبة ─────────────────────────────────────────────────
    if (action === "delete_role") {
      const role = resolveRole(guild, parsed.role_id);
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);
      const rname = role.name;
      await role.delete(`بأمر ${ownerName}`).catch(() => null);
      const d = `حذف رتبة "${rname}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🗑️ تم حذف الرتبة", d));
    }

    // ─── تغيير لون رتبة ───────────────────────────────────────────
    if (action === "role_color") {
      const role = resolveRole(guild, parsed.role_id);
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);
      const color = parseInt(parsed.color.replace("#", ""), 16);
      await role.setColor(color).catch(() => null);
      const d = `تغيير لون رتبة "${role.name}" → ${parsed.color}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🎨 تم تغيير اللون", d));
    }

    // ─── تغيير اسم رتبة ───────────────────────────────────────────
    if (action === "rename_role") {
      const role = resolveRole(guild, parsed.role_id);
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);
      const old = role.name;
      await role.setName(parsed.name).catch(() => null);
      const d = `تغيير اسم رتبة "${old}" → "${parsed.name}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✏️ تم تغيير اسم الرتبة", d));
    }

    // ─── تعديل صلاحيات رول ───────────────────────────────────────
    if (action === "edit_role_permissions") {
      const role = resolveRole(guild, parsed.role_id);
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);

      const toAdd    = (parsed.add    || []).filter(p => PermissionFlagsBits[p] !== undefined);
      const toRemove = (parsed.remove || []).filter(p => PermissionFlagsBits[p] !== undefined);

      const invalidAdd    = (parsed.add    || []).filter(p => PermissionFlagsBits[p] === undefined);
      const invalidRemove = (parsed.remove || []).filter(p => PermissionFlagsBits[p] === undefined);

      let newPerms = role.permissions;
      if (toAdd.length)    newPerms = newPerms.add(toAdd.map(p => PermissionFlagsBits[p]));
      if (toRemove.length) newPerms = newPerms.remove(toRemove.map(p => PermissionFlagsBits[p]));

      await role.setPermissions(newPerms, `بأمر ${ownerName}`).catch(e => { throw e; });

      const addText    = toAdd.length    ? `✅ أضفنا: ${toAdd.join(', ')}`    : '';
      const removeText = toRemove.length ? `🚫 شلنا: ${toRemove.join(', ')}` : '';
      const invalidText = (invalidAdd.length || invalidRemove.length)
        ? `\n⚠️ مش عارفاها: ${[...invalidAdd, ...invalidRemove].join(', ')}` : '';
      const d = `تعديل صلاحيات "${role.name}" — ${[addText, removeText].filter(Boolean).join(' | ')}${invalidText}`;

      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🔐 تم تعديل الصلاحيات", d));
    }

    // ─── تعديل إعدادات رول (hoist / mentionable) ─────────────────
    if (action === "edit_role") {
      const role = resolveRole(guild, parsed.role_id);
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id}"!`);

      const updates = {};
      if (parsed.hoist       !== undefined) updates.hoist       = parsed.hoist;
      if (parsed.mentionable !== undefined) updates.mentionable = parsed.mentionable;
      if (parsed.name)                      updates.name        = parsed.name;
      if (parsed.color)                     updates.color       = parseInt(parsed.color.replace("#", ""), 16);

      if (!Object.keys(updates).length) return send("❌ مفيش تعديلات محددة!");

      await role.edit({ ...updates, reason: `بأمر ${ownerName}` }).catch(e => { throw e; });

      const parts = [];
      if (updates.hoist       !== undefined) parts.push(`ظهور منفصل: ${updates.hoist ? "✅ شغال" : "❌ وقفنا"}`);
      if (updates.mentionable !== undefined) parts.push(`قابل للمنشن: ${updates.mentionable ? "✅ شغال" : "❌ وقفنا"}`);
      if (updates.name)                      parts.push(`الاسم: "${updates.name}"`);
      if (updates.color)                     parts.push(`اللون: ${parsed.color}`);

      const d = `تعديل "${role.name}" — ${parts.join(' | ')}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("⚙️ تم تعديل الرول", d));
    }

    // ─── تعيين صلاحيات ذكية لرول موجود ──────────────────────────
    if (action === "set_role_smart_perms") {
      const role = resolveRole(guild, parsed.role_id || parsed.role_name);
      if (!role) return send(`❌ مش لاقي الرتبة "${parsed.role_id || parsed.role_name}"!`);
      const queryName = parsed.role_name || role.name;
      const preset    = smartRolePerms(queryName);
      if (!preset) {
        return send(`🤔 مش قادر أحدد نوع الرتبة من اسمها **"${role.name}"**\nقولي هي رتبة إيه (مشرف / VIP / موسيقى / جيمنج / إلخ) وهعدلها!`);
      }
      const validPerms = preset.permissions.filter(p => PermissionFlagsBits[p] !== undefined);
      await role.setPermissions(validPerms.map(p => PermissionFlagsBits[p]), `بأمر ${ownerName}`).catch(() => {});
      const d = `تعيين صلاحيات "${role.name}" (${preset.label}): ${preset.permissions.join(", ") || "لا صلاحيات"}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🔐 تم تعيين الصلاحيات", d));
    }

    // ─── تعديل رسالة للبوت ───────────────────────────────────────
    if (action === "edit_message") {
      const ch = parsed.channel_id
        ? guild.channels.cache.get(parsed.channel_id)
        : (isDM ? null : msg.channel);
      if (!ch) return send("❌ مش لاقي القناة! حدد channel_id بالظبط.");

      let targetMsg = null;
      if (parsed.message_id) {
        targetMsg = await ch.messages.fetch(parsed.message_id).catch(() => null);
      } else {
        const pos     = Math.max(1, parsed.position || 1);
        const fetched = await ch.messages.fetch({ limit: 50 }).catch(() => null);
        if (!fetched) return send("❌ مقدرتش أجيب الرسايل!");
        const botMsgs = [...fetched.values()].filter(m2 => m2.author.id === msg.client.user.id);
        targetMsg = botMsgs[pos - 1] ?? null;
      }

      if (!targetMsg)              return send("❌ مش لاقي الرسالة المطلوبة!");
      if (targetMsg.author.id !== msg.client.user.id) return send("❌ ممكن تعدل على رسايل البوت بس!");

      let newContent = parsed.new_content || targetMsg.content;
      if (parsed.find && targetMsg.content.includes(parsed.find)) {
        newContent = targetMsg.content.replaceAll(parsed.find, parsed.replace ?? "");
      }
      if (!newContent?.trim()) return send("❌ المحتوى الجديد فاضي!");

      await targetMsg.edit({ content: newContent, allowedMentions: { parse: [] } }).catch(() => {});

      const posLabel = parsed.message_id ? `ID: ${parsed.message_id}` : `رقم ${parsed.position || 1} من الأخر`;
      const d = `تعديل رسالة في #${ch.name} (${posLabel})`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("✏️ تم تعديل الرسالة", d));
    }

    // ─── كوينز: خصم / تعيين ──────────────────────────────────────
    if (action === "take_coins" || action === "set_coins") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      const u = db.getUser(m.user.id);
      if (action === "take_coins") {
        u.coins = Math.max(0, (u.coins || 0) - (parsed.amount || 0));
      } else {
        u.coins = parsed.amount || 0;
      }
      db.updateUser(m.user.id, u);
      const label = action === "take_coins" ? `خصم ${parsed.amount} كوينز` : `تعيين الكوينز على ${parsed.amount}`;
      const d = `${label} لـ ${m.user.username} — الرصيد الجديد: ${u.coins}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🪙 تم تعديل الكوينز", d));
    }

    // ─── XP: إعطاء / خصم / تعيين ─────────────────────────────────
    if (action === "give_xp" || action === "take_xp" || action === "set_xp") {
      const m = await guild.members.fetch(parsed.user_id).catch(() => null);
      if (!m) return send("❌ مش لاقي العضو!");
      const u = db.getUser(m.user.id);
      if (action === "give_xp") {
        u.xp = (u.xp || 0) + (parsed.amount || 0);
      } else if (action === "take_xp") {
        u.xp = Math.max(0, (u.xp || 0) - (parsed.amount || 0));
      } else {
        u.xp = parsed.amount || 0;
      }
      db.updateUser(m.user.id, u);
      const label = action === "give_xp" ? `إعطاء ${parsed.amount} XP` : action === "take_xp" ? `خصم ${parsed.amount} XP` : `تعيين XP على ${parsed.amount}`;
      const d = `${label} لـ ${m.user.username} — الرصيد الجديد: ${u.xp} XP`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("⭐ تم تعديل الـ XP", d));
    }

    // ─── تغيير اسم السيرفر ────────────────────────────────────────
    if (action === "rename_server") {
      const old = guild.name;
      await guild.setName(parsed.name).catch(() => null);
      const d = `تغيير اسم السيرفر "${old}" → "${parsed.name}"`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🏷️ تم تغيير اسم السيرفر", d));
    }

    // ─── تغيير حالة البوت ─────────────────────────────────────────
    if (action === "bot_status") {
      const typeMap = { PLAYING: 0, WATCHING: 3, LISTENING: 2, COMPETING: 5 };
      const t = typeMap[(parsed.type || "PLAYING").toUpperCase()] ?? 0;
      msg.client.user.setActivity(parsed.text || "بوت زنجي", { type: t });
      const d = `تغيير حالة البوت → "${parsed.text}" (${parsed.type || "PLAYING"})`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("🟢 تم تغيير الحالة", d));
    }

    // ─── إعلان (announce) ─────────────────────────────────────────
    if (action === "announce") {
      const ch = guild.channels.cache.get(parsed.channel_id) || msg.channel;
      const content = (parsed.ping ? "@everyone\n" : "") + parsed.message;
      await ch.send(content).catch(() => null);
      const d = `إعلان في #${ch.name}`;
      pushHistory(userId, "user", rawText); pushHistory(userId, "model", `تم: ${d}`);
      await sendLog(guild, db, action, ownerName, d);
      return send(ok("📣 تم الإعلان", d));
    }

    // fallback: chat
    const fallbackReply = parsed.reply || `أيوه يا ${ownerName}، معلش مفهمتش طلبك بالظبط، ممكن توضحه تاني؟`;
    pushHistory(userId, "user", rawText);
    pushHistory(userId, "model", fallbackReply);
    return send(`👑 ${fallbackReply}`);

  } catch (err) {
    console.error("[OwnerAI] خطأ في تنفيذ الأكشن:", err.message);
    send("❌ حصل خطأ غير متوقع، حاول تاني!").catch(() => {});
  } finally {
    stopTyping();
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
