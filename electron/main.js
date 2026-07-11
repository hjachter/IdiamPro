const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

// ========== electron-updater ==========
// Auto-updater for the packaged macOS desktop build. The dependency
// `electron-updater` was added to package.json on 2026-06-06; if Howard hasn't
// run `npm install` yet, this require() will throw — we catch and degrade
// gracefully so the app still launches without auto-updates. The feed URL is
// configured via the `publish` section in package.json (electron-builder writes
// it into app-update.yml at package time). See Decisions Log 2026-06-06
// (Auto-updater shipped at launch).
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (err) {
  console.warn('[AutoUpdate] electron-updater not installed yet — auto-updates disabled:', err && err.message);
}

// ========== Sentry crash reporting (main + renderer) ==========
// Initialized as early as possible so startup crashes are captured.
// No-op when SENTRY_DSN is not set or NODE_ENV === 'development'.
try {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn && process.env.NODE_ENV !== 'development') {
    const Sentry = require('@sentry/electron/main');
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
      // The main-process SDK automatically captures errors from all renderer
      // processes via the Electron crashReporter + IPC bridge.
    });
  }
} catch (err) {
  console.warn('[Sentry] init skipped:', err && err.message);
}

// Track dev server process
let devServerProcess = null;

// Check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Wait for port to be available
function waitForPort(port, timeout = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for dev server'));
        } else {
          setTimeout(check, 500);
        }
      });
      socket.once('timeout', () => {
        socket.destroy();
        setTimeout(check, 500);
      });
      socket.connect(port, 'localhost');
    };
    check();
  });
}

// Start the dev server
async function startDevServer() {
  const projectPath = path.join(__dirname, '..');
  console.log('Starting dev server from:', projectPath);

  devServerProcess = spawn('npm', ['run', 'dev'], {
    cwd: projectPath,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  devServerProcess.on('error', (err) => {
    console.error('Failed to start dev server:', err);
  });

  devServerProcess.on('exit', (code) => {
    console.log('Dev server exited with code:', code);
    devServerProcess = null;
  });

  // Wait for server to be ready
  console.log('Waiting for dev server to be ready on port 9002...');
  await waitForPort(9002);
  console.log('Dev server is ready!');
}

// Forward selected Chromium flags from argv so Playwright can drive audio
// in tests. Electron does NOT auto-forward Chromium switches when they
// arrive via the second slot of process.argv — they must be re-applied with
// app.commandLine.appendSwitch() before app.whenReady() fires. We only
// honor a tiny allowlist to avoid surprises in production.
//
//   --use-fake-device-for-media-stream
//       Replaces every real input device with a synthetic one and skips
//       the OS mic permission prompt entirely. Required for headless audio.
//   --use-file-for-fake-audio-capture=<path>[%loop]
//       Streams the contents of a WAV file as the synthetic mic input.
//       %loop makes Chromium replay the file forever, which the Playwright
//       mic-icon test needs because it keeps listening for several seconds.
//
// Without this forwarding, Playwright's launch flags silently no-op and the
// renderer's AudioContext receives only silence — exactly the gap that bit
// us before (test passed, real microphone unreachable).
try {
  const argv = process.argv || [];
  for (const arg of argv) {
    if (typeof arg !== 'string') continue;
    if (arg === '--use-fake-device-for-media-stream') {
      app.commandLine.appendSwitch('use-fake-device-for-media-stream');
    } else if (arg === '--use-fake-ui-for-media-stream') {
      app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
    } else if (arg.startsWith('--use-file-for-fake-audio-capture=')) {
      const value = arg.slice('--use-file-for-fake-audio-capture='.length);
      app.commandLine.appendSwitch('use-file-for-fake-audio-capture', value);
    }
  }
} catch (e) {
  console.warn('[fake-audio] failed to forward chromium flags:', e && e.message);
}

// Set app name based on environment
if (process.env.NODE_ENV === 'development') {
  app.setName('IdiamPro Dev');
  // Set dock icon for dev mode on macOS
  if (process.platform === 'darwin') {
    app.whenReady().then(() => {
      const iconPath = path.join(__dirname, '..', 'public', 'icons', 'icon-512.png');
      app.dock.setIcon(iconPath);
    });
  }
} else {
  app.setName('IdiamPro Desktop');
}

// Path to store app settings
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return {};
}

// Save settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// ========== Automatic Backup System (legacy auto-throttle) ==========
// This is the older save-time "every 5 min" auto-backup. It is being
// superseded by the explicit snapshot system below (manual Backup button +
// auto-snapshot before AI transforms) but the throttle backup is kept for
// belt-and-suspenders protection on every save.
const BACKUP_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes between backups per outline
const MAX_BACKUPS_PER_OUTLINE = 10;
const lastBackupTime = new Map(); // outlineName -> timestamp

// ========== Snapshot System (explicit Backup / Restore feature, 2026-06-10) ==========
// Per-outline snapshot directory under [outlines]/.backups/[safe-outline-name]/.
// Each snapshot file is named [YYYY-MM-DD-HHmmss]-[optional-label].idm and
// contains a full .idm JSON dump of the outline at that moment.
// Retention cap: 20 snapshots per outline. When the 21st is written, the
// oldest snapshot file is deleted.
const SNAPSHOT_DIR_NAME = '.backups';
const MAX_SNAPSHOTS_PER_OUTLINE = 20;

function getSnapshotDirForOutline(outlinesDir, outlineSafeName) {
  return path.join(outlinesDir, SNAPSHOT_DIR_NAME, outlineSafeName);
}

function timestampForSnapshot() {
  // YYYY-MM-DD-HHmmss in local time (sorts lexicographically per outline)
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    '-' + pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function sanitizeLabelForFileName(label) {
  if (!label) return '';
  return String(label)
    .slice(0, 60)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '-');
}

function pruneSnapshotsForOutline(snapshotDir) {
  try {
    if (!fs.existsSync(snapshotDir)) return;
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.idm'))
      .sort(); // ascending by name → ascending by timestamp
    while (files.length > MAX_SNAPSHOTS_PER_OUTLINE) {
      const oldest = files.shift();
      try {
        fs.unlinkSync(path.join(snapshotDir, oldest));
        console.log('[Snapshot] Pruned oldest: ' + oldest);
      } catch (err) {
        console.warn('[Snapshot] Could not prune ' + oldest + ':', err.message);
      }
    }
  } catch (err) {
    console.warn('[Snapshot] pruneSnapshotsForOutline failed:', err.message);
  }
}

function createBackupIfNeeded(dirPath, outlineName, content) {
  try {
    const now = Date.now();
    const lastTime = lastBackupTime.get(outlineName) || 0;
    if (now - lastTime < BACKUP_THROTTLE_MS) {
      return; // Throttled — too soon since last backup
    }

    const backupDir = path.join(dirPath, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const safeName = sanitizeFileName(outlineName);
    const backupFileName = `${safeName}_backup_${timestamp}.idm`;
    const backupPath = path.join(backupDir, backupFileName);

    fs.writeFileSync(backupPath, content, 'utf-8');
    lastBackupTime.set(outlineName, now);
    console.log(`[Backup] Created: ${backupFileName}`);

    // Prune old backups asynchronously (non-blocking)
    setImmediate(() => pruneBackups(backupDir, outlineName));
  } catch (error) {
    console.warn('[Backup] Failed to create backup:', error.message);
  }
}

function pruneBackups(backupDir, outlineName) {
  try {
    const safeName = sanitizeFileName(outlineName);
    const prefix = `${safeName}_backup_`;
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith(prefix) && f.endsWith('.idm'))
      .sort()
      .reverse(); // Newest first (ISO timestamps sort lexicographically)

    const toDelete = files.slice(MAX_BACKUPS_PER_OUTLINE);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(backupDir, file));
      console.log(`[Backup] Pruned old backup: ${file}`);
    }
  } catch (error) {
    console.warn('[Backup] Failed to prune backups:', error.message);
  }
}

