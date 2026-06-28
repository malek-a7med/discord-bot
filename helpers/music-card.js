// ════════════════════════════════════════════════════════════════
//  Music Card Generator — بوت زنجي
//  مبني على Wick Player، معدّل ومنسوب لـ 𝒎𝒂𝒍𝒆𝒌
// ════════════════════════════════════════════════════════════════

import pkg from '@napi-rs/canvas';
const { createCanvas, loadImage, registerFont } = pkg;
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
const FONTS_DIR = join(__dirname, '..', 'data', 'fonts');

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
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
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

function wrapTruncate(ctx, text, x, y, maxW, maxChars, lineH) {
  if (text.length > maxChars) text = text.slice(0, maxChars - 3) + '...';
  const words = text.split(' ');
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxW && i > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[i] + ' ';
      y += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

async function getThumb(url) {
  try {
    if (!url) throw new Error('no url');
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) throw new Error('bad response');
    const buf = await res.buffer();
    return await sharp(buf).jpeg().toBuffer();
  } catch {
    return null;
  }
}

const BG_IMAGE_PATH = join(__dirname, '..', 'data', 'music-bg.png');
let _cachedBg = null;
let _cachedBgMtime = 0;
async function loadBgImage() {
  try {
    const { mtimeMs } = await import('fs').then(f => f.promises.stat(BG_IMAGE_PATH));
    if (_cachedBg && _cachedBgMtime === mtimeMs) return _cachedBg;
    _cachedBg = await loadImage(BG_IMAGE_PATH);
    _cachedBgMtime = mtimeMs;
    return _cachedBg;
  } catch {
    return null;
  }
}

async function generateMusicCard(song, currentTime = 0, queue = null) {
  ensureFonts();
  try {
    const W = 1200, H = 500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.antialias = 'subpixel';

    // خلفية — صورة مخصصة أو gradient احتياطي
    const bgImg = await loadBgImage();
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, W, H);
      // طبقة شفافية داكنة فوق الصورة عشان النص يبان
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#141E30');
      bg.addColorStop(1, '#243B55');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    // صورة مصغرة
    const thumbSize = 300;
    const thumbX = 50, thumbY = (H - thumbSize) / 2;
    const thumbBuf = await getThumb(song.thumbnail);

    if (thumbBuf) {
      const img = await loadImage(thumbBuf);
      ctx.save();
      drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 20);
      ctx.clip();
      ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
      ctx.restore();
    } else {
      ctx.fillStyle = '#2c3e50';
      drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 20);
      ctx.fill();
    }

    // إطار الصورة
    ctx.strokeStyle = '#66FCF1';
    ctx.lineWidth = 5;
    drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 20);
    ctx.stroke();

    const textX = thumbX + thumbSize + 40;
    const textW = W - textX - 40;

    // اسم الأغنية — DisTube بيستخدم song.name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 50px Roboto';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    wrapTruncate(ctx, song.name || song.title || 'أغنية', textX, 50, textW, 50, 60);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // طالب الأغنية
    ctx.fillStyle = '#66FCF1';
    ctx.font = '28px Roboto';
    const requester = song.user ? `طلبها: ${song.user.username}` : '';
    if (requester) wrapTruncate(ctx, requester, textX, 290, textW, 40, 35);

    // شريط التقدم
    const totalTime = song.duration || 1;
    const barX = textX, barY = 330, barW = textW, barH = 30;

    ctx.fillStyle = '#3A3B3C';
    drawRoundedRect(ctx, barX, barY, barW, barH, 15);
    ctx.fill();

    const progress = Math.min(currentTime / totalTime, 1) * barW;
    if (progress > 0) {
      const pg = ctx.createLinearGradient(barX, 0, barX + progress, 0);
      pg.addColorStop(0, '#66FCF1');
      pg.addColorStop(1, '#45A29E');
      ctx.fillStyle = pg;
      drawRoundedRect(ctx, barX, barY, Math.max(progress, 2), barH, 15);
      ctx.fill();
    }

    // وقت
    ctx.fillStyle = '#C5C6C7';
    ctx.font = '20px Roboto';
    ctx.fillText(`${formatTime(currentTime)} / ${formatTime(totalTime)}`, barX, barY + barH + 10);

    // صوت وتكرار
    if (queue) {
      const repeatLabel = queue.repeatMode === 0 ? 'إيقاف' : queue.repeatMode === 1 ? 'تكرار أغنية' : 'تكرار قائمة';
      ctx.fillText(`🔊 ${queue.volume}%`, barX, barY + barH + 38);
      ctx.fillText(`🔁 ${repeatLabel}`, barX + 200, barY + barH + 38);
    }

    // إطار خارجي
    ctx.strokeStyle = '#66FCF1';
    ctx.lineWidth = 5;
    drawRoundedRect(ctx, 20, 20, W - 40, H - 40, 25);
    ctx.stroke();

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
    new ButtonBuilder().setLabel('🔗 افتح في Spotify').setStyle(ButtonStyle.Link).setURL(song.url || 'https://open.spotify.com'),
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

    // تحديث كل 5 ثواني عشان منضغطش على Discord API
    const interval = setInterval(async () => {
      try {
        if (!queue || queue.paused || queue.destroyed || !queue.currentMessage) {
          clearInterval(interval);
          return;
        }
        currentTime = Math.floor(queue.currentTime || 0);
        const total = song.duration || 1;
        if (currentTime > total) currentTime = total;

        const updated = await generateMusicCard(song, currentTime, queue);
        if (!updated) { clearInterval(interval); return; }

        await queue.currentMessage.edit({
          files: [new AttachmentBuilder(updated, { name: 'musiccard.png' })],
          components: rows,
        });

        if (currentTime >= total) clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 5000);

  } catch (e) {
    console.error('❌ [MusicCard] خطأ في إرسال الكارت:', e.message);
  }
}
