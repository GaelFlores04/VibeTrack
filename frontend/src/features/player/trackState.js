// Reglas de presentación de una canción, sin dependencias 3D.

// Sin preview confirmado: se muestra como CD-R virgen con el nombre a rotulador.
export const isBlankTrack = track => !track?.previewUrl && ['unavailable', 'not_found'].includes(track?.previewStatus);

// Etiqueta corta del motivo de recomendación para listas.
export function reasonTag(reason = '') {
  if (reason.startsWith('De uno de tus artistas')) return 'Tu artista';
  if (reason.startsWith('Artista similar')) return 'Similar';
  if (reason.startsWith('Porque escuchas')) return 'Cercano';
  if (reason.startsWith('De tus géneros')) return 'Tus géneros';
  if (reason.startsWith('Del mismo estilo')) return 'Su estilo';
  if (reason.startsWith('Una sorpresa')) return 'Sorpresa';
  if (reason.startsWith('Para descubrir')) return 'Descubrir';
  if (reason.startsWith('Selección conocida')) return 'Conocida';
  return 'Del mood';
}

export const formatDuration = ms => (Number.isFinite(ms) && ms > 0 ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` : '');

// Título corto para escribir sobre un disco: sin "(feat. …)", "(with …)", "(from …)" ni "- … Remaster".
export const shortTitle = title => String(title || '').replace(/\s*[([](?:feat\.?|ft\.?|with|from)\b[^)\]]*[)\]]/gi, '').replace(/\s+-\s+.*(?:remaster|version|edit|live).*$/i, '').trim() || String(title || '');
