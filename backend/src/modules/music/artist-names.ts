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
