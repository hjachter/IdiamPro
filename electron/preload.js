// Preload script for Electron
// This runs in a context that has access to both Node.js and the browser DOM

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Flag to detect Electron environment
  isElectron: true,

  // Listen for new document events
  onNewDocument: (callback) => ipcRenderer.on('new-document', callback),

  // Listen for window focus events (external file change detection)
  onWindowFocus: (callback) => ipcRenderer.on('window-focus', callback),
  removeWindowFocusListener: (callback) => ipcRenderer.removeListener('window-focus', callback),

  // Directory selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getStoredDirectoryPath: () => ipcRenderer.invoke('get-stored-directory-path'),

  // File operations
  readOutlinesFromDirectory: (dirPath) => ipcRenderer.invoke('read-outlines-from-directory', dirPath),
  readOutlineMetadataFromDirectory: (dirPath) => ipcRenderer.invoke('read-outline-metadata-from-directory', dirPath),
  loadSingleOutline: (dirPath, fileName) => ipcRenderer.invoke('load-single-outline', dirPath, fileName),
  saveOutlineToFile: (dirPath, outline) => ipcRenderer.invoke('save-outline-to-file', dirPath, outline),
  deleteOutlineFile: (dirPath, fileName) => ipcRenderer.invoke('delete-outline-file', dirPath, fileName),
  renameOutlineFile: (dirPath, oldFileName, newOutline) => ipcRenderer.invoke('rename-outline-file', dirPath, oldFileName, newOutline),
  checkOutlineExists: (dirPath, fileName) => ipcRenderer.invoke('check-outline-exists', dirPath, fileName),
  loadOutlineFromFile: (dirPath, fileName) => ipcRenderer.invoke('load-outline-from-file', dirPath, fileName),
  getOutlineMtime: (dirPath, fileName) => ipcRenderer.invoke('get-outline-mtime', dirPath, fileName),

  // File operations for PDF export
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  writeFile: (filePath, data, encoding) => ipcRenderer.invoke('write-file', filePath, data, encoding),

  // Native print-to-PDF (handles large documents)
  printToPdf: (htmlContent, filePath) => ipcRenderer.invoke('print-to-pdf', htmlContent, filePath),

  // Open URL in system default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Pending imports recovery (for long-running imports that timeout)
  checkPendingImports: () => ipcRenderer.invoke('check-pending-imports'),
  deletePendingImport: (fileName) => ipcRenderer.invoke('delete-pending-import', fileName),

  // Knowledge base (superoutline)
  buildKnowledgeBase: (dirPath) => ipcRenderer.invoke('build-knowledge-base', dirPath),
  readKnowledgeBase: (dirPath) => ipcRenderer.invoke('read-knowledge-base', dirPath),

});
