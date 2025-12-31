# IdiamPro Development Environment Setup Guide

**Time Required: ~20-30 minutes**

This guide will help you set up a new Mac for IdiamPro development.

---

## Prerequisites

### 1. Install Homebrew (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js (v20 or later)
```bash
brew install node
```

### 3. Install Git (usually pre-installed on Mac)
```bash
git --version  # Check if installed
brew install git  # Install if needed
```

### 4. Install Claude Code CLI
```bash
npm install -g @anthropic-ai/claude-code
```

---

## Project Setup

### 1. Clone the Repository
```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeProjects/
git clone https://github.com/hjachter/IdiamPro.git
cd IdiamPro
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Environment File
Create `.env.local` in the project root:
```bash
cat > .env.local << 'EOF'
# Google Gemini API Key
# Get your API key from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-api-key-here
EOF
```
Replace `your-api-key-here` with your actual Gemini API key.

---

## App Installation

### 1. Build Desktop App
```bash
npm run electron:build:mac
```
Then open `dist/IdiamPro Desktop-*.dmg` and drag to Applications.

### 2. Create Dev Launcher
```bash
chmod +x start-dev.sh
osacompile -o ~/Applications/"IdiamPro Dev.app" -e 'do shell script "'"$PWD"'/start-dev.sh &> /tmp/idiampro-dev.log &"'
```

### 3. Create Webapp (Safari PWA)
1. Open Safari
2. Go to https://idiam-pro.vercel.app
3. File → Add to Dock

---

## Add Apps to Dock

Drag these to your Dock:
- `/Applications/IdiamPro Desktop.app` - Production version
- `~/Applications/IdiamPro Dev.app` - Development version
- Safari PWA (IdiamPro Webapp) - Already in Dock from step above

---

## Verify Setup

### Test Dev Version:
1. Click "IdiamPro Dev" from Dock
2. Should launch with Electron DevTools
3. App loads from localhost:9002

### Test Desktop Version:
1. Click "IdiamPro Desktop" from Dock
2. Should launch clean (no DevTools)
3. App loads from Vercel

### Test Webapp:
1. Click "IdiamPro" webapp from Dock
2. Opens in Safari container
3. App loads from Vercel

---

## Quick Reference

| Version | Location | Loads From | Use For |
|---------|----------|------------|---------|
| Dev | ~/Applications/ | localhost:9002 | Development |
| Desktop | /Applications/ | Vercel | Production/Distribution |
| Webapp | Dock (Safari PWA) | Vercel | Quick access |

---

## Troubleshooting

### Dev version won't start:
```bash
# Check if port 9002 is in use
lsof -ti:9002

# Kill stuck processes
lsof -ti:9002 | xargs kill -9
pkill -f Electron

# Check log
cat /tmp/idiampro-dev.log
```

### npm install fails:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Environment Info

- **Node.js**: v20.x or later
- **npm**: v10.x or later
- **Git**: v2.x or later
- **macOS**: Monterey or later recommended

---

*Last updated: December 2024*
