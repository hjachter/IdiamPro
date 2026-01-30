const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

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

// Sanitize filename (same logic as frontend)
function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
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
    },
    show: false,
  });

  // Load from localhost in development, deployed web app in production
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:9002'
    : 'https://idiam-pro.vercel.app';

  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

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
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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
      if (file.endsWith('.idm')) {
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
    const filePath = path.join(dirPath, fileName);
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
    const filePath = path.join(dirPath, fileName);
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
      if (file.endsWith('.idm')) {
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
    return { success: true };
  } catch (error) {
    console.error('Failed to save outline:', error);
    return { success: false, error: error.message };
  }
});

// Delete outline file
ipcMain.handle('delete-outline-file', async (event, dirPath, fileName) => {
  try {
    const filePath = path.join(dirPath, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted outline: ${fileName}`);
    }
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
    const oldFilePath = path.join(dirPath, oldFileName);
    const newFilePath = path.join(dirPath, newFileName);

    // If names are the same, just update content
    if (oldFileName === newFileName) {
      const content = JSON.stringify(newOutline, null, 2);
      fs.writeFileSync(newFilePath, content, 'utf-8');
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
    return { success: true };
  } catch (error) {
    console.error('Failed to rename outline:', error);
    return { success: false, error: error.message };
  }
});

// Check if outline file exists
ipcMain.handle('check-outline-exists', async (event, dirPath, fileName) => {
  try {
    const filePath = path.join(dirPath, fileName);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Failed to check outline exists:', error);
    return false;
  }
});

// Load a specific outline from file
ipcMain.handle('load-outline-from-file', async (event, dirPath, fileName) => {
  try {
    const filePath = path.join(dirPath, fileName);
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
    const filePath = path.join(pendingDir, fileName);

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
