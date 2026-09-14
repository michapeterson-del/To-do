const { Notification } = require('electron');
const { readConfig, isConfigured } = require('./config-store');
const { captureScreenshotPngBase64 } = require('./screenshot');
const { analyzeScreenshot } = require('./claude-vision');
const { createCaptureWindow } = require('./windows');

async function runCaptureFlow() {
  const config = readConfig();
  if (!isConfigured(config)) {
    new Notification({
      title: 'Aufgabenplaner',
      body: 'Bitte zuerst Supabase- und Claude-API-Keys in den Einstellungen hinterlegen.',
    }).show();
    return;
  }

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
    const pngBase64 = await captureScreenshotPngBase64();
    const draft = await analyzeScreenshot(config, pngBase64);
    send('capture:result', draft);
  } catch (err) {
    send('capture:error', err.message || String(err));
  }
}

module.exports = { runCaptureFlow };
