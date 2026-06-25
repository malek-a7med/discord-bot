---
name: Music System — Lavalink Architecture
description: نظام الموسيقى انتقل من DisTube/yt-dlp إلى Lavalink (shoukaku v4). دا القرارات والتفاصيل اللي لازم تاخدها في الاعتبار.
---

# Music System — Lavalink

## المكتبة المستخدمة
- `shoukaku` v4.1.1 — Lavalink WebSocket client
- `genius-lyrics` — كلمات الأغاني

## المحذوف
- `distube`, `@distube/spotify`, `@distube/yt-dlp`, `play-dl`
- لا يوجد `yt-dlp` في كود Node.js بعد الآن

## Shoukaku v4 API — نقاط مهمة

```js
// الانضمام للقناة الصوتية
const player = await shoukaku.joinVoiceChannel({
  guildId, channelId, shardId, deaf: true, mute: false
}); // options object — ليس args منفصلة

// الخروج من القناة
await shoukaku.leaveVoiceChannel(guildId);

// أفضل node
const node = shoukaku.options.nodeResolver(shoukaku.nodes);

// بحث
const result = await node.rest.resolve(`ytsearch:query`);
// result.loadType: 'search' | 'track' | 'playlist' | 'error' | 'empty'

// تشغيل
await player.playTrack({ track: { encoded }, options: { volume } }, noReplace);

// إيقاف
await player.stopTrack();

// إيقاف مؤقت
await player.setPaused(true/false);

// صوت (0-100 → نفس النطاق — shoukaku يأخذ 0-1000 لكننا نرسل 0-100 مباشرة)
await player.setGlobalVolume(level); // 0-100 (NOT 0-1000 despite docs saying 0-1000)
```

## Player Events
`start`, `end` (يحمل `reason`), `exception`, `stuck`, `closed`

## نظام Spotify-Only
- Spotify Track/Playlist/Album → resolveSpotifyUrl() → track names → Lavalink ytsearch
- بحث نصي → ytsearch:query → Lavalink
- YouTube URLs مرفوضة
- SoundCloud URLs مرفوضة

## sendMusicCard — التوافق
`sendMusicCard` تحتاج fakeQueue مع getters حيّة:
```js
const fakeQueue = {
  get paused()        { return qRef.paused; },
  get destroyed()     { return qRef._stopping; },
  get currentMessage(){ return qRef.currentMessage; },
  set currentMessage(v){ qRef.currentMessage = v; },
  get currentTime()   { return qRef.currentTime; },
  get volume()        { return qRef.volume; },
  get repeatMode()    { return qRef.repeatMode; },
};
```

## Lavalink Server — Railway
راجع `LAVALINK_RAILWAY.md` للإعداد.
متغيرات البيئة: `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `LAVALINK_SECURE`
ملفات الإعداد: `lavalink/Dockerfile`, `lavalink/application.yml`, `lavalink/railway.json`

**Why:** yt-dlp يتعرّض لـ "Sign in to confirm you're not a bot". Lavalink يعمل على server-side بدون هذه المشكلة.
