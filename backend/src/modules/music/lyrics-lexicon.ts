// Tono de una letra con un diccionario local (español e inglés), sin servicios externos.
// Sólo se conserva el perfil numérico: la letra nunca se guarda ni se muestra.
// Súbelo al cambiar el vocabulario o los pesos: invalida los perfiles cacheados.
export const LEXICON_VERSION = 2;
export type LyricTheme = 'heartbreak' | 'sadness' | 'love' | 'party' | 'joy' | 'motivation';
export type LyricProfile = Record<LyricTheme, number> & { words: number };

const normalize = (text: string) => ` ${text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

// Frases y palabras por tema. Se evitan las muy comunes ("solo", "ya no", "puedo") que dan falsos positivos.
const LEXICON: Record<LyricTheme, string[]> = {
  heartbreak: [
    'tusa', 'despecho', 'me dejaste', 'te fuiste', 'sin ti', 'olvidarte', 'olvidarme', 'te olvide', 'olvidarlo', 'olvidarla',
    'extrano', 'te extrano', 'extranarte', 'me haces falta', 'corazon roto', 'me rompiste', 'rompiste', 'lloro', 'llorar',
    'llorando', 'lagrimas', 'me duele', 'duele', 'traicion', 'me traicionaste', 'mentiste', 'mentiras', 'nunca mas', 'adios',
    'mi ex', 'tu ex', 'superarte', 'te supere', 'ya no me quieres', 'ya no estas', 'heartbreak', 'broken heart', 'broke my heart',
    'you left', 'left me', 'without you', 'miss you', 'i miss', 'goodbye', 'tears', 'crying', 'cried', 'hurts', 'hurt me',
    'moved on', 'over you', 'you lied', 'lies',
    // Desamor dicho con expresiones (frecuente en el pop urbano latino) y en inglés coloquial.
    'te quedo grande', 'me olvide de ti', 'ya me olvide', 'ya te olvide', 'otra persona', 'otra mujer', 'otro hombre', 'el que te perdio',
    'la que te perdio', 'me perdiste', 'te arrepientas', 'arrepentido', 'arrepentida', 'no vuelvas', 'volver conmigo', 'ya no te quiero',
    'no te quiero', 'te supere', 'superado', 'fingir', 'fingiste', 'me enganaste', 'enganaste', 'infiel', 'cuernos', 'me usaste',
    'me cambiaste', 'despues de ti', 'el ex', 'la ex', 'ex novio', 'ex novia', 'sin mi', 'someone else', 'on my own', 'you broke',
    'brokenhearted', 'cheated', 'used me', 'let me go', 'let you go', 'over me',
  ],
  sadness: [
    'triste', 'tristeza', 'soledad', 'vacio', 'oscuridad', 'morir', 'me muero', 'muerte', 'sufrir', 'sufro', 'pena', 'melancolia',
    'sad', 'sadness', 'lonely', 'loneliness', 'empty', 'darkness', 'dying', 'sorrow', 'pain',
  ],
  love: [
    'te amo', 'te quiero', 'mi amor', 'enamorado', 'enamorada', 'enamorarme', 'besos', 'besarte', 'mi vida', 'contigo', 'juntos',
    'i love you', 'love you', 'my love', 'in love', 'kiss me', 'together', 'forever',
  ],
  party: [
    'fiesta', 'perreo', 'perrear', 'perrea', 'bailar', 'baila', 'bailando', 'bailame', 'discoteca', 'rumba', 'janguear', 'jangueo',
    'pista', 'trago', 'tragos', 'botella', 'shots', 'gozar', 'gozando', 'party', 'dance', 'dancing', 'club', 'drinks', 'tonight',
  ],
  joy: [
    'feliz', 'felicidad', 'alegria', 'alegre', 'sonrisa', 'sonreir', 'sonrie', 'brillar', 'brilla', 'celebrar', 'happy',
    'happiness', 'smile', 'sunshine', 'celebrate', 'good vibes', 'good times', 'joy', 'shine',
  ],
  motivation: [
    'fuerte', 'ganar', 'luchar', 'levantate', 'no me rindo', 'nunca me rindo', 'campeon', 'strong', 'fight', 'winner', 'rise up',
    'never give up', 'unstoppable', 'hustle', 'grind', 'champion', 'believe',
  ],
};
// El desamor suele decirse con menos palabras clave que la fiesta: pesa algo más.
const WEIGHT: Record<LyricTheme, number> = { heartbreak: 1.5, sadness: 1.2, love: 1, party: 1, joy: 1, motivation: 1 };
const THEMES = Object.keys(LEXICON) as LyricTheme[];
const PATTERNS = Object.fromEntries(THEMES.map(theme => [theme, LEXICON[theme].map(normalize)])) as Record<LyricTheme, string[]>;

function occurrences(text: string, phrase: string) {
  let count = 0;
  for (let i = text.indexOf(phrase); i !== -1; i = text.indexOf(phrase, i + phrase.length - 1)) count++;
  return count;
}

// Cada tema puntúa 0–1 según cuántas veces aparece por cada 100 palabras (saturando).
export function analyzeLyrics(lyrics: string): LyricProfile | null {
  const text = normalize(lyrics || '');
  const words = text.trim() ? text.trim().split(' ').length : 0;
  if (words < 25) return null; // Letra demasiado corta para opinar.
  const profile = { words } as LyricProfile;
  for (const theme of THEMES) {
    const hits = PATTERNS[theme].reduce((sum, phrase) => sum + occurrences(text, phrase), 0) * WEIGHT[theme];
    profile[theme] = Number((1 - Math.exp(-(hits * 100 / words) / 2.5)).toFixed(3));
  }
  return profile;
}

// Tema dominante: el más alto, si es claro (≥ .5 y al menos 1.2× el siguiente).
export function dominantTheme(profile?: LyricProfile | null): LyricTheme | null {
  if (!profile) return null;
  const ranked = [...THEMES].sort((a, b) => profile[b] - profile[a]);
  const [first, second] = ranked;
  return profile[first] >= 0.5 && profile[first] >= profile[second] * 1.2 ? first : null;
}
