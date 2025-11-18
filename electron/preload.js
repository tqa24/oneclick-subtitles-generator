const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File operations
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Service management
  startServices: () => ipcRenderer.invoke('start-services'),
  stopServices: () => ipcRenderer.invoke('stop-services'),
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  
  // Service event listeners
  onServiceLog: (callback) => {
    ipcRenderer.on('service-log', (event, data) => callback(data));
  },
  
  onServiceStatus: (callback) => {
    ipcRenderer.on('service-status', (event, data) => callback(data));
  },
  
  onServicesReady: (callback) => {
    ipcRenderer.on('services-ready', (event, data) => callback(data));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Add version information for development
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('devAPI', {
    openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
    reloadWindow: () => ipcRenderer.invoke('reload-window')
  });
}