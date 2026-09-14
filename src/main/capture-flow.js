const { Notification } = require('electron');
const { readConfig, isConfigured } = require('./config-store');
const { getActiveDisplay, captureDisplayPngBase64 } = require('./screenshot');
const { analyzeScreenshot } = require('./claude-vision');
const { createCaptureWindow, createSelectionWindow } = require('./windows');

// Schritt 1: Ganzen aktiven Bildschirm einmal aufnehmen und als Hintergrund
// im Auswahl-Fenster zeigen (wie beim Snipping Tool) - erst nach der
// Bereichsauswahl (siehe analyzeRegionAndShowResult) geht's an Claude.
async function runCaptureFlow() {
  const config = readConfig();
  if (!isConfigured(config)) {
    new Notification({
      title: 'Aufgabenplaner',
      body: 'Bitte zuerst Supabase- und Claude-API-Keys in den Einstellungen hinterlegen.',
    }).show();
    return;
  }

  try {
    const display = getActiveDisplay();
    const pngBase64 = await captureDisplayPngBase64(display);
    createSelectionWindow(display, pngBase64);
  } catch (err) {
    new Notification({
      title: 'Aufgabenplaner',
      body: err.message || String(err),
    }).show();
  }
}

// Schritt 2: Nachdem der Nutzer im Auswahl-Fenster einen Bereich gezogen hat,
// wird nur dieser zugeschnittene Ausschnitt an Claude geschickt.
async function analyzeRegionAndShowResult(croppedPngBase64) {
  const config = readConfig();
  const win = createCaptureWindow();
  const send = (channel, payload) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };
  const emitAnalyzing = () => send('capture:analyzing');
  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once('did-finish-load', emitAnalyzing);
  } else {
    emitAnalyzing();
  }

  try {
    const draft = await analyzeScreenshot(config, croppedPngBase64);
    send('capture:result', draft);
  } catch (err) {
    send('capture:error', err.message || String(err));
  }
}

module.exports = { runCaptureFlow, analyzeRegionAndShowResult };
