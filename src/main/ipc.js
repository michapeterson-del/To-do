const { ipcMain } = require('electron');
const { readConfig, writeConfig, isConfigured } = require('./config-store');
const { listTasks, createTask, updateTask, deleteTask } = require('./supabase-rest');
const { closeCaptureWindow, getPlannerWindow, createSettingsWindow } = require('./windows');
const { runCaptureFlow } = require('./capture-flow');

function registerIpcHandlers({ registerHotkey }) {
  ipcMain.handle('settings:get', () => readConfig());

  ipcMain.handle('settings:save', (_event, patch) => {
    const next = writeConfig(patch);
    const hotkeyOk = registerHotkey();
    return { config: next, hotkeyOk };
  });

  ipcMain.handle('window:open-settings', () => {
    createSettingsWindow();
  });

  ipcMain.handle('tasks:list', async () => {
    const config = readConfig();
    if (!isConfigured(config)) return [];
    return listTasks(config);
  });

  ipcMain.handle('tasks:create', async (_event, payload) => {
    const config = readConfig();
    return createTask(config, payload);
  });

  ipcMain.handle('tasks:update', async (_event, { id, patch }) => {
    const config = readConfig();
    return updateTask(config, id, patch);
  });

  ipcMain.handle('tasks:delete', async (_event, id) => {
    const config = readConfig();
    await deleteTask(config, id);
    return null;
  });

  ipcMain.handle('capture:trigger', () => {
    runCaptureFlow();
  });

  ipcMain.handle('capture:submit', async (_event, draft) => {
    const config = readConfig();
    const task = await createTask(config, { ...draft, source: 'screenshot' });
    closeCaptureWindow();
    const planner = getPlannerWindow();
    if (planner && !planner.isDestroyed()) {
      planner.webContents.send('tasks:changed');
    }
    return task;
  });

  ipcMain.handle('capture:discard', () => {
    closeCaptureWindow();
  });
}

module.exports = { registerIpcHandlers };
