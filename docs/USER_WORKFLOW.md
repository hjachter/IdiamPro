# IdiamPro Development Workflow

**How to make changes to IdiamPro using Claude Code**

---

## Quick Workflow (5 Steps)

### 1. Start Your Session
- Open Terminal in the IdiamPro project folder
- Run: `claude` to start Claude Code

### 2. Describe What You Want
- Tell Claude what feature to add or bug to fix
- Example: "Add a dark mode toggle to the settings menu"

### 3. Review & Approve Changes
- Claude will show you the changes it wants to make
- Review and approve each change
- Ask questions if anything is unclear

### 4. Test Your Changes
- Click **IdiamPro Dev** from Dock to test
- Press **Cmd+R** to refresh after changes
- Verify the feature works as expected

### 5. Deploy
- Tell Claude: "commit and push these changes"
- Claude commits to Git and pushes to GitHub
- Vercel automatically deploys to production
- Desktop and Webapp apps update automatically (within 60 seconds)

---

## What Gets Updated Automatically

| Action | Dev App | Desktop App | Webapp |
|--------|---------|-------------|--------|
| Code change (no push) | Instant (Cmd+R) | No | No |
| Git push to GitHub | Instant (Cmd+R) | ~2 min (Vercel) | ~2 min (Vercel) |

---

## Example Session

```
You: "Add a button to export all outlines as a ZIP file"

Claude: [Reads relevant files]
Claude: [Shows plan]
Claude: [Makes changes to code]
Claude: "I've added the ZIP export feature. Test it?"

You: [Clicks IdiamPro Dev, tests feature]
You: "Works great! Commit it."

Claude: [Commits and pushes to GitHub]
Claude: "Done! Deploying to Vercel now."

[2 minutes later: Desktop and Webapp have the new feature]
```

---

## Tips

- **Be specific** - "Add a red button" vs "Add a button"
- **Test in Dev first** - Always verify before committing
- **One feature at a time** - Easier to track and revert if needed
- **Ask Claude to explain** - If code is unclear, ask!

---

*Last updated: December 2024*
