---
name: Smart Auto-Mod
description: Two-pass auto-mod with Gemini AI text classification for borderline content
---

## Architecture
Two-pass scanning in `helpers/auto-mod.js`:

1. **EXTREME_REGEX** (instant) — explicit sexual slurs, very severe insults
2. **SUSPICIOUS_REGEX** + **Gemini text** (async, only if suspicious) — death threats, targeted harassment, religious hate

## Key Details
- `scanMessage(msg, db, geminiVisionModel, notifyOwner, geminiTextModel = null)`
  - 5th param `geminiTextModel` is optional; pass `geminiModel()` from index.js
- Gemini text throttle: max 1 call per 5 seconds (tracked by `_lastTextCall` module var)
- SUSPICIOUS_REGEX patterns: يلعن دين/ربك/نبيك, هقتلك/هدبحك/هفتكك, تحرش جنسي
- Gemini prompt asks: "تهديد جسدي صريح، مضايقة شخصية شديدة، أو تحرش موجه؟"
- If Gemini says YES → reason = "محتوى مسيء موجه"

**Why:** Regular regex can't understand context; Gemini prevents false positives on jokes while catching real threats.
