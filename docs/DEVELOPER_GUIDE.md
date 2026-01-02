# IdiamPro Developer Guide

Last updated: January 2026

This guide explains how to develop, build, and release IdiamPro across all platforms.

---

## Quick-Start Cheatsheet

**Getting back up to speed? Start here.**

### First Time Setup
```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro
nvm use 22
npm install
```

### Daily Development
```bash
# Web development (fastest)
npm run dev                    # → http://localhost:9002

# Web + iOS together
npm run dev:ios                # Dev server + auto-sync to iOS

# Test on iOS Simulator
npx cap open ios               # Opens Xcode, then Cmd+R to run
```

### Before Committing
```bash
git add .
git commit -m "Your message"   # Auto-syncs iOS via pre-commit hook
git push
```

### Release Builds
```bash
# Mac Electron
npm run electron:build:mac     # → dist/IdiamPro Desktop-*.dmg

# iOS App Store
npx cap sync ios               # Sync latest code
npx cap open ios               # Open Xcode
# In Xcode: Product → Archive → Distribute App
```

### Key Locations
| What | Where |
|------|-------|
| All app code | `src/` |
| iOS project | `ios/App/` |
| Electron code | `electron/` |
| This guide | `docs/DEVELOPER_GUIDE.md` |
| iOS sync hook | `.husky/pre-commit` |
| iOS watch script | `scripts/watch-sync-ios.js` |

### Platform Detection (in code)
```typescript
if (isCapacitor()) {
  // iOS native app only
} else if (isElectron()) {
  // Mac Electron only
} else {
  // Web browser
}
```

### Troubleshooting One-Liners
```bash
nvm use 22                     # Fix "requires NodeJS >=22" error
npx cap sync ios               # Fix "iOS not showing changes"
npm run prepare                # Fix "pre-commit hook not running"
chmod +x .husky/pre-commit     # Fix hook permissions
```

---

## Table of Contents