// ========== Knowledge Base (Superoutline) ==========
const KNOWLEDGE_BASE_FILE = '.knowledge-base.idm';
const lastKnowledgeBaseRebuildTime = new Map(); // dirPath -> timestamp
const KNOWLEDGE_BASE_THROTTLE_MS = 5 * 60 * 1000; // Same 5-minute throttle as backups

function stripHtmlForKB(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function serializeOutlineForKB(outline) {
  const parts = [];
  parts.push(`# ${outline.name}`);
  if (outline.lastModified) {
    const date = new Date(outline.lastModified).toISOString().split('T')[0];
    parts.push(`Last modified: ${date}`);
  }
  parts.push('');

  function walkNode(nodeId, depth) {
    const node = outline.nodes[nodeId];
    if (!node) return;
    if (node.type === 'canvas' || node.type === 'spreadsheet') return;

    const prefix = node.prefix ? `${node.prefix} ` : '';
    const level = Math.min(depth + 2, 6);
    const heading = '#'.repeat(level);

    if (node.type !== 'root') {
      parts.push(`${heading} ${prefix}${node.name}`);
    }

    const text = stripHtmlForKB(node.content);
    if (text) {
      parts.push(text);
    }
    parts.push('');

    if (node.childrenIds && node.childrenIds.length > 0) {
      for (const childId of node.childrenIds) {
        walkNode(childId, depth + 1);
      }
    }
  }

  walkNode(outline.rootNodeId, 0);
  return parts.join('\n');
}

function rebuildKnowledgeBase(dirPath, throttle = true) {
  try {
    if (throttle) {
      const now = Date.now();
      const lastTime = lastKnowledgeBaseRebuildTime.get(dirPath) || 0;
      if (now - lastTime < KNOWLEDGE_BASE_THROTTLE_MS) {
        return; // Throttled
      }
      lastKnowledgeBaseRebuildTime.set(dirPath, now);
    }

    const files = fs.readdirSync(dirPath);
    const sections = [];

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB — skip very large files (likely embedded media)

    for (const file of files) {
      if (!file.endsWith('.idm')) continue;
      if (file === KNOWLEDGE_BASE_FILE) continue;
      if (file.startsWith('.')) continue;

      try {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
          console.log(`[KnowledgeBase] Skipping ${file} (${(stats.size / 1024 / 1024).toFixed(0)}MB exceeds 100MB limit)`);
          continue;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const outline = JSON.parse(content);

        // Skip guide outlines
        if (outline.isGuide) continue;
        // Skip outlines with no nodes
        if (!outline.nodes || Object.keys(outline.nodes).length === 0) continue;

        sections.push(serializeOutlineForKB(outline));
      } catch (err) {
        console.warn(`[KnowledgeBase] Skipping ${file}:`, err.message);
      }
    }

    const combined = sections.join('\n---\n\n');
    const kbPath = path.join(dirPath, KNOWLEDGE_BASE_FILE);
    fs.writeFileSync(kbPath, combined, 'utf-8');
    console.log(`[KnowledgeBase] Rebuilt: ${sections.length} outlines`);
  } catch (error) {
    console.warn('[KnowledgeBase] Failed to rebuild:', error.message);
  }
}

// Sanitize filename (same logic as frontend, plus path traversal protection)
function sanitizeFileName(name) {
  return name
    .replace(/\.\./g, '_')           // Strip directory traversal sequences
    .replace(/[/\\]/g, '_')          // Strip path separators
    .replace(/[<>:"|?*\x00-\x1F]/g, '_');
}

// Validate that a resolved file path stays within the expected base directory.
// Prevents path traversal attacks (e.g. ../../etc/passwd).
function validateFilePath(basePath, ...segments) {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, ...segments);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`Path traversal blocked: ${segments.join('/')} escapes ${basePath}`);
  }
  return resolvedTarget;
}

// Get outline filename
function getOutlineFileName(outline) {
  return `${sanitizeFileName(outline.name)}.idm`;
}

let mainWindow;

