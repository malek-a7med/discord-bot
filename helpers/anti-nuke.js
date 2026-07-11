// ═══════════════════════════════════════════════════════════════
//  Anti-Nuke — حماية ضد تخريب المشرفين (مستوحى من Rory Security)
//
//  الفكرة: لو مود (أو حساب اتسرق منه) عمل أفعال خطيرة (باند/طرد/حذف
//  رتبة/حذف روم) أكتر من الحد المسموح بيه في نافذة زمنية قصيرة،
//  بناخد فيه إجراء تلقائي (كيك/باند/إسكات) عشان نوقف التخريب بسرعة.
//
//  مستثنى دايماً: الأونر، صاحب السيرفر، والبوت نفسه.
// ═══════════════════════════════════════════════════════════════
import { AuditLogEvent } from "discord.js";
import config from "../config.js";

// executorId -> { guildId -> { count, firstAt } }
const _actionTracker = new Map();

function trackerKey(guildId, executorId) {
  return `${guildId}_${executorId}`;
}

function isExempt(executorId, guild) {
  if (config.isOwner?.(executorId)) return true;
  if (executorId === guild.ownerId) return true;
  if (executorId === guild.client.user.id) return true;
  return false;
}

// بيرجع true لو لازم ناخد إجراء (تعدّى الحد)
function trackAction(guildId, executorId, limit, windowMs) {
  const key = trackerKey(guildId, executorId);
  const now = Date.now();
  let rec = _actionTracker.get(key) || { count: 0, firstAt: now };

  if (now - rec.firstAt > windowMs) {
    rec = { count: 0, firstAt: now };
  }
  rec.count++;
  _actionTracker.set(key, rec);

  return rec.count > limit;
}

async function getExecutorFromAuditLog(guild, type) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return null;
    // نتجاهل لوجات قديمة (أكتر من 5 ثواني) عشان منطبقش على حدث مش بتاعه
    if (Date.now() - entry.createdTimestamp > 5_000) return null;
    return entry.executor;
  } catch {
    return null;
  }
}

async function punishExecutor(guild, executorId, punishment, reason, notifyOwner, logChannelId) {
  const member = await guild.members.fetch(executorId).catch(() => null);
  let action = "owner_report";

  try {
    if (punishment === "ban" && member?.bannable) {
      await guild.members.ban(executorId, { reason: `Anti-Nuke: ${reason}` });
      action = "ban";
    } else if (punishment === "timeout" && member?.manageable) {
      await member.timeout(60 * 60 * 1000, `Anti-Nuke: ${reason}`);
      action = "timeout";
    } else if (member?.kickable) {
      await member.kick(`Anti-Nuke: ${reason}`);
      action = "kick";
    }
  } catch {
    action = "owner_report";
  }

  await notifyOwner?.(executorId, member, `🛡️ Anti-Nuke: ${reason}`, 0).catch(() => {});

  if (logChannelId) {
    try {
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel?.isTextBased()) {
        const actionLabel = { ban: "🔨 باند", kick: "👢 طرد", timeout: "🔇 إسكات ساعة", owner_report: "🚨 بُلّغت الإدارة" }[action];
        await logChannel.send(
          `🛡️ **Anti-Nuke** — <@${executorId}> (\`${executorId}\`)\n` +
          `**السبب:** ${reason}\n**الإجراء:** ${actionLabel}`
        ).catch(() => {});
      }
    } catch {}
  }

  return action;
}

// ── نقطة دخول عامة لكل حدث خطير ────────────────────────────────
async function handleDangerousAction(guild, db, notifyOwner, { auditType, actionLabel }) {
  const settings = db.getAutoModSettings(guild.id);
  const antiNuke = settings.antiNuke;
  if (!antiNuke?.enabled) return;

  const executor = await getExecutorFromAuditLog(guild, auditType);
  if (!executor || executor.bot) return;
  if (isExempt(executor.id, guild)) return;
  if (settings.extraModRoles?.length) {
    // ✅ المشرفين اللي في رتب موثوقة زيادة (extraModRoles) بردو بيتفحصوا
    //   عادي — الاستثناء الوحيد هو الأونر وصاحب السيرفر والبوت.
  }

  const exceeded = trackAction(guild.id, executor.id, antiNuke.limit, antiNuke.windowMs);
  if (!exceeded) return;

  await punishExecutor(
    guild, executor.id, antiNuke.punishment,
    `تجاوز حد الأفعال الخطيرة (${actionLabel}) — ${antiNuke.limit}+ في ${Math.round(antiNuke.windowMs / 1000)} ثانية`,
    notifyOwner, settings.logChannelId
  );
}

export async function onRoleDelete(role, db, notifyOwner) {
  await handleDangerousAction(role.guild, db, notifyOwner, { auditType: AuditLogEvent.RoleDelete, actionLabel: "حذف رتبة" });
}

export async function onChannelDelete(channel, db, notifyOwner) {
  if (!channel.guild) return;
  await handleDangerousAction(channel.guild, db, notifyOwner, { auditType: AuditLogEvent.ChannelDelete, actionLabel: "حذف روم" });
}

export async function onGuildBanAdd(ban, db, notifyOwner) {
  await handleDangerousAction(ban.guild, db, notifyOwner, { auditType: AuditLogEvent.MemberBanAdd, actionLabel: "باند عضو" });
}

// طرد بيتفحص من guildMemberRemove — بس لازم نفرّق بينه وبين خروج طبيعي
export async function onPossibleKick(member, db, notifyOwner) {
  await handleDangerousAction(member.guild, db, notifyOwner, { auditType: AuditLogEvent.MemberKick, actionLabel: "طرد عضو" });
}
