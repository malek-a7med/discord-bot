---
name: Music Audio Fix
description: Why music was silent and how to fix it — opus encoder + correct StreamType
---

## The Rule
Music requires `opusscript` installed AND `StreamType.WebmOpus` in the audio resource.

**Why:** `@discordjs/voice` needs an Opus encoder (`@discordjs/opus` or `opusscript`) for `inlineVolume`. Without either, `createAudioResource` silently fails to encode. `@discordjs/opus` requires native compilation (times out on Replit). `opusscript` is pure JS and always works.

**How to apply:**
- Install: `npm install opusscript`
- In `helpers/music-handler.js` → `createYtDlpStream()`: return `StreamType.WebmOpus` (not `StreamType.Arbitrary`)
- yt-dlp format `bestaudio[acodec^=opus]/bestaudio[ext=webm]/bestaudio/best` outputs `webm opus` container — confirmed with `--print "%(ext)s %(acodec)s"`
- `StreamType.WebmOpus` + `inlineVolume: true` + `opusscript` = full pipeline works ✅

## Also Fixed
- `ModerationListener` had `isEnabled()` but no `setEnabled()` → `/auto-mod` command threw TypeError → "معلش يسطا ثواني بس" response. Fixed by adding `setEnabled(value)` that stores `this._enabled` and checking it in `isEnabled()`.