async function createWindow() {
  // In development mode, check if dev server is running and start it if not
  if (process.env.NODE_ENV === 'development') {
    const portInUse = await isPortInUse(9002);
    if (!portInUse) {
      console.log('Dev server not running, starting it...');
      await startDevServer();
    } else {
      console.log('Dev server already running on port 9002');
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#242424', // macOS dark mode gray
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: process.env.NODE_ENV !== 'development', // Allow canvas operations in dev
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Enable webview tag for in-app YouTube/Google browsing
      // Allow getUserMedia / Web Speech API in the renderer (voice input feature).
      // Without these, Chromium's hardening blocks microphone access.
      enableBlinkFeatures: 'AudioCapture,MediaStreamAPI',
    },
    show: false,
  });

  // ========== Microphone / media permission handlers ==========
  // Chromium-in-Electron defaults to DENY for media/microphone permission
  // requests, which silently breaks the Web Speech API used by voice input
  // (Cmd+K AI command bar and Help chat). Grant the renderer access here.
  const sess = mainWindow.webContents.session;
  const allowedMediaPermissions = new Set([
    'media',
    'mediaKeySystem',
    'microphone',
    'audioCapture',
    'videoCapture',
    'display-capture',
  ]);
  sess.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (allowedMediaPermissions.has(permission)) {
      callback(true);
      return;
    }
    // Default-allow other safe permissions used by the app.
    callback(true);
  });
  sess.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (allowedMediaPermissions.has(permission)) return true;
    return true;
  });

  // On macOS, request the system-level microphone authorization once on startup.
  // Without TCC approval, getUserMedia() returns "permission denied" even with
  // the Electron handlers above. No-op when already granted or denied.
  if (process.platform === 'darwin' && systemPreferences && systemPreferences.askForMediaAccess) {
    try {
      const status = systemPreferences.getMediaAccessStatus
        ? systemPreferences.getMediaAccessStatus('microphone')
        : 'not-determined';
      if (status !== 'granted' && status !== 'denied') {
        systemPreferences.askForMediaAccess('microphone').catch(() => {});
      }
    } catch (err) {
      console.warn('[Mic] askForMediaAccess failed:', err && err.message);
    }
  }

  // Load from localhost in development, deployed web app in production
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:9002/app'
    : 'https://idiam-pro.vercel.app/app';

  mainWindow.loadURL(startUrl);

  // Let macOS dictation (double-press Fn) work by not consuming function key events.
  // Electron's Chromium layer can swallow key-before-input events, blocking dictation.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Pass through all function keys (F1-F24) and the Fn key itself
    if (input.key && (input.key.startsWith('F') && /^F\d+$/.test(input.key))) {
      event.preventDefault(); // Tell Electron not to handle it — let macOS process it
    }
  });

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Register the auto-updater once the window is showing. Skipped in dev
    // mode and when electron-updater isn't installed (see registerAutoUpdater).
    registerAutoUpdater();
  });

  // Force layout repaints after the page finishes loading.
  // In dev mode, ready-to-show fires before Next.js compiles the page,
  // so the content may not paint until a resize triggers a relayout.
  // Multiple delayed repaints handle both initial load and Cmd+R reload,
  // where JS bundles compile after did-finish-load fires.
  mainWindow.webContents.on('did-finish-load', () => {
    const nudge = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const [w, h] = mainWindow.getSize();
        mainWindow.setSize(w + 1, h);
        mainWindow.setSize(w, h);
      }
    };
    nudge();                          // Immediate nudge for fast loads
    setTimeout(nudge, 1500);          // After JS bundles compile
    setTimeout(nudge, 4000);          // After slow dev recompilations
  });

  // DevTools available via View > Toggle Developer Tools (Cmd+Option+I)
  // Not opened automatically to keep the window clean

  // Auto-recover from ChunkLoadError (stale webpack chunks after dev rebuild)
  let chunkErrorReloadTimer = null;
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Detect ChunkLoadError and auto-reload after a short debounce
    if (level >= 2 && message.includes('ChunkLoadError') && !chunkErrorReloadTimer) {
      console.log('[IdiamPro] ChunkLoadError detected — auto-reloading in 1s...');
      chunkErrorReloadTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reload();
        }
        chunkErrorReloadTimer = null;
      }, 1000);
    }

    // Capture browser console errors to a debug file
    const debugLogPath = path.join(app.getPath('home'), 'Documents', 'IDM Outlines', '.browser-errors.log');
    if (level >= 0) {
      const entry = `[${new Date().toISOString()}] L${level}: ${message}\n  at ${sourceId}:${line}\n`;
      try { fs.appendFileSync(debugLogPath, entry); } catch {}
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Notify renderer when window regains focus (for external file change detection)
  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focus');
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const appName = process.env.NODE_ENV === 'development' ? 'IdiamPro Dev' : 'IdiamPro';

  const template = [
    // macOS App Menu (required for proper HIG compliance)
    ...(isMac ? [{
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-preferences');
            }
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Outline',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('new-document');
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' },
        ] : [
          { role: 'close' },
        ]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'IdiamPro Help',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://idiam-pro.vercel.app');
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: async () => {
            // Tell the renderer a manual check is starting so it can show a
            // brief "Checking…" toast. The IPC handler does the real work.
            sendToRenderer('update-check-started', {});
            if (!autoUpdater || !app.isPackaged) {
              sendToRenderer('update-check-failed', {
                message: app.isPackaged
                  ? "Auto-updater isn't available in this build."
                  : "Updates only run in the packaged desktop build.",
              });
              return;
            }
            try {
              manualCheckInProgress = true;
              await autoUpdater.checkForUpdates();
            } catch (err) {
              manualCheckInProgress = false;
              sendToRenderer('update-check-failed', {
                message: (err && err.message) || 'Check failed.',
              });
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ========== Auto-updater wiring ==========
// Silent check on launch (8s delay), silent download, NON-INTRUSIVE banner in
// the renderer when the download finishes (see src/components/update-banner.tsx).
// Periodic re-check every 4 hours while the app stays open. Skipped entirely in
// dev mode (the updater cannot update a dev build, and trying logs confusing
// errors). Manual "Check for Updates…" in the Help menu fires checkForUpdates()
// on demand.

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const UPDATE_INITIAL_DELAY_MS = 8000; // 8s after window-ready
let updateCheckTimer = null;
let updateAvailableInfo = null; // populated on 'update-available'
let updateDownloadedInfo = null; // populated on 'update-downloaded'
// Tracks whether the most recent check was initiated by the user from the
// Help menu — used to surface a friendly "you're on the latest version" toast
// when no update is available.
let manualCheckInProgress = false;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function registerAutoUpdater() {
  if (!autoUpdater) {
    console.log('[AutoUpdate] Skipped — electron-updater not loaded.');
    return;
  }
  if (!app.isPackaged) {
    console.log('[AutoUpdate] Skipped — dev mode (not packaged). Updates only run in packaged builds.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...args) => console.log('[AutoUpdate]', ...args),
    warn: (...args) => console.warn('[AutoUpdate]', ...args),
    error: (...args) => console.error('[AutoUpdate]', ...args),
    debug: () => {},
  };

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdate] Checking for update…');
  });
  autoUpdater.on('update-available', (info) => {
    updateAvailableInfo = info || null;
    console.log('[AutoUpdate] Update available:', info && info.version);
    // Download starts automatically; nothing further to do.
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdate] No update available. Current version is latest.');
    if (manualCheckInProgress) {
      manualCheckInProgress = false;
      sendToRenderer('update-not-available', { currentVersion: app.getVersion() });
    }
  });
  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdate] Error (non-fatal):', err && err.message);
    if (manualCheckInProgress) {
      manualCheckInProgress = false;
      sendToRenderer('update-check-failed', { message: (err && err.message) || 'Update check failed' });
    }
  });
  autoUpdater.on('download-progress', (progress) => {
    // Optional future use — currently silent so we don't distract the user.
    if (progress && typeof progress.percent === 'number') {
      console.log('[AutoUpdate] Download progress:', Math.round(progress.percent) + '%');
    }
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloadedInfo = info || null;
    console.log('[AutoUpdate] Update downloaded:', info && info.version);
    manualCheckInProgress = false;
    sendToRenderer('update-downloaded', {
      version: (info && info.version) || null,
      releaseNotes: (info && info.releaseNotes) || null,
    });
  });

  // First check after a delay so we don't compete with startup work.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[AutoUpdate] Initial check failed:', err && err.message);
    });
  }, UPDATE_INITIAL_DELAY_MS);

  // Recurring check every 4 hours.
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[AutoUpdate] Periodic check failed:', err && err.message);
    });
  }, UPDATE_CHECK_INTERVAL_MS);
}

