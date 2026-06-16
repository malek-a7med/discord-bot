# 🤖 Advanced Discord Bot - Complete Feature Documentation

## Overview

Your Discord bot has been upgraded with **4 enterprise-grade features**:

1. ✅ **Manhwa Image Cleaner** - Automated image cleaning + Google Drive
2. ✅ **Context-Aware Translator** - Gemini multimodal OCR + Google Docs  
3. ✅ **Complete Music System Overhaul** - Flawless audio streaming
4. ✅ **Autonomous Moderation** - Anti-spam, anti-raid, anti-link

**Language:** All responses are in informal Egyptian Arabic (لهجة مصرية عامية) 🇪🇬

---

## 📦 What's New - Files Created

### Core Utilities
- **`config.js`** - Environment validation + configuration management
- **`database.js`** - JSON DB wrapper with async methods
- **`errors.js`** - Custom error classes for all features
- **`logger.js`** - Structured logging to console + admin channel

### API Helpers
- **`helpers/google-drive.js`** - Drive API (download, upload, create folders)
- **`helpers/google-docs.js`** - Docs API (create, format, share documents)
- **`helpers/image-cleaner-api.js`** - Replicate inpainting + sharp preprocessing
- **`helpers/gemini-multimodal.js`** - Gemini vision + translation engine
- **`helpers/music-handler.js`** - Complete voice/audio player (rewrite)
- **`helpers/moderation-listener.js`** - Anti-spam/raid/link detector

### Commands
- **`commands/image-cleaner.js`** - `/clean_chapter` command
- **`commands/translator.js`** - `/translate_chapter` command
- **`commands/music.js`** - `/play`, `/skip`, `/stop`, `/queue`, `/pause`, `/resume`, `/nowplaying`, `/volume`

### Documentation
- **`INTEGRATION_GUIDE.md`** - Step-by-step integration into your existing bot
- **`README_FEATURES.md`** - This file!

---

## 🎵 Feature 1: Music System (Complete Rewrite)

### Commands

```
/play <query>          - Search YouTube or paste Spotify link
/skip                  - Skip current song
/stop                  - Stop music & leave channel
/queue [page]          - Show 10 songs per page
/pause                 - Pause current playback
/resume                - Resume from pause
/nowplaying            - Show current song info
/volume <0-100>        - Adjust volume level
```

### Architecture

**Queue Structure (per guild)**
```javascript
{
  guildId,
  textChannel,
  voiceChannel,
  connection,          // @discordjs/voice
  player,              // AudioPlayer
  songs: [],           // Song queue
  isPlaying: boolean,
  isPaused: boolean,
  volume: 0.5,
  loopMode: 'none'     // 'none', 'one', 'all'
}
```

### Features

✅ **YouTube Integration**
- Search by title/artist
- Direct YouTube link support
- Stream extraction via `play-dl`

✅ **Spotify Support**
- Playlist bypass (extracts track names)
- Direct link support
- Fallback to YouTube search

✅ **Robust Stream Handling**
- Error recovery on stream failure
- Automatic skip on stuck streams (30s timeout)
- Volume control with inline resource scaling

✅ **Queue Management**
- Max 100 songs per queue
- Max 30-min song duration
- Duplicate prevention
- Pagination display (10 per page)

✅ **Auto-Disconnect**
- Leaves after 5 minutes with no humans
- Detects channel emptying
- Graceful cleanup

### Error Handling

- No voice channel → ephemeral error reply
- YouTube unavailable → graceful fallback
- Connection drops → auto-reconnect once
- Stream timeout → skip to next

**Example Usage:**
```
User: /play beatles let it be
Bot: ➕ تمت إضافة الأغنية: Let It Be | 3:04
```

---

## 🖼️ Feature 2: Manhwa Image Cleaner

### Command

```
/clean_chapter folder_id [output_name]
```

- `folder_id` (required) - Google Drive folder ID with raw images
- `output_name` (optional) - Output folder name (default: `cleaned-{timestamp}`)

### Workflow

