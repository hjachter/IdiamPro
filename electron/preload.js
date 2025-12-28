// Preload script for Electron
// This runs in a context that has access to both Node.js and the browser DOM

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Listen for new document events
  onNewDocument: (callback) => ipcRenderer.on('new-document', callback),
});
