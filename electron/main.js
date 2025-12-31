const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

function createWindow() {
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
      webSecurity: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
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

// Read all outlines from directory
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
