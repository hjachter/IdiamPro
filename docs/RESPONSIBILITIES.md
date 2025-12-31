# Claude Code vs User Responsibilities

**Who does what when developing IdiamPro**

---

## What Claude Code Does

### Code Work
- Reads and understands the existing codebase
- Writes new code for features you describe
- Fixes bugs you report
- Refactors and improves code structure
- Adds tests when appropriate

### Git Operations
- Creates commits with descriptive messages
- Pushes changes to GitHub (when you ask)
- Creates branches if needed
- Shows you what changed before committing

### Problem Solving
- Researches how to implement features
- Suggests approaches and alternatives
- Explains code when asked
- Troubleshoots errors

### File Management
- Creates new files when needed
- Modifies existing files
- Organizes code properly
- Cleans up unused code

---

## What You (The User) Do

### Decision Making
- Describe what features you want
- Approve or reject proposed changes
- Choose between alternative approaches
- Decide when to commit and deploy

### Testing
- Click "IdiamPro Dev" to test changes
- Verify features work as expected
- Report bugs or issues you find
- Confirm when something works

### Quality Control
- Review changes Claude proposes
- Ask questions if something is unclear
- Request adjustments if needed
- Give the final "commit it" approval

### Deployment Trigger
- Say "commit and push" to deploy
- Watch for successful deployment
- Test production apps after deploy

---

## Typical Interaction Flow

```
You: "Add a button to do X"
     ↓
Claude: [Reads code, proposes changes]
     ↓
You: [Review] "Looks good" or "Change Y instead"
     ↓
Claude: [Makes changes]
     ↓
You: [Test in Dev app] "Works!" or "Bug: Z happens"
     ↓
Claude: [Fixes if needed]
     ↓
You: "Commit it"
     ↓
Claude: [Commits and pushes]
     ↓
[Vercel deploys automatically]
     ↓
[Desktop and Webapp update within 2 minutes]
```

---

## Things Claude Will NOT Do Without Asking

- Push to GitHub (waits for your "commit" command)
- Delete important files
- Make breaking changes without warning
- Deploy to production without confirmation

---

## Things Claude Will Do Automatically

- Read files to understand context
- Search the codebase for relevant code
- Show you proposed changes before applying
- Explain what each change does

---

## Communication Tips

### Be Specific
- Good: "Add a red button labeled 'Export' in the top-right corner"
- Vague: "Add an export thing"

### Give Context
- Good: "The save button doesn't work when I click it quickly twice"
- Vague: "Save is broken"

### Ask for Explanations
- "Why did you do it this way?"
- "What does this code do?"
- "Are there other options?"

---

## When Things Go Wrong

### If a bug appears after deployment:
1. Tell Claude what's wrong
2. Claude will investigate and fix
3. Test the fix in Dev
4. Commit when working

### If you want to undo a change:
1. Tell Claude: "Revert the last commit"
2. Or: "Undo the changes to [file]"

### If you're confused:
1. Ask Claude to explain
2. Ask for simpler alternatives
3. Take it step by step

---

*Remember: Claude writes the code, you make the decisions.*