1. **Validate** - Check owner permission + Drive access
2. **List** - Fetch all image files (.jpg, .png, .webp) from folder
3. **Process** - For each image:
   - Download from Drive
   - Clean using Replicate API (manga-cleaner model)
   - Fallback to sharp preprocessing if API fails
   - Optimize for web
4. **Upload** - Save cleaned images to new Drive folder
5. **Share** - Generate public link + return summary

### Replicate API Integration

Uses `replicate/codeformer` model for image enhancement:
- Text removal
- Noise reduction
- Artifact cleanup
- Quality restoration

**Fallback:** If Replicate fails, uses `sharp`:
- Normalize color levels
- Light sharpening (enhance text)
- Saturation boost
- Progressive JPEG optimization

### Output

```
✅ تم تنضيف الصور بتاعك!
• Processed: 5/5
• Output Folder: cleaned-1715000000
• Link: [اضغط هنا](https://drive.google.com/...)
```

### API Keys Required

- `REPLICATE_API_KEY` - Replicate API token
- `GOOGLE_API_KEY` - Google Drive access
- `OWNER_ID` - Owner verification

---

## 📖 Feature 3: Context-Aware Translator

### Command

```
/translate_chapter folder_id [language] [doc_name]
```

- `folder_id` (required) - Google Drive folder with manga images
- `language` (optional) - `arabic`, `english`, `french` (default: `arabic`)
- `doc_name` (optional) - Output Doc name (default: `Translated-{timestamp}`)

### Workflow

1. **Validate** - Check owner permission + Drive access
2. **List** - Fetch all images (sorted by name)
3. **Process** - For each image:
   - Download from Drive
   - Send to Gemini with context prompt (understand mood, tone, slang)
   - Extract original text + translation
   - Capture mood/emotion notation
   - Include translation notes
4. **Format** - Create beautiful Google Doc:
   - Chapter header
   - Panel-by-panel breakdown
   - Original text | Translated text | Notes
5. **Share** - Set viewer access + return link

### Gemini Integration

**Multi-modal OCR + Translation**

The prompt instructs Gemini to:
- Extract ALL visible text
- Understand emotional tone (serious/comedic/dramatic)
- Preserve character voices (formal/casual)
- Maintain anime/manga slang
- Adapt cultural references
- Flag low-confidence panels

**Example JSON Response:**
```json
{
  "original_text": "私は君を愛しています...",
  "translated_text": "بحبك كتير يا حبيبي...",
  "mood": "romantic/emotional",
  "notes": "Maintained character's intimate tone",
  "confidence": 0.95
}
```

### Output

```
✅ تمت الترجمة بتاعتك!
• Translated: 15/15 images
• Language: Arabic
• Doc: [اضغط هنا](https://docs.google.com/...)
```

### API Keys Required

- `GOOGLE_API_KEY` - Gemini multimodal
- `GOOGLE_CLIENT_ID/SECRET` - Google Docs access
- `OWNER_ID` - Owner verification

---

## 🛡️ Feature 4: Autonomous Moderation

### 3 Detection Systems

#### **1. Anti-Spam Detector**

```
Detection: 5+ messages in 10 seconds
Action: Warn → Timeout (5m) → Kick → Ban
Escalation: Tracked by warning count
Logging: Admin channel + user DM
```

**Example Flow:**
- 1st spam incident → **Warning**
- 2nd spam incident → **5-minute timeout**
- 3rd spam incident → **30-minute timeout**
- 4+ spam incidents → **Kick from server**

#### **2. Anti-Raid Detector**

```
Detection: 10+ joins in 30 seconds
Action: Lock all text channels
Logging: System channel + admin channel
Manual Unlock: Required by moderator
```

**Mechanism:**
- Tracks join timestamps per guild
- Removes `SendMessages` permission for `@everyone`
- Notifies admins with guild name
- Prevents escalation

#### **3. Anti-Link Detector**

```
Detection: Suspicious links (non-whitelisted domains)
Action: Delete message + DM user + log
Whitelist: github.com, youtube.com, discord.gg, twitch.tv
Logging: Admin channel
```

**Regex Matching:**
- Detects `http://` and `https://` protocols
- Extracts domain via URL parsing
- Checks against whitelist
- Deletes + alerts

### Exemptions

