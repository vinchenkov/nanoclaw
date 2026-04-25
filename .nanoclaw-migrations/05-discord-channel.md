# Discord channel

## Intent
This install runs Discord (bot: Homie#5609) as its sole inbound/outbound channel — there is no WhatsApp, Telegram, or Slack wired up. The channel is implemented as a self-registering NanoClaw Channel skill so that adding/removing it is a matter of dropping a file into `src/channels/` and adding one barrel-import line. The JID format `discord:<guild_id>:<channel_id>` is chosen so that (guild, channel) pairs are globally unique within the SQLite store and the IPC routing layer doesn't need any Discord-specific knowledge.

## Files touched

- `package.json` — adds `discord.js@^14.18.0` dependency.
- `src/channels/discord.ts` — net-new, 264 lines. Implements `Channel` interface, calls `registerChannel('discord', factory)` at module load.
- `src/channels/index.ts` — adds one import line so the discord module is loaded (and thus self-registers) at startup.
- `src/channels/discord.test.ts` — net-new, 777 lines. Optional but recommended.

## How to apply

### 1. Add discord.js dependency

```bash
npm install discord.js@^14.18.0
```

Or edit `package.json` directly (alphabetical order under `dependencies`):

```json
"discord.js": "^14.18.0",
```

### 2. Create src/channels/discord.ts

**NON-STANDARD — copy verbatim from the user's tree.** This file is 264 lines and is the load-bearing piece of this migration. Do **not** attempt to reconstruct it inline; copy `src/channels/discord.ts` byte-for-byte from the pre-migration checkout into the upgraded tree.

Key invariants the file must continue to satisfy after the copy:

- Calls `registerChannel('discord', factory)` at module top-level so the import in step 3 is sufficient to wire it in.
- The factory reads `DISCORD_BOT_TOKEN` (via `readEnvFile`, **not** `process.env` — see `src/env.ts` rationale) and **returns `null` when the token is missing** so the channel is skipped silently rather than crashing startup.
- Constructs JIDs in the form `discord:<guild_id>:<channel_id>`. Anything in the rest of NanoClaw that parses JIDs by `:` boundaries assumes this layout.
- Parses Discord-style user mentions (`<@user_id>`) out of inbound message content before handing the text to the agent.
- Implements the `Channel` interface from `src/types.ts`: `name`, `connect()`, `sendMessage(jid, text)`, `isConnected()`, `ownsJid(jid)` (must return `true` only for `discord:` JIDs), `disconnect()`. Optional `setTyping` / `syncGroups` may also be implemented.
- Uses gateway intents: `Guilds`, `GuildMessages`, `MessageContent`, `DirectMessages`. The `MessageContent` intent is privileged and must be enabled in the Discord developer portal — without it inbound messages arrive empty.

### 3. Wire import into src/channels/index.ts

Add the single import line under the `// discord` comment in the barrel file:

```ts
import './discord.js';
```

Final `src/channels/index.ts` should look like:

```ts
// Channel self-registration barrel file.
// Each import triggers the channel module's registerChannel() call.

// discord
import './discord.js';

// gmail

// slack

// telegram

// whatsapp
```

### 4. (Optional) Copy tests

`src/channels/discord.test.ts` (777 lines) covers connect, message parsing, send, and JID formation against mocked `discord.js` clients. Copy it verbatim alongside the implementation if you want the regression coverage; otherwise drop it. It has no runtime effect on the channel itself.

### 5. Required env vars

- `DISCORD_BOT_TOKEN` — the bot token from the Discord developer portal. The factory returns `null` (silently skipping channel registration) if this is unset.

The full env catalog including the Discord-specific `ASSISTANT_NAME=Homie` trigger and the `dc:1468824513654423697` main JID registration is documented in **section 07** of this migration guide.

## Risk notes

- **discord.js majors fast.** v14 is current as of this migration; if upstream has pinned a different major by the time you replay, reconcile by checking the v14 → vN migration notes for `Client`, `GatewayIntentBits`, `Events.MessageCreate`, `Message`, and `TextChannel` (the symbols imported in `discord.ts`). Most breaks surface as renamed enum members or constructor option shape changes.
- **`Channel` interface drift.** `src/types.ts` has had 875 commits to drift across since BASE. Diff the upstream `Channel` interface against the one captured above (lines 82–93) before assuming the copied `discord.ts` compiles. New required methods on `Channel` will surface as TypeScript errors immediately; renamed callback signatures (`OnInboundMessage`, `OnChatMetadata`) are the more dangerous silent-break case.
- **`registerChannel` signature drift.** If `src/channels/registry.ts` has changed its `ChannelFactory` shape (currently `(opts: ChannelOpts) => Channel | null`) or renamed `registerChannel`, the discord module will still load without error but **will not register**, and the bot will appear dead with no log line. After replay, confirm `getRegisteredChannelNames()` includes `'discord'` at startup — a quick log statement or a unit test on the registry is the safest check.
- **Privileged Message Content intent.** Not a code risk, but worth flagging during replay: if the Discord developer portal toggle for Message Content gets reset, inbound messages arrive with empty `content` and the trigger `@Homie` never matches.
