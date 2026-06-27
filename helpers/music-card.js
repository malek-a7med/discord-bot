// ════════════════════════════════════════════════════════════════
//  Music Card — بوت زنجي | ثيم الفراعنة
//  Canvas-based music now-playing card
// ════════════════════════════════════════════════════════════════
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ألوان الثيم ────────────────────────────────────────────────
const COLORS = {
  bg_dark:    "#0a0010",
  bg_card:    "#12001f",
  purple_neon:"#9B30FF",
  purple_mid: "#6a0dad",
  purple_glow:"#bf7fff",
  gold:       "#FFD700",
  gold_dim:   "#b8960c",
  white:      "#ffffff",
  gray:       "#aaaaaa",
  bar_bg:     "#2a0040",
  bar_fill:   "#9B30FF",
};

// ── رسم progress bar ───────────────────────────────────────────
function drawProgressBar(ctx, x, y, width, height, progress) {
  // خلفية البار
  ctx.fillStyle = COLORS.bar_bg;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();

  // fill
  const fillWidth = Math.max(height, width * Math.min(progress, 1));
  const grad = ctx.createLinearGradient(x, 0, x + fillWidth, 0);
  grad.addColorStop(0, COLORS.purple_mid);
  grad.addColorStop(1, COLORS.purple_neon);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, fillWidth, height, height / 2);
  ctx.fill();

  // نقطة المؤشر
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(x + fillWidth, y + height / 2, height * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

// ── تحويل ثانية لـ mm:ss ──────────────────────────────────────
function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── رسم نص مع truncate ────────────────────────────────────────
function drawText(ctx, text, x, y, maxWidth, font, color, align = "left") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  const measured = ctx.measureText(text);
  if (measured.width > maxWidth) {
    while (text.length > 1 && ctx.measureText(text + "…").width > maxWidth) {
      text = text.slice(0, -1);
    }
    text += "…";
  }
  ctx.fillText(text, x, y);
}

