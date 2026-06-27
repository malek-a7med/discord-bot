// ════════════════════════════════════════════════════════════════
//  Music Card Generator — بوت زنجي
//  تصميم فراعنة — خلفية السيرفر + ألوان بنفسجي/ذهبي
// ════════════════════════════════════════════════════════════════

import { createCanvas, loadImage, registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';
import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR  = join(__dirname, '..', 'data', 'fonts');
const BG_PATH    = join(__dirname, '..', 'data', 'music-bg.png');

// ─── الكارد الأبعاد ───────────────────────────────────────────
const W = 1200, H = 420;

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    registerFont(join(FONTS_DIR, 'Roboto-Bold.ttf'),    { family: 'Roboto', weight: 'bold' });
    registerFont(join(FONTS_DIR, 'Roboto-Regular.ttf'), { family: 'Roboto', weight: 'regular' });
    registerFont(join(FONTS_DIR, 'Roboto-Italic.ttf'),  { family: 'Roboto', weight: 'italic' });
    fontsRegistered = true;
  } catch (e) {
    console.error('❌ [MusicCard] خطأ في الفونتس:', e.message);
  }
}

function formatTime(sec) {
  const m = Math.floor((sec || 0) / 60);
  const s = Math.floor((sec || 0) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// رسم دائرة مقصوصة
function drawCircleClip(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

// نص مع قطع لو طويل
function truncate(ctx, text, maxW) {
  if (!text) return '';
  while (ctx.measureText(text).width > maxW && text.length > 3) {
    text = text.slice(0, -4) + '...';
  }
  return text;
}

async function getThumb(url) {
  try {
    if (!url) throw new Error('no url');
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) throw new Error('bad response');
    const buf = await res.buffer();
    return await sharp(buf).resize(300, 300, { fit: 'cover' }).jpeg().toBuffer();
  } catch {
    return null;
  }
}

// تحميل صورة الخلفية مرة واحدة
let cachedBg = null;
async function loadBg() {
  if (cachedBg) return cachedBg;
  try {
    const buf = await sharp(BG_PATH)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90 })
      .toBuffer();
    cachedBg = buf;
    return buf;
  } catch {
    return null;
  }
}

async function generateMusicCard(song, currentTime = 0, queue = null) {
  ensureFonts();
  try {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.antialias = 'subpixel';

    // ── الخلفية ──────────────────────────────────────────────
    const bgBuf = await loadBg();
    if (bgBuf) {
      const bgImg = await loadImage(bgBuf);
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      // fallback gradient
      const fallback = ctx.createLinearGradient(0, 0, W, H);
      fallback.addColorStop(0, '#0d0015');
      fallback.addColorStop(1, '#1a003a');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, W, H);
    }

    // طبقة غامقة فوق الخلفية عشان النصوص تظهر
    const overlay = ctx.createLinearGradient(0, 0, W, 0);
    overlay.addColorStop(0,   'rgba(0,0,0,0.88)');
    overlay.addColorStop(0.4, 'rgba(0,0,0,0.78)');
    overlay.addColorStop(0.7, 'rgba(0,0,0,0.55)');
    overlay.addColorStop(1,   'rgba(0,0,0,0.30)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    // ── إطار خارجي ذهبي ──────────────────────────────────────
    ctx.strokeStyle = '#C9A227';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, 10, 10, W - 20, H - 20, 22);
    ctx.stroke();

    // خط ذهبي داخلي خفيف
    ctx.strokeStyle = 'rgba(201,162,39,0.3)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 16, 16, W - 32, H - 32, 18);
    ctx.stroke();

    // ── صورة الأغنية (دائرة) ─────────────────────────────────
    const thumbR = 160;
    const thumbCX = 60 + thumbR;
    const thumbCY = H / 2;
    const thumbBuf = await getThumb(song.thumbnail);

    // ظل/توهج بنفسجي خلف الدائرة
    ctx.save();
    ctx.shadowColor = 'rgba(147,51,234,0.8)';
    ctx.shadowBlur = 40;
    ctx.strokeStyle = '#9333EA';
    ctx.lineWidth = 5;
    drawCircleClip(ctx, thumbCX, thumbCY, thumbR + 5);
    ctx.stroke();
    ctx.restore();

    // الدائرة نفسها
    ctx.save();
    drawCircleClip(ctx, thumbCX, thumbCY, thumbR);
    ctx.clip();
    if (thumbBuf) {
      const img = await loadImage(thumbBuf);
      ctx.drawImage(img, thumbCX - thumbR, thumbCY - thumbR, thumbR * 2, thumbR * 2);
    } else {
      // fallback لو مفيش صورة
      const grad = ctx.createRadialGradient(thumbCX, thumbCY, 0, thumbCX, thumbCY, thumbR);
      grad.addColorStop(0, '#3B0764');
      grad.addColorStop(1, '#1a003a');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.fillStyle = 'rgba(201,162,39,0.5)';
      ctx.font = `bold ${thumbR}px Roboto`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', thumbCX, thumbCY);
    }
    ctx.restore();

    // إطار الدائرة
    ctx.strokeStyle = '#C9A227';
    ctx.lineWidth = 4;
    drawCircleClip(ctx, thumbCX, thumbCY, thumbR);
    ctx.stroke();

    // ── النصوص ───────────────────────────────────────────────
    const textX  = thumbCX + thumbR + 50;
    const textW  = W - textX - 40;
    ctx.textBaseline = 'top';

    // اسم الأغنية
    ctx.font = 'bold 46px Roboto';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12;
    const songTitle = truncate(ctx, song.name || song.title || 'أغنية', textW);
    ctx.fillText(songTitle, textX, 60);
    ctx.shadowBlur = 0;

    // اسم الفنان / الرافع
    const artistName = song.uploader?.name || song.artist || '';
    if (artistName) {
      ctx.font = '28px Roboto';
      ctx.fillStyle = '#C9A227';
      ctx.fillText(truncate(ctx, artistName, textW), textX, 118);
    }

    // طلبها
    const requester = song.user?.username ? `طلبها: ${song.user.username}` : '';
    if (requester) {
      ctx.font = '24px Roboto';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(requester, textX, artistName ? 158 : 118);
    }

    // ── شريط التقدم ───────────────────────────────────────────
    const totalTime = Math.max(song.duration || 1, 1);
    const barX = textX, barY = H - 130, barW = textW, barH = 22;

    // خلفية الشريط
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawRoundedRect(ctx, barX, barY, barW, barH, 11);
    ctx.fill();

    // الجزء المكتمل
    const progress = Math.min(currentTime / totalTime, 1) * barW;
    if (progress > 2) {
      const pg = ctx.createLinearGradient(barX, 0, barX + progress, 0);
      pg.addColorStop(0, '#9333EA');
      pg.addColorStop(0.5, '#C084FC');
      pg.addColorStop(1, '#C9A227');
      ctx.fillStyle = pg;
      drawRoundedRect(ctx, barX, barY, Math.max(progress, 4), barH, 11);
      ctx.fill();

      // نقطة التقدم
      const dotX = barX + progress;
      ctx.beginPath();
      ctx.arc(dotX, barY + barH / 2, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#C9A227';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // الوقت
    ctx.font = '22px Roboto';
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(formatTime(currentTime), barX, barY + barH + 12);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(totalTime), barX + barW, barY + barH + 12);
    ctx.textAlign = 'left';

    // ── معلومات إضافية (صوت / تكرار) ─────────────────────────
    if (queue) {
      const repeatLabel = queue.repeatMode === 0 ? 'لا تكرار' : queue.repeatMode === 1 ? '🔂 أغنية' : '🔁 قائمة';
      ctx.font = '20px Roboto';
      ctx.fillStyle = 'rgba(201,162,39,0.85)';
      ctx.fillText(`🔊 ${queue.volume}%`, barX, barY + barH + 44);
      ctx.fillText(repeatLabel, barX + 160, barY + barH + 44);
      if (queue.songs?.length > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(`${queue.songs.length} أغنية في القائمة`, barX + 320, barY + barH + 44);
      }
    }

    return canvas.toBuffer('image/png');
  } catch (e) {
    console.error('❌ [MusicCard] خطأ في إنشاء الكارت:', e.message);
    return null;
  }
}

