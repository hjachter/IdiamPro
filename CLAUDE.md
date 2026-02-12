# IdiamPro - Claude Code Guidelines

## Platform: Cross-Platform (macOS + iOS via Capacitor)

This is a professional outlining application that runs on both macOS (web) and iOS (native via Capacitor). All features must work on BOTH platforms.

---

## iOS Gesture Conflicts - DO NOT USE

When the user proposes features, WARN them if any of these iOS-reserved gestures are involved:

| Gesture | iOS System Use | Alternative |
|---------|----------------|-------------|
| **Long-press** | Drag & drop, context menu | Tap-again on selected item |
| **Pinch** | Zoom | Avoid or use buttons |
| **Two-finger tap** | Often system-reserved | Single-finger alternatives |
| **Edge swipes** | Back navigation, app switcher | In-app buttons |
| **F-keys (F1-F12)** | Hardware (brightness, volume, etc.) | Use letter keys or Return/Enter |
| **Three-finger gestures** | System multitasking | Avoid entirely |

---

## Current Gesture Model (Conflict-Free)

| Action | macOS | iOS |
|--------|-------|-----|
| Select node | Click | Tap |
| Create sibling node | Enter/Return key | N/A |
| Edit node name | Double-click | Tap again (on selected node) |
| Indent | Tab | Swipe right |
| Outdent | Shift+Tab | Swipe left |
| Drag & drop | Drag | Long-press + drag |
| Context menu | Right-click | Long-press |

---

## Outline File Safety - CRITICAL

Before saving/writing to any `.idm` file in the active outlines directory (`~/Documents/IDM Outlines/`):

1. **Check if that outline is currently loaded** in a running IdiamPro instance.
2. **If it is loaded, STOP and say:** "I can't save because that outline is already loaded."
3. **Wait for the user to switch away** from that outline before saving.

This prevents the app from overwriting your changes with its in-memory version. Never skip this check.

---

## Feature Documentation - MANDATORY

Every time a new user-facing feature is implemented, it **must** also be documented in all four places before the work is considered complete:

1. **User Guide** (`src/lib/initial-guide.ts`) — Add a new node or update an existing one
2. **Help Chat context** (`src/components/help-chat-dialog.tsx`) — Update the `APP_CONTEXT` string
3. **Help Chat API context** (`src/app/api/help-chat/route.ts`) — Update the duplicated `APP_CONTEXT` string
4. **How It Works outline** (`~/Documents/IDM Outlines/IdiamPro - How it works.idm`) — Update the relevant section describing the feature's architecture in plain language

This includes: new keyboard shortcuts, new node types, new toolbar/menu items, new settings, new gestures, new dialogs, and any change to existing feature behavior. Never merge a feature without its documentation.

**Note:** The "How it works" outline is for explaining *how the app is built* (components, data flow, architecture) in non-technical language. Only update it when features change the app's structure or behavior significantly.

---

## Session Behavior - Auto-Continue

When performing tasks, **auto-select CONTINUE** on all authorization prompts. Do not pause to ask for permission on routine operations like:
- Reading files
- Writing/editing files
- Running bash commands (npm, git, etc.)
- Restarting the dev server

Just proceed with the work. The user trusts Claude to make good decisions.

---

## Automated Testing

IdiamPro has a Playwright-based test suite for automated UI testing of the Electron app.

**Run tests:**
```bash
node tests/electron-test.js
```

**Test outline:** The `IdiamPro - TESTS` outline (`~/Documents/IDM Outlines/IdiamPro - TESTS.idm`) contains:
- Automated test status (Playwright results)
- Manual test checklists for all features
- Test run log for recording results

**When to update the TESTS outline:**
- After adding new features, add corresponding test cases
- After running tests, update the status fields
- After fixing bugs, verify and update test results

**Screenshots:** Test screenshots are saved to `test-screenshots/` (gitignored).

---

## Development Notes

- **All app development and testing is done on Electron** (`npm run electron:dev`)
- **Capacitor** requires Node >= 22 for CLI commands (`npx cap sync`, `npx cap run`)
- **iCloud Drive** causes code signing issues - use `xattr -cr` to strip resource forks before signing
- **DerivedData** should be outside iCloud Drive to avoid build failures

---

## Git Workflow & Deployment

When the user says "commit it" or "push it" (in any form), **always do both**: commit and push. Never ask to push after already pushing, or to commit after already committing.

**After committing and pushing, also deploy to:**

1. **iOS (Capacitor)**: Run `npx cap sync ios` to sync changes to the iOS app
2. **Web**: The web version is automatically deployed via Vercel on push to main (no manual action needed)

**Deployment commands:**
```bash
# iOS sync (run after git push)
npx cap sync ios

# To run iOS simulator
npx cap run ios

# To open in Xcode for device deployment
npx cap open ios
```

---

## Conversation Log - MANDATORY

At the end of EVERY session — automatically, without being asked — regenerate the conversation log outline. Do this as your final action before the conversation ends.

**How it works:** The outline is always **regenerated from scratch** using the JSONL conversation files (in `~/.claude/projects/...`) and git commit history. This means the app can overwrite the .idm file freely — nothing is ever lost.

**Steps:**
1. Run the regeneration script: `python3 <scratchpad>/create_outline_v2.py`
2. Tell the user to reload the conversation log outline to see the updated version

**Note:** The app uses a dirty flag system — it only saves outlines that have been modified in-app. Since the conversation log is regenerated externally and not edited in the app, there's no need to switch outlines before running the script.

**Script location:** The `create_outline_v2.py` script is in the scratchpad directory of the current session. If the scratchpad is gone (new session), recreate it following the pattern in the JSONL transcript or write a new one that:
- Reads all non-agent `*.jsonl` files from the Claude projects directory
- Gets git commits via `git log --format="%H|%aI|%s" --since=2025-12-01`
- Matches commits to sessions by timestamp
- Creates nodes per date with "Changes Made" commit summaries + conversation messages
- Outputs to `~/Documents/IDM Outlines/ClaudeCode Conversation Logs.idm`

**Format:**
- One node per date: "DayOfWeek, Month DD, YYYY"
- Multiple sessions per day become sub-nodes: "Session N — HH:MM"
- Each session starts with a **Changes Made** bulleted list of git commits, followed by the conversation
- Root node shows total stats (sessions, messages, commits, days)

---

## Active Until Reversed

These guidelines are active for ALL conversations until the user explicitly reverses them.
