// Normalización compartida para búsquedas y preferencias guardadas anteriormente.
export const artistKey = (name: string) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const canonicalArtistName = (name: string) => name.trim().replace(/\s+[-–—]\s*topic\s*$/iu, '').trim();
export const isArtistResult = (name: unknown): name is string => typeof name === 'string' && !!name.trim() && name.trim().length <= 80
  && !/\s+[-–—]\s*(?:topic|official channel|official audio|lyrics?|vevo)\s*$/iu.test(name)
  && !/\s+(?:official audio|official channel|lyrics? video)\s*$/iu.test(name)
  && !/^(?:various artists|varios artistas|unknown artist|artista desconocido)$/iu.test(name.trim());
export function artistRelevance(name: string, query: string): number {
  const candidate = artistKey(name), term = artistKey(query);
  if (!term) return 0;
  if (candidate === term) return 4;
  if (candidate.startsWith(term)) return 3;
  const words = candidate.split(' ');
  if (term.split(' ').every(token => words.some(word => word.startsWith(token)))) return 2;
  return candidate.includes(term) ? 1 : 0;
}
// Colaboraciones y variantes que Last.fm lista como si fueran artistas ("Daft Punk & Pharrell
// Williams", "The Weeknd, Daft Punk", "Daft Punk - Stardust"). Los marcadores fuertes siempre indican
// varios artistas y el primero es el principal.
const STRONG_COLLAB = /\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x|×)\s+/iu;
export function collaborationParts(name: string): { strong: boolean; parts: string[] } {
  const clean = name.trim();
  return STRONG_COLLAB.test(clean) ? { strong: true, parts: clean.split(STRONG_COLLAB).map(part => part.trim()).filter(Boolean) } : { strong: false, parts: [clean] };
}
// Une algo más al nombre: colaboración, edición o canal ("&", ",", "/", " - ", "•", "(", "and"…).
// Un simple espacio no cuenta: "Drake Bell" es otro artista, no una variante de Drake.
const JOINED = /[,&/+•([\]]|\s[-–—]\s|\s(?:feat\.?|ft\.?|featuring|with|vs\.?|x|×|and|y)\s/iu;
// Clave para variantes de escritura: "Earth Wind and Fire" = "Earth, Wind & Fire" = "Mumford&Sons".
const variantKey = (name: string) => ` ${artistKey(name).replace(/\b(?:and|y)\b/gu, ' ').replace(/\s+/gu, ' ').trim()} `;
// Deja sólo artistas o bandas principales: sin colaboraciones, variantes, duplicados ni nombres
// truncados ("Mumford", "Earth Wind") que desvían a un catálogo pequeño del mismo artista.
export function mainArtists<T extends { name: string; listeners: number }>(items: T[]): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    const key = variantKey(item.name), current = best.get(key);
    if (!current || item.listeners > current.listeners) best.set(key, item);
  }
  const unique = [...best.values()];
  const kept: T[] = [];
  for (const item of unique) {
    const key = variantKey(item.name);
    const variant = unique.some(other => other !== item && (
      // Contiene a otro artista igual o más escuchado, unido por un separador.
      (other.listeners >= item.listeners && key.includes(variantKey(other.name)) && JOINED.test(item.name))
      // Es el comienzo del nombre de un artista conocido y mucho más escuchado ("Mumford").
      || (other.listeners >= 100000 && other.listeners >= 5 * item.listeners && variantKey(other.name).startsWith(key))));
    if (!variant && !collaborationParts(item.name).strong) kept.push(item);
  }
  // Si la búsqueda sólo trajo colaboraciones explícitas, se ofrece el artista principal.
  for (const item of items) {
    const { strong, parts } = collaborationParts(item.name);
    if (strong && parts.length > 1 && !kept.some(other => variantKey(item.name).includes(variantKey(other.name)))) kept.push({ ...item, name: parts[0] });
  }
  return kept;
}
