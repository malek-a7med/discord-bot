# 🎵 Discord Bot Advanced Features - Integration Guide

## Overview

This guide shows how to integrate the 4 new advanced features into your existing `index.js` bot.

---

## Step 1: Update Imports (Top of index.js)

Add these imports after your existing imports:

```javascript
// Advanced Features
import config from './config.js';
import Database from './database.js';
import Logger from './logger.js';
import ModerationListener from './helpers/moderation-listener.js';
import { registerMusicCommands, musicHandler } from './commands/music.js';
import { registerCleanChapterCommand } from './commands/image-cleaner.js';
import { registerTranslateChapterCommand } from './commands/translator.js';
```

---

## Step 2: Initialize New Systems (After Client Creation)

Replace your database initialization code with:

```javascript
// Initialize new systems
const db = new Database();
const logger = new Logger(client);
const moderation = new ModerationListener(client, db, logger);

// Update logger reference when client is ready
client.once('ready', () => {
  logger.setClient(client);
  logger.success(`${client.user.username} عم يشتغل بتمام التمام!`);
});
```

---

## Step 3: Register New Slash Commands

Replace your existing `COMMANDS` array or add to your command registration logic:

```javascript
// Get all commands
const commands = [
  // ... Your existing commands ...
  
  // New Advanced Feature Commands
  ...(await registerCleanChapterCommand(client)).data,
  ...(await registerTranslateChapterCommand(client)).data,
  ...(await registerMusicCommands(client)).map(cmd => cmd.data)
];

// Deploy to Discord
const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
```

---

## Step 4: Handle Slash Command Interactions

In your `interactionCreate` event handler, add:

```javascript
if (interaction.isChatInputCommand()) {
  const cmdName = interaction.commandName;
  
  // New music commands
  if (cmdName === 'play') {
    const { handlePlay } = await import('./commands/music.js');
    return await handlePlay(interaction);
  }
  if (cmdName === 'skip') {
    const { handleSkip } = await import('./commands/music.js');
    return await handleSkip(interaction);
  }
  if (cmdName === 'stop') {
    const { handleStop } = await import('./commands/music.js');
    return await handleStop(interaction);
  }
  if (cmdName === 'queue') {
    const { handleQueue } = await import('./commands/music.js');
    return await handleQueue(interaction);
  }
  if (cmdName === 'pause') {
    const { handlePause } = await import('./commands/music.js');
    return await handlePause(interaction);
  }
  if (cmdName === 'resume') {
    const { handleResume } = await import('./commands/music.js');
    return await handleResume(interaction);
  }
  if (cmdName === 'nowplaying') {
    const { handleNowPlaying } = await import('./commands/music.js');
    return await handleNowPlaying(interaction);
  }
  if (cmdName === 'volume') {
    const { handleVolume } = await import('./commands/music.js');
    return await handleVolume(interaction);
  }
  
  // Image cleaner
  if (cmdName === 'clean_chapter') {
    const { handleCleanChapter } = await import('./commands/image-cleaner.js');
    return await handleCleanChapter(interaction);
  }
  
  // Translator
  if (cmdName === 'translate_chapter') {
    const { handleTranslateChapter } = await import('./commands/translator.js');
    return await handleTranslateChapter(interaction);
  }
  
  // ... Your existing commands ...
}
```

---

## Step 5: Enable Autonomous Moderation

In your `messageCreate` event handler, add after message handling:

```javascript
client.on('messageCreate', async (message) => {
  // ... Your existing message handling ...
  
  // Autonomous moderation (if enabled)
  if (moderation.isEnabled()) {
    await moderation.scanMessage(message);
  }
});

client.on('guildMemberAdd', async (member) => {
  // ... Your existing welcome handling ...
  
  // Raid detection
  if (moderation.isEnabled()) {
    await moderation.scanGuildJoin(member);
  }
});
```

---

## Step 6: Update Database Calls

Replace old `loadDB()` / `saveDB()` calls with:

```javascript
// Old way (deprecated):
// const db = loadDB();
// db.users[userId].xp += 5;
// saveDB(db);

// New way:
const user = db.getUser(userId);
db.updateUser(userId, { xp: user.xp + 5 });
```

---

## Step 7: Graceful Shutdown

Add this before `client.login()`:

```javascript
process.on('SIGINT', async () => {
  console.log('🛑 بوقف البوت بطريقة آمنة...');
  db.save();
  client.destroy();
  process.exit(0);
});
```