// ── الدالة الرئيسية ───────────────────────────────────────────
export async function sendMusicCard(queue, song, textChannel) {
  try {
    const W = 900, H = 280;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // ── خلفية الكارت ──────────────────────────────────────────
    // gradient نيون بنفسجي
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   "#0a0010");
    bgGrad.addColorStop(0.5, "#130020");
    bgGrad.addColorStop(1,   "#0a0010");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 20);
    ctx.fill();

    // توهج بنفسجي في الزوايا
    const glowLeft = ctx.createRadialGradient(0, H / 2, 0, 0, H / 2, 250);
    glowLeft.addColorStop(0,   "rgba(155,48,255,0.35)");
    glowLeft.addColorStop(1,   "rgba(155,48,255,0)");
    ctx.fillStyle = glowLeft;
    ctx.fillRect(0, 0, W, H);

    const glowRight = ctx.createRadialGradient(W, H / 2, 0, W, H / 2, 200);
    glowRight.addColorStop(0,   "rgba(255,215,0,0.15)");
    glowRight.addColorStop(1,   "rgba(255,215,0,0)");
    ctx.fillStyle = glowRight;
    ctx.fillRect(0, 0, W, H);

    // إطار بنفسجي
    ctx.strokeStyle = COLORS.purple_neon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, W - 2, H - 2, 20);
    ctx.stroke();

    // ── صورة الأغنية (الغلاف) ─────────────────────────────────
    const thumbSize = 200;
    const thumbX    = 30;
    const thumbY    = (H - thumbSize) / 2;
    const thumbUrl  = song.thumbnail || null;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 14);
    ctx.clip();

    if (thumbUrl) {
      try {
        const img = await loadImage(thumbUrl);
        ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
      } catch {
        // fallback لو فشل تحميل الصورة
        ctx.fillStyle = COLORS.bg_card;
        ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
        ctx.font = "bold 60px sans-serif";
        ctx.fillStyle = COLORS.purple_neon;
        ctx.textAlign = "center";
        ctx.fillText("🎵", thumbX + thumbSize / 2, thumbY + thumbSize / 2 + 20);
      }
    } else {
      ctx.fillStyle = COLORS.bg_card;
      ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
      ctx.font = "bold 60px sans-serif";
      ctx.fillStyle = COLORS.purple_neon;
      ctx.textAlign = "center";
      ctx.fillText("🎵", thumbX + thumbSize / 2, thumbY + thumbSize / 2 + 20);
    }
    ctx.restore();

    // إطار ذهبي حول الصورة
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 14);
    ctx.stroke();

    // ── النصوص ────────────────────────────────────────────────
    const textX = thumbX + thumbSize + 30;
    const textW = W - textX - 30;

    // شارة "يشتغل دلوقتي"
    ctx.fillStyle = COLORS.purple_neon + "33";
    ctx.beginPath();
    ctx.roundRect(textX, 28, 160, 28, 8);
    ctx.fill();
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = COLORS.purple_glow;
    ctx.textAlign = "left";
    ctx.fillText("▶  يشتغل دلوقتي", textX + 10, 47);

    // اسم الأغنية
    drawText(
      ctx,
      song.name || "أغنية مجهولة",
      textX, 98, textW,
      "bold 26px sans-serif",
      COLORS.white, "left"
    );

    // اسم القناة / الفنان
    drawText(
      ctx,
      song.uploader?.name || "فنان مجهول",
      textX, 128, textW,
      "16px sans-serif",
      COLORS.gray, "left"
    );

    // خط فاصل ذهبي
    ctx.strokeStyle = COLORS.gold_dim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(textX, 145);
    ctx.lineTo(W - 30, 145);
    ctx.stroke();

    // ── Progress Bar ───────────────────────────────────────────
    const barY    = 165;
    const barH    = 8;
    const barW    = textW;

    const elapsed  = queue.currentTime || 0;
    const total    = song.duration    || 1;
    const progress = elapsed / total;

    drawProgressBar(ctx, textX, barY, barW, barH, progress);

    // الأوقات
    ctx.font = "14px sans-serif";
    ctx.fillStyle = COLORS.gray;
    ctx.textAlign = "left";
    ctx.fillText(formatTime(elapsed), textX, barY + barH + 22);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(total), textX + barW, barY + barH + 22);

    // ── من طلبها + المصدر ──────────────────────────────────────
    const reqBy = song.user?.username || song.user?.tag || "مجهول";
    ctx.font = "14px sans-serif";
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = "left";
    ctx.fillText(`👑 طلبها: ${reqBy}`, textX, barY + barH + 55);

    const sourceIcon =
      /spotify/i.test(song.url)     ? "🟢 Spotify"   :
      /youtube|youtu/i.test(song.url) ? "🔴 YouTube"   :
      /soundcloud/i.test(song.url)  ? "🟠 SoundCloud":
                                       "🎵 موسيقى";
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.gray;
    ctx.fillText(sourceIcon, textX + barW, barY + barH + 55);

    // ── إرسال الكارت ──────────────────────────────────────────
    const buffer     = canvas.toBuffer("image/png");
    const attachment = new AttachmentBuilder(buffer, { name: "music-card.png" });

    const embed = new EmbedBuilder()
      .setColor(0x9B30FF)
      .setImage("attachment://music-card.png")
      .setFooter({ text: `✨ سيرفر الفراعنة 👑 | ${queue.songs.length > 1 ? `${queue.songs.length - 1} أغنية في الانتظار` : "آخر أغنية"}` });

    const msg = await textChannel.send({ embeds: [embed], files: [attachment] });
    return msg;

  } catch (err) {
    console.error("❌ [MusicCard] خطأ في توليد الكارت:", err.message);
    // fallback بسيط بدون canvas
    try {
      const elapsed = queue.currentTime || 0;
      const total   = song.duration    || 0;
      const embed = new EmbedBuilder()
        .setColor(0x9B30FF)
        .setTitle(`🎵 ${song.name || "أغنية"}`)
        .setThumbnail(song.thumbnail || null)
        .addFields(
          { name: "🎤 الفنان",  value: song.uploader?.name || "مجهول", inline: true },
          { name: "⏱️ الوقت",  value: `${formatTime(elapsed)} / ${formatTime(total)}`, inline: true },
          { name: "👑 طلبها",  value: song.user?.username || "مجهول", inline: true }
        )
        .setFooter({ text: "✨ سيرفر الفراعنة 👑" });
      return await textChannel.send({ embeds: [embed] });
    } catch { /* صمت تام */ }
  }
}
