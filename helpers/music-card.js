// ════════════════════════════════════════════════════════════════
//  Music Card — بوت زنجي | ثيم الفراعنة
//  @napi-rs/canvas — أسرع وأثبت من canvas العادي
// ════════════════════════════════════════════════════════════════
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR  = path.join(__dirname, "..", "data", "fonts");
const BG_PATH    = path.join(__dirname, "..", "data", "music-bg.png");

// ── تسجيل الفونتس ────────────────────────────────────────────
let fontsLoaded = false;
function ensureFonts() {
  if (fontsLoaded) return;
  try {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Roboto-Bold.ttf"),    "RobotoBold");
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Roboto-Regular.ttf"), "Roboto");
    fontsLoaded = true;
  } catch {}
}

// ── ألوان ثيم الفراعنة ───────────────────────────────────────
const C = {
  gold:       "#C9A227",
  gold_dim:   "rgba(201,162,39,0.75)",
  purple:     "#9333EA",
  purple_glow:"rgba(147,51,234,0.8)",
  white:      "#FFFFFF",
  gray:       "rgba(255,255,255,0.65)",
  bar_bg:     "rgba(255,255,255,0.12)",
};

// ── تنسيق الوقت ──────────────────────────────────────────────
function fmt(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── قطع النص لو طويل ─────────────────────────────────────────
function truncate(ctx, text, maxW) {
  if (!text) return "";
  while (ctx.measureText(text).width > maxW && text.length > 3) {
    text = text.slice(0, -4) + "…";
  }
  return text;
}

// ── تحميل خلفية السيرفر (مرة واحدة) ─────────────────────────
let _bgImg = null;
let _bgMtime = 0;
async function getBg() {
  try {
    const { statSync } = await import('fs');
    const mtime = statSync(BG_PATH).mtimeMs;
    if (_bgImg && mtime === _bgMtime) return _bgImg;
    _bgImg = await loadImage(readFileSync(BG_PATH));
    _bgMtime = mtime;
    return _bgImg;
  } catch { return null; }
}

// ── توليد الكارت ─────────────────────────────────────────────
async function generateCard(song, currentTime = 0, queue = null) {
  ensureFonts();
  const W = 1100, H = 380;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── خلفية: صورة السيرفر ──────────────────────────────────
  const bg = await getBg();
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    const fb = ctx.createLinearGradient(0, 0, W, H);
    fb.addColorStop(0, "#0a0010");
    fb.addColorStop(1, "#1a003a");
    ctx.fillStyle = fb;
    ctx.fillRect(0, 0, W, H);
  }

  // طبقة تعتيم تدريجية
  const ov = ctx.createLinearGradient(0, 0, W, 0);
  ov.addColorStop(0,   "rgba(0,0,0,0.92)");
  ov.addColorStop(0.45,"rgba(0,0,0,0.80)");
  ov.addColorStop(0.75,"rgba(0,0,0,0.55)");
  ov.addColorStop(1,   "rgba(0,0,0,0.28)");
  ctx.fillStyle = ov;
  ctx.fillRect(0, 0, W, H);

  // ── إطار ذهبي ────────────────────────────────────────────
  ctx.strokeStyle = C.gold;
  ctx.lineWidth   = 3.5;
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, 20);
  ctx.stroke();

  // خط داخلي خفيف
  ctx.strokeStyle = "rgba(201,162,39,0.25)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 16);
  ctx.stroke();

  // ── صورة الأغنية (دائرة) ─────────────────────────────────
  const R  = 145;
  const CX = 55 + R;
  const CY = H / 2;

  // توهج بنفسجي
  ctx.save();
  ctx.shadowColor = C.purple_glow;
  ctx.shadowBlur  = 35;
  ctx.strokeStyle = C.purple;
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.arc(CX, CY, R + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // صورة مقصوصة دائرية
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.clip();
  try {
    const thumb = await loadImage(song.thumbnail);
    ctx.drawImage(thumb, CX - R, CY - R, R * 2, R * 2);
  } catch {
    ctx.fillStyle = "#1a003a";
    ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
    ctx.font = `bold ${R}px sans-serif`;
    ctx.fillStyle = C.purple;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", CX, CY);
  }
  ctx.restore();

  // إطار ذهبي الدائرة
  ctx.strokeStyle = C.gold;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.stroke();

  // ── النصوص ───────────────────────────────────────────────
  const TX  = CX + R + 45;
  const TW  = W - TX - 30;
  ctx.textBaseline = "top";
  ctx.textAlign    = "left";

  // شارة "يشتغل دلوقتي"
  ctx.fillStyle = "rgba(147,51,234,0.25)";
  ctx.beginPath();
  ctx.roundRect(TX, 34, 175, 28, 8);
  ctx.fill();
  ctx.font      = "bold 13px Roboto";
  ctx.fillStyle = "#C084FC";
  ctx.fillText("▶  يشتغل دلوقتي", TX + 10, 44);

  // اسم الأغنية
  ctx.font = "bold 40px RobotoBold";
  ctx.fillStyle   = C.white;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 10;
  ctx.fillText(truncate(ctx, song.name || song.title || "أغنية", TW), TX, 82);
  ctx.shadowBlur  = 0;

  // اسم الفنان
  const artist = song.uploader?.name || song.artist || "";
  if (artist) {
    ctx.font      = "22px Roboto";
    ctx.fillStyle = C.gold;
    ctx.fillText(truncate(ctx, artist, TW), TX, 134);
  }

  // خط فاصل ذهبي
  ctx.strokeStyle = "rgba(201,162,39,0.4)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(TX, 166);
  ctx.lineTo(W - 30, 166);
  ctx.stroke();

  // ── شريط التقدم ──────────────────────────────────────────
  const total    = Math.max(song.duration || 1, 1);
  const elapsed  = Math.min(currentTime || 0, total);
  const progress = elapsed / total;
  const BX = TX, BY = 188, BW = TW, BH = 16;

  // خلفية الشريط
  ctx.fillStyle = C.bar_bg;
  ctx.beginPath();
  ctx.roundRect(BX, BY, BW, BH, BH / 2);
  ctx.fill();

  // الجزء المكتمل
  const fillW = Math.max(progress * BW, BH);
  const pg = ctx.createLinearGradient(BX, 0, BX + fillW, 0);
  pg.addColorStop(0, "#7E22CE");
  pg.addColorStop(0.6, "#A855F7");
  pg.addColorStop(1, C.gold);
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(BX, BY, fillW, BH, BH / 2);
  ctx.fill();

  // نقطة المؤشر
  if (progress > 0.01) {
    ctx.fillStyle   = C.white;
    ctx.shadowColor = C.gold;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(BX + fillW, BY + BH / 2, BH * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  // أوقات
  ctx.font      = "18px Roboto";
  ctx.fillStyle = C.gray;
  ctx.textAlign = "left";
  ctx.fillText(fmt(elapsed), BX, BY + BH + 14);
  ctx.textAlign = "right";
  ctx.fillText(fmt(total), BX + BW, BY + BH + 14);
  ctx.textAlign = "left";

  // ── معلومات إضافية ───────────────────────────────────────
  const infoY = BY + BH + 50;
  ctx.font = "17px Roboto";

  const reqUser = song.user?.username || song.user?.tag || "";
  if (reqUser) {
    ctx.fillStyle = C.gold_dim;
    ctx.fillText(`👑 طلبها: ${reqUser}`, BX, infoY);
  }

  if (queue) {
    const repeatLabel = queue.repeatMode === 0 ? "—" : queue.repeatMode === 1 ? "🔂 أغنية" : "🔁 قائمة";
    ctx.fillStyle = "rgba(201,162,39,0.6)";
    ctx.fillText(`🔊 ${queue.volume}%   ${repeatLabel}`, BX + (reqUser ? 280 : 0), infoY);
    if ((queue.songs?.length || 0) > 1) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(`${queue.songs.length} أغنية في القائمة`, BX + (reqUser ? 470 : 280), infoY);
    }
  }

  return canvas.encode("png"); // async → Buffer
}

// ── أزرار التحكم ─────────────────────────────────────────────
function buildRows(song) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music_pause") .setLabel("⏸ وقف")     .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_resume").setLabel("▶️ كمل")    .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("music_skip")  .setLabel("⏭️ التالية").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_stop")  .setLabel("⏹️ اطلع")  .setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_lyrics").setLabel("📝 كلمات")  .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music_vol_up")  .setLabel("🔊+")           .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_vol_down").setLabel("🔉-")           .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_repeat")  .setLabel("🔁 تكرار")     .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("🔗 افتح في Spotify")
      .setStyle(ButtonStyle.Link)
      .setURL(
        song.url && song.url.startsWith("http") && !/youtube|soundcloud/i.test(song.url)
          ? song.url
          : "https://open.spotify.com",
      ),
  );
  return [row1, row2];
}

