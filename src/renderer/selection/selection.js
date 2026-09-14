const bg = document.getElementById('bg');
const rectEl = document.getElementById('rect');
const workCanvas = document.getElementById('workCanvas');

let naturalWidth = 0;
let naturalHeight = 0;
let dragging = false;
let startX = 0;
let startY = 0;

window.api.selection.onImage((pngBase64) => {
  bg.onload = () => {
    naturalWidth = bg.naturalWidth;
    naturalHeight = bg.naturalHeight;
  };
  bg.src = `data:image/png;base64,${pngBase64}`;
});

function currentRect(curX, curY) {
  const x = Math.min(startX, curX);
  const y = Math.min(startY, curY);
  const width = Math.abs(curX - startX);
  const height = Math.abs(curY - startY);
  return { x, y, width, height };
}

function updateRectEl(r) {
  rectEl.style.left = `${r.x}px`;
  rectEl.style.top = `${r.y}px`;
  rectEl.style.width = `${r.width}px`;
  rectEl.style.height = `${r.height}px`;
}

function cropAndSubmit(rect) {
  if (!naturalWidth || !naturalHeight) return;
  const scaleX = naturalWidth / window.innerWidth;
  const scaleY = naturalHeight / window.innerHeight;
  const sx = Math.round(rect.x * scaleX);
  const sy = Math.round(rect.y * scaleY);
  const sw = Math.round(rect.width * scaleX);
  const sh = Math.round(rect.height * scaleY);

  workCanvas.width = sw;
  workCanvas.height = sh;
  const ctx = workCanvas.getContext('2d');
  ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, sw, sh);
  const dataUrl = workCanvas.toDataURL('image/png');
  window.api.selection.submit(dataUrl.split(',')[1]);
}

document.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  rectEl.style.display = 'block';
  updateRectEl(currentRect(e.clientX, e.clientY));
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  updateRectEl(currentRect(e.clientX, e.clientY));
});

document.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  const rect = currentRect(e.clientX, e.clientY);
  if (rect.width < 6 || rect.height < 6) {
    rectEl.style.display = 'none';
    return;
  }
  cropAndSubmit(rect);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.api.selection.cancel();
  }
});
