---
name: Latest Features Rule
description: Every new feature built must be added to LATEST_FEATURES in commands/games-hub.js so it shows in /احدث-المميزات
---

# Latest Features Rule

Every new feature or change MUST be added to the `LATEST_FEATURES` array in `commands/games-hub.js`.

**Why:** The owner explicitly requires this — /احدث-المميزات is the main discovery surface for new functionality.

**How to apply:**
- Add a new entry at the TOP of the `LATEST_FEATURES` array (newest first).
- Format: `{ name: "emoji اسم الميزة — جديد!", value: "وصف مختصر بالعربي\n→ الأمر أو المكان", inline: false }`
- Do this in the same task/PR as the feature itself — never defer it.
- Older entries stay in the array (they scroll down naturally).
