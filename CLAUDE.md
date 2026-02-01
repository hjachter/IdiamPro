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
| Edit node name | Enter/Return key | Tap again (on selected node) |
| Create child node | Double-click | Double-tap |
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

Every time a new user-facing feature is implemented, it **must** also be documented in all three places before the work is considered complete:

1. **User Guide** (`src/lib/initial-guide.ts`) — Add a new node or update an existing one
2. **Help Chat context** (`src/components/help-chat-dialog.tsx`) — Update the `APP_CONTEXT` string
3. **Help Chat API context** (`src/app/api/help-chat/route.ts`) — Update the duplicated `APP_CONTEXT` string

This includes: new keyboard shortcuts, new node types, new toolbar/menu items, new settings, new gestures, new dialogs, and any change to existing feature behavior. Never merge a feature without its documentation.

---

## Development Notes

- **All app development and testing is done on Electron** (`npm run electron:dev`)
- **Capacitor** requires Node >= 22 for CLI commands (`npx cap sync`, `npx cap run`)
- **iCloud Drive** causes code signing issues - use `xattr -cr` to strip resource forks before signing
- **DerivedData** should be outside iCloud Drive to avoid build failures

---

## Active Until Reversed

These guidelines are active for ALL conversations until the user explicitly reverses them.
