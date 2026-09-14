const path = require('path');
const { app, globalShortcut, Menu, Tray, nativeImage, Notification, BrowserWindow } = require('electron');
const { readConfig, isConfigured } = require('./config-store');
const {
  createPlannerWindow,
  createSettingsWindow,
} = require('./windows');
const { runCaptureFlow } = require('./capture-flow');
const { registerIpcHandlers } = require('./ipc');

let tray = null;
let registeredHotkey = null;

function registerHotkey() {
  const config = readConfig();
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey);
    registeredHotkey = null;
  }
  if (!config.hotkey) return true;

  const ok = globalShortcut.register(config.hotkey, () => {
    runCaptureFlow();
  });

  if (ok) {
    registeredHotkey = config.hotkey;
  } else {
    new Notification({
      title: 'Aufgabenplaner',
      body: `Tastenkuerzel "${config.hotkey}" konnte nicht registriert werden (evtl. bereits von einer anderen App belegt). Bitte in den Einstellungen aendern.`,
    }).show();
  }
  return ok;
}

function buildTray() {
  const iconPath = path.join(__dirname, '..', '..', 'build', 'tray.png');
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Aufgabenplaner');
  const menu = Menu.buildFromTemplate([
    { label: 'Planer oeffnen', click: () => createPlannerWindow() },
    { label: 'Aufgabe jetzt erfassen', click: () => runCaptureFlow() },
    { label: 'Einstellungen', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => createPlannerWindow());
}

function buildAppMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { label: 'Einstellungen...', accelerator: 'Cmd+,', click: () => createSettingsWindow() },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Datei',
      submenu: [
        { label: 'Aufgabe jetzt erfassen', accelerator: 'CmdOrCtrl+Shift+N', click: () => runCaptureFlow() },
        ...(process.platform !== 'darwin' ? [{ label: 'Einstellungen', click: () => createSettingsWindow() }] : []),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  registerIpcHandlers({ registerHotkey });
  buildAppMenu();
  buildTray();
  registerHotkey();

  const config = readConfig();
  if (!isConfigured(config)) {
    createSettingsWindow();
  } else {
    createPlannerWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPlannerWindow();
    }
  });
});

// Die App laeuft bewusst im Hintergrund/Tray weiter, wenn alle Fenster
// geschlossen sind - sonst wuerde das globale Tastenkuerzel nicht mehr
// funktionieren. Beenden nur ueber das Tray-Menue bzw. "Beenden" im Menue.
app.on('window-all-closed', () => {});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