0. [Quick-Start Cheatsheet](#quick-start-cheatsheet) ← **Start here if returning after a break**
1. [Project Architecture](#project-architecture)
2. [Key Files & Directories](#key-files--directories)
3. [Development Workflow](#development-workflow)
4. [Platform-Specific Details](#platform-specific-details)
5. [Building & Releasing](#building--releasing)
6. [iOS/Mac Sync Mechanism](#iosmac-sync-mechanism)
7. [Troubleshooting](#troubleshooting)

---

## Project Architecture

IdiamPro is a **single codebase** that runs on multiple platforms:

```
┌─────────────────────────────────────────────────────────────┐
│                    Shared Web Code (src/)                    │
│                   React + Next.js + TypeScript               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Mac Browser  │    │ Mac Electron  │    │ iOS Capacitor │
│  (localhost)  │    │   (Desktop)   │    │  (Native App) │
└───────────────┘    └───────────────┘    └───────────────┘
```

### How Code Sharing Works

- **`src/`** contains ALL the application logic, UI components, and utilities
- This code is shared by ALL platforms
- Platform-specific behavior uses feature detection:
  - `isCapacitor()` → true only in iOS/Android native apps
  - `isElectron()` → true only in Electron desktop app
  - Neither → running in web browser

---

## Key Files & Directories

### Shared Code (affects ALL platforms)

| Path | Purpose |
|------|---------|
| `src/components/` | React UI components |
| `src/lib/` | Utilities, helpers, business logic |
| `src/hooks/` | React hooks |
| `src/types/` | TypeScript type definitions |
| `src/app/` | Next.js pages and API routes |
| `src/ai/` | AI/Genkit integration |

### Platform-Specific Code

| Path | Purpose |
|------|---------|
| `electron/` | Mac Electron app (main process, preload) |
| `ios/` | iOS Capacitor project (Xcode) |
| `capacitor.config.ts` | Capacitor configuration |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, Electron build config |
| `capacitor.config.ts` | iOS/Android Capacitor settings |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |

### Build & Automation

| Path | Purpose |
|------|---------|
| `.husky/pre-commit` | Git hook - auto-syncs iOS before commits |
| `scripts/watch-sync-ios.js` | Watches src/ and syncs to iOS |

---

## Development Workflow

### Prerequisites

```bash
# Required Node.js version (for Capacitor)
nvm use 22

# Install dependencies
npm install
```

### Daily Development

**Option 1: Web only (fastest)**
```bash
npm run dev
# Open http://localhost:9002
```

**Option 2: Web + iOS auto-sync**
```bash
npm run dev:ios
# This runs dev server AND watches for changes to sync to iOS
```

**Option 3: Electron desktop**
```bash
npm run dev              # Start web server first
npm run electron:dev     # Then start Electron (in another terminal)
```

### Testing on iOS Simulator

```bash
# 1. Make sure dev server is running
npm run dev

# 2. Sync code to iOS (or use watch:ios)
npx cap sync ios

# 3. Open in Xcode
npx cap open ios

# 4. Press Cmd+R in Xcode to build and run
```

---

## Platform-Specific Details

### Mac Browser (localhost:9002)

- Just a standard Next.js web app
- No special configuration needed
- Uses File System Access API for folder selection (Chrome/Edge only)
- Falls back to file downloads on Safari

### Mac Electron App

**Key files:**
- `electron/main.js` - Main process
- `electron/preload.js` - Preload script for IPC
- `package.json` → `build` section - Electron Builder config

**How it works:**
- Loads the web app from localhost:9002 (dev) or built files (prod)
- Has access to Node.js APIs via preload script
- Can use native file dialogs

### iOS Capacitor App

**Key files:**
- `capacitor.config.ts` - Capacitor configuration
- `ios/App/` - Xcode project
- `ios/App/App/public/` - Where web assets are copied

**How it works:**
- Web code is copied to `ios/App/App/public/` via `cap sync`
- In dev mode, loads from `http://localhost:9002` (configured in capacitor.config.ts)
- In prod, loads from bundled files or deployed URL
- Uses Capacitor plugins for native features:
  - `@capacitor/share` - iOS Share sheet
  - `@capacitor/filesystem` - File read/write

**Platform detection in code:**
```typescript
// src/lib/export.ts or any component
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
}

// Usage
if (isCapacitor()) {
  // iOS-specific code (Share sheet, etc.)
} else {
  // Browser code (file downloads, etc.)
}
```

---

## Building & Releasing

### Mac Browser (Vercel)

The app is deployed to Vercel automatically on push to main.

```bash
# Manual build
npm run build

# The app is at https://idiam-pro.vercel.app
```

### Mac Electron App

```bash
# Build for Mac
npm run electron:build:mac

# Output: dist/IdiamPro Desktop-*.dmg
```

**Signing & Notarization (for distribution):**
- Requires Apple Developer certificate
- Set environment variables for notarization
- See `electron/entitlements.mac.plist`

### iOS App Store

**1. Prepare the build:**
```bash
# Make sure you're on Node 22
nvm use 22

# Sync latest code
npx cap sync ios

# Open Xcode
npx cap open ios
```

**2. In Xcode:**
- Select "Any iOS Device" as destination
- Product → Archive
- Window → Organizer → Distribute App
- Choose App Store Connect

**3. In App Store Connect:**
- Create new version
- Add build from Xcode
- Submit for review

**Important iOS settings:**
- Bundle ID: `com.idiampro.app`
- App icons: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Capacitor config: `capacitor.config.ts`

---

## iOS/Mac Sync Mechanism

### The Problem
iOS code lives in `ios/App/App/public/` but we develop in `src/`. Changes need to be copied over.

### The Solution

**Automatic sync is handled two ways:**

#### 1. Watch Mode (during development)
```bash
npm run watch:ios
# or
npm run dev:ios  # includes dev server
```

This runs `scripts/watch-sync-ios.js` which:
- Watches `src/` for file changes
- Waits 2 seconds after last change (debounce)
- Runs `npx cap sync ios` automatically

#### 2. Pre-commit Hook (before every commit)
Located at `.husky/pre-commit`:
- Runs automatically on `git commit`
- Executes `npx cap sync ios`
- Stages any iOS changes

**Manual sync:**
```bash
npx cap sync ios
# or
npm run cap:sync:ios
```

### What `cap sync` Does

1. Copies web assets from `out/` (or loads from dev server URL) to iOS project
2. Updates native plugins in iOS project
3. Updates `Package.swift` with plugin dependencies

---

## Troubleshooting

### "Capacitor CLI requires NodeJS >=22.0.0"
```bash
nvm use 22
```

### iOS simulator not showing changes
```bash
# Force sync
npx cap sync ios

# Rebuild in Xcode (Cmd+R)
```

### Share sheet not working on iOS
Make sure the Capacitor plugins are installed:
```bash
npm install @capacitor/share @capacitor/filesystem
npx cap sync ios
# Rebuild in Xcode
```

### Pre-commit hook not running
```bash
# Reinstall husky
npm run prepare

# Make hook executable
chmod +x .husky/pre-commit
```

### Electron app shows blank screen
Make sure the dev server is running:
```bash
npm run dev
# Then in another terminal:
npm run electron:dev
```

### TypeScript errors
```bash
npm run typecheck
```

### iOS build fails in Xcode
1. Clean build folder: Product → Clean Build Folder (Cmd+Shift+K)
2. Re-sync: `npx cap sync ios`
3. Rebuild: Cmd+R

---

## Quick Reference

### Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run dev:ios` | Dev server + iOS watcher |
| `npm run watch:ios` | Watch and sync to iOS |
| `npx cap sync ios` | Manual iOS sync |
| `npx cap open ios` | Open Xcode |
| `npm run electron:dev` | Run Electron in dev mode |
| `npm run build` | Build for production |
| `npm run typecheck` | Check TypeScript |

### Key URLs

| URL | Purpose |
|-----|---------|
| http://localhost:9002 | Local dev server |
| https://idiam-pro.vercel.app | Production web app |

### Important Paths

| Path | What it contains |
|------|-----------------|
| `src/` | All shared application code |
| `ios/App/App/public/` | iOS web assets (auto-generated) |
| `electron/` | Electron main process code |
| `.husky/pre-commit` | Git hook for iOS sync |
| `scripts/watch-sync-ios.js` | iOS watch script |

---

## Version History

| Date | Changes |
|------|---------|
| Jan 2026 | Added iOS Share/Filesystem plugins, auto-sync hooks |
| Dec 2025 | Initial iOS Capacitor setup |
| Nov 2025 | Electron desktop app |