---

## Step 8: Environment Validation

At the very top of your bot (after imports), add:

```javascript
// Validate configuration
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN مفقود في .env');
  process.exit(1);
}

if (!process.env.OWNER_ID) {
  console.warn('⚠️ OWNER_ID مفقود - الميزات المتقدمة ما تشتغل');
}
```

---

## Key Features Summary

### ✅ Music System
- `/play` - Search YouTube/Spotify
- `/skip` - Skip current song
- `/stop` - Leave voice channel
- `/queue` - Show playlist
- `/pause` - Pause playback
- `/resume` - Resume playback
- `/nowplaying` - Show current song
- `/volume` - Adjust volume

### 🖼️ Image Cleaner
- `/clean_chapter folder_id` - Clean manhwa images using Replicate API
- Auto-uploads to new Drive folder
- Returns shareable link

### 📖 Translator
- `/translate_chapter folder_id language` - Translate manga panels
- Uses Gemini multimodal for OCR + translation
- Creates formatted Google Doc with translations
- Preserves tone and anime/manga slang

### 🛡️ Autonomous Moderation
- **Anti-Spam**: 5 msgs/10s → warn → timeout → kick → ban
- **Anti-Raid**: 10 joins/30s → lock channels
- **Anti-Link**: Delete suspicious links, DM user
- Escalating violations tracked in database
- All actions logged to admin channel

---

## API Keys Setup

### 1. Google APIs (Service Account)
1. Go to https://console.cloud.google.com
2. Create service account
3. Download JSON key file
4. Enable: Drive API, Docs API
5. Fill: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

### 2. Replicate API (Image Inpainting)
1. Go to https://replicate.com
2. Create account
3. Generate API key
4. Add to `REPLICATE_API_KEY`

### 3. Discord
- `OWNER_ID`: Your Discord user ID (get from profile)
- `ADMIN_CHANNEL_ID`: Channel for moderation logs

---

## Testing Checklist

### Music
- [ ] Join voice, run `/play beatles`
- [ ] Verify YouTube search works
- [ ] Run `/skip`, `/pause`, `/resume`, `/stop`
- [ ] Check `/queue` displays 10 songs
- [ ] Verify auto-disconnect after 5 min

### Image Cleaner
- [ ] Create Drive folder with 3-5 test images
- [ ] Run `/clean_chapter folder_id`
- [ ] Verify cleaned images uploaded
- [ ] Verify output folder link works

### Translator
- [ ] Run `/translate_chapter folder_id language:arabic`
- [ ] Verify Google Doc created
- [ ] Verify OCR + translations formatted
- [ ] Check shared Doc link works

### Moderation
- [ ] Spam test (5+ msgs/10s) → verify timeout
- [ ] Raid test (10+ joins/30s) → verify channel locked
- [ ] Link test → verify message deleted + logged

---

## Error Handling

All helpers use custom error classes that throw meaningful messages:
- `GoogleDriveError` - Drive API issues
- `GoogleDocsError` - Docs API issues
- `ImageProcessingError` - Image processing failures
- `MusicStreamError` - Audio streaming issues
- `ModerationError` - Moderation system errors

Errors are logged both to console and admin channel.

---

## Performance Optimization

- Music queues auto-timeout after 5 min of no activity
- Spam tracking cleans up entries older than 24 hours
- Database saves automatically on critical updates
- Moderation caches are limited to 1000 entries
- Image processing includes rate limiting (100ms delays)

---

## Troubleshooting

### "Cannot find module 'config.js'"
✅ Ensure all helper files are in `/artifacts/discord-bot/`

### "OWNER_ID is undefined"
✅ Add `OWNER_ID=your-discord-id` to `.env`

### "Replicate API failing"
✅ Verify `REPLICATE_API_KEY` in `.env`
✅ Fallback uses `sharp` for basic image cleaning

### Music won't play
✅ Verify bot has `CONNECT` + `SPEAK` permissions in voice channels
✅ Check internet connection for YouTube/Spotify access

### Google API errors
✅ Verify service account JSON has Drive + Docs scopes enabled
✅ Check file share permissions in Google Drive

---

## Next Steps

1. Run `npm install` to install new dependencies
2. Update your `.env` with new API keys
3. Add integration code to `index.js` (follow steps 1-7)
4. Test each feature with the checklist above
5. Deploy to production

---

**All bot responses are in informal Egyptian Arabic (لهجة مصرية عامية)!** 🇪🇬
