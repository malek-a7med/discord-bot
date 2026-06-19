---
name: Party Games Architecture
description: Gartic Phone and Make it Meme game state, IDs, and button/modal routing
---

## Gartic Phone
- State Map: `garticGames` (gameId → state), `garticChannelMap` (channelId → gameId)
- gameId prefix: `gar` (e.g. `gar1a2b3c`)
- Phases: `lobby` → `playing` (rounds 0,1,2...) → `ended`
- Button prefixes: `gar_join_`, `gar_start_`, `gar_cancel_`, `gar_submit_`, `gar_task_`, `gar_stop_`
- Modal: `garmodal_${gameId}` — input field id: `gar_input`
- Round 0: each player writes their own phrase; odd rounds: describe; even rounds: guess
- assignments map: `{ playerId: ownerChainId }` — shifts cyclically each round
- Max rounds = min(players.length - 1, 4)
- 3-minute timer per round; advances automatically on timeout

## Make it Meme
- State Map: `memeGames` (gameId → state), `memeChannelMap` (channelId → gameId)
- gameId prefix: `mm`
- Phases: `lobby` → `captioning` → `voting` → `ended`
- Button prefixes: `meme_join_`, `meme_start_`, `meme_cancel_`, `meme_caption_`, `meme_vote_${gameId}_${targetPlayerId}`
- Modal: `mememodal_${gameId}` — input field id: `meme_caption_input`
- 60s caption timer, 30s voting timer
- Winner gets 200 coins (added by index.js after endMemeGame returns `{winnerId, coins}`)
- 12 Arabic meme templates in MEME_TEMPLATES array

## Hub Buttons (index.js routes these)
- `ghub_rlt` / `ftr_rlt` → handleRouletteCommand
- `ghub_maf` / `ftr_maf` → handleMafiaCommand
- `ghub_ttt` → handleTTTCommand
- `ghub_cdn` / `ftr_cdn` → handleCodenamesCommand
- `ghub_gar` / `ftr_gar` → handleGarticCommand
- `ghub_meme` / `ftr_meme` → handleMemeCommand
