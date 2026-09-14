// Erzeugt build/icon.png und build/tray.png (ein Haekchen-Symbol) rein mit
// Node-Bordmitteln (kein Bild-Package noetig). Bei Bedarf einfach erneut
// ausfuehren: `npm run icons`.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePng(filePath, width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // Filter-Typ: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const off = rowStart + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = chunk('IEND', Buffer.alloc(0));

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([sig, ihdr, idat, iend]));
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  let t = abLen2 === 0 ? 0 : (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function drawIcon(size) {
  const bg = [79, 70, 229, 255]; // Indigo
  const white = [255, 255, 255, 255];
  const margin = size * 0.16;
  const radius = size * 0.22;
  const left = margin;
  const top = margin;
  const right = size - margin;
  const bottom = size - margin;

  function inRoundedSquare(x, y) {
    if (x < left || x > right || y < top || y > bottom) return false;
    const nearLeft = x < left + radius;
    const nearRight = x > right - radius;
    const nearTop = y < top + radius;
    const nearBottom = y > bottom - radius;
    if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
      const cx = nearLeft ? left + radius : right - radius;
      const cy = nearTop ? top + radius : bottom - radius;
      const dx = x - cx;
      const dy = y - cy;
      return dx * dx + dy * dy <= radius * radius;
    }
    return true;
  }

  const strokeWidth = size * 0.09;
  const p1 = { x: size * 0.3, y: size * 0.53 };
  const p2 = { x: size * 0.44, y: size * 0.67 };
  const p3 = { x: size * 0.72, y: size * 0.33 };

  return (x, y) => {
    if (!inRoundedSquare(x + 0.5, y + 0.5)) return [0, 0, 0, 0];
    const d1 = distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
    const d2 = distToSegment(x, y, p2.x, p2.y, p3.x, p3.y);
    if (Math.min(d1, d2) <= strokeWidth / 2) return white;
    return bg;
  };
}

const buildDir = path.join(__dirname, '..', 'build');
writePng(path.join(buildDir, 'icon.png'), 512, 512, drawIcon(512));
writePng(path.join(buildDir, 'tray.png'), 64, 64, drawIcon(64));

console.log('Icons erzeugt: build/icon.png, build/tray.png');