- **Owner** (config.OWNER_ID) - No filtering
- **Admins** - No filtering
- **Mods** - Warnings only (no timeouts)

### Database Tracking

```javascript
{
  users: {
    userId: {
      warnings: [
        { reason, moderator: 'ANTI_SPAM_SYSTEM', timestamp }
      ],
      timeouts: [
        { duration, reason, timestamp }
      ]
    }
  }
}
```

### Admin Channel Logs

**Format:** Rich embeds with:
- Title: Action type (🚨 Spam, 🔗 Link, etc.)
- User: `@username` mention
- Reason: Specific violation
- Action: What was done
- Duration: Timeout length (if applicable)
- Timestamp: Exact time

**Example:**
```
🚨 اكتشاف Spam
User: @spammer
Reason: 7 messages in 10s
Action: Timeout (5 minutes)
Time: 2026-06-07 14:30:00
```

### Configuration

```env
ANTI_SPAM_THRESHOLD=5          # messages in window
ANTI_SPAM_WINDOW=10000         # milliseconds
ANTI_RAID_THRESHOLD=10         # joins in window
ANTI_RAID_WINDOW=30000         # milliseconds
OWNER_ID=your-discord-id       # Owner verification
ADMIN_CHANNEL_ID=channel-id    # Mod logs destination
```

### Enabling/Disabling

- Moderation **only runs if** `OWNER_ID` and `ADMIN_CHANNEL_ID` are set
- To disable: Remove these env vars (or set to empty)
- Granular control: Can disable specific checks by modifying `moderation-listener.js`

---

## 🔑 Configuration (`.env`)

### Required Variables

```env
# Discord Bot
DISCORD_TOKEN=your-bot-token

# Google APIs (Existing)
GOOGLE_API_KEY=your-gemini-key

# New: Google OAuth2 (Service Account)
GOOGLE_CLIENT_ID=xxx@appspot.gserviceaccount.com
GOOGLE_CLIENT_SECRET=your-private-key
GOOGLE_REFRESH_TOKEN=refresh-token

# Image Processing
REPLICATE_API_KEY=your-replicate-key

# Server Management
OWNER_ID=your-discord-user-id
ADMIN_CHANNEL_ID=your-admin-channel-id

# Optional
YOUTUBE_API_KEY=optional-youtube-key
```

### Environment Validation

**On Startup:**
- `DISCORD_TOKEN` - Required (exits if missing)
- `GOOGLE_API_KEY` - Required (exits if missing)
- `OWNER_ID` - Required for owner-only commands
- `ADMIN_CHANNEL_ID` - Required for moderation logging

Missing optional vars → Warnings logged but bot continues

---

## 📊 Database Structure

### JSON Format

```json
{
  "users": {
    "userId": {
      "xp": 0,
      "level": 0,
      "coins": 0,
      "lastDaily": null,
      "warnings": [
        { "reason": "...", "moderator": "SYSTEM", "timestamp": 1715000000 }
      ],
      "timeouts": [
        { "duration": 300000, "reason": "...", "timestamp": 1715000000 }
      ]
    }
  },
  "warnings": { /* Deprecated, use users[].warnings */ },
  "manhwa": {
    "dict-name": {
      "english-term": "arabic-translation"
    }
  },
  "welcome": {
    "guildId": "channelId"
  },
  "spamTracking": {
    "guildId-userId": { "count": 5, "firstMessageTime": 1715000000 }
  },
  "raidTracking": {
    "guildId-raid": { "joinTimes": [1715000000, ...] }
  }
}
```

### Auto-Cleanup

- Spam tracking entries older than 24 hours are removed
- Raid join times older than 60 seconds are filtered
- Database auto-saves on critical updates

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd artifacts/discord-bot
npm install
```

### 2. Update .env

```bash
# Add these new variables:
OWNER_ID=your-discord-id
ADMIN_CHANNEL_ID=your-admin-channel-id
REPLICATE_API_KEY=your-replicate-key
GOOGLE_CLIENT_ID=service-account-id
GOOGLE_CLIENT_SECRET=service-account-key
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### 3. Integrate Code

