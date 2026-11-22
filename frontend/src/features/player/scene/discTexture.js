import { CanvasTexture, SRGBColorSpace } from 'three';
import '@fontsource/permanent-marker/400.css';

// Cara de un vinilo de 12": surcos, brillo de la luz del estudio y la etiqueta central.
// 1024 px: la etiqueta escrita a mano se lee nítida en el plato a 1440 px.
const SIZE = 1024;
const R = SIZE / 2;
const LABEL = R * 0.34;
const cache = new Map();
// Caben la tanda actual y la siguiente sin retener 40 texturas de 1024 px en móviles.
const MAX_CACHED = 16;

// Una canción sin preview se muestra como prensado de prueba: etiqueta blanca escrita a rotulador.
export { isBlankTrack as isBlank } from '../trackState';
import { isBlankTrack, shortTitle } from '../trackState';
// Portadas más nítidas para la etiqueta: 500 px en Deezer, 600 px en iTunes.
const largeArtwork = url => url?.replace(/\/250x250-/, '/500x500-').replace(/\/100x100bb\./, '/600x600bb.');

function circle(ctx, radius) { ctx.beginPath(); ctx.arc(R, R, radius, 0, Math.PI * 2); }

// El vinilo: negro con surcos finos, bandas lisas entre pistas y el reflejo cálido de la lámpara.
function drawGrooves(ctx) {
  ctx.fillStyle = '#0b0908'; circle(ctx, R); ctx.fill();
  for (let radius = LABEL + 8; radius < R - 6; radius += 2.2) {
    // Bandas lisas (silencios entre pistas): anillos algo más brillantes.
    const gap = [0.52, 0.64, 0.76, 0.88].some(f => Math.abs(radius / R - f) < 0.006);
    ctx.strokeStyle = gap ? 'rgba(70, 58, 50, .9)' : `rgba(${28 + (radius % 3) * 6}, ${24 + (radius % 3) * 5}, ${22 + (radius % 3) * 4}, .9)`;
    ctx.lineWidth = gap ? 3 : 1.1;
    circle(ctx, radius); ctx.stroke();
  }
  if (ctx.createConicGradient) {
    const sheen = ctx.createConicGradient(-0.6, R, R);
    sheen.addColorStop(0, 'rgba(255, 196, 140, 0)');
    sheen.addColorStop(0.06, 'rgba(255, 196, 140, .2)');
    sheen.addColorStop(0.12, 'rgba(255, 196, 140, 0)');
    sheen.addColorStop(0.5, 'rgba(255, 196, 140, 0)');
    sheen.addColorStop(0.56, 'rgba(255, 210, 160, .12)');
    sheen.addColorStop(0.62, 'rgba(255, 196, 140, 0)');
    sheen.addColorStop(1, 'rgba(255, 196, 140, 0)');
    ctx.fillStyle = sheen; circle(ctx, R); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, .9)'; ctx.lineWidth = 10; circle(ctx, R - 5); ctx.stroke();
}