function buildMusicRows(song) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_pause').setLabel('⏸ وقف').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_resume').setLabel('▶️ كمل').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music_skip').setLabel('⏭️ التالية').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ اطلع').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_lyrics').setLabel('📝 كلمات').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_vol_up').setLabel('🔊+').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_vol_down').setLabel('🔉-').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_repeat').setLabel('🔁 تكرار').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🔗 افتح في Spotify')
      .setStyle(ButtonStyle.Link)
      .setURL(
        song.url && song.url.startsWith('http') && !song.url.includes('youtube') && !song.url.includes('soundcloud')
          ? song.url
          : 'https://open.spotify.com',
      ),
  );
  return [row1, row2];
}

export async function sendMusicCard(queue, song, textChannel) {
  try {
    let currentTime = 0;

    const cardBuf = await generateMusicCard(song, currentTime, queue);
    if (!cardBuf) return;
    if (!textChannel?.send) return;

    const rows = buildMusicRows(song);
    const msg = await textChannel.send({
      files: [new AttachmentBuilder(cardBuf, { name: 'musiccard.png' })],
      components: rows,
    });

    queue.currentMessage = msg;
    queue.initiatorId = song.user?.id;

    // تحديث كل 5 ثواني
    const interval = setInterval(async () => {
      try {
        // لو الـ queue اتدمر أو الرسالة اتمسحت — وقف الـ interval
        if (!queue || queue.destroyed || !queue.currentMessage) {
          clearInterval(interval);
          return;
        }
        // لو موقف مؤقتاً — خليه يكمل في التيك الجاي (لا توقف الـ interval)
        if (queue.paused) return;

        currentTime = Math.floor(queue.currentTime || 0);
        const total = Math.max(song.duration || 1, 1);
        if (currentTime > total) currentTime = total;

        const updated = await generateMusicCard(song, currentTime, queue);
        if (!updated) { clearInterval(interval); return; }

        await queue.currentMessage.edit({
          files: [new AttachmentBuilder(updated, { name: 'musiccard.png' })],
          components: rows,
        });

        // وصل لنهاية الأغنية — DisTube هيعدي للتالية، الـ playSong event هيعمل clearInterval
        if (currentTime >= total) clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 5000);

  } catch (e) {
    console.error('❌ [MusicCard] خطأ في إرسال الكارت:', e.message);
  }
}
