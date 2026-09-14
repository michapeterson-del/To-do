const { desktopCapturer, screen } = require('electron');

async function captureScreenshotPngBase64() {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor || 1;
  const width = Math.round(display.size.width * scaleFactor);
  const height = Math.round(display.size.height * scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });

  if (!sources.length) {
    throw new Error('Kein Bildschirm zum Aufnehmen gefunden (fehlt evtl. die Bildschirmaufnahme-Berechtigung?).');
  }

  const primary = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  return primary.thumbnail.toPNG().toString('base64');
}

module.exports = { captureScreenshotPngBase64 };
