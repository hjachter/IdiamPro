# Multi-Developer Setup Guide

**How to collaborate with others on IdiamPro development**

---

## Overview

If you want someone else to help develop IdiamPro, here's how to set them up. Each developer works independently with their own Claude Code session, and changes are synchronized through GitHub.

---

## Setting Up a New Developer

### What They Need

1. A Mac computer
2. An Anthropic API key (for Claude Code)
3. GitHub access to the IdiamPro repository
4. About 30 minutes for setup

### Step-by-Step Setup

Have the new developer follow `docs/SETUP_GUIDE.md` to:
1. Install Homebrew, Node.js, Git, Claude Code
2. Clone the repository
3. Run `npm install`
4. Create the Dev app launcher
5. Test all three app versions

### GitHub Access

The repository owner needs to:
1. Go to github.com/hjachter/IdiamPro
2. Settings > Collaborators
3. Add the new developer's GitHub username
4. They'll receive an invitation email

---

## How Collaboration Works

### The Git Workflow

```
Developer A                    GitHub                    Developer B
     |                           |                           |
     |-- push changes ---------> |                           |
     |                           | <------- pull changes ----|
     |                           |                           |
     |                           | <------- push changes ----|
     |<-------- pull changes --- |                           |
```

### Before Starting Work

Each developer should always run:
```bash
git pull
```
This downloads any changes others have made.

### After Making Changes

Tell Claude: "commit and push these changes"

This uploads your work so others can access it.

---

## Avoiding Conflicts

### The Golden Rule

**Communicate about what you're working on.**

If two people edit the same file at the same time, Git can get confused. Avoid this by:

1. **Coordinate:** "I'm working on the toolbar today"
2. **Pull often:** Start each session with `git pull`
3. **Push often:** Commit and push when done with a feature
4. **Work on different features:** Don't edit the same areas

### If Conflicts Happen

Claude Code can help resolve them:
1. Run `git pull` and see the conflict
2. Tell Claude: "There's a merge conflict in [filename]"
3. Claude will show you both versions
4. Choose which changes to keep
5. Commit the resolution

---

## Shared Resources

### What's Shared (via GitHub)

- All source code
- Documentation
- Configuration files
- Package dependencies

### What's NOT Shared

- Local environment files (`.env.local`)
- Node modules (each developer runs `npm install`)
- Local app data (outlines in localStorage)
- The Dev app launcher (each creates their own)

---

## Communication Best Practices

### Daily Sync

Quick check-in: "I'm working on X today"

### Commit Messages

Claude writes descriptive commit messages automatically. If you need to know what someone changed, look at the Git history:
```bash
git log --oneline -10
```

### Documentation

Update docs when you add features so others know how things work.

---

## API Keys and Secrets

### Never Share in Code

- Keep `.env.local` files out of Git (already configured)
- Each developer uses their own API keys
- Never paste API keys into chat or commits

### Each Developer Needs

- Their own Anthropic API key (for Claude Code)
- Their own Gemini API key (for AI features in the app)

---

## Recommended Team Structure

### Small Team (2-3 developers)

- Informal coordination
- Direct communication
- Same time zone helps

### Growing Team (4+)

- Designate areas of ownership
- Use GitHub Issues to track work
- Regular sync meetings

---

## Quick Reference

### Start of Work Session

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro
git pull
claude
```

### End of Work Session

```
"Commit and push these changes"
```
(Or tell Claude: "exit" if no changes to commit)

### Check What Others Changed

```bash
git log --oneline -10
git diff HEAD~5
```

### See Who Changed What

```bash
git log --oneline --author="Name" -10
```

---

## Troubleshooting

### "Your branch is behind"

Run `git pull` before making changes.

### "Merge conflict"

Ask Claude to help resolve it.

### "Permission denied"

Check GitHub collaborator access with the repo owner.

### "npm packages differ"

Run `npm install` after pulling changes.

---

*Last updated: December 2024*