// IPC: renderer asks the main process to install the downloaded update and
// relaunch. Called when the user clicks "Restart now" in the update banner.
ipcMain.handle('restart-to-update', async () => {
  if (!autoUpdater) {
    return { ok: false, error: 'Auto-updater is not available in this build.' };
  }
  if (!updateDownloadedInfo) {
    return { ok: false, error: 'No update has been downloaded yet.' };
  }
  try {
    // isSilent=true (no installer UI), isForceRunAfter=true (relaunch after install)
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  } catch (err) {
    console.error('[AutoUpdate] quitAndInstall failed:', err);
    return { ok: false, error: (err && err.message) || 'Failed to relaunch.' };
  }
});

// IPC: renderer requests a manual check. Called from the Help menu item or
// from a future Settings → "Check for Updates" button if Howard ever adds one.
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) {
    return { ok: false, error: 'Auto-updater is not available in this build.' };
  }
  if (!app.isPackaged) {
    return { ok: false, error: 'Updates only run in the packaged desktop build.' };
  }
  try {
    manualCheckInProgress = true;
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    manualCheckInProgress = false;
    console.warn('[AutoUpdate] Manual check failed:', err && err.message);
    return { ok: false, error: (err && err.message) || 'Check failed.' };
  }
});

// IPC: renderer asks for the current app version (for display in the banner
// or About surface). Always available regardless of updater state.
ipcMain.handle('get-app-version', async () => {
  return { version: app.getVersion() };
});

// ========== IPC Handlers for File System Operations ==========

// Select directory using native dialog
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Outline Storage Folder',
    buttonLabel: 'Select Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const dirPath = result.filePaths[0];

  // Store the selected directory in settings
  const settings = loadSettings();
  settings.outlinesDirectory = dirPath;
  saveSettings(settings);

  return dirPath;
});

// Get stored directory path
ipcMain.handle('get-stored-directory-path', () => {
  const settings = loadSettings();
  return settings.outlinesDirectory || null;
});

// Read outline metadata only (for lazy loading - fast startup)
// Returns lightweight metadata without loading full node content
ipcMain.handle('read-outline-metadata-from-directory', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    const metadataList = [];

    for (const file of files) {
      if (file.endsWith('.idm') && file !== KNOWLEDGE_BASE_FILE) {
        try {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);

          // For small files (<1MB), load fully - it's fast enough
          // For large files, extract just the metadata we need
          const LAZY_LOAD_THRESHOLD = 1 * 1024 * 1024; // 1MB

          if (stats.size < LAZY_LOAD_THRESHOLD) {
            // Small file - load fully
            const content = fs.readFileSync(filePath, 'utf-8');
            const outline = JSON.parse(content);
            metadataList.push({
              ...outline,
              _fileSize: stats.size,
              _fileName: file,
              _isLazyLoaded: false,
            });
          } else {
            // Large file - read only first chunk to extract metadata
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(4096); // Read first 4KB
            fs.readSync(fd, buffer, 0, 4096, 0);
            fs.closeSync(fd);

            const partialContent = buffer.toString('utf-8');

            // Extract id, name, rootNodeId from the beginning of the JSON
            const idMatch = partialContent.match(/"id"\s*:\s*"([^"]+)"/);
            const nameMatch = partialContent.match(/"name"\s*:\s*"([^"]+)"/);
            const rootNodeIdMatch = partialContent.match(/"rootNodeId"\s*:\s*"([^"]+)"/);
            const isGuideMatch = partialContent.match(/"isGuide"\s*:\s*(true|false)/);
            const lastModifiedMatch = partialContent.match(/"lastModified"\s*:\s*(\d+)/);

            // Estimate node count from file size (rough: ~5KB per node on average)
            const estimatedNodeCount = Math.round(stats.size / 5000);

            metadataList.push({
              id: idMatch ? idMatch[1] : file.replace('.idm', ''),
              name: nameMatch ? nameMatch[1] : file.replace('.idm', ''),
              rootNodeId: rootNodeIdMatch ? rootNodeIdMatch[1] : 'root',
              nodes: {}, // Empty - will be loaded on demand
              isGuide: isGuideMatch ? isGuideMatch[1] === 'true' : false,
              lastModified: lastModifiedMatch ? parseInt(lastModifiedMatch[1]) : stats.mtimeMs,
              _fileSize: stats.size,
              _fileName: file,
              _isLazyLoaded: true,
              _estimatedNodeCount: estimatedNodeCount,
            });

            console.log(`[Lazy] Deferred loading of ${file} (${(stats.size / 1024 / 1024).toFixed(1)}MB, ~${estimatedNodeCount} nodes)`);
          }
        } catch (error) {
          console.error(`Failed to load metadata for ${file}:`, error);
        }
      }
    }

    return { success: true, outlines: metadataList };
  } catch (error) {
    console.error('Failed to read outline metadata from directory:', error);
    return { success: false, error: error.message };
  }
});

