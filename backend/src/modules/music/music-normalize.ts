// Memorizada: se llama millones de veces por tanda con los mismos textos (artistas, títulos,
// etiquetas). Sin caché, con 50 artistas de Spotify bloqueaba el servidor hasta 17 s seguidos.
const cache = new Map<string, string>();
export const normalize = (value: string) => {
  let result = cache.get(value);
  if (result === undefined) {
    result = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (cache.size >= 50000) cache.clear();
    cache.set(value, result);
  }
  return result;
};
