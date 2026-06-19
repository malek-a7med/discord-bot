---
name: Bot Speech Mode
description: Owner-controlled speech style that modifies AI prompt personality
---

## Implementation
- Variable: `let botSpeechMode = "normal";` in index.js (before buildUserPrompt)
- Command: `/تغيير-طريقة-الكلام` — owner only; option name: "أسلوب"
- Values: `"normal"` (default, polite) | `"free"` (more casual/candid)
- Effect: adds `modeNote` string to `buildUserPrompt()` system prompt
- Persists in memory only (resets to "normal" on bot restart)

**Why:** Owner wanted ability to switch bot personality for different moods without changing code.
