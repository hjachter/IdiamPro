# IdiamPro Developers Manual

**A complete guide to developing IdiamPro using Claude Code**

*Written in plain language for non-programmers*

---

## Table of Contents

1. [Understanding the System](#understanding-the-system)
2. [The Three App Versions](#the-three-app-versions)
3. [Your Development Toolkit](#your-development-toolkit)
4. [Making Changes: Step by Step](#making-changes-step-by-step)
5. [Testing Your Changes](#testing-your-changes)
6. [Deploying to Production](#deploying-to-production)
7. [Backing Up Your Data](#backing-up-your-data)
8. [Troubleshooting](#troubleshooting)
9. [Quick Reference](#quick-reference)

---

## Understanding the System

### What is IdiamPro?

IdiamPro is a professional outlining application. You're reading this because you want to modify or improve it. The good news: you don't need to know how to code. Claude Code will handle the programming for you.

### How Development Works

Think of it like having a skilled programmer on call:

1. **You describe** what you want in plain English
2. **Claude Code** writes the code
3. **You test** to make sure it works
4. **You approve** and it goes live

The code lives on GitHub (like a secure filing cabinet for code). When you approve changes, they're automatically deployed to the internet via Vercel (a hosting service), and your apps update themselves.

---

## The Three App Versions

You have three ways to use IdiamPro:

| Version | Icon | What It's For | Where It Gets Data |
|---------|------|---------------|-------------------|
| **Dev** | IdiamPro Dev | Testing changes before they go live | Your computer (localhost) |
| **Desktop** | IdiamPro Desktop | Daily use, full features | Internet (Vercel) |
| **Webapp** | IdiamPro (Safari) | Quick access from browser | Internet (Vercel) |

### When to Use Each

- **Making changes?** Use Dev to test them first
- **Daily work?** Use Desktop or Webapp
- **Just want to check something?** Webapp is fastest

### Important: Data is Separate

Each version has its own storage. An outline in Desktop won't appear in Dev unless you transfer it. Use "Backup All Outlines" and "Restore All Outlines" to move data between versions.

---

## Your Development Toolkit

### What You Need

1. **Terminal** - The command-line app (built into Mac)
2. **Claude Code** - Your AI programming assistant
3. **IdiamPro Dev** - For testing changes

### Starting a Development Session

1. Open **Terminal** (in Applications > Utilities)
2. Type: `cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro`
3. Press Enter
4. Type: `claude`
5. Press Enter

You're now talking to Claude Code!

### Ending a Session

- Type `exit` or just close the Terminal window
- Your work is automatically saved

---

## Making Changes: Step by Step

### Step 1: Describe What You Want

Be specific. Instead of "make it better," say exactly what you want:

**Good examples:**
- "Add a button in the toolbar that exports the current outline as a PDF"
- "Change the font size in the content pane to 16px"
- "Add a keyboard shortcut Cmd+B to make text bold"

**Vague examples (avoid):**
- "Fix the export thing"
- "Make it look nicer"
- "Add some features"

### Step 2: Review Claude's Plan

Claude will:
1. Read the relevant code files
2. Explain what changes it will make
3. Ask for your approval

You can:
- Say "yes" or "go ahead" to approve
- Ask "why?" or "explain" for more details
- Say "no, instead do X" to redirect

### Step 3: Watch the Changes

Claude will modify files and show you what changed. You don't need to understand the code, but you can ask questions:
- "What does this do?"
- "Will this break anything?"
- "Is there a simpler way?"

### Step 4: Test It

1. Click **IdiamPro Dev** in your Dock
2. If it's already open, press **Cmd+R** to refresh
3. Try out the new feature
4. Check that existing features still work

### Step 5: Report Results

- **Works:** "Looks good!" or "Perfect!"
- **Needs changes:** "Almost, but can you also..."
- **Broken:** "This isn't working. When I click X, Y happens instead of Z"

### Step 6: Approve for Deployment

When you're satisfied:
- Say: "Commit and push these changes"
- Claude will save to GitHub
- Vercel will automatically deploy (takes ~2 minutes)
- Desktop and Webapp will update automatically

---

## Testing Your Changes

### The Dev App

- Always test in Dev first
- Changes appear instantly (with Cmd+R refresh)
- Won't affect other users or your production data

### What to Test

1. **The new feature** - Does it do what you asked?
2. **Related features** - Did you break anything nearby?
3. **Edge cases** - What happens with empty data? Long text? Special characters?

### Refresh Shortcut

Press **Cmd+R** in the Dev app to reload after Claude makes changes.

---

## Deploying to Production

### The Magic Words

Tell Claude: **"Commit and push these changes"**

### What Happens Next

1. Claude creates a "commit" (a saved snapshot of changes)
2. Claude pushes to GitHub (uploads the snapshot)
3. Vercel detects the new code
4. Vercel builds and deploys (~2 minutes)
5. Desktop and Webapp auto-update

### Checking Deployment

- Desktop/Webapp: Close and reopen, or wait for update notification
- Updates include a blue banner: "Update available"

---

## Backing Up Your Data

### Why Backup?

Your outlines are stored locally in each app. Backups let you:
- Transfer data between app versions
- Recover from accidents
- Keep archives

### How to Backup

1. Open any IdiamPro version
2. Click the dropdown arrow next to your outline name
3. Click **Backup All Outlines**
4. Save the .json file somewhere safe (like iCloud)

### How to Restore

1. Open the IdiamPro version you want to restore to
2. Click the dropdown arrow next to your outline name
3. Click **Restore All Outlines**
4. Select your backup .json file

---

## Troubleshooting

### Dev App Won't Start

```bash
# In Terminal, run:
lsof -ti:9002 | xargs kill -9
pkill -f Electron
```
Then click IdiamPro Dev again.

### Changes Don't Appear

1. Press **Cmd+R** to refresh
2. Check you're in the Dev app (not Desktop)
3. Ask Claude: "Did the changes save?"

### Something Broke After Deploy

1. Tell Claude what's wrong
2. Claude will fix it
3. Test in Dev
4. Commit the fix

### Need to Undo

Tell Claude:
- "Revert the last commit" - undoes the most recent change
- "Undo changes to [filename]" - reverts a specific file

### Lost Your Data

1. Check if you have a backup .json file
2. Use "Restore All Outlines"
3. If no backup, check other app versions (Dev/Desktop/Webapp each have separate data)

---

## Quick Reference

### Terminal Commands

| Command | What It Does |
|---------|--------------|
| `claude` | Start Claude Code |
| `exit` | End Claude Code session |

### Claude Commands

| Say This | Claude Does |
|----------|-------------|
| "Add [feature]" | Implements new functionality |
| "Fix [bug]" | Investigates and repairs |
| "Explain [thing]" | Describes how something works |
| "Commit and push" | Deploys changes to production |
| "Revert" | Undoes recent changes |

### Keyboard Shortcuts (in Dev App)

| Shortcut | Action |
|----------|--------|
| Cmd+R | Refresh after changes |
| Cmd+N | New item |
| Cmd+S | Save (auto-saves anyway) |

### App Locations

| App | Location |
|-----|----------|
| Dev | ~/Applications/IdiamPro Dev.app |
| Desktop | /Applications/IdiamPro Desktop.app |
| Webapp | Safari PWA in Dock |

### Important Files

| File | Purpose |
|------|---------|
| `/tmp/idiampro-dev.log` | Dev app startup log |
| `docs/SETUP_GUIDE.md` | Environment setup |
| `docs/USER_WORKFLOW.md` | Quick workflow |
| `docs/RESPONSIBILITIES.md` | Who does what |

---

## Getting Help

### From Claude Code

Just ask! Examples:
- "How do I...?"
- "What does X do?"
- "Why isn't Y working?"

### Documentation

- This manual: `docs/DEVELOPERS_MANUAL.md`
- Setup guide: `docs/SETUP_GUIDE.md`
- Workflow: `docs/USER_WORKFLOW.md`
- Responsibilities: `docs/RESPONSIBILITIES.md`

### If Truly Stuck

1. Close everything
2. Restart Terminal
3. Start fresh with `claude`
4. Describe the problem from the beginning

---

*Last updated: December 2024*
