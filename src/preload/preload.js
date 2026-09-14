const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (patch) => ipcRenderer.invoke('settings:save', patch),
  },
  openSettingsWindow: () => ipcRenderer.invoke('window:open-settings'),
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    create: (payload) => ipcRenderer.invoke('tasks:create', payload),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('tasks:delete', id),
    onChanged: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('tasks:changed', listener);
      return () => ipcRenderer.removeListener('tasks:changed', listener);
    },
  },
  capture: {
    triggerNow: () => ipcRenderer.invoke('capture:trigger'),
    submit: (draft) => ipcRenderer.invoke('capture:submit', draft),
    discard: () => ipcRenderer.invoke('capture:discard'),
    onAnalyzing: (callback) => ipcRenderer.on('capture:analyzing', () => callback()),
    onResult: (callback) => ipcRenderer.on('capture:result', (_event, draft) => callback(draft)),
    onError: (callback) => ipcRenderer.on('capture:error', (_event, message) => callback(message)),
  },
});
