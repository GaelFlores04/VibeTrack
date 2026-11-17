import { CanvasTexture, SRGBColorSpace } from 'three';
import '@fontsource/permanent-marker/400.css';

// 1024 px: el rótulo del CD-R se lee nítido también en el lector a 1440 px.
const SIZE = 1024;
const R = SIZE / 2;
const cache = new Map();
// Caben la tanda actual y la siguiente sin retener 40 texturas de 1024 px en móviles.
const MAX_CACHED = 16;

// Una canción sin preview se muestra como CD-R virgen con su nombre a rotulador.
export { isBlankTrack as isBlank } from '../trackState';
import { isBlankTrack, shortTitle } from '../trackState';
// Portadas más nítidas para la textura: 500 px en Deezer, 600 px en iTunes.
const largeArtwork = url => url?.replace(/\/250x250-/, '/500x500-').replace(/\/100x100bb\./, '/600x600bb.');

function circle(ctx, radius) { ctx.beginPath(); ctx.arc(R, R, radius, 0, Math.PI * 2); }

// Brillo iridiscente, anillo transparente, orificio central y canto.
function finish(ctx) {
  if (ctx.createConicGradient) {
    const sheen = ctx.createConicGradient(3.4, R, R);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.1, 'rgba(190,235,255,.26)');
    sheen.addColorStop(0.24, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.55, 'rgba(255,220,250,.16)');
    sheen.addColorStop(0.7, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; circle(ctx, R); ctx.fill();
  }
  ctx.fillStyle = 'rgba(214, 226, 238, .94)'; circle(ctx, R * 0.21); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; circle(ctx, R * 0.21); ctx.stroke();
  ctx.fillStyle = '#0a1f3f'; circle(ctx, R * 0.075); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 8; circle(ctx, R - 4); ctx.stroke();
}

function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

// CD-R: superficie plateada con surcos y el título escrito a mano sobre el orificio.

function drawBlank(ctx, track) {
  const base = ctx.createRadialGradient(R * 0.7, R * 0.6, R * 0.1, R, R, R);
  base.addColorStop(0, '#f6f8fb'); base.addColorStop(0.6, '#dfe6ee'); base.addColorStop(1, '#c8d2dd');
  ctx.fillStyle = base; circle(ctx, R); ctx.fill();
  ctx.lineWidth = 2;
  for (let radius = R * 0.24; radius < R - 8; radius += 10) {
    ctx.strokeStyle = `rgba(120, 140, 165, ${0.05 + (radius % 3) * 0.02})`;
    circle(ctx, radius); ctx.stroke();
  }
  ctx.save();
  // Franja reservada para el título: del borde superior hasta antes del anillo central.
  const bandTop = R * 0.22, bandBottom = R * 0.74;
  ctx.fillStyle = '#05070a';
  ctx.strokeStyle = '#05070a';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const title = shortTitle(track.title);
  const maxWidth = SIZE * 0.6;
  let size = 128, lines = [];
  // Primero dos líneas encogiendo la letra; si no cabe, tres. Nunca invade el centro.
  for (const maxLines of [2, 3]) {
    for (size = 128; size >= 52; size -= 6) {
      ctx.font = `${size}px "Permanent Marker", cursive`;
      lines = wrap(ctx, title, maxWidth, maxLines);
      const fitsWidth = lines.every(line => ctx.measureText(line).width <= maxWidth) && !lines.at(-1).endsWith('…');
      if (fitsWidth && lines.length * size * 1.02 <= bandBottom - bandTop) break;
    }
    if (lines.length <= maxLines && !lines.at(-1).endsWith('…') && lines.length * size * 1.02 <= bandBottom - bandTop) break;
  }
  const lineHeight = size * 1.02;
  ctx.translate(R, (bandTop + bandBottom) / 2);
  ctx.rotate(-0.07);
  ctx.lineWidth = size * 0.05;
  lines.forEach((line, i) => { const y = (i - (lines.length - 1) / 2) * lineHeight; ctx.strokeText(line, 0, y); ctx.fillText(line, 0, y); });
  // Subrayado a mano alzada.
  const width = Math.min(SIZE * 0.5, Math.max(...lines.map(line => ctx.measureText(line).width)));
  ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath();
  const y = (lines.length / 2) * lineHeight + 4;
  ctx.moveTo(-width / 2, y); ctx.quadraticCurveTo(0, y + 14, width / 2, y - 6); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(R, R * 1.5);
  ctx.rotate(0.04);
  ctx.fillStyle = '#10131a';
  ctx.textAlign = 'center';
  ctx.font = '62px "Permanent Marker", cursive';
  ctx.fillText(wrap(ctx, track.artist, SIZE * 0.5, 1)[0] || '', 0, 0);
  ctx.restore();
  finish(ctx);
}

function drawCover(ctx, image) {
  ctx.save(); circle(ctx, R); ctx.clip();
  ctx.fillStyle = '#c9d3de'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  ctx.restore();
  finish(ctx);
}

function drawLoading(ctx) {
  const base = ctx.createRadialGradient(R * 0.7, R * 0.6, R * 0.1, R, R, R);
  base.addColorStop(0, '#eef2f6'); base.addColorStop(1, '#b9c4d1');
  ctx.fillStyle = base; circle(ctx, R); ctx.fill();
  finish(ctx);
}

// Textura del lado impreso de un CD. Se dibuja al instante y se completa al cargar portada o fuente.
export function discTexture(track, onUpdate) {
  // Sin preview confirmado → CD-R. Portada aún sin llegar → disco plateado liso (no se afirma "sin preview").
  const blank = isBlankTrack(track);
  const pending = !blank && !track?.artworkUrl;
  const key = `${track?.id}:${blank ? 'blank' : pending ? 'pending' : 'cover'}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const refresh = () => { texture.needsUpdate = true; onUpdate?.(); };
  const writeBlank = () => {
    drawBlank(ctx, track); refresh();
    document.fonts?.load('128px "Permanent Marker"').then(() => { ctx.clearRect(0, 0, SIZE, SIZE); drawBlank(ctx, track); refresh(); }).catch(() => {});
  };
  if (blank) writeBlank();
  else if (pending) { drawLoading(ctx); refresh(); }
  else {
    drawLoading(ctx);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => { ctx.clearRect(0, 0, SIZE, SIZE); drawCover(ctx, image); refresh(); };
    // Portada ausente o bloqueada: el disco queda como CD-R con su nombre.
    image.onerror = () => { ctx.clearRect(0, 0, SIZE, SIZE); writeBlank(); };
    image.src = largeArtwork(track.artworkUrl);
  }
  cache.set(key, texture);
  while (cache.size > MAX_CACHED) {
    const [oldest, old] = cache.entries().next().value;
    cache.delete(oldest); old.dispose();
  }
  return texture;
}
