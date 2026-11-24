const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('stemLocal', {
  pickAudio: () => ipcRenderer.invoke('pick-audio'),
  pickOutput: () => ipcRenderer.invoke('pick-output'),
  readTrack: filePath => ipcRenderer.invoke('read-track', filePath),
  pathForFile: file => webUtils.getPathForFile(file),
  engineInfo: () => ipcRenderer.invoke('engine-info'),
  separate: options => ipcRenderer.invoke('separate', options),
  cancel: () => ipcRenderer.invoke('cancel-separation'),
  openFolder: folder => ipcRenderer.invoke('open-folder', folder),
  onLog: callback => ipcRenderer.on('separation-log', (_, value) => callback(value)),
  onDone: callback => ipcRenderer.on('separation-done', (_, value) => callback(value))
});