function spindle(ctx) {
  ctx.fillStyle = '#0b0908'; circle(ctx, R * 0.03); ctx.fill();
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

// Prensado de prueba: etiqueta de papel marfil con el título y el artista a rotulador.
function drawBlank(ctx, track) {
  drawGrooves(ctx);
  const paper = ctx.createRadialGradient(R * 0.94, R * 0.9, 10, R, R, LABEL);
  paper.addColorStop(0, '#f2ead8'); paper.addColorStop(1, '#ddcfb2');
  ctx.fillStyle = paper; circle(ctx, LABEL); ctx.fill();
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#1a120c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const title = shortTitle(track.title);
  const maxWidth = LABEL * 1.55;
  let size = 64, lines = [];
  for (size = 64; size >= 30; size -= 4) {
    ctx.font = `${size}px "Permanent Marker", cursive`;
    lines = wrap(ctx, title, maxWidth, 2);
    if (!lines.at(-1).endsWith('…')) break;
  }
  lines.forEach((line, i) => ctx.fillText(line, 0, -LABEL * 0.36 + (i - (lines.length - 1) / 2) * size * 1.02));
  ctx.font = '34px "Permanent Marker", cursive';
  ctx.fillText(wrap(ctx, track.artist, maxWidth * 0.9, 1)[0] || '', 0, LABEL * 0.42);
  ctx.restore();
  spindle(ctx);
}

function drawCover(ctx, image) {
  drawGrooves(ctx);
  ctx.save(); circle(ctx, LABEL); ctx.clip();
  ctx.drawImage(image, R - LABEL, R - LABEL, LABEL * 2, LABEL * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 0, 0, .35)'; ctx.lineWidth = 3; circle(ctx, LABEL); ctx.stroke();
  spindle(ctx);
}

// Portada aún sin llegar: etiqueta lisa de cartón; no se afirma todavía que falte el preview.
function drawLoading(ctx) {
  drawGrooves(ctx);
  ctx.fillStyle = '#6b4a30'; circle(ctx, LABEL); ctx.fill();
  spindle(ctx);
}

// Textura de la cara de un vinilo. Se dibuja al instante y se completa al cargar portada o fuente.
export function discTexture(track, onUpdate) {
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
    document.fonts?.load('64px "Permanent Marker"').then(() => { ctx.clearRect(0, 0, SIZE, SIZE); drawBlank(ctx, track); refresh(); }).catch(() => {});
  };
  if (blank) writeBlank();
  else if (pending) { drawLoading(ctx); refresh(); }
  else {
    drawLoading(ctx);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => { ctx.clearRect(0, 0, SIZE, SIZE); drawCover(ctx, image); refresh(); };
    // Portada ausente o bloqueada: queda como prensado de prueba con su nombre.
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

// Funda cuadrada: la portada a toda cara; sin preview, cartón kraft con el título a rotulador.
const SLEEVE = 512;
const sleeves = new Map();
function drawKraft(ctx, track) {
  ctx.fillStyle = '#b48a5c'; ctx.fillRect(0, 0, SLEEVE, SLEEVE);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '70,44,22' : '235,205,160'},${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * SLEEVE, Math.random() * SLEEVE, 2, 2);
  }
  ctx.strokeStyle = 'rgba(60, 36, 18, .35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(SLEEVE / 2, SLEEVE / 2, SLEEVE * 0.16, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.translate(SLEEVE / 2, SLEEVE * 0.3);
  ctx.rotate(-0.05);
  ctx.fillStyle = '#1a120c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 64, lines = [];
  for (size = 64; size >= 28; size -= 4) {
    ctx.font = `${size}px "Permanent Marker", cursive`;
    lines = wrap(ctx, shortTitle(track.title), SLEEVE * 0.82, 2);
    if (!lines.at(-1).endsWith('…')) break;
  }
  lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * size * 1.02));
  ctx.font = '34px "Permanent Marker", cursive';
  ctx.fillText(wrap(ctx, track.artist, SLEEVE * 0.8, 1)[0] || '', 0, SLEEVE * 0.5);
  ctx.restore();
}
export function sleeveTexture(track, onUpdate) {
  const blank = isBlankTrack(track);
  const key = `${track?.id}:${blank ? 'blank' : track?.artworkUrl ? 'cover' : 'pending'}`;
  const hit = sleeves.get(key);
  if (hit) { sleeves.delete(key); sleeves.set(key, hit); return hit; }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SLEEVE;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const refresh = () => { texture.needsUpdate = true; onUpdate?.(); };
  const kraft = () => {
    drawKraft(ctx, track); refresh();
    document.fonts?.load('64px "Permanent Marker"').then(() => { drawKraft(ctx, track); refresh(); }).catch(() => {});
  };
  if (blank || !track?.artworkUrl) {
    if (blank) kraft(); else { ctx.fillStyle = '#6b4a30'; ctx.fillRect(0, 0, SLEEVE, SLEEVE); refresh(); }
  } else {
    ctx.fillStyle = '#6b4a30'; ctx.fillRect(0, 0, SLEEVE, SLEEVE); refresh();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => { ctx.drawImage(image, 0, 0, SLEEVE, SLEEVE); refresh(); };
    image.onerror = kraft;
    image.src = largeArtwork(track.artworkUrl);
  }
  sleeves.set(key, texture);
  while (sleeves.size > MAX_CACHED) {
    const [oldest, old] = sleeves.entries().next().value;
    sleeves.delete(oldest); old.dispose();
  }
  return texture;
}
