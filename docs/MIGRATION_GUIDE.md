# IdiamPro Outline Migration Guide

**Converting existing outlines to the new `.idm` file format**

Each IdiamPro app version (Dev, Desktop, Webapp) stores its outlines independently. This guide walks you through migrating each one to use `.idm` files in a folder you specify.

---

## Before You Begin

1. **Backup your outlines first** (recommended safety step)
   - Open each app version
   - Click the outline dropdown menu
   - Select **Backup All Outlines**
   - Save the `.json` backup file somewhere safe

---

## Migration Steps (Repeat for Each App Version)

### Step 1: Open the App
- **Dev**: Click IdiamPro Dev in /Applications
- **Desktop**: Click IdiamPro Desktop in /Applications
- **Webapp**: Open https://idiam-pro.vercel.app in browser

### Step 2: Verify Your Outlines Load
- Confirm you can see your outlines in the dropdown
- If outlines are missing, use **Restore All Outlines** with your backup file

### Step 3: Choose a Storage Folder
1. Click the **Settings** gear icon in the toolbar
2. Click **Choose Folder** in the Settings dialog
3. Navigate to or create a folder for this app's outlines

**Suggested folder structure:**
```
~/Documents/IdiamPro/
  ├── Dev/          (for Dev app)
  ├── Desktop/      (for Desktop app)
  └── Webapp/       (for Webapp)
```

Or use a single shared folder if you want all versions to access the same outlines:
```
~/Documents/IdiamPro/Outlines/
```

### Step 4: Grant Permission
- When prompted, click **Allow** to grant the app read/write access to the folder

### Step 5: Migration Happens Automatically
- The app will save your existing outlines to the new folder as `.idm` files
- Each outline becomes: `OutlineName.idm`

### Step 6: Verify Migration
- Check the folder you selected
- You should see `.idm` files for each of your outlines
- Open an outline in the app and make a small change to confirm saving works

---

## After Migration

### File Locations
| App Version | Storage Location |
|-------------|------------------|
| Dev | Folder you chose in Dev's Settings |
| Desktop | Folder you chose in Desktop's Settings |
| Webapp | Folder you chose in Webapp's Settings |

### File Types
| Extension | Purpose |
|-----------|---------|
| `.idm` | Individual outline file (auto-saved) |
| `.json` | Backup file containing all outlines |

### Sharing Outlines Between Apps
If you want all app versions to use the same outlines:
1. Point all three apps to the same folder in Settings
2. All versions will read/write the same `.idm` files

**Note:** If multiple apps are open simultaneously pointing to the same folder, changes may conflict. Close other versions before making changes.

---

## Troubleshooting

### Outlines not loading after migration
1. Check that the folder path is correct in Settings
2. Verify `.idm` files exist in the folder
3. Try **Restore All Outlines** from your backup

### Permission denied errors
1. Re-open Settings
2. Click **Choose Folder** again
3. Grant permission when prompted

### Need to start fresh
1. Clear the app's storage (browser dev tools → Application → Clear site data)
2. Restore from your `.json` backup file

---

*Last updated: December 2024*
