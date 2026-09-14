const { desktopCapturer, screen } = require('electron');

function getActiveDisplay() {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint);
}

async function captureDisplayPngBase64(display) {
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

  const active = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  return active.thumbnail.toPNG().toString('base64');
}

module.exports = { getActiveDisplay, captureDisplayPngBase64 };
