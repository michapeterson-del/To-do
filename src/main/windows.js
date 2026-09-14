const path = require('path');
const { BrowserWindow, screen } = require('electron');

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'preload.js');
const APP_ICON_PATH = path.join(__dirname, '..', '..', 'build', 'icon.png');

let plannerWindow = null;
let captureWindow = null;
let settingsWindow = null;

function baseWebPreferences() {
  return {
    preload: PRELOAD_PATH,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function createPlannerWindow() {
  if (plannerWindow && !plannerWindow.isDestroyed()) {
    plannerWindow.show();
    plannerWindow.focus();
    return plannerWindow;
  }
  plannerWindow = new BrowserWindow({
    width: 920,
    height: 700,
    minWidth: 640,
    minHeight: 480,
    title: 'Aufgabenplaner',
    icon: APP_ICON_PATH,
    webPreferences: baseWebPreferences(),
  });
  plannerWindow.loadFile(path.join(__dirname, '..', 'renderer', 'planner', 'index.html'));
  plannerWindow.on('closed', () => {
    plannerWindow = null;
  });
  return plannerWindow;
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    title: 'Einstellungen',
    icon: APP_ICON_PATH,
    webPreferences: baseWebPreferences(),
  });
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  return settingsWindow;
}

function createCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show();
    captureWindow.focus();
    return captureWindow;
  }
  const display = screen.getPrimaryDisplay();
  const width = 380;
  const height = 300;
  const x = display.workArea.x + display.workArea.width - width - 24;
  const y = display.workArea.y + 24;

  captureWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: APP_ICON_PATH,
    webPreferences: baseWebPreferences(),
  });
  try {
    captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    // Nur auf manchen Plattformen relevant (z.B. macOS Vollbild) - sonst egal.
  }
  captureWindow.loadFile(path.join(__dirname, '..', 'renderer', 'capture', 'index.html'));
  captureWindow.once('ready-to-show', () => captureWindow.show());
  captureWindow.on('closed', () => {
    captureWindow = null;
  });
  return captureWindow;
}

function closeCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close();
  }
}

function getCaptureWindow() {
  return captureWindow;
}

function getPlannerWindow() {
  return plannerWindow;
}

module.exports = {
  createPlannerWindow,
  createSettingsWindow,
  createCaptureWindow,
  closeCaptureWindow,
  getCaptureWindow,
  getPlannerWindow,
};