// ── الدالة المُصدَّرة ─────────────────────────────────────────
export async function sendMusicCard(queue, song, textChannel) {
  try {
    const buf  = await generateCard(song, 0, queue);
    const rows = buildRows(song);

    const msg = await textChannel.send({
      files: [new AttachmentBuilder(buf, { name: "musiccard.png" })],
      components: rows,
    });

    queue.currentMessage = msg;
    queue.initiatorId    = song.user?.id;

    // تحديث شريط التقدم كل 10 ثواني
    const interval = setInterval(async () => {
      try {
        if (!queue || queue.destroyed || !queue.currentMessage) {
          clearInterval(interval);
          return;
        }
        if (queue.paused) return; // خلي الـ interval يكمل، بس ما تعدّلش لو موقف

        const elapsed = Math.floor(queue.currentTime || 0);
        const total   = Math.max(song.duration || 1, 1);
        if (elapsed > total) { clearInterval(interval); return; }

        const updated = await generateCard(song, elapsed, queue);
        await queue.currentMessage.edit({
          files: [new AttachmentBuilder(updated, { name: "musiccard.png" })],
          components: rows,
        });

        if (elapsed >= total) clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 10_000);

  } catch (e) {
    console.error("❌ [MusicCard]", e.message);
    // fallback embed بسيط لو الكارت فشل
    try {
      const elapsed = queue?.currentTime || 0;
      const total   = song?.duration    || 0;
      const { EmbedBuilder } = await import("discord.js");
      await textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9B30FF)
            .setTitle(`🎵 ${song.name || "أغنية"}`)
            .setThumbnail(song.thumbnail || null)
            .addFields(
              { name: "🎤 الفنان", value: song.uploader?.name || "—", inline: true },
              { name: "⏱️ الوقت",  value: `${fmt(elapsed)} / ${fmt(total)}`, inline: true },
              { name: "👑 طلبها",  value: song.user?.username || "—", inline: true },
            )
            .setFooter({ text: "✨ سيرفر الفراعنة 👑" }),
        ],
      });
    } catch {}
  }
}
