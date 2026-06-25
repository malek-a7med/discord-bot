import { createCanvas, loadImage, registerFont } from 'canvas';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '../data/fonts');

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    registerFont(join(FONTS_DIR, 'Roboto-Bold.ttf'),    { family: 'Roboto', weight: 'bold' });
    registerFont(join(FONTS_DIR, 'Roboto-Regular.ttf'), { family: 'Roboto', weight: 'regular' });
    fontsRegistered = true;
  } catch {}
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
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) throw new Error('bad response');
    const buf = await res.buffer();
    return await sharp(buf).jpeg().toBuffer();
  } catch {
    return null;
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export async function generateMusicCard(song, currentTime = 0) {
  ensureFonts();
  try {
    const W = 1200, H = 400;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#141E30');
    bg.addColorStop(1, '#243B55');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const thumbSize = 280;
    const thumbX = 40, thumbY = (H - thumbSize) / 2;

    const thumbBuf = await getThumb(song.thumbnail);
    if (thumbBuf) {
      const img = await loadImage(thumbBuf);
      ctx.save();
      drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 18);
      ctx.clip();
      ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
      ctx.restore();
    } else {
      ctx.fillStyle = '#2c3e50';
      drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 18);
      ctx.fill();
      ctx.fillStyle = '#66FCF1';
      ctx.font = 'bold 60px Roboto';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎵', thumbX + thumbSize / 2, thumbY + thumbSize / 2);
      ctx.textAlign = 'left';
    }

    ctx.strokeStyle = '#66FCF1';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 18);
    ctx.stroke();

    const textX = thumbX + thumbSize + 40;
    const textW = W - textX - 40;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px Roboto';
    ctx.textBaseline = 'top';
    wrapTruncate(ctx, song.title || 'Unknown', textX, 50, textW, 48, 52);

    if (song.artist) {
      ctx.fillStyle = '#66FCF1';
      ctx.font = '26px Roboto';
      wrapTruncate(ctx, `🎤 ${song.artist}`, textX, 115, textW, 60, 32);
    }

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '22px Roboto';
    ctx.fillText(`طلب بواسطة: ${song.requestedBy || 'مجهول'}`, textX, 155);

    const totalTime = song.duration || 1;
    const barX = textX, barY = 215, barW = textW, barH = 24;

    ctx.fillStyle = '#3A3B3C';
    drawRoundedRect(ctx, barX, barY, barW, barH, 12);
    ctx.fill();

    const progress = Math.min(currentTime / totalTime, 1) * barW;
    if (progress > 0) {
      const pg = ctx.createLinearGradient(barX, 0, barX + progress, 0);
      pg.addColorStop(0, '#66FCF1');
      pg.addColorStop(1, '#45A29E');
      ctx.fillStyle = pg;
      drawRoundedRect(ctx, barX, barY, progress, barH, 12);
      ctx.fill();
    }

    ctx.fillStyle = '#C5C6C7';
    ctx.font = '20px Roboto';
    ctx.fillText(`${formatTime(currentTime)} / ${formatTime(totalTime)}`, barX, barY + barH + 12);

    const platEmojis = { spotify: '🟢 Spotify', youtube: '🔴 YouTube', soundcloud: '🟠 SoundCloud', direct: '🔗 رابط مباشر' };
    const platText = platEmojis[song.platform] || '🎵 موسيقى';
    ctx.fillText(platText, barX + barW - 160, barY + barH + 12);

    ctx.strokeStyle = '#66FCF1';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, 15, 15, W - 30, H - 30, 20);
    ctx.stroke();

    return canvas.toBuffer('image/png');
  } catch (err) {
    console.error('❌ [MusicCard] فشل توليد البطاقة:', err.message);
    return null;
  }
}