// Load a single outline fully (for lazy-loaded outlines)
ipcMain.handle('load-single-outline', async (event, dirPath, fileName) => {
  try {
    const filePath = validateFilePath(dirPath, fileName);
    console.log(`[Lazy] Loading full outline: ${fileName}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const outline = JSON.parse(content);
    const stats = fs.statSync(filePath);
    console.log(`[Lazy] Loaded ${fileName}: ${Object.keys(outline.nodes || {}).length} nodes`);
    return {
      success: true,
      outline: {
        ...outline,
        _fileSize: stats.size,
        _fileName: fileName,
        _isLazyLoaded: false,
      }
    };
  } catch (error) {
    console.error(`Failed to load outline ${fileName}:`, error);
    return { success: false, error: error.message };
  }
});

// Get file modification time for an outline (for external change detection)
ipcMain.handle('get-outline-mtime', async (event, dirPath, fileName) => {
  try {
    const filePath = validateFilePath(dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    const stats = fs.statSync(filePath);
    return { success: true, mtimeMs: stats.mtimeMs };
  } catch (error) {
    console.error('Failed to get outline mtime:', error);
    return { success: false, error: error.message };
  }
});

// Read all outlines from directory (legacy - full load)
ipcMain.handle('read-outlines-from-directory', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    const outlines = [];

    for (const file of files) {
      if (file.endsWith('.idm') && file !== KNOWLEDGE_BASE_FILE) {
        try {
          const filePath = path.join(dirPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const outline = JSON.parse(content);
          outlines.push(outline);
        } catch (error) {
          console.error(`Failed to load ${file}:`, error);
        }
      }
    }

    return { success: true, outlines };
  } catch (error) {
    console.error('Failed to read outlines from directory:', error);
    return { success: false, error: error.message };
  }
});

// Save outline to file
ipcMain.handle('save-outline-to-file', async (event, dirPath, outline) => {
  try {
    const fileName = getOutlineFileName(outline);
    const filePath = path.join(dirPath, fileName);
    const content = JSON.stringify(outline, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Saved outline: ${fileName}`);
    createBackupIfNeeded(dirPath, outline.name, content);
    setImmediate(() => rebuildKnowledgeBase(dirPath));
    return { success: true };
  } catch (error) {
    console.error('Failed to save outline:', error);
    return { success: false, error: error.message };
  }
});

