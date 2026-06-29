// ════════════════════════════════════════════════════════════════
//  Last.fm Helper — بوت زنجي
//  بيجيب معلومات إضافية عن الأغنية (plays, tags, artist info)
// ════════════════════════════════════════════════════════════════

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '465d194af5f1d3091c5fd4d9773cf74b';
const BASE = 'https://ws.audioscrobbler.com/2.0/';

const _cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function lastfmFetch(params) {
  const url = new URL(BASE);
  url.searchParams.set('api_key', LASTFM_API_KEY);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cacheKey = url.toString();
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    _cache.set(cacheKey, { data, time: Date.now() });
    return data;
  } catch {
    return null;
  }
}

function cleanSongName(name) {
  return name
    .replace(/\(.*?(official|video|audio|lyrics|hd|hq|mv|4k|clip|music|lyric|live|feat\.?|ft\.?).*?\)/gi, '')
    .replace(/\[.*?\]/gi, '')
    .replace(/official\s*(video|audio|music video)?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function getTrackInfo(songName, artistName = '') {
  const clean = cleanSongName(songName);

  let artist = artistName;
  let track = clean;

  if (!artist) {
    const dashIdx = clean.indexOf(' - ');
    if (dashIdx > 0) {
      artist = clean.slice(0, dashIdx).trim();
      track = clean.slice(dashIdx + 3).trim();
    }
  }

  const params = { method: 'track.getInfo', track, autocorrect: '1' };
  if (artist) params.artist = artist;

  const data = await lastfmFetch(params);
  if (!data?.track) return null;

  const t = data.track;
  const plays = parseInt(t.playcount || '0', 10);
  const listeners = parseInt(t.listeners || '0', 10);
  const tags = (t.toptags?.tag || []).slice(0, 3).map(g => g.name).filter(Boolean);
  const artistInfo = t.artist?.name || artist || '';
  const duration = parseInt(t.duration || '0', 10) / 1000;
  const albumName = t.album?.title || '';
  const albumArt = t.album?.image?.find(i => i.size === 'extralarge')?.['#text'] || '';

  return {
    plays,
    listeners,
    tags,
    artist: artistInfo,
    albumName,
    albumArt: albumArt && !albumArt.includes('2a96cbd8b46e442fc41c2b86b821562f') ? albumArt : null,
    duration,
    url: t.url || '',
  };
}

export function formatPlays(n) {
  if (!n || n === 0) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
