#!/usr/bin/env node
/**
 * 🧪 Music Streaming Test
 * شغّل السكربت ده على Replit عشان تشخّص المشكلة بدون Discord
 *
 * الاستخدام:
 *   node test-music.js "https://open.spotify.com/playlist/2Lq31XhOuloBud5uDXdN2V3"
 *   node test-music.js "https://www.youtube.com/watch?v=..."
 *   node test-music.js "https://soundcloud.com/artist/track"
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const url = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// ألوان
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';

function log(emoji, color, msg) {
  console.log(`${color}${emoji} ${msg}${NC}`);
}

function header(text) {
  console.log('');
  console.log(`${CYAN}════════════════════════════════════════════════════════${NC}`);
  console.log(`${CYAN}  ${text}${NC}`);
  console.log(`${CYAN}════════════════════════════════════════════════════════${NC}`);
}

// ─────────────────────────────────────────────
// 1) فحص yt-dlp
// ─────────────────────────────────────────────
header('1️⃣  فحص yt-dlp');
const candidates = [
  '/home/runner/workspace/.pythonlibs/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp'
];
let ytDlp = null;
for (const p of candidates) {
  if (existsSync(p)) { ytDlp = p; break; }
}
if (!ytDlp) {
  try {
    ytDlp = execSync('which yt-dlp', { encoding: 'utf8' }).trim();
  } catch {}
}

if (!ytDlp) {
  log('❌', RED, 'yt-dlp مش موجود! شغّل: pip install -U yt-dlp');
  process.exit(1);
}

try {
  const ver = execSync(`${ytDlp} --version`, { encoding: 'utf8' }).trim();
  log('✅', GREEN, `yt-dlp: ${ytDlp} (v${ver})`);
} catch (e) {
  log('❌', RED, `yt-dlp مش شغال: ${e.message}`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// 2) فحص YOUTUBE_COOKIES
// ─────────────────────────────────────────────
header('2️⃣  فحص YOUTUBE_COOKIES');

let cookiesPath = null;
if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.length > 0) {
  cookiesPath = '/tmp/yt-cookies-test.txt';
  const normalized = process.env.YOUTUBE_COOKIES.includes('\\n')
    ? process.env.YOUTUBE_COOKIES.replace(/\\n/g, '\n')
    : process.env.YOUTUBE_COOKIES;
  writeFileSync(cookiesPath, normalized, 'utf8');
  log('✅', GREEN, `YOUTUBE_COOKIES: ${process.env.YOUTUBE_COOKIES.length} حرف -> ${cookiesPath}`);
} else if (existsSync('./cookies.txt')) {
  cookiesPath = './cookies.txt';
  log('✅', GREEN, `cookies.txt محلي: ${cookiesPath}`);
} else {
  log('⚠️ ', YELLOW, 'لا YOUTUBE_COOKIES ولا cookies.txt - YouTube هيرفض الطلب على Replit');
}

// ─────────────────────────────────────────────
// 3) تحديد نوع الرابط
// ─────────────────────────────────────────────
header('3️⃣  تحليل الرابط');
log('🎯', CYAN, `URL: ${url}`);

const lower = url.toLowerCase();
let platform = 'unknown';
if (lower.includes('spotify.com')) platform = 'spotify';
else if (lower.includes('youtube.com') || lower.includes('youtu.be')) platform = 'youtube';
else if (lower.includes('soundcloud.com')) platform = 'soundcloud';
log('🎵', CYAN, `المنصة: ${platform}`);

// ─────────────────────────────────────────────
// 4) اختبار Spotify playlist (لو هو ده)
// ─────────────────────────────────────────────
if (platform === 'spotify') {
  header('4️⃣  اختبار Spotify Scraping');
  const match = url.match(/spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/);
  if (!match) {
    log('❌', RED, 'رابط Spotify غير صحيح');
    process.exit(1);
  }
  const [, type, id] = match;
  log('🔍', CYAN, `Type: ${type} | ID: ${id}`);

  try {
    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    log('📡', CYAN, `Fetching: ${embedUrl}`);
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120' }
    });
    const html = await res.text();
    log('✅', GREEN, `HTML length: ${html.length}`);

    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) {
      log('❌', RED, '__NEXT_DATA__ مش موجود - Spotify غيّر الـ HTML');
      process.exit(1);
    }
    const data = JSON.parse(m[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) {
      log('❌', RED, 'entity مش موجود في الـ JSON');
      process.exit(1);
    }

    let tracks = [];
    if (type === 'track') {
      tracks = [{
        title: entity.name,
        artist: entity.artists?.map(a => a.name).join(', '),
        duration: Math.floor((entity.duration || 0) / 1000)
      }];
    } else {
      tracks = (entity.trackList || []).filter(t => t.isPlayable !== false).map(t => ({
        title: t.title,
        artist: t.subtitle,
        duration: Math.floor((t.duration || 0) / 1000)
      }));
    }

    log('✅', GREEN, `Spotify tracks: ${tracks.length}`);
    log('🎵', CYAN, `أول 3 أغاني:`);
    tracks.slice(0, 3).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.title} - ${t.artist} (${t.duration}s)`);
    });
  } catch (e) {
    log('❌', RED, `Spotify error: ${e.message}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
// 5) اختبار yt-dlp على أول فيديو
// ─────────────────────────────────────────────
header('5️⃣  اختبار yt-dlp');

const testUrl = (platform === 'spotify')
  ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // اختبار YouTube على الأقل
  : url;

log('🎯', CYAN, `Test URL: ${testUrl}`);

const args = [
  '--no-playlist',
  '--no-warnings',
  '--extractor-args', 'youtube:player_client=ios,android,web,web_safari,web_embedded,mweb;formats=missing_pot',
  '-f', 'bestaudio[ext=webm]/bestaudio/best',
  '-o', '-',
  '--no-part',
  testUrl
];
if (cookiesPath) args.push('--cookies', cookiesPath);

console.log(`${CYAN}Command: ${ytDlp} ${args.join(' ')}${NC}`);

let stderr = '';
let stdoutBytes = 0;
let timeoutHandle;

const proc = spawn(ytDlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });

proc.stderr.on('data', d => {
  const s = d.toString();
  stderr += s;
  process.stderr.write(`${YELLOW}[yt-dlp] ${s}${NC}`);
});

proc.stdout.on('data', d => {
  stdoutBytes += d.length;
  if (stdoutBytes === d.length) {
    log('✅', GREEN, `بدأ البث! (${d.length} bytes في أول chunk)`);
    clearTimeout(timeoutHandle);
    // اقتل العملية بعد ثانيتين عشان ما نفضلش نستنى
    setTimeout(() => proc.kill(), 2000);
  }
});

timeoutHandle = setTimeout(() => {
  log('⏰', YELLOW, 'Timeout (60 ثانية) - yt-dlp مش بيرد');
  proc.kill('SIGKILL');
  log('🔍', CYAN, 'STDERR:');
  console.log(stderr);
  process.exit(1);
}, 60000);

proc.on('close', code => {
  clearTimeout(timeoutHandle);
  if (code === 0 || stdoutBytes > 0) {
    log('🎉', GREEN, `نجح! كود الخروج: ${code}, جلب ${stdoutBytes} bytes من الصوت`);
  } else {
    log('❌', RED, `فشل! كود الخروج: ${code}`);
    log('🔍', CYAN, 'آخر stderr:');
    console.log(stderr.slice(-1500));
  }
});

proc.on('error', err => {
  log('❌', RED, `Spawn error: ${err.message}`);
});