// Delete outline file
ipcMain.handle('delete-outline-file', async (event, dirPath, fileName) => {
  try {
    const filePath = validateFilePath(dirPath, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted outline: ${fileName}`);
    }
    setImmediate(() => rebuildKnowledgeBase(dirPath, false));
    return { success: true };
  } catch (error) {
    console.error('Failed to delete outline:', error);
    return { success: false, error: error.message };
  }
});

// Rename outline file
ipcMain.handle('rename-outline-file', async (event, dirPath, oldFileName, newOutline) => {
  try {
    const newFileName = getOutlineFileName(newOutline);
    const oldFilePath = validateFilePath(dirPath, oldFileName);
    const newFilePath = validateFilePath(dirPath, newFileName);

    // If names are the same, just update content
    if (oldFileName === newFileName) {
      const content = JSON.stringify(newOutline, null, 2);
      fs.writeFileSync(newFilePath, content, 'utf-8');
      createBackupIfNeeded(dirPath, newOutline.name, content);
      return { success: true };
    }

    // Delete old file if it exists
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // Write new file
    const content = JSON.stringify(newOutline, null, 2);
    fs.writeFileSync(newFilePath, content, 'utf-8');
    console.log(`Renamed: ${oldFileName} -> ${newFileName}`);
    createBackupIfNeeded(dirPath, newOutline.name, content);
    setImmediate(() => rebuildKnowledgeBase(dirPath));
    return { success: true };
  } catch (error) {
    console.error('Failed to rename outline:', error);
    return { success: false, error: error.message };
  }
});

// Check if outline file exists
ipcMain.handle('check-outline-exists', async (event, dirPath, fileName) => {
  try {
    const filePath = validateFilePath(dirPath, fileName);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Failed to check outline exists:', error);
    return false;
  }
});

// Load a specific outline from file
ipcMain.handle('load-outline-from-file', async (event, dirPath, fileName) => {
  try {
    const filePath = validateFilePath(dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const outline = JSON.parse(content);
    return { success: true, outline };
  } catch (error) {
    console.error('Failed to load outline from file:', error);
    return { success: false, error: error.message };
  }
});

// Open file with default application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    const result = await shell.openPath(filePath);
    if (result) {
      console.error('Failed to open file:', result);
      return { success: false, error: result };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to open file:', error);
    return { success: false, error: error.message };
  }
});

// Open URL in system default browser
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

// Save file dialog and return the chosen path
ipcMain.handle('save-file-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
  });

  if (result.canceled) {
    return null;
  }
  return result.filePath;
});

// Write file to disk
ipcMain.handle('write-file', async (event, filePath, data, encoding) => {
  console.log('write-file called:', filePath, 'encoding:', encoding, 'data length:', data?.length || 0);
  try {
    if (encoding === 'base64') {
      // Decode base64 and write as binary
      const buffer = Buffer.from(data, 'base64');
      console.log('Decoded buffer size:', buffer.length, 'bytes');
      fs.writeFileSync(filePath, buffer);
      console.log('File written successfully');
    } else {
      fs.writeFileSync(filePath, data, encoding || 'utf-8');
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to write file:', error);
    return { success: false, error: error.message };
  }
});

// Print HTML content to PDF using Electron's native PDF engine
ipcMain.handle('print-to-pdf', async (event, htmlContent, filePath) => {
  console.log('print-to-pdf called, filePath:', filePath);

  try {
    // Create a hidden window to render the HTML
    const printWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Load the HTML content
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF
    const pdfData = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5,
      },
    });

    console.log('PDF generated, size:', pdfData.length, 'bytes');

    // Write PDF to file
    fs.writeFileSync(filePath, pdfData);
    console.log('PDF saved to:', filePath);

    // Close the print window
    printWindow.close();

    // Open in Preview
    const openResult = await shell.openPath(filePath);
    if (openResult) {
      console.warn('Could not open PDF:', openResult);
    }

    return { success: true };
  } catch (error) {
    console.error('print-to-pdf failed:', error);
    return { success: false, error: error.message };
  }
});

// ========== Knowledge Base IPC Handlers ==========

// Force rebuild the knowledge base
ipcMain.handle('build-knowledge-base', async (event, dirPath) => {
  try {
    rebuildKnowledgeBase(dirPath, false); // unthrottled
    return { success: true };
  } catch (error) {
    console.error('Failed to build knowledge base:', error);
    return { success: false, error: error.message };
  }
});

// Read the knowledge base file
ipcMain.handle('read-knowledge-base', async (event, dirPath) => {
  try {
    const kbPath = path.join(dirPath, KNOWLEDGE_BASE_FILE);
    if (!fs.existsSync(kbPath)) {
      // Build it first if missing
      rebuildKnowledgeBase(dirPath, false);
    }
    if (fs.existsSync(kbPath)) {
      const content = fs.readFileSync(kbPath, 'utf-8');
      return { success: true, content };
    }
    return { success: true, content: '' };
  } catch (error) {
    console.error('Failed to read knowledge base:', error);
    return { success: false, error: error.message };
  }
});

// ========== Pending Imports Recovery ==========

// Check for pending import results (for long-running imports that timeout)
ipcMain.handle('check-pending-imports', async () => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: true, pendingImports: [] };
    }

    const pendingDir = path.join(outlinesDir, '.pending');
    if (!fs.existsSync(pendingDir)) {
      return { success: true, pendingImports: [] };
    }

    const files = fs.readdirSync(pendingDir);
    const pendingImports = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(pendingDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          pendingImports.push({
            ...data,
            fileName: file,
          });
        } catch (error) {
          console.error(`Failed to load pending import ${file}:`, error);
        }
      }
    }

    console.log(`[Pending] Found ${pendingImports.length} pending import(s)`);
    return { success: true, pendingImports };
  } catch (error) {
    console.error('Failed to check pending imports:', error);
    return { success: false, error: error.message };
  }
});

// Delete a pending import file after recovery
ipcMain.handle('delete-pending-import', async (event, fileName) => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: false, error: 'No outlines directory configured' };
    }

    const pendingDir = path.join(outlinesDir, '.pending');
    const filePath = validateFilePath(pendingDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Pending] Deleted pending import: ${fileName}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete pending import:', error);
    return { success: false, error: error.message };
  }
});

// Clear all pending import files (called after a successful import reaches the client)
ipcMain.handle('clear-all-pending-imports', async () => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: true, deleted: 0 };
    }

    const pendingDir = path.join(outlinesDir, '.pending');
    if (!fs.existsSync(pendingDir)) {
      return { success: true, deleted: 0 };
    }

    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      fs.unlinkSync(path.join(pendingDir, file));
    }
    console.log(`[Pending] Cleared ${files.length} pending import file(s)`);
    return { success: true, deleted: files.length };
  } catch (error) {
    console.error('Failed to clear pending imports:', error);
    return { success: false, error: error.message };
  }
});

// ========== Unmerge Backup ==========

// Save a pre-merge snapshot so the Unmerge button survives app restarts
ipcMain.handle('save-unmerge-backup', async (event, backupData) => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: false, error: 'No outlines directory configured' };
    }

    const unmergeDir = path.join(outlinesDir, '.unmerge');
    fs.mkdirSync(unmergeDir, { recursive: true });

    const filePath = path.join(unmergeDir, 'backup.json');
    fs.writeFileSync(filePath, JSON.stringify(backupData), 'utf-8');
    console.log('[Unmerge] Saved backup for outline:', backupData.outlineName);
    return { success: true };
  } catch (error) {
    console.error('[Unmerge] Failed to save backup:', error);
    return { success: false, error: error.message };
  }
});

// Load the unmerge backup (or null if none exists)
ipcMain.handle('load-unmerge-backup', async () => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: true, backup: null };
    }

    const filePath = path.join(outlinesDir, '.unmerge', 'backup.json');
    if (!fs.existsSync(filePath)) {
      return { success: true, backup: null };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const backup = JSON.parse(content);
    console.log('[Unmerge] Loaded backup for outline:', backup.outlineName);
    return { success: true, backup };
  } catch (error) {
    console.error('[Unmerge] Failed to load backup:', error);
    return { success: false, error: error.message };
  }
});

// Delete the unmerge backup
ipcMain.handle('delete-unmerge-backup', async () => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: true };
    }

    const filePath = path.join(outlinesDir, '.unmerge', 'backup.json');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[Unmerge] Deleted backup');
    }
    return { success: true };
  } catch (error) {
    console.error('[Unmerge] Failed to delete backup:', error);
    return { success: false, error: error.message };
  }
});

// ========== Outline snapshots (Backup / Restore feature, 2026-06-10) ==========
// Snapshots live at [outlinesDir]/.backups/[safe-outline-name]/[stamp]-[label].idm
// The renderer calls these IPC handlers directly via electronAPI in preload.

// Write a snapshot of the given outline. The outline payload should be the
// full serialized Outline JSON the app holds in memory.
ipcMain.handle('snapshot-create', async (event, args) => {
  try {
    const { outline, label, kind } = args || {};
    if (!outline || !outline.id || !outline.name) {
      return { success: false, error: 'Outline payload missing id/name' };
    }
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: false, error: 'No outlines directory configured' };
    }
    const safeName = sanitizeFileName(outline.name);
    const snapshotDir = getSnapshotDirForOutline(outlinesDir, safeName);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const stamp = timestampForSnapshot();
    const safeLabel = sanitizeLabelForFileName(label || '');
    const fileName = safeLabel
      ? stamp + '-' + safeLabel + '.idm'
      : stamp + '.idm';
    const filePath = path.join(snapshotDir, fileName);

    const content = JSON.stringify(outline, null, 2);
    // Atomic-ish write: write to .tmp, then rename
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);

    // Side file storing the original (unsanitized) label and kind so the
    // Restore dialog can display them faithfully.
    const meta = {
      label: label || '',
      kind: kind || 'manual', // 'manual' | 'auto-transform' | 'auto-restore'
      createdAt: Date.now(),
      outlineId: outline.id,
      outlineName: outline.name,
    };
    try {
      fs.writeFileSync(filePath + '.meta.json', JSON.stringify(meta), 'utf-8');
    } catch (err) {
      console.warn('[Snapshot] Could not write meta:', err.message);
    }

    pruneSnapshotsForOutline(snapshotDir);

    const stats = fs.statSync(filePath);
    console.log('[Snapshot] Created: ' + fileName + ' (' + stats.size + ' bytes)');
    return {
      success: true,
      snapshot: {
        fileName,
        filePath,
        size: stats.size,
        createdAt: meta.createdAt,
        label: meta.label,
        kind: meta.kind,
      },
    };
  } catch (error) {
    console.error('[Snapshot] create failed:', error);
    return { success: false, error: error.message };
  }
});

// List snapshots for a single outline (by name, since that's how they're keyed)
ipcMain.handle('snapshot-list', async (event, args) => {
  try {
    const { outlineName } = args || {};
    if (!outlineName) {
      return { success: false, error: 'outlineName required' };
    }
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: true, snapshots: [] };
    }
    const safeName = sanitizeFileName(outlineName);
    const snapshotDir = getSnapshotDirForOutline(outlinesDir, safeName);
    if (!fs.existsSync(snapshotDir)) {
      return { success: true, snapshots: [] };
    }
    const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.idm'));
    const snapshots = [];
    for (const file of files) {
      try {
        const filePath = path.join(snapshotDir, file);
        const stats = fs.statSync(filePath);
        let meta = { label: '', kind: 'manual', createdAt: stats.mtimeMs };
        const metaPath = filePath + '.meta.json';
        if (fs.existsSync(metaPath)) {
          try {
            meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf-8')) };
          } catch {}
        }
        snapshots.push({
          fileName: file,
          size: stats.size,
          createdAt: meta.createdAt || stats.mtimeMs,
          label: meta.label || '',
          kind: meta.kind || 'manual',
        });
      } catch (err) {
        console.warn('[Snapshot] Could not stat ' + file + ':', err.message);
      }
    }
    // Newest first
    snapshots.sort((a, b) => b.createdAt - a.createdAt);
    return { success: true, snapshots };
  } catch (error) {
    console.error('[Snapshot] list failed:', error);
    return { success: false, error: error.message };
  }
});

// Read a single snapshot's full content (for preview or restore)
ipcMain.handle('snapshot-read', async (event, args) => {
  try {
    const { outlineName, fileName } = args || {};
    if (!outlineName || !fileName) {
      return { success: false, error: 'outlineName and fileName required' };
    }
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: false, error: 'No outlines directory configured' };
    }
    const safeName = sanitizeFileName(outlineName);
    const snapshotDir = getSnapshotDirForOutline(outlinesDir, safeName);
    const filePath = validateFilePath(snapshotDir, fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Snapshot not found' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const outline = JSON.parse(content);
    return { success: true, outline };
  } catch (error) {
    console.error('[Snapshot] read failed:', error);
    return { success: false, error: error.message };
  }
});

// Delete a single snapshot
ipcMain.handle('snapshot-delete', async (event, args) => {
  try {
    const { outlineName, fileName } = args || {};
    if (!outlineName || !fileName) {
      return { success: false, error: 'outlineName and fileName required' };
    }
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: false, error: 'No outlines directory configured' };
    }
    const safeName = sanitizeFileName(outlineName);
    const snapshotDir = getSnapshotDirForOutline(outlinesDir, safeName);
    const filePath = validateFilePath(snapshotDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const metaPath = filePath + '.meta.json';
    if (fs.existsSync(metaPath)) {
      try { fs.unlinkSync(metaPath); } catch {}
    }
    return { success: true };
  } catch (error) {
    console.error('[Snapshot] delete failed:', error);
    return { success: false, error: error.message };
  }
});

// Open the backups folder in Finder / file explorer
ipcMain.handle('snapshot-show-folder', async () => {
  try {
    const settings = loadSettings();
    const outlinesDir = settings.outlinesDirectory;
    if (!outlinesDir) {
      return { success: false, error: 'No outlines directory configured' };
    }
    const backupsDir = path.join(outlinesDir, SNAPSHOT_DIR_NAME);
    fs.mkdirSync(backupsDir, { recursive: true });
    const result = await shell.openPath(backupsDir);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true, path: backupsDir };
  } catch (error) {
    console.error('[Snapshot] show-folder failed:', error);
    return { success: false, error: error.message };
  }
});

// ========== Apple Mail Email Fetch ==========

ipcMain.handle('fetch-apple-mail-content', async (event, messageId) => {
  if (process.platform !== 'darwin') return null;

  return new Promise((resolve) => {
    // Use Mail's current selection (the dragged email is still selected)
    const script = `
tell application "Mail"
  set sel to selection
  if (count of sel) > 0 then
    set msg to item 1 of sel
    set msgSubject to subject of msg
    set msgSender to sender of msg
    set msgDate to date received of msg as string
    set msgBody to content of msg
    return "---SUBJECT---" & return & msgSubject & return & "---FROM---" & return & msgSender & return & "---DATE---" & return & msgDate & return & "---BODY---" & return & msgBody
  end if
  return "NOT_FOUND"
end tell`;

    console.log('[Mail] Fetching email content via AppleScript...');
    const child = spawn('osascript', ['-e', script]);
    let stdout = '';
    let stderr = '';
    let settled = false;
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Normalize AppleScript \r line endings to \n
      stdout = stdout.replace(/\r\n?/g, '\n');
      if (code !== 0 || stdout.trim() === 'NOT_FOUND') {
        console.log('[Mail] Could not fetch email. code:', code, 'stderr:', stderr);
        resolve(null);
      } else {
        console.log('[Mail] Got email content, length:', stdout.length);
        const result = {};
        const sections = stdout.split(/---(\w+)---\n/);
        for (let i = 1; i < sections.length; i += 2) {
          result[sections[i].toLowerCase()] = (sections[i + 1] || '').trim();
        }
        console.log('[Mail] Parsed keys:', Object.keys(result));
        resolve(result);
      }
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      console.log('[Mail] AppleScript timed out');
      resolve(null);
    }, 15000);
  });
});

// ========== Ollama installation check / launch ==========
// Distinguishes "Ollama.app is installed but the background service isn't
// running" from "Ollama is not installed at all" so the UI can show the
// right call to action ("Start Ollama" vs "Install Ollama").

ipcMain.handle('check-ollama-installation', async () => {
  try {
    const platform = process.platform; // 'darwin' | 'win32' | 'linux' | ...
    if (platform === 'darwin') {
      const installed = fs.existsSync('/Applications/Ollama.app');
      return { installed, platform };
    }
    // Windows / Linux detection is not implemented yet — treat as not-installed
    // so the existing "Install Ollama" UX is shown.
    return { installed: false, platform };
  } catch (error) {
    console.error('[Ollama] check-ollama-installation failed:', error);
    return { installed: false, platform: process.platform };
  }
});

ipcMain.handle('start-ollama', async () => {
  try {
    if (process.platform !== 'darwin') {
      return { ok: false, error: 'start-ollama is only supported on macOS right now' };
    }
    // shell.openPath returns '' on success and an error string on failure.
    // Opening Ollama.app starts the background ollama service.
    const result = await shell.openPath('/Applications/Ollama.app');
    if (result) {
      console.error('[Ollama] start-ollama failed:', result);
      return { ok: false, error: result };
    }
    return { ok: true };
  } catch (error) {
    console.error('[Ollama] start-ollama threw:', error);
    return { ok: false, error: (error && error.message) || String(error) };
  }
});

// ========== Video Generation IPC (Phase 1 — faceless slideshow) ==========

// Lazily require the generator so a missing ffmpeg dep can't break app startup.
let __videoGenerator = null;
function getVideoGenerator() {
  if (!__videoGenerator) {
    __videoGenerator = require('./video-generator');
  }
  return __videoGenerator;
}

ipcMain.handle('generate-slideshow-video', async (event, args) => {
  try {
    const { generateSlideshowVideo } = getVideoGenerator();
    // Pipe live render progress back to the renderer that started this call, so
    // the Generate Video dialog can drive a real progress bar + time estimate.
    const onProgress = (payload) => {
      try { event.sender.send('generate-video-progress', payload); } catch { /* renderer gone */ }
    };
    return await generateSlideshowVideo({ ...(args || {}), onProgress });
  } catch (error) {
    console.error('[VideoGen] generate-slideshow-video failed:', error);
    return { success: false, error: (error && error.message) || String(error) };
  }
});

// Exposed on global so automated tests can drive the pipeline directly in the
// main process via electronApp.evaluate() without needing full UI wiring.
global.__generateSlideshowVideo = async (args) => {
  const { generateSlideshowVideo } = getVideoGenerator();
  return generateSlideshowVideo(args || {});
};

// ========== Podcast Audio IPC (voice parity with Video) ==========

// Lazily require the podcast generator (mirrors the video-generator pattern) so
// a missing ffmpeg dep can't break app startup.
let __podcastGenerator = null;
function getPodcastGenerator() {
  if (!__podcastGenerator) {
    __podcastGenerator = require('./podcast-generator');
  }
  return __podcastGenerator;
}

ipcMain.handle('generate-podcast-audio', async (event, args) => {
  try {
    const { generatePodcastAudio } = getPodcastGenerator();
    // Pipe live synthesis progress back to the renderer that started this call.
    const onProgress = (payload) => {
      try { event.sender.send('generate-podcast-progress', payload); } catch { /* renderer gone */ }
    };
    return await generatePodcastAudio({ ...(args || {}), onProgress });
  } catch (error) {
    console.error('[PodcastGen] generate-podcast-audio failed:', error);
    return { success: false, error: (error && error.message) || String(error) };
  }
});

// Exposed on global so automated tests can drive synthesis directly in the main
// process via electronApp.evaluate() without needing full UI wiring.
global.__generatePodcastAudio = async (args) => {
  const { generatePodcastAudio } = getPodcastGenerator();
  return generatePodcastAudio(args || {});
};

// Test hook: resolve the DISTINCT macOS `say` voices that would be assigned to a
// set of OpenAI voices, so a test can prove two speakers get two different voices.
global.__pickPodcastSayVoices = (voices) => {
  const { __test } = getPodcastGenerator();
  return __test.pickSayVoices(Array.isArray(voices) ? voices : []);
};

// ========== App Lifecycle ==========

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

// Clean up dev server when app quits
app.on('before-quit', () => {
  if (devServerProcess) {
    console.log('Stopping dev server...');
    devServerProcess.kill();
    devServerProcess = null;
  }
});