Follow **`INTEGRATION_GUIDE.md`** to add new handlers to your `index.js`:
- Import new modules (Step 1)
- Initialize systems (Step 2)
- Register commands (Step 3-4)
- Enable moderation listener (Step 5)
- Update DB calls (Step 6)

### 4. Test Each Feature

**Music:**
```
/play beatles
/skip
/queue
/stop
```

**Image Cleaner:**
```
/clean_chapter YOUR_FOLDER_ID
```

**Translator:**
```
/translate_chapter YOUR_FOLDER_ID language:arabic
```

**Moderation:**
- Spam bot messages 5+ times in 10 seconds → watch timeout
- Post non-whitelisted link → message deleted + logged

---

## 🐛 Troubleshooting

### Music Won't Play
- ❌ Bot not in voice channel → bot joins automatically
- ❌ YouTube blocked → check internet connection
- ❌ Permission denied → grant `CONNECT` + `SPEAK` to bot role

### Image Cleaner Fails
- ❌ Replicate API error → fallback to `sharp` (basic cleaning)
- ❌ Invalid folder ID → verify Google Drive folder exists
- ❌ Permission denied → ensure bot has read/write access to folder

### Translator Missing OCR
- ❌ Low confidence → panel flagged as "VERIFY MANUALLY"
- ❌ Non-English text → Gemini still extracts, may need manual review
- ❌ Rate limited → requests queued with 500ms delays

### Moderation Not Working
- ❌ Owner-only → ensure `OWNER_ID` set and user is owner
- ❌ Logs not appearing → check `ADMIN_CHANNEL_ID` is correct
- ❌ Timeouts failing → ensure bot has `MODERATE_MEMBERS` permission

---

## 📈 Performance

- **Music queues**: Auto-timeout after 5 minutes of inactivity
- **Image processing**: Processes one at a time with 100ms delays
- **Translation**: Queued with 500ms delays (Gemini rate limit)
- **Moderation**: Real-time, caches limited to 1000 entries
- **Database**: Auto-saves on updates, loads once on startup

---

## 🔒 Security

- **API Keys**: Loaded once at startup, never logged
- **Database**: JSON file on disk (recommended: move to PostgreSQL)
- **Permissions**: Owner-only commands require `OWNER_ID` check
- **Moderatio**n: Logs to admin channel for transparency
- **Error Handling**: No sensitive data in error messages

---

## 💡 Advanced Customization

### Add Whitelisted Links to Moderation

**File:** `helpers/moderation-listener.js` (line ~30)
```javascript
this.whitelistedDomains = [
  'youtube.com',
  'youtu.be',
  'github.com',
  'discord.gg',
  'twitch.tv',
  'your-custom-domain.com'  // ← Add here
];
```

### Change Anti-Spam Thresholds

**File:** `.env`
```env
ANTI_SPAM_THRESHOLD=3           # Lower = stricter
ANTI_SPAM_WINDOW=5000           # Shorter window = faster detection
```

### Customize Moderation Escalation

**File:** `helpers/moderation-listener.js` (method: `triggerSpamViolation`)
```javascript
if (warnings.length === 0) {
  action = 'warn';
} else if (warnings.length === 1) {
  action = 'timeout';
  duration = 10 * 60 * 1000;  // ← Change timeout duration
} // ... etc
```

---

## 📝 All Text Responses in Egyptian Arabic

Every bot message, error, and notification is in informal Egyptian dialect:

- **Success:** "تمام التمام يا حج! شغلت أغنيتك."
- **Error:** "في مشكلة! ما تقدرتش أحمل الصور."
- **Music:** "يلا نشتغل! شغلت أغنيتك اللي انت طلبتها."
- **Moderation:** "يا معرص! أنت معاك spam. راح أسكتك دقائق."

---

## 📞 Support

If you encounter issues:

1. **Check logs** - Console + admin channel
2. **Verify env vars** - All required keys set
3. **Test APIs** - Ensure Replicate/Gemini/Drive APIs are accessible
4. **Check permissions** - Bot has necessary Discord permissions
5. **Review INTEGRATION_GUIDE.md** - Ensure proper code integration

---

**Built with ❤️ for advanced Discord bot needs!** 🚀
